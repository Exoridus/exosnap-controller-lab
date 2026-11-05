import test from 'node:test';
import assert from 'node:assert/strict';
import {HandheldOverlayMotion,eulerQuaternion,eulerAngles,overlayOrientation} from '../overlay-motion.js';
import {MOTION_TUNING_DEFAULTS, sanitizeMotionTuning, loadMotionTuning, saveMotionTuning} from '../motion-tuning.js';

const R=Math.PI/180;
const ID={x:0,y:0,z:0,w:1};
const degrees=q=>Object.fromEntries(Object.entries(eulerAngles(q)).map(([key,value])=>[key,value/R]));
function drive(axis, degreesAmount, options){
  const controller=new HandheldOverlayMotion(options);
  controller.update(ID,0);
  let pose;
  for(let t=16;t<=1600;t+=16){
    const step=Math.min(1,t/800)*degreesAmount;
    pose=controller.update(eulerQuaternion({[axis]:step*R}),t);
  }
  return {controller,pose:degrees(pose)};
}

test('new compact defaults retain fast response, equal sensitivity and disabled recenter',()=>{
  assert.equal(MOTION_TUNING_DEFAULTS.yawGain,.90);
  assert.equal(MOTION_TUNING_DEFAULTS.rollGain,.90);
  assert.equal(MOTION_TUNING_DEFAULTS.pitchGain,.90);
  assert.equal(MOTION_TUNING_DEFAULTS.yawMaxDeg,20);
  assert.equal(MOTION_TUNING_DEFAULTS.rollMaxDeg,20);
  assert.equal(MOTION_TUNING_DEFAULTS.pitchMaxDeg,20);
  assert.equal(MOTION_TUNING_DEFAULTS.autoReturn,false);
});

test('three axes use comparable high gain for isolated gestures',()=>{
  const yaw=drive('yaw',20).pose;
  const roll=drive('roll',20).pose;
  const pitch=drive('pitch',20).pose;
  assert.ok(yaw.yaw>16&&yaw.yaw<19,`yaw ${yaw.yaw}`);
  assert.ok(roll.roll>16&&roll.roll<19,`roll ${roll.roll}`);
  assert.ok(pitch.pitch>4&&pitch.pitch<8,`pitch ${pitch.pitch} (includes -12° neutral)`);
});

test('configurable yaw/roll caps are independent and reversal has no angle debt',()=>{
  const options={yawMaxDeg:12,rollMaxDeg:16, yawGain:1,rollGain:1,deadzoneDeg:0};
  const {controller,pose}=drive('yaw',90,options);
  assert.ok(Math.abs(pose.yaw-12)<.5,`yaw cap ${pose.yaw}`);
  const before=controller.desired.yaw;
  controller.update(eulerQuaternion({yaw:80*R}),1616);
  assert.ok(controller.desired.yaw<before-8*R,`reverse should release clamp ${controller.desired.yaw/R}`);
  const roll=drive('roll',50,options).pose.roll;
  assert.ok(roll>15&&roll<17,`roll cap ${roll}`);
});

test('small deadzone removes minor held motion without hiding deliberate input',()=>{
  const small=drive('yaw',.4,{deadzoneDeg:1}).pose.yaw;
  const large=drive('yaw',10,{deadzoneDeg:1}).pose.yaw;
  assert.ok(Math.abs(small)<.1,`small ${small}`);
  assert.ok(large>3,`large ${large}`);
});

test('auto return is optional; enabled recenters smoothly only after idle',()=>{
  const motion=new HandheldOverlayMotion({autoReturn:true,returnDelayMs:700});
  motion.update(ID,0);
  let sample;
  for(let t=16;t<=450;t+=16){sample=motion.update(eulerQuaternion({yaw:(t/450)*20*R}),t);}
  const before=degrees(sample).yaw;
  sample=motion.update(eulerQuaternion({yaw:20*R}),800);
  const during=degrees(sample).yaw;
  assert.ok(before>3&&Math.abs(during-before)<3,`no early return ${before} -> ${during}`);
  for(let t=816;t<=8000;t+=16)sample=motion.update(eulerQuaternion({yaw:20*R}),t);
  const after=degrees(sample).yaw;
  assert.ok(Math.abs(after)<1,`should return to center: ${after}`);
  const hold=drive('yaw',20).controller;
  assert.equal(hold.options.autoReturn,false);
  for(let t=1616;t<=6500;t+=16)hold.update(eulerQuaternion({yaw:20*R}),t);
  assert.ok(degrees(hold.orientation).yaw>9);
});

test('invalid or old persisted values are clamped; current values survive reload',()=>{
  const store=new Map();const storage={getItem:key=>store.get(key)??null,setItem:(k,v)=>store.set(k,v)};
  const want=sanitizeMotionTuning({yawGain:.42,rollMaxDeg:18,autoReturn:true,deadzoneDeg:.5});
  assert.equal(want.yawGain,.42);assert.equal(want.rollMaxDeg,18);
  assert.ok(saveMotionTuning(storage,want));
  const actual=loadMotionTuning(storage);
  assert.deepEqual(actual,want);
  const corrupted=sanitizeMotionTuning({yawGain:-100,rollMaxDeg:200,deadzoneDeg:'oops',autoReturn:'false'});
  assert.ok(corrupted.yawGain>=.1&&corrupted.rollMaxDeg<=45);
  assert.equal(corrupted.deadzoneDeg,MOTION_TUNING_DEFAULTS.deadzoneDeg);
  assert.equal(corrupted.autoReturn,false);
});

test('direct limited view accepts the same configurable limits while 360 is unchanged',()=>{
  const angle=eulerQuaternion({pitch:50*R,yaw:40*R,roll:40*R});
  const low=eulerAngles(overlayOrientation(angle,'overlay',{pitchMaxDeg:30,yawMaxDeg:18,rollMaxDeg:12,rollYawCombinedMaxDeg:70,totalCombinedMaxDeg:70}));
  assert.ok(Math.abs(low.yaw-18*R)<.03);
  assert.ok(Math.abs(low.roll-12*R)<.03);
  assert.deepEqual(overlayOrientation(angle,'free',{pitchMaxDeg:2}),angle);
});
