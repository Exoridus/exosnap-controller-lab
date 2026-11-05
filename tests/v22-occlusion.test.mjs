import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STYLE_PRESETS } from '../style-mix.js';
import { usesPhysicalDepthMask, isSolidGhostPart, physicalDepthPolicy } from '../ghost-occlusion.js';
import { thumbstickCapSkirtProfile, thumbstickCapRadialSegments, thumbstickTopDisplacement } from '../thumbstick-geometry.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

// These policies must be testable without a WebGL GPU or physical DualSense.
test('ghost and glass hide rear geometry behind physical front surfaces',()=>{
  for(const mode of ['ghost','glass']){
    assert.equal(usesPhysicalDepthMask(mode),true);
    for(const role of ['housing','decoration','button','stick-stem','stick-cap']){
      assert.deepEqual(physicalDepthPolicy(mode,role),{
        enabled:true,colorWrite:false,depthTest:true,depthWrite:true,renderOrder:-100,side:'double'
      });
    }
  }
  for(const style of ['studio','graphite','wire']){
    assert.equal(usesPhysicalDepthMask(style),false);
    assert.equal(physicalDepthPolicy(style,'button').enabled,false);
  }
  assert.equal(physicalDepthPolicy('ghost','touch-contact').enabled,false);
});

test('Ghost controls remain physically occluded while visibly translucent at rest',()=>{
  for(const role of ['button','trigger','paddle','touch-surface','stick-cap','stick-stem','stick-base'])
    assert.equal(isSolidGhostPart(role),true,role);
  assert.equal(isSolidGhostPart('housing'),false);
  assert.equal(isSolidGhostPart('decoration'),false);
  // The post-v25 visual spec explicitly requires partially transparent idle controls.
  // Their independent colorless depth pass retains physical front/back occlusion.
  assert.ok(STYLE_PRESETS.ghost.control>0 && STYLE_PRESETS.ghost.control<1);
  assert.ok(STYLE_PRESETS.ghost.cap>0 && STYLE_PRESETS.ghost.cap<1);
  assert.match(app,/transparent:true,opacity:controlsOpacity/);
  assert.match(app,/depthTest:true,depthWrite:false/);
  assert.match(app,/mat\.opacity=part\.userData\.shell\?look\.shell:/);
  assert.match(app,/pressedControlStyle/);
  assert.match(app,/installPhysicalOccluder\(mesh,semantic\.role\)/);
});

test('colorless depth prepass precedes translucent surfaces and remains attached to meshes',()=>{
  assert.match(app,/new THREE\.MeshBasicMaterial\(\{\s*colorWrite:false,depthWrite:true,depthTest:true,side:THREE\.DoubleSide/);
  assert.match(app,/occluder\.renderOrder=physicalDepthPolicy\('ghost',role\)\.renderOrder/);
  assert.match(app,/mesh\.add\(occluder\)/);
  assert.match(app,/for\(const mesh of holder\.userData\.meshes\)installPhysicalOccluder\(mesh,semantic\.role\)/);
  assert.match(app,/if\(mesh\.userData\.depthOccluder\)mesh\.userData\.depthOccluder\.visible=true/);
  assert.match(app,/depthWrite:false,depthTest:true,worldUnits:false/);
  assert.match(app,/if\(x\.userData\.depthMask\)return/);
  assert.match(app,/if\(x\.isMesh&&!x\.userData\.depthMask\)/);
});

test('fixed thumbstick bezel does not tilt or accept L3 click while original stem and cap move together',()=>{
  assert.match(app,/ring\.userData\.control=null/);
  assert.match(app,/ring\.userData\.visualControl=null/);
  assert.match(app,/for\(const mesh of ring\.userData\.meshes\)mesh\.userData\.control=null/);
  assert.match(app,/for\(const moving of \[stem,cap\]\)/);
  assert.match(app,/pivot\.attach\(moving\)/);
  assert.match(app,/moving\.userData\.base=moving\.position\.clone\(\)/);
  assert.ok(app.includes('part.quaternion.set(tilt.x,tilt.y,tilt.z,tilt.w)'));
  assert.ok(app.includes('const tilt=stickTiltQuaternion(axes,'));
});

test('custom controller skirt is physically rounded and retains original source top',()=>{
  for(const [id,side] of [['DualSenseCompact','left'],['DS4Compact','left'],['XboxOneClean','right'],
    ['SwitchPro','left'],['JoyconLeft','left'],['Gamecube','left'],['Gamecube','right'],['SteamController2026','left']]){
    const points=thumbstickCapSkirtProfile({radius:.08,top:.2,modelId:id,side});
    assert.ok(points.length>=9,`${id} sufficient curved profile`);
    assert.ok(points[0][1] < .2 - .015,`${id} has physical side wall`);
    assert.ok(Math.max(...points.map(p=>p[1]))>.2 + .004,`${id} has raised rounded lip`);
    assert.ok(points.at(-1)[0]<points[Math.floor(points.length/2)][0],`${id} hollow center, no surface replacement`);
    assert.ok(points.every(p=>p.every(Number.isFinite)));
  }
  assert.equal(thumbstickCapRadialSegments('Gamecube','rs'),8);
  assert.match(app,/obj\.add\(skirt\)/);
  assert.doesNotMatch(app,/obj\.geometry\.dispose\(\);obj\.geometry=geo/);
});

test('thumbstick cup/dome profiles actually deform existing source vertices, not flat overlays',()=>{
  const sonyCenter=thumbstickTopDisplacement({radius:.08,distance:0,modelId:'DualSenseCompact'});
  const joyCenter=thumbstickTopDisplacement({radius:.08,distance:0,modelId:'JoyconLeft'});
  const cubeCenter=thumbstickTopDisplacement({radius:.08,distance:0,modelId:'Gamecube'});
  const cubeC=thumbstickTopDisplacement({radius:.08,distance:0,modelId:'Gamecube',side:'right'});
  assert.ok(sonyCenter<-.006,'DualSense has noticeable cup');
  assert.ok(joyCenter>0,'JoyCon is subtly domed');
  assert.ok(cubeCenter>cubeC,'GameCube main stick dome differs from C-stick');
  for(const modelId of ['DualSenseCompact','JoyconLeft','Gamecube']){
    assert.ok(Math.abs(thumbstickTopDisplacement({radius:.08,distance:.08,modelId}))<1e-12);
  }
  assert.match(app,/vertices\.setY\(i,vertices\.getY\(i\)\+thumbstickTopDisplacement/);
  assert.match(app,/obj\.geometry\.computeVertexNormals\(\)/);
  assert.doesNotMatch(app,/obj\.geometry\.dispose\(\);obj\.geometry=geo/);
});
