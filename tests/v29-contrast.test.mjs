import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three';

const moduleUrl=new URL('../contrast-pass.js',import.meta.url);
test('contrast uses actual source meshes and groups stick surfaces by their physical control',async()=>{
  assert.ok(existsSync(moduleUrl),'the silhouette must come from a same-scene GPU mask, not a projected convex hull');
  const {ContrastPass}=await import(moduleUrl);
  const pass=new ContrastPass();
  const geometry=new THREE.BoxGeometry();
  const objects=['housing','stick-pivot','stick-stem','stick-cap','button'].map(()=>new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()));
  const holders=objects.map((mesh,i)=>({userData:{shell:i===0,control:i===1?'ls':i===4?'b1':null,visualControl:i===2||i===3?'ls':null,meshes:[mesh]}}));
  pass.setModel(holders);
  assert.equal(pass.meshCount,5);
  assert.equal(objects[1].userData.contrastId,objects[2].userData.contrastId);
  assert.equal(objects[2].userData.contrastId,objects[3].userData.contrastId);
  assert.notEqual(objects[3].userData.contrastId,objects[4].userData.contrastId);
  assert.ok(objects.every(m=>m.geometry===geometry),'mask shares the exact geometry');
  assert.ok(objects.every(m=>m.layers.isEnabled(1)));
  pass.dispose();
  assert.ok(objects.every(m=>!m.layers.isEnabled(1)),'mask registration is removed cleanly');
  geometry.dispose();objects.forEach(m=>m.material.dispose());
});

test('contrast defaults to one selected technique and validates diagnostic alternatives',async()=>{
  assert.ok(existsSync(moduleUrl),'contrast pass exists');
  const {contrastVariant,CONTRAST_VARIANTS}=await import(moduleUrl);
  assert.deepEqual(Object.keys(CONTRAST_VARIANTS),['off','A','B','C','D','E']);
  assert.equal(contrastVariant('invalid'),'D');
  assert.equal(contrastVariant(null),'D');
  for(const key of Object.keys(CONTRAST_VARIANTS))assert.equal(contrastVariant(key),key);
});

test('preview has no convex-hull shadow or synthetic floor ellipse',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/createRadialGradient\(/,'no floor ellipse in any view');
  assert.doesNotMatch(app,/function projectedHull\(/,'concavities must come from mesh coverage');
  assert.doesNotMatch(app,/classList\.add\('separation-svg'\)/,'no parallel DOM shadow');
});
