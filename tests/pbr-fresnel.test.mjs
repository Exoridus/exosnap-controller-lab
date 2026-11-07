import test from 'node:test';
import assert from 'node:assert/strict';
import {ShaderLib,MeshPhysicalMaterial} from 'three';
import {GHOST_FRESNEL,addFresnelToPhysicalFragment,setGhostFresnel} from '../pbr-fresnel.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
test('physical Fresnel adds a surface rim before alpha output',()=>{
  const before=ShaderLib.physical.fragmentShader;
  const after=addFresnelToPhysicalFragment(before);
  assert.match(after,/exoRim=pow/);
  assert.match(after,/diffuseColor.a=min/);
  assert.ok(after.indexOf('diffuseColor.a=min')<after.indexOf('#include <opaque_fragment>'));
  assert.equal((after.match(/uniform float uExoGhostFresnel;/g)||[]).length,1);
  assert.throws(()=>addFresnelToPhysicalFragment('void main(){}'),/Unsupported/);
  assert.equal(GHOST_FRESNEL.power,3.2);
});
test('one reusable program, only the intensity uniform changes',()=>{
  const m=new MeshPhysicalMaterial();
  assert.equal(setGhostFresnel(m,.72),true);
  const id=m.customProgramCacheKey();
  const shader={fragmentShader:ShaderLib.physical.fragmentShader,uniforms:{}};
  m.onBeforeCompile(shader);
  assert.equal(shader.uniforms.uExoGhostFresnel.value,.72);
  setGhostFresnel(m,0);
  assert.equal(shader.uniforms.uExoGhostFresnel.value,0);
  assert.equal(m.customProgramCacheKey(),id);
  m.dispose();
});
test('Fresnel affects Ghost/Identity, never Normal/Outline',()=>{
  assert.equal(resolveHeroRecipe('solid',.7).ghostFresnel.strength,0);
  assert.ok(resolveHeroRecipe('ghost',.7).ghostFresnel.strength>.5);
  assert.ok(resolveHeroRecipe('identity',.7).ghostFresnel.strength>.3);
  assert.equal(resolveHeroRecipe('outline',.7).ghostFresnel.strength,0);
});
