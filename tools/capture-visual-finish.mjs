// Focused production-page evidence, with Demo OFF for every neutral assertion.
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function captureVisualFinish(page,{output,images}){
 const fixtureDir=path.join(output,'qt-fixtures');await mkdir(fixtureDir,{recursive:true});
 const set=async(id,value)=>{
  const previous=await page.evaluate(()=>Number(document.body.dataset.renderRevision||0));
  await page.locator('#'+id).evaluate((el,v)=>{if(el.type==='checkbox')el.checked=v;else el.value=String(v);el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));},value);
  await page.waitForFunction(n=>Number(document.body.dataset.renderRevision||0)>n,previous);
 };
 const shot=async(file,scenario)=>{
  await page.evaluate(()=>{for(const id of ['appearanceSettings','inputDebug'])document.getElementById(id).open=false;});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const bytes=await page.screenshot({path:path.join(output,file)});
  images.push({file,scenario,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 };
 await set('demoToggle',false);await set('panelSize',480);await page.setViewportSize({width:1600,height:1050});
 await set('materialMix',70);
 const socketChecks=[];
 for(const view of ['front','angled','top','profile']){
  await set('view',view);await shot(`3d-final-socket-${view}.png`,'Both original support domes, shell-linked material, neutral '+view);
  socketChecks.push(await page.evaluate(()=>window.__exoPbrLab.model.meshes.filter(m=>m.userData.role==='stick-stem'&&!m.isInstancedMesh).map(m=>({file:m.userData.sourceFile,color:m.material.color.getHexString(),alpha:m.material.opacity,depthWrite:m.material.depthWrite,vertices:m.geometry.attributes.position.count}))));
 }
 for(const checks of socketChecks)if(checks.length!==2||checks[0].color!==checks[1].color||checks[0].alpha!==checks[1].alpha||checks.some(m=>!m.depthWrite))throw Error('Asymmetric socket material or depth regression: '+JSON.stringify(checks));
 await set('materialMix',0);await shot('3d-final-socket-original.png','Original opaque source colors retained at 0% Ghost mix');await set('materialMix',70);await set('view','front');
 const fixtures=[];
 for(const transparency of [0,30,70,90])for(const state of ['neutral','pressed','move','move-click']){
  await set('pressAll',state==='pressed');await set('stickPose',state.startsWith('move')?'move':'neutral');await set('testControl',state==='move-click'?'ls':'');await set('flatTransparency',transparency);
  const proof=await page.evaluate(()=>({source:window.__exoPbrLab.input.source,demo:window.__exoPbrLab.demo.enabled,
   values:[...window.__exoPbrLab.input.values],axes:[window.__exoPbrLab.input.left.x,window.__exoPbrLab.input.left.y,window.__exoPbrLab.input.right.x,window.__exoPbrLab.input.right.y]}));
  if(proof.demo)throw Error('Neutral review must not be contaminated by demo');
  if(state==='neutral'&&(proof.values.some(([,v])=>v!==0)||proof.axes.some(v=>v!==0)))throw Error('Non-neutral input in neutral evidence');
  const stem=`${transparency}-${state}`;
  await shot(`2d-final-alpha-${stem}.png`,`2D transparency ${transparency}% / ${state} / dark-light-mixed`);
  const exported=await page.evaluate(()=>[...window.__exoPbrLab.flatReferences].map(([scene,ref])=>{
   const raw=ref.svg.outerHTML,clone=ref.svg.cloneNode(true),nodes=[ref.svg,...ref.svg.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
   // Qt SVG is not a browser CSS engine. Resolve paint once at atlas bake time.
   nodes.forEach((node,i)=>{if(node.closest('defs'))return;const style=getComputedStyle(node);
    for(const key of ['fill','stroke','stroke-width','opacity','fill-opacity','stroke-opacity','fill-rule','stroke-linecap','stroke-linejoin','display'])copies[i].setAttribute(key,style.getPropertyValue(key));copies[i].removeAttribute('style');});
   clone.querySelectorAll('style').forEach(n=>n.remove());
   return {scene,raw,flattened:clone.outerHTML,faces:ref.controls.filter(c=>['b1','b2','b3','b4'].includes(c.control)).map(c=>({key:c.control,ink:c.group.querySelector('.glyph')?.style.fill}))};
  }));
  for(const x of exported){
   const name=`${x.scene}-${stem}`;await writeFile(path.join(fixtureDir,name+'.raw.svg'),x.raw);await writeFile(path.join(fixtureDir,name+'.svg'),x.flattened);fixtures.push({name,scene:x.scene,transparency,state,faces:x.faces});
  }
 }
 await set('pressAll',false);await set('stickPose','neutral');await set('testControl','');await set('flatTransparency',70);
 await set('markingsToggle',false);await shot('2d-final-alpha-markings-off.png','Markings off preserves independent surface treatment');await set('markingsToggle',true);
 await writeFile(path.join(fixtureDir,'manifest.json'),JSON.stringify({revision:process.env.CAPTURE_COMMIT_SHA||'local',fixtures,socketChecks},null,2));
 await set('panelSize',320);await page.setViewportSize({width:1200,height:1120});
 await page.evaluate(()=>{document.getElementById('appearanceSettings').open=true;document.getElementById('inputDebug').open=true;});
 console.log('Visual finish PASS: 4 transparencies x 4 input states x 3 backgrounds; 48 Qt SVG fixtures; both sockets, 4 cameras');
}
