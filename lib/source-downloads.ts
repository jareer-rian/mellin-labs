import assets from "./operators.json" with { type: "json" };
import { massMatrix, slopeMatrix, validateInput, type Input, type Exploration } from "./inversion.ts";

// Data-only JSON insertion: no user-supplied code, labels, or filesystem paths.
// Export exact FE operators to avoid language-dependent quadrature differences.
export function sourceFile(language:"python"|"matlab"|"mathematica",input:Input,tuning:Exploration){
  validateInput(input);
  const n=input.moments.length;
  const data=JSON.stringify({
    engine:"Mellin_Lab_exploration_v2",baseline:"Mellin_Tikhonov_v1",
    source:assets.metadata.sourceURL,scale:assets.metadata.scale,
    moments:input.moments,errors:input.errors,includeM0:input.includeM0,
    seed:input.seed,replicas:500,logAlpha:tuning.logAlpha,mass:tuning.mass,slope:tuning.slope,
    x:assets.nodes,K:assets.kernel.slice(0,n+1),P:assets.penalty,M:massMatrix,S:slopeMatrix,
    sampleCov:assets.sampleCovariances[input.seed].slice(0,n).map(row=>row.slice(0,n)),
  });
  const templates={python:pythonSource,matlab:matlabSource,mathematica:mathematicaSource};
  const extensions={python:"py",matlab:"m",mathematica:"wl"};
  // Mathematica JSON lives in a quoted string rather than a multiline literal.
  const literal=language==="mathematica"?JSON.stringify(data):data;
  return {filename:`mellin_labs.${extensions[language]}`,content:templates[language].replace("__DATA__",literal)};
}

