import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createContrastCompositeMaterial,updateContrastComposite} from '../silhouette-composite.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
test('normal and Fresnel Ghost do not use the old screen-dilated silhouette',()=>{
  const material=createContrastCompositeMaterial(new THREE.Texture());
  for(const scene of ['dark','light','mixed']){
    updateContrastComposite(material,scene,{width:480,height:320},false);
    assert.equal(material.uniforms.mode.value,3);
  }
  updateContrastComposite(material,'mixed',{width:480,height:320},true);
  assert.equal(material.uniforms.mode.value,2);
  assert.ok(material.fragmentShader.includes('if(mode==3)'));
  assert.ok(resolveHeroRecipe('ghost',.7).ghostFresnel.strength>.5);
  material.dispose();
});
