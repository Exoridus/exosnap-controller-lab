import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CONTROLLERS, CONTROL_IDS, remoteAssetUrl, remoteAssetMirrors, controlDisplayName } from './models.js';
import { panelViewport, pointerPanel, referencePlaneSize, syncFlatReferenceCamera } from './parity-viewport.js';
import { recolorNeutralForLight } from './parity-color.js';
import { previewStickPose, STICK_TEST_INTERVAL_MS } from './parity-test-pose.js';
import { VIEWER_LAYOUTS, layoutForId, detectLayoutFromGamepad, controllerLabelOverride, semanticControlFrom2DLayer } from './controller-catalog.js';
import { modelPartSemantics, isHousingRole, shouldRenderPart, shouldShowContour } from './model-semantics.js';
import { ControllerReference } from './controller-reference.js';
import { demoStickAxes, stickTiltQuaternion } from './stick-visual-state.js';
import { polishGameCubePart } from './gamecube-stick-geometry.js';
import { MODEL_MECHANICS, stickMechanics, triggerMechanics } from './model-mechanics.js';
import { createHousingContourGeometry } from './housing-contours.js';
import { usesPhysicalDepthMask, physicalDepthPolicy } from './ghost-occlusion.js';
import { inspectObjText } from './mesh-validation.js';
import { readStandardGamepad, controlValuesFromGamepad, hasPhysicalInput, inheritedStickControl, isJoystickTip } from './gamepad-input.js';
import { LiveButtonStabilizer } from './input-stabilizer.js';
import { controllerPartTransform, thumbstickCapSkirtProfile, thumbstickCapRadialSegments, thumbstickTopDisplacement, isFlatThumbCap } from './thumbstick-geometry.js';
import { findApprovedSensorForGamepad, matchAuthorizedSensor } from './motion-autoconnect.js';
import { chooseLiveGamepadInput, BrowserGamepadFreshness } from './sony-hid-gamepad.js';
import { frontFaceTransform } from './model-orientation.js';
import { controllerWorldOrientation, suggestedCameraView } from './motion-pose.js';
import { ghostShellFragmentShader, ghostControlAlpha, pressedControlStyle, ghostControlContourOpacity, ghostOutlineStyle, ghostShellSurfaceOpacity, isSecondaryHousing } from './ghost-appearance.js';
import { bakeStaticBody } from './v24-static-body.js';
import { parametricCapGeometry } from './v24-stick-geometry.js';
import { V24_STICK_MODELS, pressTravelFor, ghostPressOpacity } from './v24-policy.js';
import { styleAt, styleName } from './style-mix.js';
import {EXO_PALETTE} from './palette.js';
import {resolveHeroRecipe} from './pbr-recipes.js';
import { ContrastPass, contrastVariant } from './contrast-pass.js';
import { makeRearHint } from './v24-rear-hints.js';
import { AxisAlignment, AXIS_INSTRUCTIONS, DEFAULT_AXIS_MAPPING, validAxisMapping } from './axis-alignment.js';
import { cameraControlsEnabled } from './camera-policy.js';
import { MotionFusion, STANDARD_GRAVITY, supportedHid } from './motion-input.js';
import { motionFilters, identifyMotionProfile } from './sensor-profiles.js';
import { WebHidMotionSession } from './sensor-session.js';
import { overlayOrientation, eulerAngles, HandheldOverlayMotion, heldDirectOrientation } from './overlay-motion.js';
import { AdaptiveHandReference } from './adaptive-hand-reference.js';
import { presentationOrientation } from './motion-render-policy.js';
import { MOTION_TUNING_DEFAULTS, MOTION_TUNING_PRESETS, matchMotionPreset, loadMotionTuning, saveMotionTuning } from './motion-tuning.js';

const diagnosticParams=new URLSearchParams(location.search);
const diagnostic=diagnosticParams.get('diagnostic')==='1';
const diagnosticAxes=diagnostic?(diagnosticParams.get('stick')||'0,0').split(',').map(Number):null;
const $ = id => document.getElementById(id);
const REQUIRED_UI_IDS=['scene','controllerSelect','shellOpacity','shellOpacityValue','controlsOpacity','controlsOpacityValue',
  'ghostContours','ghostContoursValue','inputSource','gamepadDevice','gamepadStatus','gamepadReadout',
  'backgroundSelect','backgroundDim','backgroundDimValue','screenshotFile','gameBackdrop','gameBackdropDim',
  'referenceMode','referenceOpacity','referenceOpacityValue','referenceFrame','referenceGraphic','referenceTag','parityNotice',
  'motionConnect','motionDisconnect','motionStatus','gyroReadout','accelReadout','tiltReadout','postureReadout','motionTilt','axisGuide',
  'appearanceSelect','motionPose','motionCalibrate','motionAxisLearn','motionRecenter','manualToggle','telemetryToggle','motionDisplayMode',
  'motionTuningToggle','motionTuningPanel','motionTuningReset','motionAutoReturn','motionAdaptiveHand','motionPreset',
  'pitchGain','rollGain','yawGain','pitchMaxDeg','rollMaxDeg','yawMaxDeg','rollYawCombinedMaxDeg','totalCombinedMaxDeg','deadzoneDeg','responseMs'];
const missingUI=REQUIRED_UI_IDS.filter(id=>!$(id));
if(missingUI.length)throw new Error('Incomplete interface: missing '+missingUI.join(', '));
const canvas = $('scene');
const ui = {
  select: $('controllerSelect'), header: $('headerStatus'),
  name: $('modelStageTitle'), brand: $('modelStageSub'), count: $('partCount'),
  overlay: $('loadOverlay'), loadTitle: $('loadTitle'), progress: $('loadProgress'), bar: $('progressBar'),
  footer: $('footerStatus'), footerDetail: $('footerDetail'), toast: $('actionToast')
};
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = new OBJLoader();
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;
renderer.setClearColor(0x161a20, 0);
if(!diagnostic)renderer.autoClear=false; // Per-panel clearing is handled through scissor.

const scene = new THREE.Scene();
// One physical 3D scene and one front-flat SVG reference, each drawn three
// times. Pan/zoom and input are shared; 3D orbit never tilts the 2D reference.
const parityGrid=$('parityGrid');
const parityPanels=[...parityGrid.querySelectorAll('[data-parity-kind]')];
const parityScene=new THREE.Scene();
const parityCamera=new THREE.OrthographicCamera(-5,5,3,-3,.01,180);
const PARITY_RASTER_WIDTH=2048; // Finer SVG detail must survive 3-up downsampling.
const parityTextureCanvas=document.createElement('canvas');
parityTextureCanvas.width=PARITY_RASTER_WIDTH;parityTextureCanvas.height=1150;
const parityTexture= new THREE.CanvasTexture(parityTextureCanvas);
parityTexture.colorSpace=THREE.SRGBColorSpace;
// Light 2D parity must keep saturated BLUE pressed controls BLUE. v26 applied a
// dark multiply to the entire SVG and inadvertently turned presses navy.
const parityLightCanvas=document.createElement('canvas');
parityLightCanvas.width=PARITY_RASTER_WIDTH;parityLightCanvas.height=1150;
const parityLightTexture=new THREE.CanvasTexture(parityLightCanvas);
parityLightTexture.colorSpace=THREE.SRGBColorSpace;
const parityPlane=new THREE.Mesh(new THREE.PlaneGeometry(4.05,2.4),new THREE.MeshBasicMaterial({
  map:parityTexture,color:'#ffffff',transparent:true,depthWrite:false,depthTest:false,
  toneMapped:false,side:THREE.DoubleSide
}));
parityPlane.visible=false;parityScene.add(parityPlane);
let parityRasterPending=false,parityLastRasterAt=0,parityLastKey='',paritySvgIdentity=null;
let parityRasterGeneration=0,parityAllButtons=false;
let lastParityMaterialSvg=null,lastParityMaterialMix=NaN;
let parityPoseStartedAt=0;
let currentParityStickPose=null;
let parityPoseRenderedLabel='';
let parityCurrentAspect=null;
function syncParityPlaneSize(svg){
  if(!svg)return;
  const b=svg.viewBox?.baseVal;
  const aspect=b?.width&&b?.height?b.width/b.height:1.8;
  if(Math.abs(aspect-parityCurrentAspect)<1e-5)return;
  parityCurrentAspect=aspect;
  const size=referencePlaneSize(4.05,aspect);
  parityPlane.geometry.dispose();parityPlane.geometry=new THREE.PlaneGeometry(size.width,size.height);
}
function refreshParitySvg(now,left,right){
  const svg=reference.svg;
  if(!svg){parityPlane.visible=false;return;}
  const axes=(v)=>v?`${Number(v.x||0).toFixed(2)},${Number(v.y||0).toFixed(2)}`:'0,0';
  const fingerprint=currentLayout?.id+'|'+[...controlAmounts].filter(([,v])=>v>.01).map(([k,v])=>k+':'+Number(v).toFixed(2)).sort().join(',')+'|'+axes(left)+'|'+axes(right);
  if(svg===paritySvgIdentity && fingerprint===parityLastKey)return;
  if(parityRasterPending||now-parityLastRasterAt<85)return;
  parityRasterPending=true;parityLastRasterAt=now;
  paritySvgIdentity=svg;parityLastKey=fingerprint;
  const stamp=++parityRasterGeneration;
  const copy=svg.cloneNode(true);
  // Rasterize the authored source widths unchanged. Stick contour loss came
  // from displaced knockout transforms, not from a global stroke-width floor.
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const xml=new XMLSerializer().serializeToString(copy);
  const address=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));
  const image=new Image();
  image.onload=()=>{
    try{
      if(stamp===parityRasterGeneration&&svg===reference.svg){
        const b=svg.viewBox.baseVal;
        const aspect=b.width/b.height;
        const h=Math.max(1,Math.min(PARITY_RASTER_WIDTH,Math.round(PARITY_RASTER_WIDTH/aspect)));
        if(parityTextureCanvas.height!==h)parityTextureCanvas.height=h;
        const context=parityTextureCanvas.getContext('2d');
        context.clearRect(0,0,PARITY_RASTER_WIDTH,h);
        context.drawImage(image,0,0,PARITY_RASTER_WIDTH,h);
        if(parityLightCanvas.height!==h)parityLightCanvas.height=h;
        const lightContext=parityLightCanvas.getContext('2d');
        const lightPixels=context.getImageData(0,0,PARITY_RASTER_WIDTH,h);
        recolorNeutralForLight(lightPixels.data);
        lightContext.putImageData(lightPixels,0,0);
        parityLightTexture.needsUpdate=true;
        parityTexture.needsUpdate=true;parityPlane.visible=true;
        syncParityPlaneSize(svg);
      }
    } finally {URL.revokeObjectURL(address);parityRasterPending=false;}
  };
  image.onerror=()=>{URL.revokeObjectURL(address);parityRasterPending=false;parityPlane.visible=false;console.warn('Could not rasterize 2D SVG reference');};
  image.src=address;
}
function renderParity(){
  if(diagnostic){
    const rect=canvas.getBoundingClientRect();
    contrastPass.prepare(renderer,scene,camera,rect.width,rect.height);
    renderer.render(scene,camera);
    contrastPass.render(renderer,diagnosticParams.get('background')||'dark');
    return;
  }
  const canvasRect=canvas.getBoundingClientRect();
  const first=parityPanels.find(cell=>cell.dataset.parityKind==='3d')?.getBoundingClientRect();
  if(first)contrastPass.prepare(renderer,scene,camera,first.width,first.height);
  renderer.setScissorTest(true);
  for(const cell of parityPanels){
    const viewport=panelViewport(canvasRect,cell.getBoundingClientRect());
    if(!viewport)continue;
    renderer.setViewport(viewport.x,viewport.y,viewport.width,viewport.height);
    renderer.setScissor(viewport.x,viewport.y,viewport.width,viewport.height);
    renderer.clear(true,true,true);
    if(cell.dataset.parityKind==='2d'){
      parityPlane.material.map=cell.dataset.parityScene==='light'?parityLightTexture:parityTexture;
      parityPlane.material.color.set('#ffffff');
      syncFlatReferenceCamera(parityCamera,camera,orbit.target,viewport.width/viewport.height);
      if(parityPlane.visible)renderer.render(parityScene,parityCamera);
    } else {
      renderer.render(scene,camera);
      contrastPass.render(renderer,cell.dataset.parityScene);
    }
  }
  renderer.setScissorTest(false);
}
// Screen-space coverage uses the same physical model, never a convex hull.
const selectedContrast=contrastVariant(diagnosticParams.get('contrast'));
const contrastPass=new ContrastPass({variant:selectedContrast});
if(selectedContrast==='E'){
  contrastPass.material.uniforms.backgroundTexture.value=new THREE.TextureLoader().load('./backgrounds/racing.svg');
}
document.body.dataset.contrast=selectedContrast;

const perspectiveCamera = new THREE.PerspectiveCamera(38, 1, .01, 180);
const referenceCamera = new THREE.OrthographicCamera(-5,5,3,-3,.01,180);
let camera=perspectiveCamera;
perspectiveCamera.position.set(.12,1.8,7.65);
referenceCamera.position.set(0,0,12);
referenceCamera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xe4edff, 0x414957, 2.0));
function directional(color, intensity, x, y, z) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(x,y,z); scene.add(light);
}
directional(0xffffff, 3.3, -3, 8, 8);
directional(0xa0b7dd, 1.25, 6, 5, -6);
directional(0xffffff, .8, -7, 0, -3);


const orbit = new OrbitControls(camera,canvas);
orbit.enableDamping=true; orbit.dampingFactor=.075;
orbit.autoRotate=false; orbit.autoRotateSpeed=.55;
orbit.minDistance=1.8; orbit.maxDistance=50;
orbit.enablePan=true; orbit.screenSpacePanning=true; orbit.panSpeed=1.0;
if('zoomToCursor' in orbit)orbit.zoomToCursor=false; // All six panels zoom around the same target.
orbit.maxPolarAngle=Math.PI*.97;
orbit.target.set(0,0,0); orbit.update();
let transitioning=null;
let autoOrbit=false;
let inputDemo=false;
// One shared rig/material set. Numeric blend only changes presentation.
let style='ghost';
const diagnosticMix=diagnosticParams.has('mix')?Number(diagnosticParams.get('mix')):
  diagnosticParams.get('style')==='studio'?0:diagnosticParams.get('style')==='glass'?.5:1;
