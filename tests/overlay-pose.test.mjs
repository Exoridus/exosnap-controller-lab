import test from 'node:test';
import assert from 'node:assert/strict';
import {overlayOrientation, eulerQuaternion, eulerAngles} from '../overlay-motion.js';
const RAD=Math.PI/180;
const near=(a,b,eps=1e-4)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('neutral table calibration is shown front-facing in overlay mode, not edge-on',()=>{
  const q=overlayOrientation({x:0,y:0,z:0,w:1},'overlay');
  assert.deepEqual(q,{x:0,y:0,z:0,w:1});
});
test('overlay jointly clamps three axes and retains each requested sign',()=>{
  const q=eulerQuaternion({pitch:45*RAD,yaw:-40*RAD,roll:40*RAD});
  const limited=eulerAngles(overlayOrientation(q,'overlay'));
  assert.ok(Math.hypot(limited.pitch,limited.yaw,limited.roll)<=25.01*RAD);
  assert.ok(limited.pitch>0 && limited.yaw<0 && limited.roll>0);
});
test('360 mode keeps full quaternion including turning controller upside down',()=>{
  const q=eulerQuaternion({pitch:Math.PI,yaw:.1,roll:-.15});
  assert.deepEqual(overlayOrientation(q,'free'),q);
});
test('overlay maps separate axis rotations correctly with no sign inversions',()=>{
  for(const axis of ['pitch','yaw','roll']){
    const src={pitch:0,yaw:0,roll:0};src[axis]=.25;
    const e=eulerAngles(overlayOrientation(eulerQuaternion(src),'overlay'));
    for(const key of ['pitch','yaw','roll'])near(e[key],src[key]);
  }
});
