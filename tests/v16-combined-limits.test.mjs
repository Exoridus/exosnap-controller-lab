import test from 'node:test';
import assert from 'node:assert/strict';
import {HandheldOverlayMotion,eulerQuaternion,eulerAngles,overlayOrientation} from '../overlay-motion.js';
import {MOTION_TUNING_DEFAULTS,MOTION_TUNING_PRESETS,matchMotionPreset,sanitizeMotionTuning} from '../motion-tuning.js';

const R=Math.PI/180;
const ID={x:0,y:0,z:0,w:1};
const angles=q=>Object.fromEntries(Object.entries(eulerAngles(q)).map(([k,v])=>[k,v/R]));
const hypot=(a)=>Math.hypot(a.roll,a.yaw);
function gesture({pitch=0,yaw=0,roll=0}, duration=650, opts={}){
  const f=new HandheldOverlayMotion(opts);
  f.update(ID,0);
  let result=f.orientation;
  for(let t=10;t<=duration;t+=10){
    const frac=t/duration;
    result=f.update(eulerQuaternion({pitch:pitch*frac*R,yaw:yaw*frac*R,roll:roll*frac*R}),t);
  }
  for(let t=duration+10;t<=duration+250;t+=10)
    result=f.update(eulerQuaternion({pitch:pitch*R,yaw:yaw*R,roll:roll*R}),t);
  return {f,a:angles(result)};
}

test('v16 comfort: 90% axis gains, compact pitch/roll/yaw caps, 50ms response and small deadzone',()=>{
  assert.equal(MOTION_TUNING_DEFAULTS.pitchGain,.90);
  assert.equal(MOTION_TUNING_DEFAULTS.rollGain,.90);
  assert.equal(MOTION_TUNING_DEFAULTS.yawGain,.90);
  assert.equal(MOTION_TUNING_DEFAULTS.pitchMaxDeg,20);
  assert.equal(MOTION_TUNING_DEFAULTS.rollMaxDeg,20);
  assert.equal(MOTION_TUNING_DEFAULTS.yawMaxDeg,20);
  assert.equal(MOTION_TUNING_DEFAULTS.rollYawCombinedMaxDeg,20);
  assert.equal(MOTION_TUNING_DEFAULTS.responseMs,50);
  assert.ok(MOTION_TUNING_DEFAULTS.deadzoneDeg<.35);
  assert.equal(matchMotionPreset(MOTION_TUNING_DEFAULTS),'comfort');
});

test('isolated roll/yaw retain full 20-degree travel while both together stay inside 20-degree disk',()=>{
  const isolatedRoll=gesture({roll:40});
  const isolatedYaw=gesture({yaw:40});
  assert.ok(Math.abs(isolatedRoll.a.roll-20)<.6,`isolated roll ${isolatedRoll.a.roll}`);
  assert.ok(Math.abs(isolatedYaw.a.yaw-20)<.6,`isolated yaw ${isolatedYaw.a.yaw}`);
  const diagonal=gesture({roll:40,yaw:40});
  assert.ok(hypot(diagonal.a)<=20.5,`combined limit violated ${JSON.stringify(diagonal.a)}`);
  assert.ok(diagonal.a.yaw>8 && diagonal.a.roll>8,`both axes should contribute: ${JSON.stringify(diagonal.a)}`);
});

test('pitch remains independent from roll+yaw shared envelope',()=>{
  const a=gesture({pitch:42,yaw:35,roll:35}).a;
  assert.ok(Math.abs(a.pitch+12)>12,`pitch must still move ${a.pitch}`);
  assert.ok(hypot(a)<=20.5,`combined limit ${JSON.stringify(a)}`);
});

test('reversing direction immediately leaves circular limit without delayed angle debt',()=>{
  const {f}=gesture({yaw:45},650);
  assert.ok(Math.abs(f.desired.yaw/R-20)<.5);
  const before=f.desired.yaw;
  f.update(eulerQuaternion({yaw:40*R}),920);
  assert.ok(f.desired.yaw<before-3*R,`reverse should release clamp: ${f.desired.yaw/R}`);
  assert.ok(Math.hypot(f.desired.yaw,f.desired.roll)<=20*R+1e-9);
});

test('direct limited mode uses shared roll/yaw disk, free mode is unchanged',()=>{
  const q=eulerQuaternion({yaw:32*R,roll:32*R});
  const direct=angles(overlayOrientation(q,'overlay', {rollMaxDeg:20,yawMaxDeg:20,rollYawCombinedMaxDeg:20}));
  assert.ok(hypot(direct)<=20.02,`direct ${JSON.stringify(direct)}`);
  assert.deepEqual(overlayOrientation(q,'free',{rollYawCombinedMaxDeg:4}),q);
});

test('shared limit configurable above individual diagonal allows simultaneous full movements',()=>{
  const a=gesture({roll:38,yaw:38},650,{rollYawCombinedMaxDeg:60,totalCombinedMaxDeg:70}).a;
  assert.ok(a.roll>18 && a.yaw>18,JSON.stringify(a));
  const sanitized=sanitizeMotionTuning({rollYawCombinedMaxDeg:-999});
  assert.ok(sanitized.rollYawCombinedMaxDeg>=8);
  assert.ok(MOTION_TUNING_PRESETS.dynamic.rollYawCombinedMaxDeg>=MOTION_TUNING_DEFAULTS.rollYawCombinedMaxDeg);
});

test('changing shared limit clamps any already accumulated desired and displayed pose',()=>{
  const {f}=gesture({roll:35,yaw:35},650,{rollYawCombinedMaxDeg:60,totalCombinedMaxDeg:70});
  assert.ok(Math.hypot(f.desired.roll,f.desired.yaw)>20*R);
  f.setOptions({rollYawCombinedMaxDeg:20});
  assert.ok(Math.hypot(f.desired.roll,f.desired.yaw)<=20*R+1e-9);
  assert.ok(Math.hypot(f.display.roll,f.display.yaw)<=20*R+1e-9);
});
