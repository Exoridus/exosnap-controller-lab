import * as THREE from 'three';
import {loadStudioEnvironment} from './hdr-probe.js';
import {CONTROLLERS,CONTROL_IDS,isLicensedModel} from './models.js';
import {controllerPresentationModel,prepareGenericCenterControls} from './generic-xbox-proxy.js';
import {layoutForModel} from './controller-catalog.js';
import {ControllerReference,isolateReferenceIds} from './controller-reference.js';
import {prepareGhostOcclusion,setRearHintViewport,hideOccludedRearControls} from './ghost-depth-policy.js';
import {createContrastCompositeMaterial,updateContrastComposite,DEFAULT_OUTER_SILHOUETTE_EMPHASIS} from './silhouette-composite.js';
import {isHousingRole} from './model-semantics.js';
import {loadNativeRig,disposeNativeRig} from './pbr-model.js';
import {applyPbrRecipeToRig,applyControlPoseToRig} from './pbr-appearance.js';
import {fitControllerRadius} from './pbr-camera-fit.js';
import {shareEquivalentControlGeometry,optimizeStaticHousing,instantiateStickPairs} from './pbr-optimizer.js';
import {poseForStickDemo,normalizeStickInput} from './stick-activity.js';
import {summarizePanelBudget} from './render-budget.js';
import {HERO_ENVIRONMENT} from './pbr-recipes.js';
import {LAB_VARIANTS,resolveLabRecipe,flatAppearanceKey,qtLabDescriptor,resolveFlatMaterial} from './controller-lab-style.js';
import {prepareSilhouette,updateSilhouette} from './pbr-silhouette.js';
import {ActiveColorState} from './active-color-state.js';
import {applyControllerArtwork,setControllerMarkings} from './control-glyphs.js';
import {paintPolished2D} from './polish-2d-style.js';
import {attachStickDrag} from './stick-drag.js';
import {readStandardGamepad} from './gamepad-input.js';
import {previewPlayerIndex,previewLabel} from './controller-player-leds.js';
import {prepare3DPlayerLedSurface,apply3DPlayerLedLayout,update3DPlayerLedMask} from './controller-player-leds-3d.js';
import {ControllerDemo,createControllerState,stickClickCapabilities,applyStickClickCapabilities} from './controller-demo.js';

const $=id=>document.getElementById(id);
const scenes=['dark','light','mixed']; // all three share the same THREE.Scene, model and camera.
const gallery=$('gallery');
// The comparison is intentionally limited to the two final candidates.
// All historical galleries are separate source assets, not embedded viewers.
const variants=LAB_VARIANTS;

const state={mix:.70,modelId:'DualSenseCompact',selected:'white',view:'front',panelWidth:320,
  renderMode:'shared',stickPose:'neutral',triggerPressure:0,
  testControl:'',manualSticks:{left:null,right:null},
  pressed:false,native:null,renderer:null,renderPending:false,camera:null,scene:null,drawStats:{},
  yaw:0,pitch:0,radius:7.8,fitRadius:7.8,error:null,drag:null,renderTarget:null,blitScene:null,blitCamera:null,
  environmentMap:null};
