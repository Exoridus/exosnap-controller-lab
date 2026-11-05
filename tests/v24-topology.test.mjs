import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditObj} from '../obj-topology.js';
const quad=`v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3 4`;
test('source OBJ topology report counts polygons and triangles',()=>{
 const r=auditObj(quad);
 assert.equal(r.triangles,2);assert.equal(r.faces,1);
 assert.equal(r.boundaryEdges,4);assert.equal(r.nonManifoldEdges,0);
 assert.equal(r.degenerateTriangles,0);
});
test('degenerate triangles and invalid mesh references are reported',()=>{
 const r=auditObj(`v 0 0 0
v 1 0 0
v 2 0 0
f 1 2 3
f 1 2 99`);
 assert.equal(r.degenerateTriangles,1);
 assert.ok(r.invalidReferences>0);
});
