import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROL_NEUTRAL} from '../controller-visual-policy.js';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig,applyControlPoseToRig} from '../pbr-appearance.js';
import {resolveLabRecipe} from '../controller-lab-style.js';
import {instantiateStickPairs} from '../pbr-optimizer.js';
import {prepareGhostOcclusion} from '../ghost-depth-policy.js';
const read=url=>fs.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('both original DualSense support domes blend toward shell material without changing moving rings, geometry or depth',async()=>{
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 try{
  prepareGhostOcclusion(rig);
  const original=rig.meshes.map(m=>({mesh:m,geometry:m.geometry,positions:Array.from(m.geometry.attributes.position.array),parent:m.parent}));
  const supports=rig.meshes.filter(m=>m.userData.role==='stick-stem');assert.equal(supports.length,2);
  const shell=rig.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');assert.ok(shell);
  for(const mix of [0,.3,.7,1]){
   const recipe=resolveLabRecipe('white',mix);applyPbrRecipeToRig(rig,recipe,{});
   const amount=mix*mix*(3-2*mix);
   for(const m of supports){
    const expected=m.userData.sourceColor.clone().lerp(shell.userData.sourceColor,amount);
    assert.ok(m.material.color.equals(expected),'socket uses gradual shell color, not isolated gray');
    assert.equal(m.material.opacity,recipe.material.supportOpacity);
    if(mix>0)assert.ok(m.material.opacity<recipe.material.shell.opacity,'support overlay is quieter than the shell');
    assert.equal(m.material.roughness,recipe.material.controls.roughness+(recipe.material.shell.roughness-recipe.material.controls.roughness)*amount);
    assert.equal(m.material.depthTest,true);assert.equal(m.material.depthWrite,true);
   }
   for(const m of rig.meshes.filter(m=>['stick-pivot','stick-cap'].includes(m.userData.role)))
    assert.ok(m.material.color.equals(m.userData.sourceColor.clone().lerp(new THREE.Color(CONTROL_NEUTRAL),amount)),'source identity blends to the shared neutral control material');
  }
  const recipe=resolveLabRecipe('white',.7);applyPbrRecipeToRig(rig,recipe,{left:{x:.7,y:.3,click:true},right:{x:-.7,y:.3,click:true}});
  for(const m of supports){assert.equal(m.material.emissiveIntensity,0);assert.equal(m.material.opacity,recipe.material.supportOpacity);}
  rig.group.updateMatrixWorld(true);const rest=supports.map(m=>m.matrixWorld.clone());
  applyControlPoseToRig(rig,{left:{x:.7,y:.3,click:true},right:{x:-.7,y:.3,click:true}});rig.group.updateMatrixWorld(true);
  supports.forEach((m,i)=>assert.ok(!m.matrixWorld.equals(rest[i]),'original moving support still follows its rig'));
  applyControlPoseToRig(rig,{});rig.group.updateMatrixWorld(true);supports.forEach((m,i)=>assert.ok(m.matrixWorld.equals(rest[i])));
  for(const o of original){assert.equal(o.mesh.geometry,o.geometry);assert.equal(o.mesh.parent,o.parent);assert.deepEqual(Array.from(o.geometry.attributes.position.array),o.positions);}
  instantiateStickPairs(rig);applyPbrRecipeToRig(rig,recipe,{});
  const pair=rig.stickInstances.find(g=>g.role==='stick-stem');
  assert.ok(pair?.instance.visible,'identical quiet supports keep GPU instancing');
  assert.equal(pair.instance.material,pair.originals[0].material);
  assert.equal(pair.instance.material.opacity,recipe.material.supportOpacity);
 }finally{disposeNativeRig(rig);}
});

test('all families now share the verified support material policy while mix zero retains authored colors',async()=>{
 for(const id of ['JoyconGrip','JoyconLeft','JoyconRight','SwitchPro','XboxOneClean']){
  const model=CONTROLLERS.find(x=>x.id===id);assert.ok(model,id);
  const rig=await loadNativeRig(model,read);
  try{
   for(const mix of [0,.7,1]){
    const recipe=resolveLabRecipe('white',mix);applyPbrRecipeToRig(rig,recipe,{});
    const supports=rig.meshes.filter(m=>['stick-stem','stick-base','stick-well'].includes(m.userData.role));
    assert.ok(supports.length,id+' has original supports');
    for(const mesh of supports){
     if(mix===0)assert.ok(mesh.material.color.equals(mesh.userData.sourceColor),id+' original hardware preserved at mix zero');
     assert.equal(mesh.material.opacity,recipe.material.supportOpacity,id+' uses common support alpha');
     assert.equal(mesh.material.emissiveIntensity,0);
    }
   }
  }finally{disposeNativeRig(rig);}
 }
});
