import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('motion tuning logic remains available, but the large inspector stays hidden',()=>{
  assert.match(html,/<section(?=[^>]*class="quick-controls")(?=[^>]*aria-hidden="true")[^>]*>/);
  assert.match(html,/id="motionTuningToggle"/);
  assert.match(html,/id="motionTuningPanel"/);
  assert.match(html,/id="motionAutoReturn"/);
  for(const id of ['pitchGain','rollGain','yawGain','pitchMaxDeg','rollMaxDeg','yawMaxDeg','deadzoneDeg','responseMs']){
    assert.ok(html.includes(`id="${id}"`),id);
    assert.ok(html.includes(`id="${id}Value"`),id+' output');
  }
  assert.match(html,/id="motionTuningReset"/);
  assert.match(app,/\$\('motionTuningToggle'\)\.addEventListener/);
});
test('settings are applied to handheld and direct modes, saved and restored',()=>{
  assert.match(app,/loadMotionTuning/);
  assert.match(app,/saveMotionTuning/);
  assert.match(app,/handheldMotion\.setOptions/);
  assert.match(app,/presentationOrientation\(\{mode,relative,motion:handheldMotion/);
});
test('three.js output uses shorter smoothing for immediate handheld response',()=>{
  assert.match(app,/handheldMotion\.options\.adaptiveHand\?\.015:\.045/);
});
