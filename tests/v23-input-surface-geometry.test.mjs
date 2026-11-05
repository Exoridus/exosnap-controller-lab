import test from 'node:test';
import assert from 'node:assert/strict';
import * as geometry from '../input-surface-geometry.js';
const call=(name,...args)=>{assert.equal(typeof geometry[name],'function');return geometry[name](...args);};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
const square=[{x:-.5,y:-.5},{x:.5,y:-.5},{x:.5,y:.5},{x:-.5,y:.5}];
const quad=[{x:0,y:0,z:0},{x:2,y:0,z:1},{x:2,y:3,z:1},{x:0,y:3,z:0}];

test('convex gate intersections preserve winding and cap the radius at one',()=>{
  for(const vertices of [square,[...square].reverse()]){
    assert.equal(call('validateConvexPolygon',vertices,{containsOrigin:true}),true);
    const gate={type:'polygon',vertices};
    close(call('gateRadius',{x:1,y:0},gate),.5);
    close(call('gateRadius',{x:1,y:1},gate),Math.SQRT1_2);
    close(call('gateRadius',{x:-1,y:0},gate),.5);
    close(call('gateRadius',{x:0,y:-1},gate),.5);
  }
  close(call('gateRadius',{x:1,y:0}),1);
  close(call('gateRadius',{x:1,y:1},{type:'circle'}),1);
  close(call('gateRadius',{x:1,y:1},{type:'polygon',vertices:square.map(p=>({x:p.x*4,y:p.y*4}))}),1);
  const diamond={type:'polygon',vertices:[{x:.8,y:0},{x:0,y:.6},{x:-.4,y:0},{x:0,y:-.9}]};
  close(call('gateRadius',{x:1,y:0},diamond),.8);
  close(call('gateRadius',{x:-1,y:0},diamond),.4);
  close(call('gateRadius',{x:1,y:1},diamond),Math.SQRT2/(1/.8+1/.6));
  close(call('gateRadius',{x:Number.MAX_VALUE,y:Number.MAX_VALUE},diamond),Math.SQRT2/(1/.8+1/.6));
});

test('malformed, degenerate, crossing, concave and off-center gates are rejected',()=>{
  const invalid=[null,[],square.slice(0,2),
    [{x:NaN,y:0},...square.slice(1)],
    [{x:Infinity,y:0},...square.slice(1)],
    [{x:0,y:0},{x:1,y:0},{x:2,y:0}],
    [square[0],square[2],square[1],square[3]],
    [square[0],square[1],{x:0,y:0},square[2],square[3]],
    [...square,square[0]],
    square.map(p=>({x:p.x+2,y:p.y})),
    square.map(p=>({x:p.x+.5,y:p.y}))];
  for(const vertices of invalid){
    assert.equal(call('validateConvexPolygon',vertices,{containsOrigin:true}),false);
    assert.equal(call('gateRadius',{x:1,y:0},{type:'polygon',vertices}),null);
  }
  const star=Array.from({length:5},(_,i)=>({x:Math.cos(i*4*Math.PI/5),y:Math.sin(i*4*Math.PI/5)}));
  assert.equal(call('validateConvexPolygon',star,{containsOrigin:true}),false);
  for(const direction of [null,{x:0,y:0},{x:NaN,y:1},{x:1,y:Infinity}])assert.equal(call('gateRadius',direction,{type:'polygon',vertices:square}),null);
  assert.equal(call('gateRadius',{x:1,y:0},{type:'unknown'}),null);
});

test('touch coordinates interpolate the local 3D quad and follow a node transform',()=>{
  const point=call('touchSurfacePoint',{u:.25,v:.5},{quad});
  close(point.x,.5);close(point.y,1.5);close(point.z,.25);
  const matrix=[0,1,0,0,-1,0,0,0,0,0,1,0,10,20,30,1];
  const world=call('touchSurfacePoint',{u:.25,v:.5},{quad},matrix);
  close(world.x,8.5);close(world.y,20.5);close(world.z,30.25);
  assert.deepEqual(call('touchSurfacePoint',{u:1,v:1},{quad}),quad[2]);
  const warped=quad.map(p=>({...p}));warped[2].z=2;
  close(call('touchSurfacePoint',{u:.5,v:.5},{quad:warped}).z,.75);
});

test('touch boundary clips coordinates and invalid geometry never yields a position',()=>{
  const boundary=[{x:.5,y:0},{x:1,y:.5},{x:.5,y:1},{x:0,y:.5}];
  assert.ok(call('touchSurfacePoint',{u:.5,v:.5},{quad,boundary}));
  assert.ok(call('touchSurfacePoint',{u:.5,v:0},{quad,boundary}));
  assert.equal(call('touchSurfacePoint',{u:0,v:0},{quad,boundary}),null);
  for(const uv of [null,{u:NaN,v:0},{u:0,v:Infinity},{u:-.01,v:.5},{u:.5,v:1.01}])assert.equal(call('touchSurfacePoint',uv,{quad}),null);
  for(const invalidQuad of [null,[],quad.slice(0,3),[quad[0],quad[2],quad[1],quad[3]],quad.map(()=>quad[0]),[{x:NaN,y:0,z:0},...quad.slice(1)]]){
    assert.equal(call('touchSurfacePoint',{u:.5,v:.5},{quad:invalidQuad}),null);
  }
  assert.equal(call('touchSurfacePoint',{u:.5,v:.5},{quad,boundary:[]}),null);
  const badBoundary=[{x:-.1,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
  assert.equal(call('touchSurfacePoint',{u:.5,v:.5},{quad,boundary:badBoundary}),null);
  for(const matrix of [[],Array(16).fill(NaN),Array(16).fill(0)])assert.equal(call('touchSurfacePoint',{u:.5,v:.5},{quad},matrix),null);
});
