"use client";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { ReactNode } from "react";
import { CircleHelp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Result } from "@/lib/inversion";
import { initialTuning } from "@/lib/session";

function Bilingual({en,zh,className=""}:{en:ReactNode;zh:string;className?:string}) {
  return <span className={`bilingual ${className}`}><span>{en}</span><small lang="zh-CN">{zh}</small></span>;
}
export function MathText({tex,block=false}:{tex:string;block?:boolean}){
  return <span className={block?"math-display":"math-inline"} dangerouslySetInnerHTML={{__html:
    katex.renderToString(tex,{displayMode:block,throwOnError:false,trust:false,output:"htmlAndMathml"})}}/>;
}
export function Help({text,label="Learn more",textZh}:{text:string;label?:string;textZh?:string}){
  return <Tooltip><TooltipTrigger aria-label={textZh?`${label} / ${textZh}`:label} className="help-trigger"><CircleHelp size={15}/></TooltipTrigger><TooltipContent className="help-popup"><span>{text}</span>{textZh&&<span className="tooltip-zh" lang="zh-CN">{textZh}</span>}</TooltipContent></Tooltip>;
}
type Tuning=ReturnType<typeof initialTuning>;
const num=(n:number)=>n===0?"0":Math.abs(n)<.001||Math.abs(n)>1000?n.toExponential(2):Number(n.toPrecision(4)).toString();
const texNum=(n:number)=>num(n).replace(/e([+-]?\d+)/,(_,power)=>`\\times 10^{${Number(power)}}`);
type PanelProps={tuning:Tuning;onChange:(t:Tuning)=>void;result:Result|null;stale:boolean};
export function RegularizationEquation({tuning,result,stale}:Omit<PanelProps,"onChange">){
  const shown=result?.exploration??tuning;
  return <TooltipProvider delay={200}><section className="equation-ribbon" aria-label="Minimization equation / 最小化方程">
    <div className="ribbon-heading"><span className="eyebrow">THE INVERSE PROBLEM · 逆问题</span><Help label="Equation symbols" text="g contains the input moments. c contains the values of f = xqᵥ at the interior nodes. Kc gives the reconstructed moments. W = I. M measures the squared size of f; S measures its squared slope." textZh="g 包含输入的梅林矩；c 包含内部节点上的 f = xqᵥ 数值；Kc 给出重构矩；W = I。M 衡量 f 的平方大小，S 衡量 f 的平方斜率。"/></div>
    <div className="live-equation" aria-busy={stale}>
      <MathText block tex={String.raw`\widehat c_{\alpha}=\underset{c}{\arg\min}\left\{\|Kc-g\|_2^2+\alpha\left[{\color{#087f8c}${num(shown.mass)}\,c^{\mathsf T}M c}+{\color{#8051b0}${num(shown.slope)}\,c^{\mathsf T}S c}\right]\right\}`}/>
      {result&&<div className="equation-live-values"><MathText tex={String.raw`\alpha=${texNum(result.alpha)},\qquad R=${texNum(result.R)},\qquad\delta=${texNum(result.delta)}`}/></div>}
    </div>
  </section></TooltipProvider>;
}
export function ObjectiveReadout({result}:{result:Result}){
  return <div className="objective-readout">
    <span><Bilingual en="Objective" zh="目标函数"/><b>{num(result.objective)}</b></span><span><Bilingual en="Mismatch" zh="不匹配量"/><b>{num(result.R**2)}</b></span>
    <span className="mass-value"><Bilingual en="α × M piece" zh="α × M 项"/><b>{num(result.alpha*result.exploration.mass*result.massEnergy)}</b></span>
    <span className="slope-value"><Bilingual en="α × S piece" zh="α × S 项"/><b>{num(result.alpha*result.exploration.slope*result.slopeEnergy)}</b></span>
  </div>;
}
export default function RegularizationPanel({tuning,onChange,result}:PanelProps){
  const baseline=tuning.logAlpha===0&&tuning.mass===1&&tuning.slope===1;
  const pieces=[
    {key:"mass" as const,label:"M · size of the function",zh:"M · 函数幅度",symbol:"M",energy:result?.massEnergy,
      integral:String.raw`\int_0^1 f(x)^2\,dx`,hint:"Increasing this coefficient discourages a large overall function amplitude. It does not directly measure rapid changes in x.",hintZh:"增大这个系数会抑制函数整体幅度变大；它并不直接衡量 x 方向上的快速变化。"},
    {key:"slope" as const,label:"S · changes along x",zh:"S · 沿 x 的变化",symbol:"S",energy:result?.slopeEnergy,
      integral:String.raw`\int_0^1 [f'(x)]^2\,dx`,hint:"Increasing this coefficient discourages steep slopes and rapid oscillations. With zero endpoints, a nonzero curve must still rise and fall.",hintZh:"增大这个系数会抑制陡峭斜率和快速振荡；在端点为零时，非零曲线仍然必须先上升再下降。"},
  ];
  return <TooltipProvider delay={200}><section className="regularization-panel" aria-label="Regularization controls / 正则化控制">
    <div className="tuning-panel-heading"><Bilingual en="Tune one term at a time" zh="一次调节一个项"/>
      <Button variant="ghost" size="sm" title="Restore α = α★ and both regularization coefficients to 1 / 恢复 α = α★ 且将两个正则化系数设为 1" onClick={()=>onChange({...initialTuning(),window:tuning.window})}><RotateCcw/><Bilingual en="Reset" zh="重置"/></Button></div>
    <div className="tuning-grid">
      <div className="tuning-card alpha-card">
        <div className="control-heading"><strong><Bilingual en="α · overall balance" zh="α · 总体权衡"/></strong><Help text="α multiplies both terms. Larger α generally allows more moment mismatch for a smaller regularization cost. Smaller α fits the moments more closely but can amplify poorly constrained structure. The slider is logarithmic: a window of 2 spans α★/100 to 100α★." textZh="α 同时乘在两个正则项上。较大的 α 通常允许更大的矩不匹配，以换取更小的正则化代价；较小的 α 更贴合矩，但可能放大约束不足的结构。滑块使用对数刻度：范围为 2 时覆盖 α★/100 到 100α★。"/></div>
        <div className="alpha-value-row"><div className="tuning-number">{num(10**tuning.logAlpha)}<small> × α★</small></div>
        <label className="window-label"><Bilingual en="± decades" zh="± 十进数量级"/><input type="number" min={.5} max={4} step={.5} value={tuning.window} aria-label="Alpha window in decades / α 的十进数量级范围"
          onChange={e=>{const window=Number(e.target.value);if(window>=.5&&window<=4)onChange({...tuning,window,logAlpha:Math.max(-window,Math.min(window,tuning.logAlpha))});}}/></label></div>
        <Slider min={-tuning.window} max={tuning.window} step={.01} value={[tuning.logAlpha]} aria-label="Alpha multiplier, logarithmic scale / α 倍率，对数刻度"
          onValueChange={v=>onChange({...tuning,logAlpha:Array.isArray(v)?v[0]:v})}/>
        <div className="range-ends"><span>÷ {num(10**tuning.window)}</span><Bilingual en="log scale" zh="对数刻度"/><span>× {num(10**tuning.window)}</span></div>
      </div>
      {pieces.map(piece=><div className={`tuning-card ${piece.key}-card`} key={piece.key}>
        <div className="control-heading"><strong><Bilingual en={piece.label} zh={piece.zh}/></strong><Help text={`${piece.hint} Switch off to isolate the other term. At least one term must remain on.`} textZh={`${piece.hintZh} 关闭此开关可单独观察另一个项；至少要保留一个正则项。`}/></div>
        <div className="piece-toggle"><span className="piece-equation"><MathText tex={`${piece.integral}`}/></span><b>{num(tuning[piece.key])} ×</b>
          <Switch size="sm" checked={tuning[piece.key]>0} disabled={tuning[piece.key]>0&&tuning[piece.key==="mass"?"slope":"mass"]===0}
            aria-label={`Include ${piece.symbol} regularization piece / 包含 ${piece.symbol} 正则项`} onCheckedChange={v=>onChange({...tuning,[piece.key]:v?1:0})}/></div>
        <Slider min={-3} max={3} step={.05} value={[Math.log10(tuning[piece.key]||1)]} disabled={tuning[piece.key]===0}
          aria-label={`${piece.symbol} coefficient, logarithmic scale / ${piece.symbol} 系数，对数刻度`} onValueChange={v=>onChange({...tuning,[piece.key]:10**(Array.isArray(v)?v[0]:v)})}/>
        <div className="range-ends"><span>0.001</span><Bilingual en="1 = baseline" zh="1 = 基线"/><span>1000</span></div>
      </div>)}
    </div>
    <div className={`tuning-status ${baseline?"":"is-exploring"}`}><strong>{baseline?<Bilingual en="At the discrepancy-selected baseline" zh="处于偏差原则选定的基线"/>:<Bilingual en="Exploring modified regularization" zh="正在探索修改后的正则化"/>}</strong>
      <span>α★{result?` = ${num(result.alphaStar)}`:""} stays fixed while tuning. New moment inputs reset these controls. / 调节时 α★ 保持不变；输入新的矩会重置这些控制项。</span></div>
  </section></TooltipProvider>;
}
