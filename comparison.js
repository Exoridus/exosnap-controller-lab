// Separate diagnostic host. Every panel loads the production renderer as-is.
// This page reports observed initialization, never visual acceptance.
import {STICK_TEST_DIRECTIONS} from './parity-test-pose.js';

const $=id=>document.getElementById(id);
const sizes=new Map([['240x160',{width:240,height:160}],['320x214',{width:320,height:214}],['480x320',{width:480,height:320}]]);
const candidateNotes={
  A:'A · Dunkle Außenkante, helle Innenkante und schmale Kontrollgrenzen. Wirkung und Doppelkanten sind visuell ungeprüft.',
  B:'B · Kleiner versetzter Schatten aus der Modellmaske. Wirkung und optische Verbreiterung sind visuell ungeprüft.',
  C:'C · Weiche lokale Außenmaske mit Kontrollgrenzen. Dichte und Zwischenräume sind visuell ungeprüft.',
  D:'D · Dunkle Silhouette mit materialbasiertem Fresnel-Rand. Vorläufiger Startwert; visuell ungeprüft.',
  E:'E · Konturfarbe aus der Hintergrundluminanz. Lokale Wechsel und Texturdeckung sind visuell ungeprüft.',
  off:'off · Zusätzlicher Kontrastpass ausgeschaltet. Vergleichsbasis; visuell ungeprüft.',
};
const materials=new Map([['1','Ghost'],['0.5','Glass'],['0','Normal']]);
const views=new Set(['front','angled','side']);
const poseNames=new Set(['neutral','right','down','up-right']);
const query=new URLSearchParams(location.search);
const initialCandidate=query.get('contrast');
if(Object.hasOwn(candidateNotes,initialCandidate))$('comparisonCandidate').value=initialCandidate;
if(sizes.has(query.get('size')))$('comparisonSize').value=query.get('size');
const queryMix=query.has('mix')?String(Number(query.get('mix'))):'1';
if(materials.has(queryMix))$('comparisonMix').value=queryMix;
if(views.has(query.get('view')))$('comparisonView').value=query.get('view');
if(poseNames.has(query.get('pose')))$('comparisonPose').value=query.get('pose');
$('comparisonPressed').checked=query.get('pressed')==='1';

const panels=[...document.querySelectorAll('#comparisonPanels figure')].map(figure=>({
  figure,frame:figure.querySelector('iframe'),status:figure.querySelector('.frame-status'),
  link:figure.querySelector('.open-frame'),scene:figure.dataset.background,name:figure.querySelector('strong').textContent,
}));
let pollTimer=null,generation=0,startedAt=0;

