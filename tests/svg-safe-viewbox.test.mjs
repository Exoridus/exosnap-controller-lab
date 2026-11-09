import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {paddedSvgViewBox,ensureSvgSafeArea,SVG_SAFE_AREA} from '../svg-safe-viewbox.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('one safe-area expands every edge symmetrically, not the original source artwork',()=>{
  assert.deepEqual(SVG_SAFE_AREA,{horizontal:.055,vertical:.035});
  for(const [id,vb] of [
    ['dualsense',[0,0,544.706604,302.91098]],
    ['switch_pro',[0,0,419.1271667,304.54602]],
    ['joycon_right',[-23.64,0,109.5493,246.47]],
    ['generic',[60,21,1340,972.99]]
  ]){
    const padded=paddedSvgViewBox(vb);
    assert.ok(padded[0]<vb[0]&&padded[1]<vb[1],id+' padding has left/top');
    assert.ok(padded[0]+padded[2]>vb[0]+vb[2],id+' padding has right');
    assert.ok(padded[1]+padded[3]>vb[1]+vb[3],id+' padding has bottom');
    assert.ok(Math.abs((vb[0]-padded[0])-(padded[0]+padded[2]-vb[0]-vb[2]))<1e-8,id+' left/right balanced');
    assert.ok(Math.abs((vb[1]-padded[1])-(padded[1]+padded[3]-vb[1]-vb[3]))<1e-8,id+' top/bottom balanced');
  }
  assert.throws(()=>paddedSvgViewBox([0,0,0,1]),RangeError);
  assert.throws(()=>paddedSvgViewBox([0,0,100,100],{horizontal:-1,vertical:0}),RangeError);
  assert.throws(()=>paddedSvgViewBox([0,0,100,100],{horizontal:.5,vertical:0}),RangeError);
});

test('safe-area is idempotent even across multiple viewer integrations',()=>{
  const values=new Map([['viewBox','-12.5 2 250 160']]);
  const mock={getAttribute:key=>values.get(key)??null,setAttribute:(key,value)=>values.set(key,value)};
  const first=ensureSvgSafeArea(mock);
  assert.deepEqual(ensureSvgSafeArea(mock),first,'viewBox cannot be padded a second time');
  assert.equal(values.get('data-exo-padded-viewbox'),'1');
  assert.equal(first[2],250*(1+2*.055));
  assert.equal(first[3],160*(1+2*.035));
});

test('every 2D entry point shares the same source SVG padding and matching knockout mask',async()=>{
  const controller=await source('controller-reference.js');
  const pbr=await source('pbr-lab.js');
  assert.match(controller,/ensureSvgSafeArea\(adopted\)/);
  assert.match(controller,/const viewBox=\(svg\.getAttribute\('viewBox'\)/);
  assert.match(controller,/maskUnits:'userSpaceOnUse'/);
  assert.match(controller,/x:viewBox\[0\],y:viewBox\[1\],width:viewBox\[2\],height:viewBox\[3\]/);
  assert.doesNotMatch(pbr,/ref\.svg\.setAttribute\('viewBox'/,'3D Lab must not apply a second per-view SVG pad');
  for(const id of ['dualsense','switch_pro','generic','joycon_grip','xbox_360','gamecube']){
    const svg=await source('references/controllers/'+id+'/source.svg');
    assert.match(svg,/<svg\b[^>]*viewBox="/,id+' authored SVG must provide own bounds');
  }
});
