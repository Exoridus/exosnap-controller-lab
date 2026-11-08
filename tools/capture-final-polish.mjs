// End-to-end tests for the actual current Lab. No synthetic render substitutes.
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
 // Opening details changes document layout, not controller pixels; wait for
 // layout rather than requiring a deliberately skipped idle GPU redraw.
 await page.evaluate(()=>{document.querySelector('#appearanceSettings').open=true;document.querySelector('#inputDebug').open=true;});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
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
