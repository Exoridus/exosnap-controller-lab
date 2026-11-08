import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{CONTROLLERS}from'../models.js';import{loadNativeRig,disposeNativeRig}from'../pbr-model.js';import{instantiateStickPairs}from'../pbr-optimizer.js';import{applyPbrRecipeToRig,applyStickPoseToRig}from'../pbr-appearance.js';import{resolveHeroRecipe}from'../pbr-recipes.js';import{normalizeStickInput,poseForStickDemo}from'../stick-activity.js';
const read=async url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('matching sticks use real GPU instancing with shared source triangle topology',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);try{
 const result=instantiateStickPairs(rig);assert.equal(result.pairs,3);
 assert.ok(rig.stickInstances.every(group=>group.instance.isInstancedMesh&&group.instance.count===2));
 assert.ok(rig.stickInstances.flatMap(group=>group.originals).every(mesh=>mesh.visible===false));
 }finally{disposeNativeRig(rig)}
});
test('independent L3 states restore individual geometries rather than corrupt instanced opacity',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);try{
 instantiateStickPairs(rig);const recipe=resolveHeroRecipe('ghost',1);
 applyPbrRecipeToRig(rig,recipe,{...poseForStickDemo('move'),allPressed:false});
 assert.deepEqual(rig.stickInstances.filter(group=>group.instance.visible).map(group=>group.role),['stick-stem','stick-cap']);
 assert.ok(rig.stickInstances.find(group=>group.role==='stick-pivot').originals.every(mesh=>mesh.visible));
 assert.ok(rig.stickInstances.filter(group=>group.instance.visible).every(group=>group.instance.material===group.originals[0].material));
 applyPbrRecipeToRig(rig,recipe,{left:normalizeStickInput({x:0,y:0,click:true}),right:normalizeStickInput(),allPressed:false});
 assert.deepEqual(rig.stickInstances.filter(group=>group.instance.visible).map(group=>group.role),['stick-stem','stick-pivot']);
 const cap=rig.stickInstances.find(group=>group.role==='stick-cap');
 assert.ok(!cap.instance.visible&&cap.originals.every(mesh=>mesh.visible));
 assert.notEqual(cap.originals[0].material.color.getHexString(),cap.originals[1].material.color.getHexString());
 }finally{disposeNativeRig(rig)}
});
