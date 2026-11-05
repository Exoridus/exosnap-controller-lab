import test from 'node:test';
import assert from 'node:assert/strict';
import { frontFaceTransform, transformControllerPoint } from '../model-orientation.js';

// Real 3dco+ DualSense model-space control centers from the source meshes:
// dpad_left.obj [-0.717, 0.314, -0.291], b_button.obj [0.785, 0.300, -0.293].
test('3dco DualSense faces the camera; left D-pad is left of face buttons', () => {
  const dpad=transformControllerPoint('co',[-0.7173,0.3147,-0.2907]);
  const face=transformControllerPoint('co',[0.7849,0.3003,-0.2933]);
  assert.ok(dpad[0] < -0.5, `D-pad is mirrored: ${dpad}`);
  assert.ok(face[0] > 0.5, `face buttons are mirrored: ${face}`);
  assert.ok(dpad[2] > 0.28 && face[2] > 0.28, `camera sees the back rather than buttons: ${dpad} ${face}`);
  const up=transformControllerPoint('co',[0,0,-0.6]);
  const bottom=transformControllerPoint('co',[0,0,0.5]);
  assert.ok(up[1]>bottom[1], `controller is upside down: ${up} ${bottom}`);
});

test('front orientation uses no reflection; each source remains right-handed', () => {
  for(const source of ['co','padforge']){
    const t=frontFaceTransform(source);
    assert.ok(t.scale.every(x=>x===1),`${source}: no negative scale reflection`);
    assert.equal(t.rotationY,0);
  }
});
