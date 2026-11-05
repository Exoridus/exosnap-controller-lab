// Renderer-neutral Three.js / Qt Quick 3D comparison contract.
// Coordinates are measured in the same normalized, right-handed 3D model space.
// Units of light intensity and BRDF implementations are NOT numerically equivalent.
import {styleAt} from './style-mix.js';
import {EXO_PALETTE} from './palette.js';
import {resolve2DPaint} from './material-paint.js';
import {sceneContrastProfile} from './silhouette-composite.js';

const clamp=(x)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const blend=(a,b,t)=>a+(b-a)*t;
const v=(key,name,description,strategy,spec)=>Object.freeze({key,name,description,strategy,spec:Object.freeze(spec)});
export const PBR_VARIANTS=Object.freeze([
  v('a','Original PBR','Echte Modellfarben mit natürlichen Reflexionen; neutraler Studiolook.','pbr-natural',{
    ghost:'#cad2dd',retain:.55,roughness:[.68,.59],metalness:[.02,.02],clearcoat:[.12,.10],light:[22,1.0,2.6,.54],shellScale:1} ),
  v('b','Frosted Ghost','Matte, diffuse Oberfläche mit kühlem, transparentem Ghost-Charakter.','frosted',{
    ghost:'#bdcad7',retain:.18,roughness:[.72,.94],metalness:[0,0],clearcoat:[.10,.02],light:[17,1.25,2.0,.7],shellScale:1}),
  v('c','Smoked Glass','Rauchglas-Farbtönung, glatte Reflexionen und zurückhaltende Tiefenwirkung.','smoked',{
    ghost:'#647381',retain:.16,roughness:[.60,.19],metalness:[.0,.02],clearcoat:[.12,.9],light:[26,.72,3.2,.48],shellScale:1}),
  v('d','Edge Lighting','Formbetonung durch echte seitliche und rückwärtige Lichtquellen ohne Rim-Shader.','light-rig',{
    ghost:'#b8c3cf',retain:.31,roughness:[.72,.54],metalness:[0,0],clearcoat:[.14,.3],light:[15,.45,11.0,.42],shellScale:1}),
  v('e','Soft Studio','Breites, gleichmäßiges Licht und sanfte, matte Materialreflexionen.','soft-studio',{
    ghost:'#c2ccd3',retain:.28,roughness:[.84,.89],metalness:[0,0],clearcoat:[.06,.06],light:[10,1.8,2.0,1.1],shellScale:1}),
  v('f','Material Identity','Helle und dunkle Original-Gehäusebereiche bleiben auch im Ghost erkennbar.','source-identity',{
    ghost:'#bdc7d1',retain:.86,roughness:[.65,.74],metalness:[0,0],clearcoat:[.15,.12],light:[19,.9,3.3,.7],shellScale:1}),
  v('g','Unlit Clean','Ohne 3D-Lichter: Originalfarben, ruhige Transparenz und keine Lichtberechnung.','unlit-clean',{
    ghost:'#aeb9c6',retain:.62,roughness:[.8,.8],metalness:[0,0],clearcoat:[0,0],light:[0,0,0,0],shellScale:1,lightingMode:'unlit'}),
  v('h','Single-Key Ghost','Nur ein gerichtetes Licht; weniger plastischer Glanz und klarer Materialcharakter.','one-key',{
    ghost:'#c5ced6',retain:.72,roughness:[.74,.82],metalness:[0,0],clearcoat:[.06,.06],light:[0,1.55,0,0],shellScale:1,lightingMode:'pbr'}),
]);
// Two curated production candidates. The historic A-H studies remain available
// under ?variants=all and have not been deleted or silently redefined.
export const HERO_VARIANTS=Object.freeze([
  Object.freeze({key:'solid',name:'Environment Solid',description:'Echte Modellfarben und eine neutrale HDR-Umgebung; deckende Flächen, keine Szenenlampen.'}),
  Object.freeze({key:'ghost',name:'Environment Ghost',description:'Mattes IBL mit durchscheinendem Gehäuse und abgesetzten kühlen Controls.'}),
  Object.freeze({key:'outline',name:'Outline Ghost',description:'Unlit-Overlay, reduzierte Fläche und schmale echte Silhouettenkontur.'}),
  Object.freeze({key:'identity',name:'Hybrid Identity',description:'Quellfarben bleiben auch bei hoher Transparenz erkennbar; etwas lebendigere Controls.'}),
]);
export const HERO_ENVIRONMENT='./assets/studio-neutral.hdr';
export function resolveHeroRecipe(key,mix){
  if(!HERO_VARIANTS.some(v=>v.key===key))throw new Error(`Unknown hero recipe ${key}`);
  const t=clamp(Number(mix));
  const original=resolvePbrRecipe(key==='solid'?'a':key==='ghost'?'b':key==='outline'?'g':'f',t);
  const curve=styleAt(t),material={shell:{...original.material.shell},controls:{...original.material.controls}};
  const config={
    solid:{shell:blend(1,.82,t),control:blend(1,.93,t),retain:1,ghost:'#e1e4e9',idle:'#b1bfd0',roughness:.58,env:.92,outline:false},
    ghost:{shell:curve.shell*.78,control:Math.max(curve.control*.95,curve.shell+.12),retain:blend(1,.18,t),ghost:'#c7d4df',idle:'#b3d2e7',roughness:.92,env:1.08,outline:false},
    outline:{shell:curve.shell*.24,control:Math.max(curve.control*.82,curve.shell+.12),retain:blend(1,.05,t),ghost:'#c5d1dd',idle:'#9fc8e7',roughness:1,env:0,outline:true},
    identity:{shell:Math.max(curve.shell,.18+.36*(1-t)),control:Math.max(curve.control,.53),retain:blend(1,.90,t),ghost:'#b3c4d2',idle:'#91b5d5',roughness:.70,env:.85,outline:false}
  }[key];
  material.shell.opacity=clamp(config.shell);material.controls.opacity=clamp(Math.max(config.control,config.shell));
  for(const spec of [material.shell,material.controls]){
    spec.roughness=config.roughness;spec.metalness=key==='solid'?.02:0;
    spec.clearcoat=key==='identity'?.16:key==='solid'?.09:0;
    spec.originalColorWeight=config.retain;
    spec.ghostTint=config.ghost;
  }
  material.controls.ghostTint=key==='identity'?'#9caec6':config.idle;
  material.controls.idleTint=config.idle;
  material.controls.idleTintWeight=key==='solid'?.07*t:key==='identity'?.25*t:.40*t;
  const lights={...original.lights,
    ambient:{...original.lights.ambient,intensity:0},
    keyPoint:{...original.lights.keyPoint,intensity:0},
    fillDirectional:{...original.lights.fillDirectional,intensity:0},
    rimPoint:{...original.lights.rimPoint,intensity:0},
  };
  const name=HERO_VARIANTS.find(v=>v.key===key).name;
  return {...original,variant:key,name,
    description:HERO_VARIANTS.find(v=>v.key===key).description,
    strategy:config.outline?'outline-ghost':'environment-ibl',
    lightingMode:config.outline?'unlit':'ibl',
    environmentProbe:HERO_ENVIRONMENT,environmentIntensity:config.env,
    material:{...material,pressBlue:EXO_PALETTE.pressedSurface,
      pressEmissive:EXO_PALETTE.pressedEmissive,pressEmissiveIntensity:1.05,pressOpacity:1},
    lights, silhouette:{enabled:config.outline&&t>.02,ink:'#c9dff2',opacity:.65,thickness:1.012},
  };
}
const byId=Object.fromEntries(PBR_VARIANTS.map(x=>[x.key,x]));
export function resolvePbrRecipe(variant,mix){
  const selected=byId[variant];if(!selected)throw new Error(`Unknown PBR variant: ${variant}`);
  const t=clamp(Number(mix));const curve=styleAt(t);const s=selected.spec;
  // Leave actual source colors untouched at Normal and maintain a per-variant
  // fraction of them through Ghost, rather than replacing every shell with white.
  const identity=blend(1,s.retain,t);
  const material=(isControl)=>({
    opacity:isControl?Math.max(curve.shell,curve.control):curve.shell,
    roughness:clamp(blend(s.roughness[0],s.roughness[1],t)),
    metalness:clamp(blend(s.metalness[0],s.metalness[1],t)),
    clearcoat:clamp(blend(s.clearcoat[0],s.clearcoat[1],t)),
    clearcoatRoughness:clamp(blend(.28,.37,t)),
    originalColorWeight:identity,
    ghostTint:s.ghost,
    ior:1.5,
  });
  return {
    variant:selected.key, name:selected.name,description:selected.description,strategy:selected.strategy,mix:t,
    lightingMode:s.lightingMode||'pbr',
    colorSpace:'srgb',toneMapping:'aces',toneMappingExposure:1,
    material:{shell:material(false),controls:material(true),pressBlue:EXO_PALETTE.pressedSurface,pressEmissive:EXO_PALETTE.pressedEmissive,pressEmissiveIntensity:1.05,pressOpacity:1},
    lights:{
      ambient:{color:'#ffffff',intensity:s.light[3]},
      keyPoint:{color:'#ffffff',position:[-3,4,6],intensity:s.light[0],decay:2,distance:0},
      fillDirectional:{color:'#d9ebff',direction:[4,2,5],intensity:s.light[1]},
      rimPoint:{color:'#e1eeff',position:[2.2,1.7,-3.0],intensity:s.light[2],decay:2,distance:0},
    }
  };
}
export function qtQuickDescriptor(recipe){
  const {material,lights}=recipe;
  return {
    recipeKey:recipe.variant,mix:recipe.mix,modelSource:'original OBJ meshes and manifest color',
    materialType:'PrincipledMaterial',lighting:recipe.lightingMode==='unlit'?'NoLighting':'FragmentLighting',
    lightTypes:recipe.lightingMode==='unlit'?[]:[
      ...(lights.keyPoint.intensity>0?['PointLight']:[]),
      ...(lights.fillDirectional.intensity>0?['DirectionalLight']:[]),
      ...(lights.rimPoint.intensity>0?['PointLight']:[])],
    positionUnit:'Three world units, after normalization to 4.05',
    environmentProbe:recipe.environmentProbe||null,environmentIntensity:recipe.environmentIntensity??0,
    silhouette:recipe.silhouette||{enabled:false},
    shell:material.shell,controls:material.controls,pressedBlue:material.pressBlue,
    pressEmissive:{color:material.pressEmissive,intensity:material.pressEmissiveIntensity},
    pointKey:lights.keyPoint,fillDirectional:lights.fillDirectional,pointRim:lights.rimPoint,
    ambient:lights.ambient,tonemap:'ACES',outputColorSpace:'sRGB',
    flat2D:Object.fromEntries(['dark','light','mixed'].map(scene=>[scene,resolve2DPaint(recipe,scene)])),
    depthOcclusion:{shellWritesDepth:true,controlsDepthTest:true,occludedHints:'optional dashed GreaterDepth outline; needs native Qt verification'},
    stickPolicy:{deadzone:.08,tiltMaxRadians:.23,movingColor:EXO_PALETTE.movingControl,movingBlendMax:.22,
      pressedBlue:material.pressBlue,pressedOpacityMax:1,
      neutral:'Use idle control tint',moving:'Brighten only visible stick cap/rim/stem',
      click:'L3/R3 pressed state; never infer click from axes'},
    renderReuse:{source3DPerLook:1,compositeViews:3,usesGpuTexture:true,requiresCpuReadback:false},
    // The four product looks use one small background-aware alpha-edge
    // compositor. The historic A-H material-only recipes do not.
    backgroundContrast:recipe.environmentProbe?Object.fromEntries(['dark','light','mixed'].map(k=>[k,sceneContrastProfile(k)])):null,
    usesCustomShader:Boolean(recipe.environmentProbe),usesPostprocess:Boolean(recipe.environmentProbe),geometryCopiesPerVariant:0,
    calibrationNotes:[
      'Qt Quick 3D PointLight brightness and attenuation units are not numerically identical to Three.js intensity/decay.',
      'Map mesh colors with color-management and verify gamma and tone mapping against photographed reference panels.',
      'Transparency compositing, depth sorting and BRDF response differ; render both engines to golden images before visual parity claims.',
      'Qt Light probe/ambient approximation and roughness response may require calibration, never assert pixel identity.'
    ]
  };
}