let styleMix=diagnostic&&Number.isFinite(diagnosticMix)?THREE.MathUtils.clamp(diagnosticMix,0,1):1;
let look=styleAt(styleMix);
let shellOpacity=look.shell;
let controlsOpacity=look.control;
let contourStrength=look.contour;
const lookOverrides={};
let outlineMode='silhouette';
let solidBody=true;
let sharedSticks=true;
let rearHints=true;

let lastBodyStats=null;
let contourTimer=null;
let currentModel=CONTROLLERS[0];
let currentLayout=layoutForId('dualsense');
let referenceView=false;
let referenceMode='off';
let requestedReferenceMode='off';
let modelBounds=null;
const reference=new ControllerReference($('referenceGraphic'),{
  onPress:id=>{manualControls.set(id,performance.now()+480);toast(displayControlName(id).toUpperCase());}
});
let rootModel=null;
let activeHolders=[];
let housingContour=null;
let contourRoot=null;
let pickMeshes=[];
let modelScale=1;
let fetchToken=0;
let fetchAbort=null;
let lastShowToast=0;
let toastTimeout;
let localModels=[];
const modelMetadata=new Map();
let demoBase=performance.now();
let elapsed=0;
let inputMode='manual';
let selectedGamepad='auto';
let gamepadLastOptions='';
let liveState=null;
let liveStatusStamp=0;
let liveInputSource='unavailable';
let sonyHidInput=null;
let sonyHidInputAt=-Infinity;
const browserGamepadFreshness=new BrowserGamepadFreshness();
const liveButtonStabilizer=new LiveButtonStabilizer();
const ghostLineMaterials=new Set();
// Shared colorless material: render only the nearest *physical* surface into
// the depth buffer. Invisible to the user; moved together with each mesh.
const depthOnlyMaterial=new THREE.MeshBasicMaterial({
  colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide,
  // A tiny positive depth offset preserves visible front-face contour pixels.
  polygonOffset:true,polygonOffsetFactor:.4,polygonOffsetUnits:.4
});
function installPhysicalOccluder(mesh,role){
  const occluder=new THREE.Mesh(mesh.geometry,depthOnlyMaterial);
  occluder.name='physical-depth-mask';
  occluder.userData.depthMask=true;
  occluder.renderOrder=physicalDepthPolicy('ghost',role).renderOrder;
  occluder.frustumCulled=false;
  occluder.visible=true;
  mesh.add(occluder);
  mesh.userData.depthOccluder=occluder;
}

const controlAmounts=new Map();
let motionDevice=null;
let motionSession=null;
let motionProfile=null;
let motionCurrent=null;
const motionFusion=new MotionFusion();
let motionStorage=null;
try{motionStorage=window.localStorage;}catch{}
const handheldMotion=new HandheldOverlayMotion(loadMotionTuning(motionStorage));
const adaptiveReference=new AdaptiveHandReference();
let lastRenderedAt=null;
const MOTION_TUNING_FIELDS=['pitchGain','rollGain','yawGain','pitchMaxDeg','rollMaxDeg','yawMaxDeg','rollYawCombinedMaxDeg','totalCombinedMaxDeg','deadzoneDeg','responseMs'];
function syncMotionTuningUi(){
  for(const key of MOTION_TUNING_FIELDS){
    const v=handheldMotion.options[key];
    const isGain=key.endsWith('Gain');
    $(key).value=String(isGain?Math.round(v*100):v);
    const number=isGain?Math.round(v*100):v;
    $(key+'Value').textContent=isGain?number+' %':key==='responseMs'?number+' ms':
      new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(number)+'°';
  }
  $('motionAutoReturn').checked=handheldMotion.options.autoReturn;
  $('motionAdaptiveHand').checked=handheldMotion.options.adaptiveHand;
  $('motionAdaptiveHand').disabled=$('motionDisplayMode').value!=='overlay';
  $('motionAutoReturn').disabled=$('motionDisplayMode').value!=='overlay';
  $('motionPreset').value=matchMotionPreset(handheldMotion.options);
}
function applyMotionTuningFromUi(){
  const changes={};
  for(const key of MOTION_TUNING_FIELDS){
    const n=Number($(key).value);
    changes[key]=key.endsWith('Gain')?n/100:n;
  }
  changes.autoReturn=$('motionAutoReturn').checked;
  changes.adaptiveHand=$('motionAdaptiveHand').checked;
  if(changes.adaptiveHand!==handheldMotion.options.adaptiveHand){
    handheldMotion.reset();adaptiveReference.reset();
  }
  handheldMotion.setOptions(changes);
  syncMotionTuningUi();
  saveMotionTuning(motionStorage,handheldMotion.options);
}
for(const key of MOTION_TUNING_FIELDS)$(key).addEventListener('input',applyMotionTuningFromUi);
$('motionAutoReturn').addEventListener('change',applyMotionTuningFromUi);
$('motionAdaptiveHand').addEventListener('change',applyMotionTuningFromUi);
$('motionPreset').addEventListener('change',()=>{
  const preset=MOTION_TUNING_PRESETS[$('motionPreset').value];
  if(!preset)return;
  handheldMotion.setOptions({...preset,autoReturn:preset.adaptiveHand?false:handheldMotion.options.autoReturn});
  handheldMotion.reset();adaptiveReference.reset();
  saveMotionTuning(motionStorage,handheldMotion.options);
  syncMotionTuningUi();
});
$('motionTuningToggle').addEventListener('click',()=>{
  const panel=$('motionTuningPanel');panel.hidden=!panel.hidden;
  $('motionTuningToggle').setAttribute('aria-expanded',String(!panel.hidden));
});
$('motionTuningReset').addEventListener('click',()=>{
  handheldMotion.setOptions(MOTION_TUNING_DEFAULTS);
  handheldMotion.reset();adaptiveReference.reset();
  saveMotionTuning(motionStorage,handheldMotion.options);
  syncMotionTuningUi();
});
syncMotionTuningUi();
const axisAlignment=new AxisAlignment();
let axisMappingReady=false;
let axisReturnStillSince=null;
let axisDeviceKey='';
let motionLastPhase="";
let motionLastUi=0;
let autoModel=true;
let detectedGamepadId=null;
let autoMotionAttemptKey=null;
let motionConnecting=false;
let localScreenshotUrl=null;
const manualControls = new Map();
const animatedControls = new Set();
const positions = {
  angled:new THREE.Vector3(1.6,2.7,7.7),
  front:new THREE.Vector3(.12,1.8,7.65),
  table:new THREE.Vector3(.5,7.3,6.3),
  top:new THREE.Vector3(.1,11,.12),
  side:new THREE.Vector3(8.8,1.9,.1),
  rear:new THREE.Vector3(-.12,1.8,-7.65),
  reference:new THREE.Vector3(0,0,7.65),
};

function status(text,details,ready=false) {
  ui.footer.textContent=text; ui.footerDetail.textContent=details;
  document.querySelector('.footer-dot').classList.toggle('ready',ready);
}
function toast(text) {
  ui.toast.textContent=text; ui.toast.classList.add('active');
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>ui.toast.classList.remove('active'),740);
}
function setLoading(title, progress, fraction=0) {
  ui.overlay.classList.remove('hidden');
  $('retryLoad').hidden=true;
  ui.loadTitle.textContent=title;ui.progress.textContent=progress;
  ui.bar.style.width=Math.min(100,Math.max(0,fraction*100))+'%';
}
function hideLoading(){ui.overlay.classList.add('hidden');}
function changeAutoOrbit(on) {
  autoOrbit=on && !prefersReducedMotion && !motionDevice;
  orbit.autoRotate=autoOrbit;
  const el=$('orbitToggle'); el.classList.toggle('on',autoOrbit); el.setAttribute('aria-checked',String(autoOrbit));
}
function updateCameraLock() {
  orbit.enabled=!referenceView && referenceMode!=='2d';
  // The viewer's mouse camera is independent of any attached controller.
  if(!orbit.enabled) changeAutoOrbit(false);
  canvas.style.cursor=orbit.enabled?'grab':'default';
  canvas.title='Ziehen: drehen · Rechtsziehen: verschieben · Rad: Zoom';
}
function changeInputDemo(on) {
  inputDemo=on && !prefersReducedMotion;
  demoBase=performance.now();
  const el=$('demoToggle'); el.classList.toggle('on',inputDemo);el.setAttribute('aria-checked',String(inputDemo));
}
function selectView(view,auto=false) {
  if(!positions[view])return;
  referenceView=view==='reference';
  const nextCamera=referenceView?referenceCamera:perspectiveCamera;
  if(camera!==nextCamera){
    camera=nextCamera;
    orbit.object=camera;
    transitioning=null;
    camera.position.copy(positions[view]);
  } else if(referenceView) {
    transitioning=null;
    camera.position.copy(positions.reference);
  } else {
    transitioning={from:camera.position.clone(),to:positions[view].clone(),start:performance.now(),duration:730};
  }
  if(referenceView){
    camera.lookAt(0,0,0);
    orbit.target.set(0,0,0);
    changeAutoOrbit(false);
  }else if(!auto)changeAutoOrbit(false);
  updateCameraLock();
  orbit.update();
  resize();
  syncReferenceFrame();
  document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.view===view));
}
$('orbitToggle').addEventListener('click',()=>changeAutoOrbit(!autoOrbit));
$('demoToggle').addEventListener('click',()=>{
  inputMode=inputDemo?'manual':'demo';
  $('inputSource').value=inputMode;
  changeInputDemo(inputMode==='demo');
});
$('resetView').addEventListener('click',()=>{
  orbit.target.set(0,0,0);
  selectView('front',true);
  changeAutoOrbit(false);
});
$('runSequence').addEventListener('click',()=>{inputMode='demo';$('inputSource').value='demo';changeInputDemo(true);toast('DEMO');});
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>selectView(el.dataset.view)));

$('shellOpacity').addEventListener('input',event=>{
  shellOpacity=Number(event.target.value)/100;
  $('shellOpacityValue').textContent=`${event.target.value}%`;
  if(style==='glass'||style==='ghost') {
    for(const part of activeHolders) applyPartAppearance(part);
    refreshHousingContour();
  }
});
$('controlsOpacity').addEventListener('input',event=>{
  controlsOpacity=Number(event.target.value)/100;
  $('controlsOpacityValue').textContent=`${event.target.value}%`;
  if(style==='glass'||style==='ghost') {
    for(const part of activeHolders) applyPartAppearance(part);
    refreshHousingContour();
  }
});
$('ghostContours').addEventListener('input',event=>{
  contourStrength=Number(event.target.value)/100;
  $('ghostContoursValue').textContent=`${event.target.value}%`;
  clearTimeout(contourTimer);
  if(style==='ghost')contourTimer=setTimeout(()=>{for(const part of activeHolders)applyPartAppearance(part);refreshHousingContour();},110);
});
$('retryLoad').addEventListener('click',()=>void loadSelectedLayout(currentLayout));
$('ghostOutlineMode').addEventListener('change',event=>{
  outlineMode=event.target.value;
  for(const part of activeHolders)applyPartAppearance(part);
  refreshHousingContour();
});
$('rearHints').addEventListener('change',event=>{
  rearHints=event.target.checked;
  for(const part of activeHolders)applyPartAppearance(part);
  refreshHousingContour();
});
$('solidBody').addEventListener('change',event=>{
  solidBody=event.target.checked;
  toast('Reloading shell geometry');
  void loadSelectedLayout(currentLayout);
});
$('sharedSticks').addEventListener('change',event=>{
  sharedSticks=event.target.checked;
  toast('Reloading stick geometry');
  void loadSelectedLayout(currentLayout);
});

// Game-like sample scenes are locally bundled SVGs. A custom image is loaded
// as a private in-memory blob URL, never uploaded to a server.
const backgroundNames=new Set(['arena','racing','fantasy']);
function applyBackground(name){
  const backdrop=$('gameBackdrop');
  backdrop.style.backgroundImage=name==='custom'&&localScreenshotUrl?`url("${localScreenshotUrl}")`
    :backgroundNames.has(name)?`url("./backgrounds/${name}.svg")`:'none';
  backdrop.style.backgroundColor=name==='light'?'#e3eaf2':'#101827';
  document.body.dataset.scene=name;
  if($('backgroundSelect').querySelector(`option[value="${name}"]`))$('backgroundSelect').value=name;
  $('gameBackdropDim').style.opacity=String(name==='light'?0:name==='dark'?.05:.12);
  if(activeHolders?.length)syncStyleMaterials();
}
$('backgroundSelect').addEventListener('change',event=>{
  const name=event.target.value;
  if(name==='custom'&&!localScreenshotUrl){$('screenshotFile').click();return;}
  applyBackground(name);
});
$('screenshotFile').addEventListener('change',event=>{
  const file=event.target.files?.[0];
  if(!file)return;
  if(!file.type.startsWith('image/')||file.size>30*1024*1024){toast('Choose an image under 30 MB');return;}
  if(localScreenshotUrl)URL.revokeObjectURL(localScreenshotUrl);
  localScreenshotUrl=URL.createObjectURL(file);
  applyBackground('custom');
});
$('backgroundDim').addEventListener('input',event=>{
  const fraction=Number(event.target.value)/100;
  $('gameBackdropDim').style.opacity=String(fraction);
  $('backgroundDimValue').textContent=event.target.value+'%';
});
applyBackground('arena');

