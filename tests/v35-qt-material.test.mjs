import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveHeroRecipe,qtQuickDescriptor} from '../pbr-recipes.js';
import {resolve2DPaint} from '../material-paint.js';
import {EXO_PALETTE} from '../palette.js';
test('Qt descriptor exposes the exact same 2D color profiles and LED emission as Three',()=>{
 for(const variant of ['solid','ghost'])for(const mix of [0,.65,1]){
  const recipe=resolveHeroRecipe(variant,mix),qt=qtQuickDescriptor(recipe);
  assert.deepEqual(qt.flat2D.dark,resolve2DPaint(recipe,'dark'));
  assert.deepEqual(qt.flat2D.light,resolve2DPaint(recipe,'light'));
  assert.deepEqual(qt.flat2D.mixed,resolve2DPaint(recipe,'mixed'));
  assert.equal(qt.pressEmissive.color,EXO_PALETTE.pressedEmissive);
  assert.equal(qt.depthOcclusion.shellWritesDepth,true);
 }
});
test('Qt material snippet describes an emissive LED instead of merely painting blue',()=>{
 const qml=readFileSync(new URL('../qt-quick3d-port/ControllerSurface.qml',import.meta.url),'utf8');
 assert.ok(qml.includes('emissiveFactor:'));
 assert.ok(qml.includes('depthDrawMode: Material.AlwaysDepthDraw'));
 assert.ok(qml.includes('pressedAmount'));
});
