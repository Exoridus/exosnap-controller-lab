import test from 'node:test';
import assert from 'node:assert/strict';
import { AxisAlignment, mapAxes, signedPermutationDeterminant } from '../axis-alignment.js';

function gesture(w, data, t0=0, duration=1200) {
  w.beginCapture(t0);
  for (let t=t0+10; t<=t0+duration; t+=10) {
    w.feed({gyroRaw:data, gyroBias:[0,0,0], now:t});
    if (w.status === 'step-done' || w.status === 'complete' || w.status === 'invalid') break;
  }
}

// A production change that flips pitch or swaps yaw and roll will cause this
// synthetic, physically-directed sequence to fail.
test('learns actual gyro axis and sign from three physical controller gestures', () => {
  const w=new AxisAlignment();w.start();
  gesture(w,[0,-550,0],100);
  assert.equal(w.status,'step-done');
  assert.equal(w.step,1);
  gesture(w,[0,0,550],1700);
  assert.equal(w.status,'step-done');
  assert.equal(w.step,2);
  gesture(w,[550,0,0],3400);
  assert.equal(w.status,'complete');
  assert.deepEqual(w.mapping, [{index:1,sign:-1},{index:2,sign:-1},{index:0,sign:1}]);
  assert.deepEqual(mapAxes([3,5,7],w.mapping),[-5,-7,3]);
  assert.equal(signedPermutationDeterminant(w.mapping),1);
});

test('requires deliberate movement rather than drift or static readings', () => {
  const w=new AxisAlignment();w.start();
  gesture(w,[2,-4,3],20,2000);
  assert.equal(w.status,'capturing');
  assert.equal(w.step,0);
});

test('does not accept two gestures on the same sensor axis', () => {
  const w=new AxisAlignment();w.start();
  gesture(w,[800,0,0],100);
  assert.equal(w.step,1);
  gesture(w,[-800,0,0],1800);
  assert.equal(w.status,'invalid');
  assert.equal(w.step,1);
  assert.match(w.message,/bereits/i);
  // retry the same step without losing the successful X mapping
  gesture(w,[0,800,0],3900);
  assert.equal(w.step,2);
});

test('negative / bad timestamps cannot fabricate successful rotations', () => {
  const w=new AxisAlignment();w.start();w.beginCapture(200);
  for(let t=0;t<1500;t+=10)w.feed({gyroRaw:[1600,0,0],gyroBias:[0,0,0],now:200});
  assert.equal(w.status,'capturing');
});

test('rejects a third gesture that yields an impossible left-handed gyro frame',()=>{
  const w=new AxisAlignment();w.start();
  gesture(w,[500,0,0],200);
  gesture(w,[0,-500,0],1900);
  gesture(w,[0,0,-500],3600);
  // Depending on physical direction, this permutation may be left-handed:
  // validation should report it rather than silently claiming a correct IMU map.
  assert.equal(w.status,'invalid');
  assert.match(w.message,/Ausrichtung|Richtung|Hand|Achse/i);
});
