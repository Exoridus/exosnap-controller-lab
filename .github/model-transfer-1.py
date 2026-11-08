import hashlib,pathlib
items=[
('control-glyphs.js', 'ca6f4760cbdcf2fd88141025f3715c005d4186679e62f6ab20bf5b7dcc6024e9', '0a01057b28b08ad6abae9dab7eb87038aea84c8d9f1e4fbb39c8b8b64f6fddd1', [
(0,0,r"""import {softenedLegendColor} from './controller-visual-policy.js';
"""),
(143,145,r""" const idle=new THREE.Color(softenedLegendColor('#'+c.getHexString()));
 const state={mask:{value:texture},enabled:{value:1},ink:{value:idle.clone()},coverage:{value:.72},idle,active:new THREE.Color('#ffffff')};
"""),
(148,149,r"""  shader.uniforms.controllerMarkMask=state.mask;shader.uniforms.controllerMarkEnabled=state.enabled;shader.uniforms.controllerMarkInk=state.ink;shader.uniforms.controllerMarkCoverage=state.coverage;
"""),
(153,155,r"""   '#include <common>\nuniform sampler2D controllerMarkMask;\nuniform float controllerMarkEnabled;\nuniform vec3 controllerMarkInk;\nuniform float controllerMarkCoverage;\nvarying vec2 vControllerMarkUv;\nvarying float vControllerMarkFacing;')
   .replace('#include <map_fragment>','#include <map_fragment>\nfloat inkAlpha=texture2D(controllerMarkMask,vControllerMarkUv).a*controllerMarkEnabled*step(0.45,vControllerMarkFacing);\ndiffuseColor.rgb=mix(diffuseColor.rgb,controllerMarkInk,inkAlpha);\ndiffuseColor.a=max(diffuseColor.a,inkAlpha*controllerMarkCoverage);');
"""),
]),
('control-surface-material.js', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'ce6b1becd171be7b9063ab5eed6400a5d534152f4ab7814d4948eea5c2d5c321', [
(0,0,r"""// Source-vertex role mask, generated once at load. No replacement geometry,
// added render pass, readback or per-frame texture. Qt: vertex attribute +
// the existing CustomMaterial surface stage (see MODEL_CONSISTENCY.md).
import * as THREE from 'three';
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
function surfaceProgramKey(){return 'controller-rim-surface-v1';}
function compileRim(shader){
 const s=this.userData.rimSurface;
 shader.uniforms.controllerRimEnabled=s.enabled;
 shader.uniforms.controllerSupportColor=s.color;
 shader.uniforms.controllerSupportAlpha=s.alpha;
 shader.vertexShader=shader.vertexShader.replace('#include <common>',
  '#include <common>\nattribute float controllerRimWeight;\nvarying float vControllerRimWeight;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\nvControllerRimWeight=controllerRimWeight;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
  '#include <common>\nuniform float controllerRimEnabled;\nuniform vec3 controllerSupportColor;\nuniform float controllerSupportAlpha;\nvarying float vControllerRimWeight;')
  .replace('#include <map_fragment>',`#include <map_fragment>
    float rimWeight=mix(1.0,vControllerRimWeight,controllerRimEnabled);
    diffuseColor.rgb=mix(controllerSupportColor,diffuseColor.rgb,rimWeight);
    diffuseColor.a=mix(controllerSupportAlpha,diffuseColor.a,rimWeight);`)
  .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=rimWeight;');
}
export function prepareRimSurface(mesh,bounds,meta=null,sourceText=null){
 if(meta?.structuralRegions){prepareStructuralRegions(mesh,meta.structuralRegions,sourceText);return;}
 if(mesh.userData.role!=='stick-pivot')return;
 const positions=mesh.geometry.attributes.position,range=bounds.max.y-bounds.min.y;
 if(!(range>0))return;
 const weights=new Float32Array(positions.count);
 for(let i=0;i<weights.length;i++)weights[i]=smooth(((positions.getY(i)-bounds.min.y)/range-.30)/.40);
 installSurfaceWeights(mesh,weights);
}
function installSurfaceWeights(mesh,weights){
 mesh.geometry.setAttribute('controllerRimWeight',new THREE.BufferAttribute(weights,1));
 mesh.material.userData.rimSurface={enabled:{value:0},color:{value:mesh.userData.sourceColor.clone()},alpha:{value:1}};
 // Shared functions preserve equality-based GPU instancing when both states
 // are equal. The independent uniforms participate in material comparison.
 mesh.material.onBeforeCompile=compileRim;mesh.material.customProgramCacheKey=surfaceProgramKey;
}
export function updateRimSurface(material,enabled,color,alpha){
 const s=material.userData.rimSurface;if(!s)return;
 s.enabled.value=enabled?1:0;s.color.value.copy(color);s.alpha.value=alpha;
}

// A source mesh can contain independently authored housing-well components.
// Identify connected source triangles, not a spatial cut through the shell.
// Metadata only names inspected component bounds. Vertex positions/normals and
// source object/hierarchy are untouched; the shared material consumes a mask.
function prepareStructuralRegions(mesh,regions,sourceText){
 const vertices=[],faces=[];
 for(const line of sourceText.split('\n')){
  if(line.startsWith('v '))vertices.push(line.trim().split(/\s+/).slice(1).map(Number));
  else if(line.startsWith('f '))faces.push(line.trim().split(/\s+/).slice(1).map(v=>Number(v.split('/')[0])-1));
 }
 // Keep original vertex IDs: separate authored components can share seam
 // positions. Welding coordinates here would fuse the wells into the shell.
 const parent=Int32Array.from(vertices,(_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(const face of faces)for(const v of face.slice(1))parent[root(v)]=root(face[0]);
 const groups=new Map();for(let i=0;i<vertices.length;i++){const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(vertices[i]);}
 const supports=new Set();
 for(const [id,points] of groups){
  const lo=[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),hi=[0,1,2].map(j=>Math.max(...points.map(p=>p[j])));
  if(regions.some(r=>lo.every((v,j)=>Math.abs(v-r.min[j])<.002)&&hi.every((v,j)=>Math.abs(v-r.max[j])<.002)))supports.add(id);
 }
 if(supports.size!==regions.length)throw Error('Inspected structural components changed in '+mesh.userData.sourceFile);
 const weights=[];
 // OBJLoader triangulates each source polygon as this same indexed fan.
 for(const face of faces)for(let i=1;i<face.length-1;i++)for(const v of [face[0],face[i],face[i+1]])weights.push(supports.has(root(v))?0:1);
 if(weights.length!==mesh.geometry.attributes.position.count)throw Error('Structural source polygon mapping differs from OBJLoader');
 installSurfaceWeights(mesh,new Float32Array(weights));mesh.userData.structuralComponents=supports.size;
}
"""),
]),
('controller-lab-style.js', '3131f112947d08a3b225ae5de4d66b7728fbf4610015db945f9d8e455fb3fac8', 'fa539c64f3c53a2e5e60ee46c40625e4ec5e3bcb1d69d7c9cdcc12e0aea275aa', [
(49,49,r"""    surfaceRegions:{technique:'source vertex weights in existing material',extraDrawCalls:0,qtNativeValidated:false},
    transparency:{target:'nearest physical surface, premultiplied RGBA',qtPort:'explicit source One / destination Zero and depth write; native validation pending'},
"""),
(50,51,r"""    stickPolicy:{supportModel:'all source families',ring:'analog magnitude',cap:'L3/R3 click only',support:'source-to-shell material blend; shell-linked, reduced Ghost opacity',
"""),
(54,55,r"""      contrast:'shared neutral control fill; separate housing/control contour ink and continuous muted glyph contrast; no double-edges',
"""),
(61,62,r"""      'A single PBR recipe plus source-region and ink material stages serves white feedback; no Fresnel patch.',
"""),
]),
('controller-visual-policy.js', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'd686f0b4fcafdf4cc52d8afc74a1f5b726d3c5940ef7b165e3931c2a6b8628ad', [
(0,0,r"""// Shared semantic colors, not device skins. Housing retains authored colors.
// Scalar/color interpolation ports directly to QPainter/atlas and Qt materials.
export const CONTROL_NEUTRAL='#9ca3aa';
export const CONTROL_CONTOURS=Object.freeze({dark:'#8d959d',light:'#737a81',mixed:'#77818b'});
export const SCENE_BACKDROPS=Object.freeze({dark:'#09111b',light:'#f4f6f9',mixed:'#9baab4'});
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16));
export function softenedLegendColor(surface,opacity=1,backdrop='#9baab4'){
 const p=rgb(surface),b=rgb(backdrop),a=clamp(opacity);
 const l=(.2126*(p[0]*a+b[0]*(1-a))+.7152*(p[1]*a+b[1]*(1-a))+.0722*(p[2]*a+b[2]*(1-a)))/255;
 // Continuous polarity transition. The neutral dark profile crosses between
 // the 30% and 70% coverage presets, rather than snapping to black or white.
 let t=clamp((l-.49)/.10);t=t*t*(3-2*t);
 return '#'+[210,218,225].map((v,i)=>Math.round(v+([72,81,91][i]-v)*t).toString(16).padStart(2,'0')).join('');
}
export function isStructuralRole(role){return ['stick-stem','stick-base','stick-well','structural-support'].includes(role);}
export function isInteractiveRole(role){return ['button','trigger','touch-surface','paddle','stick-pivot','stick-cap'].includes(role);}
"""),
]),
('model-semantics.js', '592268dbaeea1b8d19dc7d517995fe809d6f1b8095ab5967a7ff22ce06331744', 'e2c3c77561754be6564adf5532445f1efd22a9d08b3ba46e6fdc514694090c76', [
(73,73,r"""
// Source-data exception, not a material exception: Xbox 360 stores its dish
// and both wells as disconnected components inside the housing OBJ. The
// common support material applies to these inspected, unchanged components.
const STRUCTURAL_COMPONENTS=Object.freeze({Xbox360:{'top_shell.obj':[{"min": [-0.52, 0.16, -0.216], "max": [-0.063, 0.321, 0.239], "purpose": "original disconnected D-pad dish"}, {"min": [0.041, 0.154, -0.195], "max": [0.49, 0.303, 0.253], "purpose": "original right stick well"}, {"min": [-0.774, 0.218, -0.523], "max": [-0.358, 0.303, -0.124], "purpose": "original left stick well"}]}});
export function structuralRegionsForPart(modelId,file){return STRUCTURAL_COMPONENTS[modelId]?.[file]||null;}
"""),
]),
('pbr-appearance.js', 'a47569d1126fa3021ba505cb3c0993e8c0b4f26267bf9145d6c6806e76ada237', 'cb2aa8af7206b7ab1efeedf8f7e95cc1278eefb85eafb93bacf0a7086efc9ac7', [
(0,0,r"""import {CONTROL_NEUTRAL,isStructuralRole,isInteractiveRole,softenedLegendColor} from './controller-visual-policy.js';
import {updateRimSurface} from './control-surface-material.js';
"""),
(19,19,r"""const neutralControl=new THREE.Color(CONTROL_NEUTRAL);
const supportColor=new THREE.Color();
"""),
(53,58,r"""  // Semantic supports use the same shell-linked rule on every family. The
  // source material and hierarchy survive. A split-color shell can nominate
  // its physical support region in the original part manifest.
  const integrateSupports=recipe.material.supportShellBlend;
"""),
(92,92,r"""    // The offscreen image represents the nearest physical surface, not X-ray
    // glass. Source-over inside the rig accumulated overlapping shell/support
    // faces before depth was final (dark dishes and shoulder seams). Replace
    // RGBA at passing fragments, then composite the single premultiplied image.
    // Existing rear hints remain ordinary depth-tested overlays afterward.
    const premultiplied=Boolean(recipe.consolidated);
    if(m.premultipliedAlpha!==premultiplied){m.premultipliedAlpha=premultiplied;m.needsUpdate=true;}
    m.blending=recipe.consolidated?THREE.NoBlending:THREE.NormalBlending;
"""),
(99,100,r"""      const support=isStructuralRole(role);
      const t=clamp01(recipe.mix),blend=t*t*(3-2*t);
"""),
(101,101,r"""      if(isInteractiveRole(role))m.color.lerp(neutralControl,blend);
"""),
(103,105,r"""        m.color.lerp(cached.supportShellColor||native.supportShellColor,blend);
"""),
(125,125,r"""      // Lower ring sidewall belongs to the support, not the analog indicator.
      supportColor.copy(mesh.userData.sourceColor).lerp(cached.supportShellColor||native.supportShellColor||mesh.userData.sourceColor,blend);
      updateRimSurface(m,true,supportColor,recipe.material.supportOpacity);
"""),
(126,127,r"""      if(marking){
        marking.ink.value.set(softenedLegendColor('#'+m.color.getHexString(),m.opacity));
        marking.coverage.value=.72;
      }
"""),
(129,129,r"""    updateRimSurface(m,false,m.color,m.opacity);
"""),
]),
('pbr-model.js', 'fa9b4179a954e53881b6d3dba7f833eec028e430755767f34683b758128ae69c', '2ef19e8d5ebe5c4e9439fc4d566c2773fc4541c63a33da80e0d9db2774726386', [
(4,5,r"""import {modelPartSemantics,structuralRegionsForPart} from './model-semantics.js';
"""),
(7,7,r"""import {prepareRimSurface} from './control-surface-material.js';
"""),
(70,70,r"""      prepareRimSurface(o,sourceBounds,{structuralRegions:structuralRegionsForPart(model.id,source.file)},source.text);
"""),
(86,86,r"""  // Choose the local shell on split-body devices geometrically. Traditional
  // front/back shells share an X center; two lateral Joy-Con shells do not.
  // No family-name test and no per-frame search.
  const front=meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
  if(front){
    const frontBox=new THREE.Box3().setFromObject(front),fc=frontBox.getCenter(new THREE.Vector3());
    const candidates=[front,...meshes.filter(m=>m.userData.sourceFile==='bottom_shell.obj'&&
      Math.abs(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).x-fc.x)>
        frontBox.getSize(new THREE.Vector3()).x*.5)];
    const centers=candidates.map(m=>new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));
    for(const mesh of meshes.filter(m=>m.userData.role.startsWith('stick-'))){
      const center=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      let best=0;for(let i=1;i<candidates.length;i++)if(center.distanceToSquared(centers[i])<center.distanceToSquared(centers[best]))best=i;
      mesh.userData.supportShellColor=candidates[best].userData.sourceColor.clone();
    }
  }
"""),
]),
('pbr-optimizer.js', '244a7ff430d688361d68c75e506d04f0307555c54d960fbbba18d7757fae0f88', '693352fa68eb9e5740e4e9b73cd76735e7fbfba85e4b5b10921b10b1a9d8cb6a', [
(124,124,r"""    // Preserve the one-pass structural-region material instead of dropping its attribute.
    if(m.material.userData.rimSurface)continue;
"""),
]),
('polish-2d-style.js', '259ef6be27f849c82971bc55c768eaeb6bf08f6a23e5233e53ccd0289b3b0c08', '78ccf3d1f6f40448b1eaf5ea6cea6a98c567f8f4a671e8c1e4cbc0de9d0905ea', [
(0,0,r"""import {CONTROL_NEUTRAL,CONTROL_CONTOURS,SCENE_BACKDROPS,softenedLegendColor} from './controller-visual-policy.js';
"""),
(292,295,r"""  const pressure=shapes.find(node=>node.id.endsWith('-pressure')||node.classList.contains('press-surface'));
  const mapped=layer.pressElement&&shapes.find(node=>node.id===layer.pressElement||node.id.endsWith('-'+layer.pressElement));
  const face=shapes.find(node=>/(?:-face|-surface)$/.test(node.id));
  // Role and explicit mapping take precedence over a filename convention.
  // Single authored paths include DS4 touchpad, Xbox D-pad and +/- keys.
  const surface=pressure||mapped||face||shapes.find(node=>!node.classList.contains('detail'));
"""),
(296,308,r"""    // Converted outline paths use fill rather than stroke. They are structure,
    // never a second translucent/active surface under the button.
    if(colors.coherentContours&&node!==surface&&node.classList.contains('detail')){
      const filled=authoredFill(node);paint(node,'fill',filled?colors.controlStroke:'none');
      paint(node,'fill-opacity',filled?colors.controlStrokeAlpha:0);
      if(visibleStroke(node))paint(node,'stroke',colors.controlStroke);
      node.removeAttribute('data-exo-visible-control-fill');continue;
"""),
(309,315,r"""    if(surface){
      paintControl(node,colors,level,{fill:node===surface,
        stroke:shapes.length===1||visibleStroke(node)});
      if(node===pressure){const clip=getOrCreateXboxBumperClip(entry,node);if(clip)paint(node,'clip-path',clip);}
    }else paintControl(node,colors,level,{fill:authoredFill(node)});
"""),
(379,379,r"""  if(colors.coherentContours)for(const detail of group.querySelectorAll('[data-stick-detail]')){
    if(visibleFill(detail))paint(detail,'fill',colors.controlStroke);
    if(visibleStroke(detail))paint(detail,'stroke',colors.controlStroke);
  }
"""),
(446,456,r"""  return softenedLegendColor(state.fill,state.alpha,colors.surfaceBackdrop||'#9baab4');
"""),
(464,465,r"""  const surfaceInk=colors.coherentContours&&entry.layer.role!=='body';
"""),
(584,587,r"""    colors.surfaceBackdrop=SCENE_BACKDROPS[scene];
    colors.control=colors.cap=colors.trigger=CONTROL_NEUTRAL;
    colors.line=ink;
    colors.controlStroke=colors.pressedOutline=CONTROL_CONTOURS[scene];
    colors.glyph=softenedLegendColor(CONTROL_NEUTRAL,colors.controlAlpha,colors.surfaceBackdrop);
"""),
(611,611,r"""  for(const node of reference.svg.querySelectorAll('[data-decorative-marking]')){
    if(markings)node.style.removeProperty('display');else paint(node,'display','none');
  }
"""),
]),
 ]
for name,before,after,edits in items:
 p=pathlib.Path(name);source=p.read_text() if p.exists() else ''
 assert hashlib.sha256(source.encode()).hexdigest()==before, 'Source changed: '+name
 lines=source.splitlines(keepends=True)
 for a,b,text in reversed(edits):lines[a:b]=[text]
 result=''.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==after, 'Result mismatch: '+name
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(result)
print('Exact source files applied:',len(items))
