import test from 'node:test';
import assert from 'node:assert/strict';
import {ActiveColorState} from '../active-color-state.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
import {appearanceCacheKey} from '../material-paint.js';

test('2D picker changes only 2D when unlinked; 3D picker changes only 3D',()=>{
  const state=new ActiveColorState({color2D:'#79bdff',color3D:'#79bdff',sync:false});
  state.edit('2d','#39f08d');
  assert.equal(state.color2D,'#39f08d');
  assert.equal(state.color3D,'#79bdff');
  state.edit('3d','#de5aff');
  assert.equal(state.color2D,'#39f08d');
  assert.equal(state.color3D,'#de5aff');
});
test('sync explicitly couples picks and respects last edited source; unsync isolates next edit',()=>{
  const state=new ActiveColorState();
  state.setSync(true,'3d');state.edit('2d','#1099ee');
  assert.deepEqual([state.color2D,state.color3D],['#1099ee','#1099ee']);
  state.setSync(false);state.edit('3d','#f0ff10');
  assert.deepEqual([state.color2D,state.color3D],['#1099ee','#f0ff10']);
});
test('2D paint cache invalidates for active blue even at unchanged pressed and mix state',()=>{
  const source=resolveHeroRecipe('ghost',.7);
  const state=new ActiveColorState({sync:false});
  const a=state.overrideRecipe(source,'2d');
  state.edit('2d','#07c5ff');
  const b=state.overrideRecipe(source,'2d');
  assert.notEqual(appearanceCacheKey(a,'dark'),appearanceCacheKey(b,'dark'));
  assert.equal(state.overrideRecipe(source,'3d').material.pressBlue,'#4f9eeb');
});

test('2D/3D active colors match and stay linked by default',()=>{
 const state=new ActiveColorState();
 assert.equal(state.sync,true);
 assert.equal(state.color2D,'#4f9eeb');
 assert.equal(state.color3D,state.color2D);
 state.edit('3d','#437fe2');
 assert.deepEqual([state.color2D,state.color3D],['#437fe2','#437fe2']);
});
