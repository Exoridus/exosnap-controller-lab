import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HandheldOverlayMotion, eulerQuaternion, eulerAngles,
  HANDHELD_PITCH_DEG, OVERLAY_LIMITS
} from '../overlay-motion.js';
const R=Math.PI/180;
const Q={x:0,y:0,z:0,w:1};
const close=(actual,expected,tolerance=.012)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} vs ${expected}`);

test('default held neutral tilts the face slightly upward, not horizontal or flipped',()=>{
  const filter=new HandheldOverlayMotion();
  const q=filter.update(Q,0);
  const a=eulerAngles(q);
  close(a.pitch,-12*R);
  close(a.yaw,0);
  close(a.roll,0);
  assert.equal(HANDHELD_PITCH_DEG,-12);
});

test('real pitch, roll and yaw movement feed the matching display axis without swaps',()=>{
  for(const key of ['pitch','roll','yaw']){
    const f=new HandheldOverlayMotion();
    f.update(Q,0);
    const obj={pitch:0,roll:0,yaw:0};obj[key]=20*R;
    const q=eulerQuaternion(obj);
    let result;
    for(let t=16;t<=500;t+=16)result=f.update(q,t);
    const a=eulerAngles(result);
    const degrees=Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v/R]));
    if(key==='pitch')assert.ok(degrees.pitch>-5,`pitch should move forwards: ${JSON.stringify(degrees)}`);
    if(key==='roll')assert.ok(degrees.roll>10,`roll should move to the correct side: ${JSON.stringify(degrees)}`);
    if(key==='yaw')assert.ok(degrees.yaw>10,`yaw should rotate rather than roll: ${JSON.stringify(degrees)}`);
    for(const other of ['pitch','roll','yaw']){
      if(other===key || (other==='pitch'&&key!=='pitch'))continue;
      assert.ok(Math.abs(degrees[other])<3,`${key} leaked into ${other}: ${JSON.stringify(degrees)}`);
    }
  }
});

test('when sensor is still, held overlay retains its last tilt without returning to front',()=>{
  const filter=new HandheldOverlayMotion();
  filter.update(Q,0);
  const tilted=eulerQuaternion({roll:25*R});
  for(let t=16;t<=560;t+=16)filter.update(tilted,t);
  const initial=eulerAngles(filter.update(tilted,580)).roll;
  assert.ok(initial>10*R,`test input did not produce roll: ${initial/R}`);
  let result;
  for(let t=596;t<=5100;t+=16)result=filter.update(tilted,t);
  const a=eulerAngles(result);
  assert.ok(Math.abs(a.roll-initial)<.025,`held angle must not drift: ${a.roll/R}`);
  close(a.pitch,-12*R,.03);
});

test('large rotations never invert the overlay; each displayed axis remains capped',()=>{
  const filter=new HandheldOverlayMotion();
  filter.update(Q,0);
  for(let t=16;t<=1000;t+=16){
    const p=t/1000;
    filter.update(eulerQuaternion({pitch:120*R*p,yaw:130*R*p,roll:110*R*p}),t);
  }
  const a=eulerAngles(filter.update(eulerQuaternion({pitch:120*R,yaw:130*R,roll:110*R}),1016));
  assert.ok(Math.abs(a.pitch+12*R)<=OVERLAY_LIMITS.pitch+.05);
  assert.ok(Math.abs(a.roll)<=OVERLAY_LIMITS.roll+.05);
  assert.ok(Math.abs(a.yaw)<=OVERLAY_LIMITS.yaw+.05);
});

test('idle sensor jitter does not make the controller wobble',()=>{
  const filter=new HandheldOverlayMotion();
  filter.update(Q,0);
  let result;
  for(let t=16;t<=4200;t+=16){
    const wobble=(t%32===0?1:-1)*.025*R;
    result=filter.update(eulerQuaternion({roll:wobble,pitch:wobble}),t);
  }
  const a=eulerAngles(result);
  close(a.pitch,-12*R,.009);
  close(a.roll,0,.009);
});

test('same movement response and retained tilt are approximately frame-rate independent',()=>{
  function simulate(dt){
    const f=new HandheldOverlayMotion();let result=f.update(Q,0);let active=0;
    for(let t=dt;t<=5000;t+=dt){
      result=f.update(eulerQuaternion({yaw:22*R}),t);
      if(t<=500)active=eulerAngles(result).yaw;
    }
    return {active,settled:eulerAngles(result).yaw};
  }
  const fast=simulate(1000/120),slow=simulate(1000/30);
  assert.ok(fast.active>10*R&&slow.active>10*R);
  close(slow.active,fast.active,.03);
  close(slow.settled,fast.settled,.025);
});

test('sensor reconnect starts from held neutral without replaying old orientation',()=>{
  const f=new HandheldOverlayMotion();
  f.update(Q,0);
  f.update(eulerQuaternion({roll:20*R}),100);
  f.reset();
  const a=eulerAngles(f.update(Q,250));
  close(a.pitch,-12*R);close(a.yaw,0);close(a.roll,0);
});
