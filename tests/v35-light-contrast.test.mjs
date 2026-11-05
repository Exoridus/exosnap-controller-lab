import test from 'node:test';import assert from 'node:assert/strict';
import {EXO_PALETTE} from '../palette.js';
import {recolorNeutralForLight} from '../parity-color.js';
const parse=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
test('themed dark-background SVG outlines become darker on the light panel without altering active blue or alpha',()=>{
 const x=new Uint8ClampedArray([...parse(EXO_PALETTE.strokeDark),144,...parse(EXO_PALETTE.outlineDark),208,...parse(EXO_PALETTE.pressedBlue),182]);
 recolorNeutralForLight(x);
 assert.deepEqual([...x.slice(0,3)],parse(EXO_PALETTE.strokeLight));
 assert.deepEqual([...x.slice(4,7)],parse(EXO_PALETTE.outlineLight));
 assert.deepEqual([...x.slice(8,11)],parse(EXO_PALETTE.pressedBlue));
 assert.deepEqual([x[3],x[7],x[11]],[144,208,182]);
});
