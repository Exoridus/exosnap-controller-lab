import test from 'node:test';
import assert from 'node:assert/strict';
import {readStandardGamepad, inheritedStickControl, hasPhysicalInput} from '../gamepad-input.js';
import {matchAuthorizedSensor} from '../motion-autoconnect.js';
import {HandheldOverlayMotion, eulerQuaternion, eulerAngles, OVERLAY_LIMITS} from '../overlay-motion.js';

const R=Math.PI/180;
const ID={x:0,y:0,z:0,w:1};
const frame=(f,until,from=0,delta=16)=>{let q=f.orientation;for(let t=from+delta;t<=until;t+=delta)q=f.update(eulerQuaternion({pitch:Math.min(130,(t/1000)*130)*R}),t);return q;};
const makePad=()=>({connected:true,mapping:'standard',id:'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',index:1,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))});

test('analog trigger keeps actual pressure instead of using digital pressed flag as 100%',()=>{
  const p=makePad();p.buttons[6]={value:.37,pressed:true};p.buttons[7]={value:.82,pressed:true};
  const state=readStandardGamepad(p);
  assert.equal(state.values.get('l2'),.37);
  assert.equal(state.values.get('r2'),.82);
});
test('stick movement and button press both count as real gamepad activity',()=>{
  const p=makePad();
  assert.equal(hasPhysicalInput(readStandardGamepad(p)),false);
  p.axes[2]=.6;assert.equal(hasPhysicalInput(readStandardGamepad(p)),true);
  p.axes[2]=0;p.buttons[0]={pressed:true,value:1};
  assert.equal(hasPhysicalInput(readStandardGamepad(p)),true);
});
test('nested thumbstick cap follows the ring for blue highlighting',()=>{
  assert.equal(inheritedStickControl('left_cap.obj','ls'),'ls');
  assert.equal(inheritedStickControl('left_stick.obj','ls'),'ls');
  assert.equal(inheritedStickControl('right_cap.obj','rs'),'rs');
  assert.equal(inheritedStickControl('right_stick.obj','ls'),null);
  assert.equal(inheritedStickControl('top_shell.obj','ls'),null);
});
test('auto HID pairing selects the matching previously approved device, never a different gamepad',()=>{
  const xbox={vendorId:0x045e,productId:0x028e,productName:'Xbox Controller'};
  const dualsense={vendorId:0x054c,productId:0x0ce6,productName:'DualSense Wireless Controller'};
  assert.equal(matchAuthorizedSensor(makePad(),[xbox,dualsense]),dualsense);
  assert.equal(matchAuthorizedSensor(makePad(),[xbox]),null);
  assert.equal(matchAuthorizedSensor({id:'Generic Gamepad'},[dualsense]),null);
});
test('ambiguous previously granted HID devices do not auto-pair without an exact ID',()=>{
  const pad={id:'DualSense Wireless Controller'};
  const a={vendorId:0x054c,productId:0x0ce6,productName:'DualSense Wireless Controller'};
  const b={vendorId:0x054c,productId:0x0ce6,productName:'DualSense Wireless Controller'};
  assert.equal(matchAuthorizedSensor(pad,[a,b]),null);
});
test('held overlay remains at user-selected tilt while sensor is still (no recentring)',()=>{
  const f=new HandheldOverlayMotion();f.update(ID,0);
  const tilt=eulerQuaternion({roll:24*R});
  for(let t=16;t<=2000;t+=16)f.update(tilt,t);
  const initial=eulerAngles(f.orientation).roll;
  for(let t=2016;t<=7500;t+=16)f.update(tilt,t);
  const settled=eulerAngles(f.orientation).roll;
  assert.ok(initial>10*R);
  assert.ok(Math.abs(initial-settled)<.025,`should hold tilt ${initial/R} ${settled/R}`);
});
test('hard limit has no wind-up; reverse from beyond the limit immediately decreases desired angle',()=>{
  const f=new HandheldOverlayMotion();f.update(ID,0);
  for(let t=16;t<=1808;t+=16)f.update(eulerQuaternion({roll:Math.min(120,t/1600*120)*R}),t);
  assert.ok(Math.abs(f.desired.roll-OVERLAY_LIMITS.roll)<.005,`target should saturate ${f.desired.roll/R}`);
  // Still far outside the view limit: a small reverse movement must instantly release it.
  f.update(eulerQuaternion({roll:100*R}),1824);
  assert.ok(f.desired.roll<OVERLAY_LIMITS.roll-4*R,`should release limit without dead travel: ${f.desired.roll/R}`);
});
test('pitch has less sensitivity than direct sensor pose, without reducing the maximum range',()=>{
  const f=new HandheldOverlayMotion();f.update(ID,0);
  for(let t=16;t<=800;t+=16)f.update(eulerQuaternion({pitch:20*R*t/800}),t);
  assert.ok(f.desired.pitch>7*R && f.desired.pitch<19*R,`reduced pitch: ${f.desired.pitch/R}`);
  for(let t=816;t<=3000;t+=16)f.update(eulerQuaternion({pitch:Math.min(130,20+(t-800)*.06)*R}),t);
  assert.ok(Math.abs(f.desired.pitch-OVERLAY_LIMITS.pitch)<.025,`limit unchanged ${f.desired.pitch/R}`);
});
test('analog stick movement tilts the 3D stick but only L3 click activates its blue highlight',async()=>{
  const {controlValuesFromGamepad}=await import('../gamepad-input.js');
  const p=makePad();p.axes=[.7,-.4,0,-.9];p.buttons[1]={value:1,pressed:true};
  const controls=controlValuesFromGamepad(readStandardGamepad(p));
  assert.equal(controls.get('b2'),1);
  assert.equal(controls.has('ls'),false);
  assert.equal(controls.has('rs'),false);
  assert.ok(readStandardGamepad(p).left.amount>.55);
  assert.ok(readStandardGamepad(p).right.amount>.75);
  assert.equal(controls.get('b1'),undefined);
});

test('HID permission auto lookup only uses getDevices, not requestDevice',async()=>{
  const {findApprovedSensorForGamepad}=await import('../motion-autoconnect.js');
  const ds={vendorId:0x054c,productId:0x0ce6,productName:'DualSense'};
  let requested=0;
  const hid={async getDevices(){return [ds];},requestDevice(){requested++;throw Error('must never prompt');}};
  assert.equal(await findApprovedSensorForGamepad(makePad(),hid),ds);
  assert.equal(requested,0);
});
test('joystick caps are controls, not transparent shell pieces',async()=>{
  const {isJoystickTip}=await import('../gamepad-input.js');
  assert.equal(isJoystickTip('left_cap.obj'),true);
  assert.equal(isJoystickTip('right_cap.obj'),true);
  assert.equal(isJoystickTip('left_stick.obj'),true);
  assert.equal(isJoystickTip('top_shell.obj'),false);
});