// Gamepad API: no proprietary device interpretation. Chrome/Edge expose a
// standard mapping after the page is focused and the user interacts with a pad.
$('inputSource').addEventListener('change',event=>{
  inputMode=event.target.value;
  changeInputDemo(inputMode==='demo');
  if(inputMode==='live')toast('Taste am Gamepad drücken');
  if(inputMode==='manual'){$('manualPanel').hidden=false;$('manualToggle').setAttribute('aria-expanded','true');}
});
$('gamepadDevice').addEventListener('change',event=>{selectedGamepad=event.target.value;});
function obtainGamepads(){
  if(typeof navigator.getGamepads!=='function')return {pads:[],error:'Gamepad API unavailable in this browser'};
  try{return {pads:Array.from(navigator.getGamepads()||[]).filter(p=>p&&p.connected),error:null};}
  catch(error){return {pads:[],error:error.message||'Gamepad permission blocked'};}
}
function refreshGamepadOptions(pads){
  const signature=pads.map(p=>`${p.index}:${p.id}:${p.mapping}`).join('|');
  if(signature===gamepadLastOptions)return;
  gamepadLastOptions=signature;
  const select=$('gamepadDevice');
  const previous=selectedGamepad;
  select.replaceChildren();
  const auto=document.createElement('option');auto.value='auto';auto.textContent='Automatic device';select.appendChild(auto);
  for(const pad of pads){
    const option=document.createElement('option');option.value=String(pad.index);
    option.textContent=`#${pad.index}: ${pad.id.slice(0,70)}${pad.mapping==='standard'?'':' (unmapped)'}`;
    select.appendChild(option);
  }
  if(previous!=='auto'&&!pads.some(p=>String(p.index)===previous)) selectedGamepad='auto';
  select.value=selectedGamepad;
}
function pollGamepad(now){
  const {pads,error}=obtainGamepads();
  if(now-liveStatusStamp>350){
    refreshGamepadOptions(pads);
    liveStatusStamp=now;
    if(inputMode!=='live')$('gamepadStatus').textContent=error||(pads.length?`${pads.length} verbunden`:'Kein Gamepad erkannt');
  }
  if(inputMode!=='live'){
    liveState=null;liveInputSource='unavailable';browserGamepadFreshness.reset();liveButtonStabilizer.reset();return;
  }
  const pad=selectedGamepad==='auto'?pads.find(p=>p.mapping==='standard'):
    pads.find(p=>String(p.index)===selectedGamepad);
  const standard=readStandardGamepad(pad);
  const standardFresh=browserGamepadFreshness.observe(standard,now);
  const isSony=motionProfile?.id==='dualsense'||motionProfile?.id==='ds4';
  const pairedSony=Boolean(motionDevice && isSony &&
    (!pad || matchAuthorizedSensor(pad,[motionDevice])===motionDevice));
  const chosen=chooseLiveGamepadInput({
    standard,hid:sonyHidInput,hidAgeMs:now-sonyHidInputAt,
    sonyHidConnected:pairedSony,standardFresh
  });
  liveState=chosen.source==='unavailable'?null:liveButtonStabilizer.update(chosen.state,chosen.source,now);
  liveInputSource=chosen.source;
  // The optional WebHID sensor connection must not change the Gamepad API
  // button semantics. When connected, Sony input comes from the same HID
  // packet as the sensor, so an old browser L3 snapshot cannot stick.
  // Simplified viewer: Gamepad buttons work without automatically opening the
  // separate motion/HID calibration pipeline. Orbit remains available.
  if(autoModel && pad && detectedGamepadId!==pad.id){
    detectedGamepadId=pad.id;
    const desired=detectLayoutFromGamepad(pad.id);
    const selection=layoutForId(desired);
    if(selection && selection.id!==currentLayout.id)void loadSelectedLayout(selection);
  }
  if(now-liveStatusStamp<24){
    const buttons=liveState?Array.from(liveState.values).filter(([,v])=>v>.12)
      .map(([key])=>key.toUpperCase()).join(', '):'';
    const label=chosen.source==='stale'?'Eingabe pausiert: HID/API nicht aktuell':
      chosen.source==='unavailable'?(error||'Gamepad verbinden'):
      `${chosen.source}${pad?' · '+pad.id.slice(0,31):''}`;
    $('gamepadStatus').textContent=`${label}${buttons?' · '+buttons:''}`;
    const l=liveState?.left||{x:0,y:0},r=liveState?.right||{x:0,y:0};
    $('gamepadReadout').textContent=`Quelle: ${chosen.source} · L: ${l.x.toFixed(2)}/${l.y.toFixed(2)} · R: ${r.x.toFixed(2)}/${r.y.toFixed(2)} · LT: ${(liveState?.values.get('l2')||0).toFixed(2)} · RT: ${(liveState?.values.get('r2')||0).toFixed(2)} · L3: ${liveState?.values.has('ls')?'1':'0'}`;
  }
}
window.addEventListener('gamepadconnected',()=>{gamepadLastOptions='';autoMotionAttemptKey=null;});
window.addEventListener('gamepaddisconnected',()=>{gamepadLastOptions='';liveState=null;autoMotionAttemptKey=null;sonyHidInput=null;sonyHidInputAt=-Infinity;browserGamepadFreshness.reset();liveButtonStabilizer.reset();});

// WebHID and Gamepad API are intentionally separate. A 6-axis IMU cannot
// identify absolute yaw: calibrate while stationary, fuse gyro and gravity,
// then show pose RELATIVE to that reference. No fabricated motion readings.
function motionStatus(message){
  $('motionStatus').textContent=message;
  const show=!axisMappingReady && ['capturing','step-done','invalid','complete'].includes(axisAlignment.status);
  const guide=$('axisGuide');guide.hidden=!show;
  if(show)guide.textContent=message;
}
function calibrationMessage(phase){
  if(phase.status==='ready')return 'Automatisch kalibriert · Handhaltung aktiv';
  if(phase.status==='calibrating')return `Ruhig halten: ${Math.round(phase.progress*100)}%`;
  if(phase.status==='unstable')return 'Bewegung erkannt · stillhalten, automatische Wiederholung';
  return 'Neutralposition noch nicht kalibriert';
}
async function disconnectMotion(){
  if(!motionDevice)return;
  const old=motionSession;
  motionSession=null;motionDevice=null;motionProfile=null;motionCurrent=null;
  sonyHidInput=null;sonyHidInputAt=-Infinity;browserGamepadFreshness.reset();liveButtonStabilizer.reset();
  motionFusion.ready=false;motionFusion.status='uncalibrated';motionLastPhase='';
  handheldMotion.reset();
  adaptiveReference.reset();
  axisAlignment.start();axisMappingReady=false;axisReturnStillSince=null;axisDeviceKey='';updateAxisButton();updateCameraLock();
  try{await old?.close();}catch(error){console.warn('HID close failed:',error);}
  $('motionConnect').disabled=!supportedHid();$('motionDisconnect').disabled=true;
  $('gyroReadout').textContent='—';$('accelReadout').textContent='—';$('tiltReadout').textContent='—';$('postureReadout').textContent='—';
  motionStatus('Sensor getrennt');
}
function updateAxisButton(){
  const btn=$('motionAxisLearn');
  btn.disabled=!motionDevice || motionProfile?.id!=='dualsense';
  btn.textContent=axisAlignment.status==='step-done'?'Weiter':axisAlignment.status==='invalid'?'Wiederholen':
    axisAlignment.status==='capturing'?'Bewegen…':axisAlignment.status==='complete'?'Neu abgleichen':'Achsen lernen';
}
function alignmentStorageKey(device){return `exosnap-3d-imu-map-v1:${device.vendorId.toString(16)}:${device.productId.toString(16)}`;}
function restoreAxisMap(){
  try{
    const mapping=JSON.parse(localStorage.getItem(axisDeviceKey)||'null');
    if(validAxisMapping(mapping) && motionFusion.setAxisMapping(mapping))axisMappingReady=true;
  }catch(error){console.warn('Saved motion axis mapping unavailable:',error);}
}
function captureAxisGesture(){
  if(!motionDevice){motionStatus('Zuerst einen Motion-Controller verbinden');return;}
  if(motionProfile?.id!=='dualsense'){motionStatus('Der Achsenassistent ist nur für Sony DualSense diagnostisch verfügbar');return;}
  if(!motionFusion.ready){motionStatus('Erst neutral kalibrieren und ruhig halten');return;}
  if(axisAlignment.status==='capturing')return;
  if(axisAlignment.status==='idle'||axisAlignment.status==='complete'){
    axisAlignment.start();axisMappingReady=false;motionCurrent=null;
  }
  axisAlignment.beginCapture(performance.now());
  axisReturnStillSince=null;
  motionStatus(axisAlignment.message);
  updateAxisButton();
}
$('motionAxisLearn').addEventListener('click',captureAxisGesture);
function nearNeutralAndStill(sample){
  const a=motionFusion.rawAccel(sample),n=motionFusion.neutralRawGravity;
  const al=Math.hypot(...a),nl=Math.hypot(...n);
  if(al<.7||nl<.7)return false;
  const similarity=(a[0]*n[0]+a[1]*n[1]+a[2]*n[2])/(al*nl);
  return similarity>.95 && Math.hypot(...motionFusion.rawDps(sample))<7;
}
function beginNeutralCalibration(){
  motionFusion.startCalibration($('motionPose').value,performance.now());
  handheldMotion.reset();
  adaptiveReference.reset();
  motionLastPhase='';motionCurrent=null;
  axisAlignment.start();axisReturnStillSince=null;updateAxisButton();
  // Overlay remains front-facing in both flat/upright calibration modes.
  // A stationary sensor never forces a table-camera view.
  motionStatus('Ruhekalibrierung läuft automatisch · Controller kurz ruhig halten');
}
$('motionCalibrate').addEventListener('click',()=>{
  if(!motionDevice){motionStatus('Zuerst einen Motion-Controller verbinden');return;}
  beginNeutralCalibration();
});
$('motionPose').addEventListener('change',()=>{
  if(motionDevice)beginNeutralCalibration();
});
$('motionTilt').addEventListener('change',()=>{handheldMotion.reset();adaptiveReference.reset();updateCameraLock();});
$('motionDisplayMode').addEventListener('change',()=>{
  handheldMotion.reset();adaptiveReference.reset();
  syncMotionTuningUi();
  const labels={overlay:'HANDHALTUNG',direct:'OVERLAY DIREKT',free:'360° DREHUNG'};
  toast(labels[$('motionDisplayMode').value]||'MOTION');
});
$('motionRecenter').addEventListener('click',()=>{
  if(!motionFusion.recenter()){motionStatus('Erst kalibrieren, dann Nullpunkt setzen');return;}
  handheldMotion.reset();adaptiveReference.reset();
  motionStatus('Nullpunkt gesetzt · ruhige Handhaltung');
});
if(!supportedHid()){$('motionConnect').disabled=true;motionStatus('WebHID nur in Chrome/Edge auf localhost');}
// Different HID families share a physical-unit interface, not raw report offsets.
function receiveMotionSample(sample,now){
  if(!motionDevice)return;
  const pausedByWizard=motionProfile?.id==='dualsense'&&!axisMappingReady&&
    ['capturing','step-done','invalid','complete'].includes(axisAlignment.status);
  let phase=motionFusion.phase;
  const wasReady=motionFusion.ready;
  if(phase.ready&&pausedByWizard){
    if(axisAlignment.status==='capturing'){
      const previous=axisAlignment.status;
      axisAlignment.feed({gyroRaw:sample.gyroRaw,gyroBias:motionFusion.gyroBias,now});
      if(axisAlignment.status!==previous){updateAxisButton();motionStatus(axisAlignment.message);}
    }
    if(axisAlignment.status==='complete'){
      if(nearNeutralAndStill(sample)){
        axisReturnStillSince??=now;
        if(now-axisReturnStillSince>=550){
          axisMappingReady=motionFusion.setAxisMapping(axisAlignment.mapping);
          if(axisMappingReady){
            try{localStorage.setItem(axisDeviceKey,JSON.stringify(axisAlignment.mapping));}catch{}
            handheldMotion.reset();adaptiveReference.reset();
            motionStatus('Achsenprofil gespeichert · Live-Bewegung aktiv');updateAxisButton();
          }
        }
      }else axisReturnStillSince=null;
    }
  }else{
    phase=motionFusion.update(sample,now);
    const summary=phase.status+Math.floor(phase.progress*10);
    if(summary!==motionLastPhase){
      motionLastPhase=summary;
      motionStatus(calibrationMessage(phase));
    }
  }
  motionCurrent=phase.ready&&axisMappingReady?{orientation:motionFusion.orientation,received:now}:null;
  // Only a slow reference estimator sees stable samples. The visible
  // controller is ALWAYS updated, even while lifting or placing it down.
  const physical=motionFusion.sensorValues(sample);
  if(phase.ready&&axisMappingReady&&!pausedByWizard&&handheldMotion.options.adaptiveHand){
    adaptiveReference.push(motionFusion.orientation,now,{
      gyroRadS:physical?.gyroRadS,
      accelMS2:physical?.accelMS2,
      activeInput:inputMode==='live'&&hasPhysicalInput(liveState)
    });
  }
  if(now-motionLastUi>110){
    motionLastUi=now;
    const estimate=adaptiveReference.status;
    $('postureReadout').textContent=handheldMotion.options.adaptiveHand
      ? `${estimate.stable?'Hand-Referenz lernt':'Direkte Bewegung'} · ${estimate.bufferSamples}/60` : 'Fixe Handlage';
    const physics=physical;
    $('gyroReadout').textContent=physics?.gyroRadS?.map(v=>v.toFixed(2)).join(' / ')+' rad/s';
    $('accelReadout').textContent=physics?.accelMS2?.map(v=>v.toFixed(2)).join(' / ')+' m/s²';
    if(phase.ready&&axisMappingReady){
      const mode=$('motionDisplayMode').value;
      const pose=mode==='overlay'?handheldMotion.orientation:mode==='direct'?heldDirectOrientation(motionFusion.orientation):overlayOrientation(motionFusion.orientation,'free');
      const e=eulerAngles(pose);
      $('tiltReadout').textContent=[e.pitch,e.roll,e.yaw].map(x=>(x*180/Math.PI).toFixed(1)).join('° / ')+'°';
    }else $('tiltReadout').textContent=pausedByWizard?axisAlignment.message:'Kalibrierung…';
  }
}
// After the first explicit WebHID permission, subsequent gamepad activity
// can reconnect the matching authorized sensor device automatically. Browsers
// do NOT allow a permission dialog from a background render loop.
async function connectMotionDevice(device,{automatic=false}={}){
  if(!device || motionConnecting || motionDevice===device)return false;
  motionConnecting=true;
  try{
    if(motionDevice)await disconnectMotion();
    const profile=identifyMotionProfile(device);
    if(!profile)throw Error('Für dieses Gerät ist kein IMU-Adapter verfügbar');
    motionDevice=device;motionProfile=profile;
    sonyHidInput=null;sonyHidInputAt=-Infinity;browserGamepadFreshness.reset();liveButtonStabilizer.reset();
    $('motionConnect').disabled=true;$('motionDisconnect').disabled=false;
    axisDeviceKey=alignmentStorageKey(device);
    motionFusion.setFactoryCalibration(null);
    motionFusion.setAxisMapping(DEFAULT_AXIS_MAPPING);
    axisMappingReady=true;
    if(profile.id==='dualsense')restoreAxisMap();
    updateCameraLock();updateAxisButton();
    orbit.target.set(0,0,0);selectView('front',true);changeAutoOrbit(false);
    const session=new WebHidMotionSession(device,{
      onSample:receiveMotionSample,
      onInput:(input,at)=>{sonyHidInput=input;sonyHidInputAt=at;},
      onStatus:motionStatus,
      onError:err=>console.warn('WebHID motion error:',err)
    });
    motionSession=session;
    await session.start();
    if(motionDevice!==device){await session.close();return false;}
    handheldMotion.reset();
    beginNeutralCalibration();
    motionStatus(`${profile.name} ${automatic?'automatisch verbunden':'verbunden'} · ${session.calibration?'Werkskalibrierung':'SDL-Fallback'} · kurz ruhig halten`);
    return true;
  }catch(error){
    await disconnectMotion();
    motionStatus('Sensorverbindung fehlgeschlagen: '+(error.message||String(error)));
    return false;
  }finally{
    motionConnecting=false;
    $('motionConnect').disabled=!supportedHid()||!!motionDevice;
  }
}
async function tryAutoConnectMotion(pad){
  if(!supportedHid()||motionDevice||motionConnecting||!pad)return;
  const key=pad.index+':'+pad.id;
  if(autoMotionAttemptKey===key)return;
  // Set before awaiting getDevices so long button presses cannot flood it.
  autoMotionAttemptKey=key;
  try{
    const approved=await findApprovedSensorForGamepad(pad,navigator.hid);
    if(approved && !motionDevice && !motionConnecting){
      await connectMotionDevice(approved,{automatic:true});
    }else if(!approved && !motionDevice && inputMode==='live'){
      motionStatus('Tasten erkannt · Sensoren beim ersten Mal einmal freigeben');
    }
  }catch(error){
    motionStatus('Automatische Sensorprüfung fehlgeschlagen: '+(error.message||String(error)));
  }
}
$('motionConnect').addEventListener('click',async()=>{
  if(!supportedHid())return;
  try{
    // requestDevice MUST be initiated by this click, not by automatic input.
    const devices=await navigator.hid.requestDevice({filters:motionFilters()});
    if(!devices.length){motionStatus('Kein Gerät ausgewählt');return;}
    await connectMotionDevice(devices[0]);
  }catch(error){
    motionStatus('WebHID-Berechtigung fehlgeschlagen: '+(error.message||String(error)));
  }
});
$('motionDisconnect').addEventListener('click',()=>void disconnectMotion());
if(supportedHid())navigator.hid.addEventListener('disconnect',event=>{if(event.device===motionDevice)void disconnectMotion();});

