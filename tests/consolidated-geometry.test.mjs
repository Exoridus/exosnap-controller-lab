import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS,isLicensedModel} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import * as optimizer from '../pbr-optimizer.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {resolveHeroRecipe,resolvePbrRecipe} from '../pbr-recipes.js';
import {normalizeStickInput} from '../stick-activity.js';
const read=url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
const worldVertices=mesh=>{
 mesh.updateWorldMatrix(true,false);
 const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
 const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
 return Array.from({length:p.count},(_,i)=>({
  p:new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray(),
  n:n?new THREE.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize().toArray():null,
  uv:mesh.geometry.attributes.uv?new THREE.Vector2().fromBufferAttribute(mesh.geometry.attributes.uv,i).toArray():null
 }));
};
const assertSameVertices=(before,after)=>{
 assert.equal(after.length,before.length);
 for(let i=0;i<before.length;i++){
  for(const key of ['p','n'])if(before[i][key])for(let j=0;j<3;j++)assert.ok(Math.abs(before[i][key][j]-after[i][key][j])<1e-12);
  assert.deepEqual(after[i].uv,before[i].uv);
 }
};
test('control reuse preserves every authored vertex, normal, UV, hierarchy and material across installed licensed models',async()=>{
 assert.equal(typeof optimizer.shareEquivalentControlGeometry,'function');
 for(const model of CONTROLLERS.filter(isLicensedModel)){
  const rig=await loadNativeRig(model,read);
  try{
   const before=rig.meshes.map(mesh=>({vertices:worldVertices(mesh),parent:mesh.parent,material:mesh.material}));
   const result=optimizer.shareEquivalentControlGeometry(rig);
   // Generic uses distinct approved SVG profiles now; the old four square-pad
   // matches no longer exist. Near matches must never be silently welded.
   const expected={DualSenseCompact:3,DS4Compact:1,XboxOneClean:0,Xbox360:3,SwitchPro:3,JoyconGrip:3,JoyconLeft:1,JoyconRight:1,Gamecube:0,Wavebird:0,GenericPro:0};
   assert.equal(result.pairs,expected[model.id],`${model.id} source reuse count`);
   assert.equal(result.savedCalls,0);
   assert.equal(result.savedBytes,result.bytesBefore-result.bytesAfter);
   rig.meshes.forEach((mesh,i)=>{
    assertSameVertices(before[i].vertices,worldVertices(mesh));
    assert.equal(mesh.parent,before[i].parent);assert.equal(mesh.material,before[i].material);
   });
   const repeat=optimizer.shareEquivalentControlGeometry(rig);
   assert.equal(repeat.savedBytes,0);assert.equal(repeat.pairs,0);
  }finally{disposeNativeRig(rig);}
 }
});
test('exact proper rotation and translation can share buffers; UV differences and near-matches cannot',()=>{
 assert.equal(typeof optimizer.shareEquivalentControlGeometry,'function');
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2,0,0,0,1,0],3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));
 const a=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial());
 const b=new THREE.Mesh(geometry.clone(),new THREE.MeshPhysicalMaterial());
 b.position.set(3,-2,5);b.rotation.y=.3;
 const rotation=new THREE.Matrix4().set(0,-1,0,4,1,0,0,8,0,0,1,16,0,0,0,1);
 b.geometry.applyMatrix4(rotation);
 const uvMismatch=new THREE.Mesh(b.geometry.clone(),new THREE.MeshPhysicalMaterial());
 uvMismatch.geometry.attributes.uv.setX(0,.25);
 const nearMatch=new THREE.Mesh(geometry.clone(),new THREE.MeshPhysicalMaterial());
 nearMatch.geometry.attributes.position.setX(1,2+5e-7);
 const group=new THREE.Group();const meshes=[a,b,uvMismatch,nearMatch];
 meshes.forEach((m,i)=>{m.userData={role:'button',sourceFile:`button${i}.obj`};group.add(m);});
 const before=meshes.map(worldVertices);
 const result=optimizer.shareEquivalentControlGeometry({group,meshes});
 assert.equal(result.pairs,1);assert.equal(result.transformedPairs,1);assert.equal(a.geometry,b.geometry);
 assert.notEqual(a.geometry,uvMismatch.geometry);assert.notEqual(a.geometry,nearMatch.geometry);
 meshes.forEach((mesh,i)=>assertSameVertices(before[i],worldVertices(mesh)));
});
test('actual unequal stick materials force fallback even at nearly equal analog activity',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 try{
  optimizer.instantiateStickPairs(rig);
  const recipe=resolveHeroRecipe('ghost',1);
  applyPbrRecipeToRig(rig,recipe,{left:normalizeStickInput({x:.6}),right:normalizeStickInput({x:.62})});
  for(const pair of rig.stickInstances){
   const [left,right]=pair.originals;
   if(left.material.color.equals(right.material.color)&&left.material.opacity===right.material.opacity)continue;
   assert.equal(pair.instance.visible,false,`${pair.role} must not collapse distinct feedback`);
   assert.ok(left.visible&&right.visible);
  }
 }finally{disposeNativeRig(rig);}
});
test('compatible stick instances use the actual common final material; depth and emissive differences force fallback',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 try{
  optimizer.instantiateStickPairs(rig);
  const pair=rig.stickInstances.find(g=>g.role==='stick-cap');
  const [left,right]=pair.originals;
  left.material.color.set('#ffffff');right.material.copy(left.material);
  // A stale clone must never overwrite the originals' final shared input color.
  const stale=left.material.clone();stale.color.set('#00ff00');pair.instance.material=stale;
  optimizer.updateStickInstances(rig,{left:normalizeStickInput(),right:normalizeStickInput()});
  assert.ok(pair.instance.visible);assert.equal(pair.instance.material,left.material);stale.dispose();
  right.material.emissiveIntensity=.1;
  optimizer.updateStickInstances(rig,{left:normalizeStickInput(),right:normalizeStickInput()});
  assert.equal(pair.instance.visible,false);
  right.material.copy(left.material);right.material.depthWrite=false;
  optimizer.updateStickInstances(rig,{left:normalizeStickInput(),right:normalizeStickInput()});
  assert.equal(pair.instance.visible,false);
 }finally{disposeNativeRig(rig);}
});

test('PBR/unlit transitions retain independent click feedback and resume compatible idle instancing',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 try{
  optimizer.instantiateStickPairs(rig);
  for(const recipe of [resolveHeroRecipe('ghost',1),resolvePbrRecipe('g',1),resolvePbrRecipe('h',1),resolveHeroRecipe('ghost',0)]){
   applyPbrRecipeToRig(rig,recipe,{left:normalizeStickInput({click:true}),right:normalizeStickInput()});
   const cap=rig.stickInstances.find(g=>g.role==='stick-cap');
   assert.ok(!cap.instance.visible&&cap.originals.every(m=>m.visible));
   assert.notEqual(cap.originals[0].material.color.getHexString(),cap.originals[1].material.color.getHexString());
   applyPbrRecipeToRig(rig,recipe,false);
   assert.ok(rig.stickInstances.every(g=>g.instance.visible&&g.instance.material===g.originals[0].material));
   assert.ok(rig.stickInstances.every(g=>g.instance.material.type===(recipe.lightingMode==='unlit'?'MeshBasicMaterial':'MeshPhysicalMaterial')));
  }
 }finally{disposeNativeRig(rig);}
});
