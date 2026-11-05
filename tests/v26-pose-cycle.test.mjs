import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewStickPose,STICK_TEST_DIRECTIONS,STICK_TEST_INTERVAL_MS,STICK_TEST_BLEND_MS} from '../parity-test-pose.js';

const at=(time,mode='auto')=>previewStickPose(time,mode,1000);
function assertMax(p){
  assert.ok(Math.abs(Math.hypot(p.x,p.y)-1)<1e-12,`pose ${p.id} must have full radial deflection`);
  assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1);
}

test('eight distinct directions cover the full circle and remain maximally deflected',()=>{
  assert.equal(STICK_TEST_DIRECTIONS.length,8);
  assert.equal(new Set(STICK_TEST_DIRECTIONS.map(x=>x.id)).size,8);
  for(const p of STICK_TEST_DIRECTIONS)assertMax(p);
  for(const p of STICK_TEST_DIRECTIONS){
    const fixed=at(22000,p.id);
    assert.deepEqual([fixed.x,fixed.y],[p.x,p.y]);
    assert.equal(fixed.auto,false);
  }
});

test('automatic preview cycles every 3 s, wraps cleanly, has no clock drift',()=>{
  assert.equal(STICK_TEST_INTERVAL_MS,3000);
  assert.equal(at(1000).id,'up-right');
  assert.equal(at(3999).id,'up-right');
  assert.equal(at(4000).id,'right');
  assert.equal(at(7000).id,'down-right');
  assert.equal(at(10000).id,'down');
  assert.equal(at(25000).id,'up-right');
  assert.equal(at(52000).id,'right');
  for(let i=0;i<8;i++)assert.equal(at(1000+i*STICK_TEST_INTERVAL_MS).id,STICK_TEST_DIRECTIONS[i].id);
});

test('transitions rotate smoothly at maximum deflection, then settle on the new direction',()=>{
  const before=at(3999),jump=at(4000),middle=at(4000+STICK_TEST_BLEND_MS/2),settled=at(4000+STICK_TEST_BLEND_MS);
  for(const p of [before,jump,middle,settled])assertMax(p);
  assert.ok(Math.hypot(before.x-jump.x,before.y-jump.y)<0.0001,'no hard snap at boundary');
  assert.equal(settled.x,1);assert.equal(settled.y,0);
  assert.ok(middle.x>0&&middle.y<0);
});

test('synthetic pose feeds the 3D mechanical rig AND 2D SVG from the same state',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(app,/currentParityStickPose \? currentParityStickPose :/);
  assert.match(app,/const left=currentParityStickPose\|\|/);
  assert.match(app,/const right=currentParityStickPose\|\|/);
  assert.match(app,/reference\.update\(controlAmounts,\{left,right\}\)/);
  assert.match(app,/syncParityPoseUi\(\)/);
  assert.match(app,/if\(\$\('simpleMode'\)\.value==='live'&&parityAllButtons\)/);
  assert.match(html,/id="simpleStickDirection"/);
  assert.match(html,/value="auto" selected>Automatisch · 3 s/);
  assert.match(html,/id="simpleAllButtons"/);
  assert.match(html,/id="simplePoseStatus"/);
});

test('invalid direction is rejected instead of inventing an input state',()=>{
  assert.throws(()=>previewStickPose(4000,'diagonal-up-ish',0),RangeError);
  assertMax(previewStickPose(NaN,'auto',NaN));
});