// Unified appearance: no extra 3D models or scene rebuilds while dragging.
function effectiveLook(){return {...styleAt(styleMix),...lookOverrides};}
function syncStyleMaterials(){
  look=effectiveLook();
  shellOpacity=look.shell;controlsOpacity=look.control;contourStrength=look.contour;
  const progress=THREE.MathUtils.smoothstep(styleMix,0,1);
  for(const part of activeHolders){
    for(const mesh of part.userData.meshes||[]){
      const mat=mesh.material;
      if(mat?.userData?.normalColor && mat.userData.ghostColor){
        mat.userData.baseColor.copy(mat.userData.normalColor).lerp(mat.userData.ghostColor,progress);
        // Press/animation loop owns the final visual tint; this is its idle value.
        if(part.userData.shell)mat.color.copy(mat.userData.baseColor);
        mat.transparent=true;
        mat.opacity=part.userData.shell?look.shell:(mat.userData.isCap?look.cap:look.control);
        mat.roughness=part.userData.shell?.74-.48*(1-progress):.78;
        mat.metalness=part.userData.shell?.03:.02;
        mat.clearcoat=part.userData.shell?.18*(1-progress):.06;
        if(mat.userData.rimUniform)mat.userData.rimUniform.value=look.rim;
      }
      const outline=mesh.userData.silhouette;
      if(outline){outline.visible=look.contour>.002;outline.material.opacity=Math.min(.86,look.contour*1.22);}
      const edge=mesh.userData.edge;
      if(edge){
        const hi=edge.userData.highlight,lo=edge.userData.shadow;
        if(hi)hi.material.opacity=Math.min(.95,look.contour*(part.userData.shell?.83:1.18));
        if(lo)lo.material.opacity=Math.min(.95,look.contour*(part.userData.shell?.8:1.10));
      }
      const rear=mesh.userData.rearHint;
      if(rear){rear.visible=look.rear>.002;rear.material.opacity=look.rear;}
    }
  }
  if(housingContour){
    for(const x of housingContour.children)if(x.material)x.material.opacity=Math.min(1,look.contour);
  }
}
function syncSimpleControls(){
  const percent=v=>Math.round(100*v)+' %';
  const data=effectiveLook();
  for(const [key,id,output] of [
    ['shell','simpleShell','simpleShellValue'],['control','simpleControl','simpleControlValue'],
    ['rim','simpleRim','simpleRimValue']]){
      $(id).value=Math.round(100*data[key]);$(output).textContent=percent(data[key]);
  }
  $('simpleLookMix').value=Math.round(100*styleMix);
  $('simpleLookLabel').textContent=styleName(styleMix)+' · '+Math.round(100*styleMix)+' %';
  document.querySelectorAll('[data-look]').forEach(el=>{
    const active=Math.abs(Number(el.dataset.look)-styleMix)<.025;
    el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));
  });
}
function setLookBlend(value,resetOverrides=true){
  styleMix=THREE.MathUtils.clamp(value,0,1);
  if(resetOverrides)for(const key of Object.keys(lookOverrides))delete lookOverrides[key];
  syncSimpleControls();syncStyleMaterials();
}
function syncSimpleGamepad(){
  const {pads}=obtainGamepads();
  const active=pads.length>0;
  $('simpleLed').classList.toggle('connected',active&&inputMode==='live');
  $('simpleStatus').textContent=inputMode==='manual'?'Vorschau · frei drehen und zoomen':active?'Controller verbunden · Kamera frei':'Kein Gamepad verbunden';
}
// The old feature-rich controls remain invisible compatibility nodes: only
// model, input mode, style and background are exposed in the focused preview.
// Populate after the hidden source selector is built; otherwise the visible
// dropdown is empty on first load (a v26 initialization order regression).
$('simpleModel').addEventListener('change',()=>{
  $('controllerSelect').value=$('simpleModel').value;
  $('controllerSelect').dispatchEvent(new Event('change',{bubbles:true}));
});
$('simpleMode').value='manual';
$('inputSource').value='manual';
$('motionTilt').checked=false;
$('simpleMode').addEventListener('change',()=>{
  if($('simpleMode').value==='live'&&parityAllButtons){
    // Synthetic full-press test must never override a connected controller.
    parityAllButtons=false;currentParityStickPose=null;
    $('simpleAllButtons').checked=false;
    syncParityPoseUi();
  }
  $('inputSource').value=$('simpleMode').value;
  $('inputSource').dispatchEvent(new Event('change',{bubbles:true}));
  syncSimpleGamepad();updateCameraLock();
});
$('simpleBackground').addEventListener('change',()=>{
  const choice=$('simpleBackground').value;
  if(choice==='custom'){$('screenshotFile').click();return;}
  applyBackground(choice);
  document.body.dataset.scene=choice;
});
$('simpleReset').addEventListener('click',()=>{$('resetView').click();});
$('simpleDetailsToggle').addEventListener('click',()=>{
  const panel=$('simpleDetails');panel.hidden=!panel.hidden;
  $('simpleDetailsToggle').setAttribute('aria-expanded',String(!panel.hidden));
});
$('simpleLookMix').addEventListener('input',event=>setLookBlend(Number(event.target.value)/100));
for(const button of document.querySelectorAll('[data-look]'))button.addEventListener('click',()=>setLookBlend(Number(button.dataset.look)));
for(const [key,id,output] of [
  ['shell','simpleShell','simpleShellValue'],['control','simpleControl','simpleControlValue'],
  ['rim','simpleRim','simpleRimValue']]){
  $(id).addEventListener('input',()=>{
    lookOverrides[key]=Number($(id).value)/100;
    $(output).textContent=$(id).value+' %';
    syncStyleMaterials();
  });
}
$('simpleDefaults').addEventListener('click',()=>setLookBlend(styleMix));
function syncParityPoseUi(){
  const section=$('simpleStickPoseOptions');
  section.hidden=!parityAllButtons;
  $('simpleStickDirection').disabled=!parityAllButtons;
  if(!parityAllButtons){
    $('simplePoseStatus').textContent='';
    parityPoseRenderedLabel='';
  }
}
$('simpleAllButtons').addEventListener('change',event=>{
  parityAllButtons=event.target.checked;
  parityPoseStartedAt=performance.now();
  currentParityStickPose=null;
  syncParityPoseUi();
  if(parityAllButtons&&inputMode==='live'){$('simpleMode').value='manual';$('simpleMode').dispatchEvent(new Event('change'));}
});
$('simpleStickDirection').addEventListener('change',()=>{
  parityPoseStartedAt=performance.now();
  currentParityStickPose=null;
  parityPoseRenderedLabel='';
});
$('simpleResetInputs').addEventListener('click',()=>{
  parityAllButtons=false;currentParityStickPose=null;manualControls.clear();
  $('simpleAllButtons').checked=false;
  $('simpleStickDirection').value='auto';
  syncParityPoseUi();
  if(inputMode!=='manual'){$('simpleMode').value='manual';$('simpleMode').dispatchEvent(new Event('change'));}
});
syncParityPoseUi();
$('simpleRearHints').addEventListener('change',event=>{
  rearHints=event.target.checked;
  // Existing model remains loaded. Rebuild only optional line helpers.
  for(const part of activeHolders)applyPartAppearance(part);
  syncStyleMaterials();
});
$('simpleBackground').value='dark';
applyBackground('dark');document.body.dataset.scene='dark';
syncSimpleControls();syncSimpleGamepad();
window.addEventListener('gamepadconnected',syncSimpleGamepad);
window.addEventListener('gamepaddisconnected',syncSimpleGamepad);

$('appearanceSelect').addEventListener('change',e=>{
  // Legacy viewer style selector is not exposed; use the visible mix control.
  setLookBlend(e.target.value==='studio'?0:e.target.value==='glass'?.5:1);
});
$('manualToggle').addEventListener('click',()=>{
  const open=$('manualPanel').hidden; $('manualPanel').hidden=!open;
  $('manualToggle').setAttribute('aria-expanded',String(open));
});
$('telemetryToggle').addEventListener('click',()=>{
  const open=$('telemetryPanel').hidden; $('telemetryPanel').hidden=!open;
  $('telemetryToggle').setAttribute('aria-expanded',String(open));
});

