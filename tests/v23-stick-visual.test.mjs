import test from 'node:test';
import assert from 'node:assert/strict';
import * as visual from '../stick-visual-state.js';
import {readStandardGamepad,deadzonePair} from '../gamepad-input.js';
import {parseSonyHidGamepad,chooseLiveGamepadInput} from '../sony-hid-gamepad.js';
import {LiveButtonStabilizer} from '../input-stabilizer.js';

const identity={x:0,y:0,z:0,w:1};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);
const radial=(...args)=>{
  assert.equal(typeof visual.radialStickAxes,'function');
  return visual.radialStickAxes(...args);
};
const tilt=(...args)=>{
  assert.equal(typeof visual.stickTiltQuaternion,'function');
  return visual.stickTiltQuaternion(...args);
};
const angle=q=>2*Math.atan2(Math.hypot(q.x,q.y,q.z),q.w)*180/Math.PI;

test('radial defaults remove inner drift and reach full range at the outer boundary',()=>{
  assert.deepEqual(visual.STICK_VISUAL_DEFAULTS,{innerDeadzone:.05,outerSaturation:.05,maxTiltDeg:16});
  for(const [radius,amount] of [[0,0],[.03,0],[.05,0],[.5,.5],[.95,1],[1,1]]){
    const actual=radial({x:radius,y:0});
    close(actual.x,amount);close(actual.y,0);close(actual.amount,amount);
    close(angle(tilt({x:radius,y:0},'co')),amount*16);
  }
});

test('axes, diagonals and a full circle preserve direction and the same radial tilt',()=>{
  for(const radius of [0,.03,.05,.5,.95,1]){
    for(let degrees=0;degrees<360;degrees+=15){
      const theta=degrees*Math.PI/180;
      const axes={x:radius*Math.cos(theta),y:radius*Math.sin(theta)};
      const expected=radius<=.05?0:Math.min(1,(radius-.05)/.9);
      const actual=radial(axes),q=tilt(axes,'co');
      close(actual.x,Math.cos(theta)*expected);close(actual.y,Math.sin(theta)*expected);
      close(Math.hypot(actual.x,actual.y),expected);
      close(angle(q),expected*16);
      close(Math.hypot(q.x,q.y,q.z,q.w),1);
      close(q.y,0);
    }
  }
});

test('over-range vectors cap radius without distorting their original direction',()=>{
  for(const axes of [{x:1,y:1},{x:2,y:1},{x:-2,y:1},{x:Number.MAX_VALUE,y:Number.MAX_VALUE/2}]){
    const actual=radial(axes),q=tilt(axes,'co');
    close(actual.amount,1);close(Math.hypot(actual.x,actual.y),1);
    close(actual.x/actual.y,axes.x/axes.y);
    close(angle(q),16);
    assert.ok(Object.values(q).every(Number.isFinite));
  }
});

test('model orientation keeps existing co axes and inverses them for padforge',()=>{
  const sine=Math.sin(16*Math.PI/360),cosine=Math.cos(16*Math.PI/360);
  for(const [axes,expected] of [[{x:1,y:0},{x:0,z:-sine}],[{x:0,y:1},{x:sine,z:0}]]){
    const co=tilt(axes,'co'),padforge=tilt(axes,'padforge');
    close(co.x,expected.x);close(co.z,expected.z);close(co.w,cosine);
    close(padforge.x,-expected.x);close(padforge.z,-expected.z);close(padforge.w,cosine);
  }
  assert.deepEqual(tilt({x:1,y:1},'unsupported'),identity);
});

test('explicit configuration controls deadzones and maximum tilt without changing defaults',()=>{
  const config={innerDeadzone:.1,outerDeadzone:.2,maxTiltDeg:24};
  close(radial({x:.45,y:0},config).amount,.5);
  close(angle(tilt({x:.45,y:0},'co',config)),12);
  close(angle(tilt({x:.8,y:0},'co',config)),24);
  assert.deepEqual(tilt({x:1,y:0},'co',{maxTiltDeg:0}),identity);
  close(radial({x:.03,y:0},{innerDeadzone:0,outerDeadzone:0}).amount,.03);
  close(angle(tilt({x:1,y:0},'co')),16);
});

test('invalid configuration falls back to finite defaults and cannot divide by zero',()=>{
  const baseline=tilt({x:.5,y:0},'co');
  for(const config of [null,{},
    {innerDeadzone:NaN,outerDeadzone:Infinity,maxTiltDeg:NaN},
    {innerDeadzone:-1,outerDeadzone:-1,maxTiltDeg:-1},
    {innerDeadzone:'0.1',outerDeadzone:'0.1',maxTiltDeg:'20'},
    {innerDeadzone:.5,outerDeadzone:.5},
    {innerDeadzone:.8,outerDeadzone:.8},
    {innerDeadzone:1,outerDeadzone:1,maxTiltDeg:Infinity}]){
    assert.deepEqual(tilt({x:.5,y:0},'co',config),baseline);
    assert.ok(Object.values(radial({x:0,y:0},config)).every(Number.isFinite));
  }
});

