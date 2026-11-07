import test from 'node:test';
import assert from 'node:assert/strict';
import {fitControllerRadius} from '../pbr-camera-fit.js';
const extent={x:4.05,y:2.6,z:.7};
test('front controller is fitted near 88% view, not lost in a 55% panel',()=>{
  const radius=fitControllerRadius(extent);
  assert.ok(radius>4.5&&radius<6.8,'distance '+radius);
  const tanH=Math.tan(35*Math.PI/360)*(320/214);
  const near=radius-extent.z/2;
  const width=extent.x/(2*tanH*near);
  assert.ok(width>.80&&width<=.89,'framed width '+width);
});
test('front, angled and side views fit the eight bounds corners',()=>{
  const aspect=320/214,fov=35,tanY=Math.tan(fov*Math.PI/360),tanX=tanY*aspect;
  for(const [yaw,pitch] of [[0,0],[.52,.12],[1.5,.04]]){
    const radius=fitControllerRadius(extent,{yaw,pitch,fov,aspect,fill:.88});
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    for(const x of [-extent.x/2,extent.x/2])for(const y of [-extent.y/2,extent.y/2])
      for(const z of [-extent.z/2,extent.z/2]){
        const depth=x*cp*sy+y*sp+z*cp*cy;
        const projectedX=x*cy-z*sy;
        const projectedY=-x*sy*sp+y*cp-z*cy*sp;
        assert.ok(Math.abs(projectedX)/(tanX*(radius-depth))<=.88);
        assert.ok(Math.abs(projectedY)/(tanY*(radius-depth))<=.88);
      }
  }
});
test('rejects invalid dimensions and camera FOV',()=>{
  assert.throws(()=>fitControllerRadius({x:0,y:2,z:1}),TypeError);
  assert.throws(()=>fitControllerRadius(extent,{fov:0}),RangeError);
});
