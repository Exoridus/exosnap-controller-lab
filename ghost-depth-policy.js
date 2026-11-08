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
    const hint=makeRearHint(mesh,role,key,0,{contrastLayers:true});
    if(!hint)continue;
    hint.material.color.set(EXO_PALETTE.idleControl);
    hint.visible=false;
    // GreaterDepth reveals ONLY fragments physically hidden by the shell.
    hint.material.depthTest=true;
    hint.material.depthFunc=THREE.GreaterDepth;
    hint.material.depthWrite=false;
    hint.renderOrder=31;
    mesh.add(hint);
    mesh.add(hint.userData.hiddenFill);
    mesh.add(hint.userData.hiddenOutline);
    native.rearHintLines.push(hint);
  }
  return native;
}
export function updateGhostRearHints(native,recipe,input={}){
  if(!native?.rearHintLines)return;
  const mix=Number(recipe?.mix)||0;
  const ghostStyle=recipe?.variant==='ghost'||recipe?.variant==='outline';
  const visibility=ghostStyle?Math.min(.22,Math.max(0,(mix-.56)/.44)*.22):0;
  for(const hint of native.rearHintLines){
    const key=hint.userData.control;
    const values=input?.values;
    const button=values instanceof Map?values.get(key):values?.[key];
    const trigger=key==='l2'?input.triggers?.left:key==='r2'?input.triggers?.right:0;
    const amount=input.allPressed?1:Math.max(0,Math.min(1,Number(button)||0));
    const active=Math.max(amount,Math.max(0,Math.min(1,Number(trigger)||0)));
    const policy=recipe?.consolidated&&recipe.hiddenIndicators?.enabled?recipe.hiddenIndicators:null;
    const alpha=policy?(policy.idleOpacity??.28)+((policy.activeOpacity??.90)-(policy.idleOpacity??.28))*active:visibility;
    hint.visible=alpha>.005;
    hint.material.opacity=alpha;
    hint.material.color.set(policy?'#ffffff':EXO_PALETTE.idleControl);
    if(policy&&active>0)hint.material.color.copy(hint.parent.material.color);
    const fill=hint.userData.hiddenFill;
    if(fill){
      fill.visible=!!policy&&active>0;
      fill.material.opacity=policy?(policy.activeFillOpacity??.12)*active:0;
      if(fill.visible)fill.material.color.copy(hint.parent.material.color);
    }
    const outline=hint.userData.hiddenOutline;
    if(outline){outline.visible=!!policy&&hint.visible;outline.material.opacity=alpha;}
  }
}
// Fat Line shaders need pixel-size viewport uniforms; an unconfigured
// 1×1 resolution produces wildly oversized dashed rear silhouettes.
export function setRearHintViewport(native,width,height){
  const w=Math.max(1,Math.round(Number(width)||1));
  const h=Math.max(1,Math.round(Number(height)||1));
  for(const hint of native?.rearHintLines||[]){
    hint.material.resolution.set(w,h);
    hint.userData.hiddenOutline?.material.resolution.set(w,h);
  }
}

// Compatibility entry point: physical depth tests decide each fragment. Never
// remove a whole trigger at a camera angle; its exposed edge must stay visible.
export function hideOccludedRearControls(native,recipe,view={}){
  if(!native?.meshes)return;
  for(const mesh of native.meshes){
    const rear=['trigger','paddle'].includes(mesh.userData.role);
    if(!rear)continue;
    // A visible bumper is not automatically a rear-only trigger.
    mesh.material.colorWrite=true;
    mesh.material.depthWrite=true;
  }
}