const pythonSource=String.raw`#!/usr/bin/env python3
"""Mellin Labs — standalone central curve and two-band calculation.
Run: python mellin_labs.py (NumPy required; Matplotlib optional).
W=I; finite-weight M0 if enabled; 101 hats; zero endpoints; no positivity.
alpha_star solves R=delta for the BASELINE M+S. Exploration does not retune it.
The supplied sampleCov is the sample covariance of the SAME 500 standardized
Gaussian draws used by the website, NOT a measured lattice covariance.
Propagating it exactly reproduces those 500 fixed-alpha sample stds (ddof=1).
The outer width adds a trapezoidal re-inversion diagnostic, NOT full systematics.
Operators are exact exports of the frozen analytic hat kernel.
"""
import json
from pathlib import Path
import numpy as np

DATA = json.loads(r'''__DATA__''')

def reconstruct(d):
    x = np.asarray(d["x"])
    full_k = np.asarray(d["K"])
    include = bool(d["includeM0"])
    k = full_k[0 if include else 1:, 1:-1]
    g = np.r_[1., d["moments"]] if include else np.asarray(d["moments"])
    errors = np.asarray(d["errors"])
    delta = np.linalg.norm(errors)
    if not (np.all(np.isfinite(g)) and np.all(errors > 0) and
            np.all(np.isfinite(errors)) and abs(d["logAlpha"]) <= 4 and
            min(d["mass"], d["slope"]) >= 0 and d["mass"] + d["slope"] > 0):
        raise ValueError("Invalid moments, errors or exploration controls.")
    def operator(p):
        u = np.linalg.solve(p, k.T)
        gram = k @ u
        return u, (gram + gram.T) / 2
    def fit(pair, alpha, values):
        u, gram = pair
        a = gram + alpha * np.eye(len(g))
        mapping = np.linalg.solve(a, u.T).T
        c = mapping @ values
        return c, np.linalg.norm(k @ c - values), mapping
    base = operator(np.asarray(d["P"]))
    lo, hi = np.log(1e-12), np.log(1e4)
    if not fit(base, np.exp(lo), g)[1] < delta < fit(base, np.exp(hi), g)[1]:
        raise ValueError("No discrepancy crossing in [1e-12, 1e4]; no fallback.")
    for _ in range(90):
        mid = (lo + hi) / 2
        alpha_star = np.exp(mid)
        residual = fit(base, alpha_star, g)[1]
        if abs(residual / delta - 1) < 1e-11:
            break
        if residual < delta:
            lo = mid
        else:
            hi = mid
    if abs(residual / delta - 1) > 1e-6:
        raise ValueError("Discrepancy tolerance not met.")
    p = (np.asarray(d["P"]) if d["mass"] == d["slope"] == 1 else
         d["mass"] * np.asarray(d["M"]) + d["slope"] * np.asarray(d["S"]))
    pair = operator(p)
    alpha = alpha_star * 10. ** d["logAlpha"]
    c, residual, mapping = fit(pair, alpha, g)
    stationarity = np.linalg.norm(k.T @ (k @ c-g)+alpha*p@c)/max(np.linalg.norm(k.T@g),1e-30)
    if not np.isfinite(stationarity) or stationarity > 1e-9:
        raise ValueError("Numerical stationarity tolerance not met.")
    central = np.r_[0., c, 0.]
    b = mapping[:, int(include):] * errors
    variance = np.einsum("ij,jk,ik->i", b, np.asarray(d["sampleCov"]), b)
    if np.min(variance) < -1e-15:
        raise ValueError("Invalid propagated variance.")
    sigma = np.r_[0., np.sqrt(np.maximum(variance, 0)), 0.]
    closure_moments = []
    for power in range(len(errors)):
        y = central * x**power
        closure_moments.append(np.sum(np.diff(x)*(y[:-1]+y[1:])/2))
    closure_g = np.r_[1., closure_moments] if include else np.asarray(closure_moments)
    closure = np.r_[0., fit(pair, alpha, closure_g)[0], 0.]
    width = np.abs(central - closure)
    result = np.column_stack((x,central,central-sigma,central+sigma,
                              central-sigma-width,central+sigma+width,sigma,width))
    info = dict(alpha_star=float(alpha_star),alpha=float(alpha),R=float(residual),
                delta=float(delta),ratio=float(residual/delta),
                normalization=float(full_k[0]@central),stationarity=float(stationarity),
                mass=d["mass"],slope=d["slope"],logAlpha=d["logAlpha"],
                includeM0=include,seed=d["seed"],source=d["source"],engine=d["engine"],
                discrepancy_met=bool(abs(residual/delta-1)<=1e-6))
    return result, info

if __name__ == "__main__":
    values, info = reconstruct(DATA)
    # Use a fresh output name if an earlier export is already present.
    stem=Path("mellin_labs_result")
    index=0
    while stem.with_suffix(".dat").exists() or stem.with_suffix(".json").exists() or stem.with_suffix(".pdf").exists():
        index+=1
        stem=Path("mellin_labs_result_"+str(index))
    np.savetxt(stem.with_suffix(".dat"),values,header=json.dumps(info)+"\n"+
               "x xqv inner_lower inner_upper outer_lower outer_upper input_std reinversion_width")
    stem.with_suffix(".json").write_text(json.dumps(info,indent=2)+"\n")
    print(json.dumps(info,indent=2))
    try:
        import matplotlib.pyplot as plt
        x=values[:,0]
        plt.fill_between(x,values[:,4],values[:,5],color="#d89277",alpha=.25,label="Re-inversion envelope")
        plt.fill_between(x,values[:,2],values[:,3],color="#126c83",alpha=.25,label="Propagated input errors")
        plt.plot(x,values[:,1],color="#126c83",label="Tikhonov estimate")
        plt.xlabel("x"); plt.ylabel("x q_v(x)"); plt.legend(frameon=False)
        plt.tight_layout(); plt.savefig(stem.with_suffix(".pdf"))
    except ImportError:
        print("Numerical output saved. Install matplotlib for a plot.")
`;