const demo=new ControllerDemo();
const manualInput=createControllerState();
state.frameInput=createControllerState();state.markings=true;state.flatTransparency=.70;state.outerContour=true;
state.playerPreviewSelection='demo';state.playerPreview=previewPlayerIndex('demo');
state.manualButtons=new Map();state.manualHeld=new Set();
const demoPresets={neutral:poseForStickDemo('neutral'),move:poseForStickDemo('move'),click:poseForStickDemo('click')};
const sampleNodes=[];
const flatSampleNodes=[];
let flatLoadSerial=0;
let modelLoadSerial=0;
let flatPaintKey='';
let clearStickDrags=[];
const flatReferences=new Map();
const activeColors=new ActiveColorState({color2D:'#ffffff',color3D:'#ffffff'});
let cachedRecipe=null,cachedRecipeKey='';
function recipeFor3D(variantKey){
  const key=variantKey+':'+state.mix+':'+activeColors.color3D;
  if(key===cachedRecipeKey)return cachedRecipe;
  const recipe=activeColors.overrideRecipe(resolveLabRecipe(variantKey,state.mix),'3d');
  recipe.material.customActiveColor=activeColors.color3D!=='#ffffff';
  recipe.material.pressEmissiveIntensity=.16;
  cachedRecipeKey=key;cachedRecipe=recipe;return recipe;
}
function makeGallery(){
  for(const variant of variants){
    const card=document.createElement('section');card.className='variant';card.dataset.variant=variant.key;
    const heading=document.createElement('h2');heading.className='look-label';
    heading.textContent=`3D · ${variant.name}`;
    heading.title=variant.description;
    const views=document.createElement('div');views.className='look-views';
    for(const sceneName of scenes){
      const wrap=document.createElement('div');wrap.className='sample-wrap';
      const sample=document.createElement('div');sample.className='sample';sample.dataset.scene=sceneName;sample.dataset.variant=variant.key;
      sample.setAttribute('aria-label',`3D ${variant.name} auf ${sceneName}`);
      wrap.append(sample);views.appendChild(wrap);sampleNodes.push(sample);
    }
    card.append(heading,views);gallery.appendChild(card);
  }
  const flatCard=document.createElement('section');flatCard.className='flat-reference';
  const heading=document.createElement('h2');heading.className='look-label';heading.textContent='2D · Transparent';
  const views=document.createElement('div');views.className='look-views';
  for(const sceneName of scenes){
      const wrap=document.createElement('div');wrap.className='sample-wrap';
      const sample=document.createElement('div');sample.className='sample sample--flat';sample.dataset.scene=sceneName;
      const stage=document.createElement('div');stage.className='flat-stage';stage.setAttribute('aria-label',`2D Transparent auf ${sceneName}`);
      sample.append(stage);wrap.append(sample);views.appendChild(wrap);
      flatSampleNodes.push({scene:sceneName,stage});
  }
  flatCard.append(heading,views);gallery.appendChild(flatCard);
  setVisibleLooks();
}
function setVisibleLooks(){
  const enabled=new Set(variants.map(({key})=>key));
  for(const card of gallery.querySelectorAll('.variant'))card.hidden=!enabled.has(card.dataset.variant);
  document.body.dataset.visibleLooks=[...enabled].join(',');
  scheduleRender();
}
function setStatus(message){$('rendererStatus').textContent=message;}
function setFail(message){
  state.error=message;
  gallery.classList.add('gpu-unavailable');
  $('failureBanner').hidden=false;
  $('failureBanner').textContent=message;
  document.body.dataset.renderReady='webgl-unavailable';
  setStatus('Keine 3D-Browserfreigabe · WebGL nicht verfügbar');
}
function createRenderer(){
  const canvas=document.createElement('canvas');canvas.id='threeCanvas';canvas.setAttribute('aria-hidden','true');
  gallery.appendChild(canvas);
  try{
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1;
    renderer.autoClear=false;
    renderer.info.autoReset=false; // count the three viewports of each recipe, not the last viewport only.
    renderer.setClearColor(0x000000,0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    if(renderer.capabilities.isWebGL2)target.samples=4;
    target.texture.colorSpace=THREE.SRGBColorSpace;
    const blitMaterial=createContrastCompositeMaterial(target.texture);
    state.renderTarget=target;
    state.compositeMaterial=blitMaterial;
    state.blitScene=new THREE.Scene();
    state.blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),blitMaterial));
    state.blitCamera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
    state.blitCamera.position.z=1;
    state.renderer=renderer;
    return renderer;
  }catch(error){
    canvas.remove();
    setFail(`WebGL-Kontext konnte nicht erzeugt werden (${error.message}). Keine Screenshot-Ersatzbilder: 3D-Abnahme offen.`);
    return null;
  }
}
async function loadFlatReferences(model){
  const serial=++flatLoadSerial;
  clearStickDrags.forEach(dispose=>dispose());clearStickDrags=[];
  state.manualSticks={left:null,right:null};
  flatPaintKey='';
  flatReferences.clear();
  const layout=layoutForModel(model.id);
  await Promise.all(flatSampleNodes.map(async ({scene,stage},index)=>{
    if(!layout){stage.textContent='Keine passende originale 2D-Vorlage';return;}
    // Load into a separate container. An older fetch may finish after a newer
    // model selection; it must never replace the currently mounted source SVG.
    const pending=document.createElement('div');
    const ref=new ControllerReference(pending,{onPress:(key,event)=>{
      if(key==='ls'||key==='rs')return; // dragging a stick must not invent a click
      state.manualHeld.add(key);state.manualButtons.set(key,performance.now()+100);
      event?.currentTarget?.setPointerCapture?.(event.pointerId);scheduleRender();
    }});
    await ref.load(layout);
    if(serial!==flatLoadSerial)return;
    if(!ref.svg){stage.textContent=`2D-Vorlage für ${layout.name} nicht ladbar`;return;}
    isolateReferenceIds(ref.svg,`pbr-${serial}-${index}`);
    // ControllerReference.load already applies the identical shared SVG safe
    // area to all 2D viewers and their knockout masks. Never pad twice here.
    stage.replaceChildren(ref.svg);ref.container=stage;
    ref.svg.addEventListener('dblclick',event=>{
      const entry=ref.controls.find(c=>c.stickSide&&c.group.contains(event.target));
      if(entry?.layer.binding?.clickMask){state.manualButtons.set(entry.control,performance.now()+180);scheduleRender();}
    });
    flatReferences.set(scene,ref);
  }));
  if(serial===flatLoadSerial){
    const reference=[...flatReferences.values()][0];
    state.stickClicks=stickClickCapabilities(reference?.mapping);
    updateFlatReferences();
    if(state.native?.model?.id===model.id&&reference?.svg){
      applyControllerArtwork(state.native,reference.svg);
      apply3DPlayerLedLayout(state.native,reference);
    }
    setControllerMarkings(state.native,state.markings);
    for(const ref of flatReferences.values())clearStickDrags.push(attachStickDrag(ref,{
      start:side=>{state.stickPose='neutral';$('stickPose').value='neutral';state.manualSticks[side]={x:0,y:0};scheduleRender();},
      move:(side,axes)=>{state.manualSticks[side]=axes;scheduleRender();},
      end:side=>{state.manualSticks[side]=null;scheduleRender();}
    }));
  }
}
function visualInput(now=performance.now()){
  for(const [key,until]of state.manualButtons)if(until<=now)state.manualButtons.delete(key);
  const manual=state.pressed||state.testControl||state.triggerPressure>0||
    state.manualSticks.left||state.manualSticks.right||state.manualButtons.size||state.manualHeld.size||
    (state.stickPose!=='neutral'&&state.stickPose!=='live');
  if(manual){
    manualInput.values.clear();manualInput.allPressed=state.pressed;
    if(state.pressed)for(const id of CONTROL_IDS)manualInput.values.set(id,1);
    for(const key of state.manualButtons.keys())manualInput.values.set(key,1);
    for(const key of state.manualHeld)manualInput.values.set(key,1);
    if(state.testControl)manualInput.values.set(state.testControl,1);
    const preset=demoPresets[state.stickPose]||demoPresets.neutral;
    for(const [side,key]of [['left','ls'],['right','rs']]){
      const stick=state.manualSticks[side]||preset[side];
      manualInput[side].x=stick.x||0;manualInput[side].y=stick.y||0;
      manualInput[side].click=Boolean(stick.click)||Boolean(manualInput.values.get(key));
      if(manualInput[side].click)manualInput.values.set(key,1);
    }
    manualInput.triggers.left=manualInput.triggers.right=state.triggerPressure;
  }
  return applyStickClickCapabilities(demo.sample(now,{manual:manual?manualInput:null,live:getLiveStickPose()}),state.stickClicks);
}
function updateFlatReferences(input=state.frameInput){
  // A wheel over either 3D or 2D changes the common apparent size.
  const flatZoom=THREE.MathUtils.clamp(state.fitRadius/state.radius,.67,1.55);
  for(const item of flatSampleNodes)item.stage.style.transform=`scale(${flatZoom.toFixed(4)})`;
  if(!flatReferences.size)return;
  const key=flatAppearanceKey(input,activeColors.color2D)+`:${flatLoadSerial}:${flatReferences.size}:${state.panelWidth}:${state.flatTransparency}:${state.markings}:led:${state.playerPreview.mask}`;
  if(key===flatPaintKey)return;
  for(const sceneName of scenes){
    const ref=flatReferences.get(sceneName);
    if(!ref)continue;
    paintPolished2D(ref,'ghost',sceneName,{...input,activeColor:activeColors.color2D,
      stickFeedback:'ring',showFaceSymbols:true,edgeLight:0,edgeShadow:0,coherentContours:true,
      ringSurface:true,material2D:resolveFlatMaterial(state.flatTransparency),markings:state.markings,playerPreview:state.playerPreview});
  }
  flatPaintKey=key;
}
function makeScene(){
  // No DirectionalLight, PointLight or AmbientLight in this comparison.
  // PBR looks use one shared HDRI light probe; Outline Ghost is unlit.
  const scene=new THREE.Scene();
  state.scene=scene;
  state.camera=new THREE.PerspectiveCamera(35,320/214,.05,100);
  updateCamera();
}
async function loadEnvironmentProbe(){
  if(!state.renderer)return;
  const hdr=await loadStudioEnvironment(HERO_ENVIRONMENT);
  // Renderer performs the necessary PMREM filtering and caches the result.
  state.environmentMap=hdr;
  state.scene.environment=hdr;
  state.scene.environmentIntensity=1;
}
function updateCamera(){
  if(!state.camera)return;
  const {radius,yaw,pitch}=state;
  const height=radius*Math.sin(pitch),floor=radius*Math.cos(pitch);
  state.camera.position.set(floor*Math.sin(yaw),height,floor*Math.cos(yaw));
  state.camera.up.set(0,1,0);state.camera.lookAt(0,0,0);
  state.camera.updateMatrixWorld();scheduleRender();
}
function setView(view){
  state.view=view;
  const poses={front:[0,0],angled:[.52,.30],top:[.28,.70],profile:[1.5,.04],bottom:[.24,-.65],rear:[Math.PI,.12]};
  [state.yaw,state.pitch]=poses[view]||poses.angled;
  if(state.native){state.fitRadius=fitControllerRadius(new THREE.Box3().setFromObject(state.native.group).getSize(new THREE.Vector3()),{yaw:state.yaw,pitch:state.pitch});state.radius=state.fitRadius;}
  updateCamera();
}
function applyLights(_lights,recipe){
  state.scene.environment=recipe.lightingMode==='ibl'?state.environmentMap:null;
  state.scene.environmentIntensity=recipe.lightingMode==='ibl'?(recipe.environmentIntensity||1):0;
}
function drawMetrics(renderer){
  return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
function rectangleFor(node,frame,ratio){
  const rect=node.getBoundingClientRect();
  return {left:Math.max(0,Math.round((rect.left-frame.left)*ratio)),
    bottom:Math.max(0,Math.round((frame.bottom-rect.bottom)*ratio)),
    width:Math.max(1,Math.round(rect.width*ratio)),height:Math.max(1,Math.round(rect.height*ratio)),rect};
}
function render(now=performance.now()){
  state.renderPending=false;
  const dirty=state.paintDirty;state.paintDirty=false;
  if(document.hidden)return;
  const pose=visualInput(now);state.frameInput=pose;
  const pad=firstStandardGamepad();
  state.playerPreview=previewPlayerIndex(state.playerPreviewSelection,pad?.index??null);
  update3DPlayerLedMask(state.native,state.playerPreview.mask);
  const info=previewLabel(state.playerPreview);
  if($('playerIndexStatus').textContent!==info)$('playerIndexStatus').textContent=info;
  const animate=()=>{if(demo.enabled||state.manualButtons.size||state.frameInput.source==='live'||state.stickPose==='live'||Array.from(navigator.getGamepads?.()||[]).some(p=>p?.connected))scheduleRender(false);};
  const inputKey=flatAppearanceKey(pose)+':led:'+state.playerPreview.mask+':'+state.playerPreview.index;
  if(!dirty&&inputKey===state.lastFrameKey){animate();return;}
  state.lastFrameKey=inputKey;
  updateFlatReferences(pose);
  if(!state.renderer||!state.native||!state.environmentMap){if(flatReferences.size)animate();return;}
  const renderer=state.renderer,camera=state.camera;
  const width=Math.max(1,Math.round(gallery.clientWidth));
  const height=Math.max(1,Math.round(gallery.clientHeight));
  if(renderer.domElement.width!==Math.round(width*renderer.getPixelRatio()) || renderer.domElement.height!==Math.round(height*renderer.getPixelRatio()))renderer.setSize(width,height,false);
  const ratio=renderer.getPixelRatio();
  const frame=gallery.getBoundingClientRect();
  let rendered=0;
  // A hidden row changes viewport positions. Clear stale pixels from the
  // previous frame BEFORE new scissor rectangles are drawn.
  renderer.setScissorTest(false);
  renderer.setRenderTarget(null);
  renderer.clear(true,true,true);
  renderer.setScissorTest(true);
  applyControlPoseToRig(state.native,pose);
  setControllerMarkings(state.native,state.markings);
  state.native.group.updateMatrixWorld(true);
  for(const variant of variants){
    const card=gallery.querySelector(`.variant[data-variant="${variant.key}"]`);
    if(card?.hidden)continue;
    const recipe=recipeFor3D(variant.key);
    applyPbrRecipeToRig(state.native,recipe,pose);
    applyLights(recipe.lights,recipe);
    // Background-specific edge contrast is applied in the shared compositing
    // pass. The legacy enlarged backface silhouette would duplicate the edge.
    updateSilhouette(state.native,{silhouette:{enabled:false}});
    hideOccludedRearControls(state.native,recipe,{yaw:state.yaw});
    const nodes=scenes.map(name=>sampleNodes.find(n=>n.dataset.variant===variant.key&&n.dataset.scene===name));
    const rects=nodes.map(node=>node&&rectangleFor(node,frame,ratio));
    const hintRect=rects.find(Boolean);
    if(hintRect)setRearHintViewport(state.native,hintRect.width,hintRect.height);
    let budget;
    if(state.renderMode==='shared'){
      // The background in all three panels is CSS and does not affect the 3D
      // scene. Render the controller ONCE, then composite its GPU texture in
      // each panel; no readPixels, Canvas2D or extra Controller model copies.
      const rect=rects.find(Boolean);
      const target=state.renderTarget;
      if(target.width!==rect.width||target.height!==rect.height)target.setSize(rect.width,rect.height);
      renderer.setRenderTarget(target);
      renderer.setViewport(0,0,rect.width,rect.height);
      renderer.setScissor(0,0,rect.width,rect.height);
      camera.aspect=rect.rect.width/Math.max(1,rect.rect.height);
      camera.updateProjectionMatrix();
      renderer.info.reset();
      renderer.clear(true,true,true);
      renderer.render(state.scene,camera);
      const source=drawMetrics(renderer);
      renderer.setRenderTarget(null);
      const blits=[];
      for(let i=0;i<nodes.length;i++){
        const r=rects[i];if(!r){blits.push({calls:0,triangles:0});continue;}
        renderer.setViewport(r.left,r.bottom,r.width,r.height);
        renderer.setScissor(r.left,r.bottom,r.width,r.height);
        renderer.clear(true,true,true);
        updateContrastComposite(state.compositeMaterial,scenes[i],target,true,state.outerContour?DEFAULT_OUTER_SILHOUETTE_EMPHASIS:0);
        renderer.info.reset();
        renderer.render(state.blitScene,state.blitCamera);
        blits.push(drawMetrics(renderer));rendered++;
      }
      budget=summarizePanelBudget({mode:'shared',sceneNames:scenes,source,blits});
    }else{
      const direct=[];
      for(const r of rects){
        if(!r){direct.push({calls:0,triangles:0});continue;}
        renderer.setRenderTarget(null);
        renderer.setViewport(r.left,r.bottom,r.width,r.height);
        renderer.setScissor(r.left,r.bottom,r.width,r.height);
        camera.aspect=r.rect.width/Math.max(1,r.rect.height);
        camera.updateProjectionMatrix();
        renderer.info.reset();
        renderer.clear(true,true,true);
        renderer.render(state.scene,camera);
        direct.push(drawMetrics(renderer));rendered++;
      }
      budget=summarizePanelBudget({mode:'direct',sceneNames:scenes,direct});
    }
    state.drawStats[variant.key]=budget;
  }
  renderer.setRenderTarget(null);
  renderer.setScissorTest(false);
  const expected=[...gallery.querySelectorAll('.variant')].filter(card=>!card.hidden).length*scenes.length;
  // A 3D frame alone is not ready if 2D source-SVG panels are still loading.
  // Switching controllers must never expose a partial 2D/3D comparison.
  const flatReady=flatReferences.size===scenes.length &&
    flatSampleNodes.every(({stage})=>Boolean(stage.querySelector('svg')));
  document.body.dataset.renderReady=rendered===expected&&flatReady?'three-rendered':'incomplete';
  if(rendered===expected)document.body.dataset.renderRevision=String(1+(Number(document.body.dataset.renderRevision)||0));
  $('modelInfo').textContent=`${state.native.partCount} Originalteile · ${state.native.geometryReuse?.pairs||0} Mesh-Buffers geteilt`;
  setStatus(`${state.native.model.name} · 2D + 3D synchron · ${pose.source==='demo'?'Demo':pose.source==='live'?'Live-Gamepad':pose.source==='manual'?'Manuelle Eingabe':'Neutral'}`);
  animate();
}
function firstStandardGamepad(){
  const pads=typeof navigator.getGamepads==='function'?navigator.getGamepads():[];
  return Array.from(pads).find(p=>p?.connected&&p.mapping==='standard')||null;
}
function getLiveStickPose(){
  const pad=firstStandardGamepad();
  const input=readStandardGamepad(pad);
  if(!input)return null;
  return {left:normalizeStickInput({...input.left,click:input.values.get('ls')>.5}),
    right:normalizeStickInput({...input.right,click:input.values.get('rs')>.5}),values:input.values,
    triggers:{left:input.values.get('l2')||0,right:input.values.get('r2')||0}};
}

function scheduleRender(dirty=true){
  state.paintDirty=state.paintDirty||Boolean(dirty);
  if(state.renderPending||document.hidden)return;
  state.renderPending=true;requestAnimationFrame(render);
}
async function loadModel(id){
  const model=CONTROLLERS.find(c=>c.id===id);
  if(!model)return;
  const serial=++modelLoadSerial;
  // Invalidate the previous SVG request immediately, not after OBJ loading.
  ++flatLoadSerial;flatReferences.clear();
  setStatus(`Lade ${model.name} aus echten OBJ-Dateien …`);
  document.body.dataset.renderReady='loading';
  try{
    const next=await loadNativeRig(controllerPresentationModel(model));
    if(serial!==modelLoadSerial){disposeNativeRig(next);return;}
    prepareGenericCenterControls(next);
    next.geometryReuse=shareEquivalentControlGeometry(next);
    prepare3DPlayerLedSurface(next);
    next.optimization=optimizeStaticHousing(next);
    next.instanceOptimization=instantiateStickPairs(next);
    prepareGhostOcclusion(next);
    prepareSilhouette(next);
    disposeNativeRig(state.native);
    state.native=next;state.modelId=id;
    const authoredPlayerLeds=['SwitchPro','JoyconGrip'].includes(id);
    $('playerPreviewField').hidden=!authoredPlayerLeds;
    $('playerIndexStatus').hidden=!authoredPlayerLeds;
    state.fitRadius=fitControllerRadius(new THREE.Box3().setFromObject(next.group).getSize(new THREE.Vector3()),{yaw:state.yaw,pitch:state.pitch});
    state.radius=state.fitRadius;updateCamera();
    if(state.renderer&&state.environmentMap)$('failureBanner').hidden=true;
    state.scene.add(next.group);
    await loadFlatReferences(model);
    if(serial!==modelLoadSerial)return;
    $('modelInfo').textContent=next.model.genericProxy?
      `${next.originalPartCount} MIT-Originalteile (Xbox One) + 1 Share-Kappe · ${Math.round(next.triangles).toLocaleString('de-DE')} Dreiecke · ${next.optimization.savedCalls} statische Calls gespart`:
      `${next.partCount} Originalteile · ${Math.round(next.triangles).toLocaleString('de-DE')} Quell-Dreiecke · ${next.optimization.savedCalls} statische Calls gespart`;
    if(state.renderer&&state.environmentMap){scheduleRender();}
    else if(!state.renderer){document.body.dataset.renderReady='webgl-unavailable';setStatus(`Original OBJ geladen (${next.partCount} Teile). Browser-WebGL blockiert; keine 3D-Bildabnahme.`);}
    else{document.body.dataset.renderReady='hdr-unavailable';setStatus('Original OBJ geladen, HDR-Lichtprobe jedoch nicht bereit; 3D wird nicht angezeigt.');}
  }catch(error){
    if(serial!==modelLoadSerial)return;
    document.body.dataset.renderReady='model-error';
    $('controller').value=state.modelId; // Never pretend an incomplete model was selected.
    $('failureBanner').hidden=false;
    $('failureBanner').textContent=`Modell unvollständig: ${error.message}. Kein Ersatzmesh wird angezeigt.`;
    setStatus(`3D-Modell konnte nicht vollständig geladen werden: ${model.name}`);
  }
}
async function exportQtRecipe(){
  const output={generator:'ExoSnap consolidated controller lab',date:'2026-11-08',
    modelId:state.modelId,view:state.view,playerLedPreview:{...state.playerPreview,hardwareWrite:false},camera:{fov:state.camera?.fov||35,position:state.camera?.position.toArray()||[0,0,7]},
    geometryReuse:state.native?.geometryReuse,demo:demo.enabled,markings:state.markings,
    outerSilhouette3D:state.outerContour,playerLedSurface3D:state.native?.playerLedSurface?
      {layout:state.native.playerLedSurface.config.layout,count:state.native.playerLedSurface.count,
       surfacePart:state.native.playerLedSurface.config.sourcePart,extraDrawCalls:0,hardwareWrite:false}:null,
    flatMaterial:resolveFlatMaterial(state.flatTransparency),
    feedback:Object.fromEntries(variants.map(({key})=>{const recipe=recipeFor3D(key);return [key,{recipe,qtQuick3D:qtLabDescriptor(recipe,{activeColor2D:activeColors.color2D})}]}))};
  const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`exosnap-controller-${Math.round(state.mix*100)}-qt.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function bindUI(){
  const select=$('controller');
  for(const model of CONTROLLERS.filter(m=>isLicensedModel(m)&&m.id!=='Wavebird')){
    const opt=new Option(model.name,model.id);select.add(opt);
  }
  select.value=state.modelId;
  select.addEventListener('change',e=>loadModel(e.target.value));
  $('playerPreview').addEventListener('change',e=>{
    state.playerPreviewSelection=e.target.value;
    scheduleRender();
  });
  $('view').addEventListener('change',e=>setView(e.target.value));
  $('panelSize').addEventListener('change',e=>{
    state.panelWidth=Number(e.target.value);
    const exactHeights={240:160,320:214,480:320};
    gallery.style.setProperty('--panel-width',`${state.panelWidth}px`);
    gallery.style.setProperty('--panel-height',`${exactHeights[state.panelWidth]??214}px`);
    scheduleRender();
  });
  $('demoToggle').addEventListener('change',e=>{demo.setEnabled(e.target.checked);scheduleRender();});
  $('markingsToggle').addEventListener('change',e=>{state.markings=e.target.checked;scheduleRender();});
  $('outerContour').addEventListener('change',e=>{state.outerContour=e.target.checked;scheduleRender();});
  $('flatTransparency').addEventListener('input',e=>{state.flatTransparency=Number(e.target.value)/100;$('flatValue').textContent=e.target.value+' %';scheduleRender();});
  $('materialMix').addEventListener('input',e=>{state.mix=Number(e.target.value)/100;$('mixValue').textContent=`${e.target.value} %`;scheduleRender();});
  for(const toggle of document.querySelectorAll('[data-look]'))toggle.addEventListener('change',setVisibleLooks);
  const sync=$('colorSync'), color2D=$('color2D'), color3D=$('color3D');
  const syncDisplay=()=>{
    sync.checked=activeColors.sync;
    color2D.value=activeColors.color2D;
    color3D.value=activeColors.color3D;
  };
  syncDisplay();
  sync.addEventListener('change',()=>{activeColors.setSync(sync.checked,'2d');syncDisplay();scheduleRender();});
  color2D.addEventListener('input',()=>{activeColors.edit('2d',color2D.value);syncDisplay();scheduleRender();});
  color3D.addEventListener('input',()=>{activeColors.edit('3d',color3D.value);syncDisplay();scheduleRender();});
  $('pressAll').addEventListener('change',e=>{state.pressed=e.target.checked;scheduleRender();});
  $('triggerPressure').addEventListener('input',e=>{
    state.triggerPressure=Number(e.target.value)/100;
    $('triggerValue').textContent=`${e.target.value} %`;
    scheduleRender();
  });
  $('renderMode').addEventListener('change',e=>{state.renderMode=e.target.value;scheduleRender();});
  $('stickPose').addEventListener('change',e=>{state.stickPose=e.target.value;if(state.stickPose==='live'){demo.setEnabled(false);$('demoToggle').checked=false;}scheduleRender();});
  $('testControl').addEventListener('change',e=>{state.testControl=e.target.value;scheduleRender();});
  $('exportRecipe').addEventListener('click',exportQtRecipe);
  gallery.addEventListener('pointerdown',e=>{
    const sample=e.target.closest('.sample:not(.sample--flat)');if(!sample||!state.renderer)return;
    state.drag={x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch};
    sample.setPointerCapture?.(e.pointerId);
  });
  gallery.addEventListener('pointermove',e=>{
    if(!state.drag)return;
    state.yaw=state.drag.yaw+(e.clientX-state.drag.x)*.008;
    state.pitch=Math.max(-.9,Math.min(.9,state.drag.pitch+(state.drag.y-e.clientY)*.008));
    updateCamera();
  });
  window.addEventListener('pointerup',()=>{state.drag=null;state.manualHeld.clear();scheduleRender();});
  window.addEventListener('pointercancel',()=>{state.manualHeld.clear();scheduleRender();});
  window.addEventListener('blur',()=>{state.drag=null;state.manualHeld.clear();state.manualButtons.clear();scheduleRender();});
  gallery.addEventListener('wheel',e=>{
    if(!e.target.closest('.sample'))return;
    e.preventDefault();
    if(e.shiftKey){document.querySelector('main').scrollLeft+=e.deltaY;return;}
    // Browser page scroll never steals wheel zoom while hovering either viewer.
    state.radius=Math.max(Math.max(3,state.fitRadius*.65),Math.min(Math.max(12,state.fitRadius*2),state.radius*(e.deltaY>0?1.06:.94)));
    updateCamera();
    if(!state.renderer)updateFlatReferences();
  },{passive:false});
  window.addEventListener('resize',scheduleRender);
  window.addEventListener('gamepadconnected',scheduleRender);
  window.addEventListener('gamepaddisconnected',scheduleRender);
  document.addEventListener('visibilitychange',()=>{demo.resetClock();if(!document.hidden)scheduleRender();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleRender).observe(gallery);
}
async function main(){
  makeGallery();bindUI();makeScene();
  createRenderer();
  if(state.renderer){try{await loadEnvironmentProbe();}catch(e){setFail(`HDR-Lichtprobe konnte nicht geladen werden: ${e.message}`);}}
  await loadModel(state.modelId);
  window.__exoPbrLab={get input(){return state.frameInput},get demo(){return demo},get markings(){return state.markings},get flatReferences(){return flatReferences},get status(){return document.body.dataset.renderReady},get model(){return state.native},get variant(){return state.selected},get mix(){return state.mix},get renderer(){return state.renderer},get renderTarget(){return state.renderTarget},get drawStats(){return {...state.drawStats}},get renderMode(){return state.renderMode},get colors(){return {color2D:activeColors.color2D,color3D:activeColors.color3D,sync:activeColors.sync}},get triggerPressure(){return state.triggerPressure},get playerPreview(){return {...state.playerPreview}},get playerLedSurface3D(){return state.native?.playerLedSurface||null},get outerContour(){return state.outerContour}};
}
main().catch(error=>{console.error(error);setFail(`Startfehler: ${error.message}`);});
