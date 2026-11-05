import { test } from 'node:test';
import assert from 'node:assert/strict';
import {stickMechanics} from '../model-mechanics.js';
import {V24_STICK_MODELS,stickProfile,staticBodyBucket,isStaticBodyRole,useRearHint,ghostPressOpacity,capProfile,pressTravelFor} from '../v24-policy.js';

test('shared family has finite 32-segment presets but does not replace GameCube C-stick',()=>{
  assert.deepEqual(V24_STICK_MODELS,['DualSenseCompact','XboxOneClean','SwitchPro']);
  for(const id of V24_STICK_MODELS){
    const p=stickProfile(id);
    assert.ok(p.segments<=32 && p.segments>=24);
    const shape=capProfile(id,0.10,0.04,0.12);
    assert.equal(shape.length,12);
    assert.ok(shape.every(([radius,y])=>Number.isFinite(radius)&&Number.isFinite(y)&&radius>=0));
  }
  assert.equal(stickProfile('Gamecube'),null);
});
test('body batching never consumes animated controls',()=>{
  assert.equal(isStaticBodyRole('housing',null),true);
  assert.equal(isStaticBodyRole('decoration',null),true);
  assert.equal(isStaticBodyRole('housing','l1'),false);
  assert.equal(isStaticBodyRole('housing',null,true),false);
  assert.equal(isStaticBodyRole('stick-cap',null),false);
  assert.equal(isStaticBodyRole('trigger','l2'),false);
  assert.equal(staticBodyBucket('top_shell.obj'),'front');
  assert.equal(staticBodyBucket('bottom_shell.obj'),'rear');
});
test('Ghost rear hint policy is opt-in and does not treat face buttons as rear',()=>{
  assert.equal(useRearHint('paddle','l4'),true);
  assert.equal(useRearHint('button','l1'),true);
  assert.equal(useRearHint('button','r2'),true);
  assert.equal(useRearHint('button','b1'),false);
  assert.equal(useRearHint('housing',null),false);
});
test('Ghost controls are transparent at idle and opaque when pressed',()=>{
  assert.equal(ghostPressOpacity(.20,0),.20);
  assert.equal(ghostPressOpacity(.20,1),1);
  assert.equal(ghostPressOpacity(.20,2),1);
  assert.ok(ghostPressOpacity(.20,.5)>.20);
});
test('Share/Options and bumpers never use generic full-size face travel',()=>{
  const select=pressTravelFor('select');
  const shoulder=pressTravelFor('r1');
  const face=pressTravelFor('b1');
  assert.equal(select.y,-.003);
  assert.equal(shoulder.y,-.008);
  assert.equal(shoulder.z,.003);
  assert.equal(face.y,-.008);
});

test('model-specific native visual tilt limits remain separate from real hardware input',()=>{
  assert.equal(stickMechanics('DualSenseCompact','left').maxTiltDeg,14);
  assert.equal(stickMechanics('XboxOneClean','left').maxTiltDeg,17);
  assert.equal(stickMechanics('SwitchPro','right').maxTiltDeg,15);
  assert.equal(stickMechanics('Gamecube','right').gate.type,'polygon');
});