test('unavailable, unsupported and invalid samples clear a previously tilted stick immediately',()=>{
  const invalid=[null,undefined,{},
    {x:1},{x:NaN,y:1},{x:1,y:Infinity},{x:-Infinity,y:0},{x:'1',y:0},
    {x:1,y:1,available:false},{x:1,y:1,supported:false},
    {x:1,y:1,status:'Unavailable'},{x:1,y:1,status:'Unsupported'}];
  for(const axes of invalid){
    close(angle(tilt({x:1,y:1},'co')),16);
    assert.deepEqual(radial(axes),{x:0,y:0,amount:0});
    assert.deepEqual(tilt(axes,'co'),identity);
  }
});

test('outer saturation is canonical and the former deadzone field remains compatible',()=>{
  const axes={x:.8,y:0};
  close(radial(axes,{outerSaturation:.2}).amount,1);
  assert.deepEqual(radial(axes,{outerSaturation:.2}),radial(axes,{outerDeadzone:.2}));
  assert.deepEqual(radial(axes,{outerSaturation:.2,outerDeadzone:0}),radial(axes,{outerSaturation:.2}));
  assert.deepEqual(radial(axes,{outerSaturation:NaN}),radial(axes));
});

test('polygon gate scales the radial curve by the directional boundary before tilt',()=>{
  const gate={type:'polygon',vertices:[{x:.6,y:0},{x:0,y:.6},{x:-.6,y:0},{x:0,y:-.6}]};
  close(radial({x:1,y:0},{gate}).amount,.6);
  close(angle(tilt({x:.5,y:0},'co',{gate})),16*.5*.6);
  close(angle(tilt({x:1,y:1},'co',{gate})),16*.6/Math.SQRT2);
  assert.deepEqual(tilt({x:1,y:0},'co',{gate:{type:'polygon',vertices:[]}}),identity);
});

test('same sample produces the same pose immediately at every frame rate and after any history',()=>{
  const axes={x:.3,y:-.6},expected=tilt(axes,'co');
  for(const fps of [30,60,144]){
    for(let frame=0;frame<fps;frame++){
      tilt({x:Math.sin(frame),y:Math.cos(frame)},'padforge',{maxTiltDeg:24});
      assert.deepEqual(tilt({...axes,timestamp:frame*1000/fps},'co'),expected);
    }
  }
  assert.ok(Math.abs(visual.demoStickAxes(420,'left').x)<=1);
  assert.deepEqual(visual.stickTiltAngles(null,'co'),{x:0,z:-0});
});

test('browser input retains raw axes for one visual deadzone and preserves processed consumers',()=>{
  const state=readStandardGamepad({connected:true,mapping:'standard',buttons:[],axes:[.08,-.02,.5,-.5]});
  assert.deepEqual(state.rawLeft,{x:.08,y:-.02});
  assert.deepEqual(state.rawRight,{x:.5,y:-.5});
  assert.deepEqual(state.left,deadzonePair(.08,-.02));
  assert.deepEqual(state.right,deadzonePair(.5,-.5));
  assert.equal(state.left.amount,0);
  assert.ok(radial(state.rawLeft).amount>0);
  const invalid=readStandardGamepad({connected:true,mapping:'standard',buttons:[],axes:[NaN,Infinity,2,-2]});
  assert.deepEqual(invalid.rawLeft,{x:0,y:0});
  assert.deepEqual(invalid.rawRight,{x:1,y:-1});
  const missing=readStandardGamepad({connected:true,mapping:'standard',buttons:[],axes:[]});
  assert.deepEqual(missing.rawLeft,{x:0,y:0});
  assert.equal(readStandardGamepad({connected:true,mapping:'unknown'}),null);
});

test('Sony reports retain raw sticks at every supported packet offset',()=>{
  for(const [profile,reportId,offset,size] of [['dualsense',1,0,64],['dualsense',0x31,1,64],['ds4',1,0,32],['ds4',0x11,2,32]]){
    const bytes=new Uint8Array(size);
    bytes.set([138,127,255,0],offset);
    const state=parseSonyHidGamepad(profile,reportId,new DataView(bytes.buffer));
    assert.deepEqual(state.rawLeft,{x:(138-127.5)/127.5,y:(127-127.5)/127.5});
    assert.deepEqual(state.rawRight,{x:1,y:-1});
    assert.deepEqual(state.left,deadzonePair(state.rawLeft.x,state.rawLeft.y));
    assert.deepEqual(state.right,deadzonePair(1,-1));
    assert.equal(state.left.amount,0);
    assert.ok(radial(state.rawLeft).amount>0);
  }
});

test('input selection and button stabilization preserve raw axes and clear stale samples',()=>{
  const state=readStandardGamepad({connected:true,mapping:'standard',buttons:[],axes:[.5,.5,-1,0]});
  const stabilizer=new LiveButtonStabilizer();
  const chosen=chooseLiveGamepadInput({standard:state});
  const stable=stabilizer.update(chosen.state,chosen.source,100);
  assert.deepEqual(stable.rawLeft,state.rawLeft);
  assert.deepEqual(stable.rawRight,state.rawRight);
  for(const options of [{},{standard:state,hid:state,hidAgeMs:451,sonyHidConnected:true}]){
    const cleared=chooseLiveGamepadInput(options);
    const result=stabilizer.update(cleared.state,cleared.source,110);
    assert.deepEqual(result.rawLeft,{x:0,y:0});
    assert.deepEqual(result.rawRight,{x:0,y:0});
    assert.deepEqual(tilt(result.rawLeft,'co'),identity);
  }
});
