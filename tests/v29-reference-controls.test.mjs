import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAYOUTS,semanticControlFrom2DLayer} from '../controller-catalog.js';
import {ControllerReference} from '../controller-reference.js';
import {EXO_PALETTE} from '../palette.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
// Run the actual private mapping function without loading the browser UI.
const code=read('controller-reference.js');
const begin=code.indexOf('function match2DControls('),end=code.indexOf('export class ControllerReference',begin);
const match2DControls=new Function('semanticControlFrom2DLayer','CSS',`${code.slice(begin,end)}; return match2DControls;`)(semanticControlFrom2DLayer,{escape:s=>s});

class SvgElement{
  constructor(tag,attributes){this.tag=tag;this.attributes={...attributes};this.children=[];}
  getAttribute(name){return this.attributes[name]??null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  removeAttribute(name){delete this.attributes[name];}
  get style(){
    const entries=()=>new Map((this.getAttribute('style')||'').split(';').flatMap(s=>{const colon=s.indexOf(':');return colon<0?[]:[[s.slice(0,colon).trim(),s.slice(colon+1).trim()]];}));
    return {
      setProperty:(name,value,priority)=>{const all=entries();all.set(name,value+(priority?' !'+priority:''));this.setAttribute('style',[...all].map(([k,v])=>`${k}: ${v}`).join(';'));},
      getPropertyValue:name=>(entries().get(name)||'').replace(/\s*!important$/,'')
    };
  }
  querySelector(selector){
    const descendants=this.children.flatMap(child=>[child,...child.descendants()]);
    // DOM selector lists are a union; the first matching document-order node
    // wins. Treating the comma list as priorities would hide the original bug.
    return descendants.find(node=>selector.split(',').some(part=>{
      const id=part.match(/^\[id(\*?)="([^"]+)"\]$/);
      return id?(id[1]?(node.getAttribute('id')||'').includes(id[2]):node.getAttribute('id')===id[2]):node.tag===part;
    }))||null;
  }
  descendants(){return this.children.flatMap(child=>[child,...child.descendants()]);}
}
function sourceTree(xml){
  const document=new SvgElement('document',{}),stack=[document];
  for(const [tag]of xml.matchAll(/<\/?[A-Za-z][^>]*>/g)){
    if(tag.startsWith('</')){stack.pop();continue;}
    const name=tag.match(/^<([^\s/>]+)/)[1];
    const attributes=Object.fromEntries([...tag.matchAll(/([^\s=<>]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1],m[3]]));
    const element=new SvgElement(name,attributes);stack.at(-1).children.push(element);
    if(!tag.endsWith('/>'))stack.push(element);
  }
  return document.children[0];
}
function actualReference(id){
  const mapping=JSON.parse(read(`references/controllers/${id}/mapping.json`));
  const svg=sourceTree(read(`references/controllers/${id}/source.svg`));
  return {mapping,svg,controls:match2DControls(svg,mapping)};
}

test('actual DualSense Create/Options body paths fill blue while their separate glyphs stay intact',()=>{
  for(const id of ['dualsense','dualsense_edge']){
    const {svg,controls}=actualReference(id);
    const entries=controls.filter(c=>['btn-view','btn-menu'].includes(c.layer.id));
    const glyphs=entries.map(c=>c.group.querySelector('path'));
    const originalGlyphs=glyphs.map(g=>g.getAttribute('style'));
    for(const entry of entries){
      assert.equal(entry.surface.getAttribute('id'),entry.layer.id+'-face',`${id} ${entry.layer.id} must select its body, not the earlier glyph`);
      assert.ok(entry.surface.getAttribute('d')?.length>1000,'selected node is the real authored button body path');
    }
    const originals=entries.map(c=>c.surface.getAttribute('style'));
    const reference=new ControllerReference(null);reference.svg=svg;reference.controls=controls;
    reference.update(new Map([['start',1],['select',1]]));
    for(const entry of entries){assert.equal(entry.surface.style.getPropertyValue('fill'),EXO_PALETTE.pressedBlue);assert.equal(entry.surface.style.getPropertyValue('fill-opacity'),'1');
      assert.equal(entry.surface.style.getPropertyValue('stroke'),EXO_PALETTE.pressedEdge);}
    assert.deepEqual(glyphs.map(g=>g.getAttribute('style')),originalGlyphs,'the legend glyph is not the pressure surface');
    reference.update(new Map());
    assert.deepEqual(entries.map(c=>c.surface.getAttribute('style')),originals,'release restores the original body artwork');
  }
});

test('the targeted menu/view correction preserves all other surfaces and explicit pressure mappings across 20 sources',()=>{
  const changes=[];
  for(const layout of LAYOUTS){
    const {svg,controls}=actualReference(layout.id);
    for(const entry of controls){
      const {layer,group,surface}=entry;
      const pressure=layer.pressElement?svg.querySelector(`[id="${layer.pressElement}"]`):null;
      const previous=pressure||group.querySelector('[id*="face"],path,ellipse,rect');
      if(surface!==previous)changes.push(`${layout.id}/${layer.id}/${surface.getAttribute('id')}`);
      if(pressure)assert.equal(surface,pressure,`${layout.id}/${layer.id}: explicit pressure mapping must win`);
    }
  }
  assert.deepEqual(changes.sort(),[
    'dualsense/btn-menu/btn-menu-face','dualsense/btn-view/btn-view-face',
    'dualsense_edge/btn-menu/btn-menu-face','dualsense_edge/btn-view/btn-view-face'
  ]);
});
