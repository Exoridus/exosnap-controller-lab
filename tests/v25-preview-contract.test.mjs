import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles-simple.css',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
test('minimal 3D viewer exposes one model selector, live input, camera and three material stops',()=>{
  assert.equal(new Set(ids).size,ids.length,'no duplicate element IDs');
  for(const id of ['scene','simpleModel','simpleMode','simpleBackground','simpleReset','simpleLookMix','simpleDetails','simpleShell','simpleControl','simpleRim'])assert.ok(ids.includes(id),id);
  for(const x of [0,.5,1])assert.ok(html.includes(`data-look="${x}"`),`style ${x}`);
  for(const obsolete of ['simpleHalo','simpleShadow','simpleContour'])assert.ok(!ids.includes(obsolete),`obsolete ${obsolete} slider should be gone`);
  assert.ok(css.includes('.quick-controls{display:none!important}'));
  assert.ok(app.includes("$('simpleMode').addEventListener('change'"));
  assert.ok(app.includes('orbit.enabled=!referenceView'));
});
test('legacy adapters remain addressable while the motion UI is out of sight',()=>{
  const legacy=['controllerSelect','inputSource','gamepadDevice','motionTilt','orbitToggle','motionCalibrate','motionTuningPanel','resetView'];
  for(const id of legacy)assert.ok(ids.includes(id),id);
  assert.ok(html.includes('aria-hidden="true"'));
  assert.ok(app.includes("$('motionTilt').checked=false"));
});
test('style updates uniforms and visual parameters without reconstructing a controller',()=>{
  assert.ok(app.includes('function syncStyleMaterials()'));
  assert.ok(app.includes('mat.userData.rimUniform.value=look.rim'));
  assert.ok(app.includes('exo-controller-v25-shell-rim-v1'));
  assert.ok(app.includes('setLookBlend(Number(event.target.value)/100)'));
  assert.ok(app.includes('for(const moving of [ring,stem,cap])'));
  assert.ok(app.includes('ring.userData.control=null'));
  assert.ok(!app.includes('mat.userData.baseColor=new THREE.Color('));
});
