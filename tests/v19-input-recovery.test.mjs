import test from 'node:test';
import assert from 'node:assert/strict';
import {readStandardGamepad,controlValuesFromGamepad} from '../gamepad-input.js';
import {parseSonyHidGamepad,chooseLiveGamepadInput} from '../sony-hid-gamepad.js';
import {ghostControlContourOpacity} from '../ghost-appearance.js';
import {controlFromFilename} from '../models.js';

function dualSensePacket({cross=false,l3=false,touchpad=false,lx=128,ly=128,rx=128,ry=128,lt=0,rt=0}={}){
  const b=new Uint8Array(63);
  b[0]=lx;b[1]=ly;b[2]=rx;b[3]=ry;b[4]=lt;b[5]=rt;
  b[7]=8|(cross?0x20:0); // centered D-pad + Cross
  b[8]=l3?0x40:0;
  b[9]=touchpad?0x02:0;
  return new DataView(b.buffer);
}
const fakePad=(id='DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')=>({
 connected:true,mapping:'standard',index:0,id,
 buttons:Array.from({length:18},()=>({pressed:false,value:0})),axes:[0,0,0,0],timestamp:123
});

test('DualSense USB and Bluetooth reports expose real button releases, sticks and analog triggers',()=>{
  const down=parseSonyHidGamepad('dualsense',0x01,dualSensePacket({cross:true,l3:true,touchpad:true,lx:205,ly:95,lt:100}));
  assert.ok(down);
  assert.equal(down.values.get('b1'),1);
  assert.equal(down.values.get('ls'),1);
  assert.equal(down.values.get('touchpad'),1);
  assert.ok(Math.abs(down.values.get('l2')-100/255)<1e-6);
  assert.ok(down.left.x>.3);
  const neutral=parseSonyHidGamepad('dualsense',0x01,dualSensePacket());
  for(const id of ['b1','ls','touchpad','l2'])assert.equal(neutral.values.has(id),false);
  const bt=new Uint8Array(78);bt.set(new Uint8Array(dualSensePacket({touchpad:true}).buffer),1);
  assert.equal(parseSonyHidGamepad('dualsense',0x31,new DataView(bt.buffer)).values.get('touchpad'),1);
});

test('DualShock 4 USB and BT touchpad click and L3 decode without guessing from IMU',()=>{
  const usb=new Uint8Array(63);
  usb.set([128,128,128,128,8|0x20,0x40,0x02,130,90],0);
  const state=parseSonyHidGamepad('ds4',0x01,new DataView(usb.buffer));
  assert.equal(state.values.get('b1'),1);
  assert.equal(state.values.get('ls'),1);
  assert.equal(state.values.get('touchpad'),1);
  const bt=new Uint8Array(70);bt.set(usb,2);
  assert.equal(parseSonyHidGamepad('ds4',0x11,new DataView(bt.buffer)).values.get('touchpad'),1);
});

test('fresh Sony HID input overrides a stale Gamepad API L3 press after sensor auto-connect',()=>{
  const pad=fakePad();pad.buttons[10]={pressed:true,value:1};
  const old=readStandardGamepad(pad);
  assert.equal(old.values.get('ls'),1);
  const hid=parseSonyHidGamepad('dualsense',0x01,dualSensePacket());
  const result=chooseLiveGamepadInput({standard:old,hid,hidAgeMs:16,sonyHidConnected:true});
  assert.equal(result.source,'WebHID');
  assert.equal(result.state.values.has('ls'),false);
});

test('stale HID AND an unchanging Gamepad API must clear old L3 rather than hold it',()=>{
  const pad=fakePad();pad.buttons[10]={pressed:true,value:1};
  const old=readStandardGamepad(pad);
  const result=chooseLiveGamepadInput({standard:old,hid:old,hidAgeMs:1500,sonyHidConnected:true,standardFresh:false});
  assert.equal(result.source,'stale');
  assert.equal(result.state.values.size,0);
});

test('when HID is unavailable normal Gamepad API remains usable including Sony touchpad click',()=>{
  const pad=fakePad();pad.buttons[17]={pressed:true,value:1};
  const state=readStandardGamepad(pad);
  assert.equal(state.values.get('touchpad'),1);
  assert.equal(chooseLiveGamepadInput({standard:state,sonyHidConnected:false}).source,'Gamepad API');
});

test('analog stick movement animates the stick but does not light L3/R3 without a click',()=>{
  const pad=fakePad();pad.axes=[0.8,0.3,-0.5,0.1];
  const state=readStandardGamepad(pad);
  const highlighted=controlValuesFromGamepad(state);
  assert.equal(highlighted.has('ls'),false);
  assert.equal(highlighted.has('rs'),false);
  assert.ok(state.left.amount>0.5 && state.right.amount>0.25);
  pad.buttons[10]={pressed:true,value:1};
  assert.equal(controlValuesFromGamepad(readStandardGamepad(pad)).get('ls'),1);
});

test('Ghost input contours are stronger at rest, without making controls brighter by moving a stick',()=>{
  const result=ghostControlContourOpacity(0.5);
  assert.ok(result>=.30 && result<=.60,`idle outline: ${result}`);
});

test('DualSense touchpad mesh maps to a separate click control',()=>{
  assert.equal(controlFromFilename('touchpad.obj'),'touchpad');
});

test('browser freshness only trusts events occurring after a fresh connection, not held startup state',async()=>{
  const {BrowserGamepadFreshness}=await import('../sony-hid-gamepad.js');
  const f=new BrowserGamepadFreshness();
  const pad=fakePad();pad.buttons[10]={pressed:true,value:1};
  assert.equal(f.observe(readStandardGamepad(pad),100),false,'initial held L3 is only a baseline');
  assert.equal(f.observe(readStandardGamepad(pad),150),false);
  pad.buttons[10]={pressed:false,value:0};pad.timestamp=124;
  assert.equal(f.observe(readStandardGamepad(pad),170),true);
  assert.equal(f.observe(readStandardGamepad(pad),400),true);
  assert.equal(f.observe(readStandardGamepad(pad),800),false);
  f.reset();
  assert.equal(f.observe(readStandardGamepad(pad),1000),false);
});


test('DualSense Bluetooth minimal 0x01 input reports still update buttons when full IMU packets are unavailable',()=>{
  const short=new Uint8Array(10);short.set([128,128,128,128]);short[7]=8;short[8]=0x40;
  const state=parseSonyHidGamepad('dualsense',0x01,new DataView(short.buffer));
  assert.equal(state.values.get('ls'),1);
  short[8]=0;
  assert.equal(parseSonyHidGamepad('dualsense',0x01,new DataView(short.buffer)).values.has('ls'),false);
});
