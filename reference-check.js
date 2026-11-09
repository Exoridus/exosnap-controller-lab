import { LAYOUTS, layoutForId } from './controller-catalog.js';
import { ControllerReference } from './controller-reference.js';
const $=id=>document.getElementById(id);
const reference=new ControllerReference($('artwork'),{onPress:id=>press(id,400)});
const values=new Map();
const sticks={left:{x:0,y:0},right:{x:0,y:0}};
let current=LAYOUTS[0],side='left';
const timers=new Map();
function paint(){reference.update(values,{left:sticks.left,right:sticks.right});}
function press(id,ms){
  if(timers.has(id))clearTimeout(timers.get(id));
  values.set(id,1);paint();
  if(ms)timers.set(id,setTimeout(()=>release(id),ms));
}
function release(id){clearTimeout(timers.get(id));timers.delete(id);values.delete(id);paint();}
async function load(id){
  current=layoutForId(id)||LAYOUTS[0];
  $('layout').value=current.id;
  $('parity').textContent=current.name+' · '+current.note;
  await reference.load(current);
  $('status').textContent=reference.svg?`${current.name} · ${reference.controls.length} Zeichen-/Control-Layer · ${current.availability}`:`${current.name} · Quelle nicht geladen`;
  paint();
}
for(const layout of LAYOUTS){const option=document.createElement('option');option.value=layout.id;option.textContent=layout.name; $('layout').appendChild(option);}
$('layout').addEventListener('change',e=>{void load(e.target.value)});
for(const id of ['axisX','axisY'])$(id).addEventListener('input',()=>{
  sticks[side]={x:Number($('axisX').value)/100,y:Number($('axisY').value)/100};paint();
});
for(const button of document.querySelectorAll('[data-side]'))button.addEventListener('click',()=>{
  side=button.dataset.side;
  document.querySelectorAll('[data-side]').forEach(b=>b.classList.toggle('selected',b===button));
  $('axisX').value=Math.round(sticks[side].x*100);$('axisY').value=Math.round(sticks[side].y*100);
});
$('reset').addEventListener('click',()=>{$('axisX').value='0';$('axisY').value='0';sticks[side]={x:0,y:0};paint();});
for(const button of document.querySelectorAll('[data-key]')){
  const key=button.dataset.key;
  const start=e=>{if(e.button!==0)return;button.setPointerCapture(e.pointerId);press(key,0);button.classList.add('selected');};
  const stop=()=>{button.classList.remove('selected');release(key);};
  button.addEventListener('pointerdown',start);
  button.addEventListener('pointerup',stop);
  button.addEventListener('pointercancel',stop);
  button.addEventListener('lostpointercapture',stop);
}
void load(new URLSearchParams(location.search).get('id')||'dualsense');
window.__referenceQA={reference,load,values,sticks,paint};
