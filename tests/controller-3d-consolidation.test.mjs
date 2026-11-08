import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig,applyStickPoseToRig} from '../pbr-appearance.js';
import {prepareGhostOcclusion,hideOccludedRearControls} from '../ghost-depth-policy.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
import * as artwork from '../control-glyphs.js';
import {instantiateStickPairs} from '../pbr-optimizer.js';
import {resolveLabRecipe} from '../controller-lab-style.js';
import {stickMechanics} from '../model-mechanics.js';

const read=async url=>fs.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
const recipe=(mix=1,activeContrast='white')=>{
 const r=resolveHeroRecipe('ghost',mix);
 return {...r,mix,consolidated:true,activeContrast,hiddenIndicators:{enabled:true,idleOpacity:.28,activeOpacity:.90},
  material:{...r.material,supportOpacity:1-.9*mix,pressOpacity:1,pressBlue:activeContrast==='white'?'#ffffff':'#4f9eeb',
   controls:{...r.material.controls,opacity:1-.75*mix},shell:{...r.material.shell,opacity:1-.9*mix}}};
};
const rigFor=id=>loadNativeRig(CONTROLLERS.find(m=>m.id===id),read);
const mesh=(rig,file)=>rig.meshes.find(m=>m.userData.sourceFile===file);

test('consolidated alpha has no stick floor and structural shafts follow shell mix',async()=>{
 const rig=await rigFor('DualSenseCompact');
 try{
  applyPbrRecipeToRig(rig,recipe(),{});
  for(const file of ['left_ring.obj','left_cap.obj','left_trigger.obj'])assert.equal(mesh(rig,file).material.opacity,.25,file);
  assert.ok(Math.abs(mesh(rig,'left_stick.obj').material.opacity-.10)<1e-12);
  applyPbrRecipeToRig(rig,recipe(),{left:{click:true},values:new Map([['b1',1]])});
  assert.equal(mesh(rig,'left_cap.obj').material.opacity,1);
  assert.equal(mesh(rig,'right_cap.obj').material.opacity,.25);
  assert.equal(mesh(rig,'a_button.obj').material.opacity,1);
  assert.equal(mesh(rig,'b_button.obj').material.opacity,.25);
 }finally{disposeNativeRig(rig)}
});

test('whole rear meshes keep depth and color writes for every yaw; hidden fragments use GreaterDepth',async()=>{
 const rig=await rigFor('DualSenseCompact');
 try{
  prepareGhostOcclusion(rig);
  for(const yaw of [0,.5,1,Math.PI]){
   hideOccludedRearControls(rig,recipe(),{yaw});
   assert.equal(mesh(rig,'left_trigger.obj').material.colorWrite,true);
   assert.equal(mesh(rig,'left_trigger.obj').material.depthWrite,true);
  }
  applyPbrRecipeToRig(rig,recipe(),{triggers:{left:.5,right:0},values:new Map([['r1',1]])});
  const hints=file=>rig.rearHintLines.filter(h=>h.parent.userData.sourceFile===file);
  assert.ok(hints('left_trigger.obj').length);
  assert.ok(hints('left_trigger.obj').every(h=>h.material.opacity>.28&&h.material.opacity<.9));
  assert.ok(hints('right_trigger.obj').every(h=>h.material.opacity===.28));
  assert.ok(hints('right_bumper.obj').every(h=>h.material.opacity===.9));
  assert.ok(rig.rearHintLines.every(h=>h.material.depthFunc===THREE.GreaterDepth&&h.material.dashed));
  assert.ok(rig.rearHintLines.every(h=>h.userData.hiddenOutline?.material.depthFunc===THREE.GreaterDepth),
   'dark under-stroke keeps hidden dashes readable on light and mixed backgrounds');
 }finally{disposeNativeRig(rig)}
});

test('authored CO cap and stem move together through their actual ring parent and restore',async()=>{
 for(const id of ['DualSenseCompact','Gamecube','XboxOneClean']){
  const rig=await rigFor(id);
  try{
   const cap=mesh(rig,'left_cap.obj'),stem=mesh(rig,'left_stick.obj');
   rig.group.updateMatrixWorld(true);
   const capRest=cap.matrixWorld.clone(),stemRest=stem.matrixWorld.clone();
   applyStickPoseToRig(rig,{left:{x:.6,y:.4},right:{}});rig.group.updateMatrixWorld(true);
   assert.ok(!cap.matrixWorld.equals(capRest),id+' cap must tilt with stem');
   assert.ok(!stem.matrixWorld.equals(stemRest),id+' stem must tilt');
   applyStickPoseToRig(rig,{});rig.group.updateMatrixWorld(true);
   assert.ok(cap.matrixWorld.equals(capRest),id+' cap restores exactly');
   assert.ok(stem.matrixWorld.equals(stemRest),id+' stem restores exactly');
  }finally{disposeNativeRig(rig)}
 }
});

