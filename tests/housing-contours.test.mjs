import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHousingContourGeometry } from '../housing-contours.js';

function quad(points){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  geometry.setIndex([0,1,2,0,2,3]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry);
}

function segments(geometry){
  const points=geometry.getAttribute('position'),result=[];
  for(let i=0;i<points.count;i+=2){
    result.push([i,i+1].map(j=>[points.getX(j),points.getY(j),points.getZ(j)]));
  }
  return result;
}

test('coplanar housing pieces lose the shared seam and keep their outer boundary',()=>{
  const root=new THREE.Group();
  const left=quad([[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);
  const right=quad([[1,0,0],[2,0,0],[2,1,0],[1,1,0]]);
  root.add(left,right);
  const original=left.geometry.attributes.position.array.slice();
  const contour=createHousingContourGeometry([left,right],root);
  const edges=segments(contour);
  assert.equal(edges.length,6);
  assert.ok(!edges.some(edge=>edge.every(point=>point[0]===1)));
  assert.deepEqual(left.geometry.attributes.position.array,original);
  assert.ok(left.geometry.attributes.normal);
  assert.equal(left.parent,root);
  contour.dispose();
});

test('housing corners remain visible while coplanar face diagonals disappear',()=>{
  const root=new THREE.Group();
  const front=quad([[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);
  const side=quad([[1,0,0],[1,0,-1],[1,1,-1],[1,1,0]]);
  root.add(front,side);
  const contour=createHousingContourGeometry([front,side],root);
  const edges=segments(contour);
  assert.equal(edges.length,7);
  assert.equal(edges.filter(edge=>edge.every(point=>point[0]===1&&point[2]===0)).length,1);
  contour.dispose();
});

test('nested transforms are baked into root-local contour positions',()=>{
  const scene=new THREE.Group(),root=new THREE.Group(),nested=new THREE.Group();
  scene.position.set(20,-10,5);
  root.position.set(4,3,2);
  root.rotation.set(.3,.7,-.2);
  root.scale.setScalar(2);
  nested.position.x=1;
  scene.add(root);
  root.add(nested);
  const left=quad([[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);
  const right=quad([[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);
  root.add(left);
  nested.add(right);
  const contour=createHousingContourGeometry([left,right],root);
  assert.equal(segments(contour).length,6);
  contour.computeBoundingBox();
  assert.ok(contour.boundingBox.min.distanceTo(new THREE.Vector3(0,0,0))<1e-6);
  assert.ok(contour.boundingBox.max.distanceTo(new THREE.Vector3(2,1,0))<1e-6);
  assert.deepEqual(right.position.toArray(),[0,0,0]);
  contour.dispose();
});

test('empty housing selection has no contour',()=>{
  assert.equal(createHousingContourGeometry([],new THREE.Group()),null);
});
