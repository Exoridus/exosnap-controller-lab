import test from 'node:test';
import assert from 'node:assert/strict';
import {WebHidMotionSession} from '../sensor-session.js';

const device={vendorId:0x054c,productId:0x0ce6,productName:'DualSense',opened:true,
  async receiveFeatureReport(){return new DataView(new ArrayBuffer(0));},async close(){this.opened=false;}};

test('existing WebHID motion session also emits fresh button release states for the same Sony report',async()=>{
  const seen=[];
  const session=new WebHidMotionSession(device,{onSample:()=>{},onInput:(state,at)=>seen.push({state,at})});
  await session.start();
  const pressed=new Uint8Array(63);pressed.set([128,128,128,128]);pressed[7]=8;pressed[8]=0x40;
  session.handleInput({device,reportId:0x01,data:new DataView(pressed.buffer)});
  const released=Uint8Array.from(pressed);released[8]=0;
  session.handleInput({device,reportId:0x01,data:new DataView(released.buffer)});
  assert.equal(seen.length,2);
  assert.equal(seen[0].state.values.get('ls'),1);
  assert.equal(seen[1].state.values.has('ls'),false);
  assert.ok(seen[0].at>=0);
  await session.close();
});
