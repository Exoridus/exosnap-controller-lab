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
