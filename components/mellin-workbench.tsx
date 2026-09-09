"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleHelp, FileJson, Link2, LockKeyhole, Pin, RotateCcw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ChartContainer } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { reconstruct, metadata } from "@/lib/inversion";
import { isUnchangedPreset, numericalInput, presetSession, readSession, type LabSession } from "@/lib/session";
import presets from "@/lib/presets.json";

const format = (n: number, digits=5) => !Number.isFinite(n) ? "—" :
  n===0 ? "0" : Math.abs(n)<.0001 || Math.abs(n)>=10000 ? n.toExponential(3) : Number(n.toPrecision(digits)).toString();
function download(content: string, mime: string, filename: string) {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type PlotPoint = {x:number;f:number;inner:number[];outer:number[];paper:number|null;pinned:number|null};
function HoverCard({active,payload}: {active?:boolean;payload?:ReadonlyArray<{payload?:PlotPoint}>}) {
  const d=payload?.[0]?.payload;
  if(!active||!d)return null;
  return <div className="hover-card"><span>x = {d.x.toFixed(2)}</span><strong>xqᵥ = {format(d.f,6)}</strong><small>Input-error band: {format(d.inner[0])} to {format(d.inner[1])}</small><small>Outer envelope: {format(d.outer[0])} to {format(d.outer[1])}</small></div>;
}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return <label className="toggle-label"><Switch size="sm" checked={checked} onCheckedChange={onChange} aria-label={label}/><span>{label}</span></label>;
}