const groups=[
  ['faceControls',['b4','b3','b2','b1']],
  ['dpadControls',['up','left','down','right']],
  ['otherControls',['l1','r1','l2','r2','ls','rs','touchpad','start','select','home','share']]
];
const buttons=new Map();
function displayControlName(id){
  return controllerLabelOverride(currentLayout?.id,id)||controlDisplayName(id,currentLayout?.family||currentModel.family);
}
function drawControlButtons(){
  buttons.clear();
  const layers=reference.mapping?.id===currentLayout?.id?reference.mapping.layers:null;
  const available=layers?new Set(layers.map(semanticControlFrom2DLayer).filter(Boolean)):null;
  if(layers){for(const layer of layers)if(layer.role==='directional-pad'){
    for(const direction of ['up','down','left','right'])available.add(direction);
  }}
  const known=new Set();
  const preview=new Set(layers?.filter(x=>x.preview?.key).map(x=>semanticControlFrom2DLayer(x)).filter(Boolean)||[]);
  const extras=[...(available||[])].filter(id=>!groups.some(([,ids])=>ids.includes(id)));
  function append(container,id){
    const button=document.createElement('button');
    const qualified=!preview.has(id);
    button.type='button';button.className='control-key';button.dataset.control=id;
    button.textContent=displayControlName(id)+(qualified?'':' · Test');
    button.title=(qualified?'Manuell aktivieren: ':'Vorschau ohne Standard-Gamepad-Binding: ')+displayControlName(id);
    button.setAttribute('aria-label',button.title);
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      button.setPointerCapture(event.pointerId);
      manualControls.set(id,performance.now()+8000);
      button.classList.add('pressed');toast(displayControlName(id).toUpperCase());
    });
    const release=()=>manualControls.set(id,performance.now()+500);
    button.addEventListener('pointerup',release);
    button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',release);
    $(container).appendChild(button);buttons.set(id,button);known.add(id);
  }
  for(const [container,ids]of groups){
    $(container).replaceChildren();
    for(const id of ids){
      if(available&&!available.has(id))continue;
      if(!available&&id==='touchpad'&&currentLayout.family!=='playstation')continue;
      append(container,id);
    }
  }
  $('touchControls').replaceChildren();
  for(const id of extras)if(!known.has(id))append('touchControls',id);
  $('touchHeading').hidden=!extras.length;
  $('touchControls').hidden=!extras.length;
}
const autoOption=document.createElement('option');autoOption.value='auto';autoOption.textContent='Auto · angeschlossenes Gamepad';ui.select.appendChild(autoOption);
const groupNodes=new Map();
for(const layout of VIEWER_LAYOUTS){
  const family=layout.family||'generic';
  let parent=groupNodes.get(family);
  if(!parent){parent=document.createElement('optgroup');parent.label=({playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo',steam:'Steam',generic:'Andere'})[family]||family;groupNodes.set(family,parent);ui.select.appendChild(parent);}
  const option=document.createElement('option');option.value=layout.id;
  option.textContent=layout.name+(layout.availability==='reference'?' · nur 2D':layout.availability==='proxy'?' · 3D-Basis':'');
  parent.appendChild(option);
  if(layout.availability!=='reference'){
    const display=document.createElement('option');display.value=layout.id;
    display.textContent=option.textContent;
    $('simpleModel').append(display);
  }
}
$('simpleModel').value=currentLayout.id;
ui.select.addEventListener('change',()=>{
  autoModel=ui.select.value==='auto';
  if(autoModel){detectedGamepadId=null;return;}
  const layout=layoutForId(ui.select.value);
  if(layout)void loadSelectedLayout(layout);
});
function syncReferenceFrame(){
  const has2D=Boolean(currentLayout?.has2D);
  const actual3D=Boolean(rootModel)&&currentLayout?.availability!=='reference';
  if(!has2D)referenceMode='off';
  else if(!actual3D)referenceMode='2d';
  else referenceMode=requestedReferenceMode;
  $('referenceMode').value=referenceMode;
  $('referenceMode').disabled=!has2D||!actual3D;
  $('referenceOpacity').disabled=referenceMode!=='overlay';
  $('referenceOpacitySetting').style.opacity=referenceMode==='overlay'?'1':'.45';
  const stage=document.querySelector('.stage');
  stage.dataset.referenceMode=referenceMode;
  $('referenceFrame').hidden=referenceMode==='off';
  const svg=reference.svg;
  if(svg){
    svg.style.opacity=referenceMode==='overlay'?String(Number($('referenceOpacity').value)/100):'1';
    if(referenceMode==='overlay'&&modelBounds){
      const rect=canvas.getBoundingClientRect();
      const aspect=Math.max(.1,rect.width/Math.max(1,rect.height));
      const visibleHeight=referenceView?(referenceCamera.top-referenceCamera.bottom):
        2*camera.position.distanceTo(orbit.target)*Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov/2));
      const visibleWidth=visibleHeight*aspect;
      svg.style.width=`${Math.max(20,Math.min(90,modelBounds.x/visibleWidth*100)).toFixed(2)}%`;
      svg.style.height='auto';svg.style.maxHeight='80%';
    }else{svg.style.removeProperty('width');svg.style.removeProperty('height');svg.style.removeProperty('max-height');}
  }
  const note=currentLayout?.note||'';
  const showNotice=currentLayout?.availability!=='native';
  $('parityNotice').textContent=note;
  $('parityNotice').hidden=!showNotice;
  $('referenceTag').textContent=currentLayout?.availability==='reference'?'Nur 2D · kein 3D-Modell':'2D Referenz · '+currentLayout?.name;
  updateCameraLock();
}
$('referenceMode').addEventListener('change',event=>{requestedReferenceMode=event.target.value;syncReferenceFrame();});
$('referenceOpacity').addEventListener('input',event=>{
  $('referenceOpacityValue').textContent=event.target.value+'%';
  syncReferenceFrame();
});
async function loadSelectedLayout(layout){
  currentLayout=layout;
  // 2D references always display their own stable ID. For proxy 3D the
  // base model remains honest: unmodelled variant parts are NOT invented.
  reference.load(layout).then(()=>{if(currentLayout!==layout)return;drawControlButtons();syncReferenceFrame();});
  const model=layout.availability==='composite'?layout.modelIds.map(id=>CONTROLLERS.find(x=>x.id===id)):
    CONTROLLERS.find(x=>x.id===layout.modelId);
  if(!model||(Array.isArray(model)&&model.some(x=>!x))){
    fetchToken++;fetchAbort?.abort();fetchAbort=null;
    disposeModel();modelBounds=null;
    manualControls.clear();animatedControls.clear();
    ui.name.textContent=layout.name;ui.brand.textContent='2D-Referenz · kein 3D-Modell';
    ui.count.textContent='2D';ui.header.textContent='2D reference';
    ui.select.value=autoModel?'auto':layout.id;
    $('modelSource').textContent='2D-Designpaket · Referenzdarstellung';
    status(layout.name,'Nur 2D · echtes 3D-Modell noch nicht verfügbar');
    hideLoading();drawControlButtons();syncReferenceFrame();
    return;
  }
  await loadController(model);
  if(currentLayout!==layout)return;
  ui.name.textContent=layout.name;
  if($('simpleModel')?.querySelector(`option[value="${layout.id}"]`))$('simpleModel').value=layout.id;
  if(layout.availability==='proxy')ui.brand.textContent=`${model.brand} · 3D-Basis (nicht vollständig)`;
  else if(layout.availability==='composite')ui.brand.textContent='Nintendo Joy-Con L + R · 3D-Komposition';
  syncReferenceFrame();
}

defaultView();
function defaultView(){
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view==='front'));
  $('appearanceSelect').value='ghost';style='ghost';
  changeAutoOrbit(false);changeInputDemo(inputMode==='demo');
  $('ghostContoursSetting').classList.toggle('active',true);
}

// Controller coordinate frames use proper rotations only. Negative local
// Y scaling would reflect every 3dco+ model and put the BUTTON FACE behind
// the +Z camera. Keep D-pad on the left and face buttons on the right.
const PRESSED_BLUE = new THREE.Color(EXO_PALETTE.pressedBlue);
const DARK_EMISSIVE = new THREE.Color('#000000');
const PRESSED_EMISSIVE = new THREE.Color(EXO_PALETTE.pressedEmissive);
const IDLE_EDGE = new THREE.Color('#d7eafa');
const controlColorScratch=new THREE.Color();

