import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebHidMotionSession} from '../sensor-session.js';
const G=9.80665;
function fakeDevice(vendorId,productId){
  return {vendorId,productId,productName:'Test Controller',opened:false,
    collections:[],sent:[],
    async open(){this.opened=true}, async close(){this.opened=false},
    async sendReport(id,data){this.sent.push({id,data})},
    async receiveFeatureReport(id){throw Error(`feature ${id} unavailable`)}
  };
}
test('DualSense fallback streams physical units without a browser gamepad',async()=>{
  const dev=fakeDevice(0x054c,0x0ce6),results=[];
  const session=new WebHidMotionSession(dev,{onSample:(sample)=>results.push(sample)});
  await session.start();
  const buf=new ArrayBuffer(63),view=new DataView(buf);
  view.setInt16(15,16,true);view.setInt16(25,-8192,true);
  dev.oninputreport({device:dev,reportId:0x01,data:view});
  assert.equal(results.length,1);
  assert.equal(results[0].source,'fallback');
  assert.ok(Math.abs(results[0].gyroRadS[0]-Math.PI/180)<.0001);
  assert.ok(Math.abs(results[0].accelMS2[2]+G)<.0001);
  await session.close();
  assert.equal(dev.opened,false);
});
test('DS4 USB driver decodes gyroscope report and uses SDL fallback if feature unavailable',async()=>{
  const dev=fakeDevice(0x054c,0x09cc),samples=[];
  const session=new WebHidMotionSession(dev,{onSample:s=>samples.push(s)});
  await session.start();
  const bytes=new Uint8Array(63),view=new DataView(bytes.buffer);
  view.setInt16(12,16,true);view.setInt16(20,8192,true);
  dev.oninputreport({device:dev,reportId:0x01,data:view});
  assert.equal(samples.length,1);
  assert.equal(samples[0].sensorTimestampBits,16);
  assert.ok(Math.abs(samples[0].gyroRadS[0]-Math.PI/180)<.0001);
  await session.close();
});
test('Nintendo initializes motion reports and streams three physical readings with fallback',async()=>{
  const dev=fakeDevice(0x057e,0x2009),results=[];
  const session=new WebHidMotionSession(dev,{onSample:s=>results.push(s)});
  await session.start();
  assert.deepEqual(dev.sent.slice(0,2).map(x=>x.data[9]),[0x40,0x03]);
  assert.equal(dev.sent[0].data[10],1);
  assert.equal(dev.sent[1].data[10],0x30);
  const buf=new ArrayBuffer(48),view=new DataView(buf);
  for(let i=0;i<3;i++){view.setInt16(12+12*i,4096,true);view.setInt16(12+12*i+6,1000,true);}
  dev.oninputreport({device:dev,reportId:0x30,data:view});
  assert.equal(results.length,3);
  assert.ok(Math.abs(results[2].accelMS2[2]+G)<.01);
  await session.close();
});
