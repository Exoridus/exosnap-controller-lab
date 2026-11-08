import test from 'node:test';
import assert from 'node:assert/strict';
import {ledStates,ledMaskForPlayerIndex,previewPlayerIndex,previewLabel,SDL_SWITCH_LED_MASKS} from '../controller-player-leds.js';
test('Nintendo player index follows actual SDL HIDAPI mask sequence, not one-hot P2-P4',()=>{
  assert.deepEqual(SDL_SWITCH_LED_MASKS,[1,3,7,15,9,5,13,6]);
  for(let i=0;i<8;i++){assert.equal(ledMaskForPlayerIndex(i),SDL_SWITCH_LED_MASKS[i]);assert.equal(ledStates(SDL_SWITCH_LED_MASKS[i]).length,4);}
  assert.equal(ledMaskForPlayerIndex(8),1);
  assert.equal(ledMaskForPlayerIndex(-1),0);
  assert.throws(()=>ledMaskForPlayerIndex(-2),RangeError);
});
test('browser slot fallback and manual web preview never assert physical or SDL reads',()=>{
  assert.deepEqual(previewPlayerIndex('auto',null),{index:0,mask:1,browserSlot:null,source:'demo'});
  assert.deepEqual(previewPlayerIndex('auto',3),{index:3,mask:15,browserSlot:3,source:'browser-slot'});
  assert.equal(previewPlayerIndex('off',3).mask,0);
  assert.equal(previewPlayerIndex('2',3).index,2);
  assert.match(previewLabel(previewPlayerIndex('auto',3)),/Browser-Slot 3.*nur Vorschau/);
  assert.throws(()=>previewPlayerIndex('99'),RangeError);
});
