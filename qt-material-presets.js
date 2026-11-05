// Qt-portable material comparison: no GPU readbacks, filters, blend modes or
// extra renderer passes. All strokes and fills can be translated to QPainter.
import {styleAt} from './style-mix.js';

export const QT_BLUE = '#4b9fe3';
export const SCENES = Object.freeze(['dark', 'light', 'mixed']);
export const PRESETS = Object.freeze([
  {id:'heritage', name:'01 · Originalton', detail:'Erhält eine modelltypische, vereinfachte Farbpalette.'},
  {id:'graphite', name:'02 · Graphit', detail:'Neutrales Grau mit konzentrierten, dunkleren Innenlinien.'},
  {id:'frost', name:'03 · Frost', detail:'Minimal kühles Grau, wie ein zurückhaltendes Glass-Overlay.'},
  {id:'softfill', name:'04 · Soft Fill', detail:'Ruhige Flächen, deutlich lesbare Idle-Controls.'},
  {id:'ink', name:'05 · Ink Ghost', detail:'Flächen werden stärker reduziert, Vektorkonturen bleiben.'},
  {id:'duotone', name:'06 · Dual-Tone', detail:'Feste dunkle Außen- und helle Innenkontur, ohne Hintergrundabfrage.'},
  {id:'scene', name:'07 · Szenenprofil', detail:'Bekannte Hell-/Dunkel-Profile; kein Pixel-Sampling.'},
  {id:'mono', name:'08 · Entsättigt', detail:'Sättigungsblend mit erhaltenen Helligkeitsunterschieden.'},
]);
const clamp = value => Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):0));
const toHex = value => `#${Math.round(Math.max(0,Math.min(255,value))).toString(16).padStart(2,'0')}`;
export function rgb(hex){
  const s=String(hex).replace('#','');
  if(!/^(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(s))throw Error(`Invalid color: ${hex}`);
  const h=s.length===3?[...s].map(c=>c+c).join(''):s;
  return [0,2,4].map(i=>Number.parseInt(h.slice(i,i+2),16));
}
export function mixColor(a,b,t){
  const x=rgb(a),y=rgb(b),k=clamp(t);
  return x.map((n,i)=>toHex(n+(y[i]-n)*k).slice(1)).reduce((s,v)=>s+v,'#');
}
export function grayColor(color){const [r,g,b]=rgb(color);const l=Math.round(.2126*r+.7152*g+.0722*b);return `#${toHex(l).slice(1).repeat(3)}`;}

// Authored SVGs are mostly white/line art, not calibrated manufacturer materials.
// These approximate identity palettes are deliberately labelled approximations.
export function approximatePalette(id){
  const v=String(id||'').toLowerCase();
  if(v.includes('dualsense')||v.includes('dualshock4'))return {shell:'#e4e7ea',control:'#2e3744',ink:'#39495b'};
  if(v.includes('xbox'))return {shell:'#e2e7e4',control:'#586369',ink:'#364951'};
  if(v.includes('gamecube'))return {shell:'#8c829e',control:'#50535d',ink:'#3e344c'};
  if(v.includes('joycon_left'))return {shell:'#447eaf',control:'#343c46',ink:'#273949'};
  if(v.includes('joycon_right'))return {shell:'#d56053',control:'#343c46',ink:'#502e2d'};
  if(v.includes('joycon'))return {shell:'#8897a3',control:'#3b4a55',ink:'#293946'};
  if(v.includes('steam'))return {shell:'#646e76',control:'#2b3542',ink:'#2b3542'};
  return {shell:'#a9b6c3',control:'#495b6d',ink:'#394d60'};
}

export function materialValues(mix,presetId,sceneId='mixed',modelId='dualsense'){
  const preset=PRESETS.find(x=>x.id===presetId);
  if(!preset)throw Error(`Unknown preset ${presetId}`);
  if(!SCENES.includes(sceneId))throw Error(`Unknown scene ${sceneId}`);
  const t=clamp(mix),look=styleAt(t),palette=approximatePalette(modelId);
  const ghostNeutral='#aeb4b9',ghostCool='#aabecb';
  const cool=['frost','softfill','duotone'].includes(presetId);
  const dest=cool?ghostCool:ghostNeutral;
  let shellColor=mixColor(palette.shell,dest,t);
  let controlColor=mixColor(palette.control,cool?'#8495a1':'#919aa1',t);
  if(presetId==='graphite'){shellColor=mixColor(palette.shell,'#858c93',t);controlColor=mixColor(palette.control,'#657079',t);}
  if(presetId==='mono'){
    shellColor=mixColor(palette.shell,grayColor(palette.shell),t);
    controlColor=mixColor(palette.control,grayColor(palette.control),t);
  }
  if(presetId==='heritage'){
    // Identity deliberately survives part of Ghost instead of turning cyan.
    shellColor=mixColor(palette.shell,ghostNeutral,t*.72);
    controlColor=mixColor(palette.control,ghostNeutral,t*.55);
  }
  let shellAlpha=look.shell;
  let controlAlpha=look.control;
  if(presetId==='softfill'){shellAlpha=clamp(shellAlpha*1.04);controlAlpha=clamp(controlAlpha*1.11);}
  if(presetId==='ink'){shellAlpha=clamp(shellAlpha*(1-.48*t));controlAlpha=clamp(controlAlpha*(1-.23*t));}
  if(presetId==='graphite'){shellAlpha=clamp(shellAlpha*(1-.12*t));}
  if(presetId==='duotone'){shellAlpha=clamp(shellAlpha*(1-.24*t));}
  controlAlpha=Math.max(shellAlpha,controlAlpha);
  let inkColor=sceneId==='dark'?'#e4ebee':sceneId==='light'?'#344658':'#e4e9eb';
  if(presetId==='graphite')inkColor=sceneId==='dark'?'#cdd5d8':'#34424c';
  if(presetId==='frost')inkColor=sceneId==='dark'?'#dae9f2':sceneId==='light'?'#3f5868':'#d7e7f0';
  if(presetId==='scene')inkColor=sceneId==='dark'?'#f0f4f7':sceneId==='light'?'#2b3946':'#a9b1ba';
  const lineAlpha=clamp((presetId==='ink'?.86:presetId==='softfill'?.68:.76)+.12*t);
  const activeAlpha=clamp(Math.max(controlAlpha,.46+.34*(1-t)));
  const dual=presetId==='duotone';
  return Object.freeze({mix:t,presetId,sceneId,modelId,shellColor,controlColor,inkColor,blue:QT_BLUE,
    shellAlpha,controlAlpha,lineAlpha,activeAlpha,
    activeInk:sceneId==='dark'?'#d9f0ff':'#0e4370',
    dual,dualOuter:'#18232e',dualInner:'#eef4f7',
    controlEdgeOpacity:clamp(Math.max(.40,lineAlpha-.08)),
    // Crisp vector strokes are a Qt-portable *appearance* of glow, not blur.
    pressOuterOpacity:clamp(.09+.11*t),pressInnerOpacity:clamp(.55+.17*t)});
}

export function isPortableFeature(name){return ['solid-fill','solid-stroke','opacity','alpha-over','color-interpolation','svg-mask','translate','scale','path-stroke','dash'].includes(name);}
