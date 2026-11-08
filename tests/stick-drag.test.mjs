import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clampStick,stickDragVector} from '../stick-drag.js';
test('stick drag is a free two-axis radial input, not a fixed diagonal',()=>{
  assert.deepEqual(stickDragVector({x:0,y:0},{x:10,y:-10},20),{x:.5,y:-.5});
  assert.deepEqual(stickDragVector({x:0,y:0},{x:100,y:0},20),{x:1,y:0});
  const d=clampStick(1,1);assert.ok(Math.abs(Math.hypot(d.x,d.y)-1)<1e-10);
  assert.throws(()=>stickDragVector({x:0,y:0},{x:1,y:1},0),RangeError);
});
test('lab explicitly distinguishes L3/R3 clicks and restores stick on release',async()=>{
  const html=await readFile(new URL('../polish-2d.html',import.meta.url),'utf8');
  const script=await readFile(new URL('../polish-2d-lab.js',import.meta.url),'utf8');
  const style=await readFile(new URL('../polish-2d-style.js',import.meta.url),'utf8');
  for(const id of ['clickLeft','clickRight','clicks'])assert.ok(html.includes('id="'+id+'"'));
  assert.ok(html.includes('touch-action:none'));
  assert.ok(script.includes("attachStickDrag(item.reference"));
  assert.ok(script.includes("end:side=>{drag[side]=null;paint();}"));
  assert.ok(style.includes("paint(center,'stroke',colors.controlStroke)"));
  assert.ok(style.includes("solid?colors.controlStroke:mixColor("));
});