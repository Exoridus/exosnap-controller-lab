import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionFusion, sensorToViewer} from '../motion-input.js';
const sample=(g=[0,0,-1],gyro=[11,-5,6])=>({gyroRaw:gyro,accelRaw:g.map(x=>Math.round(x*8192)),accelG:g,sensorTimestamp:null});
function feed(f,g,pose='flat',gyro=[11,-5,6],start=0){
  f.startCalibration(pose,start);
  for(let t=start+10;t<=start+1500;t+=10)f.update(sample(g,gyro),t);
  return f;
}
test('flat and upright are calibration guidance not arbitrary axis rejection',()=>{
  const f=feed(new MotionFusion(),[0,-1,0],'flat');
  assert.ok(f.ready,`stable neutral pose incorrectly rejected: ${f.status}`);
  assert.equal(f.status,'ready');
  const upright=feed(new MotionFusion(),[0,0,-1],'upright');
  assert.ok(upright.ready);
});

test('even tilted stable neutral is accepted without forcing triggers down',()=>{
  const f=feed(new MotionFusion(),[.15,-.28,-.947],'flat');
  assert.equal(f.status,'ready');
  assert.ok(Math.abs(f.orientation.w-1)<1e-5);
});

test('gyro axes transform from Sony hardware frame to unmirrored on-screen model',()=>{
  assert.deepEqual(sensorToViewer([1,2,3]),[1,-3,2]);
  const f=feed(new MotionFusion(),[0,0,-1]);
  for(let t=1510;t<=1840;t+=10){f.update(sample([0,0,-1],[11+400,-5,6]),t);}
  assert.ok(f.orientation.x>0,`positive native pitch should map to positive screen X: ${JSON.stringify(f.orientation)}`);
});

test('calibration keeps collecting after movement then recovers without a second click',()=>{
  const f=new MotionFusion();f.startCalibration('flat',0);
  for(let t=10;t<=1450;t+=10)f.update(sample([Math.sin(t)*.8,0,-.7]),t);
  assert.equal(f.ready,false);
  for(let t=1460;t<=3150;t+=10)f.update(sample([0,0,-1]),t);
  assert.equal(f.ready,true,`did not recover: ${f.status}`);
});

test('implausible factory accelerometer scale falls back to raw 8192 counts per g',()=>{
  const f=new MotionFusion();
  f.setFactoryCalibration({gyroDpsPerCount:[.06,.06,.06],accelBias:[0,0,0],accelGPerCount:[.000055,.000055,.000055]});
  assert.ok(Math.abs(Math.hypot(...f.accel(sample([0,0,-1])))-1)<.03);
  feed(f,[0,0,-1]);
  assert.equal(f.ready,true);
});
