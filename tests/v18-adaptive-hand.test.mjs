import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveHandReference} from '../adaptive-hand-reference.js';
import {HandheldOverlayMotion, eulerQuaternion, eulerAngles} from '../overlay-motion.js';
import {presentationOrientation} from '../motion-render-policy.js';
import {MOTION_TUNING_PRESETS, sanitizeMotionTuning, loadMotionTuning, saveMotionTuning} from '../motion-tuning.js';
const deg=Math.PI/180;
const qPitch=d=>eulerQuaternion({pitch:d*deg});
const pitchDeg=q=>eulerAngles(q).pitch/deg;
const quiet={gyroRadS:[0,0,0],accelMS2:[0,9.80665,0],activeInput:false};
const moving={gyroRadS:[2,0,0],accelMS2:[0,9.80665,0],activeInput:false};

// Regression: the previous postureHold branch suppressed orientation updates for up to 2.6 s.
test('presentation never freezes live motion when old posture guard would hold',()=>{
  const motion=new HandheldOverlayMotion({deadzoneDeg:0,responseMs:25,autoReturn:false});
  const adapt=new AdaptiveHandReference();
  presentationOrientation({mode:'overlay',relative:qPitch(0),now:0,motion,adaptive:adapt,postureHold:true});
  const result=presentationOrientation({mode:'overlay',relative:qPitch(14),now:120,motion,adaptive:adapt,postureHold:true});
  assert.ok(pitchDeg(result)>-8,`pitch must move: ${pitchDeg(result)}`);
});

test('60-slot timestamped ring keeps about one second even at 240Hz input',()=>{
  const f=new AdaptiveHandReference();
  for(let now=0;now<=2000;now+=4)f.push(qPitch(4),now,quiet);
  assert.ok(f.history.length>40 && f.history.length<=60,f.history.length);
  assert.ok(f.history.at(-1).now-f.history[0].now>800,'roughly one second of history');
  assert.ok(f.history.at(-1).now-f.history[0].now<=1000);
});

test('first report establishes reference without misreading the resting hand angle as motion',()=>{
  const f=new AdaptiveHandReference();
  f.push(qPitch(16),0,quiet);
  assert.ok(Math.abs(pitchDeg(f.corrected(qPitch(16))))<.01);
});

test('quick motion passes through without waiting for 60 samples or a stable posture',()=>{
  const f=new AdaptiveHandReference();
  f.push(qPitch(0),0,quiet);
  const fast=f.corrected(qPitch(15));
  assert.ok(Math.abs(pitchDeg(fast)-15)<.1);
  f.push(qPitch(15),40,moving);
  assert.ok(Math.abs(pitchDeg(f.corrected(qPitch(15)))-15)<.1);
});

test('stable changed grip gradually moves reference without freezing presentation',()=>{
  const f=new AdaptiveHandReference();
  f.push(qPitch(0),0,quiet);
  const afterLift=qPitch(16);
  for(let now=20;now<=450;now+=20)f.push(afterLift,now,moving);
  const before=pitchDeg(f.corrected(afterLift));
  assert.ok(before>15.5,`before stable ${before}`);
  for(let now=470;now<=3500;now+=20)f.push(afterLift,now,quiet);
  const after=pitchDeg(f.corrected(afterLift));
  assert.ok(after>1 && after<9,`slowly adapting, not instant: ${after}`);
});

test('intentional motion with active gamepad input does not recenter the reference',()=>{
  const f=new AdaptiveHandReference();
  f.push(qPitch(0),0,quiet);
  for(let now=20;now<4500;now+=20)f.push(qPitch(12),now,{...quiet,activeInput:true});
  assert.ok(pitchDeg(f.corrected(qPitch(12)))>11);
});

test('invalid / missing IMU samples cannot block rendering or poison baseline',()=>{
  const f=new AdaptiveHandReference();
  f.push(qPitch(0),0,quiet);
  f.push(qPitch(15),20,{gyroRadS:[NaN,0,0],accelMS2:[0,0,0]});
  f.push(qPitch(16),40,{});
  assert.ok(pitchDeg(f.corrected(qPitch(16)))>15.8);
});

test('experimental preset is explicitly opt-in and uses 60 / 0.5s / 2s / 45ms / 20deg',()=>{
  const o=MOTION_TUNING_PRESETS.adaptive60;
  assert.equal(o.adaptiveHand,true);
  assert.equal(o.autoReturn,false);
  assert.equal(o.responseMs,45);
  assert.equal(o.totalCombinedMaxDeg,20);
  assert.equal(sanitizeMotionTuning().adaptiveHand,false);
  const reference=new AdaptiveHandReference();
  assert.equal(reference.capacity,60);
  assert.equal(reference.stableMs,500);
  assert.equal(reference.halfLifeMs,2000);
});

test('legacy stored v17 settings remain while obsolete hold is not automatically enabled',()=>{
  const kv=new Map(); const store={getItem:k=>kv.get(k)??null,setItem:(k,v)=>kv.set(k,v)};
  kv.set('exosnap-controller3d-motion-tuning-v2',JSON.stringify({yawGain:.44,autoPostureSwitch:true,autoReturn:false}));
  const o=loadMotionTuning(store);
  assert.equal(o.yawGain,.44);
  assert.equal(o.adaptiveHand,false);
  assert.equal(saveMotionTuning(store,{...o,adaptiveHand:true}),true);
  assert.equal(loadMotionTuning(store).adaptiveHand,true);
});

test('integrated adaptive handhold: instant pitch onset, then slow settling without pauses',()=>{
  const motion=new HandheldOverlayMotion({...MOTION_TUNING_PRESETS.adaptive60,deadzoneDeg:0});
  const tracker=new AdaptiveHandReference();
  let initial=null,fast=null,after=null;
  for(let now=0;now<=3500;now+=20){
    const pose=now<100?qPitch(0):qPitch(20);
    const sensors=now<500?moving:quiet;
    tracker.push(pose,now,sensors);
    const displayed=presentationOrientation({mode:'overlay',relative:pose,motion,adaptive:tracker,now});
    if(now===0)initial=pitchDeg(displayed);
    if(now===300)fast=pitchDeg(displayed);
    if(now===3500)after=pitchDeg(displayed);
  }
  assert.ok(fast>initial+15,`fast stage did not react: ${initial} -> ${fast}`);
  assert.ok(after<fast-10,`slow baseline never adapted: ${fast} -> ${after}`);
  assert.ok(after>-12.01,'no overshoot of the resting hand position');
});

test('direct and 360 degree modes ignore experimental hand-reference corrections',()=>{
  const motion=new HandheldOverlayMotion({...MOTION_TUNING_PRESETS.adaptive60});
  const tracker=new AdaptiveHandReference();
  tracker.push(qPitch(17),0,quiet);
  const direct=presentationOrientation({mode:'direct',relative:qPitch(12),motion,adaptive:tracker,now:10});
  const free=presentationOrientation({mode:'free',relative:qPitch(12),motion,adaptive:tracker,now:10});
  assert.ok(Math.abs(pitchDeg(free)-12)<.01);
  assert.ok(Math.abs(pitchDeg(direct)-(-12+12))<.05);
});
