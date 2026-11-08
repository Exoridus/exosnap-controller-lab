// Small renderer-neutral contract for the final browser/Qt comparison.
// Variants differ only in active feedback; every neutral material is shared.
import {resolveHeroRecipe,qtQuickDescriptor} from './pbr-recipes.js';

export const LAB_VARIANTS=Object.freeze([
  Object.freeze({key:'white',name:'Weiß',description:'Originalfarben · weiße aktive Eingaben'}),
  Object.freeze({key:'cool',name:'Blauweiß',description:'Gleicher Controller · kühler Akzent auf hellen aktiven Tasten'})
]);
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(Number(x))?Number(x):0));
const blend=(a,b,t)=>a+(b-a)*t;
function opacityAt(mix,middle,end){
  if(mix===0)return 1;
  if(mix===1)return end;
  const t=mix<.5?mix*2:(mix-.5)*2;
  const smooth=t*t*(3-2*t);
  return mix<.5?blend(1,middle,smooth):blend(middle,end,smooth);
}
export function resolveLabRecipe(feedback='white',mix=1){
  if(!LAB_VARIANTS.some(v=>v.key===feedback))throw new RangeError('Unknown active-feedback comparison');
  const t=clamp(mix),base=resolveHeroRecipe('identity',t);
  const shell={...base.material.shell,opacity:opacityAt(t,.32,.10),
    originalColorWeight:1,roughness:.58,metalness:0,clearcoat:.09};
  const controls={...base.material.controls,opacity:opacityAt(t,.48,.25),
    originalColorWeight:1,idleTintWeight:0,roughness:.64,metalness:0,clearcoat:.09};
  return {...base,name:LAB_VARIANTS.find(v=>v.key===feedback).name,
    comparisonVariant:feedback,consolidated:true,activeContrast:feedback,
    environmentIntensity:.92,
    // Standard PBR + a shared alpha-edge compositor; no per-material Fresnel patch.
    ghostFresnel:{strength:0,source:'standard PBR'},
    hiddenIndicators:{enabled:true,idleOpacity:.28,activeOpacity:.90,activeFillOpacity:.12},
    material:{...base.material,shell,controls,supportOpacity:shell.opacity,
      pressBlue:'#ffffff',defaultPressBlue:'#ffffff',pressEmissive:'#ffffff',
      pressOpacity:1,pressEmissiveIntensity:.16}
  };
}

// The 2D key deliberately describes only 2D appearance inputs. Orbit, zoom,
// material mix and active-feedback comparison do not invalidate SVG paint.
export function flatAppearanceKey(pose,color='#ffffff'){
  const axis=s=>[Number(s?.x)||0,Number(s?.y)||0,Boolean(s?.click)];
  const values=[...(pose?.values||new Map())].filter(([,v])=>v>0).sort(([a],[b])=>a.localeCompare(b));
  return JSON.stringify([color,values,axis(pose?.left),axis(pose?.right)]);
}

export function qtLabDescriptor(recipe){
  const base=qtQuickDescriptor(recipe);
  return {...base,
    comparisonVariant:recipe.comparisonVariant,
    activeContrast:recipe.activeContrast,
    nativeValidated:false,
    stickPolicy:{ring:'analog magnitude',cap:'L3/R3 click only',support:'neutral shell opacity',
      pose:'rotate authored parent; cap and stem inherit the same motion'},
    flat2D:{mode:'ghost',independentOf3DMix:true,shellOpacity:0,
      controlOpacity:.26,activeOpacity:.40,activeColor:'#ffffff',
      contrast:'achromatic controls: light on dark, dark on light, paired edges on mixed',
      decoration:'authored paths, no input feedback'},
    hiddenControls:{visibility:'physical-depth',dashed:true,individualInput:true,
      ...recipe.hiddenIndicators,
      qtPort:'requires a depth-aware overlay pass/custom material; not a built-in PrincipledMaterial toggle'},
    geometryReuse:'share proven equivalent buffers; instance only equal final material states',
    calibrationNotes:[...base.calibrationNotes,
      'A single standard PBR recipe serves both feedback choices; no Fresnel shader patch.',
      'Hidden-line depth comparison and the shared alpha-edge compositor need explicit Qt implementations and native visual validation.']
  };
}
