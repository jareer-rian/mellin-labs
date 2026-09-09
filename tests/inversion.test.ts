import { test } from "node:test";
import assert from "node:assert/strict";
import { reconstruct, fitAtAlpha, selectAlpha, cholesky } from "../lib/inversion.ts";
import fixtures from "./python-reference.json" with { type: "json" };
import presets from "../lib/presets.json" with { type: "json" };

const maxDiff = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
for (const [i, p] of presets.entries()) void test(`exact Python regression: ${p.id}`, () => {
  const r = reconstruct({moments:p.moments, errors:p.errors, includeM0:true, seed:p.seed});
  const f = fixtures[i];
  assert.ok(Math.abs(r.alpha/f.alpha-1) < 1e-8);
  assert.ok(Math.abs(r.ratio-1) < 1e-6);
  assert.ok(maxDiff(r.central, f.central) < 1e-9);
  assert.ok(maxDiff(r.sigma, f.sigma) < 1e-9);
  assert.ok(maxDiff(r.closure, f.closure) < 1e-9);
  assert.ok(maxDiff(r.outerLower, f.outerLower) < 1e-9);
  assert.ok(maxDiff(r.moments, f.moments) < 1e-9);
  assert.deepEqual([r.central[0],r.central[100]], [0,0]);
  assert.ok(r.stationarity < 1e-9);
});
const pion = {moments:presets[0].moments, errors:presets[0].errors, includeM0:true, seed:0};
void test("normalization is soft and no output rescaling takes place", () => {
  const r = reconstruct(pion);
  assert.ok(Math.abs(r.normalization-0.9627565585856555) < 1e-9);
});
void test("custom mode can omit M0 without making it an equality", () => {
  const r = reconstruct({...pion, includeM0:false});
  assert.equal(r.moments.length,6);
  assert.ok(Math.abs(r.ratio-1) < 1e-6);
  assert.ok(Math.abs(r.normalization-1) > 1e-3);
});
void test("no crossing produces an explicit error, never a substitute curve", () => {
  assert.throws(()=>selectAlpha({...pion, errors:Array(6).fill(100)}), /No discrepancy crossing/);
});
void test("bad and non-finite input rejected", () => {
  for (const errors of [[], Array(6).fill(0), Array(6).fill(-1), Array(6).fill(NaN)])
    assert.throws(()=>reconstruct({...pion,errors}));
  assert.throws(()=>reconstruct({...pion,moments:[Infinity,...pion.moments.slice(1)]}));
  assert.throws(()=>fitAtAlpha(pion,0));
  assert.throws(()=>cholesky([[1,2],[2,1]]));
});
void test("linear map remains linear; no positivity clipping", () => {
  const positive = fitAtAlpha({...pion, includeM0:false},.02);
  const negative = fitAtAlpha({...pion, includeM0:false,moments:pion.moments.map(v=>-v)},.02);
  assert.ok(maxDiff(negative.central,positive.central.map(v=>-v)) < 1e-12);
  assert.ok(Math.min(...negative.central) < -.1);
});
void test("arbitrary supported counts and repeated runs", () => {
  for (const count of [1,3,6,12]) {
    const moments = Array.from({length:count},(_,i)=>6/((i+3)*(i+4)));
    const input = {moments,errors:Array(count).fill(.003),includeM0:true,seed:0};
    const r = reconstruct(input);
    assert.ok(Math.abs(r.ratio-1)<1e-6);
    assert.deepEqual(r.central,reconstruct(input).central);
    assert.ok(r.central.every(Number.isFinite));
  }
});
