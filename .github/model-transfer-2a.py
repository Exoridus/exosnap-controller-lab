import hashlib,pathlib
items=[
('tests/2d-polish.test.mjs', 'fbb3adcb9f9d918deb44ab6e77d9dfe01bb387f242d56d92d06d00cb2722f953', 'fc3b844808ca95ee5cb2df0def207fb86526753b0d4fc22d12c39a5cb54a057a', [
(161,169,r"""test('mapped control surfaces retain pressure priority and independent authored contours',async()=>{
 const code=await file('polish-2d-style.js');
 assert.match(code,/const mapped=layer\.pressElement/);
 assert.match(code,/const surface=pressure\|\|mapped\|\|face/);
 assert.match(code,/fill:node===surface/);
 assert.match(code,/stroke:shapes\.length===1\|\|visibleStroke\(node\)/);
 assert.doesNotMatch(code,/data-exo-stick-click|polish-ring-mask/);
"""),
]),
('tests/consolidated-2d.test.mjs', '9cf4109967cf5ccee260e839c84d61470b9467cfb8d88070c9884408e4c5d030', 'fc6f288500b68ab9290cddd3c6bc7c3714a19b1b3254ce97701210be4d1fd3ef', [
(185,187,r"""    assert.equal(value(face,'stroke'),{dark:'#8d959d',light:'#737a81',mixed:'#77818b'}[scene],scene+' control contour');
    assert.match(value(glyph,'fill'),/^#[0-9a-f]{6}$/);
    assert.ok(!['#25282b','#ffffff','#000000'].includes(value(glyph,'fill')),scene+' muted surface-aware glyph');
"""),
(219,220,r""" assert.equal(value(face,'stroke'),'#8d959d','control contours are gray; housing stays unchanged');
"""),
(231,232,r"""  assert.ok((Math.max(surface,ink)+.05)/(Math.min(surface,ink)+.05)>=3,JSON.stringify({scene,transparency,pressed,activeColor,ink:value(glyph,'fill'),fill:value(face,'fill')}));
"""),
(236,236,r"""
test('semantic pressure geometry supplies DS4 touchpad, Xbox D-pad and Nintendo menu faces',async()=>{
 for(const [id,control]of [['dualshock4','touchpad'],['xbox_one',null],['generic',null],['switch_pro','start'],['switch_pro','select'],['switch_pro','home']]){
  const r=await reference(id);const entry=r.controls.find(e=>control?e.control===control:e.layer.role==='directional-pad');
  assert.ok(entry,id+' mapped input');
  paintPolished2D(r,'ghost','dark',{coherentContours:true,ringSurface:true,material2D:{neutralOpacity:.3,activeOpacity:.96}});
  const fills=entry.group.querySelectorAll('[data-exo-visible-control-fill]').filter(n=>value(n,'fill')!=='none');
  assert.ok(fills.length,id+' '+entry.layer.id+' must have a neutral control surface');
  assert.ok(fills.every(n=>value(n,'fill')==='#9ca3aa'&&Number(value(n,'fill-opacity'))===.3),id+' exact shared material');
 }
});
test('all Joy-Con source paths have mapped moving rim and center with independent fill',async()=>{
 for(const id of ['joycon_grip','joycon_left','joycon_right','joycon_pair','joycon_left_horizontal','joycon_right_horizontal']){
  const r=await reference(id);paintPolished2D(r,'ghost','dark',{coherentContours:true,ringSurface:true,material2D:{neutralOpacity:.3,activeOpacity:.96},left:{x:1,y:0},right:{x:0,y:1}});
  for(const e of r.controls.filter(e=>e.stickSide)){
   const ring=e.group.querySelector('[data-exo-stick-annulus-fill]'),center=e.group.querySelector('[id$="-top"]');
   assert.ok(ring&&center,id+' source-shaped rim and center');
   assert.equal(Number(value(ring,'fill-opacity')),.96);assert.equal(Number(value(center,'fill-opacity')),.3);
   assert.notEqual(value(center,'stroke'),'#ffffff','neutral contour is not white');
  }
 }
});
"""),
]),
('tests/consolidated-geometry.test.mjs', 'cc905bf88dbeb5ffd1c94a4297a52d881c422837746e1637af3c77d93ab06f2a', '5dbcc12b9a008b24899a4185ddf649948d0fe4844c337812d5f0010e1f26492f', [
(35,36,r"""   // Generic uses distinct approved SVG profiles now; the old four square-pad
   // matches no longer exist. Near matches must never be silently welded.
   const expected={DualSenseCompact:3,DS4Compact:1,XboxOneClean:0,Xbox360:3,SwitchPro:3,JoyconGrip:3,JoyconLeft:1,JoyconRight:1,Gamecube:0,Wavebird:0,GenericPro:0};
"""),
]),
('tests/final-browser-ink-contract.test.mjs', '01b245585ccbe1b708d789bc5dda6cfefafc4fc0e3fd7fa7aecfc8000ab2feb2', '358fdb933b42a9b240f07b0b865996f95e8e4c1e49b8c170fc89d9ed2f7ecc19', [
(3,5,r"""const light={scene:'light',housing:'rgb(133, 133, 133)',button:'rgb(115, 122, 129)',
  glyph:'rgb(72, 81, 91)',surface:'rgb(133, 133, 133)',alpha:.3,glyphOpacity:1,
"""),
(9,10,r"""  assert.doesNotThrow(()=>capture.verifyFlatAudit({...light,scene:'dark',housing:'#ffffff',button:'#8d959d',surface:'#9ca3aa',alpha:1}));
"""),
]),
('tests/final-socket-material.test.mjs', 'ddecc2bb735668605cb8cfba44c220eb011b4a2599b76ccbedfe2a70577215cd', '55e4c57364e780ca4e68ee996194b6a3e2b638f87289ea4f20b45907e28f1833', [
(3,3,r"""import * as THREE from 'three';
import {CONTROL_NEUTRAL} from '../controller-visual-policy.js';
"""),
(29,30,r"""    assert.ok(m.material.color.equals(m.userData.sourceColor.clone().lerp(new THREE.Color(CONTROL_NEUTRAL),amount)),'source identity blends to the shared neutral control material');
"""),
(46,47,r"""test('all families now share the verified support material policy while mix zero retains authored colors',async()=>{
"""),
(56,58,r"""     if(mix===0)assert.ok(mesh.material.color.equals(mesh.userData.sourceColor),id+' original hardware preserved at mix zero');
     assert.equal(mesh.material.opacity,recipe.material.supportOpacity,id+' uses common support alpha');
"""),
]),
('tests/model-consistency.test.mjs', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '3d74079f2546e6a7649ec1dc0948ec9080bc42db833c09e98d33008aec8966ff', [
(0,0,r"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CONTROLLERS,isLicensedModel} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig,applyControlPoseToRig} from '../pbr-appearance.js';
import {resolveLabRecipe} from '../controller-lab-style.js';
import {surfaceGlyphColor} from '../polish-2d-style.js';
const read=p=>fs.readFile(new URL('../'+p.replace(/^\.\//,''),import.meta.url),'utf8');
const models=CONTROLLERS.filter(isLicensedModel);
test('one consolidated neutral control material and non-emitting shell-linked supports across licensed models',async()=>{
 const neutralColors=new Set();
 for(const model of models){const r=await loadNativeRig(model,read);try{
  const recipe=resolveLabRecipe('white',1);applyPbrRecipeToRig(r,recipe,{});
  for(const mesh of r.meshes){const d=mesh.userData;
   if(['button','trigger','touch-surface','stick-cap','stick-pivot'].includes(d.role))neutralColors.add(mesh.material.color.getHexString());
   if(['stick-stem','stick-base','stick-well'].includes(d.role)){
    assert.equal(mesh.material.opacity,recipe.material.supportOpacity,model.id+' support '+d.sourceFile);
    const color=mesh.material.color.clone();
    applyPbrRecipeToRig(r,recipe,{allPressed:true,left:{x:1,y:0,click:true},right:{x:0,y:1,click:true}});
    assert.ok(mesh.material.color.equals(color),model.id+' support must never light');assert.equal(mesh.material.emissiveIntensity,0);
    applyPbrRecipeToRig(r,recipe,{});
   }
  }
 }finally{disposeNativeRig(r);}}
 assert.equal(neutralColors.size,1,'Ghost controls must not retain incompatible per-source neutral palettes: '+[...neutralColors]);
});
test('moving ring rim is separately weighted from lower structural sidewall without extra meshes',async()=>{
 for(const model of models.filter(m=>m.source==='co')){
  const r=await loadNativeRig(model,read);try{
   for(const mesh of r.meshes.filter(m=>m.userData.role==='stick-pivot')){
    const weights=mesh.geometry.getAttribute('controllerRimWeight');assert.ok(weights,model.id+' original rim/sidewall weights');
    assert.ok([...weights.array].some(v=>v===0),'lower structural vertices');assert.ok([...weights.array].some(v=>v===1),'upper interactive vertices');
    assert.equal(weights.count,mesh.geometry.attributes.position.count);
   }
  }finally{disposeNativeRig(r);}
 }
});
test('2D ink uses softened grayscale and continuous transitions rather than black/white threshold jumps',()=>{
 const rgb=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16));
 for(const scene of ['dark','light','mixed']){
  let previous;
  for(let i=0;i<=100;i++){
   const c=surfaceGlyphColor({control:'#9ca3aa',controlStroke:'#888888',controlAlpha:i/100,activeAlpha:.96,activeColor:'#ffffff',surfaceBackdrop:{dark:'#09111b',light:'#f4f6f9',mixed:'#9baab4'}[scene]},0);
   assert.ok(rgb(c).every(v=>v>=65&&v<=230),'muted, non-black ink '+c);
   if(previous)assert.ok(Math.max(...rgb(c).map((v,j)=>Math.abs(v-previous[j])))<26,'no abrupt polarity step');previous=rgb(c);
  }
 }
});
test('approved custom emblem is recovered and Nintendo housing wordmarks stay absent',async()=>{
 assert.match(await read('references/controllers/gamecube/source.svg'),/id="body-cube-outer"/);
 for(const id of ['switch_pro','joycon_grip'])assert.doesNotMatch(await read('references/controllers/'+id+'/source.svg'),/id="body-wordmark"/);
});

test('consolidated offscreen surfaces replace premultiplied RGBA instead of accumulating their own overlapping alpha',async()=>{
 const {NoBlending}=await import('three');
 for(const model of models){const r=await loadNativeRig(model,read);try{
  applyPbrRecipeToRig(r,resolveLabRecipe('white',.7),{});
  for(const mesh of r.meshes){assert.equal(mesh.material.blending,NoBlending);assert.equal(mesh.material.premultipliedAlpha,true);assert.equal(mesh.material.depthWrite,true);}
 }finally{disposeNativeRig(r);}}
});

test('authored disconnected housing wells use support alpha without altering original shell vertices',async()=>{
 const r=await loadNativeRig(CONTROLLERS.find(m=>m.id==='Xbox360'),read);try{
  const shell=r.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
  const weights=shell.geometry.getAttribute('controllerRimWeight');
  assert.ok(weights,'documented source support regions must reach the shared material');
  assert.ok([...weights.array].some(v=>v===0)&&[...weights.array].some(v=>v===1));
  const positions=shell.geometry.attributes.position.array.slice();
  applyPbrRecipeToRig(r,resolveLabRecipe('white',.7),{allPressed:true});
  assert.equal(shell.material.userData.rimSurface.alpha.value,resolveLabRecipe('white',.7).material.supportOpacity);
  assert.deepEqual(shell.geometry.attributes.position.array,positions);
  assert.equal(shell.material.emissiveIntensity,0);
 }finally{disposeNativeRig(r);}
});
"""),
]),
('tests/pages-release.test.mjs', 'd645f13ea3656527d7cd913db96012726963279cc8f4d0621dd62f25066c8500', '0f2dd295011bbe96a597db0052cb3617a2ae317bc281e31dc05fe75605eaae2f', [
(86,87,r""" assert.equal(manifest.license,'MIT AND CC0-1.0');
"""),
]),
('tests/v21-parity.test.mjs', 'a66b8dbde9e10e1d23356e07e361edc7311aca69e7da43aa1df9714157b2245b', 'f85a95a321d73ca457937a9ba101f05372c122905f78d2952f6519d0f78f0304', [
(173,174,r"""    assert.ok(['MIT','GPL-3.0-only','MIT AND CC0-1.0'].includes(mapping.license?.spdx),layout.id);
"""),
]),
]
for name,before,after,edits in items:
 p=pathlib.Path(name);source=p.read_text() if p.exists() else ''
 assert hashlib.sha256(source.encode()).hexdigest()==before, 'Source changed: '+name
 lines=source.splitlines(keepends=True)
 for a,b,text in reversed(edits):lines[a:b]=[text]
 result=''.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==after, 'Result mismatch: '+name
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(result)
print('Exact source files applied:',len(items))
