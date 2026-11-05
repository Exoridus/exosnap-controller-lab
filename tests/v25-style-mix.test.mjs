import {test} from 'node:test';
import assert from 'node:assert/strict';
import {styleAt,STYLE_PRESETS,styleName} from '../style-mix.js';

test('Normal Glass Ghost are exact, independent material stops',()=>{
  for(const [name,mix] of [['normal',0],['glass',.5],['ghost',1]]){
    for(const [key,value] of Object.entries(STYLE_PRESETS[name]))assert.equal(styleAt(mix)[key],value);
  }
});
test('interpolations are continuous monotonic and do not hide shell alpha',()=>{
  const vals=[0,.0001,.125,.25,.4999,.5,.5001,.75,.875,1].map(styleAt);
  for(let i=1;i<vals.length;i++){
    assert.ok(vals[i].shell<=vals[i-1].shell);
    assert.ok(vals[i].contour<=vals[i-1].contour); // v26: the visible outline fades out toward Glass/Ghost
    assert.ok(vals[i].control<=vals[i-1].control);
    for(const val of Object.values(vals[i]))assert.ok(val>=0&&val<=1);
  }
  assert.ok(Math.abs(styleAt(.4999).shell-styleAt(.5).shell)<.001);
  assert.equal(styleName(0),'Normal');assert.equal(styleName(.5),'Glass');assert.equal(styleName(1),'Ghost');
});
test('nonfinite blend values are neutral',()=>{
  assert.deepEqual(styleAt(NaN),STYLE_PRESETS.normal);
  assert.deepEqual(styleAt(-20),STYLE_PRESETS.normal);
  assert.deepEqual(styleAt(20),STYLE_PRESETS.ghost);
});
