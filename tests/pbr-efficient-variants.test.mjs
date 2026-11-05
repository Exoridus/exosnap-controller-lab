import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {PBR_VARIANTS,resolvePbrRecipe,qtQuickDescriptor} from '../pbr-recipes.js';
const read=async url=>readFile(path.resolve(import.meta.dirname,'..',url.replace(/^\.\//,'')),'utf8');

test('A-F are preserved; G unlit and H one-light are added as genuine distinct variants',()=>{
 assert.deepEqual(PBR_VARIANTS.map(v=>v.key),['a','b','c','d','e','f','g','h']);
 assert.equal(resolvePbrRecipe('g',1).lightingMode,'unlit');
 assert.equal(resolvePbrRecipe('h',1).lightingMode,'pbr');
});

test('unlit G has no active lights, and Qt descriptor uses PrincipledMaterial.NoLighting',()=>{
 for(const mix of [0,.5,1]){
  const r=resolvePbrRecipe('g',mix);const q=qtQuickDescriptor(r);
  assert.equal(r.lights.ambient.intensity,0);
  assert.equal(r.lights.keyPoint.intensity,0);
  assert.equal(r.lights.fillDirectional.intensity,0);
  assert.equal(r.lights.rimPoint.intensity,0);
  assert.equal(q.lighting,'NoLighting');
  assert.deepEqual(q.lightTypes,[]);
  assert.ok(r.material.controls.opacity>=r.material.shell.opacity);
  assert.equal(q.usesCustomShader,false);
  assert.equal(q.geometryCopiesPerVariant,0);
 }
});

test('single-key H uses exactly one active directional light with no shadow passes',()=>{
 for(const mix of [0,.5,1]){
  const r=resolvePbrRecipe('h',mix);const q=qtQuickDescriptor(r);
  assert.equal(r.lights.keyPoint.intensity,0);
  assert.equal(r.lights.rimPoint.intensity,0);
  assert.equal(r.lights.ambient.intensity,0);
  assert.ok(r.lights.fillDirectional.intensity>0);
  assert.deepEqual(q.lightTypes,['DirectionalLight']);
  assert.equal(q.lighting,'FragmentLighting');
  assert.equal(q.usesPostprocess,false);
 }
});

test('G/H use identical original geometry and do not rebuild materials when revisiting modes',async()=>{
 const native=await loadNativeRig(CONTROLLERS[0],read);
 try{
  const initialGeometries=native.meshes.map(m=>m.geometry);
  applyPbrRecipeToRig(native,resolvePbrRecipe('h',.65),false);
  const physicalMaterials=native.meshes.map(m=>m.material);
  applyPbrRecipeToRig(native,resolvePbrRecipe('g',.65),false);
  assert.ok(native.meshes.every(m=>m.material.isMeshBasicMaterial));
  const unlitMaterials=native.meshes.map(m=>m.material);
  applyPbrRecipeToRig(native,resolvePbrRecipe('h',.65),false);
  assert.ok(native.meshes.every((m,i)=>m.material===physicalMaterials[i]));
  applyPbrRecipeToRig(native,resolvePbrRecipe('g',.25),true);
  assert.ok(native.meshes.every((m,i)=>m.material===unlitMaterials[i] && m.geometry===initialGeometries[i]));
  const button=native.meshes.find(m=>m.userData.control==='b1');
  const shell=native.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
  assert.ok(button.material.opacity>=shell.material.opacity);
 }finally{disposeNativeRig(native)}
});
