// Interactive 2D reference from the supplied Gamepad-Overlay artwork package.
// This is a lab renderer, not a replacement for native GamepadSprites.
import { semanticControlFrom2DLayer } from './controller-catalog.js';
import {EXO_PALETTE} from './palette.js';
import {appearanceCacheKey,resolve2DPaint} from './material-paint.js';
const SVG_NS='http://www.w3.org/2000/svg';
const clamp=(v,low=0,high=1)=>Math.min(high,Math.max(low,Number(v)||0));

// Duplicate SVG masks must have unique fragment identifiers inside a gallery.
export function isolateReferenceIds(svg,prefix){
  const ids=new Map();
  for(const node of [svg,...svg.querySelectorAll('[id]')]){
    const id=node.getAttribute('id');
    if(id){ids.set(id,`${prefix}-${id}`);node.setAttribute('id',`${prefix}-${id}`);}
  }
  for(const node of [svg,...svg.querySelectorAll('*')])for(const attr of [...node.attributes]){
    if(attr.name==='id')continue;
    let value=attr.value.replace(/url\((['"]?)#([^)'"\s]+)\1\)/g,(match,quote,id)=>ids.has(id)?`url(#${ids.get(id)})`:match);
    if(['href','xlink:href'].includes(attr.name)&&value[0]==='#'&&ids.has(value.slice(1)))value='#'+ids.get(value.slice(1));
    if(value!==attr.value)node.setAttribute(attr.name,value);
  }
}

function cleanSvg(root){
  for(const child of [...root.querySelectorAll('script,foreignObject,iframe')])child.remove();
  for(const node of [root,...root.querySelectorAll('*')]){
    for(const attr of [...node.attributes]){
      if(attr.name.toLowerCase().startsWith('on'))node.removeAttribute(attr.name);
      if(['href','xlink:href'].includes(attr.name)&&/^\s*(?:https?:|data:|javascript:)/i.test(attr.value))node.removeAttribute(attr.name);
    }
  }
}
function svgElement(tag,attrs={}){
  const el=document.createElementNS(SVG_NS,tag);
  for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));
  return el;
}
function match2DControls(svg,mapping){
  const list=[];
  for(const layer of mapping.layers||[]){
    const group=svg.querySelector(`[id="${CSS.escape(layer.id)}"]`);
    if(!group)continue;
    let control=semanticControlFrom2DLayer(layer);
    const pressure=layer.pressElement?svg.querySelector(`[id="${CSS.escape(layer.pressElement)}"]`):null;
    // DualSense Create/Options put the legend glyph before the button face.
    // A selector list returns the first document-order match, not the first
    // selector's match. Prefer the exact authored face for these two controls.
    const menuFace=['btn-view','btn-menu'].includes(layer.id)
      ?group.querySelector(`[id="${CSS.escape(layer.id+'-face')}"]`):null;
    const surface=pressure||menuFace||group.querySelector('[id*="face"],path,ellipse,rect');
    const buttonMask=layer.binding?.type==='button'?layer.binding.mask:null;
    list.push({layer,group,control,surface,originalStyle:surface?.getAttribute('style')??null,
      originalGroupTransform:group.getAttribute('transform')||'',lastPressure:NaN,
      stickSide:layer.role==='stick'?(layer.binding?.axes?.[0]?.startsWith('left_')?'left':'right'):null});
  }
  return list;
}
export class ControllerReference{
  constructor(container,{onPress=null}={}){this.container=container;this.onPress=onPress;this.serial=0;this.svg=null;this.controls=[];this.layout=null;this.paint=null;this.paintKey=null;this.lastValues=new Map();}
  async load(layout){
    const token=++this.serial;this.svg=null;this.controls=[];this.layout=layout;
    this.container.replaceChildren();
    if(!layout?.has2D)return;
    try{
      const [svgResponse,mapResponse]=await Promise.all([fetch(layout.source,{cache:'no-cache'}),fetch(layout.mapping,{cache:'no-cache'})]);
      if(!svgResponse.ok||!mapResponse.ok)throw new Error(`HTTP ${svgResponse.status}/${mapResponse.status}`);
      const [source,mapping]=await Promise.all([svgResponse.text(),mapResponse.json()]);
      if(token!==this.serial)return;
      if(mapping.id!==layout.id||!Array.isArray(mapping.layers))throw new Error('Reference mapping does not match selection');
      const doc=new DOMParser().parseFromString(source,'image/svg+xml');
      const svg=doc.documentElement;
      if(svg.localName!=='svg'||doc.querySelector('parsererror'))throw new Error('Invalid SVG reference');
      cleanSvg(svg);
      const adopted=document.importNode(svg,true);
      adopted.classList.add('controller-reference-artwork');
      adopted.setAttribute('preserveAspectRatio','xMidYMid meet');
      adopted.removeAttribute('width');adopted.removeAttribute('height');
      const controls=match2DControls(adopted,mapping);
      this.installKnockouts(adopted,controls,mapping);
      this.container.replaceChildren(adopted);
      this.svg=adopted;this.controls=controls;this.mapping=mapping;
      this.bodyShape=adopted.querySelector('#body');this.paint=null;this.paintKey=null;
      adopted.addEventListener('pointerdown',event=>{
        if(typeof this.onPress!=='function')return;
        const clicked=event.target.closest('g[id]');
        const entry=this.controls.find(x=>x.group===clicked||x.group.contains(event.target));
        if(entry?.control)this.onPress(entry.control);
      });
    }catch(error){
      if(token!==this.serial)return;
      const errorNode=document.createElement('p');errorNode.textContent=`2D-Referenz nicht ladbar: ${error.message}`;
      this.container.replaceChildren(errorNode);
    }
  }
  applyMaterialAppearance(recipe,scene='dark'){
    if(!this.svg)return;
    const key=appearanceCacheKey(recipe,scene);
    if(this.paintKey===key)return;
    const paint=resolve2DPaint(recipe,scene);
    // Keep original path geometry and glyphs; change only the actual painted
    // surfaces and high-level contrast strokes. Masks/knockouts are untouched.
    const body=this.bodyShape;
    if(body){
      for(const child of [...body.children]){
        if(!['path','ellipse','rect'].includes(child.localName))continue;
        const original=child.getAttribute('style')||'';
        if(!child.hasAttribute('data-exo-original-style'))child.setAttribute('data-exo-original-style',original);
        const authored=child.getAttribute('data-exo-original-style')||'';
        if(authored)child.setAttribute('style',authored);
        if(!/fill:\s*none/i.test(authored)){
          child.style.setProperty('fill',paint.shellFill,'important');
          child.style.setProperty('fill-opacity',String(child.classList.contains('detail')?paint.shellOpacity*.38:paint.shellOpacity),'important');
        }
        if(/stroke:(?!\s*none)/i.test(authored)){
          child.style.setProperty('stroke',paint.outlineColor,'important');
          child.style.setProperty('stroke-opacity',String(paint.strokeOpacity),'important');
        }
      }
    }
    for(const entry of this.controls){
      const {surface,group}=entry;
      if(!surface)continue;
      if(!entry.originalStyleCaptured){
        entry.originalStyleCaptured=true;
        entry.originalSurfaceStyle=surface.getAttribute('style');
      }
      // Paint the input FACE, not its separate SVG symbol. A pressed state
      // overrides only the fill, then restores this material-aware idle style.
      if(entry.originalSurfaceStyle==null)surface.removeAttribute('style');
      else surface.setAttribute('style',entry.originalSurfaceStyle);
      surface.style.setProperty('fill',paint.idleControl,'important');
      surface.style.setProperty('fill-opacity',String(paint.controlsOpacity),'important');
      const original=entry.originalSurfaceStyle||'';
      if(/stroke:(?!\s*none)/i.test(original)){
        surface.style.setProperty('stroke',paint.strokeColor,'important');
        surface.style.setProperty('stroke-opacity',String(paint.strokeOpacity),'important');
      }
      surface.style.removeProperty('filter');
      entry.restMaterialStyle=surface.getAttribute('style');
      entry.lastPressure=NaN;
      for(const glyph of group.querySelectorAll('.glyph')){
        // Even on white game scenes these remain visible; never repaint masks.
        if(glyph.closest('defs,mask'))continue;
        const originalGlyph=glyph.getAttribute('style')||'';
        if(!glyph.hasAttribute('data-exo-original-glyph'))glyph.setAttribute('data-exo-original-glyph',originalGlyph);
        const authoredGlyph=glyph.getAttribute('data-exo-original-glyph')||'';
        if(authoredGlyph)glyph.setAttribute('style',authoredGlyph);
        if(/fill:(?!\s*none)/i.test(authoredGlyph))glyph.style.setProperty('fill',paint.glyphColor,'important');
        if(/stroke:(?!\s*none)/i.test(authoredGlyph))glyph.style.setProperty('stroke',paint.glyphColor,'important');
      }
    }
    this.paint=paint;this.paintKey=key;
    this.update(this.lastValues,this.lastAxes||{});
  }
  installKnockouts(svg,controls,mapping){
    const sticks=controls.filter(c=>c.stickSide&&c.layer.knockout);
    const body=svg.querySelector('#body');
    if(!sticks.length||!body)return;
    const viewBox=mapping.viewBox||[0,0,480,320];
    const maskId=`ref-knockout-${mapping.id}`;
    let defs=svg.querySelector('defs');
    if(!defs){defs=svgElement('defs');svg.insertBefore(defs,svg.firstChild);}
    const mask=svgElement('mask',{id:maskId,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',
      x:viewBox[0],y:viewBox[1],width:viewBox[2],height:viewBox[3]});
    mask.appendChild(svgElement('rect',{x:viewBox[0],y:viewBox[1],width:viewBox[2],height:viewBox[3],fill:'white'}));
    for(const c of sticks){
      const source=svg.querySelector(`[id="${CSS.escape(c.layer.knockout)}"]`);
      if(!source)continue;
      const cutout=source.cloneNode(true);
      for(const el of [cutout,...cutout.querySelectorAll('*')])el.removeAttribute('id');
      cutout.removeAttribute('style');cutout.setAttribute('fill','black');cutout.setAttribute('stroke','black');
      cutout.setAttribute('stroke-width','3');
      // Keep the authored ellipse translation/rotation on the shape. The
      // animated translation belongs to a parent; replacing the shape's
      // transform moves the mask below the cap and erases its lower base.
      const movingCutout=svgElement('g',{transform:c.originalGroupTransform});
      movingCutout.appendChild(cutout);mask.appendChild(movingCutout);c.cutout=movingCutout;
    }
    defs.appendChild(mask);body.setAttribute('mask',`url(#${maskId})`);
  }
  update(values,{left=null,right=null}={}){
    if(!this.svg)return;
    this.lastValues=values;this.lastAxes={left,right};
    for(const entry of this.controls){
      const {layer,control,group,surface}=entry;
      if(entry.stickSide){
        const axes=entry.stickSide==='left'?left:right;
        const x=clamp(axes?.x,-1,1),y=clamp(axes?.y,-1,1);
        const radius=Number(layer.motion?.travelRadius)||0;
        const tx=x*radius,ty=y*radius;
        const transform=`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) ${entry.originalGroupTransform}`.trim();
        group.setAttribute('transform',transform);
        entry.cutout?.setAttribute('transform',transform);
      }
      if(layer.role==='directional-pad'&&!control)continue;
      if(!control||!surface)continue;
      const value=clamp(values.get(control)||0);
      if(Math.abs(value-entry.lastPressure)<.01)continue;
      entry.lastPressure=value;
      if(value<=.01){
        const idle=entry.restMaterialStyle??entry.originalStyle;
        if(idle==null)surface.removeAttribute('style');
        else surface.setAttribute('style',idle);
        continue;
      }
      // The native renderer has more sophisticated pressClip handling. This
      // reference view highlights pressure and stick-click without claiming
      // its pressure-fill implementation is pixel-identical to GamepadSprites.
      const pressedColor=this.paint?.pressedBlue||EXO_PALETTE.pressedSurface;
      const edge=this.paint?.pressedEdge||EXO_PALETTE.pressedEdge;
      // The actual control face lights up. No dark outline or blurry CSS halo.
      surface.style.setProperty('fill',pressedColor,'important');
      surface.style.setProperty('fill-opacity','1','important');
      surface.style.setProperty('stroke',edge,'important');
      surface.style.setProperty('stroke-opacity','1','important');
      surface.style.setProperty('filter','none','important');
    }
  }
}
