import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {modelPartSemantics,isHousingRole,shouldRenderPart} from '../model-semantics.js';
import {controllerPartTransform,thumbstickCapSkirtProfile,thumbstickCapRadialSegments,thumbstickTopDisplacement,isFlatThumbCap} from '../thumbstick-geometry.js';
import {MODEL_MECHANICS,stickMechanics} from '../model-mechanics.js';
import {parametricCapGeometry} from '../v24-stick-geometry.js';
import {V24_STICK_MODELS} from '../v24-policy.js';
import {inheritedStickControl} from '../gamepad-input.js';
import {stickTiltQuaternion} from '../stick-visual-state.js';

const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('app.js',root),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('assets/DualSenseCompact/info.json',root),'utf8'));
const model={id:'DualSenseCompact',source:'co',family:'sony'};
const objLoader=new OBJLoader();
const readObj=file=>objLoader.parse(fs.readFileSync(new URL(`assets/DualSenseCompact/${file}`,root),'utf8'));
const extract=(start,end,from=0)=>{
  const first=source.indexOf(start,from),last=source.indexOf(end,first);
  assert.ok(first>=0&&last>first,`loader section ${start} is present`);
  return source.slice(first,last);
};

// Exercise the actual browser loader's geometry and hierarchy code against the
// shipped OBJ files. Only GPU/material installation is replaced for Node.
function loadAssembly(sharedSticks=true){
  const makePartSource=extract('function makePart(', 'function removePartialParts(');
  const materialFor=()=>new THREE.MeshBasicMaterial();
  const makePart=new Function('THREE','modelPartSemantics','isHousingRole','shouldRenderPart',
    'MODEL_MECHANICS','stickMechanics','controllerPartTransform','thumbstickCapSkirtProfile',
    'thumbstickCapRadialSegments','thumbstickTopDisplacement','isFlatThumbCap',
    'sharedSticks','V24_STICK_MODELS','parametricCapGeometry','materialFor',
    'pickMeshes','installPhysicalOccluder','style',
    `${makePartSource}\nreturn makePart;`)(THREE,modelPartSemantics,isHousingRole,shouldRenderPart,
      MODEL_MECHANICS,stickMechanics,controllerPartTransform,thumbstickCapSkirtProfile,
      thumbstickCapRadialSegments,thumbstickTopDisplacement,isFlatThumbCap,
      sharedSticks,V24_STICK_MODELS,parametricCapGeometry,materialFor,[],()=>{},'solid');
  const files=new Set(['left_stick.obj','right_stick.obj','left_ring.obj','right_ring.obj',
    'left_cap.obj','right_cap.obj','top_shell.obj','bottom_shell.obj']);
  const parts=manifest.parts.flatMap((meta,i)=>files.has(meta.filename)?[
    {part:makePart(readObj(meta.filename),meta.filename,model,meta),index:`${model.id}:${i}`,sourceId:model.id}]:[]);
  const reoriented=new THREE.Group(),subgroup=new THREE.Group();reoriented.add(subgroup);
  const subgroups=new Map([[model.id,subgroup]]),activeHolders=[];
  const hierarchySource=extract('  const byIndex=new Map(parts.map(', '  if(isComposite){');
  new Function('parts','subgroups','activeHolders','inheritedStickControl',hierarchySource)(parts,subgroups,activeHolders,inheritedStickControl);
  const assemblySource=extract('  if(sharedSticks&&V24_STICK_MODELS.includes(model.id)',
    '  if(solidBody){',source.indexOf('async function loadController('));
  new Function('sharedSticks','V24_STICK_MODELS','MODEL_MECHANICS','model','sourceModels',
    'activeHolders','reoriented','THREE','materialFor','installPhysicalOccluder',assemblySource)(
      sharedSticks,V24_STICK_MODELS,MODEL_MECHANICS,model,[model],activeHolders,reoriented,THREE,materialFor,()=>{});
  reoriented.updateMatrixWorld(true);
  return {scene:reoriented,holders:activeHolders,part:file=>activeHolders.find(p=>p.userData.file===file)};
}
function uniquePositions(geometry){
  const attribute=geometry.getAttribute('position'),result=new Map();
  for(let i=0;i<attribute.count;i++){
    const p=[attribute.getX(i),attribute.getY(i),attribute.getZ(i)];
    result.set(p.map(n=>n.toFixed(6)).join(','),p);
  }
  return result;
}
function sourceSeam(leftFile,rightFile){
  const left=uniquePositions(readObj(leftFile).children[0].geometry);
  const right=uniquePositions(readObj(rightFile).children[0].geometry);
  return [...left].filter(([key])=>right.has(key)).map(([,p])=>p);
}
function worldVertices(holder){
  const mesh=holder.userData.meshes[0];
  return [...uniquePositions(mesh.geometry).values()].map(p=>new THREE.Vector3(...p).applyMatrix4(mesh.matrixWorld));
}
const close=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);

