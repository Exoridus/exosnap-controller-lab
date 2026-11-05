import test from 'node:test';
import assert from 'node:assert/strict';
import {HandheldOverlayMotion, eulerQuaternion, eulerAngles, overlayOrientation} from '../overlay-motion.js';
import {MOTION_TUNING_DEFAULTS, sanitizeMotionTuning} from '../motion-tuning.js';
const DEG=Math.PI/180;
const ID={x:0,y:0,z:0,w:1};
const toDeg=q=>Object.fromEntries(Object.entries(eulerAngles(q)).map(([k,v])=>[k,v/DEG]));
const magnitude=a=>Math.hypot(a.pitch,a.roll,a.yaw);
function gesture(target,options={},duration=950,interval=10){
  const f=new HandheldOverlayMotion({...options,deadzoneDeg:0,autoReturn:false});
  f.update(ID,0);
  for(let t=interval;t<=duration;t+=interval){
    const phase=t/duration;
    f.update(eulerQuaternion(Object.fromEntries(Object.entries(target).map(([k,v])=>[k,v*phase*DEG]))),t);
  }
  for(let t=duration+interval;t<=duration+250;t+=interval)
    f.update(eulerQuaternion(Object.fromEntries(Object.entries(target).map(([k,v])=>[k,v*DEG]))),t);
  const a=toDeg(f.orientation);a.pitch+=12;
  return {f, a};
}
test('total envelope includes pitch as well as roll and yaw, preserving 20° solo travel',()=>{
  assert.equal(MOTION_TUNING_DEFAULTS.totalCombinedMaxDeg,25);
  const single=gesture({pitch:50}).a;
  assert.ok(Math.abs(single.pitch-20)<.7,JSON.stringify(single));
  const mix=gesture({pitch:50,roll:50,yaw:50}).a;
  assert.ok(magnitude(mix)<=25.6,`diagonal escaped envelope ${JSON.stringify(mix)}`);
  assert.ok(mix.pitch>9&&mix.roll>9&&mix.yaw>9,`one axis got suppressed: ${JSON.stringify(mix)}`);
});
test('direct limited view obeys 25° total envelope, 360° view remains untouched',()=>{
  const q=eulerQuaternion({pitch:40*DEG,roll:40*DEG,yaw:40*DEG});
  const a=toDeg(overlayOrientation(q,'overlay'));
  assert.ok(magnitude(a)<=25.3,JSON.stringify(a));
  assert.deepEqual(overlayOrientation(q,'free',{totalCombinedMaxDeg:10}),q);
});
test('inward movement releases global limit without requiring auto recenter',()=>{
  const {f}=gesture({pitch:48,roll:48,yaw:48});
  const start=magnitude(Object.fromEntries(Object.entries(f.desired).map(([k,v])=>[k,v/DEG])));
  assert.ok(start>=24.3&&start<=25.01,`expected saturation: ${start}`);
  for(let t=1210;t<=1450;t+=10){
    const factor=1-(t-1200)/500;
    f.update(eulerQuaternion({pitch:48*DEG*factor,roll:48*DEG*factor,yaw:48*DEG*factor}),t);
  }
  const end=magnitude(Object.fromEntries(Object.entries(f.desired).map(([k,v])=>[k,v/DEG])));
  assert.ok(end<start-4,`reversal should leave the boundary: ${start} -> ${end}`);
});
test('slow 3 deg/s physical return at 120Hz is not discarded by per-frame threshold',()=>{
  const f=new HandheldOverlayMotion({autoReturn:false,deadzoneDeg:0,responseMs:25});
  f.update(ID,0);
  for(let t=1000/120;t<=4000;t+=1000/120){
    const angle=12*(t/4000)*DEG;
    f.update(eulerQuaternion({yaw:angle}),t);
  }
  assert.ok(f.desired.yaw/DEG>8.5,`slow movement was lost: ${f.desired.y/DEG}`);
});
test('total limit can be tuned and invalid values are sanitized',()=>{
  const a=sanitizeMotionTuning({totalCombinedMaxDeg:23});
  assert.equal(a.totalCombinedMaxDeg,23);
  assert.ok(sanitizeMotionTuning({totalCombinedMaxDeg:-999}).totalCombinedMaxDeg>=10);
  assert.ok(sanitizeMotionTuning({totalCombinedMaxDeg:999}).totalCombinedMaxDeg<=70);
});
test('simultaneous calibrated Euler movements preserve their separate display axes',()=>{
  const {f}=gesture({pitch:18,roll:18,yaw:18},{totalCombinedMaxDeg:70,rollYawCombinedMaxDeg:70,pitchMaxDeg:30,rollMaxDeg:30,yawMaxDeg:30});
  const a={pitch:f.desired.pitch/DEG,yaw:f.desired.yaw/DEG,roll:f.desired.roll/DEG};
  assert.ok(Math.abs(a.pitch-a.yaw)<1.5,`unexpected pitch-to-yaw coupling: ${JSON.stringify(a)}`);
  assert.ok(Math.abs(a.roll-a.yaw)<1.5,`unexpected roll-to-yaw coupling: ${JSON.stringify(a)}`);
});
test('after tipping physical controller beyond 90°, reversing releases pitch boundary immediately',()=>{
  const f=new HandheldOverlayMotion({pitchGain:.9,pitchMaxDeg:20,rollMaxDeg:20,yawMaxDeg:20,totalCombinedMaxDeg:25,autoReturn:false});
  f.update(ID,0);
  for(let t=10;t<=1000;t+=10)f.update(eulerQuaternion({pitch:130*t/1000*DEG}),t);
  const saturated=f.desired.pitch/DEG;
  assert.ok(saturated>19.7&&saturated<=20.01,`controller should stay at positive pitch bound: ${saturated}`);
  f.update(eulerQuaternion({pitch:120*DEG}),1010);
  assert.ok(f.desired.pitch/DEG<saturated-6,`controller should reverse without resetting: ${f.desired.pitch/DEG}`);
});
