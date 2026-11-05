import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_TUNING_DEFAULTS,MOTION_TUNING_PRESETS,matchMotionPreset,sanitizeMotionTuning} from '../motion-tuning.js';

test('comfort preset matches default and balanced/dynamic provide deliberately wider response',()=>{
  assert.equal(matchMotionPreset(MOTION_TUNING_DEFAULTS),'comfort');
  assert.equal(MOTION_TUNING_PRESETS.balanced.yawGain,.88);
  assert.equal(MOTION_TUNING_PRESETS.dynamic.yawMaxDeg,42);
  assert.ok(MOTION_TUNING_PRESETS.dynamic.rollMaxDeg>MOTION_TUNING_DEFAULTS.rollMaxDeg);
  assert.ok(MOTION_TUNING_PRESETS.dynamic.responseMs<MOTION_TUNING_DEFAULTS.responseMs);
});
test('changing recenter toggle preserves selected preset but editing yaw makes it custom',()=>{
  const opt=sanitizeMotionTuning({...MOTION_TUNING_PRESETS.comfort,autoReturn:true});
  assert.equal(matchMotionPreset(opt),'comfort');
  opt.yawGain=.47;
  assert.equal(matchMotionPreset(opt),'custom');
});
