import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readStandardGamepad, deadzonePair} from '../gamepad-input.js';
import {parseDualSenseMotion} from '../motion-input.js';
function fakeGamepad(){return {connected:true,mapping:'standard',index:2,id:'Sample',buttons:Array.from({length:17},()=>({value:0,pressed:false})),axes:[0,0,0,0]};}
test('standard gamepad maps multiple simultaneous face and D-pad buttons',()=>{
  const p=fakeGamepad();p.buttons[0]={pressed:true,value:1};p.buttons[3]={pressed:true,value:1};p.buttons[12]={pressed:true,value:1};
  p.buttons[6]={pressed:false,value:0.72};p.axes=[.5,-.5,-1,0];const out=readStandardGamepad(p);
  assert.equal(out.values.get('b1'),1);assert.equal(out.values.get('b4'),1);assert.equal(out.values.get('up'),1);assert.equal(out.values.get('l2'),.72);
  assert(out.left.amount>.4);assert.equal(out.right.y,0);assert.equal(out.index,2);
});
test('unknown mappings are not incorrectly interpreted',()=>{const p=fakeGamepad();p.mapping='';assert.equal(readStandardGamepad(p),null);});
test('deadzone removes neutral drift',()=>{assert.deepEqual(deadzonePair(.02,.04),{x:0,y:0,amount:0});});
test('DualSense USB and BT motion read from correct report offsets',()=>{
  const b=new Uint8Array(65);const v=new DataView(b.buffer);v.setInt16(15,1234,true);v.setInt16(17,-850,true);v.setInt16(19,28,true);v.setInt16(21,4096,true);v.setInt16(23,0,true);v.setInt16(25,8192,true);
  const usb=parseDualSenseMotion(0x01,new DataView(b.buffer,0,63));assert.deepEqual(usb.gyroRaw,[1234,-850,28]);assert.deepEqual(usb.accelG,[.5,0,1]);
  const shifted=new Uint8Array(65);shifted.set(b.subarray(0,63),1);
  const bt=parseDualSenseMotion(0x31,new DataView(shifted.buffer));assert.deepEqual(bt.gyroRaw,usb.gyroRaw);assert.deepEqual(bt.accelG,usb.accelG);
  assert.equal(parseDualSenseMotion(0x01,new DataView(new ArrayBuffer(10))),null);
  assert.equal(parseDualSenseMotion(0x11,new DataView(b.buffer)),null);
});
