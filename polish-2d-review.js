// A/B/C uses the existing source-SVG binding and cutout implementation;
// none of these rows invents new controller geometry.
import {LAYOUTS,layoutForId} from './controller-catalog.js';
import {ControllerReference,isolateReferenceIds} from './controller-reference.js';
import {readStandardGamepad} from './gamepad-input.js';
import {GHOST_REVIEW_LOOKS,paintPolished2D} from './polish-2d-style.js';

const $=id=>document.getElementById(id),clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const scenes=['dark','light','mixed'],heights={240:160,320:214,480:320};
const query=new URLSearchParams(location.search),items=[];
let selected=null,serial=0,lastFrame=0,lastInput='';
for(const look of GHOST_REVIEW_LOOKS){
  const row=document.createElement('section');
  row.className='review-row';row.dataset.look=look.key;
  const label=document.createElement('div');label.className='row-label';
  const name=document.createElement('strong');name.textContent=look.name;
  const description=document.createElement('span');description.textContent=look.summary;
  label.append(name,description);row.append(label);
  const samples=document.createElement('div');samples.className='samples';
  for(const scene of scenes){
    const stage=document.createElement('div');
    stage.className='stage';stage.dataset.look=look.key;stage.dataset.scene=scene;
    stage.setAttribute('role','img');stage.setAttribute('aria-label',look.name+' auf '+scene);
    samples.append(stage);
    items.push({reference:new ControllerReference(stage),look:look.key,scene});
  }
  row.append(samples);$('comparison').append(row);
}
for(const layout of LAYOUTS.filter(l=>l.has2D)){
  const option=document.createElement('option');
  option.value=layout.id;option.textContent=layout.name;$('layout').append(option);
}
function resize(){
  const width=Number($('size').value);
  document.documentElement.style.setProperty('--panel-width',width+'px');
  document.documentElement.style.setProperty('--panel-height',heights[width]+'px');
}
function inputState(){
  const pad=$('live').checked?Array.from(navigator.getGamepads?.()||[])
    .find(p=>p?.connected&&p.mapping==='standard'):null;
  const live=readStandardGamepad(pad);
  if(live)return {...live,source:'Gamepad: '+live.id};
  const level=clamp($('stick').value/100),a=level/Math.SQRT2,trigger=clamp($('trigger').value/100);
  const values=new Map();
  if($('clicks').checked){values.set('ls',1);values.set('rs',1);}
  if($('faces').checked)
    for(const id of ['b1','b2','b3','b4','up','down','left','right'])values.set(id,1);
  if($('allControls').checked)
    for(const id of ['b1','b2','b3','b4','up','down','left','right',
      'l1','r1','start','select','home','touchpad','share'])values.set(id,1);
  if(trigger>0){values.set('l2',trigger);values.set('r2',trigger);}
  return {values,left:{x:a,y:-a},right:{x:-a,y:a},source:pad?'Gamepad':'Demo'};
}
function paint(){
  const input=inputState();
  for(const item of items){
    paintPolished2D(item.reference,'ghost',item.scene,{
      ...input,reviewLook:item.look,showFaceSymbols:$('faceSymbols').checked,
      stickFeedback:'ring'
    });
  }
  const ready=items.every(item=>Boolean(item.reference.svg));
  document.body.dataset.ghostReviewReady=ready?'ready':'incomplete';
  $('status').textContent=(selected?.name||'—')+' · '+items.filter(item=>item.reference.svg).length+
    '/9 echte SVG-Ansichten · '+input.source+' · Stick '+$('stick').value+
    '% · Trigger '+$('trigger').value+'%';
}
async function load(id){
  const token=++serial;
  const layout=layoutForId(id);
  selected=layout?.has2D?layout:LAYOUTS.find(l=>l.id==='dualsense');
  $('layout').value=selected.id;document.body.dataset.ghostReviewReady='loading';
  await Promise.all(items.map(async(item,index)=>{
    await item.reference.load(selected);
    if(token===serial&&item.reference.svg)
      isolateReferenceIds(item.reference.svg,'ghostrev-'+token+'-'+index);
  }));
  if(token!==serial)return;
  paint();
}
function changeAddress(){
  const next=new URLSearchParams({id:selected?.id||'dualsense',size:$('size').value});
  history.replaceState(null,'',location.pathname+'?'+next);
}
$('layout').addEventListener('change',e=>{void load(e.target.value).then(changeAddress);});
$('size').addEventListener('change',()=>{resize();paint();changeAddress();});
for(const key of ['stick','trigger']){
  $(key).addEventListener('input',()=>{$(key+'Value').textContent=$(key).value+' %';paint();});
}
for(const id of ['clicks','faces','allControls','faceSymbols','live'])$(id).addEventListener('change',paint);
function liveTick(now){
  if($('live').checked&&now-lastFrame>=30){
    const input=inputState();
    const signature=JSON.stringify([[...input.values],input.left,input.right]);
    if(signature!==lastInput){lastInput=signature;paint();}
    lastFrame=now;
  }
  requestAnimationFrame(liveTick);
}
if(heights[query.get('size')])$('size').value=query.get('size');
resize();
void load(query.get('id')||'dualsense');
requestAnimationFrame(liveTick);
window.__exoGhostReview={get status(){return document.body.dataset.ghostReviewReady},
  get items(){return items},load,paint,inputState};
