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
  assert.deepEqual(previewPlayerIndex('demo',null),{index:0,mask:1,browserSlot:null,source:'demo'});
  assert.deepEqual(previewPlayerIndex('auto',3),{index:-1,mask:0,browserSlot:3,source:'unavailable'});
  assert.deepEqual(previewPlayerIndex('auto',3,1),{index:1,mask:3,browserSlot:3,source:'reported'});
  assert.equal(previewPlayerIndex('off',3).mask,0);
  assert.equal(previewPlayerIndex('2',3).index,2);
  assert.match(previewLabel(previewPlayerIndex('auto',3)),/unbekannt/);
  assert.match(previewLabel(previewPlayerIndex('demo',3)),/Demo P1/);
  assert.throws(()=>previewPlayerIndex('99'),RangeError);
});

test('Two separate browser Joy-Cons never receive different visual players by enumeration',()=>{
  for(const mode of ['demo','auto','1']){
    const left=previewPlayerIndex(mode,1),right=previewPlayerIndex(mode,2);
    assert.equal(left.mask,right.mask,'a paired overlay uses one presentation index');
    assert.equal(left.index,right.index);
  }
  const paired=previewPlayerIndex('auto',1,1);
  assert.equal(paired.mask,3,'trusted provider index can be shared across devices');
  assert.deepEqual(ledStates(paired.mask),[true,true,false,false]);
});
