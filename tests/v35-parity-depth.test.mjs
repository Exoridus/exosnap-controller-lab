import * as THREE from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {resolveHeroRecipe,qtQuickDescriptor} from '../pbr-recipes.js';
import {EXO_PALETTE} from '../palette.js';
import {resolve2DPaint} from '../material-paint.js';
import {depthPriority,prepareGhostOcclusion} from '../ghost-depth-policy.js';
const read=async url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');

test('2D and 3D derive pressed and idle controls from the same hero recipe and semantic palette',()=>{
  for(const hero of ['solid','ghost']) for(const mix of [0,.5,1]){
    const recipe=resolveHeroRecipe(hero,mix);
    const dark=resolve2DPaint(recipe,'dark');
    const light=resolve2DPaint(recipe,'light');
    const mixed=resolve2DPaint(recipe,'mixed');
    assert.equal(dark.pressedBlue,recipe.material.pressBlue);
    assert.equal(light.pressedBlue,EXO_PALETTE.pressedBlue);
    assert.equal(mixed.pressedBlue,dark.pressedBlue);
    assert.equal(dark.idleControl,recipe.material.controls.idleTint);
    assert.equal(light.idleControl,dark.idleControl);
    assert.ok(dark.controlsOpacity>=dark.shellOpacity);
    assert.ok(light.controlsOpacity>=light.shellOpacity);
    assert.equal(dark.pressedOpacity,1);
    assert.equal(light.pressedOpacity,1);
    assert.notEqual(light.outlineColor,dark.outlineColor);
    assert.deepEqual(dark.emission,{color:EXO_PALETTE.pressedEmissive,intensity:recipe.material.pressEmissiveIntensity});
  }
});

test('depth order writes the front shell and cap before potentially hidden pieces',()=>{
  assert.ok(depthPriority('housing','top_shell.obj')<depthPriority('housing','bottom_shell.obj'));
  assert.ok(depthPriority('housing','bottom_shell.obj')<depthPriority('trigger','left_trigger.obj'));
  assert.ok(depthPriority('stick-cap','left_cap.obj')<depthPriority('stick-pivot','left_ring.obj'));
  assert.ok(depthPriority('stick-pivot','left_ring.obj')<depthPriority('stick-stem','left_stick.obj'));
});

test('actual OBJ rig uses physical depth occlusion, does not merely dim rear controllers',async()=>{
  const rig=await loadNativeRig(CONTROLLERS[0],read);
  try{
    prepareGhostOcclusion(rig);
    const r=resolveHeroRecipe('ghost',1);
    applyPbrRecipeToRig(rig,r,false);
    const top=rig.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
    const bottom=rig.meshes.find(m=>m.userData.sourceFile==='bottom_shell.obj');
    const bumper=rig.meshes.find(m=>m.userData.sourceFile==='left_bumper.obj');
    const cap=rig.meshes.find(m=>m.userData.sourceFile==='left_cap.obj');
    const ring=rig.meshes.find(m=>m.userData.sourceFile==='left_ring.obj');
    assert.ok(top.renderOrder<bottom.renderOrder);
    assert.ok(top.renderOrder<bumper.renderOrder);
    assert.ok(cap.renderOrder<ring.renderOrder);
    for(const mesh of [top,bottom,bumper,cap,ring]){
      assert.equal(mesh.material.depthTest,true);
      assert.equal(mesh.material.depthWrite,true);
    }
    assert.equal(bumper.material.opacity,r.material.controls.opacity, 'no rear control opacity heuristic');
  }finally{disposeNativeRig(rig)}
});

test('pressed controls emit shared LED blue on opaque surfaces',async()=>{
  const rig=await loadNativeRig(CONTROLLERS[0],read);
  try{
    const r=resolveHeroRecipe('ghost',.9);
    applyPbrRecipeToRig(rig,r,true);
    const button=rig.meshes.find(m=>m.userData.sourceFile==='x_button.obj');
    assert.equal(button.material.opacity,1);
    assert.ok(button.material.emissiveIntensity>=.4);
    assert.equal(r.material.pressEmissive,EXO_PALETTE.pressedEmissive);
    assert.equal(button.material.emissive.getHexString(),EXO_PALETTE.pressedEmissive.slice(1));
    const descriptor=qtQuickDescriptor(r);
    assert.equal(descriptor.pressEmissive.color,r.material.pressEmissive);
  }finally{disposeNativeRig(rig)}
});

test('material lab exposes synchronized flat 2D rows, retains only one mix slider',async()=>{
  const html=await read('./pbr-lab.html');
  const js=await read('./pbr-lab.js');
  const reference=await read('./controller-reference.js');
  // Material opacity still has exactly one slider; the additional range input
  // is solely an explicit L2/R2 analog input simulator, not another material knob.
  assert.equal((html.match(/id="materialMix"/g)||[]).length,1);
  assert.equal((html.match(/id="triggerPressure"/g)||[]).length,1);
  assert.equal((html.match(/type="range"/g)||[]).length,2);
  assert.ok(js.includes('ControllerReference'), 'same renderer for all 2D layouts');
  assert.ok(js.includes('flatSampleNodes'), 'one 2D sample per 3D viewport');
  assert.ok(reference.includes('applyMaterialAppearance'), 'same material recipe sent to 2D');
  assert.ok(reference.includes('EXO_PALETTE'), 'no unrelated blue constant in 2D');
});

test('dashed hidden-control lines use actual per-panel pixel resolution',async()=>{
  const {setRearHintViewport}=await import('../ghost-depth-policy.js');
  const rig=await loadNativeRig(CONTROLLERS[0],read);
  try{
    prepareGhostOcclusion(rig);
    assert.ok(rig.rearHintLines.length>=2,'at least two shoulder outlines');
    setRearHintViewport(rig,320,214);
    for(const h of rig.rearHintLines){
      assert.deepEqual(h.material.resolution.toArray(),[320,214]);
      assert.equal(h.material.depthFunc,THREE.GreaterDepth);
    }
  }finally{disposeNativeRig(rig)}
});