function selectedState(){
  const candidate=$('comparisonCandidate').value;
  const size=$('comparisonSize').value;
  const mix=$('comparisonMix').value;
  const view=$('comparisonView').value;
  const pose=$('comparisonPose').value;
  const pressed=$('comparisonPressed').checked;
  if(!Object.hasOwn(candidateNotes,candidate)||!sizes.has(size)||!materials.has(mix)||!views.has(view)||!poseNames.has(pose))throw new Error('Ungültige Diagnoseauswahl.');
  const axes=pose==='neutral'?{x:0,y:0}:STICK_TEST_DIRECTIONS.find(direction=>direction.id===pose);
  return {candidate,size,mix,view,pose,pressed,axes,...sizes.get(size)};
}
function diagnosticUrl(state,background){
  const url=new URL('./index.html',location.href);
  url.search=new URLSearchParams({
    diagnostic:'1',layout:'dualsense',contrast:state.candidate,mix:state.mix,view:state.view,
    background,stick:`${state.axes.x},${state.axes.y}`,buttons:state.pressed?'1':'0',
    click:state.pressed?'1':'0',label:'0',
  }).toString();
  return url;
}
function setStatus(panel,state,text){
  panel.figure.dataset.frameState=state;
  if(panel.status.textContent!==text)panel.status.textContent=text;
}
function inspectFrames(expectedGeneration){
  if(expectedGeneration!==generation)return;
  if(pollTimer!==null){clearTimeout(pollTimer);pollTimer=null;}
  let ready=0,unavailable=0;
  const expired=performance.now()-startedAt>=30000;
  for(const panel of panels){
    try{
      const documentInFrame=panel.frame.contentDocument;
      const body=documentInFrame?.body;
      const data=body?.dataset;
      if(documentInFrame?.URL===panel.expectedUrl&&data?.modelReady==='dualsense'&&data.renderReady&&data.webglRenderer){
        ready++;
        setStatus(panel,'initialised','Renderer und Modell initialisiert. Visuelle Abnahme bleibt offen.');
      }else if(expired){
        unavailable++;
        setStatus(panel,'unavailable','Kein Renderer-Bereitschaftssignal. Browser-Konsole und WebGL prüfen.');
      }else setStatus(panel,'waiting','Warte auf Renderer- und Modellinitialisierung.');
    }catch{
      unavailable++;
      setStatus(panel,'error','Frame-Status nicht lesbar. Ansicht einzeln öffnen und Konsole prüfen.');
    }
  }
  document.body.dataset.comparisonReadyFrames=String(ready);
  document.body.dataset.comparisonStatus=ready===panels.length?'initialised-unreviewed':unavailable?'unavailable':'waiting';
  const summary=`${ready} / ${panels.length} Renderer initialisiert · ${unavailable?`${unavailable} ohne Bereitschaftssignal · `:''}Keine visuelle Abnahme. `+
    (ready===panels.length?'Kontrast, Transparenz und Stickgeometrie sind manuell zu prüfen.':'Ein leeres oder ladendes Fenster ist kein bestandener Render-Test.');
  if($('comparisonRuntime').textContent!==summary)$('comparisonRuntime').textContent=summary;
  if(ready+unavailable<panels.length&&!expired)pollTimer=setTimeout(()=>inspectFrames(expectedGeneration),350);
}
function update(){
  const state=selectedState();
  generation++;
  if(pollTimer!==null)clearTimeout(pollTimer);
  const thisGeneration=generation;
  startedAt=performance.now();
  document.documentElement.style.setProperty('--preview-width',`${state.width}px`);
  document.documentElement.style.setProperty('--preview-height',`${state.height}px`);
  $('techniqueSummary').textContent=candidateNotes[state.candidate];
  for(const row of document.querySelectorAll('[data-technique]')){
    if(row.dataset.technique===state.candidate)row.setAttribute('aria-current','true');
    else row.removeAttribute('aria-current');
  }
  for(const panel of panels){
    const url=diagnosticUrl(state,panel.scene);
    panel.frame.width=String(state.width);panel.frame.height=String(state.height);
    panel.frame.title=`${panel.name} · ${state.width} × ${state.height} · ${state.candidate} · ${materials.get(state.mix)} · ${state.view} · ${state.pose}`;
    panel.figure.querySelector('.frame-size').textContent=`${state.width} × ${state.height} CSS px`;
    panel.link.href=url.href;
    // Size changes and explicit reloads otherwise share a URL. A distinct
    // navigation address prevents an old ready document from passing this run.
    // The production renderer ignores this host-only bookkeeping parameter.
    url.searchParams.set('comparisonRun',String(thisGeneration));
    panel.expectedUrl=url.href;
    setStatus(panel,'waiting','Warte auf Renderer- und Modellinitialisierung.');
    panel.frame.src=url.href;
  }
  Object.assign(document.body.dataset,{
    comparisonCandidate:state.candidate,comparisonSize:state.size,comparisonMix:state.mix,
    comparisonView:state.view,comparisonPose:state.pose,comparisonPressed:String(state.pressed),
    comparisonReadyFrames:'0',comparisonStatus:'waiting',
  });
  const address=new URL(location.href);
  address.search=new URLSearchParams({contrast:state.candidate,size:state.size,mix:state.mix,view:state.view,pose:state.pose,pressed:state.pressed?'1':'0'}).toString();
  history.replaceState(null,'',address);
  // Loading starts immediately in all three documents. Read their actual DOM
  // markers; never create a substitute drawing when WebGL is unavailable.
  pollTimer=setTimeout(()=>inspectFrames(thisGeneration),350);
}
$('comparisonControls').addEventListener('submit',event=>event.preventDefault());
$('comparisonControls').addEventListener('change',update);
$('comparisonReload').addEventListener('click',update);
for(const panel of panels)panel.frame.addEventListener('load',()=>inspectFrames(generation));
window.addEventListener('pagehide',()=>{generation++;if(pollTimer!==null)clearTimeout(pollTimer);});
update();
