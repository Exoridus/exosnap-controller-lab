import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {faceButtonGlyph,faceDecalSizeFrom2D} from '../control-glyphs.js';
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

test('GameCube 3D face legend scales from actual 2D glyph footprint for readable overlay size',async()=>{
  // The GameCube A glyph in the source SVG is ~135x135 inside a 480px face.
  const a=faceDecalSizeFrom2D({width:.219784,height:.219784},
    {width:480,height:480},{width:126,height:135});
  const b=faceDecalSizeFrom2D({width:.134916,height:.134916},
    {width:296,height:296},{width:70,height:103});
  assert.ok(a.size>.14,'A glyph decal must be significantly larger than old 0.075-plane');
  assert.ok(b.size>.09,'B glyph decal must be more legible than old 0.075-plane');
  assert.ok(a.readableCoverage>=.54&&a.readableCoverage<=.68);
  assert.ok(b.readableCoverage>=.54&&b.readableCoverage<=.68);
  assert.throws(()=>faceDecalSizeFrom2D({width:0,height:.2},
    {width:100,height:100},{width:10,height:10}),RangeError);
  const svg=await fs.readFile(new URL('../references/controllers/gamecube/source.svg',import.meta.url),'utf8');
  for(const id of ['a','b','x','y']){
    const block=svg.match(new RegExp('<g id="btn-'+id+'">([\\s\\S]*?)<\\/g>'))?.[1];
    assert.ok(block?.includes('class="glyph"'),'2D source must provide author-drawn path: '+id);
  }
});