const matlabSource=String.raw`% Mellin Labs: standalone script, MATLAB R2016b or later.
% Run mellin_labs.m. Built-in functions only. This port is runtime-untested.
% W=I, 101 hats, zero endpoints, soft M0 row, NO positivity or rescaling.
% alpha_star is the BASELINE M+S discrepancy root, not retuned for exploration.
% sampleCov describes the same 500 standardized Gaussian draws as the website;
% it is NOT a measured lattice covariance. Propagation equals their sample std.
% The outer envelope adds re-inversion width, not full systematic uncertainty.
d = jsondecode('__DATA__');
x=d.x(:); fullK=d.K; offset=double(d.includeM0);
K=fullK(2-offset:end,2:end-1);
g=d.moments(:); if d.includeM0, g=[1;g]; end
err=d.errors(:); delta=norm(err);
assert(all(isfinite(g)) && all(isfinite(err)) && all(err>0),'Invalid input.');
assert(abs(d.logAlpha)<=4 && d.mass>=0 && d.slope>=0 && d.mass+d.slope>0,'Invalid controls.');
base=make_operator(d.P,K);
lo=log(1e-12); hi=log(1e4);
[~,rl]=fit_curve(base,K,g,exp(lo)); [~,rh]=fit_curve(base,K,g,exp(hi));
assert(rl<delta && rh>delta,'No discrepancy crossing; no fallback.');
for it=1:90
    mid=(lo+hi)/2; alpha_star=exp(mid);
    [~,r]=fit_curve(base,K,g,alpha_star);
    if abs(r/delta-1)<1e-11, break; end
    if r<delta, lo=mid; else, hi=mid; end
end
assert(abs(r/delta-1)<=1e-6,'Discrepancy tolerance not met.');
if d.mass==1 && d.slope==1, P=d.P; else, P=d.mass*d.M+d.slope*d.S; end
op=make_operator(P,K); alpha=alpha_star*10^d.logAlpha;
[c,R,B]=fit_curve(op,K,g,alpha);
stationarity=norm(K'*(K*c-g)+alpha*P*c)/max(norm(K'*g),1e-30);
assert(isfinite(stationarity) && stationarity<=1e-9,'Stationarity tolerance not met.');
central=[0;c;0];
J=B(:,1+offset:end).*err';
variance=sum((J*d.sampleCov).*J,2);
assert(min(variance)>=-1e-15,'Invalid propagated variance.');
sigma=[0;sqrt(max(0,variance));0];
cg=zeros(length(err),1);
for n=1:length(err), cg(n)=trapz(x,central.*x.^(n-1)); end
if d.includeM0, cg=[1;cg]; end
closure=[0;fit_curve(op,K,cg,alpha);0];
width=abs(central-closure);
values=[x,central,central-sigma,central+sigma,central-sigma-width,central+sigma+width,sigma,width];
info=struct('alpha_star',alpha_star,'alpha',alpha,'R',R,'delta',delta,...
    'ratio',R/delta,'normalization',fullK(1,:)*central,'stationarity',stationarity,...
    'mass',d.mass,'slope',d.slope,'logAlpha',d.logAlpha,'includeM0',d.includeM0,...
    'seed',d.seed,'source',d.source,'engine',d.engine,'discrepancy_met',abs(R/delta-1)<=1e-6);
stem='mellin_labs_result'; j=0;
while exist([stem '.dat'],'file') || exist([stem '.json'],'file')
    j=j+1; stem=['mellin_labs_result_' num2str(j)];
end
fid=fopen([stem '.dat'],'w'); assert(fid>=0,'Cannot open output.');
fprintf(fid,'# %s\n',jsonencode(info));
fprintf(fid,'# x xqv inner_lower inner_upper outer_lower outer_upper input_std reinversion_width\n');
fprintf(fid,'%.17g %.17g %.17g %.17g %.17g %.17g %.17g %.17g\n',values'); fclose(fid);
fid=fopen([stem '.json'],'w'); fprintf(fid,'%s\n',jsonencode(info)); fclose(fid);
disp(info);
figure; hold on
fill([x;flipud(x)],[values(:,5);flipud(values(:,6))],[.85 .57 .47],'FaceAlpha',.25,'EdgeColor','none');
fill([x;flipud(x)],[values(:,3);flipud(values(:,4))],[.07 .42 .51],'FaceAlpha',.25,'EdgeColor','none');
plot(x,central,'Color',[.07 .42 .51],'LineWidth',2);
xlabel('x'); ylabel('x q_v(x)'); legend('Re-inversion envelope','Propagated input errors','Tikhonov estimate');

function op=make_operator(P,K)
    op.U=P\K'; G=K*op.U; op.G=(G+G')/2;
end
function [c,r,B]=fit_curve(op,K,g,alpha)
    A=op.G+alpha*eye(size(op.G)); B=(A\op.U')'; c=B*g; r=norm(K*c-g);
end
`;

