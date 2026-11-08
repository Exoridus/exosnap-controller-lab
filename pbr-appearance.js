import {CONTROL_NEUTRAL,isStructuralRole,isInteractiveRole,softenedLegendColor,supportOpacityFor} from './controller-visual-policy.js';
import {updateRimSurface} from './control-surface-material.js';
// Browser-independent PBR material applicator for actual native OBJ meshes.
// Mutate existing materials, not source geometry, when Materialmix or poses change.
import * as THREE from 'three';
import {isHousingRole} from './model-semantics.js';
import {normalizeStickInput,stickVisualState} from './stick-activity.js';
import {updateStickInstances} from './pbr-optimizer.js';
import {depthPriority,updateGhostRearHints} from './ghost-depth-policy.js';
import {EXO_PALETTE} from './palette.js';
import {setGhostFresnel} from './pbr-fresnel.js';
import {stickMechanics,triggerMechanics} from './model-mechanics.js';
import {pressTravelFor} from './v24-policy.js';
import {frontFaceTransform} from './model-orientation.js';
const pressedBlue=new THREE.Color(EXO_PALETTE.pressedBlue);
const ghostColor=new THREE.Color();
const idleColor=new THREE.Color();
const tmpEuler=new THREE.Euler();
const feedbackColor=new THREE.Color();
const stickPoseRotation=new THREE.Quaternion();
const white=new THREE.Color('#ffffff');
const neutralControl=new THREE.Color(CONTROL_NEUTRAL);
const supportColor=new THREE.Color();
const ghostLegend=new THREE.Color('#aab2ba');
const clamp01=x=>Math.max(0,Math.min(1,Number.isFinite(Number(x))?Number(x):0));
function normalizeVisualInput(input){
  if(input?.normalized===true)return input;
  if(typeof input==='boolean')return {allPressed:input,left:normalizeStickInput(),right:normalizeStickInput(),
    triggers:{left:input?1:0,right:input?1:0}};
  const allPressed=!!input?.allPressed;
  const values=input?.values instanceof Map?input.values:new Map(Object.entries(input?.values||{}));
  const left=normalizeStickInput(input?.left),right=normalizeStickInput(input?.right);
  left.click=left.click||!!values.get('ls');right.click=right.click||!!values.get('rs');
  return {allPressed,left,right,values,
    triggers:{left:allPressed?1:Math.max(clamp01(input?.triggers?.left??0),clamp01(values.get('l2'))),
      right:allPressed?1:Math.max(clamp01(input?.triggers?.right??0),clamp01(values.get('r2')))}};
}
function relevantStick(file){
  const n=String(file).toLowerCase();
  if(!/(?:left|right)/.test(n))return null;
  return n.includes('left')?'left':'right';
}
function consolidatedFeedback(recipe,sourceColor){
  const specified=new THREE.Color(recipe.material.pressBlue||'#ffffff');
  const baseline=recipe.material.defaultPressBlue;
  const custom=recipe.material.customActiveColor??(baseline
    ?!specified.equals(new THREE.Color(baseline))
    :!specified.equals(white)&&!specified.equals(new THREE.Color(EXO_PALETTE.pressedBlue)));
  if(custom)return feedbackColor.copy(specified);
  // The option changes input feedback only. Dark source parts always receive
  // white; a bright source surface may receive cool color inversely to mix.
  const luminance=.2126*sourceColor.r+.7152*sourceColor.g+.0722*sourceColor.b;
  return feedbackColor.copy(white).lerp(pressedBlue.set(EXO_PALETTE.pressedBlue),
    recipe.activeContrast==='cool'&&luminance>.55?1-clamp01(recipe.mix):0);
}
export function applyPbrRecipeToRig(native,recipe,input=false){
  if(!native?.meshes||!recipe?.material)throw Error('Expected native rig and a PBR recipe');
  const pose=normalizeVisualInput(input);
  // Semantic supports use the same shell-linked rule on every family. The
  // source material and hierarchy survive. A split-color shell can nominate
  // its physical support region in the original part manifest.
  const integrateSupports=recipe.material.supportShellBlend;
  if(integrateSupports&&!native.supportShellColor){
    const shell=native.meshes.find(m=>m.userData.sourceFile==='top_shell.obj')||
      native.meshes.find(m=>isHousingRole(m.userData.role));
    if(shell)native.supportShellColor=shell.userData.sourceColor.clone();
  }
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
    if(!unlit&&!control&&(!recipe.consolidated||m.userData.exoGhostFresnelUniform))
      setGhostFresnel(m,recipe.consolidated?0:recipe.ghostFresnel?.strength||0);
    if(!unlit){
      m.roughness=control&&!recipe.consolidated?Math.min(1,spec.roughness+.06):spec.roughness;
      m.metalness=spec.metalness;
      m.clearcoat=spec.clearcoat;
      m.clearcoatRoughness=spec.clearcoatRoughness;
      m.ior=spec.ior;
    }
    m.opacity=spec.opacity;
    mesh.renderOrder=depthPriority(mesh.userData.role,mesh.userData.sourceFile);
    m.depthTest=true;
    m.depthWrite=true;
    m.colorWrite=true;
    m.transparent=true;
    // The offscreen image represents the nearest physical surface, not X-ray
    // glass. Source-over inside the rig accumulated overlapping shell/support
    // faces before depth was final (dark dishes and shoulder seams). Replace
    // RGBA at passing fragments, then composite the single premultiplied image.
    // Existing rear hints remain ordinary depth-tested overlays afterward.
    const premultiplied=Boolean(recipe.consolidated);
    if(m.premultipliedAlpha!==premultiplied){m.premultipliedAlpha=premultiplied;m.needsUpdate=true;}
    m.blending=recipe.consolidated?THREE.NoBlending:THREE.NormalBlending;
    if(!unlit){m.emissive.setRGB(0,0,0);m.emissiveIntensity=0;}
    // Author-owned source colors define neutral hardware, not an almost-white
    // global stick/trigger palette. Applies to Joy-Con, Pro, DualSense etc.
    const filename=String(mesh.userData.sourceFile||'').toLowerCase();
    const stickPart=['stick-stem','stick-cap','stick-pivot'].includes(mesh.userData.role);
    if(recipe.consolidated){
      const role=mesh.userData.role;
      const support=isStructuralRole(role);
      const t=clamp01(recipe.mix),blend=t*t*(3-2*t);
      m.color.copy(mesh.userData.sourceColor);
      if(isInteractiveRole(role))m.color.lerp(neutralControl,blend);
      m.opacity=support?(integrateSupports?supportOpacityFor(recipe.material,cached.supportCoverage):recipe.material.shell.opacity):spec.opacity;
      if(support&&integrateSupports&&native.supportShellColor){
        m.color.lerp(cached.supportShellColor||native.supportShellColor,blend);
        if(!unlit){
          for(const key of ['roughness','metalness','clearcoat','clearcoatRoughness','ior'])
            m[key]=spec[key]+(recipe.material.shell[key]-spec[key])*blend;
        }
      }
      let amount=0;
      const side=relevantStick(mesh.userData.sourceFile);
      if(role==='stick-pivot'&&side)amount=pose.allPressed?1:stickVisualState(pose[side]).moving;
      else if(role==='stick-cap'&&side)amount=pose.allPressed||pose[side].click?1:0;
      else if(role==='trigger')amount=pose.triggers[side]??clamp01(pose.values?.get(mesh.userData.control));
      else if(control&&!support&&mesh.userData.control)amount=pose.allPressed?1:clamp01(pose.values?.get(mesh.userData.control));
      if(amount>0){
        const active=consolidatedFeedback(recipe,mesh.userData.sourceColor);
        m.color.lerp(active,amount);
        m.opacity+=(Math.max(m.opacity,recipe.material.pressOpacity??1)-m.opacity)*amount;
        if(!unlit){
          m.emissive.copy(active);
          m.emissiveIntensity=(recipe.material.pressEmissiveIntensity??.16)*amount;
        }
      }
      // Lower ring sidewall belongs to the support, not the analog indicator.
      supportColor.copy(mesh.userData.sourceColor).lerp(cached.supportShellColor||native.supportShellColor||mesh.userData.sourceColor,blend);
      updateRimSurface(m,true,supportColor,supportOpacityFor(recipe.material,isHousingRole(role)?1:cached.supportCoverage));
      const marking=m.userData.surfaceMarking;
      if(marking){
        marking.ink.value.set(softenedLegendColor('#'+m.color.getHexString())).lerp(ghostLegend,1-m.opacity);
        marking.coverage.value=.72;
      }
      continue;
    }
    updateRimSurface(m,false,m.color,m.opacity);
    const physicalShoulder=mesh.userData.role==='trigger'||
      /^(?:left|right)_bumper[.]obj$/.test(filename);
    if(stickPart||physicalShoulder)m.color.copy(mesh.userData.sourceColor);
    const hero=Boolean(recipe.environmentProbe);
    const restAlpha=Math.max(spec.opacity,.52);
    const litAlpha=Math.max(restAlpha,.72);
    const gentleEmissive=(amount)=>{
      if(unlit)return;
      m.emissive.set(recipe.material.pressEmissive);
      m.emissiveIntensity=hero?.22*amount:recipe.material.pressEmissiveIntensity*amount;
    };
    const stick=stickPart?pose[relevantStick(mesh.userData.sourceFile)]:null;
    if(stick){
      const state=stickVisualState(stick);
      if(hero){
        if(mesh.userData.role==='stick-pivot'){
          // The authored MOVING ring visualizes analog travel.
          m.color.copy(mesh.userData.sourceColor).lerp(pressedBlue,state.moving);
          m.opacity=restAlpha+(litAlpha-restAlpha)*state.moving;
          if(state.moving>.01)gentleEmissive(state.moving*.5);
        }else if(mesh.userData.role==='stick-cap'){
          // L3/R3 affects ONLY the cap center, independently from motion.
          m.color.copy(state.click||pose.allPressed?pressedBlue:mesh.userData.sourceColor);
          m.opacity=state.click||pose.allPressed?litAlpha:restAlpha;
          if(state.click||pose.allPressed)gentleEmissive(1);
        }else{
          // Shaft/socket never brighten merely because a stick is clicked.
          m.color.copy(mesh.userData.sourceColor);m.opacity=restAlpha;
        }
      }else{
        // Keep historical A-H experiments unchanged for comparison.
        if(mesh.userData.role==='stick-cap'){
          m.color.copy(mesh.userData.sourceColor).lerp(pressedBlue,state.moving);
          m.opacity=Math.min(1,Math.max(spec.opacity,.52)+(1-Math.max(spec.opacity,.52))*state.moving);
        }else{
          m.color.copy(mesh.userData.sourceColor);m.opacity=restAlpha;
        }
        if(state.click||pose.allPressed){
          m.color.copy(pressedBlue);m.opacity=1;
          if(!unlit){m.roughness=Math.min(m.roughness,.42);gentleEmissive(1);}
        }
      }
    }else if(mesh.userData.role==='trigger'){
      const side=relevantStick(mesh.userData.sourceFile);
      const amount=pose.triggers[side]??0;
      m.color.copy(mesh.userData.sourceColor).lerp(pressedBlue,amount);
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
  updateGhostRearHints(native,recipe,pose);
}
export function applyStickPoseToRig(native,input){
  const pose=normalizeVisualInput(input);
  if(!native?.parts)return;
  const front=frontFaceTransform(native.model?.source||'co');
  const frontSign=Math.sign(Math.sin(front.rotationX));
  for(const side of ['left','right']){
    const stem=native.parts.find(p=>p.file===`${side}_stick.obj`)?.holder;
    const ring=native.parts.find(p=>p.file===`${side}_ring.obj`)?.holder;
    // CO's authored cap and stem are siblings below the moving ring. Rotate
    // that assembly once, so the cap follows the shaft without double tilt.
    const holder=ring&&stem?.parent===ring?ring:stem;
    if(!holder)continue;
    if(!holder.userData.restQuaternion)holder.userData.restQuaternion=holder.quaternion.clone();
    if(!holder.userData.restPosition)holder.userData.restPosition=holder.position.clone();
    const s=pose[side];
    const mechanics=stickMechanics(native.model?.id,side);
    const tilt=mechanics.maxTiltDeg*Math.PI/180;
    // Raw input is screen X right / Y down. The source front-face rotation
    // maps screen Y rotation to local -Z for CO/Exo (+PI/2), +Z for PadForge.
    // Positive screen Y rotates around +X, moving the cap down in front view.
    const q=stickPoseRotation.setFromEuler(tmpEuler.set(s.y*tilt,0,-s.x*tilt*frontSign));
    holder.quaternion.copy(holder.userData.restQuaternion).multiply(q);
    holder.position.copy(holder.userData.restPosition);
    if(s.click)holder.position.y-=mechanics.clickTravel;
  }
}

// Restore the v40 artifact's highlightPart mechanics in the existing PBR rig.
// Pose only: materials and child-attached contours/markings remain independent.
const controlRotation=new THREE.Quaternion();
export function applyControlPoseToRig(native,input={}){
  if(!native?.parts)return;
  applyStickPoseToRig(native,input);
  if(!native.controlMotionBindings){
    const mechanism=triggerMechanics(native.model?.id);
    native.controlMotionBindings=native.parts.filter(p=>p.holder.userData.control&&
      !p.holder.userData.role.startsWith('stick-')).map(p=>{
      const key=p.holder.userData.control,trigger=key==='l2'||key==='r2';
      const travel=trigger?{x:0,y:0,z:0}:pressTravelFor(key,native.model.source==='padforge'?'padforge':'co');
      if(trigger&&mechanism.translation)[travel.x,travel.y,travel.z]=mechanism.translation;
      return {holder:p.holder,key,trigger,travel,
        angle:trigger?-mechanism.maxRotationDeg*Math.PI/180:0,
        rest:p.holder.position.clone(),rotation:p.holder.quaternion.clone()};
    });
  }
  for(const b of native.controlMotionBindings){
    const raw=input?.values instanceof Map?input.values.get(b.key):input?.values?.[b.key];
    const analog=b.key==='l2'?input?.triggers?.left:b.key==='r2'?input?.triggers?.right:0;
    const amount=input===true||input?.allPressed?1:Math.max(clamp01(raw),clamp01(analog));
    b.holder.position.set(b.rest.x+b.travel.x*amount,b.rest.y+b.travel.y*amount,b.rest.z+b.travel.z*amount);
    b.holder.quaternion.copy(b.rotation);
    if(b.angle)b.holder.quaternion.multiply(controlRotation.setFromEuler(tmpEuler.set(b.angle*amount,0,0)));
  }
}
