import test from 'node:test';
import assert from 'node:assert/strict';
import { PostureTransitionGuard } from '../posture-transition.js';
import { HandheldOverlayMotion, eulerQuaternion, eulerAngles } from '../overlay-motion.js';
const g=9.80665, D=Math.PI/180;
const Q={x:0,y:0,z:0,w:1};
const sample=(tiltDeg=0,gyroDps=0,now=0,activeInput=false)=>({
  now,activeInput,
  accelMS2:[0,g*Math.cos(tiltDeg*D),g*Math.sin(tiltDeg*D)],
  gyroRadS:[gyroDps*D,0,0]
});
const still=(guard,angle,start,end,step=10,activeInput=false)=>{
  let result;
  for(let t=start;t<=end;t+=step)result=guard.update(sample(angle,0,t,activeInput));
  return result;
};
test('flat rest becomes a tabletop anchor only after a stable dwell',()=>{
  const guard=new PostureTransitionGuard();
  let first=guard.update(sample(0,0,0));
  assert.equal(first.rebase,false);
  const late=still(guard,0,10,900);
  assert.equal(late.posture,'table');
  assert.equal(late.hold,false);
  assert.equal(late.rebase,false,'reference is captured once, not repeatedly');
});
test('lifting after table rest is suppressed, then rebased once in normal handheld position',()=>{
  const guard=new PostureTransitionGuard();still(guard,0,0,900);
  const motion=guard.update(sample(12,24,920));
  assert.equal(motion.hold,true,'pickup must not drive the overlay pitch');
  const stable=still(guard,16,940,1550);
  assert.equal(stable.posture,'hand');
  assert.equal(stable.hold,false);
  assert.equal(stable.rebase,false);
  assert.equal(guard.update(sample(17,0,1570)).rebase,false);
});
test('placing the controller back on the table also rebases without accumulating tilt debt',()=>{
  const guard=new PostureTransitionGuard();still(guard,0,0,900);
  guard.update(sample(15,30,930));still(guard,15,940,1500);
  const back=guard.update(sample(6,20,1540));
  assert.equal(back.hold,true);
  const stable=still(guard,1,1550,2200);
  assert.equal(stable.posture,'table');
  assert.equal(stable.hold,false);
});
test('deliberate motion while pressing gamepad inputs is never misread as pickup',()=>{
  const guard=new PostureTransitionGuard();still(guard,0,0,900);
  const r=guard.update(sample(17,25,930,true));
  assert.equal(r.hold,false);
  assert.equal(r.rebase,false);
});
test('a held controller can be tilted and left stationary without unwanted auto-recenter',()=>{
  const guard=new PostureTransitionGuard();still(guard,15,0,1000);
  const moved=guard.update(sample(27,25,1010));
  assert.equal(moved.hold,false);
  const stable=still(guard,27,1020,3200);
  assert.equal(stable.posture,'hand');
  assert.equal(stable.rebase,false);
});
test('bad sensor values never cause a false posture transition',()=>{
  const guard=new PostureTransitionGuard();still(guard,0,0,900);
  const invalid=guard.update({now:930,accelMS2:[NaN,NaN,NaN],gyroRadS:[0,0,0]});
  assert.equal(invalid.hold,false);
  assert.equal(invalid.rebase,false);
});
test('rebase of handheld motion preserves display continuity and removes stored tilt',()=>{
  const motion=new HandheldOverlayMotion({responseMs:50,deadzoneDeg:0,autoReturn:false});
  motion.update(Q,0);
  const tilt=eulerQuaternion({pitch:19*D});
  for(let t=10;t<=450;t+=10)motion.update(eulerQuaternion({pitch:19*D*t/250>19*D?19*D:19*D*t/250}),t);
  const before=eulerAngles(motion.orientation).pitch;
  motion.rebase(tilt,460);
  const after=eulerAngles(motion.orientation).pitch;
  assert.ok(Math.abs(before-after)<.01,'no sudden jump at pose rebase');
  assert.ok(Math.abs(motion.desired.pitch)<1e-7,'old integrated pitch must be cleared');
  for(let t=470;t<=850;t+=10)motion.update(tilt,t);
  assert.ok(Math.abs(eulerAngles(motion.orientation).pitch-(-12*D))<.05,'smoothly converge to held neutral');
  motion.update(eulerQuaternion({pitch:23*D}),860);
  assert.ok(motion.desired.pitch>0,'subsequent physical pitch movement immediately follows rebase');
});