const mathematicaSource=String.raw`(* Mellin Labs: Wolfram Language / Mathematica standalone source.
   Run with wolframscript -file mellin_labs.wl, or evaluate in a notebook.
   This port is runtime-untested.
   W=I; 101 hats; zero endpoints; soft M0; no positivity or rescaling.
   alphaStar is the BASELINE M+S discrepancy root; exploration does not retune.
   sampleCov belongs to the same 500 standardized Gaussian replicas as the
   website, not a measured lattice covariance. Propagation gives their std.
   Outer width is a re-inversion diagnostic, not full systematic uncertainty. *)
ClearAll[makeOperator,fitCurve];
d=ImportString[__DATA__,"RawJSON"];
x=N[d["x"]]; fullK=N[d["K"]];
offset=If[TrueQ[d["includeM0"]],1,0];
k=fullK[[2-offset;;,2;;-2]];
g=If[offset==1,Prepend[d["moments"],1.],d["moments"]];
err=d["errors"]; delta=Norm[err];
If[!(And@@Thread[err>0]) || Abs[d["logAlpha"]]>4 ||
   Min[d["mass"],d["slope"]]<0 || d["mass"]+d["slope"]<=0,
   Print["Invalid inputs or controls."]; Abort[]];
makeOperator[p_]:=Module[{u,gram},u=LinearSolve[p,Transpose[k]];
    gram=k.u; {u,(gram+Transpose[gram])/2}];
fitCurve[op_,a_,v_]:=Module[{b,c},
    b=Transpose[LinearSolve[op[[2]]+a IdentityMatrix[Length[g]],Transpose[op[[1]]]]];
    c=b.v; {c,Norm[k.c-v],b}];
base=makeOperator[N[d["P"]]];
lo=Log[1.*10^-12]; hi=Log[1.*10^4];
If[!(fitCurve[base,Exp[lo],g][[2]]<delta<fitCurve[base,Exp[hi],g][[2]]),
   Print["No discrepancy crossing; no fallback."]; Abort[]];
Do[mid=(lo+hi)/2; alphaStar=Exp[mid]; r=fitCurve[base,alphaStar,g][[2]];
   If[Abs[r/delta-1]<10^-11,Break[]];
   If[r<delta,lo=mid,hi=mid],{90}];
If[Abs[r/delta-1]>10^-6,Print["Discrepancy tolerance not met."];Abort[]];
p=If[d["mass"]==1 && d["slope"]==1,N[d["P"]],d["mass"] N[d["M"]]+d["slope"] N[d["S"]]];
op=makeOperator[p]; alpha=alphaStar 10.^d["logAlpha"];
{c,residual,b}=fitCurve[op,alpha,g];
stationarity=Norm[Transpose[k].(k.c-g)+alpha p.c]/Max[Norm[Transpose[k].g],10^-30];
If[!TrueQ[stationarity<=10^-9],Print["Stationarity tolerance not met."];Abort[]];
central=Join[{0.},c,{0.}];
j=Map[# err&,b[[All,1+offset;;]]];
variance=Map[#.N[d["sampleCov"]].#&,j];
If[Min[variance]<-10^-15,Print["Invalid propagated variance."];Abort[]];
sigma=Join[{0.},Sqrt[Map[Max[0.,#]&,variance]],{0.}];
cg=Table[With[{y=central x^power},Total[Differences[x](Most[y]+Rest[y])/2]],{power,0,Length[err]-1}];
If[offset==1,cg=Prepend[cg,1.]];
closure=Join[{0.},fitCurve[op,alpha,cg][[1]],{0.}];
width=Abs[central-closure];
values=Transpose[{x,central,central-sigma,central+sigma,central-sigma-width,central+sigma+width,sigma,width}];
info=<|"alpha_star"->alphaStar,"alpha"->alpha,"R"->residual,"delta"->delta,
   "ratio"->residual/delta,"normalization"->fullK[[1]].central,"stationarity"->stationarity,
   "mass"->d["mass"],"slope"->d["slope"],"logAlpha"->d["logAlpha"],
   "includeM0"->d["includeM0"],"seed"->d["seed"],"source"->d["source"],"engine"->d["engine"],
   "discrepancy_met"->(Abs[residual/delta-1]<=10^-6)|>;
stem="mellin_labs_result"; index=0;
While[Or@@(FileExistsQ[stem<>#]&/@{".dat",".json",".pdf"}),index++;stem="mellin_labs_result_"<>ToString[index]];
out=OpenWrite[stem<>".dat"];
WriteString[out,"# "<>ExportString[info,"RawJSON"]<>"\n# x xqv inner_lower inner_upper outer_lower outer_upper input_std reinversion_width\n"];
WriteString[out,ExportString[values,"Table"]];Close[out];
Export[stem<>".json",info,"RawJSON"];
plot=ListLinePlot[Map[Transpose[{x,#}]&,{central,central-sigma,central+sigma,central-sigma-width,central+sigma+width}],
   PlotRange->All,Frame->True,FrameLabel->{"x","x q_v(x)"},PlotStyle->{Blue,LightBlue,LightBlue,Orange,Orange},
   Filling->{2->{3},4->{5}},PlotLegends->{"Tikhonov estimate","Input lower","Input upper","Outer lower","Outer upper"}];
Export[stem<>".pdf",plot];Print[info];plot
`;
