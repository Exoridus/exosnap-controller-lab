// Visual 2D-polish experiment for the browser lab. The SVG source files,
// bindings, cutouts and moving stick transforms are not rewritten.
export const PRESS_WHITE='#ffffff';
const clamp=(n)=>Math.max(0,Math.min(1,Number.isFinite(Number(n))?Number(n):0));
const rgb=(hex)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function mixColor(a,b,amount){
  const t=clamp(amount),left=rgb(a),right=rgb(b);
  return '#'+left.map((v,i)=>Math.round(v+(right[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
export function analogStickLevel(axes){
  const x=Number.isFinite(axes?.x)?Math.max(-1,Math.min(1,axes.x)):0;
  const y=Number.isFinite(axes?.y)?Math.max(-1,Math.min(1,axes.y)):0;
  const radius=Math.min(1,Math.hypot(x,y));
  return radius<=.08?0:(radius-.08)/.92;
}
export function controlLevel(entry,values,axes){
  const pressed=clamp(values?.get(entry.control)||0);
  if(entry.stickSide)return Math.max(pressed,analogStickLevel(axes?.[entry.stickSide]));
  if(entry.layer?.role==='trigger')return pressed;
  return pressed>.5?1:0;
}
const materials={
  dualsense:{shell:'#f0f2f4',core:'#202630',control:'#a5b0ba',cap:'#596876',trigger:'#c2ccd6'},
  dualshock4:{shell:'#343a45',core:'#232932',control:'#737f8e',cap:'#3b4551',trigger:'#626f7e'},
  xbox:{shell:'#e3e8ed',core:'#c2cad3',control:'#abb9c5',cap:'#5d6975',trigger:'#c3ced8'},
  nintendo:{shell:'#444d57',core:'#343e4a',control:'#6f7d8b',cap:'#4f5d6b',trigger:'#75818f'},
  gamecube:{shell:'#7774a3',core:'#545276',control:'#a4a0c0',cap:'#5e597e',trigger:'#9792b4'},
  generic:{shell:'#cbd5de',core:'#a9b5c1',control:'#93a2b0',cap:'#596a78',trigger:'#acbac6'},
  steam:{shell:'#414b57',core:'#323b45',control:'#6d7c89',cap:'#4e5b67',trigger:'#7c8b98'}
};
export function lookPalette(id,mode,scene){
  const name=id==='gamecube'?'gamecube':id.startsWith('xbox')?'xbox':
    id.startsWith('joycon')||id==='switch_pro'?'nintendo':
    id.startsWith('steam')?'steam':id.startsWith('dualshock')?'dualshock4':
    id.startsWith('dualsense')?'dualsense':'generic';
  const base=materials[name],ghost=mode==='ghost',light=scene==='light';
  return {
    ...base,ghost,light,
    shellAlpha:ghost?(light?.14:.12):.99,
    coreAlpha:ghost?(light?.20:.17):.96,
    detailAlpha:ghost?.18:.26,
    line:ghost?(light?'#526b80':'#b0c8d7'):(light?'#526577':'#657787'),
    lineAlpha:ghost?(light?.59:.52):.55,
    controlAlpha:ghost?(light?.42:.38):1,
    glyph:ghost?(light?'#536b7f':'#c8d8e3'):'#3d4d5b'
  };
}
const svgNs='http://www.w3.org/2000/svg';
const visibleFill=node=>{
  const value=node.style.getPropertyValue('fill')||node.getAttribute('fill')||'';
  return value.trim().toLowerCase()!=='none'&&value!=='';
};
const visibleStroke=node=>{
  const value=node.style.getPropertyValue('stroke')||node.getAttribute('stroke')||'';
  return value.trim().toLowerCase()!=='none'&&value!=='';
};
function paint(node,name,value){node.style.setProperty(name,String(value),'important');}
function ensureBaseFill(ref,colors){
  const body=ref.bodyShape;
  if(!body)return;
  const drawn=[...body.children].filter(n=>['path','ellipse','rect'].includes(n.localName)&&
    visibleFill(n)&&!n.classList.contains('detail'));
  // Most of the 20 authored SVGs are pure contour artwork. In the solid
  // preview, place a full-path silhouette behind it (never FirstContour).
  // It is an additive preview layer; no original geometry is discarded.
  let silhouette=body.querySelector('[data-exo-polish-silhouette]');
  if(!drawn.length&&!silhouette){
    const source=body.querySelector('#outline-strong');
    if(source?.getAttribute('d')){
      silhouette=document.createElementNS(svgNs,'path');
      silhouette.setAttribute('d',source.getAttribute('d'));
      silhouette.setAttribute('fill-rule','evenodd');
      silhouette.setAttribute('data-exo-polish-silhouette','1');
      silhouette.setAttribute('stroke','none');
      body.insertBefore(silhouette,body.firstChild);
    }
  }
  if(silhouette){
    paint(silhouette,'fill',colors.shell);
    paint(silhouette,'fill-opacity',colors.shellAlpha);
    paint(silhouette,'stroke','none');
  }
}
function ensureDualSenseCore(ref,colors){
  if(ref.layout?.id!=='dualsense'&&ref.layout?.id!=='dualsense_edge')return;
  let core=ref.svg.querySelector('[data-exo-polish-core]');
  if(!core){
    core=document.createElementNS(svgNs,'path');
    // Simple authored material region; independent of the photographed
    // textures and deliberately behind all interactive control groups.
    core.setAttribute('d','M 164 151 C 198 164 233 171 273 171 C 315 171 350 164 381 151 C 386 178 398 202 396 228 C 392 251 370 271 342 275 L 204 275 C 174 271 151 250 148 228 C 147 202 159 177 164 151 Z');
    core.setAttribute('data-exo-polish-core','1');
    core.setAttribute('stroke','none');
    // Insert after body but before buttons and sticks.
    ref.bodyShape?.after(core);
  }
  if(!core)return;
  if(ref.bodyShape?.hasAttribute('mask'))core.setAttribute('mask',ref.bodyShape.getAttribute('mask'));
  paint(core,'fill',colors.core);
  paint(core,'fill-opacity',colors.coreAlpha);
}
export function paintPolished2D(reference,mode,scene,{values=new Map(),left=null,right=null}={}){
  if(!reference?.svg)return;
  if(mode!=='solid'&&mode!=='ghost')throw new TypeError('Unknown 2D look');
  const colors=lookPalette(reference.layout.id,mode,scene);
  // Let the established controller binding code own transforms and cutouts.
  reference.update(values,{left,right});
  ensureBaseFill(reference,colors);
  for(const child of [...(reference.bodyShape?.children||[])]){
    if(child.hasAttribute('data-exo-polish-silhouette'))continue;
    if(!['path','ellipse','rect'].includes(child.localName))continue;
    const detail=child.classList.contains('detail')||child.id==='speaker-grille';
    if(visibleFill(child)){
      paint(child,'fill',colors.shell);
      paint(child,'fill-opacity',detail?colors.detailAlpha:colors.shellAlpha);
    }
    if(visibleStroke(child)){
      paint(child,'stroke',colors.line);
      paint(child,'stroke-opacity',detail?colors.lineAlpha*.4:colors.lineAlpha);
    }
  }
  ensureDualSenseCore(reference,colors);
  for(const entry of reference.controls){
    const group=entry.group;
    const face=entry.stickSide?
      (group.querySelector('[id$="-top"]')||entry.surface):
      (group.querySelector('[id$="-face"]')||entry.surface);
    if(!face)continue;
    // A single face is blended in color/alpha. Never stack a translucent
    // idle tile and a pressed tile, which would cause incorrect alpha.
    if(entry.surface&&entry.surface!==face&&entry.surface.id.endsWith('-pressure')){
      paint(entry.surface,'fill','none');paint(entry.surface,'stroke','none');
    }
    const level=controlLevel(entry,values,{left,right});
    const base=entry.stickSide?colors.cap:
      entry.layer.role==='trigger'?colors.trigger:colors.control;
    paint(face,'fill',mixColor(base,PRESS_WHITE,level));
    paint(face,'fill-opacity',colors.controlAlpha+(1-colors.controlAlpha)*level);
    // Keep one subtle structural edge even at completely white press.
    if(visibleStroke(face)||entry.stickSide){
      paint(face,'stroke',colors.line);
      paint(face,'stroke-opacity',Math.max(colors.lineAlpha,level*.68));
    }
    for(const glyph of group.querySelectorAll('.glyph')){
      const color=level>.55?'#344657':colors.glyph;
      if(visibleFill(glyph))paint(glyph,'fill',color);
      if(visibleStroke(glyph))paint(glyph,'stroke',color);
      paint(glyph,'opacity',colors.ghost?.92:1);
    }
  }
}