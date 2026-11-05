import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PBR_VARIANTS, resolvePbrRecipe, qtQuickDescriptor} from '../pbr-recipes.js';
import {styleAt} from '../style-mix.js';
import {EXO_PALETTE} from '../palette.js';

test('eight real 3D recipes A-H are unique and documented',()=>{
  assert.deepEqual(PBR_VARIANTS.map(v=>v.key),['a','b','c','d','e','f','g','h']);
  assert.equal(new Set(PBR_VARIANTS.map(v=>v.name)).size,8);
  assert.ok(PBR_VARIANTS.every(v=>v.description&&v.strategy));
});
test('single slider drives the existing Normal Glass Ghost opacity curve',()=>{
  for(const v of PBR_VARIANTS){
    for(const [i,t] of [0,.5,1].entries()){
      const r=resolvePbrRecipe(v.key,t);
      assert.equal(r.mix,t);
      assert.ok(Math.abs(r.material.shell.opacity-styleAt(t).shell)<.00001,v.key);
      assert.ok(r.material.controls.opacity>=r.material.shell.opacity,v.key);
      assert.ok(r.material.controls.opacity<=1);
      assert.ok(r.material.shell.opacity<=1);
    }
  }
});
test('all blend steps have legal physically based values, same stable active blue',()=>{
  for(const v of PBR_VARIANTS)for(let p=0;p<=100;p++){
    const r=resolvePbrRecipe(v.key,p/100);
    for(const m of [r.material.shell,r.material.controls]){
      for(const k of ['opacity','roughness','metalness','clearcoat','originalColorWeight']){
        assert.ok(m[k]>=0 && m[k]<=1,`${v.key} ${p} ${k}`);
      }
    }
    assert.ok(r.material.controls.opacity>=r.material.shell.opacity);
    assert.equal(r.material.pressBlue,EXO_PALETTE.pressedSurface);
    assert.equal(r.material.pressOpacity,1);
    assert.equal(r.lights.keyPoint.position.length,3);
    assert.equal(r.lights.fillDirectional.direction.length,3);
  }
});
test('variants change real material and lighting parameters, not just colors',()=>{
  const signatures=PBR_VARIANTS.map(v=>{
    const r=resolvePbrRecipe(v.key,.75);
    return JSON.stringify([r.material.shell.roughness,r.material.shell.clearcoat,r.material.shell.metalness,
      r.material.shell.originalColorWeight,r.lights.keyPoint.intensity,r.lights.rimPoint.intensity,r.lights.ambient.intensity]);
  });
  assert.equal(new Set(signatures).size,8);
});
test('base colors are fully retained at mix zero for every variant',()=>{
  for(const v of PBR_VARIANTS){
    const r=resolvePbrRecipe(v.key,0);
    assert.equal(r.material.shell.originalColorWeight,1);
    assert.equal(r.material.controls.originalColorWeight,1);
    assert.equal(r.material.shell.opacity,1);
  }
});
test('Qt descriptors contain standard scene primitives and no custom shader or extra pass',()=>{
  for(const v of PBR_VARIANTS){
    const r=resolvePbrRecipe(v.key,.65);
    const q=qtQuickDescriptor(r);
    assert.equal(q.materialType,'PrincipledMaterial');
    if(v.key==='g'){
      assert.deepEqual(q.lightTypes,[]);
      assert.equal(q.lighting,'NoLighting');
    }else if(v.key==='h'){
      assert.deepEqual(q.lightTypes,['DirectionalLight']);
    }else{
      assert.equal(q.lightTypes[0],'PointLight');
      assert.equal(q.lightTypes[1],'DirectionalLight');
    }
    assert.deepEqual(q.positionUnit,'Three world units, after normalization to 4.05');
    assert.equal(q.usesCustomShader,false);
    assert.equal(q.usesPostprocess,false);
    assert.equal(q.geometryCopiesPerVariant,0);
  }
});
