import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {prepareGhostOcclusion,updateGhostRearHints} from '../ghost-depth-policy.js';
import {prepareSilhouette,updateSilhouette} from '../pbr-silhouette.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
const read=async url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('backside hint lines are only enabled for translucent ghost styles and depth reject visible front faces',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 try{
  prepareGhostOcclusion(rig);
  assert.ok(rig.rearHintLines.length>0,'should have authored shoulder/trigger hints');
  for(const hint of rig.rearHintLines){assert.equal(hint.material.depthFunc,THREE.GreaterDepth); assert.equal(hint.material.depthWrite,false);}
  for(const key of ['solid','identity']){
    updateGhostRearHints(rig,resolveHeroRecipe(key,1));
    assert.ok(rig.rearHintLines.every(h=>!h.visible),key);
  }
  for(const key of ['ghost','outline']){
    updateGhostRearHints(rig,resolveHeroRecipe(key,1));
    assert.ok(rig.rearHintLines.some(h=>h.visible),key);
  }
 }finally{disposeNativeRig(rig)}
});
test('outline ghost shares source buffers and only draws for selected silhouette style',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 try{
  prepareSilhouette(rig);
  assert.ok(rig.silhouetteLayers.length>=2);
  for(const layer of rig.silhouetteLayers){assert.ok(rig.meshes.some(m=>layer.geometry===m.geometry));assert.equal(layer.material.depthWrite,false);}
  updateSilhouette(rig,resolveHeroRecipe('ghost',.7));
  assert.ok(rig.silhouetteLayers.every(m=>!m.visible));
  updateSilhouette(rig,resolveHeroRecipe('outline',.7));
  assert.ok(rig.silhouetteLayers.every(m=>m.visible));
 }finally{disposeNativeRig(rig)}
});
