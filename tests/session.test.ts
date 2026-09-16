import { test } from "node:test";
import assert from "node:assert/strict";
import { initialTuning, presetSession, numericalInput, isUnchangedPreset, readSession } from "../lib/session.ts";

void test("preset, slider units, and share-state round trip",()=>{
  const s=presetSession(0);
  assert.ok(isUnchangedPreset(s));
  s.rows[0].shift=2;
  assert.ok(!isUnchangedPreset(s));
  assert.equal(numericalInput(s).moments[0],Number(s.rows[0].value)+2*Number(s.rows[0].error));
  assert.deepEqual(readSession(JSON.stringify(s)),s);
});
void test("exploration settings survive sharing and cannot masquerade as a preset",()=>{
  const s=presetSession(1);s.tuning={...initialTuning(),mass:0,logAlpha:-1};
  assert.deepEqual(readSession(JSON.stringify(s)),s);
  assert.equal(isUnchangedPreset(s),false);
  s.tuning.slope=0;
  assert.throws(()=>readSession(JSON.stringify(s)),/Invalid regularization/);
});
void test("missing inputs are not silently treated as zero",()=>{
  const s=presetSession(0);s.rows[0].value="";
  assert.throws(()=>numericalInput(s),/Enter a value/);
});
void test("shared settings reject malformed and unbounded data",()=>{
  assert.throws(()=>readSession("{}"));
  assert.throws(()=>readSession("x".repeat(13000)));
  const s=presetSession(0);s.rows[0].shift=1e10;
  assert.throws(()=>readSession(JSON.stringify(s)));
});