test('cool feedback is inverse mix, bright-source-only, while custom active colors remain exact',async()=>{
 const rig=await rigFor('DualSenseCompact');
 try{
  const button=mesh(rig,'a_button.obj');
  button.userData.sourceColor.set('#eeeeee');
  applyPbrRecipeToRig(rig,recipe(1,'cool'),{values:new Map([['b1',1]])});
  assert.equal(button.material.color.getHexString(),'ffffff');
  applyPbrRecipeToRig(rig,recipe(0,'cool'),{values:new Map([['b1',1]])});
  assert.equal(button.material.color.getHexString(),'4f9eeb');
  button.userData.sourceColor.set('#161616');
  applyPbrRecipeToRig(rig,recipe(0,'cool'),{values:new Map([['b1',1]])});
  assert.equal(button.material.color.getHexString(),'ffffff');
  const custom=recipe(1,'cool');custom.material.pressBlue='#ff4400';custom.material.customActiveColor=true;
  applyPbrRecipeToRig(rig,custom,{values:new Map([['b1',1]])});
  assert.equal(button.material.color.getHexString(),'ff4400');
 }finally{disposeNativeRig(rig)}
});

test('controller artwork is UV-bound to existing geometry with no floating planes',async()=>{
 assert.equal(typeof artwork.applyControllerArtwork,'function');
 const rig=await rigFor('DualSenseCompact');
 try{
  const marks=rig.meshes.filter(m=>m.userData.artworkKey);
  assert.equal(marks.length,8);
  for(const mesh of marks){
   assert.equal(mesh.userData.surfaceArtwork,'button-material');
   assert.equal(mesh.geometry.getAttribute('controllerMarkUv').count,mesh.geometry.getAttribute('position').count);
  }
 }finally{disposeNativeRig(rig)}
});

test('consolidated material stays on the standard physical shader on fresh source rigs',async()=>{
 const rig=await rigFor('DualSenseCompact');
 try{
  applyPbrRecipeToRig(rig,recipe(),{});
  assert.ok(rig.meshes.every(m=>!m.material.userData.exoGhostFresnelUniform));
 }finally{disposeNativeRig(rig)}
});

