import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import * as parityViewport from '../parity-viewport.js';
import {ControllerReference} from '../controller-reference.js';
import {runReferenceRaster} from './support/parity-raster-harness.mjs';

const near=(actual,want,message)=>assert.ok(Math.abs(actual-want)<1e-7,`${message}: ${actual} != ${want}`);
function cameraPair(){
  const source=new THREE.PerspectiveCamera(90,1.5,.01,180),target=new THREE.Vector3();
  source.position.set(0,0,10);source.lookAt(target);source.updateMatrixWorld();
  const flat=new THREE.OrthographicCamera(-1,1,1,-1,.01,180);
  return {source,target,flat};
}
function sync({source,target,flat},aspect=1.5){
  assert.equal(typeof parityViewport.syncFlatReferenceCamera,'function','flat reference camera must have independent orientation');
  parityViewport.syncFlatReferenceCamera(flat,source,target,aspect);
}
const projected=(camera)=>new THREE.Vector3(2,1,0).project(camera);

test('2D front projection is unchanged by 3D orbit, including after panning',()=>{
  const rig=cameraPair();sync(rig);
  const before=projected(rig.flat);
  near(before.x,2/15,'front x');near(before.y,1/10,'front y');
  rig.source.position.set(10,0,0);rig.source.lookAt(rig.target);sync(rig);
  assert.ok(projected(rig.flat).distanceTo(before)<1e-7,'side orbit must not foreshorten the SVG');
  // At this orbit, screen-right pan changes world Z. It must move the flat
  // reference by the same screen amount instead of being discarded.
  rig.target.z=-2;rig.source.position.set(10,0,-2);rig.source.lookAt(rig.target);sync(rig);
  near(rig.flat.position.x,2,'screen-space pan x');near(rig.flat.position.y,0,'screen-space pan y');
  const panned=projected(rig.flat);
  rig.source.position.set(0,0,8);rig.source.lookAt(rig.target);sync(rig);
  assert.ok(projected(rig.flat).distanceTo(panned)<1e-7,'orbit after a pan must retain the flat pan');
  near(rig.flat.quaternion.x,0,'front quaternion x');near(rig.flat.quaternion.y,0,'front quaternion y');
});

test('2D zoom follows perspective distance and orthographic zoom with correct panel aspect',()=>{
  const rig=cameraPair();sync(rig);
  const first=projected(rig.flat);
  rig.source.position.z=5;sync(rig);
  near(projected(rig.flat).x,first.x*2,'perspective zoom x');near(projected(rig.flat).y,first.y*2,'perspective zoom y');
  rig.source=new THREE.OrthographicCamera(-6,6,3,-3,.01,180);rig.source.position.z=10;rig.source.zoom=2;rig.source.updateProjectionMatrix();
  sync(rig,2);
  near(projected(rig.flat).x,2/3,'orthographic x');near(projected(rig.flat).y,2/3,'orthographic y');
  rig.target.set(1,.5,0);rig.source.position.set(1,.5,10);sync(rig,2);
  near(rig.flat.position.x,1,'pan x');near(rig.flat.position.y,.5,'pan y');
  rig.target.set(0,0,0);rig.source.position.set(0,0,10);sync(rig,2);
  near(rig.flat.position.x,0,'reset x');near(rig.flat.position.y,0,'reset y');
});

test('light reference recolors every column and preserves blue and alpha in the far right edge',()=>{
  const result=runReferenceRaster();
  assert.equal(result.visible,true);assert.equal(result.darkUpdated,true);assert.equal(result.lightUpdated,true);
  for(const x of [0,1023,1024,1500,2046]){
    assert.deepEqual([...result.light.subarray(x*4,x*4+4)],[46,67,89,180],`full-width neutral pixel ${x}`);
  }
  assert.deepEqual([...result.light.subarray(2047*4,2048*4)],[85,186,255,128]);
  assert.deepEqual([...result.dark.subarray(1500*4,1500*4+4)],[255,255,255,180],'dark original stays intact');
});

