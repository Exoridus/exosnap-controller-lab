import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDualSenseFactoryCalibration, normalizeDualSenseSensorSample, MotionFusion } from '../motion-input.js';

const RAD=Math.PI/180;
const G=9.80665;
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function factoryFixture({idByte=false,largeBias=false,badSensitivity=false}={}){
  const bytes=new Uint8Array(idByte?41:40);
  const offset=idByte?1:0;
  if(idByte)bytes[0]=0x05;
  const d=new DataView(bytes.buffer,offset);
  const write=(n,value)=>d.setInt16(n,value,true);
  [100,-50,25].forEach((v,i)=>write(i*2,i===0&&largeBias?1500:v));
  const deltas=badSensitivity?[100,2880,2880]:[2880,2880,2880];
  for(let i=0;i<3;i++){
    write(6+4*i,Math.floor(deltas[i]/2));
    write(8+4*i,-Math.floor(deltas[i]/2));
  }
  write(18,90);write(20,90);
  for(let i=0;i<3;i++){
    const bias=[100,-40,50][i];
    write(22+4*i,bias+8192);
    write(24+4*i,bias-8192);
  }
  return new DataView(bytes.buffer);
}
const sample=(gyroRaw,accelRaw)=>({gyroRaw,accelRaw,sensorTimestamp:null});

test('matches SDL3 calibrated gyro in rad/s and accelerometer in m/s², including hardware biases',()=>{
  const calibration=parseDualSenseFactoryCalibration(factoryFixture());
  assert.ok(calibration,'valid 0x05 payload must be accepted');
  const physical=normalizeDualSenseSensorSample(sample([116,-50,25],[8292,-40,50]),calibration);
  near(physical.gyroRadS[0], RAD);
  near(physical.gyroRadS[1],0);
  near(physical.accelMS2[0],G);
  near(physical.accelMS2[1],0);
  assert.equal(physical.source,'factory');
});

test('WebHID body and report-id-prefixed HID feature yield equivalent calibration',()=>{
  const a=parseDualSenseFactoryCalibration(factoryFixture());
  const b=parseDualSenseFactoryCalibration(factoryFixture({idByte:true}));
  assert.deepEqual(a,b);
});

test('rejects a corrupt factory bias or implausible sensitivity rather than silently using it',()=>{
  assert.equal(parseDualSenseFactoryCalibration(factoryFixture({largeBias:true})),null);
  assert.equal(parseDualSenseFactoryCalibration(factoryFixture({badSensitivity:true})),null);
});

test('SDL3 fallback is explicitly tagged and uses 64/1024 deg per count and 8192 counts/g',()=>{
  const data=normalizeDualSenseSensorSample(sample([16,0,0],[0,8192,0]),null);
  near(data.gyroRadS[0],RAD);
  near(data.accelMS2[1],G);
  assert.equal(data.source,'fallback');
});

test('motion fusion integrates physical calibrated rates after removing only residual stationary bias',()=>{
  const f=new MotionFusion();
  f.setFactoryCalibration(parseDualSenseFactoryCalibration(factoryFixture()));
  f.startCalibration('flat',0);
  const stationary=sample([100,-50,25],[100,-40,50-8192]);
  for(let t=10;t<=1500;t+=10)f.update(stationary,t);
  assert.equal(f.ready,true);
  near(f.rawDps(sample([116,-50,25],[100,-40,50-8192]))[0],1,0.001);
  const metrics=f.sensorValues(sample([116,-50,25],[100,-40,50-8192]));
  near(metrics.gyroRadS[0],RAD,0.0001);
  assert.equal(metrics.source,'factory');
});