function isVisualControl(file,meta=null){return !isHousingRole(modelPartSemantics(file,currentModel,meta).role);}
function isShellFile(file,meta=null){return isHousingRole(modelPartSemantics(file,currentModel,meta).role);}
function isGhostOutlinedPart(file,meta=null){return shouldRenderPart(modelPartSemantics(file,currentModel,meta).role);}
function isFaceShell(file){return /top[_-]?shell|mainbodyfront|mainbodytop|^mainbody\.obj$/i.test(file);}
function makeCuratedEdges(geometry,strength,file){
  const position=geometry.attributes.position;
  if(!position||position.count<9||position.count>90000)return null;
  // Strongly prefer silhouette/functional creases over every shell bevel.
  const angle=(isFaceShell(file)?76:64)-strength*19;
  const raw=new THREE.EdgesGeometry(geometry,angle);
  const points=raw.getAttribute('position');
  if(!points||points.count<2){raw.dispose();return null;}
  // v21: the old "longest N edges" truncation broke shell outlines into
  // visibly disconnected fragments. Preserve coherent source feature edges;
  // reject only near-zero degenerate edges, not valid small details.
  const maxEdges=isFaceShell(file)?3400:900;
  const bounds=new THREE.Box3().setFromBufferAttribute(position);
  const diag=Math.max(.001,bounds.getSize(new THREE.Vector3()).length());
  const minLength=diag*.001;
  const values=[];
  for(let i=0;i+1<points.count;i+=2){
    if(values.length/6>=maxEdges)break;
    const x=points.getX(i)-points.getX(i+1),y=points.getY(i)-points.getY(i+1),z=points.getZ(i)-points.getZ(i+1);
    if(Math.hypot(x,y,z)<minLength)continue;
    for(let k=0;k<2;k++)values.push(points.getX(i+k),points.getY(i+k),points.getZ(i+k));
  }
  raw.dispose();
  if(!values.length)return null;
  const cleaned=new THREE.BufferGeometry();
  cleaned.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  return cleaned;
}
function mappedColor(meta) {
  if (!meta || !Array.isArray(meta.color) || meta.color.length < 3) return null;
  const arr=meta.color.map(v=>Math.min(1,Math.max(0,Number(v)||0)));
  return new THREE.Color().setRGB(arr[0],arr[1],arr[2],THREE.SRGBColorSpace);
}
function materialFor(file,model,meta=null) {
  const name=file.replace(/\.obj$/i,'');
  const s=name.toLowerCase();
  const semantic=modelPartSemantics(file,model,meta);
  const key=semantic.control||semantic.pickControl;
  const shell=isHousingRole(semantic.role);
  const ps=model.family==='playstation';
  const xbox=model.family==='xbox';
  let color=mappedColor(meta)||new THREE.Color(model.color);
  let roughness=.5,metalness=.08,clearcoat=.15;
  if (!meta) {
    if (/(bodyback|mainbodyback|battery|motor|interior|undercarriage)/i.test(s)) {color=new THREE.Color(ps?'#949ca9':'#8f949d');roughness=.72;}
    if (/mainbodyfront|mainbodytop|mainbody|mainbodyside|bodyback/i.test(s)) color=new THREE.Color(model.color);
    if (/screen|touch|usb|charger|port|ring|stick|joystick|special|button|dpad|shoulder|^l1$|^r1$/i.test(s)) color=new THREE.Color('#27303b');
    if (/motor|ring|joystick/i.test(s)){color=new THREE.Color('#242933');roughness=.8;}
    if (/symbol|arrow|icon|text|logo/i.test(s))color=new THREE.Color('#aab5c4');
    if (/^led\d|specialled/i.test(s))color=new THREE.Color('#85afc0');
    if (/^b[1-4](?:-symbol|buttonsymbol)/i.test(s)&&ps) {
      const id=s.match(/b[1-4]/)[0];color=new THREE.Color({b1:'#85b1ce',b2:'#d38d9e',b3:'#baa9d5',b4:'#8bb8aa'}[id]);
    }
    if (/^b[1-4](?:-symbol|buttonsymbol|button$|-button$)/i.test(s)&&xbox) {
      const id=s.match(/b[1-4]/)[0];color=new THREE.Color({b1:'#72b37a',b2:'#d77975',b3:'#77a1d1',b4:'#d7bd72'}[id]);
    }
    if (/^(b[1-4]|dpad(up|left|right|down))$/i.test(s))color=new THREE.Color('#2d3643');
  }
  if(model.id==='Gamecube'&&/^left_(stick|ring|cap)\.obj$/.test(file)){
    color.multiplyScalar(.55);roughness=.94;metalness=0;clearcoat=0;
  }
  if(model.id==='Gamecube'&&/^right_(stick|ring|cap)\.obj$/.test(file)){roughness=.85;metalness=0;clearcoat=0;}
  if(style==='graphite') {
    color=new THREE.Color(shell?'#525e6c':(key?'#222b38':'#303844'));
    roughness=.62;metalness=.06;
  }
  if(style==='wire') {
    const mat=new THREE.MeshBasicMaterial({color:key?'#8aabbe':'#657988',wireframe:true,transparent:true,opacity:.68,depthWrite:false,side:THREE.DoubleSide});
    mat.userData.baseColor=mat.color.clone();return mat;
  }
  if(style==='glass'||style==='ghost') {
    const isGhost=style==='ghost';
    if(shell) {
      color=new THREE.Color(isGhost?'#cadbe8':'#718ba5');
      roughness=isGhost?1:.18;metalness=isGhost?0:.10;clearcoat=isGhost?0:1;
      const mat=new THREE.MeshPhysicalMaterial({color,roughness,metalness,clearcoat,clearcoatRoughness:.24,
        transparent:true,opacity:shellOpacity,depthWrite:false,side:THREE.FrontSide});
      if(isGhost){
        // Stable shader program across all Normal / Glass / Ghost transitions.
        const uniform={value:look.rim};
        mat.userData.rimUniform=uniform;
        mat.onBeforeCompile=shader=>{
          shader.uniforms.exoRimIntensity=uniform;
          shader.fragmentShader='uniform float exoRimIntensity;\n'+shader.fragmentShader.replace(
            '#include <opaque_fragment>',`float exoFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
              float exoRim = pow(clamp(1.0-exoFacing,0.0,1.0),3.2);
              outgoingLight=mix(outgoingLight,vec3(0.79,0.88,0.98),exoRim*exoRimIntensity*0.68);
              diffuseColor.a=clamp(diffuseColor.a+exoRim*exoRimIntensity*0.22,0.0,1.0);
              #include <opaque_fragment>`);
        };
        mat.customProgramCacheKey=()=> 'exo-controller-v25-shell-rim-v1';
      }
      mat.userData.normalColor=mappedColor(meta)||new THREE.Color(model.color);
      mat.userData.ghostColor=mat.color.clone();
      mat.userData.baseColor=mat.color.clone();mat.userData.isShell=true;
      return mat;
    }
    const physicalThumb=semantic.role==='stick-cap'||Boolean(MODEL_MECHANICS[model.id]?.authoredCapAssembly
      &&['stick-pivot','stick-stem'].includes(semantic.role));
    const originalColor=color.clone();
    color=new THREE.Color(physicalThumb?'#283c50':/symbol|arrow|icon/i.test(s)?'#d4e1ed':key?'#25313e':'#344454');
    if(isGhost){
      // The unmodified depth-only proxy still writes physical depth. Only the
      // visible surface and its press tint are translucent.
      const dark=new THREE.Color(physicalThumb?'#41586c':'#445c71');
      const light=new THREE.Color(EXO_PALETTE.idleControl);
      color.copy(dark).lerp(light,Math.min(1,Math.max(0,controlsOpacity)));
    }
    if(isGhost){roughness=physicalThumb?.88:.72;metalness=.02;clearcoat=.04;}
    else {roughness=physicalThumb?.78:.48;metalness=physicalThumb?.03:.09;clearcoat=physicalThumb?.14:.30;}
    const mat=new THREE.MeshPhysicalMaterial({color,roughness,metalness,clearcoat,clearcoatRoughness:.3,side:THREE.DoubleSide,
      transparent:true,opacity:controlsOpacity,
      depthTest:true,depthWrite:false});
    if(selectedContrast==='D'){
      const rimUniform={value:look.rim};
      mat.userData.rimUniform=rimUniform;
      mat.onBeforeCompile=shader=>{
        shader.uniforms.exoControlRim=rimUniform;
        shader.fragmentShader='uniform float exoControlRim;\n'+shader.fragmentShader.replace(
          '#include <opaque_fragment>',`float exoControlFacing=abs(dot(normalize(normal),normalize(vViewPosition)));
          float exoControlEdge=pow(clamp(1.0-exoControlFacing,0.0,1.0),2.8)*exoControlRim;
          outgoingLight=mix(outgoingLight,vec3(.72,.84,.94),exoControlEdge*.40);
          diffuseColor.a=clamp(diffuseColor.a+exoControlEdge*.18,0.0,1.0);
          #include <opaque_fragment>`);
      };
      mat.customProgramCacheKey=()=> 'exo-controller-v29-control-rim';
    }
    mat.userData.normalColor=originalColor;mat.userData.ghostColor=mat.color.clone();
    mat.userData.baseColor=mat.color.clone();mat.userData.isCap=physicalThumb;
    return mat;
  }
  const mat=new THREE.MeshPhysicalMaterial({color,roughness,metalness,clearcoat,clearcoatRoughness:.3,side:THREE.DoubleSide});
  mat.userData.baseColor=mat.color.clone();
  return mat;
}
function disposeContourGroup(group){
  if(!group)return;
  group.parent?.remove(group);
  group.traverse(object=>{
    if(!object.isLineSegments2)return;
    ghostLineMaterials.delete(object.material);
    object.geometry.dispose();object.material.dispose();
  });
}
function createContrastingContour(edgeGeo,part){
  const points=edgeGeo.getAttribute('position');
  if(!points)return null;
  const source=points.array;
  const bright=['racing','custom','light'].includes(document.body.dataset.scene);
  const kind=part.userData.shell?'shell':'control';
  const spec=ghostOutlineStyle({strength:contourStrength,kind,brightBackground:bright});
  const group=new THREE.Group();
  for(const [name,width,opacity,color,order] of [
    ['shadow',spec.shadowWidthPx,spec.shadowOpacity,spec.shadowColor,4],
    ['highlight',spec.highlightWidthPx,spec.highlightOpacity,spec.highlightColor,5]
  ]){
    const geometry=new LineSegmentsGeometry();
    geometry.setPositions(source);
    const material=new LineMaterial({color,linewidth:width,transparent:true,
      opacity:Math.min(1,opacity),depthWrite:false,depthTest:true,worldUnits:false});
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    material.resolution.copy(size);
    ghostLineMaterials.add(material);
    const lines=new LineSegments2(geometry,material);
    lines.renderOrder=order;
    lines.frustumCulled=false;
    group.add(lines);
    group.userData[name]=lines;
  }
  return group;
}
function applyPartAppearance(part) {
  for(const mesh of part.userData.meshes){
    if(mesh.userData.silhouette){
      mesh.remove(mesh.userData.silhouette);
      mesh.userData.silhouette.material.dispose();
      mesh.userData.silhouette=null;
    }
    if(mesh.userData.rearHint){
      const hint=mesh.userData.rearHint;
      mesh.remove(hint);ghostLineMaterials.delete(hint.material);hint.geometry.dispose();hint.material.dispose();
      mesh.userData.rearHint=null;
    }
    if(mesh.userData.depthOccluder)mesh.userData.depthOccluder.visible=true;
    if(mesh.userData.edge){disposeContourGroup(mesh.userData.edge);mesh.userData.edge=null;}
    mesh.material.dispose();
    mesh.material=materialFor(part.userData.file,part.userData.sourceModel||currentModel,part.userData.meta);
    mesh.renderOrder=part.userData.shell?1:2;
    if(style==='ghost'&&part.userData.shell
       &&(part.userData.bakedStatic?part.userData.staticBucket!=='rear':isFaceShell(part.userData.file))
       &&outlineMode==='silhouette'&&contourStrength>.01){
      // Expanded backfaces produce a silhouette without drawing panel seams.
      const ink=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({
        color:'#101c2a',side:THREE.BackSide,transparent:true,
        opacity:Math.min(.88,.32+contourStrength*.62),depthWrite:false,depthTest:true
      }));
      ink.scale.setScalar(1.018);ink.renderOrder=3;ink.frustumCulled=false;
      ink.userData.outerSilhouette=true;
      mesh.add(ink);mesh.userData.silhouette=ink;
    }
    if(style==='ghost'&&rearHints){
      const key=part.userData.visualControl||part.userData.control;
      const hint=makeRearHint(mesh,part.userData.role,key,.26+contourStrength*.24);
      if(hint){mesh.add(hint);mesh.userData.rearHint=hint;ghostLineMaterials.add(hint.material);}
    }
    if(style==='ghost'&&!part.userData.mergedHousingContour&&isGhostOutlinedPart(part.userData.file,part.userData.meta)&&contourStrength>.01){
      // The rear/battery shell should not create a second network of lines
      // over the single front housing silhouette.
      if(!shouldShowContour(part.userData.file,part.userData.role,style))continue;
      const edgeGeo=makeCuratedEdges(mesh.geometry,contourStrength,part.userData.file);
      if(edgeGeo){
        const group=createContrastingContour(edgeGeo,part);
        edgeGeo.dispose();
        if(group){mesh.add(group);mesh.userData.edge=group;}
      }
    }
  }
}
function refreshHousingContour(){
  disposeContourGroup(housingContour);housingContour=null;
  if(!contourRoot||style!=='ghost'||contourStrength<=.01||outlineMode!=='detailed')return;
  const meshes=activeHolders.filter(p=>p.userData.mergedHousingContour).flatMap(p=>p.userData.meshes);
  const geometry=createHousingContourGeometry(meshes,contourRoot,76-contourStrength*19);
  if(!geometry)return;
  housingContour=createContrastingContour(geometry,{userData:{shell:true}});
  geometry.dispose();
  if(housingContour)contourRoot.add(housingContour);
}
function highlightPart(part,strength,seconds) {
  const key=part.userData.control;
  const base=part.userData.base;
  const mapped=currentModel.source==='co';
  const modelId=part.userData.sourceModel?.id||currentModel.id;
  const visual=part.userData.visualControl||key;
  if(modelId==='Gamecube'&&(visual==='ls'||visual==='rs'))strength=0;
  if(key==='ls'||key==='rs') {
    const side=key==='ls'?'left':'right';
    const axes=diagnostic?{x:diagnosticAxes[0],y:diagnosticAxes[1]}:
      currentParityStickPose ? currentParityStickPose :
      inputMode==='live'&&liveState ? (key==='ls'?liveState.rawLeft:liveState.rawRight):
      inputMode==='demo'&&inputDemo?demoStickAxes(performance.now(),side):null;
    const config=stickMechanics(modelId,side);
    const override=Number(diagnosticParams.get('tilt'));
    if(diagnostic&&diagnosticParams.has('tilt')&&Number.isFinite(override)&&override>=0&&override<=45)config.maxTiltDeg=override;
    const tilt=stickTiltQuaternion(axes,part.userData.sourceModel?.source||currentModel.source,config);
    part.quaternion.set(tilt.x,tilt.y,tilt.z,tilt.w);
    part.position.copy(base).add(new THREE.Vector3(0,(mapped?-1:1)*config.clickTravel*strength,0).applyQuaternion(part.quaternion));
  } else {
    const trigger=key==='l2'||key==='r2';
    const mechanism=triggerMechanics(modelId);
    if(trigger)part.rotation.x=-THREE.MathUtils.degToRad(mechanism.maxRotationDeg)*strength;
    const travel=key?pressTravelFor(key,mapped?'co':'padforge'):{x:0,y:0,z:0};
    part.position.x=THREE.MathUtils.lerp(part.position.x,base.x+travel.x*strength,.16);
    part.position.y=THREE.MathUtils.lerp(part.position.y,base.y+travel.y*strength,.16);
    part.position.z=THREE.MathUtils.lerp(part.position.z,base.z+travel.z*strength,.16);
    if(trigger&&mechanism.translation)part.position.copy(base).addScaledVector(new THREE.Vector3(...mechanism.translation),strength);
  }
  for(const mesh of part.userData.meshes) {
    mesh.userData.pressStrength=Math.max(0,Math.min(1,strength));
    const m=mesh.material;
    if(mesh.userData.edge){
      const inner=mesh.userData.edge.userData.highlight;
      const outer=mesh.userData.edge.userData.shadow;
      if(inner){
        inner.material.color.lerp(controlColorScratch.copy(IDLE_EDGE).lerp(PRESSED_BLUE,Math.min(1,strength)),.22);
        const targetOpacity=Math.min(1,look.contour*(part.userData.shell?.83:1.18)+Math.max(0,strength)*.30);
        inner.material.opacity=THREE.MathUtils.lerp(inner.material.opacity,targetOpacity,.25);
      }
      if(outer)outer.material.opacity=THREE.MathUtils.lerp(outer.material.opacity,Math.min(.95,look.contour*(part.userData.shell?.8:1.10)),.24);
    }
    // Hidden relevant controls are visible through a subtle dashed hint;
    // pressing one raises the hint and tints it blue without x-raying the shell.
    const hint=mesh.userData.rearHint;
    if(hint){
      hint.material.color.copy(IDLE_EDGE).lerp(PRESSED_BLUE,Math.max(0,Math.min(1,strength)));
      const hintOpacity=look.rear+(1-look.rear)*.9*Math.max(0,Math.min(1,strength));
      hint.material.opacity=THREE.MathUtils.lerp(hint.material.opacity,hintOpacity,.24);
    }
    // Analog pressure remains blue; the unpressed Ghost body is translucent.
    const target=controlColorScratch.copy(m.userData.baseColor).lerp(PRESSED_BLUE,Math.max(0,Math.min(1,strength)));
    m.color.lerp(target,.20);
    if(style==='wire') m.opacity=THREE.MathUtils.lerp(m.opacity,strength?1:.68,.2);
    if((style==='ghost'||style==='glass')&&!part.userData.shell){
      m.opacity=THREE.MathUtils.lerp(m.opacity,ghostPressOpacity(m.userData.isCap?look.cap:look.control,strength),.28);
    }
    if('emissive' in m) {
      m.emissive.lerp(controlColorScratch.copy(DARK_EMISSIVE).lerp(PRESSED_EMISSIVE,Math.min(1,strength)),.20);
      m.emissiveIntensity=THREE.MathUtils.lerp(m.emissiveIntensity,Math.min(.60,pressedControlStyle(controlsOpacity,strength).glow*.5),.19);
    }
  }
}
function disposeModel() {
  if(!rootModel)return;
  clearTimeout(contourTimer);
  disposeContourGroup(housingContour);housingContour=null;contourRoot=null;
  scene.remove(rootModel);
  for(const part of activeHolders)for(const mesh of part.userData.meshes)if(mesh.userData.edge){disposeContourGroup(mesh.userData.edge);mesh.userData.edge=null;}
  rootModel.traverse(x=>{
    if(x.userData.depthMask)return;
    if(x.userData.rearHint){ghostLineMaterials.delete(x.material);x.geometry?.dispose();x.material?.dispose();return;}
    if(x.userData.outerSilhouette){x.material?.dispose();return;}
    if(x.isMesh){x.geometry?.dispose();x.material?.dispose();}
    else if(x.isLineSegments||x.isLineSegments2){x.geometry?.dispose();x.material?.dispose();}
  });
  rootModel=null;activeHolders=[];pickMeshes=[];contrastPass.setModel([]);
}
async function findLocalModels() {
  try{
    const response=await fetch('./assets/index.json',{cache:'no-cache'});
    if(response.ok){let data=await response.json();if(Array.isArray(data.models))return data.models;}
  }catch(e){/* offline marker is optional */}
  return [];
}
async function fetchTextRetry(urls,signal,{mesh=false}={}){
  const mirrors=Array.isArray(urls)?urls:[urls];
  let last;
  for(const url of mirrors){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch(url,{signal,cache:attempt?'reload':'default'});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const content=await response.text();
        if(mesh){const report=inspectObjText(content);if(!report.valid)throw new Error(report.reason);}
        else if(content.length<20)throw new Error('Unexpected empty response');
        return content;
      }catch(e){
        if(signal.aborted)throw e;
        last=e;
        if(attempt===0)await new Promise(resolve=>setTimeout(resolve,220));
      }
    }
  }
  throw new Error(`${last?.message||'Request failed'} — checked ${mirrors.length} source host(s)`);
}
async function loadManifest(model,signal){
  if(!model.manifest)return model.parts.map((file,index)=>({file,index,meta:null}));
  let raw;
  if(localModels.includes(model.id)){
    try{raw=await fetchTextRetry(`./assets/${encodeURIComponent(model.id)}/info.json`,signal);}catch{}
  }
  raw??=await fetchTextRetry(remoteAssetMirrors(model,'info.json'),signal);
  const data=JSON.parse(raw);
  if(!Array.isArray(data.parts))throw new Error('Source manifest has no parts[]');
  const specs=data.parts.map((meta,index)=>({meta,file:meta.filename,index}))
    .filter(spec=>spec.meta.visible!==false&&typeof spec.file==='string'&&/^[\w.-]+\.obj$/i.test(spec.file))
    ; // Keep rear shells for Studio / 360°; Ghost appearance controls opacity.
  if(!specs.length)throw new Error('No mesh components in source manifest');
  const duplicates=new Set(),seen=new Set();
  for(const spec of specs){if(seen.has(spec.file))duplicates.add(spec.file);seen.add(spec.file);}
  if(duplicates.size)throw new Error(`Duplicate mesh names: ${[...duplicates].join(', ')}`);
  modelMetadata.set(model.id,{parts:data.parts,source:data.source,description:data.description});
  return specs;
}
async function fetchObjFile(model,file,signal){
  const local=localModels.includes(model.id);
  if(local){
    try{return await fetchTextRetry(`./assets/${encodeURIComponent(model.id)}/${encodeURIComponent(file)}`,signal,{mesh:true})}
    catch(e){if(signal.aborted)throw e;console.warn('Invalid local mesh, using upstream:',file,e.message);}
  }
  return fetchTextRetry(remoteAssetMirrors(model,file),signal,{mesh:true});
}
function makePart(parsed,file,model,meta=null){
  const holder=new THREE.Group();holder.name=file.replace(/\.obj$/i,'');
  const semantic=modelPartSemantics(file,model,meta);
  const key=semantic.control;
  holder.userData={control:key,sourceModel:model,visualControl:semantic.pickControl&&!key?semantic.pickControl:null,
    file,meta,meshes:[],role:semantic.role,shell:isHousingRole(semantic.role)};
  parsed.traverse(obj=>{
    if(!obj.isMesh||obj.userData.derivedThumbCap)return;
    // Preserve upstream 3D top surfaces and all distinctive cap notches.
    // Only a matching, profile-specific side skirt is added for flat discs.
    if(model.source==='co'&&semantic.role==='stick-cap'&&!MODEL_MECHANICS[model.id]?.authoredCapAssembly){
      const bb=new THREE.Box3().setFromBufferAttribute(obj.geometry.getAttribute('position'));
      const sz=bb.getSize(new THREE.Vector3()),radius=Math.max(sz.x,sz.z)/2;
      if(isFlatThumbCap({radius,height:sz.y})){
        const center=bb.getCenter(new THREE.Vector3());
        const side=semantic.pickControl==='rs'?'right':'left';
        // Sculpt shallow dish/dome INTO the existing textured OBJ geometry.
        // The original topology stays intact; only vertical vertex positions
        // change as a smooth radial function, leaving outer edge positions.
        const vertices=obj.geometry.getAttribute('position');
        for(let i=0;i<vertices.count;i++){
          const distance=Math.hypot(vertices.getX(i)-center.x,vertices.getZ(i)-center.z);
          vertices.setY(i,vertices.getY(i)+thumbstickTopDisplacement({radius,distance,modelId:model.id,side}));
        }
        vertices.needsUpdate=true;
        obj.geometry.computeVertexNormals();
        const profile=thumbstickCapSkirtProfile({radius,top:bb.max.y,modelId:model.id,
          side:semantic.pickControl==='rs'?'right':'left'});
        const segments=thumbstickCapRadialSegments(model.id,semantic.pickControl);
        const geo=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);
        geo.translate(center.x,0,center.z);geo.computeVertexNormals();
        // OBJLoader supplied geometry stays intact; add side-wall as a child.
        const skirt=new THREE.Mesh(geo);
        skirt.name='profiled-thumbstick-skirt';
        skirt.userData.derivedThumbCap=true;
        skirt.userData.control=semantic.pickControl;
        obj.add(skirt);
        holder.userData.meshes.push(skirt);
      }
    }
    if(model.id==='Gamecube')obj.geometry=polishGameCubePart(obj.geometry,file);
    // Shared family: generated once on model load, not on every input frame.
    if(sharedSticks&&V24_STICK_MODELS.includes(model.id)&&semantic.role==='stick-cap'){
      const newGeometry=parametricCapGeometry(model.id,obj.geometry);
      if(newGeometry){obj.geometry.dispose();obj.geometry=newGeometry;obj.userData.sharedCap=true;}
    }
    if(!obj.geometry.attributes.normal)obj.geometry.computeVertexNormals();
    obj.material?.dispose?.();
    obj.material=materialFor(file,model,meta);
    obj.userData.control=semantic.pickControl||key;
    holder.userData.meshes.push(obj);
    pickMeshes.push(obj);
  });
  if(holder.userData.meshes.length===0)return null;
  for(const mesh of holder.userData.meshes)installPhysicalOccluder(mesh,semantic.role);
  const center=new THREE.Box3().setFromObject(parsed).getCenter(new THREE.Vector3());
  const transform=controllerPartTransform(model.source,meta,center.toArray());
  parsed.position.set(...transform.geometryOffset);
  const configuredPivot=semantic.role==='stick-pivot'?stickMechanics(model.id,key==='ls'?'left':'right').pivot:null;
  holder.position.set(...(configuredPivot||transform.pivot));
  holder.userData.base=holder.position.clone();
  holder.add(parsed);
  if(!shouldRenderPart(semantic.role))holder.visible=false;
  if(style==='ghost')applyPartAppearance(holder);
  return holder;
}
function removePartialParts(parts){
  for(const part of parts){
    for(const mesh of part.userData.meshes||[]){
      if(mesh.userData.edge){disposeContourGroup(mesh.userData.edge);mesh.userData.edge=null;}
    }
    part.traverse(x=>{
      if(x.isMesh&&!x.userData.depthMask){x.geometry?.dispose();x.material?.dispose();}
      else if(x.isLineSegments){x.geometry?.dispose();x.material?.dispose();}
    });
  }
}
async function loadController(requested){
  const sourceModels=Array.isArray(requested)?requested:[requested];
  const isComposite=sourceModels.length>1;
  const model=isComposite?{
    id:'JoyconPair3D',name:'Joy-Con Pair',brand:'Nintendo Joy-Con L + R',
    source:'co',family:'nintendo',color:'#44556b',manifest:false
  }:sourceModels[0];
  fetchToken++;
  const token=fetchToken;
  if(fetchAbort)fetchAbort.abort();
  fetchAbort=new AbortController();
  const signal=fetchAbort.signal;
  currentModel={...model,layoutId:currentLayout.id};
  manualControls.clear();animatedControls.clear();
  ui.name.textContent=currentLayout?.name||model.name;
  ui.brand.textContent=currentLayout?.availability==='proxy'?model.brand+' · 3D-Basis':model.brand;
  ui.select.value=autoModel?'auto':currentLayout.id;ui.count.textContent='— PARTS';
  ui.header.textContent='Loading model';
  const sourceName=isComposite?'3dco+ · zwei echte Joy-Con-Modelle':
    (({handheld:'Handheld Companion',co:'3dco+ (model info.json)',padforge:'PadForge'})[model.source]||'Upstream');
  $('modelSource').textContent=`${sourceName} · ${isComposite?'2 manifests':model.manifest?'mapped parts':'OBJ parts'}`;
  status('Fetching actual 3D geometry',sourceName);
  setLoading('Loading '+model.name,'Reading model component manifest…',0);
  drawControlButtons();
  disposeModel();
  let specs;
  try{
    const list=await Promise.all(sourceModels.map(async sourceModel=>({
      sourceModel,specs:await loadManifest(sourceModel,signal)
    })));
    specs=list.flatMap(({sourceModel,specs})=>specs.map(spec=>({
      ...spec,sourceModel,sourceId:sourceModel.id,index:`${sourceModel.id}:${spec.index}`
    })));
  }catch(e){
    if(token!==fetchToken||signal.aborted)return;
    status('Cannot open model manifest',e.message);
    ui.header.textContent='Model unavailable';
    setLoading('Model manifest unavailable',e.message);
    $('retryLoad').hidden=false;return;
  }
  if(token!==fetchToken)return;
  let cursor=0,finished=0;
  const parts=[];
  const failed=[];
  async function worker(){
    while(cursor<specs.length){
      const spec=specs[cursor++];
      try{
        const raw=await fetchObjFile(spec.sourceModel,spec.file,signal);
        if(token!==fetchToken)return;
        const parsed=loader.parse(raw);
        // OBJLoader can return a Group with no mesh even for nonempty text;
        // reject those instead of allowing a clean-looking missing D-pad wedge.
        let actualTriangles=0;
        parsed.traverse(o=>{if(o.isMesh&&o.geometry?.attributes?.position)
          actualTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
        if(actualTriangles<1)throw new Error('OBJLoader returned no triangles');
        const sourceView={...spec.sourceModel,layoutId:currentLayout.id};
        const part=makePart(parsed,spec.file,sourceView,spec.meta);
        if(part)parts.push({part,index:spec.index,sourceId:spec.sourceId});
        else failed.push(`${spec.file}: empty geometry`);
      }catch(e){
        if(token!==fetchToken||e.name==='AbortError')return;
        failed.push(`${spec.file}: ${e.message}`);
      }
      if(token!==fetchToken)return;
      finished++;
      setLoading('Loading '+model.name,`${finished} of ${specs.length} meshes`,finished/specs.length);
    }
  }
  await Promise.all(Array.from({length:Math.min(7,specs.length)},()=>worker()));
  if(token!==fetchToken){removePartialParts(parts.map(x=>x.part));return;}
  // Xbox One D-pad protection: the previous prototype could display a partial
  // model when a mesh request failed. This could explain the reported white wedge,
  // but is not proven to be its only possible cause. Do not display a partial set.
  if(failed.length||parts.length!==specs.length){
    removePartialParts(parts.map(x=>x.part));
    const error=failed[0]||`Only ${parts.length}/${specs.length} meshes loaded`;
    setLoading('Model incomplete',`${failed.length} missing part(s). ${error}`);
    ui.header.textContent='Missing 3D meshes';
    status('Download incomplete',error);
    $('retryLoad').hidden=false;
    console.error('Controller mesh load failures:',failed);
    pickMeshes=[];return;
  }
  rootModel=new THREE.Group();rootModel.name=model.id;
  const reoriented=new THREE.Group();
  // Every 3dco+ part retains its exact native vertex coordinates and manifest
  // parent transform. Distinct components in a Joy-Con pair must not cross-
  // parent, even if both source manifests reuse the same numerical indices.
  const subgroups=new Map();
  for(const sourceModel of sourceModels){
    const subgroup=new THREE.Group();subgroup.name=sourceModel.id;
    const frame=frontFaceTransform(sourceModel.source);
    subgroup.rotation.set(frame.rotationX,frame.rotationY,0);
    subgroups.set(sourceModel.id,subgroup);reoriented.add(subgroup);
  }
  const byIndex=new Map(parts.map(({index,part})=>[index,part]));
  for(const {index,part,sourceId} of parts){
    const meta=part.userData.meta;
    const parent=meta&&Number.isInteger(meta.parent)&&meta.parent>=0
      ?byIndex.get(`${sourceId}:${meta.parent}`):null;
    if(parent&&parent!==part){
      parent.add(part);
      const visual=inheritedStickControl(part.userData.file,parent.userData.control);
      if(visual){
        part.userData.visualControl=visual;
        for(const mesh of part.userData.meshes)mesh.userData.control=visual;
      }
    }else subgroups.get(sourceId).add(part);
    activeHolders.push(part);
  }
  if(isComposite){
    // Center each native Joy-Con mesh independently, then place it alongside
    // the other. No geometry is duplicated, stretched, or fabricated.
    const sizes=sourceModels.map(m=>new THREE.Box3().setFromObject(subgroups.get(m.id)).getSize(new THREE.Vector3()));
    const gap=.22;
    const [leftWidth,rightWidth]=sizes.map(v=>v.x);
    for(let i=0;i<sourceModels.length;i++){
      const group=subgroups.get(sourceModels[i].id);
      const center=new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
      group.position.sub(center);
      group.position.x+=(i===0?-(leftWidth/2+gap/2):(rightWidth/2+gap/2));
    }
  }
  // PadForge wells are fixed. Authored co rings are moving cap walls and
  // already own the stem and cap, so their original hierarchy is retained.
  for(const sourceModel of sourceModels){
    if(sourceModel.source!=='padforge')continue;
    reoriented.updateMatrixWorld(true);
    for(const side of ['ls','rs']){
      const sourceParts=activeHolders.filter(p=>p.userData.sourceModel?.id===sourceModel.id);
      const ring=sourceParts.find(p=>
        ['stick-base','stick-pivot'].includes(p.userData.role)&&p.userData.visualControl===side);
      const cap=sourceParts.find(p=>p.userData.role==='stick-cap'&&p.userData.visualControl===side);
      const stem=sourceParts.find(p=>p.userData.role==='stick-stem'&&p.userData.visualControl===side);
      if(!ring||!cap)continue;
      const pivot=new THREE.Group();
      pivot.name=`${sourceModel.id}-${side}-physical-pivot`;
      pivot.position.copy(ring.position);
      pivot.userData={control:side,visualControl:side,role:'stick-pivot',shell:false,
        file:pivot.name,base:pivot.position.clone(),meshes:[],sourceModel};
      ring.parent.add(pivot);
      ring.parent.updateMatrixWorld(true);
      // Static well/ring must neither follow analog axes nor glow on L3/R3.
      ring.userData.control=null;
      ring.userData.visualControl=null;
      for(const mesh of ring.userData.meshes)mesh.userData.control=null;
      for(const moving of [stem,cap]){
        if(!moving)continue;
        pivot.attach(moving);
        moving.userData.base=moving.position.clone();
      }
      activeHolders.push(pivot);
    }
  }
  // Preserve complete authored assemblies: their outer cap owns the shaft
  // and inset via info.json, and the source shell already contains the well.
  // Only incomplete legacy models need a generated mechanism.
  if(sharedSticks&&V24_STICK_MODELS.includes(model.id)&&!MODEL_MECHANICS[model.id]?.authoredCapAssembly){
    for(const sourceModel of sourceModels){
      const members=activeHolders.filter(p=>p.userData.sourceModel?.id===sourceModel.id);
      for(const side of ['ls','rs']){
        const ring=members.find(p=>p.userData.role==='stick-pivot'&&p.userData.control===side);
        const stem=members.find(p=>p.userData.role==='stick-stem'&&p.userData.visualControl===side);
        const cap=members.find(p=>p.userData.role==='stick-cap'&&p.userData.visualControl===side);
        if(!ring||!stem||!cap)continue;
        reoriented.updateMatrixWorld(true);
        const pivot=new THREE.Group();
        pivot.name=`${sourceModel.id}-${side}-shared-stick-pivot`;
        pivot.position.copy(ring.position);
        const fixedParent=ring.parent;
        fixedParent.add(pivot);
        // A dedicated, STATIONARY recessed socket was missing in v26, which
        // made the rubber cap appear to hover over an empty hole. The original
        // source ring is a moving cap wall, not a fixed housing well.
        const wellHolder=new THREE.Group();wellHolder.name=`${sourceModel.id}-${side}-fixed-socket`;
        wellHolder.position.copy(ring.position);
        const socketProfile=new THREE.Mesh(new THREE.TorusGeometry(.168,.029,12,48));
        socketProfile.rotation.x=Math.PI/2;
        socketProfile.position.y=-.038;
        socketProfile.name='stationary-stick-groove';
        socketProfile.material=materialFor('fixed_socket.obj',sourceModel,null);
        socketProfile.material.userData.isCap=false;
        socketProfile.userData.control=null;
        wellHolder.add(socketProfile);
        wellHolder.userData={control:null,visualControl:null,role:'stick-well',shell:false,
          sourceModel,file:`${side}-fixed-socket`,base:wellHolder.position.clone(),meshes:[socketProfile]};
        installPhysicalOccluder(socketProfile,'housing');
        fixedParent.add(wellHolder);activeHolders.push(wellHolder);
        // Ring is the physical cap-side wall in co OBJ models, NOT the fixed well.
        // All three original parts share the same tilted pivot; leave the housing
        // opening stationary. attach() preserves each part's world transform.
        for(const moving of [ring,stem,cap]){
          pivot.attach(moving);
          moving.userData.base=moving.position.clone();
        }
        // The original outer ring is part of the moving rubber cap assembly.
        // It shares the same press/highlight/alpha group as the top cap, while
        // the shaft remains structural and the fixed socket stays in the shell.
        ring.userData.control=null;
        ring.userData.visualControl=side;
        ring.userData.role='stick-cap-ring';
        for(const m of ring.userData.meshes){m.userData.control=side;m.material.userData.isCap=true;}
        // The shaft never flashes as a full blue sleeve on L3/R3.
        stem.userData.visualControl=null;
        for(const m of stem.userData.meshes)m.userData.control=null;
        pivot.userData={control:side,visualControl:side,role:'stick-pivot',shell:false,
          file:pivot.name,base:pivot.position.clone(),meshes:[],sourceModel};
        activeHolders.push(pivot);
      }
    }
  }
  if(solidBody){
    const body=bakeStaticBody({subgroups,holders:activeHolders,
      createMaterial:materialFor,installDepthMask:installPhysicalOccluder,
      disposeContours:disposeContourGroup});
    activeHolders=body.holders;
    lastBodyStats=body.stats;
    pickMeshes=pickMeshes.filter(mesh=>{
      for(let parent=mesh;parent;parent=parent.parent)if(body.retired.has(parent))return false;
      return true;
    });
  }else lastBodyStats=null;
  reoriented.updateMatrixWorld(true);
  const preBox=new THREE.Box3().setFromObject(reoriented);
  const extent=preBox.getSize(new THREE.Vector3());
  modelScale=4.05/Math.max(extent.x,extent.y,extent.z,.001);
  // Sources already have their own proper rotations; apply only a positive, uniform scale.
  reoriented.scale.setScalar(modelScale);
  reoriented.updateMatrixWorld(true);
  const postBox=new THREE.Box3().setFromObject(reoriented);
  const center=postBox.getCenter(new THREE.Vector3());
  reoriented.position.sub(center);
  // A horizontal Joy-Con is the same physical 3D device viewed on its side.
  // Pre-multiply a world-front-plane rotation; source OBJ frame stays intact.
  const horizontal=currentLayout.id==='joycon_left_horizontal'?Math.PI/2:
    currentLayout.id==='joycon_right_horizontal'?-Math.PI/2:0;
  if(horizontal)reoriented.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),horizontal));
  rootModel.add(reoriented);
  scene.add(rootModel);
  contourRoot=reoriented;
  for(const part of activeHolders){
    if(part.userData.role==='housing')part.userData.mergedHousingContour=true;
    applyPartAppearance(part);
  }
  refreshHousingContour();
  orbit.target.set(0,0,0);
  camera.position.copy(referenceView?positions.reference:positions.front);
  orbit.update();changeAutoOrbit(false);
  reoriented.updateMatrixWorld(true);
  const dims=new THREE.Box3().setFromObject(reoriented).getSize(new THREE.Vector3());
  modelBounds=dims.clone();
  syncReferenceFrame();
  syncStyleMaterials();
  contrastPass.setModel(activeHolders);
  const surfaceMeshes=activeHolders.flatMap(p=>p.userData.meshes||[]);
  const triangles=surfaceMeshes.reduce((sum,m)=>sum+(m.geometry?.index?.count||m.geometry?.attributes?.position?.count||0)/3,0);
  $('v24Stats').textContent=`${surfaceMeshes.length} meshes · ${Math.round(triangles).toLocaleString('de-DE')} triangles`;
  ui.count.textContent=`${surfaceMeshes.length} MESHES`;
  document.body.dataset.v24BodyGroups=lastBodyStats?.groups??0;
  document.body.dataset.v24Triangles=String(Math.round(triangles));
  ui.header.textContent='Real 3D mesh ready';
  document.body.dataset.modelReady=currentLayout.id;
  document.body.dataset.modelParts=String(parts.length);
  status(`${model.name} ready`,`${surfaceMeshes.length} render meshes · ${parts.length} original OBJ parts`,true);
  hideLoading();
  if(diagnostic){
    camera.position.copy(positions[diagnosticParams.get('view')]||positions.front).multiplyScalar(.68);
    const focus=diagnosticParams.get('focus');
    const side=focus==='right'?'rs':'ls';
    if(focus==='left'||focus==='right'){
      const assembly=activeHolders.find(p=>p.userData.control===side);
      if(assembly){
        rootModel.updateMatrixWorld(true);
        const target=new THREE.Box3().setFromObject(assembly).getCenter(new THREE.Vector3());
        orbit.target.copy(target);
        camera.position.multiplyScalar(.34).add(target);
        if(diagnosticParams.get('view')==='profile'){
          camera.position.copy(target).add(new THREE.Vector3(0,-2.8,0));
          camera.up.set(0,0,1);camera.lookAt(target);
        }
        if(diagnosticParams.get('isolate')==='stick'){
          for(const part of activeHolders)part.visible=part===assembly||Boolean(assembly.getObjectById(part.id));
          if(housingContour)housingContour.visible=false;
        }
      }
    }
    const yaw=Number(diagnosticParams.get('yaw'));
    if(diagnosticParams.has('yaw')&&Number.isFinite(yaw))camera.position.sub(orbit.target).applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(yaw)).add(orbit.target);
    if(diagnosticParams.get('view')!=='profile')orbit.update();
    rootModel.quaternion.identity();
    const debugDepth=diagnosticParams.get('depth');
    rootModel.traverse(o=>{if(o.userData.depthMask&&debugDepth==='off')o.visible=false;});
    document.body.dataset.renderReady=model.id;
    document.body.dataset.webglRenderer=renderer.getContext().getParameter(renderer.getContext().RENDERER);
  }
}