test('authored DualSense inset stays original and never becomes a second parametric cap',()=>{
  const original=readObj('left_cap.obj').children[0].geometry;
  assert.ok(parametricCapGeometry(model.id,original)===null,
    'the authored inset boundary must remain fitted to the authored outer cap');
  for(const enabled of [true,false]){
    const assembly=loadAssembly(enabled);
    for(const side of ['left','right'])for(const component of ['stick','ring','cap']){
      const file=`${side}_${component}.obj`,rendered=assembly.part(file).userData.meshes;
      assert.equal(rendered.length,1,`${file}: no fabricated cap/skirt`);
      assert.deepEqual([...uniquePositions(rendered[0].geometry)],
        [...uniquePositions(readObj(file).children[0].geometry)],`${file}: source vertices preserved`);
    }
  }
});

test('native housing wells remain stationary and are not duplicated below the authored opening',()=>{
  const assembly=loadAssembly();
  assert.equal(assembly.holders.length,8,'only the eight loaded authored holders exist');
  assert.ok(!assembly.holders.some(p=>/fixed-socket|shared-stick-pivot/.test(p.name)),
    'the source shell supplies its own well and the source ring already owns its pivot');
  for(const side of ['ls','rs']){
    const owners=assembly.holders.filter(p=>p.userData.control===side);
    assert.equal(owners.length,1,'one analog/press animation owner per stick');
  }
});

test('all moving DualSense surfaces receive the same L3/R3 press control',()=>{
  const assembly=loadAssembly();
  for(const [side,control] of [['left','ls'],['right','rs']]){
    for(const component of ['stick','ring','cap']){
      const holder=assembly.part(`${side}_${component}.obj`);
      assert.equal(holder.userData.visualControl||holder.userData.control,control,`${side} ${component} press control`);
      assert.ok(holder.userData.meshes.every(m=>m.userData.control===control));
    }
  }
  for(const file of ['top_shell.obj','bottom_shell.obj']){
    const holder=assembly.part(file);
    assert.equal(holder.userData.visualControl||holder.userData.control,null);
  }
});

test('actual authored cap/shaft seams stay closed through cardinal, diagonal, click and neutral poses',()=>{
  const assembly=loadAssembly();
  const staticMatrices=['top_shell.obj','bottom_shell.obj'].map(file=>assembly.part(file).matrixWorld.toArray());
  const axes=[{x:0,y:0},...Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)})),{x:1,y:1},{x:0,y:0}];
  for(const [side,control] of [['left','ls'],['right','rs']]){
    const config=stickMechanics(model.id,side);
    const pivots=assembly.holders.filter(p=>p.userData.control===control);
    assert.equal(pivots.length,1);
    const pivot=pivots[0];
    const pairs=[['stick','ring'],['ring','cap']].map(([a,b])=>({
      a:assembly.part(`${side}_${a}.obj`),b:assembly.part(`${side}_${b}.obj`),
      seam:sourceSeam(`${side}_${a}.obj`,`${side}_${b}.obj`)
    }));
    assert.deepEqual(pairs.map(p=>p.seam.length),[24,24],'the source has exact closed 24-vertex joins');
    for(const input of axes)for(const click of [0,1]){
      const tilt=stickTiltQuaternion(input,'co',config);
      pivot.quaternion.set(tilt.x,tilt.y,tilt.z,tilt.w);
      pivot.position.copy(pivot.userData.base).add(new THREE.Vector3(0,-config.clickTravel*click,0).applyQuaternion(pivot.quaternion));
      assembly.scene.updateMatrixWorld(true);
      const angle=pivot.quaternion.angleTo(new THREE.Quaternion());
      close(angle,(input.x||input.y)?14*Math.PI/180:0);
      for(const pair of pairs){
        const av=worldVertices(pair.a),bv=worldVertices(pair.b);
        const sourceMesh=pair.a.userData.meshes[0];
        for(const local of pair.seam){
          const expected=new THREE.Vector3(...local).applyMatrix4(sourceMesh.matrixWorld);
          const da=Math.min(...av.map(v=>v.distanceTo(expected)));
          const db=Math.min(...bv.map(v=>v.distanceTo(expected)));
          assert.ok(da<2e-6&&db<2e-6,`${side} ${pair.a.name}/${pair.b.name}: seam gap ${Math.max(da,db)}`);
        }
      }
      for(const [i,file] of ['top_shell.obj','bottom_shell.obj'].entries())
        assert.deepEqual(assembly.part(file).matrixWorld.toArray(),staticMatrices[i],`${file} remains fixed`);
    }
  }
});