class SvgNode{
  constructor(tag,attributes={}){this.tag=tag;this.attrs={...attributes};this.children=[];this.parentNode=null;}
  getAttribute(key){return this.attrs[key]??null;}
  setAttribute(key,value){this.attrs[key]=String(value);}
  removeAttribute(key){delete this.attrs[key];}
  appendChild(node){this.children.push(node);node.parentNode=this;return node;}
  insertBefore(node){this.children.unshift(node);node.parentNode=this;return node;}
  cloneNode(deep){const copy=new SvgNode(this.tag,this.attrs);if(deep)for(const c of this.children)copy.appendChild(c.cloneNode(true));return copy;}
  querySelectorAll(selector){const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return selector==='*'?all:all.filter(c=>c.tag===selector);}
  querySelector(selector){const all=this.querySelectorAll('*');if(selector.startsWith('#'))return all.find(c=>c.getAttribute('id')===selector.slice(1))||null;
    const id=selector.match(/^\[id="([^"]+)"\]$/);return (id?all.find(c=>c.getAttribute('id')===id[1]):all.find(c=>c.tag===selector))||null;}
}
// Evaluate only the affine transforms actually authored by this SVG fixture.
function transformedEllipse(node){
  const ellipse=node.tag==='ellipse'?node:node.querySelector('ellipse');
  const chain=[];for(let n=ellipse;n&&n.tag!=='mask';n=n.parentNode)chain.unshift(n);
  const world=new THREE.Matrix3();
  for(const n of chain){
    for(const [,op,args]of (n.getAttribute('transform')||'').matchAll(/(translate|rotate|matrix)\(([^)]+)\)/g)){
      const a=args.trim().split(/[ ,]+/).map(Number),m=new THREE.Matrix3();
      if(op==='translate')m.set(1,0,a[0],0,1,a[1]||0,0,0,1);
      if(op==='matrix')m.set(a[0],a[2],a[4],a[1],a[3],a[5],0,0,1);
      if(op==='rotate'){const t=a[0]*Math.PI/180,c=Math.cos(t),s=Math.sin(t),x=a[1]||0,y=a[2]||0;m.set(c,-s,x-c*x+s*y,s,c,y-s*x-c*y,0,0,1);}
      world.multiply(m);
    }
  }
  const cx=Number(ellipse.getAttribute('cx')),cy=Number(ellipse.getAttribute('cy'));
  const center=new THREE.Vector3(cx,cy,1).applyMatrix3(world);
  const radialX=new THREE.Vector3(Number(ellipse.getAttribute('rx')),0,0).applyMatrix3(world);
  const radialY=new THREE.Vector3(0,Number(ellipse.getAttribute('ry')),0).applyMatrix3(world);
  return {x:center.x,y:center.y,rx:Math.hypot(radialX.x,radialY.x),ry:Math.hypot(radialX.y,radialY.y)};
}

test('stick cutout preserves the authored cap transform so it cannot erase the lower body contour',()=>{
  const docBefore=globalThis.document,cssBefore=globalThis.CSS;
  globalThis.document={createElementNS:(_,tag)=>new SvgNode(tag)};globalThis.CSS={escape:s=>s};
  try{
    const svg=new SvgNode('svg'),body=svg.appendChild(new SvgNode('g',{id:'body'}));
    const group=svg.appendChild(new SvgNode('g',{id:'stick-l-cap'}));
    const source=group.appendChild(new SvgNode('ellipse',{id:'stick-l-cap-outline',cx:'183.182',cy:'235.447',rx:'26.919',ry:'31.931',
      transform:'translate(0.468 -12.941) rotate(90.06 183.182 235.447)',style:'fill:none;stroke:#ffffff;stroke-width:1.773'}));
    const control={group,layer:{knockout:'stick-l-cap-outline',motion:{travelRadius:9.886280822753905}},stickSide:'left',originalGroupTransform:''};
    const reference=new ControllerReference(null);reference.svg=svg;reference.controls=[control];
    reference.installKnockouts(svg,[control],{id:'dualsense',viewBox:[0,0,544.7066040039062,302.9109802246094]});
    reference.update(new Map(),{left:{x:0,y:0}});
    let cutout=transformedEllipse(control.cutout);
    near(cutout.x,183.65,'authored cutout center x');near(cutout.y,222.506,'authored cutout center y');
    assert.ok(cutout.rx>31.9&&cutout.ry<27,'authored ellipse rotation preserves the horizontal cap outline');
    reference.update(new Map(),{left:{x:1,y:-1}});
    cutout=transformedEllipse(control.cutout);
    near(cutout.x,193.54,'deflected cutout x');near(cutout.y,212.616,'deflected cutout y');
    assert.equal(source.getAttribute('transform'),'translate(0.468 -12.941) rotate(90.06 183.182 235.447)','original source node stays unchanged');
    assert.equal(body.getAttribute('mask'),'url(#ref-knockout-dualsense)');
  }finally{globalThis.document=docBefore;globalThis.CSS=cssBefore;}
});

test('supplied DualSense source SVG bytes remain unchanged',()=>{
  const source=readFileSync(new URL('../references/controllers/dualsense/source.svg',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'c9bb4dc84b225fca7a23470192e1cec99562b1993ff99b67e13bd9aee796b040');
});
