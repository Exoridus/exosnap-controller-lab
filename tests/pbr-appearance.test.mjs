import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {resolvePbrRecipe} from '../pbr-recipes.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
const read=async url=>readFile(path.resolve(import.meta.dirname,'..',url.replace(/^\.\//,'')),'utf8');

test('material mix zero applies real white top and dark bottom source colors',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 applyPbrRecipeToRig(rig,resolvePbrRecipe('f',0),false);
 const top=rig.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
 const bottom=rig.meshes.find(m=>m.userData.sourceFile==='bottom_shell.obj');
 assert.ok(top.material.color.equals(top.userData.sourceColor));
 assert.ok(bottom.material.color.equals(bottom.userData.sourceColor));
 assert.ok(top.material.color.getHSL({h:0,s:0,l:0}).l>bottom.material.color.getHSL({h:0,s:0,l:0}).l);
 assert.equal(top.material.opacity,1);
 disposeNativeRig(rig);
});
test('same original geometry and PBR materials remain during all eight recipe changes',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 const geom=rig.meshes.map(m=>m.geometry);
 const mat=rig.meshes.map(m=>m.material);
 for(const key of ['a','b','c','d','e','f','g','h']){
  const r=resolvePbrRecipe(key,.72);
  applyPbrRecipeToRig(rig,r,false);
  assert.ok(rig.meshes.every((m,i)=>m.geometry===geom[i] && (key==='g'?m.material.isMeshBasicMaterial:m.material===mat[i])));
  assert.ok(rig.meshes.every(m=>m.material.opacity>=0 && m.material.opacity<=1));
 }
 disposeNativeRig(rig);
});
test('pressed controls use opaque luminous blue while housing stays unchanged',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 const r=resolvePbrRecipe('b',1);
 applyPbrRecipeToRig(rig,r,false);
 const button=rig.meshes.find(m=>m.userData.control==='b1');
 const shell=rig.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
 const baseBlue=button.material.color.clone(),baseShell=shell.material.color.clone();
 applyPbrRecipeToRig(rig,r,true);
 assert.ok(!button.material.color.equals(baseBlue));
 assert.ok(shell.material.color.equals(baseShell));
 assert.equal(button.material.opacity,1);
 assert.ok(button.material.emissiveIntensity>=.8);
 disposeNativeRig(rig);
});