test('source SVG paths and full transforms paint faces and D-pad without floating menu labels',async()=>{
 const text=await fs.readFile(new URL('../references/controllers/dualsense/source.svg',import.meta.url),'utf8');
 const paths=new Map(),matrices=[];
 const groups=new Map();
 for(const [,key,body]of text.matchAll(/<g id="btn-([^\"]+)"[^>]*>([\s\S]*?)<\/g>/g)){
  const marks=[];
  for(const [,attributes]of body.matchAll(/<path\s+([^>]*class="glyph"[^>]*)\/?\s*>/g)){
   const d=attributes.match(/\bd="([^\"]+)"/)?.[1];
   const transform=attributes.match(/\btransform="matrix\(([^)]+)\)"/)?.[1].split(/[ ,]+/).map(Number)||[1,0,0,1,0,0];
   if(!d)continue;
   const [a,b,c,e1,e,f]=transform;
   marks.push({getAttribute:n=>n==='d'?d:null,getBBox:()=>({x:140,y:70,width:1,height:1}),
    getCTM:()=>({a,b,c,d:e1,e,f}),style:{fill:'white'}});
  }
  if(marks.length){paths.set(key,marks.map(n=>n.getAttribute('d')));groups.set(key,{querySelectorAll:()=>marks,
   querySelector:()=>({getBBox:()=>({x:0,y:0,width:40,height:40})})});}
 }
 const recorded=[];
 const oldDocument=globalThis.document,oldPath=globalThis.Path2D;
 const ctx={clearRect(){},translate(){},scale(){},save(){},restore(){},stroke(){},fill(){},
  transform(...v){matrices.push(v);}};
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 globalThis.Path2D=class{constructor(d){recorded.push(d)}};
 const rig=await rigFor('DualSenseCompact');
 try{
  const count=artwork.applyControllerArtwork(rig,{querySelector:s=>groups.get(s.match(/btn-([^"\]]+)/)?.[1])});
  assert.equal(count,8,'all four faces and D-pad directions, no floating menus');
  for(const key of ['cross','circle','square','triangle','up','left','right','down'])
   assert.ok(paths.get(key).every(d=>recorded.includes(d)),key+' unchanged authored path');
  assert.ok(matrices.some(m=>m[0]>10&&m[4]<-1300),'source CTM reaches canvas');
  const labels=[];rig.group.traverse(n=>{if(n.userData.aboveButton)labels.push(n)});
  assert.equal(labels.length,0);
  assert.ok(labels.every(n=>n.visible&&n.userData.artworkSource==='2d-svg'));
 }finally{
  disposeNativeRig(rig);globalThis.document=oldDocument;globalThis.Path2D=oldPath;
 }
});

test('hidden active fill rejects back faces so exposed controls cannot fill against their own front depth',async()=>{
 const rig=await rigFor('DualSenseCompact');
 try{
  prepareGhostOcclusion(rig);
  applyPbrRecipeToRig(rig,resolveLabRecipe('white',1),{triggers:{left:1}});
  const left=rig.rearHintLines.find(h=>h.parent.userData.sourceFile==='left_trigger.obj');
  assert.ok(left.userData.hiddenFill.visible);
  assert.equal(left.userData.hiddenFill.material.depthFunc,THREE.GreaterDepth);
  assert.equal(left.userData.hiddenFill.material.side,left.parent.material.side);
  assert.equal(left.userData.hiddenFill.material.side,THREE.FrontSide);
 }finally{disposeNativeRig(rig)}
});

test('consolidated physical control roughness equals its portable recipe while archived roughness keeps its offset',async()=>{
 const rig=await rigFor('DualSenseCompact');
 try{
  const current=resolveLabRecipe('white',1);
  applyPbrRecipeToRig(rig,current,{});
  assert.equal(mesh(rig,'a_button.obj').material.roughness,.64);
  assert.equal(mesh(rig,'left_cap.obj').material.roughness,current.material.controls.roughness);
  assert.equal(mesh(rig,'top_shell.obj').material.roughness,current.material.shell.roughness);
  const archived=resolveHeroRecipe('ghost',1);
  applyPbrRecipeToRig(rig,archived,{});
  assert.equal(mesh(rig,'a_button.obj').material.roughness,Math.min(1,archived.material.controls.roughness+.06));
 }finally{disposeNativeRig(rig)}
});

test('disposing a real instanced rig dispatches exactly one dispose event per instance and shared resource',async()=>{
 const rig=await rigFor('DualSenseCompact');
 instantiateStickPairs(rig);
 const instances=rig.stickInstances.map(p=>p.instance);
 assert.ok(instances.length>0,'actual native stick pairs must be instanced');
 const counts=new Map();
 const track=resource=>{
  if(counts.has(resource))return;
  counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
 };
 for(const instance of instances){
  instance.setColorAt(0,new THREE.Color('#ffffff'));
  track(instance);
 }
 for(const m of rig.meshes){track(m.geometry);track(m.material);}
 // A rig's bookkeeping can reference the same live instance more than once.
 // GPU-owned instance attributes and shared geometry/material must each free once.
 rig.meshes.push(instances[0]);
 disposeNativeRig(rig);
 for(const instance of instances)assert.equal(counts.get(instance),1,'instance GPU resource dispose event');
 for(const [resource,count]of counts)assert.equal(count,1,`${resource.type} disposed exactly once`);
});

test('front-projected authored caps follow screen axes on both sticks and preserve click travel and neutral pose',async()=>{
 for(const id of ['DualSenseCompact','XboxOneClean','Gamecube','GenericPro']){
  const rig=await rigFor(id);
  try{
   const centers=()=>Object.fromEntries(['left','right'].map(side=>[
    side,new THREE.Box3().setFromObject(mesh(rig,`${side}_cap.obj`)).getCenter(new THREE.Vector3())]));
   rig.group.updateMatrixWorld(true);
   const rest=centers();
   const restMatrices=['left','right'].map(side=>mesh(rig,`${side}_cap.obj`).matrixWorld.clone());
   for(const [axis,axes]of [['x',{x:1,y:0}],['y',{x:0,y:1}]]){
    applyStickPoseToRig(rig,{left:axes,right:axes});rig.group.updateMatrixWorld(true);
    const moved=centers();
    for(const side of ['left','right']){
     const delta=moved[side].clone().sub(rest[side]);
     if(axis==='x')assert.ok(delta.x>1e-4,`${id} ${side}: positive input X moves right; delta ${delta.toArray()}`);
     else assert.ok(delta.y<-1e-4,`${id} ${side}: positive input Y moves down; delta ${delta.toArray()}`);
    }
   }
   const axes={x:.6,y:.3};
   applyStickPoseToRig(rig,{left:axes,right:axes});rig.group.updateMatrixWorld(true);
   const moving=centers();
   applyStickPoseToRig(rig,{left:{...axes,click:true},right:{...axes,click:true}});
   rig.group.updateMatrixWorld(true);
   const clicked=centers();
   for(const side of ['left','right']){
    const delta=clicked[side].clone().sub(moving[side]);
    assert.ok(Math.abs(delta.x)<1e-12&&Math.abs(delta.y)<1e-12,`${id} ${side}: click keeps screen axes`);
    if(stickMechanics(id,side).clickTravel>0)assert.ok(delta.z<0,`${id} ${side}: click travels into controller`);
    else assert.ok(delta.length()<1e-12,`${id} ${side}: authored zero click travel`);
   }
   applyStickPoseToRig(rig,{});rig.group.updateMatrixWorld(true);
   ['left','right'].forEach((side,i)=>assert.ok(mesh(rig,`${side}_cap.obj`).matrixWorld.equals(restMatrices[i]),
    `${id} ${side}: exact neutral return`));
  }finally{disposeNativeRig(rig)}
 }
});
