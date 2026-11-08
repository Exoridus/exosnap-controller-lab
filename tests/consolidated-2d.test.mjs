import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LAYOUTS,semanticControlFrom2DLayer} from '../controller-catalog.js';
import {lookPalette,controlSurfaceState,paintPolished2D} from '../polish-2d-style.js';

// Node has no SVG DOM. This small fixture implements tree/style operations;
// geometry and mapping come unchanged from the actual authored SVG assets.
class SvgNode{
  constructor(tag,attrs={}){this.localName=tag;this.attrs=new Map();this.children=[];this.parentNode=null;this.style={values:new Map(),setProperty:(k,v)=>this.style.values.set(k,String(v)),getPropertyValue:k=>this.style.values.get(k)||'',removeProperty:k=>this.style.values.delete(k)};for(const [k,v]of Object.entries(attrs))this.setAttribute(k,v);this.classList={contains:k=>(this.getAttribute('class')||'').split(/\s+/).includes(k)};}
  get id(){return this.getAttribute('id')||'';}get firstChild(){return this.children[0]||null;}get ownerSVGElement(){let n=this.parentNode;while(n&&n.localName!=='svg')n=n.parentNode;return n;}get isConnected(){return Boolean(this.ownerSVGElement||this.localName==='svg');}
  getAttribute(k){return this.attrs.get(k)??null;}hasAttribute(k){return this.attrs.has(k);}removeAttribute(k){this.attrs.delete(k);if(k==='style')this.style.values.clear();}
  setAttribute(k,v){this.attrs.set(k,String(v));if(k==='style'){this.style.values.clear();for(const entry of String(v).split(';')){const i=entry.indexOf(':');if(i>0)this.style.values.set(entry.slice(0,i).trim(),entry.slice(i+1).trim());}}}
  append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}appendChild(n){this.append(n);return n;}insertBefore(n,before){n.remove();n.parentNode=this;const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,n);}remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes);}
  matches(selector){return selector.split(',').some(s=>{s=s.trim();if(s==='*')return true;if(s.startsWith('.'))return this.classList.contains(s.slice(1));const a=s.match(/^\[([^\]$=]+)(\$?=)?(?:"([^"]*)")?\]$/);if(a)return a[2]===undefined?this.hasAttribute(a[1]):a[2]==='$='?(this.getAttribute(a[1])||'').endsWith(a[3]):this.getAttribute(a[1])===a[3];return this.localName===s;});}
  querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}closest(selector){let n=this;while(n){if(n.matches(selector))return n;n=n.parentNode;}return null;}
  compareDocumentPosition(other){const root=this.ownerSVGElement;const all=root?.querySelectorAll('*')||[];return all.indexOf(other)>all.indexOf(this)?4:2;}
  getBoundingClientRect(){return {width:480};}getBBox(){return {x:0,y:0,width:100,height:30};}
}
globalThis.document={createElementNS:(_,tag)=>new SvgNode(tag)};globalThis.Node={DOCUMENT_POSITION_FOLLOWING:4};
async function reference(id='dualsense'){
  const base=new URL('../references/controllers/'+id+'/',import.meta.url);
  const [source,mapping]=await Promise.all([readFile(new URL('source.svg',base),'utf8'),readFile(new URL('mapping.json',base),'utf8').then(JSON.parse)]);
  const root=new SvgNode('root'),stack=[root];
  for(const match of source.matchAll(/<\/?([\w:.-]+)\b([^>]*?)\/?\s*>/g)){
    if(match[0].startsWith('</')){stack.pop();continue;}
    const attrs=Object.fromEntries([...match[2].matchAll(/([\w:.-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]));
    const n=new SvgNode(match[1],attrs);stack.at(-1).append(n);if(!match[0].endsWith('/>'))stack.push(n);
  }
  const svg=root.querySelector('svg');svg.viewBox={baseVal:{width:mapping.viewBox[2]}};
  const controls=mapping.layers.map(layer=>({layer,group:svg.querySelector('[id="'+layer.id+'"]'),control:semanticControlFrom2DLayer(layer),stickSide:layer.role==='stick'?(layer.id.includes('-l-')?'left':'right'):null}));
  const fixture={svg,layout:{id},bodyShape:svg.querySelector('[id="body"]'),controls,container:{clientWidth:480},update(values){for(const entry of controls){if(entry.layer.id==='btn-mute'&&values.get('mute'))entry.group.querySelector('rect').style.setProperty('stroke','#ff8a3d');}}};
  return fixture;
}
const value=(node,key)=>node.style.getPropertyValue(key);
const grayscale=c=>/^#([\da-f]{2})\1\1$/i.test(c);

test('ghost palette uses achromatic light/dark marks and a dual-contrast mixed profile',()=>{
  const dark=lookPalette('dualsense','ghost','dark'),light=lookPalette('dualsense','ghost','light'),mixed=lookPalette('dualsense','ghost','mixed');
  for(const p of [dark,light,mixed])for(const key of ['control','cap','trigger','glyph','controlStroke'])assert.ok(grayscale(p[key]),key+' '+p[key]);
  assert.equal(dark.control,'#ffffff');assert.equal(light.control,'#000000');assert.notEqual(dark.glyph,light.glyph);assert.equal(mixed.contrastEdge,'#000000');
  for(const p of [dark,light,mixed]){assert.equal(p.controlAlpha,.26);assert.equal(p.controlStrokeAlpha,.86);assert.equal(p.glyphAlpha,.86);const active=controlSurfaceState(p,1);assert.equal(active.fill,'#ffffff');assert.equal(active.alpha,.40);assert.equal(active.strokeAlpha,.90);}
});

test('all authored interactive surfaces, shoulders, stick contours and glyphs share alpha',async()=>{
  for(const scene of ['dark','light','mixed']){
    const r=await reference();
    for(const level of [0,1]){
      const values=new Map(r.controls.map(e=>[e.control,level]));
      paintPolished2D(r,'ghost',scene,{values,left:{x:level,y:0},right:{x:level,y:0}});
      const alpha=level?.4:.26,markAlpha=level?.9:.86;
      for(const id of ['btn-l1-pressure','trigger-r2-pressure','btn-cross-face','stick-l-cap-top']){
        const n=r.svg.querySelector('[id="'+id+'"]');assert.equal(Number(value(n,'fill-opacity')),alpha,id+' '+scene+' '+level);
      }
      for(const n of [r.svg.querySelector('[id="stick-l-cap-outline"]'),r.svg.querySelector('[id="btn-l1"]').children[1]]){
        const id=n.id||'shoulder contour';assert.equal(Number(value(n,'stroke-opacity')),markAlpha,id+' '+scene+' '+level);
      }
      const glyph=r.svg.querySelector('[id="btn-cross"]').querySelector('.glyph');assert.equal(Number(value(glyph,'opacity')),markAlpha);
    }
  }
});

test('decorative mute, speaker and shell detail retain complete authored paint and paths through input',async()=>{
  const r=await reference(),mute=r.svg.querySelector('[id="btn-mute-face"]'),speaker=r.svg.querySelector('[id="speaker-grille"]');
  const detail=r.bodyShape.children.find(n=>n.classList.contains('detail'));
  const nodes=[mute,speaker,detail];const before=nodes.map(n=>({d:n.getAttribute('d'),paint:new Map(n.style.values)}));
  const allPaths=r.svg.querySelectorAll('path').map(n=>[n,n.getAttribute('d')]);
  for(const scene of ['dark','light','mixed']){
    paintPolished2D(r,'ghost',scene,{values:new Map([['mute',1],['b1',1]])});
    for(let i=0;i<nodes.length;i++){assert.deepEqual(nodes[i].style.values,before[i].paint,nodes[i].id||'shell detail');assert.equal(nodes[i].getAttribute('d'),before[i].d);}
    for(const [n,d]of allPaths)assert.equal(n.getAttribute('d'),d,'authored path changed');
  }
});

test('mixed controls have shared SVG dual contrast without clipping authored source contours',async()=>{
  const r=await reference();paintPolished2D(r,'ghost','mixed');
  const ring=r.svg.querySelector('[id="stick-l-cap-outline"]');assert.match(value(ring,'filter'),/^url\(#/);
  const filter=r.svg.querySelector('[data-exo-control-contrast]');assert.ok(filter);assert.ok(filter.querySelector('feMorphology'));
  for(const n of r.svg.querySelectorAll('path,ellipse,rect').filter(n=>!n.id.endsWith('-pressure')))assert.equal(value(n,'clip-path'),'');
});

test('optional active color changes only active feedback, preserving the same alpha',async()=>{
  const r=await reference();paintPolished2D(r,'ghost','dark',{activeColor:'#55aaff',values:new Map([['b1',1]])});
  const face=r.svg.querySelector('[id="btn-cross-face"]');assert.equal(value(face,'fill'),'#55aaff');assert.equal(Number(value(face,'fill-opacity')),.4);
  const other=r.svg.querySelector('[id="btn-circle-face"]');assert.equal(value(other,'fill'),'#ffffff');assert.equal(Number(value(other,'fill-opacity')),.26);
});

// Cross-model coverage catches extra authored pieces in Switch/Generic pads
// and the Xbox pressure lobes without replacing their actual source geometry.
test('every available authored layout retains paths and the same interactive fill contract',async()=>{
  for(const layout of LAYOUTS.filter(x=>x.has2D)){
    const r=await reference(layout.id);
    const paths=r.svg.querySelectorAll('path').map(n=>[n,n.getAttribute('d')]);
    for(const level of [0,.5,1]){
      const values=new Map([...r.controls.filter(e=>e.control).map(e=>[e.control,level]),...['up','down','left','right'].map(key=>[key,level])]);
      paintPolished2D(r,'ghost','light',{values,left:{x:level,y:0},right:{x:level,y:0}});
      for(const entry of r.controls){
        if(entry.layer.role==='body'||entry.layer.inputStatus==='unsupported'||entry.layer.role==='button'&&!entry.layer.binding)continue;
        const effective=entry.stickSide?Number(level>.5):entry.layer.role==='trigger'?level:Number(level>.5);
        for(const n of entry.group.querySelectorAll('[data-exo-visible-control-fill]')){
          assert.ok(Math.abs(Number(value(n,'fill-opacity'))-(.26+.14*effective))<1e-10,layout.id+' '+entry.layer.id+' '+level);
        }
      }
      for(const [n,d]of paths)assert.equal(n.getAttribute('d'),d,layout.id+' source path changed');
    }
  }
});

test('returning to fixed Ghost restores original decorative body paint after a legacy Solid render',async()=>{
  const r=await reference();const detail=r.bodyShape.children.find(n=>n.classList.contains('detail'));
  const original=new Map(detail.style.values);
  paintPolished2D(r,'solid','dark');paintPolished2D(r,'ghost','light');
  assert.deepEqual(detail.style.values,original);
});

test('Ghost housing outline and relief inks are achromatic on every background',async()=>{
  const {edgeReliefProfile}=await import('../polish-2d-style.js');
  for(const scene of ['dark','light','mixed']){
    assert.ok(grayscale(lookPalette('dualsense','ghost',scene).line));
    const relief=edgeReliefProfile('ghost',scene,.38,.45);
    assert.ok(grayscale(relief.lightColor));assert.ok(grayscale(relief.shadowColor));
  }
  assert.equal(lookPalette('dualsense','solid','dark').line,'#50687b','legacy Solid silhouette unchanged');
});

test('mixed counter-edge remains subpixel in rendered space under authored glyph transforms',async()=>{
  const r=await reference();
  const glyph=r.svg.querySelector('[id="btn-cross"]').querySelector('.glyph');
  // Original tiny glyph paths use a large authored transform; applying root
  // SVG units to them magnifies a narrow outline into a filled dark plate.
  glyph.getScreenCTM=()=>({a:10,b:0,c:0,d:8});
  paintPolished2D(r,'ghost','mixed');
  const filterId=value(glyph,'filter').slice(5,-1);
  const filter=r.svg.querySelector('[id="'+filterId+'"]');
  const radius=filter.querySelector('feMorphology').getAttribute('radius').split(/\s+/).map(Number);
  assert.ok(Math.abs(radius[0]*10-.48)<.006,'horizontal edge is .48 rendered pixels');
  assert.ok(Math.abs((radius[1]??radius[0])*8-.48)<.006,'vertical edge is .48 rendered pixels');
});

test('analog activity reuses the same contrast definitions for each authored transform',async()=>{
  const r=await reference();
  const glyph=r.svg.querySelector('[id="btn-cross"]').querySelector('.glyph');
  glyph.getScreenCTM=()=>({a:10,b:0,c:0,d:10});
  paintPolished2D(r,'ghost','mixed');
  const initial=r.svg.querySelectorAll('[data-exo-control-contrast]').length;
  assert.equal(initial,2,'root-scale controls and transformed glyph need separate definitions');
  for(const level of [.1,.25,.5,.75,1,0]){
    const values=new Map(r.controls.filter(e=>e.control).map(e=>[e.control,level]));
    paintPolished2D(r,'ghost','mixed',{values,left:{x:level,y:0},right:{x:level,y:0}});
    assert.equal(r.svg.querySelectorAll('[data-exo-control-contrast]').length,initial,'analog '+level+' must reuse definitions');
  }
});
