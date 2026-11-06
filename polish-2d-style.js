// Browser-only 2D visual polish. All rendered surfaces and glyphs originate
// in the existing authored SVGs; input mapping and moving transforms stay owned
// by ControllerReference.
export const PRESS_WHITE='#ffffff';
const svgNs='http://www.w3.org/2000/svg';
const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(Number(n))?Number(n):0));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function mixColor(a,b,amount){
  const t=clamp(amount),left=rgb(a),right=rgb(b);
  return '#'+left.map((v,i)=>Math.round(v+(right[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
export function analogStickLevel(axes){
  const x=Number.isFinite(axes?.x)?Math.max(-1,Math.min(1,axes.x)):0;
  const y=Number.isFinite(axes?.y)?Math.max(-1,Math.min(1,axes.y)):0;
  // The manual slider is an exact percentage; the live gamepad has its own
  // input deadzone. Never add click pressure to the movement level.
  return Math.min(1,Math.hypot(x,y));
}
export function controlLevel(entry,values,axes){
  const pressed=clamp(values?.get(entry.control)||0);
  if(entry.stickSide)return analogStickLevel(axes?.[entry.stickSide]);
  if(entry.layer?.role==='trigger')return pressed;
  return pressed>.5?1:0;
}
export function stickFeedbackLevels(movement,clicked,variant='ring'){
  if(!['ring','center'].includes(variant))throw new TypeError('Unknown stick feedback');
  const amount=clamp(movement),click=Boolean(clicked);
  return variant==='ring'
    ?{ring:amount,center:click?1:0}
    :{ring:click?1:0,center:amount};
}

// Material distinction stays with the model's actual shell. Controls use the
// same neutral family for every model and BOTH available colorways.
const shells={
  dualsense:{light:['#f0f2f4','#242c36'],dark:['#333c47','#202934']},
  dualshock4:{light:['#e6ebef','#b8c3cd'],dark:['#353f4a','#252f39']},
  xbox:{light:['#e4eaf0','#c3ced6'],dark:['#313b47','#28333f']},
  nintendo:{light:['#d8e0e7','#c4cfd8'],dark:['#444f5b','#353f4b']},
  gamecube:{light:['#c3bfd7','#a6a0c6'],dark:['#7774a3','#565276']},
  generic:{light:['#ced9e2','#b5c4d0'],dark:['#404d59','#303e4a']},
  steam:{light:['#d8e0e6','#b7c4cf'],dark:['#414c58','#303c49']}
};
const standard={dualsense:'light',dualshock4:'light',xbox:'dark',
  nintendo:'dark',gamecube:'dark',generic:'light',steam:'dark'};
function family(id){
  if(id==='gamecube')return 'gamecube';
  if(id.startsWith('xbox'))return 'xbox';
  if(id.startsWith('joycon')||id==='switch_pro')return 'nintendo';
  if(id.startsWith('steam'))return 'steam';
  if(id.startsWith('dualshock'))return 'dualshock4';
  if(id.startsWith('dualsense'))return 'dualsense';
  return 'generic';
}
export function lookPalette(id,mode,scene,colorway='auto'){
  if(!['auto','light','dark'].includes(colorway))throw new TypeError('Unknown preview colorway');
  if(!['solid','ghost'].includes(mode))throw new TypeError('Unknown 2D look');
  const model=family(id),chosen=colorway==='auto'?standard[model]:colorway;
  const [shell,core]=shells[model][chosen];
  const ghost=mode==='ghost',light=scene==='light';
  const control=chosen==='light'?'#abb9c7':'#99a9b7';
  return {
    shell,core,control,cap:mixColor(control,'#8093a3',.12),
    trigger:mixColor(control,'#bfcbd5',.09),
    ghost,light,colorway:chosen,
    shellAlpha:ghost?(light?.14:.12):.99,
    coreAlpha:ghost?(light?.20:.17):.96,
    detailAlpha:ghost?.18:.26,
    line:light?'#4b6377':'#bdd0de',
    lineAlpha:ghost?(light?.70:.65):.83,
    controlAlpha:ghost?(light?.73:.77):1,
    // A single stable glyph shade, including Share/Options press. The controls
    // behind it are deliberately bright enough on both scene types.
    glyph:'#25394b',
    pressedOutline:'#405568'
  };
}
const visibleFill=node=>{
  const value=node.style.getPropertyValue('fill')||node.getAttribute('fill')||'';
  return value.trim().toLowerCase()!=='none'&&value!=='';
};
const visibleStroke=node=>{
  const value=node.style.getPropertyValue('stroke')||node.getAttribute('stroke')||'';
  return value.trim().toLowerCase()!=='none'&&value!=='';
};
function paint(node,name,value){node.style.setProperty(name,String(value),'important');}
function ensureBaseFill(reference,colors){
  const body=reference.bodyShape;
  if(!body)return;
  const authored=[...body.children].filter(n=>['path','ellipse','rect'].includes(n.localName)&&
    visibleFill(n)&&!n.classList.contains('detail')&&!n.hasAttribute('data-exo-polish-silhouette'));
  // A contour-only SVG can use its OWN existing outline path as the source
  // for a non-animated background silhouette. No new authored contours.
  let silhouette=body.querySelector('[data-exo-polish-silhouette]');
  if(!authored.length&&!silhouette){
    const source=body.querySelector('[id="outline-strong"],[id$="-outline-strong"]');
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
// Use the TWO authored, moving stick ellipses. A static body socket never
// participates. The mask cuts the exact source-authored center out of the
// source-authored outer ellipse, preventing stacked semi-transparent alphas.
function ensureStickRingMask(reference,outer,center){
  if(!outer||!center)return;
  const id=outer.id+'-polish-ring-mask';
  if(outer.getAttribute('mask')===`url(#${id})`)return;
  let defs=reference.svg.querySelector('defs');
  if(!defs){defs=document.createElementNS(svgNs,'defs');reference.svg.prepend(defs);}
  if(!defs.querySelector('[id="'+CSS.escape(id)+'"]')){
    const bounds=outer.getBBox(),pad=Math.max(bounds.width,bounds.height)*.12;
    const mask=document.createElementNS(svgNs,'mask');
    for(const [key,value] of Object.entries({
      id,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',
      x:bounds.x-pad,y:bounds.y-pad,
      width:bounds.width+pad*2,height:bounds.height+pad*2
    }))mask.setAttribute(key,String(value));
    const copy=(source,fill)=>{
      const shape=source.cloneNode(false);
      shape.removeAttribute('id');shape.removeAttribute('class');
      shape.removeAttribute('style');shape.removeAttribute('mask');
      shape.setAttribute('fill',fill);shape.setAttribute('stroke','none');
      return shape;
    };
    mask.append(copy(outer,'white'),copy(center,'black'));
    defs.append(mask);
  }
  outer.setAttribute('mask',`url(#${id})`);
}
function paintStick(reference,entry,colors,values,axes,variant){
  const group=entry.group;
  const outer=group.querySelector('[id$="-outline"]');
  const center=group.querySelector('[id$="-top"]');
  const pressure=group.querySelector('[id$="-pressure"]');
  if(pressure){paint(pressure,'fill','none');paint(pressure,'stroke','none');}
  if(!outer)return;
  const movement=analogStickLevel(axes?.[entry.stickSide]);
  const clicked=clamp(values?.get(entry.control)||0)>.5;
  const levels=stickFeedbackLevels(movement,clicked,variant);
  if(center)ensureStickRingMask(reference,outer,center);
  const setPart=(node,base,intensity)=>{
    if(!node)return;
    paint(node,'fill',mixColor(base,PRESS_WHITE,intensity));
    paint(node,'fill-opacity',colors.controlAlpha+(1-colors.controlAlpha)*intensity);
    paint(node,'stroke',intensity>=.65?colors.pressedOutline:colors.line);
    paint(node,'stroke-opacity',intensity>=.65?1:colors.lineAlpha);
  };
  setPart(outer,colors.cap,levels.ring);
  if(center){
    setPart(center,colors.control,levels.center);
    // The authored center stroke remains visible when both regions are white.
  }else{
    // A few unusual source SVGs (e.g. the GameCube C-stick) do not author a
    // separate top. Never synthesize one: use the authored rim for feedback.
    const fallback=Math.max(levels.ring,levels.center);
    setPart(outer,colors.cap,fallback);
  }
  // Nothing touches the unmoving socket in the body group.
}
function paintDpad(entry,colors,values){
  const group=entry.group;
  const face=group.querySelector('[id$="-cross"],[id$="-surface"],[id$="-face"]')||entry.surface;
  if(!face)return;
  const level=Math.max(...['up','down','left','right'].map(key=>clamp(values?.get(key)||0)))>.5?1:0;
  paint(face,'fill',mixColor(colors.control,PRESS_WHITE,level));
  paint(face,'fill-opacity',colors.controlAlpha+(1-colors.controlAlpha)*level);
  paint(face,'stroke',level?colors.pressedOutline:colors.line);
  paint(face,'stroke-opacity',level?1:colors.lineAlpha);
  // Keep the original dish distinct from the moving/pressed cross.
  const dish=group.querySelector('[id$="-dish"]');
  if(dish){
    paint(dish,'fill','none');paint(dish,'stroke',colors.line);
    paint(dish,'stroke-opacity',colors.lineAlpha*.64);
  }
}
function paintGlyphs(entry,colors,showFaceSymbols){
  const isFace=['b1','b2','b3','b4'].includes(entry.control)&&entry.layer.role==='button';
  const face=entry.group.querySelector('[id$="-face"]');
  const glyphs=[...entry.group.querySelectorAll('.glyph')].filter(node=>!node.closest('defs,mask'));
  // DualSense Share/Options draw their glyph BEFORE the face in the source SVG.
  // Move only those authored glyph nodes in front; never duplicate a symbol.
  if(face&&glyphs.some(node=>Boolean(node.compareDocumentPosition(face)&Node.DOCUMENT_POSITION_FOLLOWING)))
    for(const glyph of glyphs)entry.group.appendChild(glyph);
  for(const glyph of glyphs){
    if(isFace){
      if(showFaceSymbols)glyph.style.removeProperty('display');
      else paint(glyph,'display','none');
    }
    if(visibleFill(glyph))paint(glyph,'fill',colors.glyph);
    if(visibleStroke(glyph))paint(glyph,'stroke',colors.glyph);
    paint(glyph,'opacity','1');
  }
}
function paintSilhouetteGlow(reference,amount){
  const outer=reference.svg.querySelector('[id="outline-strong"],[id$="-outline-strong"]');
  if(!outer)return;
  const strength=clamp(amount);
  if(strength===0){outer.style.removeProperty('filter');return;}
  // A CSS/SVG silhouette filter: no per-frame raster, button bloom or hard
  // extra outline. Zero removes the filter completely.
  const near=(1.3+strength*2.2).toFixed(2);
  const far=(3+strength*5).toFixed(2);
  const alpha=(strength*.64).toFixed(3),soft=(strength*.34).toFixed(3);
  paint(outer,'filter',
    `drop-shadow(0 0 ${near}px rgba(236,246,255,${alpha})) drop-shadow(0 0 ${far}px rgba(212,233,252,${soft}))`);
}
export function paintPolished2D(reference,mode,scene,{
  values=new Map(),left=null,right=null,colorway='auto',
  stickFeedback='ring',showFaceSymbols=true,glow=0
}={}){
  if(!reference?.svg)return;
  const colors=lookPalette(reference.layout.id,mode,scene,colorway);
  // Existing binding owns the transform, mask cutouts and live input mapping.
  reference.update(values,{left,right});
  ensureBaseFill(reference,colors);
  for(const child of [...(reference.bodyShape?.children||[])]){
    if(child.hasAttribute('data-exo-polish-silhouette'))continue;
    if(!['path','ellipse','rect'].includes(child.localName))continue;
    const detail=child.classList.contains('detail')||child.id.endsWith('speaker-grille');
    if(visibleFill(child)){
      paint(child,'fill',colors.shell);
      paint(child,'fill-opacity',detail?colors.detailAlpha:colors.shellAlpha);
    }
    if(visibleStroke(child)){
      paint(child,'stroke',colors.line);
      paint(child,'stroke-opacity',detail?colors.lineAlpha*.4:colors.lineAlpha);
    }
  }
  for(const entry of reference.controls){
    if(entry.stickSide){
      paintStick(reference,entry,colors,values,{left,right},stickFeedback);
      paintGlyphs(entry,colors,showFaceSymbols);
      continue;
    }
    if(entry.layer.role==='directional-pad'){
      paintDpad(entry,colors,values);
      paintGlyphs(entry,colors,showFaceSymbols);
      continue;
    }
    const group=entry.group;
    // Trigger/bumper mappings often bind an invisible "-pressure" path,
    // while the REAL visible authored face is the following sibling.
    const pressure=entry.surface?.id.endsWith('-pressure')?entry.surface:null;
    const face=group.querySelector('[id$="-face"],[id$="-outline"]')||
      (pressure?[...group.children].find(node=>
        ['path','ellipse','rect'].includes(node.localName)&&node!==pressure&&
        !node.classList.contains('glyph')):null)||entry.surface;
    if(!face)continue;
    if(entry.surface&&entry.surface!==face&&entry.surface.id.endsWith('-pressure')){
      paint(entry.surface,'fill','none');paint(entry.surface,'stroke','none');
    }
    const level=controlLevel(entry,values,{left,right});
    const base=entry.layer.role==='trigger'?colors.trigger:colors.control;
    paint(face,'fill',mixColor(base,PRESS_WHITE,level));
    paint(face,'fill-opacity',colors.controlAlpha+(1-colors.controlAlpha)*level);
    // Neutral, contrasting source contours survive even completely white faces.
    if(visibleStroke(face)||face.id.endsWith('-face')){
      paint(face,'stroke',level?colors.pressedOutline:colors.line);
      paint(face,'stroke-opacity',level?1:colors.lineAlpha);
    }
    paintGlyphs(entry,colors,showFaceSymbols);
  }
  paintSilhouetteGlow(reference,glow);
}
