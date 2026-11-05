import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stickVisualState, normalizeStickInput} from '../stick-activity.js';

test('stick neutral preserves control material instead of glowing',()=>{
 const state=normalizeStickInput({x:0,y:0,click:false});
 assert.equal(state.activity,0);
 const visual=stickVisualState(state);
 assert.equal(visual.moving,0);
 assert.equal(visual.click,0);
 assert.equal(visual.colorWeight,0);
});
test('movement brightens stick without falsely pressing it; click uses stronger translucent blue',()=>{
 const neutral=stickVisualState(normalizeStickInput({x:0,y:0}));
 const motion=stickVisualState(normalizeStickInput({x:.72,y:.3}));
 const clicked=stickVisualState(normalizeStickInput({x:.72,y:.3,click:true}));
 assert.ok(motion.moving>0&&motion.click===0);
 assert.ok(motion.colorWeight>neutral.colorWeight);
 assert.ok(clicked.click>0&&clicked.opacityBoost>motion.opacityBoost);
 assert.ok(clicked.opacityBoost<1);
});
test('stick movement deadzone and nonfinite inputs are safely clamped',()=>{
 assert.equal(normalizeStickInput({x:.01,y:.02}).activity,0);
 assert.equal(normalizeStickInput({x:Infinity,y:NaN}).activity,0);
 assert.equal(normalizeStickInput({x:5,y:5}).activity,1);
});
