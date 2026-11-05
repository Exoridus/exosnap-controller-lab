import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AXIS_MAPPING, validAxisMapping, mapAxes } from '../axis-alignment.js';

// The exact mapping was measured with a real DualSense on this viewer and is
// a VIEWER transform, not Sony's or SDL's fixed sensor axis order.
test('DualSense viewer axis profile is usable without a guided three-gesture setup',()=>{
  assert.deepEqual(DEFAULT_AXIS_MAPPING,[
    {index:0,sign:1},{index:2,sign:-1},{index:1,sign:1}
  ]);
  assert.equal(validAxisMapping(DEFAULT_AXIS_MAPPING),true);
  assert.deepEqual(mapAxes([1,2,3]),[1,-3,2]);
});
