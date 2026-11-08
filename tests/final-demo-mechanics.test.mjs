import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import * as appearance from '../pbr-appearance.js';
import {prepareGhostOcclusion} from '../ghost-depth-policy.js';
const demo=await import('../controller-demo.js').catch(()=>({}));
const read=url=>fs.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');

test('restored physical pose depresses each button and rotates both triggers about their authored pivots',async()=>{
 assert.equal(typeof appearance.applyControlPoseToRig,'function');
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 try {
  prepareGhostOcclusion(rig);
  const part=file=>rig.parts.find(p=>p.file===file).holder;
  const checks=[['a_button.obj','b1'],['dpad_up.obj','up'],['left_bumper.obj','l1'],['right_bumper.obj','r1']];
  const rest=new Map(checks.map(([f])=>[f,part(f).position.clone()]));
  for(const [file,key] of checks){
   appearance.applyControlPoseToRig(rig,{values:new Map([[key,1]])});
   assert.ok(part(file).position.distanceTo(rest.get(file))>.002,file+' has visible mechanical travel');
   appearance.applyControlPoseToRig(rig,{}); assert.ok(part(file).position.equals(rest.get(file)));
  }
  const trigger=part('left_trigger.obj'),q=trigger.quaternion.clone();
  appearance.applyControlPoseToRig(rig,{triggers:{left:.5,right:0}});
  const half=trigger.quaternion.angleTo(q);
  assert.ok(half>.08);assert.equal(part('right_trigger.obj').quaternion.angleTo(q),0);
  appearance.applyControlPoseToRig(rig,{triggers:{left:1,right:0}});
  assert.ok(Math.abs(trigger.quaternion.angleTo(q)-half*2)<1e-6);
  rig.group.updateMatrixWorld(true);
  const hint=rig.rearHintLines.find(h=>h.userData.control==='l2');
  const moving=hint.matrixWorld.clone();
  appearance.applyControlPoseToRig(rig,{});rig.group.updateMatrixWorld(true);
  assert.ok(!hint.matrixWorld.equals(moving),'hidden contour follows its moving mesh');
  assert.ok(trigger.quaternion.equals(q),'neutral restores exact pose');
 } finally {disposeNativeRig(rig);}
});
test('demo reuses a deterministic state, covers each input and returns to neutral at the seam',()=>{
 assert.equal(typeof demo.demoStateAt,'function');
 const output=demo.createControllerState();const seen=new Set();let combined=false,partial=false;
 for(let t=0;t<demo.DEMO_DURATION_MS;t+=20){
  assert.equal(demo.demoStateAt(t,output),output);
  for(const [key,value]of output.values)if(value>.5)seen.add(key);
  if(output.left.click&&Math.hypot(output.left.x,output.left.y)>.2)combined=true;
  if(output.triggers.left>.05&&output.triggers.left<.95)partial=true;
 }
 for(const key of ['b1','b2','b3','b4','up','down','left','right','l1','r1','l2','r2','ls','rs'])assert.ok(seen.has(key),key);
 assert.ok(combined&&partial);
 demo.demoStateAt(demo.DEMO_DURATION_MS,output);
 assert.ok([...output.values.values()].every(v=>v===0));assert.equal(output.left.x,0);
});
test('manual and live states replace demo rather than merging; sampling twice does not advance its clock',()=>{
 assert.equal(typeof demo.ControllerDemo,'function');
 const driver=new demo.ControllerDemo();driver.sample(0);driver.sample(100);
 const t=driver.demoTime;driver.sample(100);assert.equal(driver.demoTime,t);
 const manual=demo.createControllerState();manual.values.set('r1',1);
 const out=driver.sample(150,{manual});assert.equal(out.source,'manual');
 assert.equal(out.values.get('r1'),1);assert.equal(out.values.get('b1')||0,0);
 const paused=driver.demoTime;driver.sample(300,{manual});assert.equal(driver.demoTime,paused);
 driver.setEnabled(false);const neutral=driver.sample(600);
 assert.equal(neutral.source,'neutral');assert.ok([...neutral.values.values()].every(v=>!v));
});
