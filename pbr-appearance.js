// Browser-independent PBR material applicator for actual native OBJ meshes.
// Mutate existing materials, not source geometry, when Materialmix or poses change.
import * as THREE from 'three';
import {isHousingRole} from './model-semantics.js';
import {normalizeStickInput,stickVisualState} from './stick-activity.js';
import {updateStickInstances} from './pbr-optimizer.js';
import {depthPriority,updateGhostRearHints} from './ghost-depth-policy.js';
import {EXO_PALETTE} from './palette.js';
import {setGhostFresnel} from './pbr-fresnel.js';
const pressedBlue=new THREE.Color(EXO_PALETTE.pressedBlue);
const ghostColor=new THREE.Color();
const idleColor=new THREE.Color();
const neutralStickColor=new THREE.Color(EXO_PALETTE.neutralStick);
const neutralSocketColor=new THREE.Color(EXO_PALETTE.neutralStickSocket);
const neutralTriggerColor=new THREE.Color(EXO_PALETTE.neutralTrigger);
const tmpEuler=new THREE.Euler();
const clamp01=x=>Math.max(0,Math.min(1,Number.isFinite(Number(x))?Number(x):0));
function normalizeVisualInput(input){
  if(typeof input==='boolean')return {allPressed:input,left:normalizeStickInput(),right:normalizeStickInput(),
    triggers:{left:input?1:0,right:input?1:0}};
  const allPressed=!!input?.allPressed;
  return {allPressed,left:normalizeStickInput(input?.left),right:normalizeStickInput(input?.right),
    triggers:{left:allPressed?1:clamp01(input?.triggers?.left??0),
      right:allPressed?1:clamp01(input?.triggers?.right??0)}};
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
    if(!unlit&&!control)setGhostFresnel(m,recipe.ghostFresnel?.strength||0);
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
    const hero=Boolean(recipe.environmentProbe);
    const restAlpha=Math.max(spec.opacity,.52);
    const litAlpha=Math.max(restAlpha,.72);
    const gentleEmissive=(amount)=>{
      if(unlit)return;
      m.emissive.set(recipe.material.pressEmissive);
      m.emissiveIntensity=hero?.22*amount:recipe.material.pressEmissiveIntensity*amount;
    };
    const stickPart=['stick-stem','stick-cap','stick-pivot'].includes(mesh.userData.role);
    const stick=stickPart?pose[relevantStick(mesh.userData.sourceFile)]:null;
    if(stick){
      const state=stickVisualState(stick);
      if(hero){
        if(mesh.userData.role==='stick-pivot'){
          // The authored MOVING ring visualizes analog travel.
          m.color.copy(neutralSocketColor).lerp(pressedBlue,state.moving);
          m.opacity=restAlpha+(litAlpha-restAlpha)*state.moving;
          if(state.moving>.01)gentleEmissive(state.moving*.5);
        }else if(mesh.userData.role==='stick-cap'){
          // L3/R3 affects ONLY the cap center, independently from motion.
          m.color.copy(state.click||pose.allPressed?pressedBlue:neutralStickColor);
          m.opacity=state.click||pose.allPressed?litAlpha:restAlpha;
          if(state.click||pose.allPressed)gentleEmissive(1);
        }else{
          // Shaft/socket never brighten merely because a stick is clicked.
          m.color.copy(neutralSocketColor);m.opacity=restAlpha;
        }
      }else{
        // Keep historical A-H experiments unchanged for comparison.
        if(mesh.userData.role==='stick-cap'){
          m.color.copy(neutralStickColor).lerp(pressedBlue,state.moving);
          m.opacity=Math.min(1,Math.max(spec.opacity,.52)+(1-Math.max(spec.opacity,.52))*state.moving);
        }else{
          m.color.copy(neutralSocketColor);m.opacity=restAlpha;
        }
        if(state.click||pose.allPressed){
          m.color.copy(pressedBlue);m.opacity=1;
          if(!unlit){m.roughness=Math.min(m.roughness,.42);gentleEmissive(1);}
        }
      }
    }else if(mesh.userData.role==='trigger'){
      const side=relevantStick(mesh.userData.sourceFile);
      const amount=pose.triggers[side]??0;
      m.color.copy(neutralTriggerColor).lerp(pressedBlue,amount);
      m.opacity=hero?restAlpha+(litAlpha-restAlpha)*amount:
        Math.max(spec.opacity,.72)+(1-Math.max(spec.opacity,.72))*amount;
      if(amount>0)gentleEmissive(hero?amount:amount*.65);
    }else if(control&&(pose.allPressed&&mesh.userData.control)){
      m.color.copy(pressedBlue);
      m.opacity=hero?litAlpha:1;
      if(!unlit){
        if(hero)m.roughness=Math.max(m.roughness,.55);
        else m.roughness=Math.min(m.roughness,.42);
        gentleEmissive(1);
      }
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
