import {LAYOUTS,layoutForId} from './controller-catalog.js';
import {ControllerReference,isolateReferenceIds} from './controller-reference.js';
import {readStandardGamepad} from './gamepad-input.js';
import {paintPolished2D} from './polish-2d-style.js';
import {attachStickDrag} from './stick-drag.js';

const $=id=>document.getElementById(id);
const scenes=[['dark','Dunkel'],['light','Hell'],['mixed','Gemischt']];
const styles=[['solid','Solid'],['ghost','Ghost']];
const refs=[];
const sizeHeights={240:160,320:214,480:320};
const params=new URLSearchParams(location.search);
let serial=0,selected=null,lastLive='',lastFrame=0,zoom=1;
const drag={left:null,right:null};let clearDrags=[];
const clamp=(n)=>Math.max(0,Math.min(1,Number(n)||0));
function setStatus(message){$('status').textContent=message;}

// One row per look, one column per background. All six references share state.
for(const [mode,lookLabel] of styles){
  for(const [scene,sceneLabel] of scenes){
    const figure=document.createElement('figure');
    const caption=document.createElement('figcaption');
    caption.textContent=lookLabel+' · '+sceneLabel;
    const stage=document.createElement('div');
    stage.className='stage';
    stage.dataset.scene=scene;stage.dataset.look=mode;
    stage.tabIndex=0;
    stage.setAttribute('aria-label',lookLabel+' auf '+sceneLabel);
    stage.addEventListener('wheel',event=>{
      event.preventDefault(); // Wheel over a viewer is zoom, not page scroll.
      zoom=Math.max(.7,Math.min(2.25,zoom*(event.deltaY<0?1.08:1/1.08)));
      document.documentElement.style.setProperty('--controller-zoom',zoom.toFixed(3));
    },{passive:false});
    stage.addEventListener('dblclick',()=>{
      zoom=1;document.documentElement.style.setProperty('--controller-zoom','1');
    });
    figure.append(caption,stage);
    $('comparisonGrid').appendChild(figure);
    refs.push({reference:new ControllerReference(stage),stage,scene,mode});
  }
}
for(const layout of LAYOUTS.filter(l=>l.has2D)){
  const option=document.createElement('option');
  option.value=layout.id;option.textContent=layout.name;
  $('layout').appendChild(option);
}
function resize(){
  const width=Number($('size').value),height=sizeHeights[width]||320;
  document.documentElement.style.setProperty('--panel-width',width+'px');
  document.documentElement.style.setProperty('--panel-height',height+'px');
}
function inputState(){
  const useLive=$('live').checked;
  const gamepad=useLive?Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard'):null;
  const live=readStandardGamepad(gamepad);
  if(live){
    const values=new Map(live.values);
    if($('clicks').checked||$('clickLeft').checked)values.set('ls',1);
    if($('clicks').checked||$('clickRight').checked)values.set('rs',1);
    return {values,left:drag.left||live.left,right:drag.right||live.right,
      source:drag.left||drag.right?'Stick-Drag':'Gamepad: '+live.id};
  }
  const magnitude=clamp($('stick').value/100);
  const trigger=clamp($('trigger').value/100);
  const axis=magnitude/Math.SQRT2;
  const values=new Map();
  if($('faces').checked)for(const id of ['b1','b2','b3','b4','up','down','left','right'])values.set(id,1);
  if($('clicks').checked||$('clickLeft').checked)values.set('ls',1);
  if($('clicks').checked||$('clickRight').checked)values.set('rs',1);
  if(trigger>0){values.set('l2',trigger);values.set('r2',trigger);}
  return {values,left:drag.left||{x:axis,y:-axis},right:drag.right||{x:-axis,y:axis},
    source:drag.left||drag.right?'Stick-Drag':
      useLive?'Kein Standard-Gamepad verbunden · Demo aktiv':'Manuelle Simulation'};
}
function paint(){
  const inputs=inputState();
  const options={...inputs,colorway:$('colorway').value,
    stickFeedback:'ring',
    showFaceSymbols:$('faceSymbols').checked,
    edgeLight:Number($('edgeLight').value)/100,
    edgeShadow:Number($('edgeShadow').value)/100};
  for(const entry of refs)paintPolished2D(entry.reference,entry.mode,entry.scene,options);
  if(!selected)return;
  const ready=refs.every(entry=>Boolean(entry.reference.svg));
  document.body.dataset.polishReady=ready?'ready':'incomplete';
  setStatus(selected.name+' · '+refs.filter(e=>e.reference.svg).length+'/6 SVG-Ansichten · '+inputs.source+
    ' · Stick '+$('stick').value+' % · Trigger '+$('trigger').value+
    ' % · Kantenlicht '+$('edgeLight').value+' % · Kantenschatten '+$('edgeShadow').value+' %');
}
async function load(id){
  const token=++serial;
  const layout=layoutForId(id);
  selected=layout?.has2D?layout:LAYOUTS.find(l=>l.id==='dualsense');
  $('layout').value=selected.id;
  clearDrags.forEach(dispose=>dispose());clearDrags=[];drag.left=null;drag.right=null;
  document.body.dataset.polishReady='loading';
  setStatus('Lade '+selected.name+' …');
  await Promise.all(refs.map((entry,index)=>entry.reference.load(selected).then(()=>{
    if(token===serial&&entry.reference.svg)
      isolateReferenceIds(entry.reference.svg,'polish-'+token+'-'+index);
  })));
  if(token!==serial)return;
  for(const item of refs)clearDrags.push(attachStickDrag(item.reference,{
    start:side=>{
      $('live').checked=false;
      $('stick').value='0';$('stickValue').textContent='0 %';
      drag[side]={x:0,y:0};paint();
    },
    move:(side,axes)=>{drag[side]=axes;paint();},
    end:side=>{drag[side]=null;paint();}
  }));
  paint();
}
function address(){
  const q=new URLSearchParams({id:selected?.id||'dualsense',size:$('size').value,
    colorway:$('colorway').value});
  history.replaceState(null,'',location.pathname+'?'+q.toString());
}
$('layout').addEventListener('change',event=>{void load(event.target.value).then(address);});
$('size').addEventListener('change',()=>{resize();address();paint();});
for(const id of ['stick','trigger','edgeLight','edgeShadow']){
  $(id).addEventListener('input',()=>{$(id+'Value').textContent=$(id).value+' %';paint();});
}
for(const id of ['faces','clicks','clickLeft','clickRight','live','faceSymbols'])$(id).addEventListener('change',paint);
$('colorway').addEventListener('change',()=>{paint();address();});
function liveTick(now){
  if($('live').checked&&now-lastFrame>=33){
    const data=inputState();
    const signature=JSON.stringify([data.source,[...data.values],data.left,data.right]);
    if(signature!==lastLive){lastLive=signature;paint();}
    lastFrame=now;
  }
  requestAnimationFrame(liveTick);
}
for(const [id,key,choices] of [['size','size',['240','320','480']],
  ['colorway','colorway',['auto','light','dark']]]){
  if(choices.includes(params.get(key)))$(id).value=params.get(key);
}
resize();
void load(params.get('id')||'dualsense');
requestAnimationFrame(liveTick);
window.__exo2DPolish={get refs(){return refs},get state(){return document.body.dataset.polishReady},
  get zoom(){return zoom},paint,load,inputState,get drag(){return {...drag}}};