// Scene picking: click on actual model geometry (not only the HTML control panel).
let down=null;
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,moved:false,time:performance.now()};});
canvas.addEventListener('pointermove',e=>{
  if(!down || down.moved)return;
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){
    down.moved=true;transitioning=null;changeAutoOrbit(false);
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('selected'));
  }
});
canvas.addEventListener('wheel',()=>changeAutoOrbit(false),{passive:true});
canvas.addEventListener('pointerup',e=>{
  if(!down||down.moved||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}
  down=null;
  const cell=pointerPanel(parityPanels,e.clientX,e.clientY);
  if(!cell||cell.dataset.parityKind!=='3d')return;
  const rect=cell.getBoundingClientRect();
  const mouse=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);
  const intersections=ray.intersectObjects(pickMeshes,false);
  for(const hit of intersections){
    const key=hit.object.userData.control;
    if(key){manualControls.set(key,performance.now()+650);toast(displayControlName(key).toUpperCase());break;}
  }
});
orbit.addEventListener('start',()=>{transitioning=null;});

function updateDemo(now) {
  animatedControls.clear();
  controlAmounts.clear();
  pollGamepad(now);
  if(inputMode==='demo'&&inputDemo){
    const seq=['b1','b2','b3','b4','up','right','down','left','l1','r1','l2','r2','ls','rs','b1+b4','l2+r2',
      ...(['steam_controller_2026','steam_deck_full','steam_deck_compact'].includes(currentLayout.id)?['leftpad','rightpad']:[])];
    const tick=((now-demoBase)/1000)/.82;
    const index=((Math.floor(tick)%seq.length)+seq.length)%seq.length;
    const progress=tick-Math.floor(tick);
    if(progress>.10&&progress<.81)for(const id of seq[index].split('+'))controlAmounts.set(id,1);
  } else if(inputMode==='live'&&liveState){
    for(const [key,value]of controlValuesFromGamepad(liveState))controlAmounts.set(key,value);
  }
  for(const [id,expires]of manualControls){
    if(expires<=now)manualControls.delete(id);
    else controlAmounts.set(id,1);
  }
  if(parityAllButtons)for(const id of CONTROL_IDS)controlAmounts.set(id,1);
  currentParityStickPose=parityAllButtons
    ?previewStickPose(now,$('simpleStickDirection').value,parityPoseStartedAt):null;
  if(currentParityStickPose){
    const label=currentParityStickPose.label+(currentParityStickPose.auto?` · alle ${STICK_TEST_INTERVAL_MS/1000} s`:' · fest');
    if(label!==parityPoseRenderedLabel){
      $('simplePoseStatus').textContent=label;
      parityPoseRenderedLabel=label;
    }
  }
  for(const [id,value]of controlAmounts){if(value>.11)animatedControls.add(id);}
  for(const [id,button]of buttons)button.classList.toggle('pressed',animatedControls.has(id));
  const demoLeft=inputMode==='demo'&&inputDemo?demoStickAxes(now,'left'):null;
  const demoRight=inputMode==='demo'&&inputDemo?demoStickAxes(now,'right'):null;
  // One test input drives both native 3D pivot rigs and the 2D SVG displacement.
  const left=currentParityStickPose|| (inputMode==='live'?liveState?.left:demoLeft);
  const right=currentParityStickPose|| (inputMode==='live'?liveState?.right:demoRight);
  if(reference.svg&&(reference.svg!==lastParityMaterialSvg||Math.abs(lastParityMaterialMix-styleMix)>.0001)){
    reference.applyMaterialAppearance(resolveHeroRecipe('ghost',styleMix),'dark');
    lastParityMaterialSvg=reference.svg;lastParityMaterialMix=styleMix;
    parityLastKey=''; // 2D material paints changed even if the input pose did not.
  }
  reference.update(controlAmounts,{left,right});
  refreshParitySvg(now,left,right);
}
function updateRender(now){
  requestAnimationFrame(updateRender);
  const seconds=now/1000;
  updateDemo(now);
  for(const part of activeHolders) {
    const visual=part.userData.visualControl || part.userData.control;
    const strength=diagnostic?(diagnosticParams.get('click')==='1'&&(visual==='ls'||visual==='rs')?1:diagnosticParams.get('buttons')==='1'&&visual?1:0):visual?(controlAmounts.get(visual)||0):0;
    highlightPart(part,strength,seconds);
  }
  if(transitioning){
    const progress=THREE.MathUtils.clamp((now-transitioning.start)/transitioning.duration,0,1);
    const t=progress*progress*(3-2*progress);
    camera.position.lerpVectors(transitioning.from,transitioning.to,t);
    if(progress>=1)transitioning=null;
  }
  if(rootModel&&referenceView)rootModel.quaternion.identity();
  if(rootModel&&!referenceView&&!diagnostic){
    const relative=motionDevice&&$('motionTilt').checked&&motionFusion.ready&&axisMappingReady
      ? (motionCurrent?.orientation ?? motionFusion.orientation) : {x:0,y:0,z:0,w:1};
    const mode=$('motionDisplayMode').value;
    const pose=(!diagnostic && !$('motionTilt').checked)?{x:0,y:0,z:0,w:1}:presentationOrientation({mode,relative,motion:handheldMotion,adaptive:adaptiveReference,now});
    const target=new THREE.Quaternion(pose.x,pose.y,pose.z,pose.w);
    // Smoothing depends on elapsed time, not monitor refresh rate. The
    // stabilized overlay is biased toward a gently raised handheld posture.
    const frameDt=Math.max(0,Math.min(.05,(now-(lastRenderedAt??now))/1000));
    // Keep held response snappy while direct/free remain steadier.
    const frameTau=mode==='overlay' ? (handheldMotion.options.adaptiveHand?.015:.045) : .12;
    rootModel.quaternion.slerp(target,1-Math.exp(-frameDt/frameTau));
  }
  lastRenderedAt=now;
  orbit.autoRotate=autoOrbit&&!transitioning&&!motionDevice;
  if(!diagnostic||diagnosticParams.get('view')!=='profile')orbit.update();
  renderParity();
  if(diagnostic&&diagnosticParams.get('alphaSamples')==='1'&&rootModel&&document.body.dataset.renderReady&&!document.body.dataset.alphaSamples){
    const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2()),pixel=new Uint8Array(4),counts={zero:0,translucent:0,opaque:0};
    for(let y=0;y<size.y;y+=8)for(let x=0;x<size.x;x+=8){gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(pixel[3]===0)counts.zero++;else if(pixel[3]===255)counts.opaque++;else counts.translucent++;}
    document.body.dataset.alphaSamples=JSON.stringify(counts);
  }
}
function resize(){
  const rect=canvas.getBoundingClientRect();
  const width=Math.max(1,Math.round(rect.width));const height=Math.max(1,Math.round(rect.height));
  renderer.setSize(width,height,false);
  const rectCell=diagnostic?rect:parityPanels[0].getBoundingClientRect();
  const cellWidth=Math.max(1,rectCell.width),cellHeight=Math.max(1,rectCell.height);
  perspectiveCamera.aspect=cellWidth/cellHeight;
  perspectiveCamera.updateProjectionMatrix();
  const viewHeight=5.6;
  referenceCamera.top=viewHeight/2;referenceCamera.bottom=-viewHeight/2;
  referenceCamera.left=-viewHeight/2*cellWidth/cellHeight;
  referenceCamera.right=viewHeight/2*cellWidth/cellHeight;
  referenceCamera.updateProjectionMatrix();
  if(referenceMode==='overlay')syncReferenceFrame();
  const dpr=renderer.getPixelRatio();
  for(const material of ghostLineMaterials)material.resolution.set(cellWidth*dpr,cellHeight*dpr);
}
const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
window.addEventListener('beforeunload',()=>{fetchAbort?.abort();ro.disconnect();contrastPass.dispose();renderer.dispose();if(localScreenshotUrl)URL.revokeObjectURL(localScreenshotUrl);if(motionSession){void motionSession.close();}});
window.addEventListener('blur',()=>manualControls.clear());
requestAnimationFrame(updateRender);

