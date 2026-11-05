import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {faceButtonGlyph} from '../control-glyphs.js';
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

test('functional labels on GameCube/Xbox/Nintendo do not become PlayStation symbols',async()=>{
 for(const id of ['Gamecube','XboxOneClean','Xbox360','SwitchPro','JoyconGrip','JoyconRight']){
   const model=CONTROLLERS.find(x=>x.id===id);
   assert.equal(faceButtonGlyph('a_button.obj',model),'A',id);
   assert.equal(faceButtonGlyph('b_button.obj',model),'B',id);
   assert.equal(faceButtonGlyph('x_button.obj',model),'X',id);
   assert.equal(faceButtonGlyph('y_button.obj',model),'Y',id);
   assert.equal(faceButtonGlyph('top_shell.obj',model),null,id);
   assert.equal(faceButtonGlyph('bottom_shell.obj',model),null,id);
 }
 const gamecube=CONTROLLERS.find(x=>x.id==='Gamecube');
 const rig=await loadNativeRig(gamecube,read);
 try{
   const glyphs=[];rig.group.traverse(o=>{if(o.userData?.buttonGlyph)glyphs.push(o)});
   assert.deepEqual(glyphs.map(o=>o.userData.buttonGlyph).sort(),['A','B','X','Y']);
   assert.ok(glyphs.every(o=>o.userData.surfaceArtwork==='button-face'));
   // Real source palette is used: shell purple, A green, B red, C-stick yellow.
   const color=file=>rig.meshes.find(x=>x.userData.sourceFile===file).userData.sourceColor;
   assert.ok(color('top_shell.obj').b>color('top_shell.obj').g);
   assert.ok(color('a_button.obj').g>color('a_button.obj').r);
   assert.ok(color('b_button.obj').r>color('b_button.obj').g);
   assert.ok(color('right_cap.obj').r>color('right_cap.obj').b);
 }finally{disposeNativeRig(rig)}
});
