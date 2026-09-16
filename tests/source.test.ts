import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
import {sourceFile} from "../lib/source-downloads.ts";
import {reconstruct} from "../lib/inversion.ts";
import presets from "../lib/presets.json" with {type:"json"};

const python=process.env.MELLIN_TEST_PYTHON??"../gpd_inverse/.venv/bin/python";
void test("all language downloads embed current data and contain no unresolved template",()=>{
  const p=presets[0],input={moments:p.moments,errors:p.errors,includeM0:true,seed:0};
  for(const lang of ["python","matlab","mathematica"] as const){
    const file=sourceFile(lang,input,{logAlpha:1,mass:2,slope:.1});
    assert.ok(file.content.includes("sampleCov"));
    assert.ok(!file.content.includes("__DATA__"));
    assert.ok(!file.content.includes("/Users/"));
    assert.ok(file.content.length>10000);
  }
});
void test("downloaded Python reproduces browser curves/bands and independent augmented least squares",
  {skip:!existsSync(python)?"Set MELLIN_TEST_PYTHON to a Python with NumPy":false},()=>{
  for(const [i,p] of presets.entries()){
    const cases=i===0?[{logAlpha:0,mass:1,slope:1},{logAlpha:-1,mass:7,slope:.2},
      {logAlpha:0,mass:1,slope:0},{logAlpha:0,mass:0,slope:1}]:[{logAlpha:0,mass:1,slope:1}];
    for(const tuning of cases){
      const input={moments:p.moments,errors:p.errors,includeM0:true,seed:i};
      const file=sourceFile("python",input,tuning);
      const script="__name__='download_validation'\n"+file.content+String.raw`
v, info = reconstruct(DATA)
k=np.asarray(DATA["K"])[:,1:-1]; g=np.r_[1.,DATA["moments"]]
p=DATA["mass"]*np.asarray(DATA["M"])+DATA["slope"]*np.asarray(DATA["S"])
a=np.vstack((k,np.sqrt(info["alpha"])*np.linalg.cholesky(p).T))
q=np.linalg.lstsq(a,np.r_[g,np.zeros(99)],rcond=None)[0]
assert np.max(np.abs(q-v[1:-1,1]))<1e-8
print(json.dumps({"values":v.tolist(),"info":info}))
`;
      const proc=spawnSync(python,["-"],{input:script,encoding:"utf8",
        env:{...process.env,OPENBLAS_NUM_THREADS:"1",VECLIB_MAXIMUM_THREADS:"1"},maxBuffer:2e6});
      assert.equal(proc.status,0,proc.stderr);
      const actual=JSON.parse(proc.stdout);
      const expected=reconstruct(input,tuning);
      assert.ok(Math.abs(actual.info.alpha_star/expected.alphaStar-1)<1e-8);
      for(let j=0;j<101;j++){
        const cols=[expected.central,expected.innerLower,expected.innerUpper,expected.outerLower,expected.outerUpper,expected.sigma,expected.closureWidth];
        cols.forEach((col,k)=>assert.ok(Math.abs(actual.values[j][k+1]-col[j])<1e-9,`${p.id} col ${k} node ${j}`));
      }
    }
  }
});
