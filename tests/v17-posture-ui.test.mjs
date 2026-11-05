import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOTION_TUNING_DEFAULTS,sanitizeMotionTuning,loadMotionTuning,saveMotionTuning} from '../motion-tuning.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('obsolete posture freeze is not a default; adaptive reference is opt-in',()=>{
  assert.equal(MOTION_TUNING_DEFAULTS.adaptiveHand,false);
  assert.equal(MOTION_TUNING_DEFAULTS.autoReturn,false);
  assert.equal('autoPostureSwitch' in MOTION_TUNING_DEFAULTS,false);
});
test('opt-in adaptive reference user preference persists across browser restarts',()=>{
  const saved=new Map();
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,val)=>saved.set(key,val)};
  assert.equal(saveMotionTuning(storage,{adaptiveHand:true}),true);
  assert.equal(loadMotionTuning(storage).adaptiveHand,true);
  assert.equal(sanitizeMotionTuning({adaptiveHand:'false'}).adaptiveHand,false);
});
test('v18 uses opt-in continuously adaptive hand reference instead of holding the scene',()=>{
  assert.match(html, /id="motionAdaptiveHand"/);
  assert.match(app, /adaptiveReference/);
  assert.match(html, /id="postureReadout"/);
});
