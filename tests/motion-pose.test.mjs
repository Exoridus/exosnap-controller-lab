import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerWorldOrientation, rotatePoseVector, suggestedCameraView } from '../motion-pose.js';
import { MotionFusion } from '../motion-input.js';

const near=(actual,expected,epsilon=.00001)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} not within ${epsilon} of ${expected}`);
const id={x:0,y:0,z:0,w:1};
const sample=(gx=0,gy=0,gz=-1,omega=[15,-5,3])=>({
  gyroRaw:omega,
  accelRaw:[gx,gy,gz].map(x=>Math.round(x*8192)),
  accelG:[gx,gy,gz],sensorTimestamp:null
});
function flatCalibratedFusion(){
  const f=new MotionFusion();f.startCalibration('flat',0);
  for(let t=0;t<=1500;t+=10)f.update(sample(),t);
  assert.ok(f.ready);return f;
}

test('flat table calibration points the button face straight up, with trigger edge away',()=>{
  const q=controllerWorldOrientation({status:'ready',mode:'flat',relative:id,enabled:true});
  const face=rotatePoseVector(q,[0,0,1]);
  const shoulder=rotatePoseVector(q,[0,1,0]);
  near(face[0],0);near(face[1],1);near(face[2],0);
  near(shoulder[0],0);near(shoulder[1],0);near(shoulder[2],-1);
});

test('upright calibration presents the buttons toward the camera, trigger edge up',()=>{
  const q=controllerWorldOrientation({status:'ready',mode:'upright',relative:id,enabled:true});
  const front=rotatePoseVector(q,[0,0,1]);
  const shoulder=rotatePoseVector(q,[0,1,0]);
  near(front[2],1);near(shoulder[1],1);
});

test('flat pose is already shown during calibration; disconnected/disabled returns studio pose',()=>{
  for(const phase of ['calibrating','unstable','ready']){
    const q=controllerWorldOrientation({status:phase,mode:'flat',relative:id,enabled:true});
    near(rotatePoseVector(q,[0,0,1])[1],1);
  }
  for(const [status,enabled] of [['uncalibrated',true],['ready',false]]){
    const q=controllerWorldOrientation({status,mode:'flat',relative:id,enabled});
    near(rotatePoseVector(q,[0,0,1])[2],1);
  }
});

// The old table-height assertion described a physical display mode from v9.
// v12 deliberately starts FRONT in overlay mode, regardless of whether the
// controller was calibrated flat. Test physical directions in that frame.
test('recenter retains the calibrated table pose, not the upright identity',()=>{
  const f=flatCalibratedFusion();
  for(let t=1510;t<1900;t+=10)f.update(sample(0,.12,-.993,[15-340,-5,3]),t);
  assert.ok(f.recenter());
  const q=controllerWorldOrientation({status:f.status,mode:f.mode,relative:f.orientation,enabled:true});
  near(rotatePoseVector(q,[0,0,1])[1],1,.001);
});

test('camera follows calibration pose instead of looking edge-on at a table-flat controller',()=>{
  assert.equal(suggestedCameraView({status:'ready',mode:'flat',enabled:true}),'table');
  assert.equal(suggestedCameraView({status:'calibrating',mode:'flat',enabled:true}),'table');
  assert.equal(suggestedCameraView({status:'ready',mode:'upright',enabled:true}),'front');
  assert.equal(suggestedCameraView({status:'uncalibrated',mode:'flat',enabled:true}),'front');
});