test('releasing a pressed button while holding a deliberate tilt does not start a delayed auto-recenter',()=>{
  const guard=new PostureTransitionGuard();still(guard,0,0,900);
  // Intentional gyro gesture with a pressed button: keep this pose after release.
  guard.update(sample(17,24,910,true));
  guard.update(sample(17,0,925,true));
  const released=guard.update(sample(17,0,940,false));
  const later=still(guard,17,950,2500);
  assert.equal(released.hold,false);
  assert.equal(later.posture,'table','table anchor is retained until a *new* pickup gesture');
  assert.equal(later.rebase,false);
});

test('pickup freezes the overlay early, before the controller visibly tips forward',()=>{
  const guard=new PostureTransitionGuard();still(guard,0,0,850);
  const early=guard.update(sample(5,17,870));
  assert.equal(early.hold,true,'start posture transfer around 5 degrees, not after the full hand tilt');
});

test('successful one-second neutral calibration immediately establishes the tabletop state',()=>{
  const guard=new PostureTransitionGuard();
  const ready=guard.update({...sample(0,0,1100),knownStable:true});
  assert.equal(ready.posture,'table');
  assert.equal(ready.rebase,true);
  assert.equal(guard.update(sample(5,18,1140)).hold,true,'pickup right after calibration should be compensated');
});

test('full pickup and setdown sequence stays close to the hand overlay neutral pose',()=>{
  const guard=new PostureTransitionGuard();
  const overlay=new HandheldOverlayMotion({deadzoneDeg:0,responseMs:50,autoReturn:false});
  let maxDeviation=0;
  const step=(t,deg,rate)=>{
    const change=guard.update(sample(deg,rate,t));
    const q=eulerQuaternion({pitch:deg*D});
    if(change.rebase)overlay.rebase(q,t);
    const rendered=change.hold?overlay.orientation:overlay.update(q,t);
    const displayed=eulerAngles(rendered).pitch/D;
    const deviation=Math.abs(displayed+12);
    maxDeviation=Math.max(maxDeviation,deviation);
    return {change,deviation};
  };
  for(let t=0;t<=850;t+=10)step(t,0,0);
  for(let t=860;t<=1160;t+=10)step(t,(t-850)*16/310,16/0.310);
  for(let t=1170;t<=1800;t+=10)step(t,16,0);
  const held=eulerAngles(overlay.orientation).pitch/D;
  assert.ok(Math.abs(held+12)<.7,`pickup should settle at held neutral: ${held}`);
  for(let t=1810;t<=2110;t+=10)step(t,Math.max(0,16-(t-1800)*16/310),-16/.310);
  for(let t=2120;t<=2800;t+=10)step(t,0,0);
  const flat=eulerAngles(overlay.orientation).pitch/D;
  assert.ok(Math.abs(flat+12)<.7,`setdown should settle at held neutral: ${flat}`);
  assert.ok(maxDeviation<12,`pose transition still caused a large visual pitch: ${maxDeviation.toFixed(1)}°`);
});

test('brief high linear acceleration during pickup does not momentarily unfreeze the overlay',()=>{
  const guard=new PostureTransitionGuard();still(guard,0,0,850);
  assert.equal(guard.update(sample(5,20,870)).hold,true);
  const noisy=guard.update({now:885,accelMS2:[0,2.1*g,0],gyroRadS:[10*D,0,0]});
  assert.equal(noisy.hold,true,'brief acceleration spike must not expose the mid-pickup pitch');
  assert.equal(guard.update(sample(14,18,900)).hold,true);
});
