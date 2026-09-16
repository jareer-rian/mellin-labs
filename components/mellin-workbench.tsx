"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleHelp, FileJson, Link2, LockKeyhole, Pin, RotateCcw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ChartContainer } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { reconstruct, metadata } from "@/lib/inversion";
import { initialTuning, isUnchangedPreset, numericalInput, presetSession, readSession, type LabSession } from "@/lib/session";
import RegularizationPanel, { MathText, RegularizationEquation, ObjectiveReadout } from "@/components/regularization-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { sourceFile } from "@/lib/source-downloads";
import presets from "@/lib/presets.json";

const format = (n: number, digits=5) => !Number.isFinite(n) ? "—" :
  n===0 ? "0" : Math.abs(n)<.0001 || Math.abs(n)>=10000 ? n.toExponential(3) : Number(n.toPrecision(digits)).toString();
function Bilingual({en,zh,className=""}:{en:ReactNode;zh:ReactNode;className?:string}) {
  return <span className={`bilingual ${className}`}><span>{en}</span><small lang="zh-CN">{zh}</small></span>;
}
function download(content: string, mime: string, filename: string) {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type PlotPoint = {x:number;f:number;inner:number[];outer:number[];paper:number|null;pinned:number|null};
function HoverCard({active,payload}: {active?:boolean;payload?:ReadonlyArray<{payload?:PlotPoint}>}) {
  const d=payload?.[0]?.payload;
  if(!active||!d)return null;
  return <div className="hover-card"><span><MathText tex={String.raw`\mathit{x}`} /> = {d.x.toFixed(2)}</span><strong><MathText tex={String.raw`\mathit{x}\,q_v(\mathit{x})`} /> = {format(d.f,6)}</strong><small>Input-error band / 输入误差带: {format(d.inner[0])} to {format(d.inner[1])}</small><small>Outer envelope / 外层包络: {format(d.outer[0])} to {format(d.outer[1])}</small></div>;
}
function Toggle({label,zh,checked,onChange}:{label:string;zh?:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return <label className="toggle-label"><Switch size="sm" checked={checked} onCheckedChange={onChange} aria-label={zh?`${label} / ${zh}`:label}/><span>{zh?<Bilingual en={label} zh={zh}/>:label}</span></label>;
}

export default function MellinWorkbench(){
  const [session,setSession]=useState<LabSession>(()=>presetSession(0));
  const [controlTab,setControlTab]=useState("tuning");
  const [inner,setInner]=useState(true),[outer,setOuter]=useState(true),[paper,setPaper]=useState(true);
  const [pinned,setPinned]=useState<{curve:number[];label:string}|null>(null);
  const [message,setMessage]=useState("");
  const [expanded,setExpanded]=useState(false);
  const [shareFallback,setShareFallback]=useState("");
  const [guideStep,setGuideStep]=useState<"choose-count"|"await-count"|"enter-moments"|"await-inputs"|"inspect"|null>(null);
  const chartRef=useRef<HTMLDivElement>(null);
  const deferred=useDeferredValue(session);
  const stale=deferred!==session;
  const preset=deferred.preset===null?null:presets[deferred.preset];
  const color=preset?.color??"#126c83";
  const pristine=isUnchangedPreset(deferred);
  const calculation=useMemo(()=>{
    try{return {result:reconstruct(numericalInput(deferred),deferred.tuning??initialTuning()),error:""};}
    catch(e){return {result:null,error:e instanceof Error?e.message:"Unable to reconstruct these inputs."};}
  },[deferred]);
  const result=calculation.result;
  const customInputsReady=session.preset===null&&session.rows.every(r=>{
    const value=Number(r.value),error=Number(r.error);
    return r.value.trim()!==""&&r.error.trim()!==""&&Number.isFinite(value)&&Number.isFinite(error)&&error>0;
  });
  useEffect(()=>{
    const load=()=>{
      if(!window.location.hash.startsWith("#inputs="))return;
      try{
        const text=decodeURIComponent(window.location.hash.slice(8));
        setSession(readSession(text));setPinned(null);setMessage("Shared moment settings loaded. / 已加载分享的矩设置。");
      }catch(e){setMessage(e instanceof Error?e.message:"The shared settings could not be loaded. / 无法加载分享的设置。");}
    };
    load();window.addEventListener("hashchange",load);
    return ()=>window.removeEventListener("hashchange",load);
  },[]);
  useEffect(()=>{
    if(!message)return;
    const timer=setTimeout(()=>setMessage(""),6000);return ()=>clearTimeout(timer);
  },[message]);
  useEffect(()=>{
    if(guideStep==="await-inputs"&&customInputsReady)setGuideStep("inspect");
  },[guideStep,customInputsReady]);
  function focusGuideTarget(selector:string){
    window.setTimeout(()=>{
      const target=document.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({behavior:"smooth",block:"center"});
      target?.focus();
    },80);
  }
  function goToMomentCount(){
    setGuideStep("await-count");
    focusGuideTarget("#moment-count");
  }
  function beginMomentEntry(){
    setGuideStep("await-inputs");
    focusGuideTarget("#m-0");
  }
  function finishGuide(){
    setGuideStep(null);
    window.setTimeout(()=>document.querySelector<HTMLElement>(".results-panel")?.scrollIntoView({behavior:"smooth",block:"start"}),80);
  }
  function updateRow(index:number,key:"value"|"error",value:string){
    setSession(s=>({...s,tuning:initialTuning(),rows:s.rows.map((r,i)=>i===index?{...r,[key]:value,shift:0}:r)}));
  }
  function selectPreset(index:number){
    setSession(presetSession(index));setPinned(null);setShareFallback("");setGuideStep(null);
  }
  function custom(){
    setControlTab("moments");
    setSession({version:1,preset:null,name:"Custom PDF",includeM0:true,range:3,seed:0,
      rows:Array.from({length:3},()=>({value:"",error:"",shift:0}))});
    setPinned(null);setGuideStep("choose-count");
  }
  async function share(){
    try{
      numericalInput(session);
      const url=new URL(window.location.href);url.hash="inputs="+encodeURIComponent(JSON.stringify(session));
      try{await navigator.clipboard.writeText(url.toString());setMessage("Link copied, including these moment settings. Site access still applies. / 链接已复制，其中包含这些矩设置；网站的访问权限仍然适用。");}
      catch{setShareFallback(url.toString());}
    }catch{setMessage("Complete the moment inputs before sharing. / 请先填写完整的矩输入，再进行分享。");}
  }
  function csv(dat=false){
    if(!result)return;
    const g=numericalInput(deferred);
    const header=["# Mellin Labs / exploration-v2",`# status=${pristine?"Python-verified Reference 1 preset":"exploratory; not a certified lattice reconstruction"}`,
      `# base_method=${metadata.method}; W=I; include_M0=${g.includeM0}; exact_normalization=false; positivity=false`,
      `# M1..Mn=${g.moments.join(";")}`,`# input_errors=${g.errors.join(";")}`,
      `# alpha=${result.alpha}; R=${result.R}; delta=${result.delta}; R_over_delta=${result.ratio}`,
      `# baseline_alpha_star=${result.alphaStar}; mass_coefficient=${result.exploration.mass}; stiffness_coefficient=${result.exploration.slope}; log10_alpha_multiplier=${result.exploration.logAlpha}`,
      `# discrepancy_met=${result.discrepancyMet}; source=${metadata.sourceURL}`,
      `# M0_reconstructed=${result.normalization}; replicas=500; fixed_alpha=true; seed=${g.seed}`,
      "# outer_width=sample_std+abs(central-closure); not a full systematic uncertainty",
      `${dat?"# ":""}${["x","xqv","inner_lower","inner_upper","outer_lower","outer_upper","input_error_std","reinversion_width"].join(dat?"\t":",")}`];
    const rows=result.x.map((x,i)=>[x,result.central[i],result.innerLower[i],result.innerUpper[i],
      result.outerLower[i],result.outerUpper[i],result.sigma[i],result.closureWidth[i]].join(dat?"\t":","));
    download([...header,...rows].join("\n"),dat?"text/plain":"text/csv",`mellin-labs-reconstruction.${dat?"dat":"csv"}`);
  }
  function json(){
    if(!result)return;
    download(JSON.stringify({
      application:"Mellin Labs",engine:"Mellin_Lab_exploration_v2",session:deferred,input:numericalInput(deferred),
      status:pristine?"Python-verified Reference 1 preset":"exploratory; not source-certified",
      method:{...metadata,weighting:"identity",normalization:"finite-weight M0 row, if enabled",
        penalty:"beta_M integral(f²) dx + beta_S integral(f'²) dx",coefficients:result.exploration,endpoints:[0,0],positivity:false,
        alphaRule:"alpha_star: R=delta for M+S; displayed alpha=alpha_star*10^logAlpha; no fallback",uncertainty:"500 fixed-alpha Gaussian replicas; central-centered",
        outerWidth:"sample_std+abs(central-closure)",limitations:"Finite-moment inverse is not unique; outer band is not a full systematic uncertainty."},
      result,
    },null,2),"application/json","mellin-labs-calculation.json");
  }
  function code(language:"python"|"matlab"|"mathematica"){
    if(!result)return;
    const file=sourceFile(language,numericalInput(deferred),result.exploration);
    download(file.content,"text/plain",file.filename);
    setMessage("Source downloaded with the current inputs, controls and numerical operators embedded. / 源文件已下载，其中嵌入了当前输入、控制参数和数值算子。");
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
    desc.textContent=`Mellin Labs: ${deferred.name}. W=I, alpha=${result.alpha}, baseline alpha_star=${result.alphaStar}, mass=${result.exploration.mass}, stiffness=${result.exploration.slope}, R/delta=${result.ratio}. ${pristine?metadata.method:"Mellin_Lab_exploration_v2"}. Bands are propagated input errors and an additional re-inversion width.`;
    clone.insertBefore(desc,clone.firstChild);
    download(new XMLSerializer().serializeToString(clone),"image/svg+xml","mellin-labs-plot.svg");
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
        <div className="brand"><span className="brand-mark" aria-hidden="true">∫</span><div><strong>Mellin Labs</strong><span><Bilingual en="From moments to distributions" zh="从矩到分布"/></span></div></div>
        <div className="header-actions"><span className="quiet-label"><Bilingual en="AN INTERACTIVE INVERSE PROBLEM" zh="交互式逆问题"/></span><Button variant="outline" onClick={()=>{setExpanded(true);requestAnimationFrame(()=>document.getElementById("method-panel")?.scrollIntoView({behavior:"smooth",block:"start"}));}}><CircleHelp/><Bilingual en="Method" zh="方法说明"/></Button><Button onClick={share}><Link2/><Bilingual en="Share inputs" zh="分享输入"/></Button></div>
      </header>
      <main className="workspace">
        <aside className="control-panel" aria-label="Inputs and regularization controls">
          <div className="control-panel-top">
          <h1><Bilingual en="Explore a distribution" zh="探索一个分布" className="heading-bilingual"/></h1>
          <div className="preset-list">{presets.map((p,i)=><Button size="sm" key={p.id} style={{"--preset-color":p.color} as React.CSSProperties} className={session.preset===i?"is-active":""} title={`Load the six ${p.name} moments and quoted errors from Miller et al.; restore the discrepancy-selected result. / 加载 Miller 等给出的 ${p.name} 六个矩及其误差，并恢复按偏差原则选定的结果。`} variant={session.preset===i?"default":"outline"} onClick={()=>selectPreset(i)}>{p.name}</Button>)}
            <Button size="sm" variant={session.preset===null?"default":"outline"} onClick={custom}><Bilingual en="Your inputs" zh="自定义输入"/></Button></div>
          <a className="preset-source" href={metadata.sourceURL} target="_blank" rel="noreferrer"><Bilingual en="Lattice paper · Miller et al." zh="晶格论文 · Miller 等"/><ArrowUpRight size={14}/></a>
          </div>
          <Tabs className="control-tabs" value={controlTab} onValueChange={value=>setControlTab(String(value))}>
          <TabsList aria-label="Choose controls / 选择控制项"><TabsTrigger value="tuning"><SlidersHorizontal size={15}/><Bilingual en="Tune curve" zh="调节曲线"/></TabsTrigger><TabsTrigger value="moments"><Bilingual en={`Moments (${session.rows.length})`} zh={`矩（${session.rows.length} 个）`}/></TabsTrigger></TabsList>
          <div className="control-scroll">
          <TabsContent value="tuning">
            <RegularizationPanel tuning={session.tuning??initialTuning()} onChange={tuning=>setSession(s=>({...s,tuning}))} result={result} stale={stale}/>
          </TabsContent>
          <TabsContent value="moments">
          {session.preset===null&&<label className="field-label" htmlFor="distribution-name"><Bilingual en="Distribution label" zh="分布名称"/><Input id="distribution-name" aria-label="Distribution label / 分布名称" maxLength={80} value={session.name} onChange={e=>setSession(s=>({...s,name:e.target.value}))}/></label>}
          <div className="input-setup">
            <label className="field-label"><Bilingual en="Number of moments" zh="矩的数量"/><select id="moment-count" className={guideStep==="await-count"?"guided-target":undefined} value={session.rows.length} onChange={e=>{
              const n=Number(e.target.value);setSession(s=>({...s,tuning:initialTuning(),rows:Array.from({length:n},(_,i)=>s.rows[i]??{value:"",error:"",shift:0})}));
              if(guideStep==="await-count")setGuideStep("enter-moments");
            }} aria-label="Number of measured moments / 测得的矩数量">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
            <label className="field-label"><Bilingual en="Slider span" zh="滑块范围"/><select value={session.range} onChange={e=>{
              const range=Number(e.target.value);setSession(s=>({...s,range,tuning:initialTuning(),rows:s.rows.map(r=>({...r,shift:Math.max(-range,Math.min(range,r.shift))}))}));
            }} aria-label="Moment slider range / 矩滑块范围">{[1,2,3,5].map(n=><option key={n} value={n}>±{n} errors / ±{n} 个误差</option>)}</select></label>
          </div>
          <div className="normalization-setting"><Toggle label="Include M₀ = 1" zh="包含 M₀ = 1" checked={session.includeM0} onChange={v=>setSession(s=>({...s,includeM0:v,tuning:initialTuning()}))}/>
            <p>{session.includeM0?"An input row with unit weight, not an exact normalization constraint. / 这是单位权重的输入行，并非强制归一化约束。":"Exploratory mode: the normalization row is omitted from the residual. / 探索模式：残差中不包含归一化行。"}</p></div>
          <div className="moments-heading"><h2><Bilingual en="Mellin moments" zh="梅林矩"/></h2><Button variant="ghost" size="icon-sm" title="Reset all sliders to the entered central values / 将所有滑块重置为输入的中心值" aria-label="Reset all moment sliders / 重置所有矩滑块" onClick={()=>setSession(s=>({...s,tuning:initialTuning(),rows:s.rows.map(r=>({...r,shift:0}))}))}><RotateCcw/></Button></div>
          <div className="moment-columns"><span><Bilingual en="Moment" zh="矩"/></span><span><Bilingual en="Central value" zh="中心值"/></span><span><Bilingual en="Error" zh="误差"/></span></div>
          <div className={`moments-list ${guideStep==="await-inputs"?"guided-target":""}`}>{session.rows.map((r,i)=>{
            const base=Number(r.value),error=Number(r.error),valid=r.value.trim()!==""&&r.error.trim()!==""&&Number.isFinite(base)&&Number.isFinite(error)&&error>0;
            return <div className={`moment-control ${r.shift!==0?"is-shifted":""}`} key={i}>
              <div className="moment-fields"><label className="moment-symbol" htmlFor={`m-${i}`}>M<sub>{i+1}</sub></label>
                <Input id={`m-${i}`} type="number" step="any" value={r.value} placeholder="value / 数值" aria-label={`M${i+1} central value / M${i+1} 中心值`} onChange={e=>updateRow(i,"value",e.target.value)}/>
                <Input type="number" step="any" min="0" value={r.error} placeholder="error / 误差" aria-label={`M${i+1} error / M${i+1} 误差`} onChange={e=>updateRow(i,"error",e.target.value)}/></div>
              <div className="moment-slider"><span className="midpoint-mark" aria-hidden="true"/>
                <Slider min={-session.range} max={session.range} step={.01} value={[r.shift]} disabled={!valid}
                  aria-label={`Vary M${i+1} about its entered value / 在输入值附近改变 M${i+1}`} onValueChange={v=>{
                    const shift=Array.isArray(v)?v[0]:v;setSession(s=>({...s,tuning:initialTuning(),rows:s.rows.map((row,j)=>j===i?{...row,shift}:row)}));
                  }}/></div>
              <div className="slider-caption"><span>{valid?format(base-session.range*error,3):"−"}</span>
                <span className="current-moment">{valid?format(base+r.shift*error,6):"enter values"}{r.shift!==0&&<em> ({r.shift>0?"+":""}{r.shift.toFixed(2)}σ)</em>}</span>
                <span>{valid?format(base+session.range*error,3):"+"}</span></div>
            </div>;
          })}</div>
          <p className="slider-help">The center tick is your entered value. A shift of +1σ adds one quoted error. Editing a value or error recenters that slider. / 中间刻度是你输入的中心值；+1σ 表示增加一个给定误差。编辑数值或误差会重新置中滑块。</p>
          <Button variant="outline" className="reset-button" onClick={()=>session.preset===null?custom():selectPreset(session.preset)}><RotateCcw/><Bilingual en={`Reset ${preset?"example":"inputs"}`} zh={preset?"重置示例":"重置输入"}/></Button>
          <div className="privacy-note"><LockKeyhole size={13}/><span>Calculation runs in your browser. Inputs enter a share link only when you choose to share. / 计算在浏览器本地运行；只有主动分享时，输入才会写入分享链接。</span></div>
          </TabsContent>
          </div>
          </Tabs>
        </aside>

        <div className="results-column">
          <RegularizationEquation tuning={session.tuning??initialTuning()} result={result} stale={stale}/>
          <section className="results-panel" aria-label="Reconstructed distribution">
            <div className="plot-top"><div><div className="eyebrow">02 / RECONSTRUCTION · 重构</div><h2>{deferred.name||"Custom PDF"}</h2><p className="plot-subtitle">f(x) = xqᵥ(x) <span>·</span> {deferred.rows.length} measured moments / {deferred.rows.length} 个测得的矩 {deferred.includeM0?"+ M₀":""}</p></div>
              <span className={`status-pill ${!pristine?"exploratory":""}`}><span className="status-dot"/>{pristine?<Bilingual en="Python-verified preset" zh="已由 Python 验证的预设"/>:<Bilingual en="Exploratory result" zh="探索性结果"/>}</span></div>
            <div className="plot-toolbar"><div className="toggles"><Toggle label="Input-error band" zh="输入误差带" checked={inner} onChange={setInner}/><Toggle label="Outer envelope" zh="外层包络" checked={outer} onChange={setOuter}/>{preset&&<Toggle label="Paper ansatz" zh="论文参数化" checked={paper} onChange={setPaper}/>}</div>
              <Button variant="ghost" size="sm" disabled={!result||stale} onClick={()=>pinned?setPinned(null):setPinned({curve:result!.central,label:session.name})}>{pinned?<X/>:<Pin/>}<Bilingual en={pinned?"Unpin":"Pin curve"} zh={pinned?"取消固定":"固定曲线"}/></Button></div>
            <div className={`chart-stage ${stale?"updating":""}`} ref={chartRef} aria-busy={stale}>
              {result?<div className="chart-shell">
                <ChartContainer config={{f:{label:"Reconstructed xqᵥ",color},paper:{label:"Paper beta ansatz",color:"#bb7765"}}} className="main-chart" initialDimension={{width:800,height:470}}>
                  <ComposedChart accessibilityLayer data={points} margin={{top:25,right:25,bottom:25,left:8}}>
                    <CartesianGrid vertical stroke="#d4e1e4" strokeDasharray="3 6" strokeOpacity={.72}/>
                    <XAxis dataKey="x" type="number" domain={[0,1]} ticks={[0,.2,.4,.6,.8,1]} tickLine={false} axisLine={{stroke:"#aebfc4",strokeWidth:1.1}} tick={{fill:"#4c6670",fontSize:14,fontWeight:600}}/>
                    <YAxis domain={yDomain} width={58} tickFormatter={v=>format(Number(v),3)} tickLine={false} axisLine={{stroke:"#aebfc4",strokeWidth:1.1}} tick={{fill:"#4c6670",fontSize:14,fontWeight:600}}/>
                    <ReferenceLine y={0} stroke="#9fb4ba" strokeWidth={1.1}/>
                    {outer&&<Area type="linear" dataKey="outer" stroke="none" fill="#d89277" fillOpacity={.22} isAnimationActive={false} tooltipType="none"/>}
                    {inner&&<Area type="linear" dataKey="inner" stroke="none" fill={color} fillOpacity={.18} isAnimationActive={false} tooltipType="none"/>}
                    {paper&&preset&&<Line type="linear" dataKey="paper" stroke="#bb7765" strokeDasharray="6 5" strokeWidth={1.7} dot={false} isAnimationActive={false} tooltipType="none"/>}
                    {pinned&&<Line type="linear" dataKey="pinned" stroke="#8399a1" strokeDasharray="2 4" strokeWidth={1.8} dot={false} isAnimationActive={false} tooltipType="none"/>}
                    <Line type="linear" dataKey="f" name="Reconstruction" stroke={color} strokeWidth={3.2} dot={false} activeDot={{r:5,stroke:"#fff",strokeWidth:2}} isAnimationActive={false}/>
                    <Tooltip content={<HoverCard/>} cursor={{stroke:"#9db8bf",strokeDasharray:"3 4"}}/>
                  </ComposedChart>
                </ChartContainer>
                <div className="axis-label axis-label-x" aria-label="x"><MathText tex={String.raw`\mathit{x}`}/></div>
                <div className="axis-label axis-label-y" aria-label="x q_v(x)"><MathText tex={String.raw`\mathit{x}\,q_v(\mathit{x})`}/></div>
              </div>:<output className="calculation-error"><SlidersHorizontal size={30}/><h3>{session.rows.some(r=>r.value===""||r.error==="")?<Bilingual en="Your moments go here" zh="请在这里输入矩"/>:<Bilingual en="No verified reconstruction" zh="没有已验证的重构结果"/>}</h3><p>{calculation.error}</p><small>The method is unchanged. Adjust the inputs or reset an example. / 方法没有改变；请调整输入或重置示例。</small></output>}
            </div>
            {result&&<>
              <div className="plot-legend"><span><i style={{background:color}}/><Bilingual en="Tikhonov estimate" zh="Tikhonov 重构"/></span>{inner&&<span><i className="band-key" style={{background:color,opacity:.3}}/><Bilingual en="Propagated input errors (1σ)" zh="输入误差传播（1σ）"/></span>}{outer&&<span><i className="band-key outer-key"/><Bilingual en="Additional re-inversion width" zh="额外重新反演宽度"/></span>}{paper&&preset&&<span><i className="dashed-key"/><Bilingual en="Paper beta ansatz" zh="论文中的 β 参数化"/></span>}{pinned&&<span><i className="pinned-key"/><Bilingual en={`Pinned: ${pinned.label}`} zh={`已固定：${pinned.label}`}/></span>}</div>
              <div className="metric-strip"><div><span><Bilingual en="Current α" zh="当前 α"/></span><strong title={String(result.alpha)}>{format(result.alpha,5)}</strong></div>
                <div><span><Bilingual en="Discrepancy R / δ" zh="偏差 R / δ"/></span><strong className="ratio-value">{format(result.ratio,6)}{result.discrepancyMet&&<Check size={15}/>}</strong></div>
                <div><span><Bilingual en="Reconstructed M₀" zh="重构的 M₀"/></span><strong title={String(result.normalization)}>{result.normalization.toFixed(4)}</strong></div></div>
              <div className="fit-status"><span>{result.discrepancyMet?<><Check size={14}/><Bilingual en="Discrepancy condition met" zh="满足偏差条件"/></>:<Bilingual en="Exploring away from R = δ" zh="正在探索 R = δ 之外的参数"/>}</span><span>R = {format(result.R)} <b>·</b> δ = {format(result.delta)}</span></div>
              <ObjectiveReadout result={result}/>
              {Math.min(...result.central)<-1e-7&&<p className="warning-note">The estimate includes negative values. They are shown unchanged: positivity is not imposed. / 重构结果包含负值；这里保持原样显示，因为没有施加正性约束。</p>}
            </>}
            <div className="plot-footer"><p>One regularized estimate, not a uniquely determined PDF. / 一个正则化重构，不是唯一确定的 PDF。<br/><span>All curves use 101 linear-hat nodes and W = I. / 所有曲线使用 101 个线性帽函数节点，并取 W = I。</span></p>
              <div className="export-buttons"><Button variant="outline" size="sm" disabled={!result||stale} onClick={svg}><ArrowDownToLine/><Bilingual en="Plot" zh="图像"/></Button><Button variant="outline" size="sm" disabled={!result||stale} onClick={()=>csv(true)}><ArrowDownToLine/>.dat</Button><Button variant="outline" size="sm" disabled={!result||stale} onClick={()=>csv()}><ArrowDownToLine/>CSV</Button><Button variant="outline" size="sm" disabled={!result||stale} onClick={json}><FileJson/><Bilingual en="Record" zh="记录"/></Button></div></div>
          </section>

          <section className="explanation-strip"><div className="explanation-icon"><Sparkles size={20}/></div><div><h3><Bilingual en="Try one change at a time" zh="一次只改变一个因素"/></h3><p>Pin the starting curve, then move α or change only M or S. The bands are recomputed at the current fixed α and coefficients; they do not include uncertainty from choosing those settings. The outer envelope adds a re-inversion diagnostic, not a complete systematic uncertainty. / 先固定起始曲线，再移动 α，或只改变 M、S 中的一个。误差带在当前固定的 α 和系数下重新计算；它不包含选择这些参数带来的不确定性。外层包络是重新反演诊断量，不是完整的系统误差。</p></div></section>

          <section className="source-downloads"><h3><Bilingual en="Take this calculation with you" zh="下载并复现这次计算"/></h3><p>Each source file includes your current moments, errors, controls and numerical operators. Run it to reproduce the central curve and both bands, and write a .dat file. / 每个源文件都包含当前矩、误差、控制参数和数值算子；运行后可以复现中心曲线和两条误差带，并写出 .dat 文件。</p>
            <div className="export-buttons"><Button variant="outline" disabled={!result||stale} onClick={()=>code("python")}><ArrowDownToLine/>Python · .py</Button><Button variant="outline" disabled={!result||stale} onClick={()=>code("matlab")}><ArrowDownToLine/>MATLAB · .m</Button><Button variant="outline" disabled={!result||stale} onClick={()=>code("mathematica")}><ArrowDownToLine/>Mathematica · .wl</Button></div>
            <small>Python requires NumPy (Matplotlib for plotting). MATLAB uses built-in functions. Mathematica uses Wolfram Language. Python is execution-tested; MATLAB and Mathematica ports have not been runtime-validated here. / Python 需要 NumPy（绘图时需要 Matplotlib）；MATLAB 使用内置函数；Mathematica 使用 Wolfram Language。Python 版本已执行测试；MATLAB 和 Mathematica 版本尚未在此处运行验证。</small></section>

          <section className="method-panel" id="method-panel">
            <button className="method-toggle" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-controls="method-details"><div><span className="eyebrow">UNDER THE HOOD · 方法细节</span><h3><Bilingual en="The method, without hidden switches" zh="没有隐藏开关的方法"/></h3></div><ChevronDown size={20} style={{transform:expanded?"rotate(180deg)":undefined}}/></button>
            {expanded&&<div className="method-details" id="method-details">
              <div className="equation-block"><span>INPUT MOMENTS · 输入梅林矩</span><p>M<sub>n</sub> = ∫<sub>0</sub><sup>1</sup> x<sup>n−1</sup> f(x) dx, &nbsp; f(x) = xqᵥ(x)</p></div>
              <div className="equation-block"><span>RECONSTRUCTION · 分布重构</span><MathText block tex={String.raw`\widehat c_\alpha=\arg\min_c\{\|Kc-g\|_2^2+\alpha[c^{\mathsf T}Mc+c^{\mathsf T}Sc]\}`}/><small>Baseline coefficients are both 1. Here M is the mass matrix and S is the stiffness matrix. The frozen method record uses S for their combined sum. / 基线系数均为 1。M 是质量矩阵，S 是刚度矩阵；冻结的方法记录使用二者之和。</small></div>
              <div className="equation-block"><span>AUTOMATIC REGULARIZATION · 自动正则化</span><p>R(α) = ‖Kĉ<sub>α</sub> − g‖ = δ, &nbsp; δ = √(Σ σ<sub>n</sub>²)</p><small>Relative discrepancy tolerance: 10⁻⁶. No crossing means no substitute result. / 相对偏差容差为 10⁻⁶；若没有交点，不使用替代结果。</small></div>
              <div className="method-copy">
                <p><strong>What stays fixed / 固定内容.</strong> Linear hat functions on 101 nodes; f(0) = f(1) = 0; an H¹ penalty; equal residual weights; no positivity constraint. The computational left endpoint is 10⁻²⁰. The plotted segments are linear, not a fitted plotting spline. / 101 个节点上的线性帽函数；f(0) = f(1) = 0；H¹ 正则项；残差等权；不施加正性约束。计算左端点取 10⁻²⁰。图中线段是线性的，不是拟合得到的样条。</p>
                <p><strong>What M₀ means / M₀ 的含义.</strong> When enabled, g begins with M₀ = 1 and that row has unit weight. Its input error is zero, but the reconstructed integral is not forced to equal one. Disabling it is an explicitly exploratory extension. / 开启后，g 以 M₀ = 1 开始，该行权重为 1。它的输入误差为零，但不会强制重构积分等于 1。关闭它属于明确的探索性扩展。</p>
                <p><strong>The two bands / 两条误差带.</strong> The inner half-width is the sample standard deviation from 500 independent Gaussian moment replicas, at fixed central α. The browser propagates their sample covariance through the linear inverse, reproducing the same finite-sample bands without 500 separate solves. For the outer band we recompute the measured moments from the central curve using trapezoidal integration, restore the M₀ input if enabled, reinvert at the same α, and add the absolute curve difference linearly. Neither band guarantees coverage of the true PDF. / 内层半宽是在固定中心 α 下，用 500 个独立高斯矩副本得到的样本标准差。浏览器通过线性逆算子传播样本协方差，因此无需进行 500 次独立求解也能复现有限样本误差带。外层误差带则从中心曲线用梯形积分重新计算矩，若开启则恢复 M₀ 输入，在相同 α 下重新反演，并线性加入曲线差的绝对值。两条误差带都不保证覆盖真实 PDF。</p>
                <p><strong>Which inputs belong together? / 哪些输入可以放在一起？</strong> Enter consecutive moments of the same distribution, in the same flavor convention, scale and renormalization scheme. Do not combine ratios, quark/antiquark sectors, or moments at different scales as though they were this vector. Off-diagonal input correlations are not supplied here. / 输入同一分布的连续矩，并保持相同的味道约定、尺度和重整化方案。不要把比值、夸克/反夸克扇区或不同尺度的矩直接混成一个向量。这里没有提供输入矩之间的非对角相关性。</p>
                <p><strong>Preset scope / 预设范围.</strong> The three unedited Reference 1 presets reproduce the approved <code>Mellin_Tikhonov_v1</code> Python results. Their errors combine the three quoted components in quadrature, so the inner band is not purely statistical. Changing the inputs explores the same equations but does not certify a new lattice extraction. Above six moments the browser is an exploratory tool, not a newly approved analysis. / 三个未修改的参考文献 1 预设可复现经批准的 <code>Mellin_Tikhonov_v1</code> Python 结果。其误差是三个给定分量按平方和开根号合并的结果，因此内层误差带不只是统计误差。修改输入是在探索同一组方程，并不等于新的晶格提取；超过六个矩时，本页面仅作为探索工具。</p>
              </div>
              {result&&inputRows&&<div className="moments-table-wrap"><h3>Input moments and reconstructed moments</h3><table><thead><tr><th>Moment</th><th>Input</th><th>Error</th><th>Reconstructed</th><th>Difference</th></tr></thead><tbody>{result.moments.map((v,i)=>{
                const n=i+(deferred.includeM0?0:1),g=n===0?1:inputRows.moments[n-1],error=n===0?0:inputRows.errors[n-1];
                return <tr key={n}><td>M<sub>{n}</sub></td><td>{format(g,7)}</td><td>{format(error,5)}</td><td>{format(v,7)}</td><td>{format(v-g,4)}</td></tr>;
              })}</tbody></table></div>}
            </div>}
          </section>
          <footer className="source-footer"><a href={metadata.sourceURL} target="_blank" rel="noreferrer"><Bilingual en="Miller et al. · Mellin Moments of Pion and Kaon Unpolarized PDFs from Nonlocal Operators in Lattice QCD" zh="Miller 等 · 非局域算符下 pion 与 kaon 非极化 PDF 的梅林矩"/><ArrowUpRight size={13}/></a><p>Tables 5–6 · MS̄, μ = 2 GeV · Connected-only valence approximation · The paper ansatz is a same-source comparison, not independent validation. / 表 5–6 · MS̄，μ = 2 GeV · 仅考虑连通价夸克近似 · 论文参数化来自同一来源，因此不是独立验证。</p></footer>
        </div>
      </main>
      {message&&<output className="toast-message">{message}<button aria-label="Dismiss notification / 关闭通知" onClick={()=>setMessage("")}><X size={15}/></button></output>}
      <Dialog open={Boolean(shareFallback)} onOpenChange={v=>{if(!v)setShareFallback("");}}><DialogContent><DialogTitle><Bilingual en="Copy this link" zh="复制此链接"/></DialogTitle><DialogDescription>It includes your inputs. The site’s viewing permissions still apply. / 链接中包含你的输入；网站的访问权限仍然适用。</DialogDescription><Input readOnly value={shareFallback} aria-label="Shared settings link / 分享设置链接" onFocus={e=>e.target.select()}/><Button onClick={()=>setShareFallback("")}><Bilingual en="Done" zh="完成"/></Button></DialogContent></Dialog>
      <Dialog open={guideStep==="choose-count"||guideStep==="enter-moments"||guideStep==="inspect"} onOpenChange={v=>{if(!v)setGuideStep(null);}}>
        <DialogContent className="guide-dialog">
          {guideStep==="choose-count"&&<>
            <div className="guide-kicker"><SlidersHorizontal size={16}/><Bilingual en="STEP 1 OF 3" zh="第 1 步，共 3 步"/></div>
            <DialogTitle><Bilingual en="Choose how much moment information to use" zh="选择要使用的矩信息量"/></DialogTitle>
            <DialogDescription>Start by choosing the number of measured Mellin moments you want to enter. More moments provide more constraints, but a finite-moment inverse problem is still not unique. / 先选择要输入的测得梅林矩数量。更多矩会提供更多约束，但有限矩逆问题仍然不是唯一的。</DialogDescription>
            <div className="guide-target-note"><Bilingual en="Next: use “Number of moments” in the Moments tab." zh="下一步：在“矩”选项卡中使用“矩的数量”选择框。"/></div>
            <div className="guide-actions"><Button variant="ghost" onClick={()=>setGuideStep(null)}><Bilingual en="Skip guide" zh="跳过引导"/></Button><Button onClick={goToMomentCount}><Bilingual en="Go to moment count" zh="去选择矩的数量"/></Button></div>
          </>}
          {guideStep==="enter-moments"&&<>
            <div className="guide-kicker"><SlidersHorizontal size={16}/><Bilingual en="STEP 2 OF 3" zh="第 2 步，共 3 步"/></div>
            <DialogTitle><Bilingual en="Enter each moment and its error" zh="输入每个矩及其误差"/></DialogTitle>
            <DialogDescription>For every row, enter the central value and the quoted positive error. Use consecutive moments of the same distribution, at the same scale and in the same convention. / 对每一行输入中心值和给定的正误差；请使用同一分布、同一尺度和同一约定下的连续矩。</DialogDescription>
            <div className="guide-target-note"><Bilingual en="The sliders below the rows explore the quoted error range." zh="每行下方的滑块用于探索给定误差范围。"/></div>
            <div className="guide-actions"><Button variant="ghost" onClick={()=>setGuideStep(null)}><Bilingual en="Skip guide" zh="跳过引导"/></Button><Button onClick={beginMomentEntry}><Bilingual en="Start entering" zh="开始输入"/></Button></div>
          </>}
          {guideStep==="inspect"&&<>
            <div className="guide-kicker"><Check size={16}/><Bilingual en="STEP 3 OF 3" zh="第 3 步，共 3 步"/></div>
            <DialogTitle><Bilingual en="Your inputs are ready" zh="输入已就绪"/></DialogTitle>
            <DialogDescription>The reconstruction is now shown on the right. The baseline regularization is selected using <MathText tex={String.raw`R(\alpha_\star)=\delta`}/>. You can inspect the uncertainty bands, or explore <MathText tex={String.raw`\alpha`}/>, <MathText tex={String.raw`M`}/> and <MathText tex={String.raw`S`}/> one at a time. / 重构结果现在显示在右侧。基线正则化通过 <MathText tex={String.raw`R(\alpha_\star)=\delta`}/> 选定。你可以查看误差带，或逐一探索 <MathText tex={String.raw`\alpha`}/>、<MathText tex={String.raw`M`}/> 和 <MathText tex={String.raw`S`}/>。</DialogDescription>
            <div className="guide-target-note"><Bilingual en="The plot, discrepancy readout and controls are ready to explore." zh="现在可以探索右侧的图、偏差读数和控制项。"/></div>
            <div className="guide-actions"><Button variant="ghost" onClick={()=>setGuideStep(null)}><Bilingual en="Close" zh="关闭"/></Button><Button onClick={finishGuide}><Bilingual en="Show reconstruction" zh="查看重构结果"/></Button></div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
