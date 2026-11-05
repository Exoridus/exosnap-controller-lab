import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizePanelBudget} from '../render-budget.js';

test('shared render reports one source 3D pass plus a separate blit for each background',()=>{
 const out=summarizePanelBudget({mode:'shared',sceneNames:['dark','light','mixed'],source:{calls:25,triangles:6200},blits:[{calls:1,triangles:2},{calls:1,triangles:2},{calls:1,triangles:2}]});
 assert.equal(out.calls,28);
 assert.equal(out.sourceCalls,25);
 assert.equal(out.panels.dark.compositeCalls,1);
 assert.equal(out.panels.light.compositeCalls,1);
 assert.equal(out.panels.mixed.compositeCalls,1);
 assert.equal(out.triangles,6206);
});
test('direct render reports independently measured calls per panel, not quotient of total',()=>{
 const out=summarizePanelBudget({mode:'direct',sceneNames:['dark','light','mixed'],direct:[{calls:26,triangles:7030},{calls:25,triangles:7020},{calls:28,triangles:7100}]});
 assert.equal(out.calls,79);
 assert.deepEqual([out.panels.dark.calls,out.panels.light.calls,out.panels.mixed.calls],[26,25,28]);
});