if(diagnostic){
  inputMode='manual';inputDemo=false;autoModel=false;
  currentLayout=layoutForId(diagnosticParams.get('layout')||'dualsense')||currentLayout;
  // Diagnostics use the very same continuous material path as the six-up UI.
  style='ghost';
  $('appearanceSelect').value=style;
  applyBackground('none');
  const light=diagnosticParams.get('background')==='light';
  if(light)$('backgroundSelect').value='custom';
  const css=document.createElement('style');
  css.textContent='html,body{overflow:hidden!important;height:100%!important} body{margin:0!important;background:'+(light?'#f7f8fa':'#06090e')+'!important} .app-shell{display:none!important} body *{visibility:hidden!important} #scene{visibility:visible!important;position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important}';
  document.head.append(css);
  document.body.append(canvas);
  if(diagnosticParams.get('background')==='checker')document.body.style.setProperty('background','repeating-conic-gradient(#ddd 0% 25%, #364759 0% 50%) 0 0 / 96px 96px','important');
  if(['arena','racing','fantasy'].includes(diagnosticParams.get('background')))document.body.style.setProperty('background',`url('./backgrounds/${diagnosticParams.get('background')}.svg') center / cover`,'important');
  const label=document.createElement('div');
  label.setAttribute('style','visibility:visible!important;position:fixed;left:20px;top:20px;z-index:9999;color:'+(light?'#172332':'#dce6ef')+';font:16px monospace');
  label.textContent=currentLayout.id+' / '+styleName(styleMix)+' / '+(diagnosticParams.get('view')||'front')+' / stick '+diagnosticAxes.join(',')+' / '+(diagnosticParams.get('focus')||'full')+' / tilt '+(diagnosticParams.get('tilt')||'default')+' / click '+(diagnosticParams.get('click')||'0')+' / yaw '+(diagnosticParams.get('yaw')||'0');
  if(diagnosticParams.get('label')!=='0')document.body.append(label);
  resize();
}
localModels=await findLocalModels();
await loadSelectedLayout(currentLayout);
