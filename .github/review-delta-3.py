import hashlib,pathlib
items=[
('.github/workflows/2d-polish-review.yml', '6b63a3a767388c220a0aac4e92a073e66e411a4b730489a518c3113af7f11057', '83b9dd7303c1ed587e33a660d7df122119dd55ef4aacdac0f843d4249f2dab57', [
(28,28,r"""          npx playwright install ffmpeg
"""),
]),
('tests/consolidated-2d.test.mjs', '7af44e4d29c485725ea7950cf0835d25963eddae78c576f092b0b89d6849786f', 'f85c2c5bcaab7b06c21be025e1dee05196c78dc29f6b6542f577a963a685c74c', [
(10,10,r"""  cloneNode(deep=false){const n=new SvgNode(this.localName,Object.fromEntries(this.attrs));if(deep)for(const c of this.children)n.append(c.cloneNode(true));return n;}
"""),
(192,192,r"""
test('final 2D uses a filled masked annulus for motion and an independent click center',async()=>{
 const r=await reference();
 const options={coherentContours:true,ringSurface:true,material2D:{neutralOpacity:.3,activeOpacity:.96}};
 paintPolished2D(r,'ghost','dark',options);
 const outer=r.svg.querySelector('[id="stick-l-cap-outline"]'),center=r.svg.querySelector('[id="stick-l-cap-top"]');
 const originalStroke=value(outer,'stroke'),originalAlpha=value(outer,'stroke-opacity');
 paintPolished2D(r,'ghost','dark',{...options,left:{x:1,y:0}});
 const ring=r.svg.querySelector('[id="stick-l-cap"]').querySelector('[data-exo-stick-annulus-fill]');
 assert.ok(ring,'real annulus surface exists');
 assert.equal(value(ring,'fill'),'#ffffff');assert.equal(Number(value(ring,'fill-opacity')),.96);
 assert.equal(Number(value(center,'fill-opacity')),.3,'motion does not click center');
 assert.equal(value(outer,'stroke'),originalStroke);assert.equal(value(outer,'stroke-opacity'),originalAlpha);
 paintPolished2D(r,'ghost','dark',{...options,left:{x:1,y:0},values:new Map([['ls',1]])});
 assert.equal(Number(value(center,'fill-opacity')),.96);
 paintPolished2D(r,'ghost','dark',{...options,markings:false});
 for(const glyph of r.svg.querySelectorAll('.glyph'))assert.equal(value(glyph,'display'),'none');
 paintPolished2D(r,'ghost','dark',{...options,markings:true});
 for(const glyph of r.svg.querySelectorAll('.glyph'))assert.notEqual(value(glyph,'display'),'none');
});
"""),
]),
('tests/controller-3d-consolidation.test.mjs', 'c14e1d64228b5c603807c1900e1f0104fd33f07d5ef06eaad06b4439ce5e05b7', 'cf6f5e3cd783676d59b6acbf4d3df9001f16422ce2c011de24758a0aa29da28f', [
(94,95,r"""test('controller artwork is UV-bound to existing geometry with no floating planes',async()=>{
"""),
(98,106,r"""  const marks=rig.meshes.filter(m=>m.userData.artworkKey);
  assert.equal(marks.length,8);
  for(const mesh of marks){
   assert.equal(mesh.userData.surfaceArtwork,'button-material');
   assert.equal(mesh.geometry.getAttribute('controllerMarkUv').count,mesh.geometry.getAttribute('position').count);
"""),
(118,119,r"""test('source SVG paths and full transforms paint faces and D-pad without floating menu labels',async()=>{
"""),
(144,146,r"""  assert.equal(count,8,'all four faces and D-pad directions, no floating menus');
  for(const key of ['cross','circle','square','triangle','up','left','right','down'])
"""),
(149,150,r"""  assert.equal(labels.length,0);
"""),
]),
('tests/final-demo-mechanics.test.mjs', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '427232b1cc0834968b3fe50f76ee178ca575f589f3b821cea27708f93c0f27b0', [
(0,0,r"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import * as appearance from '../pbr-appearance.js';
import {prepareGhostOcclusion} from '../ghost-depth-policy.js';
const demo=await import('../controller-demo.js').catch(()=>({}));
const read=url=>fs.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');

test('restored physical pose depresses each button and rotates both triggers about their authored pivots',async()=>{
 assert.equal(typeof appearance.applyControlPoseToRig,'function');
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 try {
  prepareGhostOcclusion(rig);
  const part=file=>rig.parts.find(p=>p.file===file).holder;
  const checks=[['a_button.obj','b1'],['dpad_up.obj','up'],['left_bumper.obj','l1'],['right_bumper.obj','r1']];
  const rest=new Map(checks.map(([f])=>[f,part(f).position.clone()]));
  for(const [file,key] of checks){
   appearance.applyControlPoseToRig(rig,{values:new Map([[key,1]])});
   assert.ok(part(file).position.distanceTo(rest.get(file))>.002,file+' has visible mechanical travel');
   appearance.applyControlPoseToRig(rig,{}); assert.ok(part(file).position.equals(rest.get(file)));
  }
  const trigger=part('left_trigger.obj'),q=trigger.quaternion.clone();
  appearance.applyControlPoseToRig(rig,{triggers:{left:.5,right:0}});
  const half=trigger.quaternion.angleTo(q);
  assert.ok(half>.08);assert.equal(part('right_trigger.obj').quaternion.angleTo(q),0);
  appearance.applyControlPoseToRig(rig,{triggers:{left:1,right:0}});
  assert.ok(Math.abs(trigger.quaternion.angleTo(q)-half*2)<1e-6);
  rig.group.updateMatrixWorld(true);
  const hint=rig.rearHintLines.find(h=>h.userData.control==='l2');
  const moving=hint.matrixWorld.clone();
  appearance.applyControlPoseToRig(rig,{});rig.group.updateMatrixWorld(true);
  assert.ok(!hint.matrixWorld.equals(moving),'hidden contour follows its moving mesh');
  assert.ok(trigger.quaternion.equals(q),'neutral restores exact pose');
 } finally {disposeNativeRig(rig);}
});
test('demo reuses a deterministic state, covers each input and returns to neutral at the seam',()=>{
 assert.equal(typeof demo.demoStateAt,'function');
 const output=demo.createControllerState();const seen=new Set();let combined=false,partial=false;
 for(let t=0;t<demo.DEMO_DURATION_MS;t+=20){
  assert.equal(demo.demoStateAt(t,output),output);
  for(const [key,value]of output.values)if(value>.5)seen.add(key);
  if(output.left.click&&Math.hypot(output.left.x,output.left.y)>.2)combined=true;
  if(output.triggers.left>.05&&output.triggers.left<.95)partial=true;
 }
 for(const key of ['b1','b2','b3','b4','up','down','left','right','l1','r1','l2','r2','ls','rs'])assert.ok(seen.has(key),key);
 assert.ok(combined&&partial);
 demo.demoStateAt(demo.DEMO_DURATION_MS,output);
 assert.ok([...output.values.values()].every(v=>v===0));assert.equal(output.left.x,0);
});
test('manual and live states replace demo rather than merging; sampling twice does not advance its clock',()=>{
 assert.equal(typeof demo.ControllerDemo,'function');
 const driver=new demo.ControllerDemo();driver.sample(0);driver.sample(100);
 const t=driver.demoTime;driver.sample(100);assert.equal(driver.demoTime,t);
 const manual=demo.createControllerState();manual.values.set('r1',1);
 const out=driver.sample(150,{manual});assert.equal(out.source,'manual');
 assert.equal(out.values.get('r1'),1);assert.equal(out.values.get('b1')||0,0);
 const paused=driver.demoTime;driver.sample(300,{manual});assert.equal(driver.demoTime,paused);
 driver.setEnabled(false);const neutral=driver.sample(600);
 assert.equal(neutral.source,'neutral');assert.ok([...neutral.values.values()].every(v=>!v));
});
"""),
]),
('tests/final-surface-markings.test.mjs', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '9e9ba374d10a5de5e253ace6efb370012419665f08b31dc3b0ff0ab7f7d20c87', [
(0,0,r"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import * as artwork from '../control-glyphs.js';
const read=url=>fs.readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('runtime markings belong to existing button materials, never floating meshes',async()=>{
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 try{
  const marks=rig.meshes.filter(m=>m.userData.artworkKey);
  assert.equal(marks.length,8,'four faces and four D-pad surfaces, no floating Share/Options');
  assert.ok(marks.every(m=>m.geometry.getAttribute('controllerMarkUv')?.count===m.geometry.getAttribute('position').count));
  const floats=[];rig.group.traverse(o=>{if(o.geometry?.type==='PlaneGeometry'&&o.userData.surfaceArtwork)floats.push(o);});
  assert.equal(floats.length,0);
  assert.ok(!marks.some(m=>['view','menu'].includes(m.userData.artworkKey)));
 }finally{disposeNativeRig(rig);}
});
test('global material markings toggle changes uniforms, not geometry or shader identity',()=>{
 assert.equal(typeof artwork.installSurfaceMarking,'function');
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshPhysicalMaterial());
 mesh.userData={artworkKey:'up',sourceColor:new THREE.Color('#eeeeee')};
 const texture=new THREE.Texture();artwork.installSurfaceMarking(mesh,texture);
 const geometry=mesh.geometry,material=mesh.material,program=material.customProgramCacheKey();
 const native={meshes:[mesh]};artwork.setControllerMarkings(native,false);
 assert.equal(material.userData.surfaceMarking.enabled.value,0);
 artwork.setControllerMarkings(native,true);
 assert.equal(material.userData.surfaceMarking.enabled.value,1);
 assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(material.customProgramCacheKey(),program);
 assert.ok(material.userData.surfaceMarking.ink.value.r<.1,'D-pad ink is dark at rest');
});
"""),
]),
('tests/pbr-diagnostics.test.mjs', '18cc4183fbe17d3642fd3558d898770c1a8752c2094e201a361a3bd01cf94e1c', '0a77083e285c5dd39e9b0305535f3426b72ef7a283c22196761444200cee0534', [
(22,23,r"""  assert.equal((html.match(/type="range"/g)||[]).length,3);
"""),
]),
('tests/pbr-interface.test.mjs', '36bac15187d5643e95350d724a32e9f7846220cb667f7ea6754158a5da770182', '6a6a0b60b6dd4a09fe021b67cb442aad293c8bc47e4b90bb96693300b87fd3ab', [
(10,11,r"""  assert.equal((html.match(/type="range"/g)||[]).length,3);
"""),
]),
('tests/v33-navigation.test.mjs', 'a5e00de71eda42bcbe099ec384a933347317db5592360003ddbf8c856222b918', '40881ce96be934d371afa9668633fd01615de15b202d80594720589c6c015bd0', [
(23,24,r"""  assert.equal((html.match(/type="range"/g)||[]).length,3);
"""),
]),
('tests/v35-parity-depth.test.mjs', '6dc9f89002b112ef87eb21b88f6f45632cbc8aa6511fa7fab17d98bcdd56fecd', '1be26d4a5ac7e86d9e756aec69a7bae6caa68368cc7513bb65d3aceb55794b90', [
(86,87,r"""  assert.equal((html.match(/type="range"/g)||[]).length,3);
"""),
]),
('tests/v39-four-looks.test.mjs', '05e854b98a084507540daedd7178d1fd283f5bdd6a57fbc67ae57ef4df4a85d8', 'dc9c43eb2f37617b8684f4cd0521ca01920abab84d805deca9203d5f25794687', [
(46,47,r"""  const flatPaint=js.split('function updateFlatReferences(input=state.frameInput){')[1].split('function makeScene(){')[0];
"""),
(66,67,r""" const body=js.split('function render(now=performance.now()){')[1]?.split('function getLiveStickPose()')[0]||'';
"""),
]),
('tests/v40-glyphs.test.mjs', '27e8640423c6e834a4a9ba860b2b73cb5c4d255b1eb466d902beb47b924702d6', '7eb3f879a4912da6f99ce7022af6fa1aeb8731586d8e1cfc5ee86966155ea4e1', [
(8,9,r"""test('DualSense physical face buttons have PlayStation ink UVs on the original button geometry',async()=>{
"""),
(13,15,r"""  assert.ok(glyphs.every(o=>o.geometry.attributes.controllerMarkUv.count===o.geometry.attributes.position.count));
  assert.ok(glyphs.every(o=>o.material.depthTest&&o.material.depthWrite));
"""),
(35,36,r"""   assert.ok(glyphs.every(o=>o.userData.surfaceArtwork==='button-material'));
"""),
]),
('tools/archive-snapshots.mjs', 'f8f73a47fd9eb6f04f26a67f152a4eba7bfb462e75e3969ad5a94b56a8708753', '74e32da6c171162b1202dfff439cbe6b51001b9be3dd1a18098de6ed2b52b71c', [
(22,23,r"""  targets.push(...manifest.images.filter(x=>/^(?:2d-|3d-(?:consolidated|final)-)[a-z0-9-]+\.png$/.test(x.file)).map(x=>x.file));
"""),
]),
('tools/build-pages.mjs', '40ad01c95ac80b750f71a82d31256fe38c74d50366caa6d6e0033cab485b75e7', 'a8fe6185b58f3b2ea249e15eb5b0ad5b9262054fd7a6593c4d26cdb73bea04c9', [
(32,33,r"""      if(name==='controller-demo.webm')await copyFile(path.join(captureDir,name),path.join(dest,'screenshots',name));
      if(/^(?:2d|3d-joycon|3d-consolidated|3d-final)-[a-z0-9-]+\.png$/.test(name))
"""),
]),
('tools/capture-consolidated.mjs', '7c50db44a11cccc706e523538580e664e11c7d10a04e009969d61c2ae2f9f758', '1c03593b3dba6534808648c5407e5e6b27b60cc02aad24e8e3684274654d001c', [
(74,75,r"""  if(artwork.join(',')!==['circle','cross','down','left','right','square','triangle','up'].sort().join(','))
"""),
]),
('tools/capture-final-polish.mjs', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'fa43084a93c7fe8f652a733cf8112079226b7cc7eac8ed14979d4e3ab4738e47', [
(0,0,r"""// End-to-end tests for the actual current Lab. No synthetic render substitutes.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFile,rename} from 'node:fs/promises';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
export async function captureFinalPolish(page,{output,images,base}){
 const ready=()=>page.waitForFunction(()=>document.body.dataset.renderReady==='three-rendered'&&!!window.__exoPbrLab,null,{timeout:60000});
 const frame=async action=>{
  const previous=await page.evaluate(()=>Number(document.body.dataset.renderRevision||0));await action();
  await page.waitForFunction(n=>Number(document.body.dataset.renderRevision||0)>n,previous,{timeout:30000});
 };
 const input=(id,value)=>frame(()=>page.locator('#'+id).evaluate((el,value)=>{
  if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value);
  el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));
 },value));
 const shot=async(file,scenario)=>{
  const opened=await page.evaluate(()=>['appearanceSettings','inputDebug'].map(id=>{const el=document.getElementById(id),was=el.open;el.open=false;return was;}));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const bytes=await page.screenshot({path:path.join(output,file),fullPage:true});
  images.push({file,scenario,bytes:bytes.length,sha256:hash(bytes)});
  await page.evaluate(values=>['appearanceSettings','inputDebug'].forEach((id,i)=>document.getElementById(id).open=values[i]),opened);
 };
 await ready();
 const defaults=await page.evaluate(()=>({demo:document.querySelector('#demoToggle').checked,marks:document.querySelector('#markingsToggle').checked,
  debug:document.querySelector('#inputDebug').open,appearance:document.querySelector('#appearanceSettings').open}));
 assert(defaults.demo&&defaults.marks&&!defaults.debug&&!defaults.appearance,'Default demo/markings or compact UI is wrong');
 const clock=await page.evaluate(()=>window.__exoPbrLab.demo.demoTime);await page.waitForTimeout(350);
 assert(await page.evaluate(t=>window.__exoPbrLab.demo.demoTime>t,clock),'Default demo did not advance');
 await shot('3d-final-demo-default.png','Automatic demo and collapsed controls at startup');
 await input('demoToggle',false);
 await frame(()=>page.evaluate(()=>{document.querySelector('#appearanceSettings').open=true;document.querySelector('#inputDebug').open=true;}));
 await input('panelSize',480);await frame(()=>page.setViewportSize({width:1600,height:1150}));
 await input('materialMix',50);
 const meshState=()=>page.evaluate(()=>{
  const rig=window.__exoPbrLab.model;rig.group.updateMatrixWorld(true);
  return {parts:Object.fromEntries(rig.parts.map(p=>[p.file,{position:p.holder.position.toArray(),q:p.holder.quaternion.toArray()}])),
   marks:rig.meshes.filter(m=>m.userData.artworkSource).map(m=>({key:m.userData.artworkKey,enabled:m.material.userData.surfaceMarking.enabled.value,
     uv:m.geometry.getAttribute('controllerMarkUv').count,vertices:m.geometry.getAttribute('position').count})),
   floats:(()=>{let n=0;rig.group.traverse(m=>{if(m.userData.surfaceArtwork&&m.geometry?.type==='PlaneGeometry')n++;});return n;})()};
 });
 const neutral=await meshState();assert(neutral.marks.length===8&&neutral.floats===0,'Markings are missing or use floating planes');
 assert(neutral.marks.every(m=>m.uv===m.vertices),'Markings do not follow source geometry');
 await input('view','angled');await shot('3d-final-neutral.png','Neutral original button surfaces and dark D-pad ink');
 const mechanics=[];
 for(const [id,file]of [['b1','a_button.obj'],['up','dpad_up.obj'],['l1','left_bumper.obj'],['r1','right_bumper.obj'],['l2','left_trigger.obj'],['r2','right_trigger.obj']]){
  await input('testControl',id);const active=await meshState();
  assert(JSON.stringify(active.parts[file])!==JSON.stringify(neutral.parts[file]),id+' has no physical movement');mechanics.push(id);
  if(id==='l2')await shot('3d-final-trigger-pressed.png','Analog trigger rotated about authored hinge');
  await input('testControl','');const released=await meshState();
  assert(JSON.stringify(released.parts[file])===JSON.stringify(neutral.parts[file]),id+' does not return to rest');
 }
 await input('triggerPressure',50);const half=await meshState();await input('triggerPressure',100);const full=await meshState();
 assert(JSON.stringify(half.parts['left_trigger.obj'].q)!==JSON.stringify(full.parts['left_trigger.obj'].q),'Trigger is not analog');
 await input('view','bottom');await shot('3d-final-trigger-below.png','Trigger mechanism visible from below');
 await input('triggerPressure',0);await input('view','front');
 const ringState=()=>page.evaluate(()=>[...window.__exoPbrLab.flatReferences].map(([scene,ref])=>{
  const group=ref.svg.querySelector('[id$="-stick-l-cap"]');const ring=group.querySelector('[data-exo-stick-annulus-fill]');
  const outer=group.querySelector('[id$="-outline"]'),center=group.querySelector('[id$="-top"]');
  return {scene,ring:Number(ring.style.fillOpacity),center:Number(center.style.fillOpacity),stroke:outer.style.stroke,strokeAlpha:outer.style.strokeOpacity,
   materialMask:ring.parentElement.getAttribute('mask'),darkFilter:outer.style.filter};
 }));
 const restRings=await ringState();await input('stickPose','move');const moving=await ringState();
 for(let i=0;i<moving.length;i++){
  assert(moving[i].ring>.7&&Math.abs(moving[i].center-.3)<1e-8,'2D movement must activate only the annulus');
  assert(moving[i].stroke===restRings[i].stroke&&moving[i].strokeAlpha===restRings[i].strokeAlpha,'Motion recolored the contour');
  assert(moving[i].materialMask&&!moving[i].darkFilter,'Ring is not a source-shaped masked surface');
 }
 await shot('2d-final-ring-motion.png','Moving annulus, neutral L3/R3 center');
 await input('testControl','ls');const clicked=await ringState();assert(clicked.every(r=>r.center>.95&&r.ring>.7),'Simultaneous stick motion and click failed');
 await shot('2d-final-ring-click.png','Analog motion and independent L3 activation together');
 await input('markingsToggle',false);const noMarks=await meshState();
 assert(noMarks.marks.every(m=>m.enabled===0),'3D markings off failed');
 assert(await page.evaluate(()=>[...document.querySelectorAll('.flat-reference .glyph')].every(n=>n.style.display==='none')),'2D markings off failed');
 await shot('3d-final-markings-off.png','Global markings off leaves controller geometry and movement intact');
 await input('markingsToggle',true);const marksOn=await meshState();assert(marksOn.marks.every(m=>m.enabled===1),'Markings restore failed');
 assert(JSON.stringify(noMarks.parts)===JSON.stringify(marksOn.parts),'Markings changed physical positions');
 await input('stickPose','neutral');await input('testControl','');await input('flatTransparency',80);
 assert((await ringState()).every(r=>Math.abs(r.center-.2)<1e-8),'2D transparency is not configurable');await input('flatTransparency',70);
 await input('panelSize',320);await frame(()=>page.setViewportSize({width:1200,height:1120}));await input('materialMix',70);
 // Dedicated real-time video: no forced UI/test state, both representations use
 // the production demo, all controls remain collapsed. Separate context isolates QA.
 const context=await page.context().browser().newContext({viewport:{width:1100,height:750},recordVideo:{dir:path.join(output,'video'),size:{width:1100,height:750}}});
 const demoPage=await context.newPage(),errors=[];demoPage.on('pageerror',e=>errors.push(e.message));
 await demoPage.goto(new URL('pbr-lab.html',base).href,{waitUntil:'domcontentloaded'});
 await demoPage.waitForFunction(()=>document.body.dataset.renderReady==='three-rendered',null,{timeout:60000});
 await demoPage.waitForTimeout(21000);
 const demoProof=await demoPage.evaluate(()=>({clock:window.__exoPbrLab.demo.demoTime,source:window.__exoPbrLab.input.source,ready:document.body.dataset.renderReady}));
 assert(demoProof.clock>10000&&demoProof.source==='demo'&&errors.length===0,'Real-time demo failed: '+JSON.stringify({demoProof,errors}));
 const video=demoPage.video();await context.close();const videoPath=await video.path();
 const target=path.join(output,'controller-demo.webm');await rename(videoPath,target);const bytes=await readFile(target);
 images.push({file:'controller-demo.webm',scenario:'Real-time default controller demo',bytes:bytes.length,sha256:hash(bytes)});
 console.log('Final polish browser PASS: '+JSON.stringify({defaults,mechanics,materialMarkings:8,ringSurface:true,globalMarkings:true,demoProof}));
 return {defaults,mechanics,materialMarkings:8,ringSurface:true,globalMarkings:true,demoProof};
}
"""),
]),
('tools/capture-pages.mjs', 'f2fbf1471399569f673139e2ae2ae3a97ee4be2f279df145a94a687de68015d0', '81f4d8eebf238de91d7354ed7283655fb1bca735fc66f9faf2a88e052de64ca6', [
(11,11,r"""import {captureFinalPolish} from './capture-final-polish.mjs';
"""),
(73,73,r"""  const finalPolish=await captureFinalPolish(page,{output,images,base});
  await page.locator('#demoToggle').uncheck();
  await page.evaluate(()=>{document.querySelector('#appearanceSettings').open=true;document.querySelector('#inputDebug').open=true;});
"""),
]),
 ]
for name,before,after,edits in items:
 p=pathlib.Path(name)
 source=p.read_text() if p.exists() else ''
 assert hashlib.sha256(source.encode()).hexdigest()==before, 'Source changed: '+name
 lines=source.splitlines(keepends=True)
 for a,b,text in reversed(edits): lines[a:b]=[text]
 result=''.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==after, 'Result mismatch: '+name
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(result)
print('Verified source files:', len(items))
