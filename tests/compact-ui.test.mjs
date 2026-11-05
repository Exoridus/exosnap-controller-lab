import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('six-up preview is the visible UI; Normal/Glass/Ghost are active stops',()=>{
  assert.match(html,/class="viewer-controls"/);
  assert.match(html,/id="simpleModel"/);
  assert.match(html,/id="simpleLookMix"[^>]*value="50"/);
  for(const stop of ['0','0.5','1'])assert.ok(html.includes(`data-look="${stop}"`),stop);
  assert.match(html,/class="quick-controls"/); // legacy adapter, not the live toolbar
  assert.match(html,/<section(?=[^>]*class="quick-controls")(?=[^>]*aria-hidden="true")[^>]*>/);
  assert.doesNotMatch(html,/<aside class="inspector"/);
  assert.doesNotMatch(css,/min-height:590px/);
});

test('legacy gyro setup remains functional but absent from focused preview',()=>{
  for(const id of ['motionPose','motionCalibrate','motionRecenter','motionStatus','motionTilt'])
    assert.ok(html.includes(`id="${id}"`),id);
  for(const posture of ['held','flat','upright'])assert.ok(html.includes(`value="${posture}"`));
  assert.match(app,/motionFusion\.startCalibration/);
  assert.match(html,/id="simpleMode"/);
});

test('camera uses the correctly oriented, unreflected 3D model transform',()=>{
  assert.match(app,/frontFaceTransform\((?:sourceModel|model)\.source\)/);
  assert.match(app,/reoriented\.scale\.setScalar\(modelScale\)/);
  assert.doesNotMatch(app,/reoriented\.scale\.set\(modelScale,\s*model\.source===/);
  assert.match(app,/orbit\.enablePan=true/);
  assert.match(app,/orbit\.maxDistance=(?:32|36|40|48|50)/);
});
