import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3, Quaternion } from 'three';
import { MODEL_MECHANICS, stickMechanics, triggerMechanics } from '../model-mechanics.js';
import { stickTiltQuaternion } from '../stick-visual-state.js';
import { isSolidGhostPart } from '../ghost-occlusion.js';

test('hardware references never replace per-stick rig angles',()=>{
  assert.equal(MODEL_MECHANICS.DualSenseCompact.references.hardware.maxTiltDeg,25);
  for(const side of ['left','right']){
    assert.equal(stickMechanics('DualSenseCompact',side).maxTiltDeg,14);
    assert.equal(stickMechanics('Gamecube',side).clickTravel,0);
    assert.equal(stickMechanics('Gamecube',side).gate.type,'polygon');
  }
  assert.equal(MODEL_MECHANICS.Gamecube.references.hardware,null);
  assert.equal(triggerMechanics('DualSenseCompact').maxRotationDeg,16);
  assert.equal(triggerMechanics('Gamecube').maxRotationDeg,0);
  assert.equal(isSolidGhostPart('stick-pivot'),true);
});

test('authored cap, moving rim and stem retain one rigid assembly while shell stays fixed',()=>{
  const shell=new Group(),assembly=new Group(),stem=new Group(),cap=new Group();
  assembly.add(stem,cap);shell.add(assembly);
  const config=stickMechanics('DualSenseCompact','left');
  const base=new Vector3(...config.pivot);
  stem.position.set(0,.176291,0);cap.position.set(0,.226073,0);
  const distance=stem.position.distanceTo(cap.position);
  for(const fps of [30,60,144])for(const axes of [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:0}]){
    const tilt=stickTiltQuaternion(axes,'co',config);
    for(let frame=0;frame<fps;frame++){
      assembly.quaternion.set(tilt.x,tilt.y,tilt.z,tilt.w);
      assembly.position.copy(base).add(new Vector3(0,-config.clickTravel,0).applyQuaternion(assembly.quaternion));
    }
    shell.updateMatrixWorld(true);
    assert.ok(Math.abs(stem.getWorldPosition(new Vector3()).distanceTo(cap.getWorldPosition(new Vector3()))-distance)<1e-12);
    assert.ok(assembly.quaternion.angleTo(new Quaternion())<=14*Math.PI/180+1e-12);
    assert.deepEqual(shell.quaternion.toArray(),[0,0,0,1]);
  }
  assert.deepEqual(assembly.quaternion.toArray(),[0,0,0,1]);
});
