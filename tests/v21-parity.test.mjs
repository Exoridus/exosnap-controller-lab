import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LAYOUTS, VIEWER_LAYOUTS, layoutForId, detectLayoutFromGamepad,
  semanticControlFrom2DLayer, controllerLabelOverride } from '../controller-catalog.js';
import { modelPartSemantics, shouldShowContour, isSourceBodyPart } from '../model-semantics.js';
import { thumbstickCapStyle, thumbstickCapSkirtProfile, thumbstickCapRadialSegments } from '../thumbstick-geometry.js';
import { demoStickAxes, stickTiltAngles } from '../stick-visual-state.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const getModel=(id,family='nintendo',source='co',layoutId=null)=>({id,family,source,layoutId});
const S=(file,model,meta=null)=>modelPartSemantics(file,model,meta);

test('the 2D/3D catalog contains exactly 20 source identities plus one explicitly 3D-only WaveBird',()=>{
  const source=JSON.parse(read('references/controllers/catalog.json')).controllers;
  assert.equal(source.length,20);assert.equal(LAYOUTS.length,20);assert.equal(VIEWER_LAYOUTS.length,21);
  assert.deepEqual(source.map(x=>x.id),LAYOUTS.map(x=>x.id));
  assert.equal(layoutForId('wavebird').availability,'3d-only');
  assert.equal(layoutForId('generic').modelId,'GenericPro');
  assert.equal(layoutForId('generic').availability,'native');
  assert.equal(layoutForId('joycon_pair').availability,'composite');
  assert.deepEqual(layoutForId('joycon_pair').modelIds,['JoyconLeft','JoyconRight']);
  assert.equal(layoutForId('xbox_360').modelId,'Xbox360');
  assert.equal(layoutForId('xbox_360').availability,'native');
  assert.equal(layoutForId('xbox_series').availability,'license-review');
  assert.equal(layoutForId('steam_controller_2026').availability,'license-review');
  assert.equal(layoutForId('dualsense_edge').availability,'proxy');
  assert.equal(layoutForId('steam_controller').availability,'reference');
});

test('all 20 2D sources and mappings are present, self-consistent and reference actual drawable groups',()=>{
  for(const layout of LAYOUTS){
    const file=`references/controllers/${layout.id}/`;
    assert.ok(existsSync(new URL('../'+file+'mapping.json',import.meta.url)),file);
    const mapping=JSON.parse(read(file+'mapping.json'));
    const source=read(file+'source.svg');
    assert.equal(mapping.id,layout.id);
    assert.ok(source.includes('<svg')&&source.includes('viewBox='));
    assert.ok(!source.includes('<script'),layout.id);
    assert.ok(Array.isArray(mapping.viewBox)&&mapping.viewBox.length===4);
    for(const part of mapping.layers){
      assert.ok(source.includes(`id="${part.id}"`),`${layout.id}: missing SVG group ${part.id}`);
      if(part.pressElement) assert.ok(source.includes(`id="${part.pressElement}"`),`${layout.id}: missing pressElement ${part.pressElement}`);
      if(part.knockout) assert.ok(source.includes(`id="${part.knockout}"`),`${layout.id}: missing knockout ${part.knockout}`);
    }
  }
});

test('2D mapping retains browser-standard semantics, preview-only controls and device-dependent buttons',()=>{
  assert.equal(semanticControlFrom2DLayer({binding:{type:'button',mask:4}}),'b1');
  assert.equal(semanticControlFrom2DLayer({binding:{type:'button',mask:2048}}),'r1');
  assert.equal(semanticControlFrom2DLayer({binding:{type:'axis',field:'right_trigger'}}),'r2');
  assert.equal(semanticControlFrom2DLayer({binding:{type:'stick',axes:['left_x','left_y']}}),'ls');
  assert.equal(semanticControlFrom2DLayer({binding:null,preview:{key:'l4'}}),'l4');
  assert.equal(semanticControlFrom2DLayer({binding:null,preview:{key:'touch-r'}}),'rightpad');
  assert.equal(semanticControlFrom2DLayer({binding:{type:'auxiliary',field:'share'}}),'share');
  assert.equal(semanticControlFrom2DLayer({binding:null,role:'body'}),null);
});

