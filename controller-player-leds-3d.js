// Surface-integrated Nintendo player LEDs. No extra geometry, texture,
// CPU readback, per-frame rasterization, or input-device side effects.
// The rectangles come from the existing 2D SVG and are projected onto the
// original OBJ front shell before static batching; this is display ONLY.
import * as THREE from 'three';
import {NINTENDO_LED_LAYOUTS,ledStates} from './controller-player-leds.js';

export const PLAYER_LED_3D_MODELS=Object.freeze({
  SwitchPro:Object.freeze({layout:'switch_pro',sourcePart:'top_shell.obj'}),
  JoyconGrip:Object.freeze({layout:'joycon_grip',sourcePart:'extra.obj'}),
});
const MAX_LEDS=8;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

function projectedSourceBounds(native){
  const frame=native.group.children[0];
  native.group.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const bounds=new THREE.Box3(),local=new THREE.Box3(),transform=new THREE.Matrix4();
  for(const mesh of native.meshes){
    if(!mesh.visible||!mesh.geometry?.attributes.position)continue;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    transform.multiplyMatrices(inverse,mesh.matrixWorld);
    bounds.union(local.copy(mesh.geometry.boundingBox).applyMatrix4(transform));
  }
  if(bounds.isEmpty()||bounds.max.x<=bounds.min.x||bounds.max.z<=bounds.min.z)
    throw Error('Nintendo player LEDs require original 3D source bounds');
  return {frame,inverse,bounds};
}
function shaderSource(){
  return `#include <map_fragment>
  float playerLedFacing=smoothstep(0.42,0.55,vPlayerLedNormalY)
    *smoothstep(playerLedFrontMinY,playerLedFrontMinY+0.004,vPlayerLedNativePos.y);
  for(int led=0;led<8;led++){
    if(float(led)>=playerLedCount)break;
    vec4 rect=playerLedRects[led];
    vec2 d=abs(vPlayerLedNativePos.xz-rect.xy);
    float outside=step(d.x,rect.z)*step(d.y,rect.w);
    vec2 insideExt=max(rect.zw-vec2(0.004),vec2(0.001));
    float inside=step(d.x,insideExt.x)*step(d.y,insideExt.y);
    float rim=(outside-inside)*playerLedFacing;
    float face=inside*playerLedFacing;
    float ledOn=playerLedActive[led];
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.34,0.39,0.44),rim*0.92);
    diffuseColor.rgb=mix(diffuseColor.rgb,
      mix(vec3(0.19,0.24,0.28),vec3(0.95,0.97,1.0),ledOn),
      face*(0.30+ledOn*0.70));
    // Only tiny indicators receive local coverage; shell/control alpha stays
    // untouched. Off outlines remain visible in transparent Ghost on white.
    diffuseColor.a=max(diffuseColor.a,rim*0.75+face*(0.36+ledOn*0.60));
  }`;
}
export function prepare3DPlayerLedSurface(native){
  const config=PLAYER_LED_3D_MODELS[native?.model?.id];
  if(!config)return null;
  if(native.playerLedSurface)return native.playerLedSurface;
  const target=native.meshes.find(m=>m.visible&&m.userData.sourceFile===config.sourcePart);
  if(!target)throw Error('Missing authored Nintendo player LED shell '+config.sourcePart);
  const {frame,inverse,bounds}=projectedSourceBounds(native);
  const uniforms={
    rects:{value:new Float32Array(MAX_LEDS*4)},
    active:{value:new Float32Array(MAX_LEDS)},
    count:{value:0},
    frontMinY:{value:0},
  };
  const material=target.material;
  const previousCompile=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    previousCompile.call(this,shader,renderer);
    shader.uniforms.playerLedRects=uniforms.rects;
    shader.uniforms.playerLedActive=uniforms.active;
    shader.uniforms.playerLedCount=uniforms.count;
    shader.uniforms.playerLedFrontMinY=uniforms.frontMinY;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vPlayerLedNativePos;\nvarying float vPlayerLedNormalY;')
      .replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvPlayerLedNativePos=position;\nvPlayerLedNormalY=normal.y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform vec4 playerLedRects[8];\nuniform float playerLedActive[8];\nuniform float playerLedCount;\nuniform float playerLedFrontMinY;\nvarying vec3 vPlayerLedNativePos;\nvarying float vPlayerLedNormalY;')
      .replace('#include <map_fragment>',shaderSource());
  };
  material.customProgramCacheKey=()=>previousKey+'|nintendo-original-surface-led-v1';
  material.needsUpdate=true;
  // The housing batch must not replace source-native coordinates of this
  // shader-bearing mesh. All unrelated meshes remain eligible for batching.
  target.userData.playerLedNativeSurface=true;
  const state={config,target,frame,inverse,bounds,uniforms,count:0,mask:null};
  native.playerLedSurface=state;
  return state;
}
function authoredRectangles(state,reference){
  const ids=NINTENDO_LED_LAYOUTS[state.config.layout]?.flat()||[];
  if(!reference?.svg||reference.mapping?.id!==state.config.layout||
      ids.length===0||ids.length>MAX_LEDS)throw Error('Missing matching Nintendo 2D LED source');
  const [vx,vy,vw,vh]=reference.mapping.viewBox;
  if(!(vw>0&&vh>0))throw Error('Invalid authored Nintendo viewBox');
  const {bounds}=state;
  const rects=[];
  for(const id of ids){
    const node=reference.svg.querySelector('[id$="'+id+'"]');
    if(!node||node.localName!=='rect')throw Error('Missing original LED rectangle '+id);
    const [x,y,width,height]=['x','y','width','height'].map(k=>Number(node.getAttribute(k)));
    if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)
      throw Error('Invalid authored Nintendo LED rectangle '+id);
    const cx=clamp((x+width/2-vx)/vw,0,1);
    const cz=clamp((y+height/2-vy)/vh,0,1);
    rects.push({
      x:bounds.min.x+cx*(bounds.max.x-bounds.min.x),
      z:bounds.min.z+cz*(bounds.max.z-bounds.min.z),
      halfW:width/vw*(bounds.max.x-bounds.min.x)/2,
      halfH:height/vh*(bounds.max.z-bounds.min.z)/2,
      id
    });
  }
  return rects;
}
export function apply3DPlayerLedLayout(native,reference){
  const state=native?.playerLedSurface;
  if(!state)return 0;
  const rects=authoredRectangles(state,reference);
  const ray=new THREE.Raycaster();
  const direction=new THREE.Vector3(0,-1,0).transformDirection(state.frame.matrixWorld);
  const ys=[];
  for(let i=0;i<rects.length;i++){
    const r=rects[i];
    const origin=new THREE.Vector3(r.x,4,r.z).applyMatrix4(state.frame.matrixWorld);
    ray.set(origin,direction);ray.far=10;
    const hits=ray.intersectObject(state.target,false);
    const front=hits.find(h=>h.face?.normal?.y>.56);
    if(!front)throw Error('Player LED '+r.id+' misses original front shell; source mapping requires review');
    const y=front.point.clone().applyMatrix4(state.inverse).y;
    if(y<.09)throw Error('Player LED '+r.id+' projects onto a rear surface');
    ys.push(y);
    state.uniforms.rects.value.set([r.x,r.z,r.halfW,r.halfH],i*4);
  }
  state.uniforms.count.value=rects.length;
  state.uniforms.frontMinY.value=Math.min(...ys)-.03;
  state.count=rects.length;state.rectangles=rects;
  state.target.material.needsUpdate=true;
  // A never-initialized output defaults to all LEDs off, not a false P1.
  update3DPlayerLedMask(native,0);
  return rects.length;
}
export function update3DPlayerLedMask(native,mask){
  const state=native?.playerLedSurface;
  if(!state||!state.count)return false;
  const bits=ledStates(mask);
  if(state.mask===mask)return false;
  for(let i=0;i<state.count;i++)state.uniforms.active.value[i]=bits[i%4]?1:0;
  state.mask=mask;
  // MeshPhysicalMaterial's onBeforeCompile extras are bound to a compiled
  // program. A player change is rare; request a fresh program/uniform upload
  // rather than allowing a cached program to retain the prior LED pattern.
  // No geometry, extra draw call or per-frame shader compilation is added.
  state.target.material.needsUpdate=true;
  return true;
}
