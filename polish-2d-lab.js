import {LAYOUTS,layoutForId} from './controller-catalog.js';
import {ControllerReference,isolateReferenceIds} from './controller-reference.js';
import {readStandardGamepad} from './gamepad-input.js';
import {paintPolished2D} from './polish-2d-style.js';

const $=id=>document.getElementById(id);
const scenes=[['dark','Dunkel'],['light','Hell'],['mixed','Gameplay / gemischt']];
const styles=[['solid','Solid / Materialfarben'],['ghost','Ghost / transparent']];
const refs=[];
const sizeHeights={240:160,320:214,480:320};
const params=new URLSearchParams(location.search);
let serial=0,selected=null,lastLive='',lastFrame=0;
function setStatus(message){$('status').textContent=message;}
for(const [scene,title] of scenes){
  const section=document.createElement('section');
  section.className='scene';
  const heading=document.createElement('div');heading.className='scene-title';
  const h=document.createElement('h2');h.textContent=title;
  const description=document.createElement('span');description.textContent='Gleiche SVG-Quelle, gleiche Eingaben';
  heading.append(h,description);section.appendChild(heading);
  const row=document.createElement('div');row.className='panels';
  for(const [mode,label] of styles){
    const figure=document.createElement('figure');
    const caption=document.createElement('div');caption.className='caption';caption.textContent=label;
    const stage=document.createElement('div');
    stage.className='stage';stage.dataset.scene=scene;stage.setAttribute('aria-label',title+' · '+label);
    figure.append(caption,stage);row.appendChild(figure);
    refs.push({reference:new ControllerReference(stage),stage,scene,mode});
  }
  section.appendChild(row);$('comparisons').appendChild(section);
}
for(const layout of LAYOUTS.filter(l=>l.has2D)){
  const option=document.createElement('option');option.value=layout.id;option.textContent=layout.name;
  $('layout').appendChild(option);
}
function resize(){
  const width=Number($('size').value),height=sizeHeights[width]||214;
  document.documentElement.style.setProperty('--panel-width',width+'px');
  document.documentElement.style.setProperty('--panel-height',height+'px');
}
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
function inputState(){
  const useLive=$('live').checked;
  const gamepad=useLive?Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard'):null;
  const live=readStandardGamepad(gamepad);
  if(live)return {values:live.values,left:live.left,right:live.right,source:'Gamepad: '+live.id};
  const magnitude=clamp($('stick').value/100);
  const trigger=clamp($('trigger').value/100);
  const axis=magnitude/Math.SQRT2;
  const values=new Map();
  if($('faces').checked)for(const id of ['b1','b2','b3','b4','up','down','left','right'])values.set(id,1);
  if($('clicks').checked){values.set('ls',1);values.set('rs',1);}
  if(trigger>0){values.set('l2',trigger);values.set('r2',trigger);}
  return {values,left:{x:axis,y:-axis},right:{x:-axis,y:axis},source:useLive?'Kein Standard-Gamepad verbunden · Demo aktiv':'Manuelle Simulation'};
}
function paint(){
  const inputs=inputState();
  for(const entry of refs)paintPolished2D(entry.reference,entry.mode,entry.scene,inputs);
  if(!selected)return;
  const ready=refs.every(entry=>Boolean(entry.reference.svg));
  document.body.dataset.polishReady=ready?'ready':'incomplete';
  const stick=Number($('stick').value),trigger=Number($('trigger').value);
  setStatus(selected.name+' · '+refs.filter(e=>e.reference.svg).length+'/6 SVG-Ansichten · '+inputs.source+' · Stick '+stick+' % · Trigger '+trigger+' %');
}
async function load(id){
  const token=++serial;
  const layout=layoutForId(id);
  selected=layout?.has2D?layout:LAYOUTS[0];
  $('layout').value=selected.id;
  document.body.dataset.polishReady='loading';
  setStatus('Lade '+selected.name+' ...');
  await Promise.all(refs.map((entry,index)=>entry.reference.load(selected).then(()=>{
    if(token===serial&&entry.reference.svg)isolateReferenceIds(entry.reference.svg,'polish-'+token+'-'+index);
  })));
  if(token!==serial)return;
  paint();
}
function address(){
  const q=new URLSearchParams({id:selected?.id||'dualsense',size:$('size').value});
  history.replaceState(null,'',location.pathname+'?'+q.toString());
}
$('layout').addEventListener('change',event=>{void load(event.target.value).then(address);});
$('size').addEventListener('change',()=>{resize();address();paint();});
for(const id of ['stick','trigger']){
  $(id).addEventListener('input',()=>{$(id+'Value').textContent=$(id).value+' %';paint();});
}
for(const id of ['faces','clicks','live'])$(id).addEventListener('change',paint);
function liveTick(now){
  if($('live').checked&&now-lastFrame>=33){
    const data=inputState(),signature=JSON.stringify([data.source,[...data.values],data.left,data.right]);
    if(signature!==lastLive){lastLive=signature;paint();}
    lastFrame=now;
  }
  requestAnimationFrame(liveTick);
}
resize();
if(sizeHeights[params.get('size')]){$('size').value=params.get('size');resize();}
void load(params.get('id')||'dualsense');
requestAnimationFrame(liveTick);
window.__exo2DPolish={get refs(){return refs},get state(){return document.body.dataset.polishReady},paint,load,inputState};