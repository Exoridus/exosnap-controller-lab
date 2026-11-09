import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CONTROLLERS,isLicensedModel} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig,applyControlPoseToRig} from '../pbr-appearance.js';
import {resolveLabRecipe} from '../controller-lab-style.js';
import {supportOpacityFor} from '../controller-visual-policy.js';
import {surfaceGlyphColor} from '../polish-2d-style.js';
const read=p=>fs.readFile(new URL('../'+p.replace(/^\.\//,''),import.meta.url),'utf8');
const models=CONTROLLERS.filter(isLicensedModel);
test('one consolidated neutral control material and non-emitting shell-linked supports across licensed models',async()=>{
 const subtleGhostColors=new Set();
 for(const model of models){const r=await loadNativeRig(model,read);try{
  const recipe=resolveLabRecipe('white',1);applyPbrRecipeToRig(r,recipe,{});
  for(const mesh of r.meshes){const d=mesh.userData;
   if(['button','trigger','touch-surface','stick-cap','stick-pivot'].includes(d.role)){
    const expected=d.sourceColor.clone().lerp(new (await import('three')).Color('#9ca3aa'),1-recipe.material.ghostSourceRetention);
    assert.ok(Math.abs(mesh.material.color.r-expected.r)<1e-6&&
      Math.abs(mesh.material.color.g-expected.g)<1e-6&&
      Math.abs(mesh.material.color.b-expected.b)<1e-6,
      model.id+' has the same bounded source-RGB share in its neutral Ghost controls');
    subtleGhostColors.add(mesh.material.color.getHexString());
   }
   if(['stick-stem','stick-base','stick-well'].includes(d.role)){
    assert.equal(mesh.material.opacity,supportOpacityFor(recipe.material,d.supportCoverage),model.id+' support '+d.sourceFile);
    const color=mesh.material.color.clone();
    applyPbrRecipeToRig(r,recipe,{allPressed:true,left:{x:1,y:0,click:true},right:{x:0,y:1,click:true}});
    assert.ok(mesh.material.color.equals(color),model.id+' support must never light');assert.equal(mesh.material.emissiveIntensity,0);
    applyPbrRecipeToRig(r,recipe,{});
   }
  }
 }finally{disposeNativeRig(r);}}
 assert.ok(subtleGhostColors.size>1,'Ghost controls should retain a restrained fraction of their original RGB');
});
test('moving ring rim is separately weighted from lower structural sidewall without extra meshes',async()=>{
 for(const model of models.filter(m=>m.source==='co')){
  const r=await loadNativeRig(model,read);try{
   for(const mesh of r.meshes.filter(m=>m.userData.role==='stick-pivot')){
    const weights=mesh.geometry.getAttribute('controllerRimWeight');assert.ok(weights,model.id+' original rim/sidewall weights');
    assert.ok([...weights.array].some(v=>v===0),'lower structural vertices');assert.ok([...weights.array].some(v=>v===1),'upper interactive vertices');
    assert.equal(weights.count,mesh.geometry.attributes.position.count);
   }
  }finally{disposeNativeRig(r);}
 }
});
test('2D ink uses softened grayscale and continuous transitions rather than black/white threshold jumps',()=>{
 const rgb=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16));
 for(const scene of ['dark','light','mixed']){
  let previous;
  for(let i=0;i<=100;i++){
   const c=surfaceGlyphColor({control:'#9ca3aa',controlStroke:'#888888',controlAlpha:i/100,activeAlpha:.96,activeColor:'#ffffff',surfaceBackdrop:{dark:'#09111b',light:'#f4f6f9',mixed:'#9baab4'}[scene]},0);
   assert.ok(rgb(c).every(v=>v>=65&&v<=230),'muted, non-black ink '+c);
   if(previous)assert.ok(Math.max(...rgb(c).map((v,j)=>Math.abs(v-previous[j])))<26,'no abrupt polarity step');previous=rgb(c);
  }
 }
});
test('approved custom emblem is recovered and Nintendo housing wordmarks stay absent',async()=>{
 assert.match(await read('references/controllers/gamecube/source.svg'),/id="body-cube-outer"/);
 for(const id of ['switch_pro','joycon_grip'])assert.doesNotMatch(await read('references/controllers/'+id+'/source.svg'),/id="body-wordmark"/);
});

test('consolidated offscreen surfaces replace premultiplied RGBA instead of accumulating their own overlapping alpha',async()=>{
 const {NoBlending}=await import('three');
 for(const model of models){const r=await loadNativeRig(model,read);try{
  applyPbrRecipeToRig(r,resolveLabRecipe('white',.7),{});
  for(const mesh of r.meshes){assert.equal(mesh.material.blending,NoBlending);assert.equal(mesh.material.premultipliedAlpha,true);assert.equal(mesh.material.depthWrite,true);}
 }finally{disposeNativeRig(r);}}
});

test('authored disconnected housing wells use support alpha without altering original shell vertices',async()=>{
 const r=await loadNativeRig(CONTROLLERS.find(m=>m.id==='Xbox360'),read);try{
  const shell=r.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
  const weights=shell.geometry.getAttribute('controllerRimWeight');
  assert.ok(weights,'documented source support regions must reach the shared material');
  assert.ok([...weights.array].some(v=>v===0)&&[...weights.array].some(v=>v===1));
  const positions=shell.geometry.attributes.position.array.slice();
  applyPbrRecipeToRig(r,resolveLabRecipe('white',.7),{allPressed:true});
  assert.equal(shell.material.userData.rimSurface.alpha.value,resolveLabRecipe('white',.7).material.shell.opacity);
  assert.deepEqual(shell.geometry.attributes.position.array,positions);
  assert.equal(shell.material.emissiveIntensity,0);
 }finally{disposeNativeRig(r);}
});

test('broad support collars retain shell coverage while compact DualSense domes keep the accepted quiet alpha',async()=>{
 for(const id of ['DualSenseCompact','Gamecube']){
  const r=await loadNativeRig(CONTROLLERS.find(m=>m.id===id),read);try{
   applyPbrRecipeToRig(r,resolveLabRecipe('white',.7),{});
   const stem=r.meshes.find(m=>m.userData.sourceFile==='left_stick.obj');
   if(id==='DualSenseCompact')assert.equal(stem.material.opacity,resolveLabRecipe('white',.7).material.supportOpacity);
   else assert.equal(stem.material.opacity,resolveLabRecipe('white',.7).material.shell.opacity,'broad source collar cannot punch a brighter alpha-hole into the shell');
  }finally{disposeNativeRig(r);}
 }
});
test('Ghost legends retain bounded midtone contrast instead of remaining near-black on every backdrop',async()=>{
 const {installSurfaceMarking}=await import('../control-glyphs.js');const {Texture}=await import('three');
 const r=await loadNativeRig(CONTROLLERS.find(m=>m.id==='DualSenseCompact'),read);try{
  const face=r.meshes.find(m=>m.userData.artworkKey==='cross');installSurfaceMarking(face,new Texture());
  applyPbrRecipeToRig(r,resolveLabRecipe('white',1),{});
  const c=face.material.userData.surfaceMarking.ink.value;
  assert.ok(c.r>.2&&c.r<.55,'midtone surface ink retains visibility without turning luminous white');
 }finally{disposeNativeRig(r);}
});
