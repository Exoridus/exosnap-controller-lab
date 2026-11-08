// Browser-only 2D visual polish. All rendered surfaces and glyphs originate
// in the existing authored SVGs; input mapping and moving transforms stay owned
// by ControllerReference.
export const PRESS_WHITE='#ffffff';
// One source of truth for all 2D control materials and glyphs. Backdrops and
// controller identity must NEVER change these values in Ghost.
export const CONTROL_PALETTE=Object.freeze({
  neutralFill:'#a8b9c7',neutralAlpha:.26,
  activeFill:PRESS_WHITE,activeAlpha:.40,
  border:'#667d90',borderAlpha:.94,
  activeBorderAlpha:.9,
  glyph:'#8198a9',glyphAlpha:.9
});
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
  return {
    shell,core,control:CONTROL_PALETTE.neutralFill,
    cap:CONTROL_PALETTE.neutralFill,trigger:CONTROL_PALETTE.neutralFill,
    ghost,light,colorway:chosen,
    shellAlpha:ghost?0:.99,coreAlpha:ghost?0:.96,
    detailAlpha:ghost?0:.26,
    // Only the outside silhouette is background-dependent. Controls are not.
    line:ghost?'#718b9d':'#50687b',
    lineAlpha:ghost?.91:.86,
    controlAlpha:ghost?CONTROL_PALETTE.neutralAlpha:.96,
    activeAlpha:ghost?CONTROL_PALETTE.activeAlpha:.98,
    controlStroke:CONTROL_PALETTE.border,
    controlStrokeAlpha:CONTROL_PALETTE.borderAlpha,
    // Solid button legends need high contrast against opaque pale controls.
    // Ghost retains the existing single neutral palette.
    glyph:ghost?CONTROL_PALETTE.glyph:'#203446',
    glyphAlpha:ghost?CONTROL_PALETTE.glyphAlpha:1,
    pressedOutline:CONTROL_PALETTE.border
  };
}
// The review compares only silhouette treatments. All three options have
// identical zero-fill housings and neutral input surfaces, so no palette or
// geometry changes can masquerade as an edge-light improvement.
export const GHOST_REVIEW_LOOKS=Object.freeze([
  Object.freeze({key:'pure',name:'A · Pure Outline',summary:'Nur die originalen Konturen',light:0,shadow:0}),
  Object.freeze({key:'soft',name:'B · Soft Rim',summary:'Sanftes Licht, kaum Schatten',light:.48,shadow:.08}),
  Object.freeze({key:'shadow',name:'C · Quiet Shadow',summary:'Wenig Licht, klarere Form',light:.02,shadow:.78})
]);
export function ghostReviewSettings(key,scene){
  const option=GHOST_REVIEW_LOOKS.find(v=>v.key===key);
  if(!option)throw new TypeError('Unknown Ghost review look');
  if(!['dark','light','mixed'].includes(scene))throw new TypeError('Unknown review background');
  return Object.freeze({
    ...option,reviewLook:key,edgeLight:option.light,edgeShadow:option.shadow,
    // Identical, shared materials for every control on every background.
    control:CONTROL_PALETTE.neutralFill,
    cap:CONTROL_PALETTE.neutralFill,trigger:CONTROL_PALETTE.neutralFill,
    controlAlpha:CONTROL_PALETTE.neutralAlpha,
    activeAlpha:CONTROL_PALETTE.activeAlpha,
    controlStroke:CONTROL_PALETTE.border,
    controlStrokeAlpha:CONTROL_PALETTE.borderAlpha,
    shellAlpha:0,coreAlpha:0,detailAlpha:0,
    line:'#718b9d',
    lineAlpha:.91,
    glyph:CONTROL_PALETTE.glyph,glyphAlpha:CONTROL_PALETTE.glyphAlpha,
    pressedOutline:CONTROL_PALETTE.border
  });
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
// Every moving or pressed control goes through this one alpha-safe transition.
// The selected white stays white in the SVG paint; opacity is intentionally
// limited to avoid hiding the gameplay underneath the overlay.
export function controlSurfaceState(colors,level){
  const t=clamp(level);
  return {
    fill:mixColor(colors.control,PRESS_WHITE,t),
    alpha:colors.controlAlpha+(colors.activeAlpha-colors.controlAlpha)*t,
    stroke:mixColor(colors.controlStroke,PRESS_WHITE,t),
    strokeAlpha:colors.controlStrokeAlpha+(CONTROL_PALETTE.activeBorderAlpha-colors.controlStrokeAlpha)*t
  };
}
// Shared, cached browser-only shadow behind ACTIVE control edges. It is
// disabled at neutral and does not alter any SVG geometry or control fill.
function activeEdgeFilter(node,level){
  if(!node?.ownerSVGElement)return;
  if(level<=.02){node.style.removeProperty('filter');return;}
  const svg=node.ownerSVGElement;
  let defs=svg.querySelector('defs');
  if(!defs){defs=document.createElementNS(svgNs,'defs');svg.insertBefore(defs,svg.firstChild);}
  const source=svg.querySelector('[id="outline-strong"],[id$="-outline-strong"]');
  const filterId=(source?.id||svg.id||'exo-controller')+'-active-edge';
  let filter=defs.querySelector('[data-exo-active-edge]');
  const viewWidth=svg.viewBox.baseVal.width||480;
  const renderedWidth=svg.getBoundingClientRect().width||320;
  const unit=(viewWidth/renderedWidth).toFixed(4);
  if(!filter){
    filter=document.createElementNS(svgNs,'filter');
    filter.setAttribute('data-exo-active-edge','1');
    filter.setAttribute('id',filterId);
    for(const [k,v] of Object.entries({
      x:'-35%',y:'-35%',width:'170%',height:'170%',
      filterUnits:'objectBoundingBox',primitiveUnits:'userSpaceOnUse',
      'color-interpolation-filters':'sRGB'
    }))filter.setAttribute(k,v);
    defs.append(filter);
  }
  if(filter.getAttribute('data-unit')!==unit){
    const create=(tag,attributes)=>{
      const result=document.createElementNS(svgNs,tag);
      for(const [k,v] of Object.entries(attributes))result.setAttribute(k,String(v));
      return result;
    };
    const normalized=create('feComponentTransfer',{in:'SourceAlpha',result:'full-alpha'});
    normalized.append(create('feFuncA',{type:'linear',slope:1.70,intercept:0}));
    const blur=create('feGaussianBlur',{in:'full-alpha',stdDeviation:(Number(unit)*.95).toFixed(3),result:'blur'});
    const outside=create('feComposite',{in:'blur',in2:'SourceAlpha',operator:'out',result:'outside'});
    const ink=create('feFlood',{'flood-color':'#07121d','flood-opacity':'.58',result:'ink'});
    const shade=create('feComposite',{in:'ink',in2:'outside',operator:'in',result:'shade'});
    const merge=create('feMerge',{});
    merge.append(create('feMergeNode',{in:'shade'}),create('feMergeNode',{in:'SourceGraphic'}));
    filter.replaceChildren(normalized,blur,outside,ink,shade,merge);
    filter.setAttribute('data-unit',unit);
  }
  paint(node,'filter','url(#'+filterId+')');
}
function paintControl(node,colors,level,{fill=true,stroke=true}={}){
  if(!node)return;
  const state=controlSurfaceState(colors,level);
  if(fill)node.setAttribute('data-exo-visible-control-fill','1');
  else node.removeAttribute('data-exo-visible-control-fill');
  paint(node,'fill',fill?state.fill:'none');
  paint(node,'fill-opacity',fill?state.alpha:0);
  if(stroke){
    paint(node,'stroke',state.stroke);
    paint(node,'stroke-opacity',String(state.strokeAlpha));
  }else paint(node,'stroke','none');
  activeEdgeFilter(node,level);
}
// The authored source may contain face paths, visible outlines, and unused
// pressure placeholders in different nesting arrangements. Pick real filled
// surfaces semantically, and recolor EVERY other visible non-glyph shape as
// one consistent structural outline. This must include nested SVG groups.
function authoredFill(node){
  const original=node.getAttribute('data-exo-authored-fill');
  if(original!==null)return original==='true';
  const inline=node.getAttribute('style')||'';
  const match=inline.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  const paint=match?match[1].trim():(node.getAttribute('fill')||'');
  const enabled=paint!==''&&paint.toLowerCase()!=='none';
  node.setAttribute('data-exo-authored-fill',String(enabled));
  return enabled;
}
function controlGeometry(group){
  return [...group.querySelectorAll('path,ellipse,rect,circle,polygon')].filter(node=>
    !node.closest('defs,mask,clipPath')&&!node.classList.contains('glyph')&&
    !node.closest('.glyph'));
}
function getOrCreateXboxBumperClip(entry,pressure){
  // The authored Xbox L1/R1 pressure paths contain their button lobe AND
  // thin wiring/rail continuations. Limit painted material to the physical
  // lobe; the original source strokes stay intact above it.
  const id=entry.layer?.id;
  if(!/^xbox_(?:series|one)$/.test(entry.layoutId||'') ||
      !['btn-l1','btn-r1'].includes(id))return null;
  const svg=pressure.ownerSVGElement;
  let defs=svg.querySelector('defs');
  if(!defs){defs=document.createElementNS(svgNs,'defs');svg.insertBefore(defs,svg.firstChild);}
  let clip=defs.querySelector('[data-exo-bumper-clip="'+id+'"]');
  if(!clip){
    const bbox=pressure.getBBox();
    const left=id==='btn-l1';
    const rect=document.createElementNS(svgNs,'rect');
    const capFraction=.63;
    const x=left?bbox.x-2:bbox.x+bbox.width*(1-capFraction);
    rect.setAttribute('x',String(x));
    rect.setAttribute('y',String(bbox.y-2));
    rect.setAttribute('width',String(bbox.width*capFraction+2));
    rect.setAttribute('height',String(bbox.height+4));
    clip=document.createElementNS(svgNs,'clipPath');
    clip.setAttribute('clipPathUnits','userSpaceOnUse');
    clip.setAttribute('id',pressure.id+'-material-clip');
    clip.setAttribute('data-exo-bumper-clip',id);
    clip.appendChild(rect);
    defs.appendChild(clip);
  }
  return 'url(#'+clip.id+')';
}
function paintControlGroup(entry,colors,level){
  const {group,layer}=entry;
  const shapes=controlGeometry(group);
  const pressure=shapes.find(node=>node.id.endsWith('-pressure')||
    node.classList.contains('press-surface'));
  const trigger=layer.role==='trigger';
  for(const node of shapes){
    // The author-provided -pressure path is the ACTUAL closed control area
    // for R1/L1/L2/R2. The accompanying path is often ONLY a decorative,
    // OPEN outline: filling that path creates a wedge while leaving the
    // actual button dark. Always color the authored pressure geometry.
    if(pressure){
      if(node===pressure){
        paintControl(node,colors,level,{stroke:shapes.length===1});
        const clip=getOrCreateXboxBumperClip(entry,node);
        if(clip)paint(node,'clip-path',clip);
      }
      else paintControl(node,colors,level,{fill:false});
      continue;
    }
    // For controls without pressure geometry (Share/Options/PS), use the
    // authored face or its real filled source. Preserve outline-only paths.
    const identity=node.id||'';
    const surface=authoredFill(node) ||
      /(?:-face|-surface)$/.test(identity) || identity==='home-logo';
    paintControl(node,colors,level,{fill:surface});
  }
}

function ensureBaseFill(reference,colors){
  const body=reference.bodyShape;
  if(!body)return;
  let silhouette=body.querySelector('[data-exo-polish-silhouette]');
  if(colors.ghost){
    // The same source outline is retained for both looks, but Ghost NEVER
    // has an opaque housing fallback – only the authored line is rendered.
    if(silhouette){paint(silhouette,'fill','none');paint(silhouette,'fill-opacity','0');}
    return;
  }
  if(!silhouette){
    const source=body.querySelector('[id="outline-strong"],[id$="-outline-strong"]');
    if(!source?.getAttribute('d'))return;
    silhouette=document.createElementNS(svgNs,'path');
    // Use every authored subpath, including holes. Earlier FirstContour
    // truncation lost them. This is a new background paint, not new geometry.
    silhouette.setAttribute('d',source.getAttribute('d'));
    silhouette.setAttribute('fill-rule','evenodd');
    silhouette.setAttribute('data-exo-polish-silhouette','1');
    silhouette.setAttribute('stroke','none');
    silhouette.setAttribute('pointer-events','none');
    body.insertBefore(silhouette,body.firstChild);
  }
  paint(silhouette,'fill',colors.shell);
  paint(silhouette,'fill-opacity',colors.shellAlpha);
  paint(silhouette,'stroke','none');
}
// The source SVG already contains a movable rim and center. Never apply a
// second ring mask: getBBox() does not include authored ellipse transforms,
// so a user-space mask clipped off parts of the cap and produced crescents.
// Reuse the original two ellipses directly; do not touch the static socket.
function paintStick(reference,entry,colors,values,axes,variant){
  const group=entry.group;
  const outer=group.querySelector('[id$="-outline"]');
  const center=group.querySelector('[id$="-top"]');
  const pressure=group.querySelector('[id$="-pressure"]');
  // The static socket is part of the body and never becomes an input surface.
  if(pressure){paint(pressure,'fill','none');paint(pressure,'stroke','none');}
  if(!outer)return;
  const movement=analogStickLevel(axes?.[entry.stickSide]);
  const clicked=clamp(values?.get(entry.control)||0)>.5;
  const levels=stickFeedbackLevels(movement,clicked,variant);
  const ring=center?levels.ring:Math.max(levels.ring,levels.center);
  // Solid: the moving cap's annulus is a real filled material, never a hole
  // showing the game. Ghost remains outline-based, with no double alpha layer.
  // The smaller source-authored center covers the middle in Solid.
  const solid=!colors.ghost;
  paint(outer,'fill',solid?mixColor(colors.control,PRESS_WHITE,ring):'none');
  paint(outer,'fill-opacity',String(solid?
    colors.controlAlpha+(colors.activeAlpha-colors.controlAlpha)*ring:0));
  // The Solid annulus has one constant dark boundary even when its moving
  // material turns white. No extra graphic ring is created.
  paint(outer,'stroke',solid?colors.controlStroke:mixColor(colors.controlStroke,PRESS_WHITE,ring));
  activeEdgeFilter(outer,ring);
  paint(outer,'stroke-opacity',
    String(colors.controlStrokeAlpha+(CONTROL_PALETTE.activeBorderAlpha-colors.controlStrokeAlpha)*ring));
  if(center){
    const level=levels.center;
    paintControl(center,colors,level);
    // Preserve a dark existing center boundary during white L3/R3.
    paint(center,'stroke',colors.controlStroke);
    paint(center,'stroke-opacity',String(colors.controlStrokeAlpha));
    // Keep the exact source cap boundary visible, including during white L3.
    const attr='data-exo-authored-stroke-width';
    if(!center.hasAttribute(attr)){
      const original=parseFloat(center.style.getPropertyValue('stroke-width')||
        center.getAttribute('stroke-width')||'1');
      center.setAttribute(attr,String(Number.isFinite(original)&&original>0?original:1));
    }
    const original=Number(center.getAttribute(attr));
    const viewWidth=reference.svg.viewBox.baseVal.width||480;
    const stageWidth=reference.container?.clientWidth||320;
    const minPx=level>.8?1.30:.90;
    paint(center,'stroke-width',String(Math.max(original,(viewWidth/stageWidth)*minPx)));
  }
}
function paintDpad(entry,colors,values){
  const group=entry.group;
  const level=Math.max(...['up','down','left','right'].map(key=>clamp(values?.get(key)||0)))>.5?1:0;
  // The authored D-pad may have several filled elements (Switch/Generic),
  // not just one -surface path. One material across all non-glyph parts.
  paintControlGroup(entry,colors,level);
  const dish=group.querySelector('[id$="-dish"]');
  if(dish)paintControl(dish,colors,0,{fill:false});
}
function paintGlyphs(entry,colors,showFaceSymbols){
  const isFace=['b1','b2','b3','b4'].includes(entry.control)&&entry.layer.role==='button';
  const face=entry.group.querySelector('[id$="-face"]');
  const glyphs=[...entry.group.querySelectorAll('.glyph')].filter(node=>!node.closest('defs,mask'));
  // Keep authored Share/Options glyphs ABOVE their surfaces.
  if(face&&glyphs.some(node=>Boolean(node.compareDocumentPosition(face)&Node.DOCUMENT_POSITION_FOLLOWING)))
    for(const glyph of glyphs)entry.group.appendChild(glyph);
  for(const glyph of glyphs){
    if(isFace){
      if(showFaceSymbols)glyph.style.removeProperty('display');
      else paint(glyph,'display','none');
    }
    // One exact glyph color/alpha for all backgrounds and all input states.
    // Never invert or darken the symbol just because its control is pressed.
    if(visibleFill(glyph))paint(glyph,'fill',colors.glyph);
    if(visibleStroke(glyph))paint(glyph,'stroke',colors.glyph);
    paint(glyph,'opacity',String(colors.glyphAlpha));
  }
}
// 2D cannot reproduce v25/26's angle-dependent 3D Fresnel shader. Instead,
// sculpt ONLY the existing source-authored outer silhouette. Light is a soft
// exterior rim; shadow is composited into the existing line's alpha, never a
// dark outer halo or a second hard SVG outline. Glyphs and controls are not
// filtered. Scene weighting keeps the same two user sliders useful everywhere.
// Backgrounds are TEST SCENES, not separate product profiles. In the native
// compositor the game pixels are unknown; identical settings must survive all.
const FIXED_EDGE_SCENE=Object.freeze({
  light:.62,shadow:1,lightColor:'#eaf4fc',shadowColor:'#07121d'
});
const EDGE_SCENES=Object.freeze({
  dark:FIXED_EDGE_SCENE,light:FIXED_EDGE_SCENE,mixed:FIXED_EDGE_SCENE
});
export function edgeReliefProfile(mode,scene,edgeLight=0,edgeShadow=0){
  if(!['solid','ghost'].includes(mode))throw new TypeError('Unknown 2D look');
  if(!Object.hasOwn(EDGE_SCENES,scene))throw new TypeError('Unknown background');
  const p=EDGE_SCENES[scene];
  return {
    light:mode==='ghost'?clamp(edgeLight)*p.light:0,
    shadow:mode==='ghost'?clamp(edgeShadow)*p.shadow:0,
    lightColor:p.lightColor,shadowColor:p.shadowColor
  };
}
function filterNode(name,attrs={}){
  const node=document.createElementNS(svgNs,name);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  return node;
}
function paintEdgeRelief(reference,mode,scene,edgeLight,edgeShadow){
  const outline=reference.svg.querySelector('[id="outline-strong"],[id$="-outline-strong"]');
  if(!outline)return;
  const p=edgeReliefProfile(mode,scene,edgeLight,edgeShadow);
  const remove=()=>{
    outline.style.removeProperty('filter');
    reference.edgeReliefFilter?.remove();
    reference.edgeReliefFilter=null;
    reference.edgeReliefKey=null;
  };
  // Absolutely no filter or offscreen intermediate when both sliders are 0.
  if(p.light===0&&p.shadow===0){remove();return;}
  const viewWidth=reference.svg.viewBox.baseVal.width||480;
  const panelWidth=reference.container?.clientWidth||480;
  const unit=viewWidth/panelWidth;
  const key=[p.light,p.shadow,p.lightColor,p.shadowColor,unit].join('|');
  if(reference.edgeReliefKey===key&&reference.edgeReliefFilter?.isConnected)return;
  let defs=reference.svg.querySelector('defs');
  if(!defs){defs=filterNode('defs');reference.svg.insertBefore(defs,reference.svg.firstChild);}
  let filter=reference.edgeReliefFilter;
  const id=outline.id+'-edge-relief';
  if(!filter){
    filter=filterNode('filter',{
      id,x:'-8%',y:'-8%',width:'116%',height:'116%',
      filterUnits:'objectBoundingBox',primitiveUnits:'userSpaceOnUse',
      'color-interpolation-filters':'sRGB',
      'data-exo-edge-relief':'1'
    });
    defs.append(filter);
    reference.edgeReliefFilter=filter;
  }
  const children=[];
  const parts=[];
  const add=(name,attrs)=>children.push(filterNode(name,attrs));
  if(p.light>0){
    // Exterior-only soft light; SourceAlpha belongs exclusively to the
    // original outer contour, never to inner face legends or sticks.
    add('feGaussianBlur',{in:'SourceAlpha',stdDeviation:(unit*(1.2+p.light*1.5)).toFixed(3),result:'light-blur'});
    add('feOffset',{in:'light-blur',dx:0,dy:(-unit*.55).toFixed(3),result:'light-offset'});
    add('feComposite',{in:'light-offset',in2:'SourceAlpha',operator:'out',result:'light-exterior'});
    add('feFlood',{'flood-color':p.lightColor,'flood-opacity':(p.light*.82).toFixed(3),result:'light-tint'});
    add('feComposite',{in:'light-tint',in2:'light-exterior',operator:'in',result:'edge-light'});
    parts.push('edge-light');
  }
  if(p.shadow>0){
    // Dark counter-edge lives WITHIN the original line. Unlike another
    // drop-shadow it never creates a duplicate dark outside silhouette.
    add('feGaussianBlur',{in:'SourceAlpha',stdDeviation:(unit*(.55+p.shadow*.95)).toFixed(3),result:'shadow-blur'});
    add('feOffset',{in:'shadow-blur',dx:0,dy:(unit*(.45+p.shadow*.6)).toFixed(3),result:'shadow-offset'});
    add('feComposite',{in:'shadow-offset',in2:'SourceAlpha',operator:'out',result:'shadow-on-edge'});
    add('feFlood',{'flood-color':p.shadowColor,'flood-opacity':(p.shadow*.78).toFixed(3),result:'shadow-tint'});
    add('feComposite',{in:'shadow-tint',in2:'shadow-on-edge',operator:'in',result:'edge-shadow'});
  }
  const merge=filterNode('feMerge');
  if(p.shadow>0)merge.append(filterNode('feMergeNode',{in:'edge-shadow'}));
  for(const part of parts)merge.append(filterNode('feMergeNode',{in:part}));
  merge.append(filterNode('feMergeNode',{in:'SourceGraphic'}));
  filter.replaceChildren(...children,merge);
  paint(outline,'filter','url(#'+id+')');
  reference.edgeReliefKey=key;
}
export function paintPolished2D(reference,mode,scene,{
  values=new Map(),left=null,right=null,colorway='auto',
  stickFeedback='ring',showFaceSymbols=true,edgeLight=0,edgeShadow=0,reviewLook=null
}={}){
  if(!reference?.svg)return;
  const colors=reviewLook?
    {...lookPalette(reference.layout.id,'ghost',scene,colorway),
      ...ghostReviewSettings(reviewLook,scene)}:
    lookPalette(reference.layout.id,mode,scene,colorway);
  if(reviewLook&&mode!=='ghost')throw new TypeError('Review look requires Ghost mode');
  if(reviewLook){
    const preset=ghostReviewSettings(reviewLook,scene);
    edgeLight=preset.edgeLight;edgeShadow=preset.edgeShadow;
  }
  // Existing binding owns the transform, mask cutouts and live input mapping.
  reference.update(values,{left,right});
  ensureBaseFill(reference,colors);
  for(const child of [...(reference.bodyShape?.children||[])]){
    if(child.hasAttribute('data-exo-polish-silhouette'))continue;
    if(!['path','ellipse','rect'].includes(child.localName))continue;
    const detail=child.classList.contains('detail')||child.id.endsWith('speaker-grille');
    // An SVG shape without an explicit fill still inherits SVG's black
    // default. Ghost review must remove the paint itself, not just set alpha
    // on shapes that happen to declare a fill property.
    if(colors.reviewLook){
      paint(child,'fill','none');
      paint(child,'fill-opacity','0');
    }
    if(visibleFill(child)){
      // Many authored "fills" are thin conversion-to-path linework, NOT
      // shell surfaces. Painting them as full-opacity shell erased seams and
      // device material boundaries. The separate silhouette is the ONLY
      // full-coverage body paint in Solid; source detail stays above it.
      paint(child,'fill',colors.ghost?colors.shell:colors.line);
      paint(child,'fill-opacity',colors.ghost?
        (detail?colors.detailAlpha:colors.shellAlpha):
        (detail?.38:.67));
    }
    if(visibleStroke(child)){
      paint(child,'stroke',colors.line);
      paint(child,'stroke-opacity',detail?colors.lineAlpha*.4:colors.lineAlpha);
    }
  }
  for(const entry of reference.controls){
    entry.layoutId=reference.layout.id;
    // The mapping also contains the body layer for source provenance.
    // It is NOT an interactive control; recoloring its first path as a
    // button was the source of the unwanted filled "Ghost shell".
    if(entry.layer.role==='body')continue;
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
    const level=controlLevel(entry,values,{left,right});
    paintControlGroup(entry,colors,level);
    paintGlyphs(entry,colors,showFaceSymbols);
  }
  paintEdgeRelief(reference,mode,scene,edgeLight,edgeShadow);
}
