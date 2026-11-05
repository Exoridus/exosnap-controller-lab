import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
const read=async url=>fs.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('DualSense physical face buttons have actual front-facing PlayStation glyph planes without replacing their authored geometry',async()=>{
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 try{
  const glyphs=[];rig.group.traverse(o=>{if(o.userData?.buttonGlyph)glyphs.push(o)});
  assert.deepEqual(glyphs.map(o=>o.userData.buttonGlyph).sort(),['circle','cross','square','triangle']);
  assert.ok(glyphs.every(o=>o.geometry.attributes.position.count===4));
  assert.ok(glyphs.every(o=>o.material.depthTest&&!o.material.depthWrite));
  assert.ok(glyphs.every(o=>o.material.transparent));
  assert.ok(rig.triangles>=7000,'original native triangles still retained');
 }finally{disposeNativeRig(rig)}
});
