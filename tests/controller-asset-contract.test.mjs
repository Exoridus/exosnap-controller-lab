import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CONTROLLERS} from '../models.js';
import {layoutForModel} from '../controller-catalog.js';
import {CONTROLLER_PACK_VERSION,canonicalControl,canonicalControlsForLayout,
 canonicalRigParts,normalizeControllerFrame} from '../controller-asset-contract.js';
import {exportControllerPack} from '../tools/export-controller-pack.mjs';

const source=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('canonical controls use positions not ABXY labels; analogue and click are separate',()=>{
 assert.equal(CONTROLLER_PACK_VERSION,1);
 assert.equal(canonicalControl('b1'),'south');
 assert.equal(canonicalControl('b2'),'east');
 assert.equal(canonicalControl('up'),'dpad_up');
 assert.equal(canonicalControl('ls'),'left_stick_click');
 const frame=normalizeControllerFrame({source:'live',connected:true,
  values:new Map([['b1',1],['l2',.35],['ls',0]]),
  left:{x:.75,y:-.25},right:{x:0,y:0},playerIndex:3});
 assert.equal(frame.buttons.south,1);
 assert.equal(frame.buttons.left_trigger,.35);
 assert.equal(frame.sticks.left.click,0);
 assert.deepEqual([frame.sticks.left.x,frame.sticks.left.y],[.75,-.25]);
 assert.equal(frame.playerIndex,3);
 assert.equal(normalizeControllerFrame({playerIndex:18}).playerIndex,null);
});
test('one semantic mapping covers original 2D SVG and original 3D parts',async()=>{
 for(const id of ['DualSenseCompact','DS4Compact','XboxOneClean','SwitchPro','Gamecube']){
  const model=CONTROLLERS.find(m=>m.id===id),layout=layoutForModel(id);
  const mapping=JSON.parse(await source('references/controllers/'+layout.id+'/mapping.json'));
  const svg=await source('references/controllers/'+layout.id+'/source.svg');
  const mapped=canonicalControlsForLayout(layout,mapping);
  assert.ok(mapped.length>=8,id+' semantic controls');
  for(const entry of mapped)assert.ok(svg.includes('id="'+entry.element+'"'),id+': '+entry.element);
  const info=JSON.parse(await source('assets/'+id+'/info.json'));
  const parts=canonicalRigParts(model,info);
  assert.ok(parts.some(p=>p.control==='south'),id+' south 3D button');
  assert.ok(parts.some(p=>p.control==='dpad_up'),id+' dpad in rig');
  assert.ok(parts.every(p=>Array.isArray(p.pivot)),id+' source pivots');
 }
});
test('exports one parseable GLB rig, editable SVG elements and hashed source manifest',async()=>{
 const out=await mkdtemp(path.join(tmpdir(),'exosnap-pack-'));
 try{
  const result=await exportControllerPack('DS4Compact',out);
  assert.ok(result.svgElements>=12);
  assert.ok(result.parts>=20);
  const dir=path.join(out,'DS4Compact');
  const bin=await readFile(path.join(dir,'model.glb'));
  assert.equal(bin.toString('ascii',0,4),'glTF');
  assert.equal(bin.readUInt32LE(4),2);
  assert.equal(bin.readUInt32LE(8),bin.length);
  const rig=JSON.parse(await readFile(path.join(dir,'rig.json')));
  const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json')));
  const controls=JSON.parse(await readFile(path.join(dir,'controls.json')));
  assert.equal(rig.model,'DS4Compact');
  assert.ok(rig.parts.some(p=>p.node==='dpad_up.obj'));
  assert.ok(controls.controls.some(x=>x.control==='south'));
  assert.equal(Object.keys(manifest.files).filter(x=>x.endsWith('.glb')).length,1);
  assert.equal(manifest.Qt.nativeValidated,false);
  assert.ok(manifest.sourceHashes['info.json']);
  assert.match(await readFile(path.join(dir,'elements','btn-up.svg'),'utf8'),/<svg[^>]*viewBox=/);
 }finally{await rm(out,{recursive:true,force:true});}
});
