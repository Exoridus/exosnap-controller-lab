import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOTION_TUNING_DEFAULTS,loadMotionTuning,saveMotionTuning,MOTION_TUNING_STORAGE_KEY} from '../motion-tuning.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('combined roll/yaw motion setting still has a bound legacy adapter',()=>{
  assert.match(html,/id="rollYawCombinedMaxDeg"/);
  assert.match(html,/id="rollYawCombinedMaxDegValue"/);
  assert.match(app,/MOTION_TUNING_FIELDS\s*=\s*\[[^\]]*rollYawCombinedMaxDeg/);
  assert.match(app,/'rollYawCombinedMaxDeg'/);
  assert.match(html,/<section(?=[^>]*class="quick-controls")(?=[^>]*aria-hidden="true")[^>]*>/);
});
test('migrates old untouched v15 comfort preset to new defaults, retains recenter choice',()=>{
  const map=new Map();
  const store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  map.set('exosnap-controller3d-motion-tuning-v1',JSON.stringify({
    pitchGain:.75,rollGain:.65,yawGain:.55,pitchMaxDeg:35,rollMaxDeg:22,yawMaxDeg:25,
    deadzoneDeg:.35,responseMs:65,autoReturn:true
  }));
  const settings=loadMotionTuning(store);
  assert.equal(settings.pitchGain,MOTION_TUNING_DEFAULTS.pitchGain);
  assert.equal(settings.rollYawCombinedMaxDeg,20);
  assert.equal(settings.autoReturn,true);
});

test('migrates deliberate v15 custom adjustments without losing them',()=>{
  const map=new Map();
  const store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  map.set('exosnap-controller3d-motion-tuning-v1',JSON.stringify({
    pitchGain:.95,rollGain:.88,yawGain:.74,pitchMaxDeg:22,rollMaxDeg:19,yawMaxDeg:16,
    deadzoneDeg:.27,responseMs:45,autoReturn:false
  }));
  const settings=loadMotionTuning(store);
  assert.equal(settings.yawGain,.74);
  assert.equal(settings.responseMs,45);
  assert.equal(settings.rollYawCombinedMaxDeg,20);
  assert.ok(saveMotionTuning(store,settings));
  assert.ok(map.get(MOTION_TUNING_STORAGE_KEY));
});
