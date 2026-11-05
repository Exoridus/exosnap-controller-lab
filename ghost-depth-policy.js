// One-pass physical transparency occlusion: the front housing writes depth
// before translucent controls, so rear controls cannot pre-blend through it.
// No model copy, CPU readback, or postprocess; real depth is authoritative.
import * as THREE from 'three';
import {isHousingRole} from './model-semantics.js';
import {makeRearHint} from './v24-rear-hints.js';
import {EXO_PALETTE} from './palette.js';
export function depthPriority(role,file=''){
  const n=String(file).toLowerCase();
  if(isHousingRole(role)){
    if(/(^|[+/])top_shell[.]obj|front[_-]?shell/i.test(n))return -60;
    if(/(^|[+/])bottom_shell[.]obj|back[_-]?shell/i.test(n))return -50;
    return -45;
  }
  // The moving tip must write depth BEFORE the stationary well is blended.
  // Otherwise the earlier, already blended well remains visible through the cap.
  if(role==='stick-cap')return -85;
  if(role==='stick-pivot')return -82;
  if(role==='stick-stem')return -78;
  if(role==='stick-base'||role==='stick-well')return -40;
  return 0;
}
export function prepareGhostOcclusion(native,{rearHints=true}={}){
  if(!native?.meshes)throw new TypeError('Expected a native controller rig');
  for(const mesh of native.meshes){
    mesh.renderOrder=depthPriority(mesh.userData.role,mesh.userData.sourceFile);
    mesh.material.depthTest=true;
    mesh.material.depthWrite=true;
    mesh.material.depthFunc=THREE.LessEqualDepth;
  }
  if(!rearHints||native.rearHintLines)return native;
  native.rearHintLines=[];
  for(const mesh of native.meshes){
    if(!mesh.visible||!mesh.geometry||mesh.isInstancedMesh)continue;
    const role=mesh.userData.role,key=mesh.userData.control;
    const hint=makeRearHint(mesh,role,key,0);
    if(!hint)continue;
    hint.material.color.set(EXO_PALETTE.idleControl);
    hint.visible=false;
    // GreaterDepth reveals ONLY fragments physically hidden by the shell.
    hint.material.depthTest=true;
    hint.material.depthFunc=THREE.GreaterDepth;
    hint.material.depthWrite=false;
    hint.renderOrder=30;
    mesh.add(hint);
    native.rearHintLines.push(hint);
  }
  return native;
}
export function updateGhostRearHints(native,recipe){
  if(!native?.rearHintLines)return;
  const mix=Number(recipe?.mix)||0;
  const ghostStyle=recipe?.variant==='ghost'||recipe?.variant==='outline';
  const visibility=ghostStyle?Math.min(.22,Math.max(0,(mix-.56)/.44)*.22):0;
  for(const hint of native.rearHintLines){
    hint.visible=visibility>.005;
    hint.material.opacity=visibility;
  }
}
// Fat Line shaders need pixel-size viewport uniforms; an unconfigured
// 1×1 resolution produces wildly oversized dashed rear silhouettes.
export function setRearHintViewport(native,width,height){
  const w=Math.max(1,Math.round(Number(width)||1));
  const h=Math.max(1,Math.round(Number(height)||1));
  for(const hint of native?.rearHintLines||[])hint.material.resolution.set(w,h);
}

// Hide complete rear-facing trigger/paddle surfaces in front-facing Ghost;
// their optional dashed line children are still rendered against housing depth.
// The rear view restores original physical meshes. Called after material updates.
export function hideOccludedRearControls(native,recipe,{yaw=0}={}){
  if(!native?.meshes)return;
  const ghost=(recipe?.variant==='ghost'||recipe?.variant==='outline');
  const frontAngle=Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)));
  const occluded=ghost&&Number(recipe.mix)>.28&&frontAngle<.87;
  for(const mesh of native.meshes){
    const rear=['trigger','paddle'].includes(mesh.userData.role);
    if(!rear)continue;
    // A visible bumper is not automatically a rear-only trigger.
    mesh.material.colorWrite=!occluded;
    mesh.material.depthWrite=!occluded;
  }
}
