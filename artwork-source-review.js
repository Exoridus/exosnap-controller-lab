import {LAYOUTS,layoutForId} from './controller-catalog.js';
import {ControllerReference,isolateReferenceIds} from './controller-reference.js';
import {paintPolished2D} from './polish-2d-style.js';
import {attachStickDrag} from './stick-drag.js';

const $=id=>document.getElementById(id),clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const sceneValues=['dark','light','mixed'];
const stages=[...document.querySelectorAll('.stage[data-view]')];
const refs=stages.map(stage=>({mode:stage.dataset.view,stage,
  reference:new ControllerReference(stage,{onPress:key=>{if(!['ls','rs'].includes(key))togglePress(key);}})}));
const query=new URLSearchParams(location.search),manual=new Set();
let selected=null,actual=null,serial=0;
const drag={left:null,right:null};let clearDrags=[];
for(const layout of LAYOUTS.filter(x=>x.has2D)){
  const option=document.createElement('option');option.value=layout.id;
  option.textContent=layout.name;$('layout').append(option);
}
function updateDimensions(){
  const width=Number($('size').value)||480;
  document.documentElement.style.setProperty('--panel-width',width+'px');
  document.documentElement.style.setProperty('--panel-height',Math.round(width*2/3)+'px');
}
function state(){
  const amount=clamp($('stick').value/100),trigger=clamp($('trigger').value/100);
  const axis=amount/Math.SQRT2,values=new Map();
  if($('faces').checked||$('allControls').checked)
    for(const key of ['b1','b2','b3','b4','up','down','left','right'])values.set(key,1);
  if($('allControls').checked)
    for(const key of ['l1','r1','start','select','home','share','touchpad'])values.set(key,1);
  if($('clicks').checked||$('clickLeft').checked)values.set('ls',1);
  if($('clicks').checked||$('clickRight').checked)values.set('rs',1);
  if(trigger>0){values.set('l2',trigger);values.set('r2',trigger);}
  for(const key of manual)values.set(key,1);
  return {values,left:drag.left||{x:axis,y:-axis},right:drag.right||{x:-axis,y:axis}};
}
function togglePress(key){
  if(!key)return;
  if(manual.has(key))manual.delete(key);else manual.add(key);
  render();
}
function writeStats(){
  const mapping=refs.find(x=>x.mode==='solid')?.reference.mapping;
  if(!mapping||!selected)return;
  const layers=mapping.layers||[],count=predicate=>layers.filter(predicate).length;
  const license=mapping.license?.spdx||'nicht dokumentiert';
  const stats=[
    ['Quelle',actual.id],['Layer',layers.length],
    ['Druckflächen',count(x=>Boolean(x.pressElement))],
    ['Stick-Knockouts',count(x=>Boolean(x.knockout))],
    ['Preview-only',count(x=>Boolean(x.preview))],
    ['Touch-Metadaten',count(x=>Boolean(x.touch))],
    ['3D-Abdeckung',selected.availability],['Lizenz (Mapping)',license]
  ];
  $('mappingStats').replaceChildren(...stats.map(([name,value])=>{
    const div=document.createElement('div');const strong=document.createElement('strong');
    strong.textContent=name+': ';div.append(strong,document.createTextNode(String(value)));return div;
  }));
  $('licenseWarning').textContent=selected.id==='steam_controller_2026'
    ?'Lizenz-Hinweis: Die exakte 2026-Geometrie aus dem alternativen Handoff wird nicht angezeigt. Sichtbar ist nur der sichere Generic-Fallback.'
    :selected.id==='gamecube'
      ?'GameCube-Artwork: GPL-3.0-only. Herkunftshinweise vor Wiederverwendung prüfen.'
      :selected.availability==='license-review'
        ?'3D-Modell ist im Lab ausdrücklich als lizenzrechtlich ungeprüft gekennzeichnet.'
        :'Quell-SVG und Bindings werden nicht verändert; dies ist eine Browserprüfung.';
}
function render(){
  if(!selected)return;
  const input=state(),scene=$('scene').value;
  for(const item of refs){
    item.stage.dataset.scene=scene;
    if(!item.reference.svg)continue;
    if(item.mode==='source'){
      // Original author's SVG paths; only independent stick transforms.
      item.reference.update(new Map(),{left:input.left,right:input.right});
    }else{
      paintPolished2D(item.reference,item.mode,scene,{...input,
        colorway:$('colorway').value,stickFeedback:'ring',
        showFaceSymbols:$('faceSymbols').checked,edgeLight:.38,edgeShadow:.45});
    }
  }
  const loaded=refs.every(item=>Boolean(item.reference.svg));
  document.body.dataset.sourceReviewReady=loaded?'ready':'incomplete';
  $('status').textContent=selected.name+' · '+refs.filter(x=>x.reference.svg).length+
    '/3 Renderer · Stick '+$('stick').value+' % · Trigger '+$('trigger').value+' %';
  if(loaded)writeStats();
}
async function load(id){
  const token=++serial;
  selected=layoutForId(id)||layoutForId('dualsense');
  if(!selected?.has2D)selected=layoutForId('dualsense');
  // Never load the NC-derived alternative geometry for this device.
  actual=selected.id==='steam_controller_2026'?layoutForId('generic'):selected;
  $('layout').value=selected.id;
  manual.clear();clearDrags.forEach(fn=>fn());clearDrags=[];
  drag.left=null;drag.right=null;
  document.body.dataset.sourceReviewReady='loading';
  $('status').textContent='Lade '+selected.name+' …';
  await Promise.all(refs.map(async(item,index)=>{
    await item.reference.load(actual);
    if(token===serial&&item.reference.svg)
      isolateReferenceIds(item.reference.svg,'src-review-'+token+'-'+index);
  }));
  if(token!==serial)return;
  for(const item of refs)clearDrags.push(attachStickDrag(item.reference,{
    start:side=>{$('stick').value='0';$('stickValue').textContent='0 %';drag[side]={x:0,y:0};render();},
    move:(side,axes)=>{drag[side]=axes;render();},
    end:side=>{drag[side]=null;render();}
  }));
  render();
}
function address(){
  const p=new URLSearchParams({id:selected?.id||'dualsense',scene:$('scene').value,
    size:$('size').value});
  history.replaceState(null,'',location.pathname+'?'+p);
}
$('layout').addEventListener('change',e=>{void load(e.target.value).then(address);});
for(const id of ['scene','size','colorway'])$(id).addEventListener('change',()=>{
  if(id==='size')updateDimensions();
  render();address();
});
for(const id of ['stick','trigger'])$(id).addEventListener('input',()=>{
  $(id+'Value').textContent=$(id).value+' %';render();
});
for(const id of ['clicks','clickLeft','clickRight','faces','allControls','faceSymbols'])$(id).addEventListener('change',render);
const fromQuery=(id,allowed)=>{if(allowed.includes(query.get(id)))$(id).value=query.get(id);};
fromQuery('scene',sceneValues);fromQuery('size',['320','480']);updateDimensions();
void load(query.get('id')||'dualsense');
window.__exoSourceReview={get status(){return document.body.dataset.sourceReviewReady},
  get refs(){return refs},get selected(){return selected?.id},get actual(){return actual?.id},
  load,render,state,get drag(){return {...drag}}};
