import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserGamepadFreshness } from '../sony-hid-gamepad.js';
import { readStandardGamepad } from '../gamepad-input.js';

test('timestamp-free browser recognizes motion between the 3D and legacy deadzones',()=>{
  const state=x=>readStandardGamepad({mapping:'standard',connected:true,id:'pad',index:0,timestamp:0,buttons:[],axes:[x,0,0,0]});
  const freshness=new BrowserGamepadFreshness();
  assert.equal(freshness.observe(state(0),0),false);
  assert.equal(freshness.observe(state(.08),20),true);
  assert.equal(freshness.observe(state(.08),500),false);
});
