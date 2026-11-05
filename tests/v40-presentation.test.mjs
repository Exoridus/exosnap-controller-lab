import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {resolveHeroRecipe,qtQuickDescriptor} from '../pbr-recipes.js';
import {prepareGhostOcclusion,depthPriority,hideOccludedRearControls} from '../ghost-depth-policy.js';
import {sceneContrastProfile,createContrastCompositeMaterial,updateContrastComposite} from '../silhouette-composite.js';
import {resolve2DPaint} from '../material-paint.js';

const read=async url=>fs.promises.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');

test('transparent front cap writes depth before fixed well and rear trigger stays behind shell',()=>{
 assert.ok(depthPriority('stick-cap','left_cap.obj')<depthPriority('stick-base','left_ring.obj'));
 assert.ok(depthPriority('stick-pivot','left_ring.obj')<depthPriority('stick-well','left_fixed_socket.obj'));
 assert.ok(depthPriority('housing','top_shell.obj')<depthPriority('trigger','left_trigger.obj'));
});

test('rear triggers do not paint complete controls through the front of ghost shell; actual rear view restores them',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 try{
  prepareGhostOcclusion(rig);
  const trigger=rig.meshes.find(m=>m.userData.role==='trigger');
  assert.ok(trigger,'native trigger present');
  const recipe=resolveHeroRecipe('ghost',.7);
  hideOccludedRearControls(rig,recipe,{yaw:0});
  assert.equal(trigger.material.colorWrite,false);
  assert.equal(trigger.material.depthWrite,false);
  hideOccludedRearControls(rig,recipe,{yaw:Math.PI});
  assert.equal(trigger.material.colorWrite,true);
  hideOccludedRearControls(rig,resolveHeroRecipe('solid',0),{yaw:0});
  assert.equal(trigger.material.colorWrite,true);
 }finally{disposeNativeRig(rig)}
});

test('dark, light and mixed silhouette profiles differ and protect opaque press colors',()=>{
 const profiles=['dark','light','mixed'].map(sceneContrastProfile);
 assert.equal(new Set(profiles.map(p=>p.mode)).size,3);
 assert.ok(profiles[1].darkStrength>profiles[0].darkStrength);
 assert.ok(profiles[0].lightStrength>profiles[1].lightStrength);
 assert.ok(profiles[2].lightStrength>0&&profiles[2].darkStrength>0);
 for(const p of profiles)assert.ok(p.preserveOpaque===true);
 const mat=createContrastCompositeMaterial(new THREE.Texture());
 assert.equal(mat.transparent,true);
 assert.equal(mat.depthWrite,false);
 updateContrastComposite(mat,'light',{width:320,height:214});
 assert.equal(mat.uniforms.mode.value,1);
 assert.deepEqual(mat.uniforms.pixelSize.value.toArray(),[1/320,1/214]);
 mat.dispose();
});

test('2D light and mixed material keeps structural lines and readable control fill without changing source SVG',()=>{
 const r=resolveHeroRecipe('ghost',.7);
 const dark=resolve2DPaint(r,'dark');const light=resolve2DPaint(r,'light');const mixed=resolve2DPaint(r,'mixed');
 assert.notEqual(light.shellFill,dark.shellFill);
 assert.notEqual(light.strokeColor,dark.strokeColor);
 assert.ok(light.shellOpacity>=dark.shellOpacity);
 assert.ok(mixed.shellOpacity>=dark.shellOpacity);
 assert.equal(light.pressedBlue,dark.pressedBlue);
});

test('6-column grid scrolls horizontally while wheel over any viewer zooms, not vertically scrolls',()=>{
 const css=fs.readFileSync(new URL('../pbr-lab.css',import.meta.url),'utf8');
 const js=fs.readFileSync(new URL('../pbr-lab.js',import.meta.url),'utf8');
 assert.match(css,/grid-template-columns:\s*repeat\(6,var\(--panel-width\)\)/);
 assert.match(css,/overflow-x:\s*auto/);
 assert.match(js,/gallery\.addEventListener\('wheel'/);
 assert.match(js,/e\.target\.closest\('\.sample'\)/);
 assert.match(js,/e\.preventDefault\(\)/);
 assert.match(js,/updateContrastComposite/);
 assert.match(js,/for\(const sceneName of scenes\)/);
});

test('Qt port descriptor admits compositor shader cost instead of promising material-only parity',()=>{
 const qt=qtQuickDescriptor(resolveHeroRecipe('ghost',.7));
 assert.equal(qt.usesCustomShader,true);
 assert.equal(qt.usesPostprocess,true);
 assert.deepEqual(Object.keys(qt.backgroundContrast),['dark','light','mixed']);
 const c=createContrastCompositeMaterial(new THREE.Texture());
 assert.match(c.fragmentShader,/gl_FragColor\.rgb\*=gl_FragColor\.a/);
 c.dispose();
});
