import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,SCENES,QT_BLUE,mixColor,grayColor,materialValues,approximatePalette,isPortableFeature} from '../qt-material-presets.js';

test('eight diagnostic variants have unique identifiers and plain descriptions',()=>{
  assert.equal(PRESETS.length,8);
  assert.equal(new Set(PRESETS.map(p=>p.id)).size,8);
  assert.ok(PRESETS.every(p=>p.name&&p.detail));
});
test('every preset shares exactly one independent 0–100 material parameter',()=>{
  for(const variant of PRESETS){for(const scene of SCENES){
    const a=materialValues(0,variant.id,scene),b=materialValues(.5,variant.id,scene),c=materialValues(1,variant.id,scene);
    assert.equal(a.mix,0);assert.equal(b.mix,.5);assert.equal(c.mix,1);
    assert.ok(a.shellAlpha>b.shellAlpha&&b.shellAlpha>c.shellAlpha,variant.id);
    assert.ok(a.controlAlpha>=b.controlAlpha&&b.controlAlpha>=c.controlAlpha,variant.id);
    assert.ok([a,b,c].every(x=>x.controlAlpha>=x.shellAlpha),variant.id);
  }}
});
test('controls never become more transparent than housing, even between endpoints',()=>{
  for(const p of PRESETS){for(let i=0;i<=100;i++){
    const v=materialValues(i/100,p.id,'mixed','dualsense');
    assert.ok(v.controlAlpha+1e-9>=v.shellAlpha,`${p.id}@${i}`);
    assert.ok(v.activeAlpha+1e-9>=v.controlAlpha,`${p.id} pressed@${i}`);
    assert.ok(v.activeAlpha<=1);
  }}
});
test('same blue tint is used on every scene without background sampling',()=>{
  for(const p of PRESETS){for(const s of SCENES){
    assert.equal(materialValues(.83,p.id,s).blue,QT_BLUE);
    assert.match(QT_BLUE,/^#[0-9a-f]{6}$/);
  }}
});
test('model identity palette is approximate, stays available in normal at mix zero',()=>{
  const dual=materialValues(0,'heritage','light','dualsense');
  assert.equal(dual.shellColor,approximatePalette('dualsense').shell);
  assert.equal(dual.controlColor,approximatePalette('dualsense').control);
  assert.notEqual(dual.shellColor,materialValues(0,'heritage','light','gamecube').shellColor);
});
test('each scheme works on dark light mixed without postprocessing',()=>{
  for(const p of PRESETS){for(const s of SCENES){
    const v=materialValues(.78,p.id,s);
    for(const key of ['inkColor','shellColor','controlColor','blue'])assert.match(v[key],/^#[0-9a-f]{6}$/);
    for(const key of ['shellAlpha','controlAlpha','activeAlpha','lineAlpha','pressOuterOpacity','pressInnerOpacity']){
      assert.ok(v[key]>=0&&v[key]<=1,`${p.id}/${s}/${key}`);
    }
  }}
});
test('linear desaturation preserves a palette luminance anchor',()=>{
  assert.equal(grayColor('#ff0000'),'#363636');
  assert.equal(mixColor('#ffffff','#000000',.5),'#808080');
});
test('Qt-portable primitive allowlist rejects shader, readback and CSS filter features',()=>{
  for(const feature of ['solid-fill','solid-stroke','opacity','path-stroke','svg-mask'])assert.equal(isPortableFeature(feature),true);
  for(const feature of ['fragment-shader','canvas-readback','blur','postprocessing','css-filter','multiply','screen','clip-path'])assert.equal(isPortableFeature(feature),false);
});