test('3D part semantics keep joystick caps movable, independent from non-moving Xbox bezel',()=>{
  assert.deepEqual(S('left_ring.obj',getModel('DualSenseCompact','playstation')).role,'stick-pivot');
  assert.equal(S('left_cap.obj',getModel('DualSenseCompact','playstation')).role,'stick-cap');
  assert.equal(S('left_cap.obj',getModel('DualSenseCompact','playstation')).control,null);
  const xbox=getModel('XboxSeries','xbox','padforge');
  assert.equal(S('Joystick-Left-Ring.obj',xbox).role,'stick-base');
  assert.equal(S('Joystick-Left-Ring.obj',xbox).control,null);
  assert.equal(S('LeftStickClick.obj',xbox).role,'stick-cap');
  assert.equal(S('RightStickClick.obj',xbox).pickControl,'rs');
  assert.equal(S('Share.obj',xbox).control,'share');
});

test('Steam, Nintendo and GameCube use real role-aware bindings, not loose filename heuristics',()=>{
  const steam=getModel('SteamController2026','steam');
  for(const key of ['l4','l5','r4','r5']){
    const part=S(`button_${key}.obj`,steam);
    assert.equal(part.control,key);assert.equal(part.role,'paddle');assert.equal(part.preview,true);
  }
  assert.equal(S('button_misc.obj',steam).control,'quick-access');
  assert.equal(S('touchpad_left.obj',steam).role,'touch-surface');
  assert.equal(S('touch_point1.obj',steam).role,'touch-contact');
  assert.equal(S('misc.obj',getModel('SwitchPro')).control,'share');
  assert.equal(S('paddle1.obj',getModel('JoyconLeft')).control,'sl');
  assert.equal(S('paddle3.obj',getModel('JoyconLeft','nintendo','co','joycon_left_horizontal')).control,'r1');
  assert.equal(S('dpad_left.obj',getModel('JoyconLeft','nintendo','co','joycon_left_horizontal')).control,'b1');
  assert.equal(S('a_button.obj',getModel('JoyconRight','nintendo','co','joycon_right_horizontal')).control,'b1');
  assert.equal(S('a_button.obj',getModel('SwitchPro')).control,'b2');
  assert.equal(S('a_button.obj',getModel('Gamecube')).control,'b1');
  assert.equal(controllerLabelOverride('gamecube','r1'),'Z');
  assert.equal(controllerLabelOverride('gamecube','rs'),'C-Stick');
});

test('true 3D cap skirts differ by device, preserve C-stick octagon and do not replace source mesh',()=>{
  const sony=thumbstickCapSkirtProfile({radius:.08,top:.2,modelId:'DualSenseCompact'});
  const joy=thumbstickCapSkirtProfile({radius:.08,top:.2,modelId:'JoyconLeft'});
  const cube=thumbstickCapSkirtProfile({radius:.08,top:.2,modelId:'Gamecube',side:'right'});
  assert.notDeepEqual(sony,joy);assert.notDeepEqual(joy,cube);
  assert.equal(thumbstickCapStyle('Gamecube','right'),'gamecubeC');
  assert.equal(thumbstickCapRadialSegments('Gamecube','rs'),8);
  assert.equal(thumbstickCapRadialSegments('Gamecube','ls'),48);
  assert.throws(()=>thumbstickCapSkirtProfile({radius:0,top:1,modelId:'DualSenseCompact'}));
  const app=read('app.js');
  assert.match(app,/obj\.add\(skirt\)/);
  assert.doesNotMatch(app,/obj\.geometry\.dispose\(\);obj\.geometry=geo/);
  assert.match(app,/profiled-thumbstick-skirt/);
});

test('input click and movement cannot be accidentally conflated',()=>{
  assert.deepEqual(stickTiltAngles(null,'co'),{x:0,z:-0});
  assert.deepEqual(stickTiltAngles({x:0,y:0},'padforge'),{x:-0,z:0});
  assert.ok(Math.abs(stickTiltAngles({x:.5,y:-.7},'co').x+.154)<.001);
  assert.ok(Math.abs(stickTiltAngles({x:.5,y:-.7},'padforge').z-.11)<.001);
  assert.ok(Math.abs(demoStickAxes(420,'left').x)<=1);
  const app=read('app.js');
  assert.ok(app.includes('const tilt=stickTiltQuaternion(axes,'));
  assert.doesNotMatch(app,/strength\?Math\.cos\(seconds\*3\.7\)/);
});

