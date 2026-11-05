import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig} from '../pbr-model.js';
const root=path.resolve(import.meta.dirname,'..');
const text=path=>readFile(path,'utf8');
const load=async url=>text(path.resolve(root,url.replace(/^\.\//,'')));

test('full original DualSense manifest and real OBJ triangles are used',async()=>{
  const model=CONTROLLERS.find(x=>x.id==='DualSenseCompact');
  const native=await loadNativeRig(model,load);
  assert.equal(native.partCount,27);
  assert.equal(native.parts.length,27);
  assert.ok(native.meshes.length>=25);
  assert.ok(native.triangles>1000);
  assert.equal(new Set(native.parts.map(p=>p.file)).size,27);
  assert.ok(native.meshes.every(m=>m.isMesh && m.geometry?.attributes?.position?.count>0));
  assert.ok(native.meshes.every(m=>m.material instanceof THREE.MeshPhysicalMaterial));
});
test('native parent hierarchy, distinct model colors and view scale are preserved',async()=>{
  const native=await loadNativeRig(CONTROLLERS[0],load);
  const byFile=new Map(native.parts.map(x=>[x.file,x.holder]));
  assert.equal(byFile.get('left_cap.obj').parent,byFile.get('left_ring.obj'));
  assert.equal(byFile.get('right_cap.obj').parent,byFile.get('right_ring.obj'));
  const shell=native.parts.find(p=>p.file==='top_shell.obj').holder;
  const base=native.parts.find(p=>p.file==='bottom_shell.obj').holder;
  const shellColor=shell.children[0].children.find(x=>x.isMesh)?.userData?.sourceColor;
  const baseColor=base.children[0].children.find(x=>x.isMesh)?.userData?.sourceColor;
  assert.ok(shellColor && baseColor && !shellColor.equals(baseColor));
  const size=new THREE.Box3().setFromObject(native.group).getSize(new THREE.Vector3());
  assert.ok(Math.abs(Math.max(size.x,size.y,size.z)-4.05)<.0002);
  assert.ok(new THREE.Box3().setFromObject(native.group).getCenter(new THREE.Vector3()).length()<.001);
});
test('source triangle geometry is never replaced with silhouette proxies',async()=>{
  const native=await loadNativeRig(CONTROLLERS[0],load);
  const files=native.meshes.map(x=>x.userData.sourceFile);
  assert.ok(files.includes('top_shell.obj') && files.includes('left_cap.obj'));
  assert.equal(native.parts.filter(p=>p.holder.userData.placeholder).length,0);
});
