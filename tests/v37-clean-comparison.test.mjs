import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {resolveHeroRecipe,HERO_VARIANTS} from '../pbr-recipes.js';
import {resolve2DPaint} from '../material-paint.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {EXO_PALETTE} from '../palette.js';
import {LAB_VARIANTS} from '../controller-lab-style.js';

const html=fs.readFileSync(new URL('../pbr-lab.html',import.meta.url),'utf8');
const gallery=fs.readFileSync(new URL('../pbr-lab.js',import.meta.url),'utf8');
const matrix=fs.readFileSync(new URL('../look-matrix.html',import.meta.url),'utf8');

function nativeOneButton(){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshPhysicalMaterial());
  mesh.userData={role:'button',sourceFile:'x_button.obj',control:'b1',sourceColor:new THREE.Color('#445566')};
  const group=new THREE.Group();group.add(mesh);
  return {meshes:[mesh],group,parts:[],stickInstances:[]};
}

test('Ghost press remains shaded, uses shared active color and avoids opaque white sticker',()=>{
  const native=nativeOneButton();
  const recipe=resolveHeroRecipe('ghost',1);
  applyPbrRecipeToRig(native,recipe,{allPressed:true});
  const m=native.meshes[0].material;
  assert.ok(m.opacity>=recipe.material.controls.opacity&&m.opacity<1);
  assert.equal(recipe.material.pressBlue,EXO_PALETTE.pressedSurface);
  assert.ok(m.emissiveIntensity>.15&&m.emissiveIntensity<.3,'retain lit surface shading');
  const flat=resolve2DPaint(recipe,'light');
  assert.equal(flat.pressedOpacity,1);
  assert.equal(flat.pressedBlue,recipe.material.pressBlue);
  assert.equal(flat.pressedEdge,EXO_PALETTE.pressedEdge);
});

test('off button stays translucent in Ghost and restores without new geometry',()=>{
  const native=nativeOneButton(),geo=native.meshes[0].geometry;
  const recipe=resolveHeroRecipe('ghost',1);
  applyPbrRecipeToRig(native,recipe,{allPressed:true});
  applyPbrRecipeToRig(native,recipe,{allPressed:false});
  assert.strictEqual(native.meshes[0].geometry,geo);
  assert.ok(native.meshes[0].material.opacity<1);
  assert.equal(native.meshes[0].material.emissiveIntensity,0);
});

test('main comparison has two feedback variants and one independent authored 2D row',()=>{
  assert.deepEqual(LAB_VARIANTS.map(x=>x.key),['white','cool']);
  assert.deepEqual(HERO_VARIANTS.map(x=>x.key),['solid','ghost','outline','identity'],'historical recipes remain available');
  assert.doesNotMatch(html,/<iframe\b/i);
  assert.doesNotMatch(matrix,/<iframe\b/i);
  assert.match(html,/id="gallery"/);
  assert.match(html,/data-look="white"/);
  assert.match(html,/data-look="cool"/);
  assert.match(gallery,/className='look-views'/);
  assert.match(gallery,/className='sample sample--flat'/);
  assert.match(gallery,/canvas.id='threeCanvas'/);
});

test('Qt Quick 3D material reference also uses opaque bright LED faces',()=>{
  const qml=fs.readFileSync(new URL('../qt-quick3d-port/ControllerSurface.qml',import.meta.url),'utf8');
  assert.match(qml,/property color pressedBlue:\s*"#4f9eeb"/);
  assert.match(qml,/property real pressedOpacity:\s*1\.0/);
  assert.match(qml,/opacity:\s*pressedAmount > 0\.001 \? 1\.0 : surfaceOpacity/);
  assert.doesNotMatch(qml,/Math\.min\(0\.90/);
});

test('initial view and controls match the visible default settings',()=>{
  assert.match(gallery,/selected:'white',view:'front',panelWidth:320/);
  assert.match(gallery,/yaw:0,pitch:0,radius:7\.8/);
  assert.match(html,/<option value="front" selected>/);
  assert.match(html,/value="70" id="materialMix"/);
});
