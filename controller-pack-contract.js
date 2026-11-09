// Renderer-neutral bridge. The host owns SDL3/GameInput and creates exactly
// one canonical frame; SVG and Quick3D consume it without polling hardware.
import {semanticControlFrom2DLayer} from './controller-catalog.js';

export const LEGACY_CONTROL_IDS=Object.freeze({
  b1:'south',b2:'east',b3:'west',b4:'north',
  up:'dpad_up',down:'dpad_down',left:'dpad_left',right:'dpad_right',
  l1:'left_shoulder',r1:'right_shoulder',l2:'left_trigger',r2:'right_trigger',
  ls:'left_stick_click',rs:'right_stick_click',
  select:'back',start:'start',home:'home',touchpad:'touchpad',share:'share',
  leftpad:'left_pad',rightpad:'right_pad',sl:'sl',sr:'sr',
  l4:'l4',l5:'l5',r4:'r4',r5:'r5','quick-access':'quick_access',
});
export const CANONICAL_CONTROL_IDS=Object.freeze([
  'south','east','west','north','dpad_up','dpad_right','dpad_down','dpad_left',
  'left_shoulder','right_shoulder','left_trigger','right_trigger',
  'left_stick','right_stick','left_stick_click','right_stick_click',
  'back','start','home','touchpad','share','left_pad','right_pad',
  'sl','sr','l4','l5','r4','r5','quick_access'
]);
const ALLOWED=new Set(CANONICAL_CONTROL_IDS);
const limit=(v,lo,hi)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):0;
export function canonicalControlId(id){
  const name=String(id??'');
  const canonical=LEGACY_CONTROL_IDS[name]||name;
  return ALLOWED.has(canonical)?canonical:null;
}
export function canonicalFrame(state,{playerIndex=null,playerSource='unknown'}={}){
  const source=state?.values instanceof Map?state.values:new Map(Object.entries(state?.values||{}));
  const buttons=Object.fromEntries(CANONICAL_CONTROL_IDS.filter(id=>!id.endsWith('_stick'))
    .map(id=>[id,0]));
  for(const [legacy,raw] of source){
    const id=canonicalControlId(legacy);
    if(id&&Object.hasOwn(buttons,id))buttons[id]=Math.max(buttons[id],limit(raw,0,1));
  }
  const left=state?.left||{x:0,y:0},right=state?.right||{x:0,y:0};
  const axes={left_stick:{x:limit(left.x,-1,1),y:limit(left.y,-1,1)},
    right_stick:{x:limit(right.x,-1,1),y:limit(right.y,-1,1)}};
  buttons.left_stick_click=Math.max(buttons.left_stick_click||0,state?.left?.click?1:0);
  buttons.right_stick_click=Math.max(buttons.right_stick_click||0,state?.right?.click?1:0);
  buttons.left_trigger=Math.max(buttons.left_trigger||0,limit(state?.triggers?.left,0,1));
  buttons.right_trigger=Math.max(buttons.right_trigger||0,limit(state?.triggers?.right,0,1));
  // Browser Gamepad.index is an enumeration index, NEVER the actual player LED index.
  const trusted=playerSource==='provider'&&Number.isInteger(playerIndex)&&playerIndex>=0&&playerIndex<=7;
  return {schemaVersion:1,source:state?.source||'unknown',connected:state?.connected??null,
    buttons,axes,player_index:trusted?playerIndex:null,player_index_source:trusted?'provider':'unknown'};
}
function record(table,id,dimension,value){
  if(!id)return;
  table[id]??={control:id,svg:[],nodes:[]};
  const target=table[id][dimension];
  if(!target.some(item=>item.id===value.id))target.push(value);
}
export function buildControlBindings(mapping,parts=[]){
  if(!mapping?.id||!Array.isArray(mapping.layers))throw Error('Invalid original controller mapping');
  const result={};
  for(const layer of mapping.layers){
    const svg={id:layer.id,file:layer.file,role:layer.role,sourceControl:layer.control??null,
      sourceClickControl:layer.clickControl??null};
    if(layer.role==='directional-pad'){
      for(const dir of ['up','right','down','left'])record(result,'dpad_'+dir,'svg',svg);
      continue;
    }
    const key=semanticControlFrom2DLayer(layer);
    if(layer.role==='stick'){
      const side=key==='ls'?'left':key==='rs'?'right':null;
      if(side){
        record(result,side+'_stick','svg',svg);
        if(layer.binding?.clickMask||layer.clickControl)record(result,side+'_stick_click','svg',svg);
      }
    }else record(result,canonicalControlId(key)||canonicalControlId(layer.control),'svg',svg);
  }
  for(const part of parts){
    const file=part.file||part.holder?.userData?.file;
    const role=part.role||part.holder?.userData?.role;
    const legacy=part.control||part.holder?.userData?.control;
    const node=part.node||('part__'+String(file).replace(/\.obj$/i,''));
    const entry={id:node,file,role};
    if(['stick-stem','stick-pivot','stick-cap','stick-base'].includes(role)){
      const side=legacy==='ls'?'left':legacy==='rs'?'right':null;
      if(side){
        record(result,side+'_stick','nodes',entry);
        if(role==='stick-cap')record(result,side+'_stick_click','nodes',entry);
      }
    }else record(result,canonicalControlId(legacy),'nodes',entry);
  }
  return {schemaVersion:1,layoutId:mapping.id,
    controls:CANONICAL_CONTROL_IDS.filter(id=>result[id]).map(id=>({
      ...result[id],has2D:result[id].svg.length>0,has3D:result[id].nodes.length>0
    }))};
}
