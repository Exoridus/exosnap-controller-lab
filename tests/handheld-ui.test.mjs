import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('hand-neutral calibration settings remain behind the legacy adapter',()=>{
  assert.match(html,/<section(?=[^>]*class="quick-controls")(?=[^>]*aria-hidden="true")[^>]*>/);
  for(const pair of [['held','In Hand'],['flat','Flach (Tisch)'],['upright','Aufrecht']])
    assert.ok(html.includes(`value="${pair[0]}">${pair[1]}</option>`),pair[0]);
  assert.match(app,/motionFusion\.startCalibration/);
});
test('handheld, direct and 360 remain implemented without cluttering main preview',()=>{
  for(const pair of [['overlay','Handhaltung'],['direct','Direkt ±'],['free','360° frei']])
    assert.ok(html.includes(`value="${pair[0]}">${pair[1]}</option>`),pair[0]);
  assert.match(html,/id="simpleMode"/);
  assert.match(app,/presentationOrientation\(\{mode,relative,motion:handheldMotion/);
});
test('render path uses the stabilized pose and frame-time-aware quaternion interpolation',()=>{
  assert.match(app,/new HandheldOverlayMotion\(loadMotionTuning\(motionStorage\)\)/);
  assert.match(app,/presentationOrientation\(\{mode,relative,motion:handheldMotion/);
  assert.match(app,/1-Math\.exp\(-frameDt\/frameTau\)/);
  assert.match(app,/handheldMotion\.options\.adaptiveHand\?\.015:\.045/);
});
