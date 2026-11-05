import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveButtonStabilizer} from '../input-stabilizer.js';
import {controllerPartTransform, thumbstickCapProfile, isFlatThumbCap} from '../thumbstick-geometry.js';
import {ghostOutlineStyle, ghostShellSurfaceOpacity, isSecondaryHousing} from '../ghost-appearance.js';

function state(buttons=[],axes=[0,0]){
  return {values:new Map(buttons),left:{x:axes[0],y:axes[1],amount:Math.hypot(...axes)},right:{x:0,y:0,amount:0},id:'Sony DualSense',index:0,timestamp:10};
}

test('held input never blinks on brief missing HID reports or a source handoff',()=>{
  const latch=new LiveButtonStabilizer({releaseGraceMs:55,staleGraceMs:100});
  assert.equal(latch.update(state([['b1',1]]),'WebHID',0).values.get('b1'),1);
  assert.equal(latch.update(state([]),'Gamepad API (fallback)',16).values.get('b1'),1);
  assert.equal(latch.update(state([['b1',1]]),'WebHID',33).values.get('b1'),1);
  assert.equal(latch.update(state([]),'WebHID',70).values.get('b1'),1);
  assert.equal(latch.update(state([]),'WebHID',126).values.has('b1'),false);
});

test('stale or disconnected input clears any old button before 120ms',()=>{
  const latch=new LiveButtonStabilizer({releaseGraceMs:55,staleGraceMs:100});
  latch.update(state([['ls',1]]),'WebHID',0);
  assert.equal(latch.update(state([]),'stale',20).values.get('ls'),1);
  assert.equal(latch.update(state([]),'stale',110).values.has('ls'),false);
  latch.update(state([['b2',1]]),'WebHID',200);
  latch.reset();
  assert.equal(latch.update(state([]),'unavailable',210).values.has('b2'),false);
});

test('analog joystick axes are passed through immediately, not button-debounced',()=>{
  const latch=new LiveButtonStabilizer();
  const s=latch.update(state([], [0.75,-0.5]),'WebHID',0);
  assert.deepEqual([s.left.x,s.left.y],[0.75,-0.5]);
  assert.equal(s.values.has('ls'),false);
});

test('controller nested parts preserve manifest pivot and local mesh coordinates',()=>{
  const ring=controllerPartTransform('co',{position:[-0.32,0.2,-0.02]},[0,0.2,0]);
  const cap=controllerPartTransform('co',{position:[0,0,0]},[0,0.22,0]);
  assert.deepEqual(ring.pivot,[-.32,.2,-.02]);
  assert.deepEqual(cap.pivot,[0,0,0]);
  assert.deepEqual(ring.geometryOffset,[0,0,0]);
  assert.deepEqual(cap.geometryOffset,[0,0,0]);
  assert.ok(Math.abs(ring.pivot[1]+cap.pivot[1]+0.22-0.42)<.00001,'cap top stays beside ring, not floating above');
});

test('thin thumbstick caps get a real concave 3D surface',()=>{
  assert.equal(isFlatThumbCap({radius:0.08,height:0.01}),true);
  assert.equal(isFlatThumbCap({radius:0.08,height:0.07}),false);
  const points=thumbstickCapProfile({radius:.076,top:.226});
  const heights=points.map(p=>p[1]);
  assert.ok(Math.max(...heights)-Math.min(...heights)>.025,'physical cap must have noticeable thickness');
  assert.ok(points[points.length-1][1] < Math.max(...heights)-0.005,'thumb surface must be concave inside raised lip');
  assert.ok(points.length>=9);
});

test('two-tone outlines are thick and contrast on both bright and dark backgrounds',()=>{
  const high=ghostOutlineStyle({strength:.5,kind:'control',brightBackground:true});
  const normal=ghostOutlineStyle({strength:.5,kind:'control',brightBackground:false});
  assert.ok(high.shadowWidthPx>=2.5);
  assert.ok(normal.highlightWidthPx>=1);
  assert.ok(high.shadowOpacity>normal.shadowOpacity);
  assert.ok(normal.highlightOpacity>=.6);
});

test('ghost rear housing contributes minimally to front translucent body and gets no inner seams',()=>{
  assert.equal(isSecondaryHousing('bottom_shell.obj'),true);
  assert.equal(isSecondaryHousing('top_shell.obj'),false);
  assert.ok(ghostShellSurfaceOpacity('bottom_shell.obj',.10)<=.03);
  assert.ok(Math.abs(ghostShellSurfaceOpacity('top_shell.obj',.10)-.035)<1e-12);
});

test('nested Steam Controller thumbstick cap follows the ring control and gains volumetric material',async()=>{
  const {isJoystickTip,inheritedStickControl}=await import('../gamepad-input.js');
  assert.equal(inheritedStickControl('thumbstick_left_cap.obj','ls'),'ls');
  assert.equal(inheritedStickControl('thumbstick_right.obj','rs'),'rs');
  assert.equal(isJoystickTip('thumbstick_right_cap.obj'),true);
});
