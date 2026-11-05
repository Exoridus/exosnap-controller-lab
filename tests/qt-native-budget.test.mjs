import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geometryBudget, NATIVE_QT_MODELS} from '../qt-native-budget.js';
test('Qt #517 pilot node count is shell + both four-component sticks + seventeen controls',()=>{
 assert.deepEqual(NATIVE_QT_MODELS,{shell:1,sticks:8,buttons:17,total:26});
});
test('64, 32 and 24 radial segments predict exact source-generated geometry budget',()=>{
 assert.deepEqual([64,32,24].map(s=>geometryBudget(s).uniqueVertices),[8970,4554,3450]);
 assert.deepEqual([64,32,24].map(s=>geometryBudget(s).trianglesPerStick),[8832,4416,3312]);
 assert.equal(geometryBudget(64).drawnStickVerticesTwo,17940);
});
