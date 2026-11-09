import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import * as artwork from '../control-glyphs.js';
const read=url=>fs.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('runtime markings belong to existing button materials, never floating meshes',async()=>{
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 try{
  const marks=rig.meshes.filter(m=>m.userData.artworkKey);
  assert.equal(marks.length,8,'four faces and four D-pad surfaces, no floating Share/Options');
  assert.ok(marks.every(m=>m.geometry.getAttribute('controllerMarkUv')?.count===m.geometry.getAttribute('position').count));
  const floats=[];rig.group.traverse(o=>{if(o.geometry?.type==='PlaneGeometry'&&o.userData.surfaceArtwork)floats.push(o);});
  assert.equal(floats.length,0);
  assert.ok(!marks.some(m=>['view','menu'].includes(m.userData.artworkKey)));
 }finally{disposeNativeRig(rig);}
});
test('global material markings toggle changes uniforms, not geometry or shader identity',()=>{
 assert.equal(typeof artwork.installSurfaceMarking,'function');
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshPhysicalMaterial());
 mesh.userData={artworkKey:'up',sourceColor:new THREE.Color('#eeeeee')};
 const texture=new THREE.Texture();artwork.installSurfaceMarking(mesh,texture);
 const geometry=mesh.geometry,material=mesh.material,program=material.customProgramCacheKey();
 const native={meshes:[mesh]};artwork.setControllerMarkings(native,false);
 assert.equal(material.userData.surfaceMarking.enabled.value,0);
 artwork.setControllerMarkings(native,true);
 assert.equal(material.userData.surfaceMarking.enabled.value,1);
 assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(material.customProgramCacheKey(),program);
 assert.ok(material.userData.surfaceMarking.ink.value.r<.1,'D-pad ink is dark at rest');
});

test('DualShock 4 arrows are reserved for the fixed housing, never the four moving D-pad surfaces',async()=>{
  const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DS4Compact'),read);
  try{
    const arrows=['up','down','left','right'];
    for(const dir of arrows){
      const part=rig.meshes.find(m=>m.userData.sourceFile==='dpad_'+dir+'.obj');
      assert.ok(part,'source-authored directional button '+dir);
      assert.equal(part.userData.artworkKey,undefined,'no moving-button ink for '+dir);
      assert.equal(part.geometry.getAttribute('controllerMarkUv'),undefined);
    }
    assert.equal(rig.meshes.filter(m=>m.userData.artworkKey).length,4,
      'four face buttons; the four arrows are mapped to the case by the SVG loader');
    const shell=rig.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
    assert.ok(shell?.visible);
    assert.equal(typeof artwork.applyDualShockHousingArrows,'function');
    const svg=await fs.readFile(new URL('../references/controllers/dualshock4/source.svg',import.meta.url),'utf8');
    for(const dir of arrows)assert.match(svg,new RegExp('<g id="btn-'+dir+'">[\\s\\S]*?class="glyph"'),
      'original SVG '+dir+' arrow must be available for source-projected housing ink');
  }finally{disposeNativeRig(rig);}
});
