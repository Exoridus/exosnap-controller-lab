import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identifyMotionProfile, motionFilters, parseDualShock4Motion,
  parseDualShock4Calibration, normalizeDualShock4,
  parseSwitchMotion, parseSwitchImuCalibration, normalizeSwitchMotion,
  switchSubcommandPacket, parseSwitchSpiReply,
} from '../sensor-profiles.js';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const G=9.80665, RAD=Math.PI/180;
test('profile registry uses real vendor/product IDs; no invented motion for Xbox',()=>{
  assert.equal(identifyMotionProfile({vendorId:0x054c,productId:0x0ce6}).id,'dualsense');
  assert.equal(identifyMotionProfile({vendorId:0x054c,productId:0x0df2}).id,'dualsense');
  assert.equal(identifyMotionProfile({vendorId:0x054c,productId:0x05c4}).id,'ds4');
  assert.equal(identifyMotionProfile({vendorId:0x054c,productId:0x09cc}).id,'ds4');
  assert.equal(identifyMotionProfile({vendorId:0x057e,productId:0x2009}).id,'switch');
  assert.equal(identifyMotionProfile({vendorId:0x057e,productId:0x2006}).id,'joycon-left');
  assert.equal(identifyMotionProfile({vendorId:0x057e,productId:0x2007}).id,'joycon-right');
  assert.equal(identifyMotionProfile({vendorId:0x045e,productId:0x0b12}),null);
  assert.equal(motionFilters().length,7);
});

test('DualShock4 USB/BT motion uses native SDL packet offsets, not DualSense offsets',()=>{
  const bytes=new Uint8Array(63),dv=new DataView(bytes.buffer);
  [1200,-700,300].forEach((x,i)=>dv.setInt16(12+i*2,x,true));
  [100,8192,-200].forEach((x,i)=>dv.setInt16(18+i*2,x,true));
  dv.setUint16(9,4400,true);
  let s=parseDualShock4Motion(0x01,dv);
  assert.deepEqual(s.gyroRaw,[1200,-700,300]);
  assert.deepEqual(s.accelRaw,[100,8192,-200]);
  assert.equal(s.sensorClockHz,187500);
  const bt=new Uint8Array(77);bt.set(bytes,2);
  assert.deepEqual(parseDualShock4Motion(0x11,new DataView(bt.buffer)).gyroRaw,s.gyroRaw);
  assert.equal(parseDualShock4Motion(0x31,dv),null);
});

test('DualShock4 factory gyro calibration and fallback yield SDL physical rad/s and m/s²',()=>{
  const bytes=new Uint8Array(37),dv=new DataView(bytes.buffer);bytes[0]=0x02;
  const w=(offset,value)=>dv.setInt16(offset,value,true);
  [50,-25,8].forEach((v,i)=>w(1+2*i,v));
  // USB report order: pitch +/-, yaw +/-, roll +/-, speed +/-, accel +/-.
  for(let i=0;i<3;i++){w(7+i*4,1600);w(9+i*4,-1600);}
  w(19,100);w(21,100);
  for(let i=0;i<3;i++){w(23+i*4,8192);w(25+i*4,-8192);}
  const cal=parseDualShock4Calibration(dv,{bluetooth:false,reportIdIncluded:true});
  assert.ok(cal);
  // Chrome WebHID returns the same report without the one-byte report ID.
  assert.deepEqual(parseDualShock4Calibration(new DataView(bytes.buffer,1,36)),cal);
  const converted=normalizeDualShock4({gyroRaw:[66,-25,8],accelRaw:[0,8192,0]},cal);
  near(converted.gyroRadS[0],RAD);
  near(converted.accelMS2[1],G);
  assert.equal(converted.source,'factory');
  const fallback=normalizeDualShock4({gyroRaw:[16,0,0],accelRaw:[0,8192,0]},null);
  near(fallback.gyroRadS[0],RAD);
  near(fallback.accelMS2[1],G);
  assert.equal(fallback.source,'fallback');
});

test('Switch 0x30 contains three independent IMU samples, with SDL axis mapping and Nintendo scale',()=>{
  const bytes=new Uint8Array(49),dv=new DataView(bytes.buffer);
  for(let i=0;i<3;i++){
    const base=12+i*12;
    [4096,0,0].forEach((v,j)=>dv.setInt16(base+j*2,v,true));
    [0,1428,0].forEach((v,j)=>dv.setInt16(base+6+j*2,v,true));
  }
  const s=parseSwitchMotion(0x30,dv);
  assert.equal(s.length,3);
  assert.deepEqual(s[2].gyroRaw,[0,1428,0]);
  const physical=normalizeSwitchMotion(s[0],null,'switch');
  // Nintendo raw Y is SDL gyro X with negative sign.
  near(physical.gyroRadS[0], -1428/14.2842*RAD, 0.01);
  near(physical.accelMS2[2],-G);
  assert.equal(parseSwitchMotion(0x21,dv),null);
});

test('Switch SPI factory report decodes six IMU sensor coefficients; right Joycon flips axes',()=>{
  const raw=new Uint8Array(24),dv=new DataView(raw.buffer);
  [0,0,0,16384,16384,16384,0,0,0,13400,13400,13400].forEach((v,i)=>dv.setInt16(i*2,v,true));
  const cal=parseSwitchImuCalibration(dv);
  assert.ok(cal);
  const s={gyroRaw:[0,1340,0],accelRaw:[4096,0,0]};
  const left=normalizeSwitchMotion(s,cal,'joycon-left');
  const right=normalizeSwitchMotion(s,cal,'joycon-right');
  near(left.gyroRadS[0],-1340*936/13400*RAD);
  near(right.gyroRadS[0],-left.gyroRadS[0]);
});

test('Nintendo WebHID subcommand uses 8 neutral rumble bytes and parses address-checked SPI reply',()=>{
  const packet=switchSubcommandPacket(0x10,[0x20,0x60,0,0,24],7);
  assert.equal(packet.length,49);
  assert.equal(packet[0],7);
  assert.equal(packet[9],0x10);
  assert.deepEqual(Array.from(packet.slice(10,15)),[0x20,0x60,0,0,24]);
  const resp=new Uint8Array(49);
  resp[13]=0x90;resp[14]=0x10;
  resp[15]=0x20;resp[16]=0x60;resp[19]=24;
  resp.fill(4,20,44);
  const result=parseSwitchSpiReply(0x21,new DataView(resp.buffer),0x6020,24);
  assert.equal(result.length,24);
  assert.equal(result[0],4);
  assert.equal(parseSwitchSpiReply(0x21,new DataView(resp.buffer),0x8026,24),null);
});

test('Nintendo optional 0x8026 user calibration overrides gyro zero offsets but retains factory scales', async()=>{
  const {applySwitchUserCalibration}=await import('../sensor-profiles.js');
  const factory={gyroBias:[0,0,0],gyroRadSPerCount:[.001,.002,.003],accelMS2PerCount:[.001,.001,.001]};
  const bytes=new Uint8Array(20),view=new DataView(bytes.buffer);
  view.setUint16(0,0xa1b2,true);
  [8,-13,27].forEach((v,i)=>view.setInt16(14+2*i,v,true));
  const result=applySwitchUserCalibration(factory,view);
  assert.deepEqual(result.gyroBias,[8,-13,27]);
  assert.deepEqual(result.gyroRadSPerCount,factory.gyroRadSPerCount);
  assert.equal(result.source,'user');
  assert.deepEqual(applySwitchUserCalibration(factory,new DataView(new ArrayBuffer(19))),factory);
});
