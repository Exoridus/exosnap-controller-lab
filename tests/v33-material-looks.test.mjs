import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {HERO_VARIANTS,resolveHeroRecipe} from '../pbr-recipes.js';
import {applyPbrRecipeToRig,applyStickPoseToRig} from '../pbr-appearance.js';
import {poseForStickDemo} from '../stick-activity.js';
const read=async url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('four distinct looks use supported Qt Quick 3D material contracts',()=>{
 assert.deepEqual(HERO_VARIANTS.map(v=>v.key),['solid','ghost','outline','identity']);
 for(const key of ['solid','ghost','outline','identity'])for(const mix of [0,.5,1]){
  const recipe=resolveHeroRecipe(key,mix);
  assert.ok(recipe.material.controls.opacity>=recipe.material.shell.opacity);
  assert.equal(recipe.lightingMode,key==='outline'?'unlit':'ibl');
  assert.equal(recipe.variant,key);
  assert.ok(recipe.material.controls.idleTint);
 }
});
test('idle stick matches control look, moving stick lightens, pressed click is opaque LED',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read),recipe=resolveHeroRecipe('ghost',1);
 const cap=rig.meshes.find(m=>m.userData.sourceFile==='left_cap.obj');
 const well=rig.meshes.find(m=>m.userData.sourceFile==='left_ring.obj');
 try{
  applyPbrRecipeToRig(rig,recipe,{...poseForStickDemo('neutral'),allPressed:false});
  const idle=cap.material.color.clone(),idleAlpha=cap.material.opacity;
  applyPbrRecipeToRig(rig,recipe,{...poseForStickDemo('move'),allPressed:false});
  const moved=cap.material.color.clone(),moveAlpha=cap.material.opacity;
  assert.ok(!moved.equals(idle),'movement should shift white cap toward pale blue');
  assert.equal(idle.getHexString(),'e6eff6');
  assert.ok(moved.b>moved.r,'motion color remains pale blue');
  assert.ok(moveAlpha>=idleAlpha);
  applyPbrRecipeToRig(rig,recipe,{...poseForStickDemo('click'),allPressed:false});
  assert.ok(cap.material.opacity>moveAlpha);
  assert.equal(cap.material.opacity,1);
  assert.ok(cap.material.emissiveIntensity>=.8);
 }finally{disposeNativeRig(rig)}
});
test('stick tilt poses change real source pivots and return exactly to neutral',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 try{
  const left=rig.parts.find(p=>p.file==='left_stick.obj').holder;
  const base=left.quaternion.clone();
  applyStickPoseToRig(rig,poseForStickDemo('move'));
  assert.ok(!left.quaternion.equals(base));
  applyStickPoseToRig(rig,poseForStickDemo('neutral'));
  assert.ok(left.quaternion.equals(base));
 }finally{disposeNativeRig(rig)}
});
