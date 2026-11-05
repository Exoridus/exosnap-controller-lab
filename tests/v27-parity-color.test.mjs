import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recolorNeutralForLight } from '../parity-color.js';
test('light reference remaps neutral white lines and preserves their alpha',()=>{
  const x=new Uint8ClampedArray([255,255,255,135,225,225,225,255,80,181,255,255]);
  recolorNeutralForLight(x);
  assert.deepEqual([...x.slice(0,4)],[46,67,89,135]);
  assert.ok(x[4]<100&&x[5]<100&&x[6]<120);
  assert.deepEqual([...x.slice(8,12)],[80,181,255,255]);
});
test('dark/colored elements and transparent pixels are untouched',()=>{
  const x=new Uint8ClampedArray([10,10,10,255,255,255,255,0,150,192,220,255,92,181,246,192]);
  const before=[...x];recolorNeutralForLight(x);
  assert.deepEqual([...x],before);
});
