import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('handheld and 360 adapters remain wired while camera stays free in preview',()=>{
  assert.match(html,/<section(?=[^>]*class="quick-controls")(?=[^>]*aria-hidden="true")[^>]*>/);
  for(const mode of ['overlay','direct','free'])assert.ok(html.includes(`value="${mode}"`));
  assert.match(app,/presentationOrientation\(\{mode,relative,motion:handheldMotion/);
  assert.match(app,/from '.\/motion-render-policy\.js'/);
  assert.match(app,/selectView\('front',true\)/);
  assert.match(app,/updateCameraLock\(\)/);
  assert.match(app,/orbit\.enablePan=true/);
});
test('safe preview is initial state; live Gamepad/HID is user-selectable',()=>{
  assert.match(html,/id="simpleMode"[^>]*><option value="manual">Vorschau<\/option><option value="live">Controller \(Live\)<\/option>/);
  assert.match(app,/let inputMode='manual'/);
  assert.match(app,/\$\('simpleMode'\)\.value='manual'/);
  assert.match(app,/let autoModel=true/);
  assert.match(app,/readStandardGamepad\(pad\)/);
  assert.match(app,/detectedGamepadId/);
});
test('pressed controls remain blue; the active style has no contour slider',()=>{
  assert.match(css,/\.control-key\.pressed/);
  assert.match(app,/pressedControlStyle/);
  assert.match(html,/data-look="1"/);
  assert.match(html,/id="simpleLookMix"/);
  assert.ok(!html.includes('id="simpleContour"'));
});
