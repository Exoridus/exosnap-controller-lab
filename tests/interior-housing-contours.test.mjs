import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {extractInteriorHousingEdges,interiorContourOpacity,prepareInteriorHousingContours,updateInteriorHousingContours,INTERIOR_CONTOUR_POLICY} from '../interior-housing-contours.js';

const read=p=>readFile(new URL('../'+p.replace(/^\.\//,''),import.meta.url),'utf8');
function seamGeometry(bend=true){
 const d=bend?[0,-.11,.14]:[0,-.11,0];
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  0,0,0, .24,0,0, 0,.15,0, ...d
 ],3));
 geometry.setIndex([0,1,2, 1,0,3]);
 return geometry;
}
function fixture(geometry){const root=new THREE.Group(),mesh=new THREE.Mesh(geometry);
 mesh.userData.role='housing';mesh.userData.sourceFile='top_shell.obj';root.add(mesh);return {root,mesh};}

test('interior contour extracts only manifold creases, not open boundaries or coplanar diagonal wireframes',()=>{
 const bent=fixture(seamGeometry(true)),flat=fixture(seamGeometry(false));
 try{
  const accepted=extractInteriorHousingEdges([bent.mesh],bent.root);
  assert.equal(accepted.length,1,'one bend between adjacent authored faces');
  assert.ok(accepted[0].len>.2&&accepted[0].len<.3);
  assert.equal(extractInteriorHousingEdges([flat.mesh],flat.root).length,0,'coplanar faces have no seam');
  bent.mesh.userData.sourceFile='left_trigger.obj';
  assert.equal(extractInteriorHousingEdges([bent.mesh],bent.root).length,0,'animated controls cannot become housing contours');
 }finally{bent.mesh.geometry.dispose();flat.mesh.geometry.dispose();}
});
test('exterior source meshes and material transparency are unchanged while interior fades to zero with Ghost',()=>{
 const {root,mesh}=fixture(seamGeometry(true));
 const src=mesh.geometry.attributes.position.array.slice();
 const native={group:root,meshes:[mesh]};
 try{
  const state=prepareInteriorHousingContours(native);
  assert.equal(state.segments,1);
  assert.equal(root.children.length,2,'one reusable depth-tested line object for the entire rig');
  assert.equal(state.material.depthTest,true);
  assert.equal(state.material.depthWrite,false);
  assert.equal(state.lines.isLineSegments,true);
  assert.deepEqual(mesh.geometry.attributes.position.array,src,'original geometry unchanged');
  for(const [mix,expected]of [[0,.26],[.7,.26*(1-.49)],[1,0]]){
   updateInteriorHousingContours(native,{mix});
   assert.ok(Math.abs(state.material.opacity-expected)<1e-10);
   assert.equal(state.lines.visible,mix!==1);
  }
  assert.equal(interiorContourOpacity(1),INTERIOR_CONTOUR_POLICY.ghostOpacity);
  assert.strictEqual(prepareInteriorHousingContours(native),state,'no duplicate draw during render');
 }finally{
  stateDispose(native);
  mesh.geometry.dispose();
 }
});
function stateDispose(native){
 const s=native.interiorHousingContours;
 if(s){s.lines.parent?.remove(s.lines);s.geometry.dispose();s.material.dispose();native.interiorHousingContours=null;}
}

test('source-based interior seam creation works on real licensed controllers and does not add more than one draw',async()=>{
 const models=['XboxOneClean','DS4Compact','DualSenseCompact','SwitchPro','JoyconGrip','Gamecube'];
 const records=[];
 for(const id of models){
  const rig=await loadNativeRig(CONTROLLERS.find(m=>m.id===id),read);
  try{
   const before=rig.meshes.length;
   const state=prepareInteriorHousingContours(rig);
   records.push({id,segments:state.segments});
   assert.ok(state.segments<=INTERIOR_CONTOUR_POLICY.maxSegments,id+' bounded source edge budget');
   assert.equal(rig.meshes.length,before,id+' line is not a duplicated PBR part');
   assert.equal(state.lines.parent,rig.group);
  }finally{disposeNativeRig(rig);}
 }
 // The practical usability test is that both the chosen Generic source and
 // the Sony/Xbox form family actually expose relevant *internal* crease edges.
 assert.ok(records.filter(x=>x.segments>0).length>=3,
  'Less than three physically authored models have eligible internal creases: '+JSON.stringify(records));
});

test('GameCube uses only genuine front inset opening edges in addition to structural creases',async()=>{
  const rig=await loadNativeRig(CONTROLLERS.find(m=>m.id==='Gamecube'),read);
  try{
    const original=extractInteriorHousingEdges(rig.meshes,rig.group);
    const insets=extractInteriorHousingEdges(rig.meshes,rig.group,{includeGameCubeInsets:true});
    assert.ok(insets.length>original.length,
      'original GameCube apertures must add visible interior lines to '+original.length+' ordinary creases');
    const native=prepareInteriorHousingContours(rig);
    assert.equal(native.gameCube,true);
    assert.equal(native.segments,insets.length);
    updateInteriorHousingContours(rig,{mix:.7});
    assert.ok(native.material.opacity>interiorContourOpacity(.7));
    updateInteriorHousingContours(rig,{mix:1});
    assert.equal(native.material.opacity,0,'fully transparent Ghost still hides internal seams');
  }finally{disposeNativeRig(rig);}
});

test('GameCube lower-left D-pad recess receives a complete subtle contour beside the C-stick recess',async()=>{
  const rig=await loadNativeRig(CONTROLLERS.find(m=>m.id==='Gamecube'),read);
  try{
    rig.group.updateMatrixWorld(true);
    const inverse=new THREE.Matrix4().copy(rig.group.matrixWorld).invert();
    const center=file=>new THREE.Box3().setFromObject(
      rig.meshes.find(m=>m.userData.sourceFile===file)).getCenter(new THREE.Vector3()).applyMatrix4(inverse);
    const dpad=['up','down','left','right'].map(dir=>center('dpad_'+dir+'.obj'));
    const left=dpad.reduce((c,p)=>c.add(p),new THREE.Vector3()).multiplyScalar(.25);
    const right=center('right_ring.obj');
    const count=(edges,c)=>edges.filter(e=>{
      const mid=e.a.clone().add(e.b).multiplyScalar(.5);
      return Math.hypot(mid.x-c.x,mid.y-c.y)<.58;
    }).length;
    const before=extractInteriorHousingEdges(rig.meshes,rig.group);
    const after=extractInteriorHousingEdges(rig.meshes,rig.group,{includeGameCubeInsets:true});
    const leftBefore=count(before,left),leftAfter=count(after,left),rightAfter=count(after,right);
    assert.ok(leftAfter>=leftBefore+20,
      'Missing source-authored shallow left rim: '+JSON.stringify({leftBefore,leftAfter,rightAfter}));
    assert.ok(rightAfter>=12,'Right inset must still retain its original contour');
    assert.ok(leftAfter>=rightAfter*.45&&leftAfter<=rightAfter*2.25,
      'Both lower lobes need comparable inner contour density, not a one-sided rim: '+
        JSON.stringify({leftAfter,rightAfter}));
    const originalTriangles=rig.triangles,originalMeshes=rig.meshes.length;
    prepareInteriorHousingContours(rig);
    assert.equal(rig.triangles,originalTriangles,'source surface geometry unchanged');
    assert.equal(rig.meshes.length,originalMeshes,'no new controller mesh or per-button draw');
  }finally{disposeNativeRig(rig);}
});
