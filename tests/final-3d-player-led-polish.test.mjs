import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {optimizeStaticHousing} from '../pbr-optimizer.js';
import {resolveLabRecipe} from '../controller-lab-style.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {prepare3DPlayerLedSurface,apply3DPlayerLedLayout,update3DPlayerLedMask} from '../controller-player-leds-3d.js';
import {ledStates} from '../controller-player-leds.js';
import {createContrastCompositeMaterial,updateContrastComposite,sceneContrastProfile,DEFAULT_OUTER_SILHOUETTE_EMPHASIS} from '../silhouette-composite.js';

const read=p=>readFile(new URL('../'+p.replace(/^\.\//,''),import.meta.url),'utf8');
const colorDistance=(a,b)=>Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b);
async function sourceReference(layout){
  const [source,mapText]=await Promise.all([
    read('references/controllers/'+layout+'/source.svg'),
    read('references/controllers/'+layout+'/mapping.json')
  ]);
  const nodes=new Map();
  for(const match of source.matchAll(/<rect\b([^>]+)\/>/g)){
    const attrs=new Map([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    if(!attrs.has('id'))continue;
    nodes.set(attrs.get('id'),{localName:'rect',getAttribute:k=>attrs.get(k)||null});
  }
  return {mapping:JSON.parse(mapText),svg:{querySelector(sel){
    const id=sel.match(/^\[id\$="(.+)"\]$/)?.[1];
    return nodes.get(id)||null;
  }}};
}
test('source-authored Nintendo LEDs are fully attached to original 3D shell without extra geometry',async()=>{
  for(const [modelId,layout,count,part]of [
    ['SwitchPro','switch_pro',4,'top_shell.obj'],['JoyconGrip','joycon_grip',8,'extra.obj']
  ]){
    const rig=await loadNativeRig(CONTROLLERS.find(m=>m.id===modelId),read);
    try{
      const original=rig.meshes.map(m=>({mesh:m,positions:m.geometry.attributes.position.array.slice()}));
      const children=rig.group.children.length,meshes=rig.meshes.length;
      const player=prepare3DPlayerLedSurface(rig);
      assert.equal(player.target.userData.sourceFile,part);
      const projected=apply3DPlayerLedLayout(rig,await sourceReference(layout));
      assert.equal(projected,count);
      assert.equal(player.count,count);
      assert.ok(player.uniforms.rects.value.slice(0,count*4).every(Number.isFinite));
      assert.ok(player.uniforms.frontMinY.value>.09,modelId+' only front facing surface');
      assert.equal(rig.group.children.length,children,'no new geometry groups');
      assert.equal(rig.meshes.length,meshes,'no extra mesh draw calls');
      for(const {mesh,positions}of original)assert.deepEqual(mesh.geometry.attributes.position.array,positions,'source vertices unchanged');
      optimizeStaticHousing(rig);
      assert.ok(player.target.visible,'LED source shell cannot be hidden by static batching');
      assert.equal(update3DPlayerLedMask(rig,1),true);
      assert.deepEqual([...player.uniforms.active.value.slice(0,count)].map(Boolean),
        [...Array(count)].map((_,i)=>ledStates(1)[i%4]));
      assert.equal(update3DPlayerLedMask(rig,1),false,'same player index no per-frame upload');
      assert.equal(update3DPlayerLedMask(rig,15),true);
      assert.ok([...player.uniforms.active.value.slice(0,count)].every(v=>v===1));
      const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
        fragmentShader:'#include <common>\n#include <map_fragment>',uniforms:{}};
      player.target.material.onBeforeCompile(shader,{});
      assert.match(shader.fragmentShader,/playerLedRects\[8\]/);
      assert.match(shader.fragmentShader,/vPlayerLedNormalY/);
      assert.doesNotMatch(shader.fragmentShader,/\bfloat active\b/,'GLSL reserves active as a keyword');
      assert.match(shader.fragmentShader,/playerLedFrontMinY/);
      assert.match(shader.vertexShader,/vPlayerLedNativePos=position/);
      assert.strictEqual(shader.uniforms.playerLedRects,player.uniforms.rects);
      assert.equal(player.target.material.customProgramCacheKey().includes('nintendo-original-surface-led'),true);
    }finally{disposeNativeRig(rig);}
  }
});
test('3D Ghost retains a little authored control color but never changes opacity or white press feedback',async()=>{
  const model=CONTROLLERS.find(m=>m.id==='JoyconGrip');
  const rig=await loadNativeRig(model,read);
  try{
    const recipe=resolveLabRecipe('white',1);
    assert.equal(recipe.material.ghostSourceRetention,.16);
    const controls=rig.meshes.filter(m=>['button','trigger','stick-pivot','stick-cap'].includes(m.userData.role));
    const original=controls.map(mesh=>mesh.userData.sourceColor.clone());
    const baseline={...recipe,material:{...recipe.material,ghostSourceRetention:0}};
    applyPbrRecipeToRig(rig,baseline,{});
    const alphas=controls.map(m=>m.material.opacity);
    const grayscale=controls.map(m=>m.material.color.clone());
    applyPbrRecipeToRig(rig,recipe,{});
    for(let i=0;i<controls.length;i++){
      assert.equal(controls[i].material.opacity,alphas[i],controls[i].userData.sourceFile+' Ghost alpha unchanged');
      const expected=original[i].clone().lerp(new THREE.Color('#9ca3aa'),.84);
      assert.ok(colorDistance(controls[i].material.color,expected)<1e-6,'residual source RGB');
      assert.ok(colorDistance(controls[i].material.color,grayscale[i])>.0001,'Ghost is less desaturated');
    }
    applyPbrRecipeToRig(rig,recipe,{allPressed:true});
    for(const mesh of controls.filter(m=>m.userData.control)){
      assert.ok(colorDistance(mesh.material.color,new THREE.Color('#ffffff'))<.00001,'white active feedback retained');
    }
  }finally{disposeNativeRig(rig);}
});
test('subtle 3D silhouette boost changes only the existing compositing shader, never source meshes',()=>{
 const m=createContrastCompositeMaterial(new THREE.Texture());
 updateContrastComposite(m,'light',{width:320,height:214},true,.42);
 assert.equal(m.uniforms.silhouetteEmphasis.value,.42);
 assert.equal(m.uniforms.mode.value,1);
 assert.match(m.fragmentShader,/ring\(\.72\)-coverageHere/);
 assert.match(m.fragmentShader,/Only faint transparent surfaces/);
 assert.match(m.fragmentShader,/No source-part, hidden-part or overlapping per-mesh contours/);
 updateContrastComposite(m,'dark',{width:320,height:214},true,0);
 assert.equal(m.uniforms.silhouetteEmphasis.value,0,'A/B toggle restores previous composite');
 updateContrastComposite(m,'mixed',{width:320,height:214},false,.42);
 assert.equal(m.uniforms.silhouetteEmphasis.value,0,'direct blit mode never adds outlines');
 m.dispose();
});

test('final 3D exterior is thin and quiet, with original depth/ghost materials unaffected',()=>{
  assert.equal(DEFAULT_OUTER_SILHOUETTE_EMPHASIS,.18);
  const dark=sceneContrastProfile('dark'),light=sceneContrastProfile('light'),mixed=sceneContrastProfile('mixed');
  assert.ok(dark.lightStrength<=.54&&light.darkStrength<=.56&&mixed.darkStrength<=.52);
  const m=createContrastCompositeMaterial(new THREE.Texture());
  assert.match(m.fragmentShader,/ring\(1\.10\)-coverageHere/,'outer ring is just over a single source pixel');
  assert.match(m.fragmentShader,/ring\(\.66\)-coverageHere/);
  assert.match(m.fragmentShader,/lightInk=vec3\(\.82\)/);
  assert.match(m.fragmentShader,/darkInk=vec3\(\.16\)/);
  updateContrastComposite(m,'mixed',{width:320,height:214},true,DEFAULT_OUTER_SILHOUETTE_EMPHASIS);
  assert.equal(m.uniforms.silhouetteEmphasis.value,.18);
  updateContrastComposite(m,'mixed',{width:320,height:214},true,0);
  assert.equal(m.uniforms.silhouetteEmphasis.value,0,'existing A/B switch can still disable extra outline');
  m.dispose();
});
