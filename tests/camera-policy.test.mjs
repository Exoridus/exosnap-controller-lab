import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraControlsEnabled } from '../camera-policy.js';
test('camera is locked during motion tracking and calibration but free for regular 3D inspection',()=>{
 assert.equal(cameraControlsEnabled({connected:true,tilt:true}),false);
 assert.equal(cameraControlsEnabled({connected:true,tilt:false}),true);
 assert.equal(cameraControlsEnabled({connected:false,tilt:true}),true);
});
