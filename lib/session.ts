import presets from "./presets.json" with { type: "json" };
import type { Input } from "./inversion";

export type MomentRow = { value: string; error: string; shift: number };
export type LabSession = {
  version: 1; preset: number | null; name: string; rows: MomentRow[];
  includeM0: boolean; range: number; seed: number;
};
export function presetSession(index: number): LabSession {
  const p = presets[index];
  return {version:1,preset:index,name:p.name,includeM0:true,range:3,seed:p.seed,
    rows:p.moments.map((v,i)=>({value:String(v),error:String(p.errors[i]),shift:0}))};
}
export function numericalInput(s: LabSession): Input {
  if (s.rows.some(r=>r.value.trim()==="" || r.error.trim()===""))
    throw new Error("Enter a value and a positive error for every moment to see the reconstruction.");
  return {moments:s.rows.map(r=>Number(r.value)+r.shift*Number(r.error)),
    errors:s.rows.map(r=>Number(r.error)),includeM0:s.includeM0,seed:s.seed};
}
export function isUnchangedPreset(s: LabSession): boolean {
  if (s.preset===null || !s.includeM0) return false;
  const p=presets[s.preset];
  return s.rows.length===6 && s.rows.every((r,i)=>
    Number(r.value)===p.moments[i] && Number(r.error)===p.errors[i] && r.shift===0);
}
export function readSession(text: string): LabSession {
  if (text.length>12000) throw new Error("Shared settings are too large.");
  const s=JSON.parse(text) as LabSession;
  if (s.version!==1 || typeof s.name!=="string" || s.name.length>80 ||
      ![null,0,1,2].includes(s.preset) || ![0,1,2].includes(s.seed) ||
      ![1,2,3,5].includes(s.range) || typeof s.includeM0!=="boolean" ||
      !Array.isArray(s.rows) || s.rows.length<1 || s.rows.length>12 ||
      s.rows.some(r=>typeof r.value!=="string" || r.value.length>40 ||
        typeof r.error!=="string" || r.error.length>40 ||
        !Number.isFinite(r.shift) || Math.abs(r.shift)>s.range ||
        !Number.isFinite(Number(r.value)) || !Number.isFinite(Number(r.error))))
    throw new Error("This link does not contain valid Mellin Lab settings.");
  return s;
}
