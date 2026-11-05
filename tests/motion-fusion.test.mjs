import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionFusion, parseDualSenseFactoryCalibration } from '../motion-input.js';

const accel = (x=0,y=0,z=-1) => ({
  gyroRaw:[13,-6,8], accelRaw:[Math.round(x*8192),Math.round(y*8192),Math.round(z*8192)],
  accelG:[x,y,z]
});

function stableCalibration(fusion, pose='flat', motion=accel()) {
  fusion.startCalibration(pose,0);
  for(let t=0;t<=1500;t+=10)fusion.update(motion,t);
  return fusion;
}

test('no controller motion until a stable reference pose has been calibrated',()=>{
  const f=new MotionFusion();
  const first=f.update(accel(),20);
  assert.equal(first.ready,false);
  assert.equal(first.status,'uncalibrated');
  const done=stableCalibration(f);
  assert.equal(done.ready,true);
  assert.equal(done.status,'ready');
  const q=done.orientation;
  assert.ok(Math.abs(q.x)<1e-4 && Math.abs(q.y)<1e-4 && Math.abs(q.z)<1e-4);
  assert.ok(Math.abs(q.w-1)<1e-4);
});

test('flat or upright calibration accepts a measured, stable neutral position',()=>{
  const flat=stableCalibration(new MotionFusion(),'flat',accel(0,-1,0));
  assert.equal(flat.ready,true);
  const upright=stableCalibration(new MotionFusion(),'upright',accel(0,-1,0));
  assert.equal(upright.ready,true);
});

test('stationary gyro bias cannot rotate the model at rest',()=>{
  const f=stableCalibration(new MotionFusion());
  for(let t=1510;t<=5000;t+=10)f.update(accel(),t);
  const q=f.orientation;
  assert.ok(Math.abs(q.x)<0.01 && Math.abs(q.y)<0.01 && Math.abs(q.z)<0.01);
});

test('gyro input rotates relative orientation; recenter resets output to neutral',()=>{
  const f=stableCalibration(new MotionFusion());
  for(let t=1510;t<2500;t+=10)f.update({...accel(),gyroRaw:[13+Math.round(16.384*40),-6,8]},t);
  const q=f.orientation;
  assert.ok(Math.abs(q.x)>0.02 || Math.abs(q.y)>0.02 || Math.abs(q.z)>0.02);
  f.recenter();
  const neutral=f.orientation;
  assert.ok(Math.abs(neutral.x)<1e-4 && Math.abs(neutral.y)<1e-4 && Math.abs(neutral.z)<1e-4 && Math.abs(neutral.w-1)<1e-4);
});

test('Sony factory feature report is parsed using documented offsets',()=>{
  const v=new DataView(new ArrayBuffer(40));
  const put=(o,n)=>v.setInt16(o,n,true);
  [0,2,4].forEach(o=>put(o,0));
  [6,10,14].forEach(o=>put(o,1000));
  [8,12,16].forEach(o=>put(o,-1000));
  put(18,90);put(20,90);
  [22,26,30].forEach(o=>put(o,8192));
  [24,28,32].forEach(o=>put(o,-8192));
  const parsed=parseDualSenseFactoryCalibration(v);
  assert.ok(parsed);
  assert.ok(Math.abs(parsed.gyroDpsPerCount[0]-0.09)<0.001);
  assert.ok(Math.abs(parsed.accelGPerCount[0]-(1/8192))<0.000001);
  assert.equal(parseDualSenseFactoryCalibration(new DataView(new ArrayBuffer(8))),null);
});

test('flat resting controller does not jump 180 degrees when accelerometer Y changes sign',()=>{
  const f=stableCalibration(new MotionFusion());
  let largest=0;
  for(let t=1510;t<3500;t+=10){
    const y=(t%20===0?.004:-.004);
    f.update({...accel(0,y,-Math.sqrt(1-y*y)),gyroRaw:[13,-6,8]},t);
    const q=f.orientation;
    const degrees=2*Math.acos(Math.min(1,Math.abs(q.w)))*180/Math.PI;
    largest=Math.max(largest,degrees);
  }
  assert.ok(largest<5,`incorrect 180-degree sensor flip: ${largest.toFixed(2)}°`);
});

test('neutral calibration can be repeated from upright to flat without residual orientation',()=>{
  const f=stableCalibration(new MotionFusion(),'upright',accel(0,-1,0));
  assert.equal(f.status,'ready');
  f.startCalibration('flat',2000);
  for(let t=2010;t<=3500;t+=10)f.update(accel(),t);
  assert.equal(f.status,'ready');
  assert.ok(Math.abs(f.orientation.w-1)<1e-6);
});

test('learned real gyro axis changes pitch instead of yaw or roll',()=>{
  const f=stableCalibration(new MotionFusion(),'flat',accel());
  f.setAxisMapping([{index:1,sign:-1},{index:2,sign:-1},{index:0,sign:1}]);
  for(let t=1510;t<=1900;t+=10)f.update({...accel(),gyroRaw:[13,-6-Math.round(16.384*65),8]},t);
  const q=f.orientation;
  assert.ok(q.x>.1,`pitch must be positive: ${JSON.stringify(q)}`);
  assert.ok(Math.abs(q.y)<.05 && Math.abs(q.z)<.05,`cross-axis leakage: ${JSON.stringify(q)}`);
});

test('re-mapping gyro also re-maps the neutral gravity reference at rest',()=>{
  const f=stableCalibration(new MotionFusion(),'flat',accel());
  f.setAxisMapping([{index:1,sign:-1},{index:2,sign:-1},{index:0,sign:1}]);
  for(let t=1510;t<=2400;t+=10)f.update(accel(),t);
  const q=f.orientation;
  assert.ok(Math.abs(q.x)<.02 && Math.abs(q.y)<.02 && Math.abs(q.z)<.02);
});

test('guided alignment makes right-grip lift a roll, not a yaw',()=>{
  const f=stableCalibration(new MotionFusion(),'flat',accel());
  f.setAxisMapping([{index:1,sign:-1},{index:2,sign:-1},{index:0,sign:1}]);
  for(let t=1510;t<=1850;t+=10)f.update({...accel(),gyroRaw:[13,-6,8+Math.round(16.384*65)]},t);
  const q=f.orientation;
  assert.ok(q.y<-.1,`roll expected, got ${JSON.stringify(q)}`);
  assert.ok(Math.abs(q.x)<.05 && Math.abs(q.z)<.05);
});

test('guided alignment makes turning the shoulders left a yaw, not a roll',()=>{
  const f=stableCalibration(new MotionFusion(),'flat',accel());
  f.setAxisMapping([{index:1,sign:-1},{index:2,sign:-1},{index:0,sign:1}]);
  for(let t=1510;t<=1850;t+=10)f.update({...accel(),gyroRaw:[13+Math.round(16.384*65),-6,8]},t);
  const q=f.orientation;
  assert.ok(q.z>.1,`yaw expected, got ${JSON.stringify(q)}`);
  assert.ok(Math.abs(q.x)<.05 && Math.abs(q.y)<.05);
});
