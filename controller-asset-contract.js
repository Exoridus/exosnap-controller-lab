// Versioned, renderer-independent input identity for SVG and GLB/Qt rigs.
// The existing ExoSnap native GamepadState remains the authoritative producer.
// Positional south/east/west/north names intentionally do not imply ABXY labels.
import {semanticControlFrom2DLayer,controllerLabelOverride} from './controller-catalog.js';
import {controlFromFilename} from './models.js';
import {modelPartSemantics} from './model-semantics.js';

export const CONTROLLER_PACK_VERSION=1;
export const CONTROL_NAMES=Object.freeze({
 b1:'south',b2:'east',b3:'west',b4:'north',
 up:'dpad_up',right:'dpad_right',down:'dpad_down',left:'dpad_left',
 l1:'left_bumper',r1:'right_bumper',l2:'left_trigger',r2:'right_trigger',
 ls:'left_stick_click',rs:'right_stick_click',
 select:'select',start:'start',home:'home',touchpad:'touchpad',
 share:'share',sl:'sl',sr:'sr',
 leftpad:'left_touchpad',rightpad:'right_touchpad',
 l4:'left_paddle_1',l5:'left_paddle_2',r4:'right_paddle_1',r5:'right_paddle_2',
 'quick-access':'quick_access'
});
export const STICK_IDS=Object.freeze(['left_stick','right_stick']);
export const PLAYER_INDEX='player_index'; // Metadata, never guessed from Gamepad.index.
export const canonicalControl=id=>CONTROL_NAMES[id]||null;
export function canonicalControlsForLayout(layout,mapping){
 if(!layout||!mapping||mapping.id!==layout.id||!Array.isArray(mapping.layers))
  throw new TypeError('Layout and source mapping must agree');
 const items=[];
 for(const layer of mapping.layers){
  if(layer.role==='body')continue;
  const legacy=semanticControlFrom2DLayer(layer);
  const control=legacy?canonicalControl(legacy):null;
  const stick=layer.role==='stick'?(layer.binding?.axes?.[0]?.startsWith('left_')?'left_stick':'right_stick'):null;
  const click=stick&&layer.binding?.clickMask?stick+'_click':null;
  const directional=layer.role==='directional-pad'?
    ['dpad_up','dpad_right','dpad_down','dpad_left']:null;
  if(!control&&!stick&&!directional)continue;
  items.push({element:layer.id,control,stick,click,directional,
    role:layer.role,legacy:legacy||null,
    display:legacy?controllerLabelOverride(layout.id,legacy)||null:null});
 }
 return items;
}
export function canonicalRigParts(model,manifest){
 if(!model||!Array.isArray(manifest?.parts))throw new TypeError('Missing source model manifest');
 return manifest.parts.filter(meta=>meta.visible!==false).map((meta,index)=>{
  const role=modelPartSemantics(meta.filename,model,meta);
  const legacy=role.control||controlFromFilename(meta.filename);
  const physical=role.role.startsWith('stick-');
  const side=meta.filename.startsWith('left_')?'left':meta.filename.startsWith('right_')?'right':null;
  return {node:meta.filename,sourceIndex:index,role:role.role,
   control:physical&&side?side+'_stick':canonicalControl(legacy),
   click:physical&&side?side+'_stick_click':null,
   legacy:legacy||null,parent:meta.parent??-1,
   pivot:meta.position||[0,0,0],
   movable:!['housing','decoration','stick-base','touch-contact'].includes(role.role)};
 });
}
// Allocates only on input boundaries. Once created, the same instance can feed
// both 2D atlas parts and 3D pivot/material bindings.
export function normalizeControllerFrame(frame={}){
 const values=frame.values instanceof Map?frame.values:new Map(Object.entries(frame.values||{}));
 const buttons={};
 for(const [legacy,canonical] of Object.entries(CONTROL_NAMES))
  buttons[canonical]=clamp(values.get(legacy));
 const sticks={};
 for(const side of ['left','right']){
  const s=frame[side]||{};
  sticks[side]={x:axis(s.x),y:axis(s.y),
   click:buttons[side+'_stick_click']||0};
 }
 return {version:CONTROLLER_PACK_VERSION,buttons,sticks,
   playerIndex:Number.isInteger(frame.playerIndex)&&frame.playerIndex>=0&&frame.playerIndex<=7?
    frame.playerIndex:null,
   connected:frame.connected===true,source:frame.source||'unknown'};
}
const clamp=n=>Number.isFinite(Number(n))?Math.min(1,Math.max(0,Number(n))):0;
const axis=n=>Number.isFinite(Number(n))?Math.min(1,Math.max(-1,Number(n))):0;
