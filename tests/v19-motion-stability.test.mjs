import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionFusion} from '../motion-input.js';
const g=8192;
const sample=(gyro=0)=>({gyroRaw:[0,gyro,0],accelRaw:[0,0,-g],sensorTimestamp:null});

test('steady constant YAW rotation is NOT mislearned as a zero-rate gyro offset during auto calibration',()=>{
  const fusion=new MotionFusion();fusion.startCalibration('held',0);
  // 8 deg/s = 128 raw gyro counts with the SDL fallback of 16 counts/deg/s.
  for(let t=0;t<=1700;t+=10)fusion.update(sample(128),t);
  assert.equal(fusion.ready,false,'moving controller must not be accepted as stationary');
});

test('after actual stillness, neutral calibration succeeds without requiring a specific gravity direction',()=>{
  const fusion=new MotionFusion();fusion.startCalibration('held',0);
  for(let t=0;t<=1600;t+=10)fusion.update(sample(0),t);
  assert.equal(fusion.ready,true);
});

test('small resting gyro noise does not create visible cumulative orientation drift',()=>{
  const fusion=new MotionFusion();fusion.startCalibration('held',0);
  for(let t=0;t<=1600;t+=10)fusion.update(sample(0),t);
  for(let t=1610;t<=60000;t+=10)fusion.update(sample(6),t); // ~0.375 deg/s, 1 minute
  const q=fusion.orientation;
  const angle=2*Math.acos(Math.min(1,Math.abs(q.w)))*180/Math.PI;
  assert.ok(angle<2,`resting drift=${angle.toFixed(2)} degrees`);
});
