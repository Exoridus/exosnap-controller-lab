import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { refineStickSphere, refineRoundCap, polishGameCubePart } from '../gamecube-stick-geometry.js';

test('sphere refinement stays on the original radius and preserves non-spherical shaft faces',()=>{
  const source=new BufferGeometry();
  const radius=.2,shaft=[0,.22,0,.05,.22,0,0,.26,0];
  source.setAttribute('position',new Float32BufferAttribute([radius,0,0,0,radius,0,0,0,radius,...shaft],3));
  const result=refineStickSphere(source,radius,2),p=result.getAttribute('position');
  assert.equal(p.count,16*3+3);
  for(let i=0;i<16*3;i++)assert.ok(Math.abs(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))-radius)<1e-7);
  assert.deepEqual([...p.array.slice(-9)],[...source.getAttribute('position').array.slice(-9)]);
  assert.ok([...result.getAttribute('normal').array].every(Number.isFinite));
});

test('C-stick cap keeps its exact authored vertices and topology',()=>{
  const geometry=new BufferGeometry();
  const vertices=[0,.23,0,.05,.23,0,0,.23,.05];
  geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
  const before=[...geometry.getAttribute('position').array];
  assert.equal(polishGameCubePart(geometry,'right_cap.obj'),geometry);
  assert.deepEqual([...geometry.getAttribute('position').array],before);
});

test('round cap refinement preserves profile heights and radial extents without adding an overlay',()=>{
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([.1,.24,0,0,.24,.1,.08,.27,0],3));
  const result=refineRoundCap(geometry),p=result.getAttribute('position');
  assert.equal(p.count,48);
  for(let i=0;i<p.count;i++){
    assert.ok(p.getY(i)>=.24-1e-7&&p.getY(i)<=.27+1e-7);
    assert.ok(Math.hypot(p.getX(i),p.getZ(i))<=.1+1e-7);
  }
});

test('housing geometry, octagonal openings and authored housing normals stay untouched',()=>{
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  geometry.computeVertexNormals();
  const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  assert.equal(polishGameCubePart(geometry,'top_shell.obj'),geometry);
  assert.equal(geometry.getAttribute('position'),positions);
  assert.equal(geometry.getAttribute('normal'),normals);
});
