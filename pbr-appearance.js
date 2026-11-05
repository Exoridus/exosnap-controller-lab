// Browser-independent PBR material applicator for actual native OBJ meshes.
// Mutate existing materials, not source geometry, when Materialmix or poses change.
import * as THREE from 'three';
import {isHousingRole} from './model-semantics.js';
import {normalizeStickInput,stickVisualState} from './stick-activity.js';
import {updateStickInstances} from './pbr-optimizer.js';
import {depthPriority,updateGhostRearHints} from './ghost-depth-policy.js';
import {EXO_PALETTE} from './palette.js';
const pressedBlue=new THREE.Color(EXO_PALETTE.pressedBlue);
const ghostColor=new THREE.Color();
const idleColor=new THREE.Color();
const motionColor=new THREE.Color(EXO_PALETTE.movingControl);
const tmpEuler=new THREE.Euler();
function normalizeVisualInput(input){
  if(typeof input==='boolean')return {allPressed:input,left:normalizeStickInput(),right:normalizeStickInput()};
  return {allPressed:!!input?.allPressed,
    left:normalizeStickInput(input?.left),right:normalizeStickInput(input?.right)};
}
function relevantStick(file){
  const n=String(file).toLowerCase();
  if(!/(?:left|right)/.test(n))return null;
  return n.includes('left')?'left':'right';
}
export function applyPbrRecipeToRig(native,recipe,input=false){
  if(!native?.meshes||!recipe?.material)throw Error('Expected native rig and a PBR recipe');
  const pose=normalizeVisualInput(input);
  pressedBlue.set(recipe.material.pressBlue);
  for(const mesh of native.meshes){
    const cached=mesh.userData;
    const unlit=recipe.lightingMode==='unlit';
    if(!cached.pbrMaterial)cached.pbrMaterial=mesh.material;
    if(unlit&&!cached.unlitMaterial)cached.unlitMaterial=new THREE.MeshBasicMaterial({
      transparent:true,opacity:1,depthTest:true,depthWrite:true,side:THREE.FrontSide});
    const m=unlit?cached.unlitMaterial:cached.pbrMaterial;
    if(mesh.material!==m)mesh.material=m;
    // Fixed stick wells are part of the housing; movable cap, shaft and lip are Controls.
    const control=!isHousingRole(mesh.userData.role)&&mesh.userData.role!=='stick-base';
    const spec=control?recipe.material.controls:recipe.material.shell;
    m.color.copy(mesh.userData.sourceColor).lerp(ghostColor.set(spec.ghostTint),1-spec.originalColorWeight);
    if(control&&spec.idleTint&&spec.idleTintWeight)m.color.lerp(idleColor.set(spec.idleTint),spec.idleTintWeight);
    if(!unlit){
      m.roughness=control?Math.min(1,spec.roughness+.06):spec.roughness;
      m.metalness=spec.metalness;
      m.clearcoat=spec.clearcoat;
      m.clearcoatRoughness=spec.clearcoatRoughness;
      m.ior=spec.ior;
    }
    m.opacity=spec.opacity;
    mesh.renderOrder=depthPriority(mesh.userData.role,mesh.userData.sourceFile);
    m.depthTest=true;
    m.depthWrite=true;
    m.transparent=true;
    if(!unlit){m.emissive.setRGB(0,0,0);m.emissiveIntensity=0;}
    const stickPart=['stick-stem','stick-cap','stick-pivot'].includes(mesh.userData.role);
    const stick=stickPart?pose[relevantStick(mesh.userData.sourceFile)]:null;
    if(stick){
      const state=stickVisualState(stick);
      // Use an emissive-free colour boost for analog movement; physical click
      // uses the same muted blue as other controls, without forcing alpha=1.
      m.color.lerp(motionColor,state.moving*.22);
      if(state.click||pose.allPressed){
        m.color.copy(pressedBlue);
        m.opacity=1; // Bright opaque LED surface; no ghost translucency on press.
        if(!unlit){m.roughness=Math.min(m.roughness,.42);m.emissive.set(recipe.material.pressEmissive);m.emissiveIntensity=recipe.material.pressEmissiveIntensity;}
      }else m.opacity=Math.min(.88,spec.opacity+(1-spec.opacity)*state.opacityBoost);
    }else if(control&&(pose.allPressed&&mesh.userData.control)){
      m.color.copy(pressedBlue);
      m.opacity=1;
      if(!unlit){m.roughness=Math.min(m.roughness,.42);m.emissive.set(recipe.material.pressEmissive);m.emissiveIntensity=recipe.material.pressEmissiveIntensity;}
    }
  }
  updateStickInstances(native,pose);
  updateGhostRearHints(native,recipe);
}
export function applyStickPoseToRig(native,input){
  const pose=normalizeVisualInput(input);
  if(!native?.parts)return;
  for(const side of ['left','right']){
    const holder=native.parts.find(p=>p.file===`${side}_stick.obj`)?.holder;
    if(!holder)continue;
    if(!holder.userData.restQuaternion)holder.userData.restQuaternion=holder.quaternion.clone();
    if(!holder.userData.restPosition)holder.userData.restPosition=holder.position.clone();
    const s=pose[side];
    const q=new THREE.Quaternion().setFromEuler(tmpEuler.set(-s.y*.23,0,s.x*.23));
    holder.quaternion.copy(holder.userData.restQuaternion).multiply(q);
    holder.position.copy(holder.userData.restPosition);
    if(s.click)holder.position.y-=.008;
  }
}