export default function MellinWorkbench(){
  const [session,setSession]=useState<LabSession>(()=>presetSession(0));
  const [inner,setInner]=useState(true),[outer,setOuter]=useState(true),[paper,setPaper]=useState(true);
  const [pinned,setPinned]=useState<{curve:number[];label:string}|null>(null);
  const [message,setMessage]=useState("");
  const [expanded,setExpanded]=useState(false);
  const [shareFallback,setShareFallback]=useState("");
  const chartRef=useRef<HTMLDivElement>(null);
  const deferred=useDeferredValue(session);
  const stale=deferred!==session;
  const preset=session.preset===null?null:presets[session.preset];
  const color=preset?.color??"#126c83";
  const pristine=isUnchangedPreset(deferred);
  const calculation=useMemo(()=>{
    try{return {result:reconstruct(numericalInput(deferred)),error:""};}
    catch(e){return {result:null,error:e instanceof Error?e.message:"Unable to reconstruct these inputs."};}
  },[deferred]);
  const result=calculation.result;
  useEffect(()=>{
    const load=()=>{
      if(!window.location.hash.startsWith("#inputs="))return;
      try{
        const text=decodeURIComponent(window.location.hash.slice(8));
        setSession(readSession(text));setPinned(null);setMessage("Shared moment settings loaded.");
      }catch(e){setMessage(e instanceof Error?e.message:"The shared settings could not be loaded.");}
    };
    load();window.addEventListener("hashchange",load);
    return ()=>window.removeEventListener("hashchange",load);
  },[]);
  useEffect(()=>{
    if(!message)return;
    const timer=setTimeout(()=>setMessage(""),6000);return ()=>clearTimeout(timer);
  },[message]);
  function updateRow(index:number,key:"value"|"error",value:string){
    setSession(s=>({...s,rows:s.rows.map((r,i)=>i===index?{...r,[key]:value,shift:0}:r)}));
  }
  function selectPreset(index:number){
    setSession(presetSession(index));setPinned(null);setShareFallback("");
  }
  function custom(){
    setSession({version:1,preset:null,name:"Custom PDF",includeM0:true,range:3,seed:0,
      rows:Array.from({length:3},()=>({value:"",error:"",shift:0}))});
    setPinned(null);
  }
  async function share(){
    try{
      numericalInput(session);
      const url=new URL(window.location.href);url.hash="inputs="+encodeURIComponent(JSON.stringify(session));
      try{await navigator.clipboard.writeText(url.toString());setMessage("Link copied, including these moment settings. Site access still applies.");}
      catch{setShareFallback(url.toString());}
    }catch{setMessage("Complete the moment inputs before sharing.");}
  }
  function csv(){
    if(!result)return;
    const g=numericalInput(deferred);
    const header=["# Mellin Lab / browser-port-v1",`# status=${pristine?"Python-verified Reference 1 preset":"exploratory input; not a certified lattice reconstruction"}`,
      `# base_method=${metadata.method}; W=I; include_M0=${g.includeM0}; exact_normalization=false; positivity=false`,
      `# M1..Mn=${g.moments.join(";")}`,`# input_errors=${g.errors.join(";")}`,
      `# alpha=${result.alpha}; R=${result.R}; delta=${result.delta}; R_over_delta=${result.ratio}`,
      `# M0_reconstructed=${result.normalization}; replicas=500; fixed_alpha=true; seed=${g.seed}`,
      "# outer_width=sample_std+abs(central-closure); not a full systematic uncertainty",
      "x,xqv,inner_lower,inner_upper,outer_lower,outer_upper,input_error_std,reinversion_width"];
    const rows=result.x.map((x,i)=>[x,result.central[i],result.innerLower[i],result.innerUpper[i],
      result.outerLower[i],result.outerUpper[i],result.sigma[i],result.closureWidth[i]].join(","));
    download([...header,...rows].join("\n"),"text/csv","mellin-lab-reconstruction.csv");
  }
  function json(){
    if(!result)return;
    download(JSON.stringify({
      application:"Mellin Lab",engine:"browser-port-v1",session:deferred,input:numericalInput(deferred),
      status:pristine?"Python-verified Reference 1 preset":"exploratory; not source-certified",
      method:{...metadata,weighting:"identity",normalization:"finite-weight M0 row, if enabled",
        penalty:"integral(f²+f'²) dx",endpoints:[0,0],positivity:false,
        alphaRule:"R=delta; no fallback",uncertainty:"500 fixed-alpha Gaussian replicas; central-centered",
        outerWidth:"sample_std+abs(central-closure)",limitations:"Finite-moment inverse is not unique; outer band is not a full systematic uncertainty."},
      result,
    },null,2),"application/json","mellin-lab-calculation.json");
  }
  function svg(){
    const original=chartRef.current?.querySelector("svg.recharts-surface");
    if(!original||!result)return;
    const clone=original.cloneNode(true) as SVGSVGElement;
    const width=original.getBoundingClientRect().width,height=original.getBoundingClientRect().height;
    clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
    clone.setAttribute("width",String(width));clone.setAttribute("height",String(height));
    clone.setAttribute("style","background:white;font-family:Arial,Helvetica,sans-serif;font-size:12px;");
    clone.querySelectorAll("text").forEach(t=>{if(!t.getAttribute("fill"))t.setAttribute("fill","#63777e");});
    const desc=document.createElementNS("http://www.w3.org/2000/svg","desc");
    desc.textContent=`Mellin Lab: ${deferred.name}. W=I, alpha=${result.alpha}, R/delta=${result.ratio}. ${metadata.method}. Bands are propagated input errors and an additional re-inversion width.`;
    clone.insertBefore(desc,clone.firstChild);
    download(new XMLSerializer().serializeToString(clone),"image/svg+xml","mellin-lab-plot.svg");
  }
  const points:PlotPoint[]=useMemo(()=>result?result.x.map((x,i)=>({
    x:i===0?0:x,f:result.central[i],inner:[result.innerLower[i],result.innerUpper[i]],
    outer:[result.outerLower[i],result.outerUpper[i]],paper:preset?.referenceCurve[i]??null,
    pinned:pinned?.curve[i]??null,
  })):[],[result,preset,pinned]);
  const yDomain=useMemo(()=>{
    const values=[0,...points.flatMap(p=>[p.f,...(inner?p.inner:[]),...(outer?p.outer:[]),
      ...(paper&&p.paper!==null?[p.paper]:[]),...(p.pinned!==null?[p.pinned]:[])])];
    const min=Math.min(...values),max=Math.max(...values),span=Math.max(max-min,.05);
    return [min-.055*span,max+.13*span] as [number,number];
  },[points,inner,outer,paper]);
  const inputRows=result?numericalInput(deferred):null;
  return (
    <div className="lab" style={{"--curve-color":color} as React.CSSProperties}>
      <header className="masthead">
        <div className="brand"><span className="brand-mark" aria-hidden="true">∫</span><div><strong>Mellin Lab</strong><span>From moments to distributions</span></div></div>
        <div className="header-actions"><span className="quiet-label">AN INTERACTIVE INVERSE PROBLEM</span><Button variant="outline" onClick={()=>{setExpanded(true);requestAnimationFrame(()=>document.getElementById("method-panel")?.scrollIntoView({behavior:"smooth",block:"start"}));}}><CircleHelp/>Method</Button><Button onClick={share}><Link2/>Share inputs</Button></div>
      </header>
      <main className="workspace">
        <aside className="control-panel" aria-label="Moment inputs">
          <div className="eyebrow">01 / INPUT</div>
          <h1>A handful of moments.<br/>A whole distribution.</h1>
          <p className="muted">Change a moment. Watch the reconstruction respond.</p>
          <div className="preset-label">START FROM A LATTICE EXAMPLE</div>
          <div className="preset-list">{presets.map((p,i)=><Button size="sm" key={p.id} variant={session.preset===i?"default":"outline"} onClick={()=>selectPreset(i)}>{p.name}</Button>)}
            <Button size="sm" variant={session.preset===null?"default":"outline"} onClick={custom}>Your inputs</Button></div>
          {session.preset===null&&<label className="field-label" htmlFor="distribution-name">Distribution label<Input id="distribution-name" aria-label="Distribution label" maxLength={80} value={session.name} onChange={e=>setSession(s=>({...s,name:e.target.value}))}/></label>}
          <div className="input-setup">
            <label className="field-label">Number of moments<select value={session.rows.length} onChange={e=>{
              const n=Number(e.target.value);setSession(s=>({...s,rows:Array.from({length:n},(_,i)=>s.rows[i]??{value:"",error:"",shift:0})}));
            }} aria-label="Number of measured moments">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
            <label className="field-label">Slider span<select value={session.range} onChange={e=>{
              const range=Number(e.target.value);setSession(s=>({...s,range,rows:s.rows.map(r=>({...r,shift:Math.max(-range,Math.min(range,r.shift))}))}));
            }} aria-label="Moment slider range">{[1,2,3,5].map(n=><option key={n} value={n}>±{n} errors</option>)}</select></label>
          </div>
          <div className="normalization-setting"><Toggle label="Include M₀ = 1" checked={session.includeM0} onChange={v=>setSession(s=>({...s,includeM0:v}))}/>
            <p>{session.includeM0?"An input row with unit weight, not an exact normalization constraint.":"Exploratory mode: the normalization row is omitted from the residual."}</p></div>
          <div className="moments-heading"><h2>Mellin moments</h2><Button variant="ghost" size="icon-sm" title="Reset all sliders to the entered central values" aria-label="Reset all moment sliders" onClick={()=>setSession(s=>({...s,rows:s.rows.map(r=>({...r,shift:0}))}))}><RotateCcw/></Button></div>
          <div className="moment-columns"><span>Moment</span><span>Central value</span><span>Error</span></div>
          <div className="moments-list">{session.rows.map((r,i)=>{
            const base=Number(r.value),error=Number(r.error),valid=r.value.trim()!==""&&r.error.trim()!==""&&Number.isFinite(base)&&Number.isFinite(error)&&error>0;
            return <div className={`moment-control ${r.shift!==0?"is-shifted":""}`} key={i}>
              <div className="moment-fields"><label className="moment-symbol" htmlFor={`m-${i}`}>M<sub>{i+1}</sub></label>
                <Input id={`m-${i}`} type="number" step="any" value={r.value} placeholder="value" aria-label={`M${i+1} central value`} onChange={e=>updateRow(i,"value",e.target.value)}/>
                <Input type="number" step="any" min="0" value={r.error} placeholder="error" aria-label={`M${i+1} error`} onChange={e=>updateRow(i,"error",e.target.value)}/></div>
              <div className="moment-slider"><span className="midpoint-mark" aria-hidden="true"/>
                <Slider min={-session.range} max={session.range} step={.01} value={[r.shift]} disabled={!valid}
                  aria-label={`Vary M${i+1} about its entered value`} onValueChange={v=>{
                    const shift=Array.isArray(v)?v[0]:v;setSession(s=>({...s,rows:s.rows.map((row,j)=>j===i?{...row,shift}:row)}));
                  }}/></div>
              <div className="slider-caption"><span>{valid?format(base-session.range*error,3):"−"}</span>
                <span className="current-moment">{valid?format(base+r.shift*error,6):"enter values"}{r.shift!==0&&<em> ({r.shift>0?"+":""}{r.shift.toFixed(2)}σ)</em>}</span>
                <span>{valid?format(base+session.range*error,3):"+"}</span></div>
            </div>;
          })}</div>
          <p className="slider-help">The center tick is your entered value. A shift of +1σ adds one quoted error. Editing a value or error recenters that slider.</p>
          <Button variant="outline" className="reset-button" onClick={()=>session.preset===null?custom():selectPreset(session.preset)}><RotateCcw/>Reset {preset?"example":"inputs"}</Button>
          <div className="privacy-note"><LockKeyhole size={13}/><span>Calculation runs in your browser. Inputs enter a share link only when you choose to share.</span></div>
        </aside>

        <div className="results-column">
          <section className="results-panel" aria-label="Reconstructed distribution">
            <div className="plot-top"><div><div className="eyebrow">02 / RECONSTRUCTION</div><h2>{session.name||"Custom PDF"}</h2><p className="plot-subtitle">f(x) = xqᵥ(x) <span>·</span> {session.rows.length} measured moments {session.includeM0?"+ M₀":""}</p></div>
              <span className={`status-pill ${!pristine?"exploratory":""}`}><span className="status-dot"/>{pristine?"Python-verified preset":"Exploratory inputs"}</span></div>
            <div className="plot-toolbar"><div className="toggles"><Toggle label="Input-error band" checked={inner} onChange={setInner}/><Toggle label="Outer envelope" checked={outer} onChange={setOuter}/>{preset&&<Toggle label="Paper ansatz" checked={paper} onChange={setPaper}/>}</div>
              <Button variant="ghost" size="sm" disabled={!result||stale} onClick={()=>pinned?setPinned(null):setPinned({curve:result!.central,label:session.name})}>{pinned?<X/>:<Pin/>}{pinned?"Unpin":"Pin curve"}</Button></div>
            <div className={`chart-stage ${stale?"updating":""}`} ref={chartRef} aria-busy={stale}>
              {result?<ChartContainer config={{f:{label:"Reconstructed xqᵥ",color},paper:{label:"Paper beta ansatz",color:"#bb7765"}}} className="main-chart" initialDimension={{width:800,height:470}}>
                <ComposedChart accessibilityLayer data={points} margin={{top:25,right:25,bottom:25,left:8}}>
                  <CartesianGrid vertical={false} stroke="#e5ecec"/>
                  <XAxis dataKey="x" type="number" domain={[0,1]} ticks={[0,.2,.4,.6,.8,1]} tickLine={false} axisLine={{stroke:"#bccbce"}} tick={{fill:"#63777e",fontSize:12}} label={{value:"x",position:"insideBottom",offset:-16,fill:"#425c66",fontSize:15}}/>
                  <YAxis domain={yDomain} width={54} tickFormatter={v=>format(Number(v),3)} tickLine={false} axisLine={false} tick={{fill:"#63777e",fontSize:12}} label={{value:"xqᵥ(x)",angle:-90,position:"insideLeft",fill:"#425c66",fontSize:14}}/>
                  <ReferenceLine y={0} stroke="#bccbce"/>
                  {outer&&<Area type="linear" dataKey="outer" stroke="none" fill="#d89277" fillOpacity={.22} isAnimationActive={false} tooltipType="none"/>}
                  {inner&&<Area type="linear" dataKey="inner" stroke="none" fill={color} fillOpacity={.18} isAnimationActive={false} tooltipType="none"/>}
                  {paper&&preset&&<Line type="linear" dataKey="paper" stroke="#bb7765" strokeDasharray="6 5" strokeWidth={1.7} dot={false} isAnimationActive={false} tooltipType="none"/>}
                  {pinned&&<Line type="linear" dataKey="pinned" stroke="#8399a1" strokeDasharray="2 4" strokeWidth={1.8} dot={false} isAnimationActive={false} tooltipType="none"/>}
                  <Line type="linear" dataKey="f" name="Reconstruction" stroke={color} strokeWidth={3} dot={false} activeDot={{r:5,stroke:"#fff",strokeWidth:2}} isAnimationActive={false}/>
                  <Tooltip content={<HoverCard/>} cursor={{stroke:"#adc1c7",strokeDasharray:"3 4"}}/>
                </ComposedChart>
              </ChartContainer>:<output className="calculation-error"><SlidersHorizontal size={30}/><h3>{session.rows.some(r=>r.value===""||r.error==="")?"Your moments go here":"No verified reconstruction"}</h3><p>{calculation.error}</p><small>The method is unchanged. Adjust the inputs or reset an example.</small></output>}
            </div>
            {result&&<>
              <div className="plot-legend"><span><i style={{background:color}}/>Tikhonov estimate</span>{inner&&<span><i className="band-key" style={{background:color,opacity:.3}}/>Propagated input errors (1σ)</span>}{outer&&<span><i className="band-key outer-key"/>Additional re-inversion width</span>}{paper&&preset&&<span><i className="dashed-key"/>Paper beta ansatz</span>}{pinned&&<span><i className="pinned-key"/>Pinned: {pinned.label}</span>}</div>
              <div className="metric-strip"><div><span>Selected α <small>AUTOMATIC</small></span><strong title={String(result.alpha)}>{format(result.alpha,5)}</strong></div>
                <div><span>Discrepancy R / δ</span><strong className="ratio-value">{result.ratio.toFixed(6)}<Check size={15}/></strong></div>
                <div><span>Reconstructed M₀</span><strong title={String(result.normalization)}>{result.normalization.toFixed(4)}</strong></div></div>
              <div className="fit-status"><span><Check size={14}/>Discrepancy condition met</span><span>R = {format(result.R)} <b>·</b> δ = {format(result.delta)}</span></div>
              {Math.min(...result.central)<-1e-7&&<p className="warning-note">The estimate includes negative values. They are shown unchanged: positivity is not imposed.</p>}
            </>}
            <div className="plot-footer"><p>One regularized estimate, not a uniquely determined PDF.<br/><span>All curves use 101 linear-hat nodes and W = I.</span></p>
              <div className="export-buttons"><Button variant="outline" size="sm" disabled={!result||stale} onClick={svg}><ArrowDownToLine/>Plot</Button><Button variant="outline" size="sm" disabled={!result||stale} onClick={csv}><ArrowDownToLine/>CSV</Button><Button variant="outline" size="sm" disabled={!result||stale} onClick={json}><FileJson/>Record</Button></div></div>
          </section>

          <section className="explanation-strip"><div className="explanation-icon"><Sparkles size={20}/></div><div><h3>Explore the information in your moments</h3><p>Move one slider and watch α adapt automatically. Pin a curve to compare it with your next choice. The bands propagate the entered errors at fixed selected α; the outer envelope adds a re-inversion diagnostic, not a complete systematic uncertainty.</p></div></section>

          <section className="method-panel" id="method-panel">
            <button className="method-toggle" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-controls="method-details"><div><span className="eyebrow">UNDER THE HOOD</span><h3>The method, without hidden switches</h3></div><ChevronDown size={20} style={{transform:expanded?"rotate(180deg)":undefined}}/></button>
            {expanded&&<div className="method-details" id="method-details">
              <div className="equation-block"><span>INPUT MOMENTS</span><p>M<sub>n</sub> = ∫<sub>0</sub><sup>1</sup> x<sup>n−1</sup> f(x) dx, &nbsp; f(x) = xqᵥ(x)</p></div>
              <div className="equation-block"><span>RECONSTRUCTION</span><p>ĉ<sub>α</sub> = arg min<sub>c</sub> {"{ "}‖Kc − g‖² + α cᵀSc{" }"}</p><small>cᵀSc = ∫<sub>0</sub><sup>1</sup> [f(x)² + f′(x)²] dx</small></div>
              <div className="equation-block"><span>AUTOMATIC REGULARIZATION</span><p>R(α) = ‖Kĉ<sub>α</sub> − g‖ = δ, &nbsp; δ = √(Σ σ<sub>n</sub>²)</p><small>Relative discrepancy tolerance: 10⁻⁶. No crossing means no substitute result.</small></div>
              <div className="method-copy">
                <p><strong>What stays fixed.</strong> Linear hat functions on 101 nodes; f(0) = f(1) = 0; an H¹ penalty; equal residual weights; no positivity constraint. The computational left endpoint is 10⁻²⁰. The plotted segments are linear, not a fitted plotting spline.</p>
                <p><strong>What M₀ means.</strong> When enabled, g begins with M₀ = 1 and that row has unit weight. Its input error is zero, but the reconstructed integral is not forced to equal one. Disabling it is an explicitly exploratory extension.</p>
                <p><strong>The two bands.</strong> The inner half-width is the sample standard deviation from 500 independent Gaussian moment replicas, at fixed central α. The browser propagates their sample covariance through the linear inverse, reproducing the same finite-sample bands without 500 separate solves. For the outer band we recompute the measured moments from the central curve using trapezoidal integration, restore the M₀ input if enabled, reinvert at the same α, and add the absolute curve difference linearly. Neither band guarantees coverage of the true PDF.</p>
                <p><strong>Which inputs belong together?</strong> Enter consecutive moments of the same distribution, in the same flavor convention, scale and renormalization scheme. Do not combine ratios, quark/antiquark sectors, or moments at different scales as though they were this vector. Off-diagonal input correlations are not supplied here.</p>
                <p><strong>Preset scope.</strong> The three unedited Reference 1 presets reproduce the approved <code>Mellin_Tikhonov_v1</code> Python results. Their errors combine the three quoted components in quadrature, so the inner band is not purely statistical. Changing the inputs explores the same equations but does not certify a new lattice extraction. Above six moments the browser is an exploratory tool, not a newly approved analysis.</p>
              </div>
              {result&&inputRows&&<div className="moments-table-wrap"><h3>Input moments and reconstructed moments</h3><table><thead><tr><th>Moment</th><th>Input</th><th>Error</th><th>Reconstructed</th><th>Difference</th></tr></thead><tbody>{result.moments.map((v,i)=>{
                const n=i+(deferred.includeM0?0:1),g=n===0?1:inputRows.moments[n-1],error=n===0?0:inputRows.errors[n-1];
                return <tr key={n}><td>M<sub>{n}</sub></td><td>{format(g,7)}</td><td>{format(error,5)}</td><td>{format(v,7)}</td><td>{format(v-g,4)}</td></tr>;
              })}</tbody></table></div>}
            </div>}
          </section>
          <footer className="source-footer"><a href={metadata.sourceURL} target="_blank" rel="noreferrer">Miller et al. · Mellin Moments of Pion and Kaon Unpolarized PDFs from Nonlocal Operators in Lattice QCD <ArrowUpRight size={13}/></a><p>Tables 5–6 · MS̄, μ = 2 GeV · Connected-only valence approximation · The paper ansatz is a same-source comparison, not independent validation.</p></footer>
        </div>
      </main>
      {message&&<output className="toast-message">{message}<button aria-label="Dismiss notification" onClick={()=>setMessage("")}><X size={15}/></button></output>}
      <Dialog open={Boolean(shareFallback)} onOpenChange={v=>{if(!v)setShareFallback("");}}><DialogContent><DialogTitle>Copy this link</DialogTitle><DialogDescription>It includes your inputs. The site’s viewing permissions still apply.</DialogDescription><Input readOnly value={shareFallback} aria-label="Shared settings link" onFocus={e=>e.target.select()}/><Button onClick={()=>setShareFallback("")}>Done</Button></DialogContent></Dialog>
    </div>
  );
}
