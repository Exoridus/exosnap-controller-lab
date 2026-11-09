// Visual-only Qt portability playground using the existing ControllerReference.
// No WebGL, shader program, canvas compositing, image sampling or CSS filters.
import {LAYOUTS,layoutForId} from './controller-catalog.js';
import {ControllerReference} from './controller-reference.js';
import {CONTROL_IDS} from './models.js';
import {PRESETS,SCENES,materialValues} from './qt-material-presets.js';

const $=id=>document.getElementById(id);
const ref=new ControllerReference($('sourceReference'));
const params=new URLSearchParams(location.search);
const sceneNames={dark:'Dunkel',light:'Hell',mixed:'Gemischt'};
let selected='frost',serial=0,request=0,current=null;
const panels=[];
const SIZE=[240,320,480];
const readableNum=(value)=>Number(value).toFixed(2);
const nodes = root=>[root,...root.querySelectorAll('*')];

function renameFragmentIds(svg,prefix){
  const ids=new Map();
  for(const element of nodes(svg)){
    const id=element.getAttribute('id');
    if(id){ids.set(id,`${prefix}-${id}`);element.setAttribute('id',ids.get(id));}
  }
  for(const element of nodes(svg)){
    for(const attribute of [...element.attributes]){
      if(attribute.name==='id')continue;
      let value=attribute.value.replace(/url\((['"]?)#([^)'"\s]+)\1\)/g,(match,q,id)=>ids.has(id)?`url(#${ids.get(id)})`:match);
      if(['href','xlink:href'].includes(attribute.name)&&value.startsWith('#')&&ids.has(value.slice(1)))value=`#${ids.get(value.slice(1))}`;
      if(value!==attribute.value)element.setAttribute(attribute.name,value);
    }
  }
}
function rawOpacity(element,prop,defaultValue=1){
  const val=element.style.getPropertyValue(prop)||element.getAttribute(prop);
  const n=Number(val);return val===null||val===''||!Number.isFinite(n)?defaultValue:Math.max(0,Math.min(1,n));
}
function sourcePaint(element,property){
  return (element.style.getPropertyValue(property)||element.getAttribute(property)||'').trim().toLowerCase();
}
function putPaint(element,property,color,opacity){
  // Direct SVG paint attributes also render in Qt SVG; never rely on CSS classes.
  element.style.setProperty(property,color);
  element.style.setProperty(`${property}-opacity`,readableNum(opacity));
}
function paintShape(shape,state,owner,pressed){
  if(shape.closest('defs,mask,clipPath'))return;
  const id=shape.id||'';
  const glyph=shape.classList.contains('glyph')||id==='home-logo'||id.includes('speaker-grille');
  const shell=owner==='body'||id==='outline-strong'||id==='speaker-grille';
  const face=id.endsWith('-face')||id==='dpad-face'||(owner==='dpad'&&id==='dpad-cross');
  const pressure=id.endsWith('-pressure');
  const stickCap=/^stick-[lr]-cap/.test(owner);
  const isVisibleControl=!shell;
  let fill=sourcePaint(shape,'fill'),stroke=sourcePaint(shape,'stroke');
  const originalFillAlpha=rawOpacity(shape,'fill-opacity',1);
  const originalStrokeAlpha=rawOpacity(shape,'stroke-opacity',1);
  // Changes to the SVG's reference press style should not leak into this layer.
  if(pressed&&face){fill=fill==='none'||!fill?'#fff':fill;}
  if((face||pressure||stickCap)&&fill==='none'&&!glyph){
    fill=state.controlColor;
    shape.style.setProperty('fill',fill);
  }
  if(fill&&fill!=='none'){
    if(glyph){
      const glyphColor=pressed?state.activeInk:state.inkColor;
      putPaint(shape,'fill',glyphColor,Math.max(.44,state.lineAlpha)*originalFillAlpha);
    }else if(shell){
      putPaint(shape,'fill',state.shellColor,state.shellAlpha*originalFillAlpha);
    }else if(pressed){
      // Even at Ghost, a held button must remain translucent.
      putPaint(shape,'fill',state.blue,Math.min(.94,state.activeAlpha)*Math.max(.42,originalFillAlpha));
    }else{
      putPaint(shape,'fill',state.controlColor,state.controlAlpha*originalFillAlpha*(face?.72:1));
    }
  }
  if(stroke&&stroke!=='none'){
    const color=pressed&&isVisibleControl?state.blue:state.inkColor;
    putPaint(shape,'stroke',color,originalStrokeAlpha*(shell?state.lineAlpha:state.controlEdgeOpacity));
  }
  shape.style.removeProperty('filter');
  shape.removeAttribute('filter');
}
function addDualOutline(svg,state){
  const outline=svg.querySelector('#outline-strong');
  if(!outline)return;
  const mainWidth=Number(outline.style.getPropertyValue('stroke-width')||outline.getAttribute('stroke-width')||2);
  const outer=outline.cloneNode(true);
  outer.removeAttribute('id');outer.setAttribute('data-qt-outer','1');
  outer.style.setProperty('fill','none');
  outer.style.setProperty('stroke',state.dualOuter);
  outer.style.setProperty('stroke-width',String(mainWidth+1.6));
  outer.style.setProperty('stroke-opacity',readableNum(.70));
  const inner=outline.cloneNode(true);
  inner.removeAttribute('id');inner.setAttribute('data-qt-inner','1');
  inner.style.setProperty('fill','none');
  inner.style.setProperty('stroke',state.dualInner);
  inner.style.setProperty('stroke-width',String(Math.max(.55,mainWidth*.33)));
  inner.style.setProperty('stroke-opacity',readableNum(.64));
  // Draw outer, normal outline and inner in source order: no blend / blur pass.
  outline.before(outer);outline.after(inner);
}
function addPressAccents(svg,state,activeOwners){
  // Two ordinary vector strokes, not a blur/glow filter. Qt: QPainter::drawPath twice.
  for(const id of activeOwners){
    const face=svg.querySelector(`[id="${CSS.escape(id+'-face')}"]`)
      ||svg.querySelector(`[id="${CSS.escape(id+'-outline')}"]`);
    if(!face||!face.closest('g'))continue;
    const edge=face.cloneNode(true);
    edge.removeAttribute('id');edge.setAttribute('data-qt-pressed-outer','1');
    edge.style.setProperty('fill','none');
    edge.style.setProperty('stroke',state.blue);
    const base=Number(face.style.getPropertyValue('stroke-width')||face.getAttribute('stroke-width')||1);
    edge.style.setProperty('stroke-width',String(base+1.4));
    edge.style.setProperty('stroke-opacity',readableNum(state.pressOuterOpacity));
    face.before(edge);
  }
}
// Qt 6 SVG implements <mask> but not <clipPath>. Convert original vector
// clipping definitions into equivalent white-on-transparent luminance masks.
// This is a static DOM transform; it does not require custom shader passes.
export function convertQtClips(svg){
  const namespace='http://www.w3.org/2000/svg';
  const vb=(svg.getAttribute('viewBox')||'0 0 800 600').trim().split(/[ ,]+/).map(Number);
  const bounds=vb.length===4&&vb.every(Number.isFinite)?vb:[0,0,800,600];
  const converted=new Map();
  for(const clip of [...svg.querySelectorAll('clipPath')]){
    const mask=document.createElementNS(namespace,'mask');
    const id=clip.getAttribute('id');
    if(!id)continue;
    mask.setAttribute('id',id);
    mask.setAttribute('maskUnits','userSpaceOnUse');
    mask.setAttribute('maskContentUnits','userSpaceOnUse');
    mask.setAttribute('x',String(bounds[0]));mask.setAttribute('y',String(bounds[1]));
    mask.setAttribute('width',String(bounds[2]));mask.setAttribute('height',String(bounds[3]));
    for(const original of [...clip.children]){
      const white=original.cloneNode(true);
      for(const el of nodes(white)){
        const rule=el.getAttribute('clip-rule')||el.style.getPropertyValue('clip-rule');
        if(rule)el.setAttribute('fill-rule',rule);
        el.style.setProperty('fill','#ffffff');
        el.style.setProperty('fill-opacity','1');
        el.style.setProperty('stroke','none');
        el.removeAttribute('clip-rule');el.style.removeProperty('clip-rule');
      }
      mask.appendChild(white);
    }
    clip.replaceWith(mask);converted.set(id,id);
  }
  for(const element of nodes(svg)){
    const value=element.getAttribute('clip-path')||element.style.getPropertyValue('clip-path');
    const id=value?.match(/^url\(#([^)]*)\)$/)?.[1];
    if(id&&converted.has(id))element.setAttribute('mask',`url(#${id})`);
    element.removeAttribute('clip-path');element.style.removeProperty('clip-path');
  }
  return converted.size;
}

export function applyQtMaterial(svg,state,activeOwners=[]){
  convertQtClips(svg);
  // Direct children define model-level ownership, never infer semantics from SVG path order.
  const pressed=new Set(activeOwners);
  for(const group of [...svg.children]){
    if(group.localName!=='g')continue;
    const owner=group.id;
    for(const shape of group.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')){
      paintShape(shape,state,owner,pressed.has(owner));
    }
  }
  if(state.dual)addDualOutline(svg,state);
  addPressAccents(svg,state,pressed);
  // Qt-compatible SVG 1.2 Tiny paint primitives only. Original mask for stick
  // travel remains, supported by Qt SVG 6; no unsupported clip path is added.
  for(const element of nodes(svg)){
    element.style?.removeProperty('filter');
    element.removeAttribute('filter');
  }
  return svg;
}

for(const layout of LAYOUTS.filter(x=>x.has2D)){
  const o=document.createElement('option');o.value=layout.id;o.textContent=layout.name;$('controller').appendChild(o);
}
for(const variant of PRESETS){
  const section=document.createElement('section');section.className='variant';section.dataset.variant=variant.id;
  const title=document.createElement('div');title.className='variant-heading';
  title.innerHTML=`<div><span class="variant-name"></span><p class="variant-detail"></p></div><span class="qt-tag">Qt · nur Vektor</span>`;
  title.querySelector('.variant-name').textContent=variant.name;
  title.querySelector('.variant-detail').textContent=variant.detail;
  section.appendChild(title);
  const row=document.createElement('div');row.className='samples';
  for(const scene of SCENES){
    const figure=document.createElement('figure');
    const caption=document.createElement('figcaption');caption.textContent=sceneNames[scene];
    const stage=document.createElement('div');stage.className='sample';stage.dataset.scene=scene;
    const status=document.createElement('span');status.className='sample-info';status.textContent='2D SVG';
    stage.appendChild(status);figure.append(caption,stage);row.appendChild(figure);
    panels.push({variant:variant.id,scene,stage});
  }
  section.appendChild(row);section.addEventListener('click',()=>{selected=variant.id;renderSelected();});
  $('variants').appendChild(section);
}
function renderSelected(){
  for(const section of document.querySelectorAll('.variant')){
    section.classList.toggle('selected',section.dataset.variant===selected);
  }
  $('selected').textContent=PRESETS.find(x=>x.id===selected).name;
}
function modelState(){
  const poses=ref.controls.filter(entry=>entry.control||entry.layer.role==='directional-pad');
  const active=$('pressed').checked?poses.map(entry=>entry.layer.id):[];
  return {active,values:new Map($('pressed').checked?CONTROL_IDS.map(id=>[id,1]):[])};
}
function updateSizes(){
  const w=SIZE.includes(Number($('size').value))?Number($('size').value):320;
  $('variants').style.setProperty('--sample-width',`${w}px`);
  $('variants').style.setProperty('--sample-height',`${Math.round(w*2/3)}px`);
  document.body.dataset.sampleWidth=String(w);
}
function paint(){
  if(!ref.svg)return;
  const m=Number($('mix').value)/100;
  $('mixValue').textContent=`${Math.round(m*100)} % · ${m===0?'Normal':m===1?'Ghost':'Materialmix'}`;
  const {active,values}=modelState();
  ref.update(values,{});
  // No CSS filter from ControllerReference's own directional pad preview.
  for(const panel of panels){
    const copy=ref.svg.cloneNode(true);
    const state=materialValues(m,panel.variant,panel.scene,current.id);
    applyQtMaterial(copy,state,active);
    renameFragmentIds(copy,`qt-${panel.variant}-${panel.scene}`);
    copy.removeAttribute('width');copy.removeAttribute('height');
    copy.setAttribute('preserveAspectRatio','xMidYMid meet');
    copy.setAttribute('role','presentation');
    panel.stage.querySelector('svg')?.remove();panel.stage.insertBefore(copy,panel.stage.firstChild);
    panel.stage.dataset.alphaShell=readableNum(state.shellAlpha);
    panel.stage.dataset.alphaControls=readableNum(state.controlAlpha);
  }
  document.body.dataset.qtReady=current.id;document.body.dataset.mix=String(m);
  $('status').textContent=`${current.name} · ${panels.length} reale SVG-Vorschauen · 1 Materialmix · keine Shader / Filter / Render-Passes`;
  renderSelected();
}
function schedule(){cancelAnimationFrame(request);request=requestAnimationFrame(paint);}
async function load(id){
  const token=++serial;
  const candidate=layoutForId(id);
  current=candidate?.has2D?candidate:LAYOUTS.find(x=>x.has2D);
  $('controller').value=current.id;
  delete document.body.dataset.qtReady;
  $('status').textContent=`Lade ${current.name}...`;
  await ref.load(current);
  if(token!==serial)return;
  if(!ref.svg){$('status').textContent='SVG konnte nicht geladen werden';return;}
  const unsupported=[...ref.svg.querySelectorAll('clipPath,foreignObject,filter')].map(x=>x.localName);
  $('warning').textContent=unsupported.length?`${unsupported.length} Original-Clip-Definition(en) werden für Qt SVG als Maske umgesetzt.`:'Keine benutzerdefinierten Effekte; SVG-Masken für die Stick-Aussparungen bleiben erhalten.';
  schedule();
}
function exportSelected(){
  const selectedPanel=panels.find(p=>p.variant===selected&&p.scene==='mixed');
  const svg=selectedPanel?.stage.querySelector('svg');if(!svg)return;
  const clone=svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  // The exported SVG is self-contained and can be opened by QSvgRenderer.
  const bytes=new XMLSerializer().serializeToString(clone);
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/svg+xml'}));
  const link=document.createElement('a');link.href=url;link.download=`qt-${current.id}-${selected}-${$('mix').value}.svg`;
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('controller').addEventListener('change',e=>{void load(e.target.value);});
$('mix').addEventListener('input',schedule);
$('size').addEventListener('change',updateSizes);
$('pressed').addEventListener('change',schedule);
$('export').addEventListener('click',exportSelected);
$('mix').value=params.get('mix')&&Number.isFinite(Number(params.get('mix')))?String(Math.min(100,Math.max(0,Number(params.get('mix'))))):'65';
$('pressed').checked=params.get('pressed')==='1';
updateSizes();renderSelected();
window.__qtLabQA={ref,panels,materialValues,applyQtMaterial,load,paint};
void load(params.get('id')||'dualsense');
