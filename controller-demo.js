// Renderer-neutral input only. Restored from the v40 app.js updateDemo sequence
// and demoStickAxes; the same state feeds SVG and physical PBR controls.
import {demoStickAxes} from './stick-visual-state.js';
const KEYS=Object.freeze(['b1','b2','b3','b4','up','right','down','left','l1','r1','l2','r2','ls','rs','select','start','home','touchpad']);
const SEQUENCE=Object.freeze(['b1','b2','b3','b4','up','right','down','left','l1','r1','l2','r2','ls','rs','b1+b4','l2+r2','ls+rs','l2+b1']);
const stepMs=1000,leadMs=1200,tailMs=800;
export const DEMO_DURATION_MS=leadMs+SEQUENCE.length*stepMs+tailMs;
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const smooth=n=>{const x=clamp(n);return x*x*(3-2*x);};
export function createControllerState(){
 return {values:new Map(KEYS.map(k=>[k,0])),left:{x:0,y:0,click:false,activity:0},
  right:{x:0,y:0,click:false,activity:0},triggers:{left:0,right:0},allPressed:false,source:'neutral',normalized:true};
}
function clear(out){
 for(const k of out.values.keys())out.values.set(k,0);
 for(const side of ['left','right'])Object.assign(out[side],{x:0,y:0,click:false,activity:0});
 out.triggers.left=out.triggers.right=0;out.allPressed=false;return out;
}
function sync(out){
 for(const [side,key]of [['left','ls'],['right','rs']]){
  out[side].click=out.values.get(key)>.5;
  out[side].activity=clamp((Math.hypot(out[side].x,out[side].y)-.08)/.92);
 }
 out.triggers.left=out.values.get('l2')||0;out.triggers.right=out.values.get('r2')||0;return out;
}
export function demoStateAt(milliseconds,out=createControllerState()){
 clear(out);out.source='demo';
 const t=((Number(milliseconds)||0)%DEMO_DURATION_MS+DEMO_DURATION_MS)%DEMO_DURATION_MS;
 // Neutral seam, slow entry/exit, and the existing non-identical left/right arcs.
 const envelope=smooth(t/700)*smooth((DEMO_DURATION_MS-t)/tailMs);
 const left=demoStickAxes(t,'left'),right=demoStickAxes(t,'right');
 out.left.x=left.x*envelope;out.left.y=left.y*envelope;
 out.right.x=right.x*envelope;out.right.y=right.y*envelope;
 const tick=(t-leadMs)/stepMs,index=Math.floor(tick),p=tick-index;
 if(index>=0&&index<SEQUENCE.length){
  const keys=SEQUENCE[index].split('+');
  // Deliberate long/short presses; analog triggers ramp up and down.
  const end=index%3===0?.56:.83;
  const digital=smooth((p-.10)/.08)*smooth((end-p)/.10);
  for(const key of keys)out.values.set(key,key==='l2'||key==='r2'
    ?smooth((p-.08)/.30)*smooth((.92-p)/.30):digital);
 }
 return sync(out);
}
function copyState(from,out,source){
 clear(out);out.source=source;
 if(from){
  for(const [key,v]of from.values||[])out.values.set(key,clamp(v));
  for(const side of ['left','right']){
   const stick=from[side];out[side].x=Number(stick?.x)||0;out[side].y=Number(stick?.y)||0;
   if(stick?.click)out.values.set(side==='left'?'ls':'rs',1);
  }
  out.values.set('l2',Math.max(out.values.get('l2')||0,clamp(from.triggers?.left)));
  out.values.set('r2',Math.max(out.values.get('r2')||0,clamp(from.triggers?.right)));
  if(from.allPressed)for(const key of KEYS)out.values.set(key,1);
 }
 return sync(out);
}
function active(state){
 if(!state)return false;
 for(const v of state.values?.values()||[])if(v>.08)return true;
 return Math.hypot(state.left?.x||0,state.left?.y||0)>.08||Math.hypot(state.right?.x||0,state.right?.y||0)>.08;
}
export class ControllerDemo{
 constructor(){this.enabled=true;this.demoTime=0;this.lastTime=null;this.liveUntil=0;this.output=createControllerState();}
 setEnabled(value){this.enabled=Boolean(value);this.lastTime=null;}
 resetClock(){this.lastTime=null;}
 sample(now,{manual=null,live=null}={}){
  const dt=this.lastTime===null?0:Math.max(0,Math.min(100,now-this.lastTime));this.lastTime=now;
  if(active(live))this.liveUntil=now+1000;
  if(manual)return copyState(manual,this.output,'manual');
  if(live&&now<this.liveUntil)return copyState(live,this.output,'live');
  if(!this.enabled)return copyState(live,this.output,live?'live':'neutral');
  this.demoTime+=dt;
  return demoStateAt(this.demoTime,this.output);
 }
}

// Capability data comes from the existing layout, not a controller-name list.
// Apply once to the shared sample so demo, manual and live inputs agree in 2D/3D.
export function stickClickCapabilities(mapping){
 const result={left:false,right:false};
 for(const layer of mapping?.layers||[])if(layer.role==='stick'&&layer.binding?.clickMask){
  result[layer.binding.axes?.[0]?.startsWith('left_')?'left':'right']=true;
 }
 return result;
}
export function applyStickClickCapabilities(input,capabilities){
 if(!capabilities)return input;
 if(!capabilities.left){input.left.click=false;input.values.set('ls',0);}
 if(!capabilities.right){input.right.click=false;input.values.set('rs',0);}
 return input;
}