test('rear housing stays loaded for studio/360 while ghost contour suppression is policy-dependent',()=>{
  const app=read('app.js');
  assert.equal(isSourceBodyPart('bottom_shell.obj'),true);
  assert.equal(shouldShowContour('bottom_shell.obj','housing','ghost'),false);
  assert.equal(shouldShowContour('bottom_shell.obj','housing','studio'),false);
  assert.equal(shouldShowContour('top_shell.obj','housing','ghost'),true);
  assert.doesNotMatch(app,/\.filter\(spec=>!\/\^bottom/);
  assert.match(app,/Keep rear shells for Studio \/ 360°/);
  assert.match(app,/new THREE\.OrthographicCamera/);
  assert.match(app,/pivot\.attach\(moving\)/);
  assert.match(app,/moving\.userData\.base=moving\.position\.clone\(\)/);
});

test('automatic detection never conflates ambiguous Xbox/Steam generations',()=>{
  assert.equal(detectLayoutFromGamepad('Xbox 360 Controller'),'xbox_360');
  assert.equal(detectLayoutFromGamepad('Xbox Series Controller'),'xbox_series');
  assert.equal(detectLayoutFromGamepad('Xbox Elite Series 2'),'xbox_elite');
  assert.equal(detectLayoutFromGamepad('Xbox'),'generic');
  assert.equal(detectLayoutFromGamepad('Steam Controller'),'steam_controller');
  assert.equal(detectLayoutFromGamepad('Steam Controller (2026)'),'steam_controller_2026');
  assert.equal(detectLayoutFromGamepad('Sony DualSense Edge'),'dualsense_edge');
});

test('new 2D/3D controls and original motion defaults coexist',()=>{
  const html=read('index.html');const app=read('app.js');
  for(const id of ['referenceMode','referenceOpacity','referenceFrame','referenceGraphic','parityNotice']){
    assert.ok(html.includes(`id="${id}"`),id);
  }
  // v26+ intentionally replaced the old reference-view button with six panels.
  for(const type of ['2d','3d'])for(const scene of ['dark','light','mixed'])
    assert.ok(html.includes(`id="parity-${type}-${scene}"`),`${type}-${scene}`);
  assert.match(app,/const parityPanels=/);
  assert.match(app,/parityPlane/);
  assert.match(app,/referenceMode!=='2d'/);
  assert.match(app,/const sourceView=\{\.\.\.spec\.sourceModel,layoutId:currentLayout\.id\}/);
  assert.match(app,/makePart\(parsed,spec\.file,sourceView,spec\.meta\)/);
  assert.match(app,/inputMode==='live'\?liveState\?\.left/);
  const originalMotionHash='87d7cebf21b9a1aa7522eacb712aeac82b5a4563da573995f59ab851c0d2e4ea';
  // Independent verification of the byte-for-byte preserved tuning module.
  const actual=createHash('sha256').update(read('motion-tuning.js')).digest('hex');
  assert.equal(actual,originalMotionHash);
});


test('2D parity check page can run without the Three.js module',()=>{
  const html=read('reference-check.html'),js=read('reference-check.js');
  assert.ok(html.includes('id="artwork"'));
  assert.ok(html.includes('id="layout"'));
  assert.ok(html.includes('reference-check.js'));
  assert.ok(!js.includes("from 'three'"));
  assert.ok(js.includes("from './controller-reference.js'"));
  assert.ok(js.includes('await reference.load(current)'));
});
test('each bundled SVG reference declares a license and complete mapping metadata',()=>{
  for(const layout of LAYOUTS){
    const mapping=JSON.parse(read(`references/controllers/${layout.id}/mapping.json`));
    assert.ok(['MIT','GPL-3.0-only'].includes(mapping.license?.spdx),layout.id);
    assert.ok(mapping.layers.every(l=>l.id&&l.role),layout.id);
  }
  assert.ok(existsSync(new URL('../licenses/GPL-3.0.txt',import.meta.url)));
  assert.ok(existsSync(new URL('../THIRD_PARTY_NOTICES.md',import.meta.url)));
});
