// Diagnostic source-stage inspection. This page deliberately never constructs
// a Three renderer: it must not imply that WebGL parity has been verified.
import {LAYOUTS,layoutForId} from './controller-catalog.js';
import {ControllerReference} from './controller-reference.js';
import {CONTROL_IDS} from './models.js';
import {STICK_TEST_DIRECTIONS,previewStickPose} from './parity-test-pose.js';
import {recolorNeutralForLight} from './parity-color.js';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const reference=new ControllerReference($('sourceStage'));
const sizes=[{width:240,height:160},{width:320,height:214},{width:480,height:320}];
const scenes=[{id:'dark',name:'Dark'},{id:'light',name:'Light — neutral vector paints remapped'},{id:'mixed',name:'Mixed — lab racing background'}];
const panels=[];
let current=null,loadSerial=0;

for(const scene of scenes){
  const section=document.createElement('section');
  const heading=document.createElement('h2');heading.textContent=scene.name;section.appendChild(heading);
  const row=document.createElement('div');row.className='panel-row';section.appendChild(row);
  for(const size of sizes){
    const figure=document.createElement('figure');
    const caption=document.createElement('figcaption');caption.textContent=`${size.width} × ${size.height} CSS px`;
    const stage=document.createElement('div');
    stage.id=`gallery-${scene.id}-${size.width}`;stage.className='inspection-stage';stage.dataset.background=scene.id;
    stage.style.width=`${size.width}px`;stage.style.height=`${size.height}px`;
    stage.setAttribute('role','img');stage.setAttribute('aria-label',`${scene.name}, ${size.width} by ${size.height}`);
    figure.append(caption,stage);row.appendChild(figure);panels.push({stage,scene:scene.id,...size});
  }
  $('galleryPanels').appendChild(section);
}
for(const layout of LAYOUTS){
  const option=document.createElement('option');option.value=layout.id;option.textContent=layout.name;$('galleryLayout').appendChild(option);
}
for(const direction of STICK_TEST_DIRECTIONS){
  const option=document.createElement('option');option.value=direction.id;option.textContent=direction.label;$('galleryPose').appendChild(option);
}

// Multiple inline SVGs share a document ID namespace. Rewrite only clone IDs
// and local fragment references so every panel uses its own mask/clip paths.
function isolateFragmentIds(svg,prefix){
  const elements=[svg,...svg.querySelectorAll('*')],ids=new Map();
  for(const element of elements){
    const id=element.getAttribute('id');
    if(id){ids.set(id,`${prefix}-${id}`);element.setAttribute('id',`${prefix}-${id}`);}
  }
  for(const element of elements){
    for(const attribute of [...element.attributes]){
      if(attribute.name==='id')continue;
      let value=attribute.value.replace(/url\((['"]?)#([^)'"\s]+)\1\)/g,(match,quote,id)=>ids.has(id)?`url(#${ids.get(id)})`:match);
      if((attribute.name==='href'||attribute.name==='xlink:href')&&value[0]==='#'&&ids.has(value.slice(1)))value='#'+ids.get(value.slice(1));
      if(value!==attribute.value)element.setAttribute(attribute.name,value);
    }
  }
}
function readPaint(value){
  const paint=value.trim().toLowerCase();
  if(paint==='white')return [255,255,255,255];
  if(paint==='black')return [0,0,0,255];
  const hex=paint.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if(hex){const full=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16)).concat(255);}
  const rgb=paint.match(/^rgba?\(([^)]+)\)$/);
  if(!rgb)return null;
  const values=rgb[1].trim().split(/[ ,/]+/).map(Number);
  if(values.length<3||values.some(n=>!Number.isFinite(n)))return null;
  return [values[0],values[1],values[2],Math.round(255*(values[3]??1))];
}
function remapLightPaints(svg){
  for(const element of [svg,...svg.querySelectorAll('*')]){
    // White in a luminance mask means visible, not white ink. Recolouring it
    // would itself erase the artwork being inspected.
    if(element.closest('defs,mask,clipPath'))continue;
    for(const property of ['fill','stroke']){
      const raw=element.style.getPropertyValue(property)||element.getAttribute(property);
      if(!raw)continue;
      const input=readPaint(raw);if(!input)continue;
      const output=new Uint8ClampedArray(input);recolorNeutralForLight(output);
      if(output[0]===input[0]&&output[1]===input[1]&&output[2]===input[2])continue;
      const priority=element.style.getPropertyPriority(property);
      element.style.setProperty(property,`rgba(${output[0]}, ${output[1]}, ${output[2]}, ${output[3]/255})`,priority);
    }
  }
}
function inputState(){
  const poseId=$('galleryPose').value;
  const pose=poseId==='neutral'?{id:'neutral',label:'Neutral',x:0,y:0}:previewStickPose(0,poseId);
  const pressed=$('galleryPressed').checked;
  const values=new Map(pressed?CONTROL_IDS.map(id=>[id,1]):[]);
  return {pose,pressed,values};
}
function updateAddress(){
  const query=new URLSearchParams({id:current.id,pose:$('galleryPose').value});
  if($('galleryPressed').checked)query.set('pressed','1');
  history.replaceState(null,'',`${location.pathname}?${query}${location.hash}`);
}
function paint(){
  if(!reference.svg)return;
  const {pose,pressed,values}=inputState();
  reference.update(values,{left:pose,right:pose});
  for(const panel of panels){
    const copy=reference.svg.cloneNode(true);
    isolateFragmentIds(copy,panel.stage.id);
    if(panel.scene==='light')remapLightPaints(copy);
    copy.setAttribute('role','presentation');panel.stage.replaceChildren(copy);
  }
  const exact=panels.every(({stage,width,height})=>{const box=stage.getBoundingClientRect();return box.width===width&&box.height===height;});
  $('status').textContent=`${current.name} · ${pose.label} (${pose.x.toFixed(3)}, ${pose.y.toFixed(3)}) · ${pressed?'All standard controls pressed':'Controls released'} · ${panels.length} DOM SVG panels · ${exact?'Exact viewport sizes confirmed':'Viewport size mismatch'}`;
  document.body.dataset.galleryReady=current.id;document.body.dataset.galleryPose=pose.id;document.body.dataset.galleryPressed=String(pressed);
  updateAddress();
}
async function load(id){
  const serial=++loadSerial;
  current=layoutForId(id)?.has2D?layoutForId(id):LAYOUTS[0];
  $('galleryLayout').value=current.id;delete document.body.dataset.galleryReady;
  $('status').textContent=`Loading ${current.name} SVG source…`;
  await reference.load(current);
  if(serial!==loadSerial)return;
  if(!reference.svg){$('status').textContent=`${current.name}: SVG source could not be loaded.`;for(const panel of panels)panel.stage.replaceChildren();return;}
  paint();
}
$('galleryLayout').addEventListener('change',event=>{void load(event.target.value);});
$('galleryPose').addEventListener('change',paint);
$('galleryPressed').addEventListener('change',paint);
const initialPose=params.get('pose');
if(initialPose==='neutral'||STICK_TEST_DIRECTIONS.some(p=>p.id===initialPose))$('galleryPose').value=initialPose;
$('galleryPressed').checked=params.get('pressed')==='1';

// Readable diagnostic state for browser verification; no synthetic 3D output.
window.__gallery2DQA={reference,load,paint,panels,inputState};
void load(params.get('id')||'dualsense');
