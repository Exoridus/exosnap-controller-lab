// Registry-driven browser gate. Production renderers receive one shared state;
// test injection stops at the existing controller-state source, never at pixels.
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTROL_NEUTRAL,CONTROL_CONTOURS,SCENE_BACKDROPS} from '../controller-visual-policy.js';
const check=(ok,msg,data)=>{if(!ok)throw Error(msg+': '+JSON.stringify(data));};
const rgb=color=>color?.[0]==='#'?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):String(color).match(/[\d.]+/g)?.slice(0,3).map(Number);
const same=(a,b)=>JSON.stringify(rgb(a))===JSON.stringify(rgb(b));
export async function captureModelConsistency(page,{output,images,shotProof}){
 const set=async(id,value)=>{
  const before=await page.evaluate(()=>Number(document.body.dataset.renderRevision||0));
  await page.locator('#'+id).evaluate((el,v)=>{el.type==='checkbox'?el.checked=v:el.value=String(v);el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));},value);
  await page.waitForFunction(r=>document.body.dataset.renderReady==='three-rendered'&&Number(document.body.dataset.renderRevision)>r,before,{timeout:60000});
 };
 const shot=async(file,scenario)=>{
  await page.evaluate(()=>{document.querySelector('#inputDebug').open=false;document.querySelector('#appearanceSettings').open=false;});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const bytes=await page.screenshot({path:path.join(output,file),fullPage:true});
  images.push({file,scenario,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 };
 await set('demoToggle',false);await set('pressAll',false);await set('stickPose','neutral');await set('testControl','');await set('triggerPressure',0);await set('panelSize',320);
 await page.setViewportSize({width:1150,height:830});
 const models=await page.locator('#controller option').evaluateAll(nodes=>nodes.map(n=>({id:n.value,name:n.textContent})));
 const report={version:1,revision:process.env.CAPTURE_COMMIT_SHA,models,checks:[],exceptions:[],pixelStates:[]};
 const fixtureDir=path.join(output,'qt-fixtures');await mkdir(fixtureDir,{recursive:true});
 const fixtures=JSON.parse(await readFile(path.join(fixtureDir,'manifest.json'),'utf8'));
 await page.evaluate(()=>{const demo=window.__exoPbrLab.demo;demo.consistencyOriginalSample=demo.sample;demo.consistencyInput={values:new Map(),left:{x:0,y:0,click:false,activity:0},right:{x:0,y:0,click:false,activity:0},triggers:{left:0,right:0},source:'consistency-test',normalized:true};demo.sample=function(){return this.consistencyInput;};});
 const input=async values=>{
  await page.evaluate(v=>{
   const p=window.__exoPbrLab.demo.consistencyInput;p.values.clear();
   for(const [key,value]of Object.entries(v.buttons||{}))p.values.set(key,value);
   for(const side of ['left','right']){const s=v[side]||[0,0];p[side].x=s[0];p[side].y=s[1];p[side].click=Boolean(p.values.get(side==='left'?'ls':'rs'));p[side].activity=Math.min(1,Math.max(0,(Math.hypot(...s)-.08)/.92));}
   p.triggers.left=p.values.get('l2')||0;p.triggers.right=p.values.get('r2')||0;
  },values);await set('testControl','');
 };
 const proof=()=>page.evaluate(()=>{
  const lab=window.__exoPbrLab,rig=lab.model;
  const flat=[...lab.flatReferences].map(([scene,r])=>({scene,id:r.layout.id,controls:r.controls.filter(e=>e.layer.role!=='body').map(e=>{
   const nodes=[...e.group.querySelectorAll('[data-exo-visible-control-fill],[data-exo-stick-annulus-fill]')].filter(n=>!n.closest('defs'));
   const paint=n=>{const s=getComputedStyle(n);return {id:n.id,fill:s.fill,alpha:Number(s.fillOpacity),opacity:Number(s.opacity),display:s.display,stroke:s.stroke,strokeAlpha:Number(s.strokeOpacity),filter:s.filter,box:(()=>{const b=n.getBoundingClientRect();return [b.x,b.y,b.width,b.height];})()};};
   const ring=e.group.querySelector('[data-exo-stick-annulus-fill]'),center=e.group.querySelector('[id$="-top"]'),outline=e.group.querySelector('[id$="-outline"]');
   return {id:e.layer.id,role:e.layer.role,key:e.control,side:e.stickSide,clickMask:e.layer.binding?.clickMask||null,values:nodes.map(paint),glyphs:[...e.group.querySelectorAll('.glyph')].filter(n=>!n.closest('defs')).map(paint),ring:ring?paint(ring):null,center:center?paint(center):null,outline:outline?paint(outline):null};
  }),branding:[...r.svg.querySelectorAll('[id$="body-wordmark"]')].map(n=>n.id),emblem:!!r.svg.querySelector('[id$="body-cube-outer"]')}));
  return {source:lab.input.source,flat,meshes:rig.meshes.filter(m=>!m.isInstancedMesh).map(m=>({file:m.userData.sourceFile,role:m.userData.role,key:m.userData.control,color:m.material.color.getHexString(),source:m.userData.sourceColor.getHexString(),alpha:m.material.opacity,emissive:m.material.emissiveIntensity,region:!!m.material.userData.rimSurface,regionColor:m.material.userData.rimSurface?.color.value.getHexString(),regionAlpha:m.material.userData.rimSurface?.alpha.value,ink:m.material.userData.surfaceMarking?.ink.value.getHexString(),markings:m.material.userData.surfaceMarking?.enabled.value,blending:m.material.blending,depthWrite:m.material.depthWrite})),drawStats:lab.drawStats};
 });
 const exported=()=>page.evaluate(()=>[...window.__exoPbrLab.flatReferences].map(([scene,r])=>{
  const raw=r.svg.outerHTML,clone=r.svg.cloneNode(true),nodes=[r.svg,...r.svg.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  nodes.forEach((node,i)=>{if(node.closest('defs'))return;const s=getComputedStyle(node);for(const key of ['fill','stroke','stroke-width','opacity','fill-opacity','stroke-opacity','fill-rule','stroke-linecap','stroke-linejoin','display'])copies[i].setAttribute(key,s.getPropertyValue(key));copies[i].removeAttribute('style');});clone.querySelectorAll('style').forEach(n=>n.remove());return {scene,raw,svg:clone.outerHTML};
 }));
 const sourceHash=async()=>createHash('sha256').update(Buffer.from(await page.evaluate(()=>{const {renderer,renderTarget:t}=window.__exoPbrLab;const p=new Uint8Array(t.width*t.height*4);renderer.readRenderTargetPixels(t,0,0,t.width,t.height,p);return [...p];}))).digest('hex');
 try{
 for(const model of models){
  await set('controller',model.id);await page.waitForFunction(id=>window.__exoPbrLab.model.model.id===id&&document.body.dataset.renderReady==='three-rendered',model.id,{timeout:60000});
  await set('view','front');await set('materialMix',70);await set('markingsToggle',true);await input({});
  const inventory=await proof();const keys=new Set(inventory.meshes.filter(m=>!m.role.startsWith('stick-')).map(m=>m.key).filter(Boolean));
  const sides=[...new Set(inventory.flat[0].controls.filter(c=>c.side).map(c=>c.side))];
  const clickable=inventory.flat[0].controls.filter(c=>c.side&&c.clickMask).map(c=>c.side==='left'?'ls':'rs');
  const states=[{name:'neutral',value:{}}];
  for(const key of [...keys].sort())states.push({name:key,value:{buttons:{[key]:1}}});
  for(const side of sides)states.push({name:side+'-move',value:{[side]:[.8,-.6]}});
  for(const key of clickable){const side=key==='ls'?'left':'right';states.push({name:key+'-click',value:{buttons:{[key]:1}}},{name:key+'-move-click',value:{buttons:{[key]:1},[side]:[.8,.6]}});}
  if(keys.has('l2')||keys.has('r2'))for(const a of [.25,.5])states.push({name:'triggers-'+Math.round(a*100),value:{buttons:Object.fromEntries(['l2','r2'].filter(k=>keys.has(k)).map(k=>[k,a]))}});
  states.push({name:'combined',value:{left:sides.includes('left')?[.6,.8]:[0,0],right:sides.includes('right')?[-.8,.6]:[0,0],buttons:Object.fromEntries([...keys].filter(k=>['b1','l1','r2'].includes(k)).concat(clickable).map(k=>[k,k==='r2'?.6:1]))}});
  report.exceptions.push({model:model.id,actualControlKeys:[...keys],stickSides:sides,clickable,unavailableClick:['ls','rs'].filter(k=>!clickable.includes(k))});
  let neutralPixelHash;
  for(const transparency of [0,30,70,90]){
   await set('flatTransparency',transparency);
   for(const state of states){
    await input(state.value);const p=await proof();
    check(p.source==='consistency-test','Input source overlaid with demo',model);
    for(const panel of p.flat){
     if(['switch_pro','joycon_grip'].includes(panel.id))check(panel.branding.length===0,'Removed housing branding returned',panel);
     if(panel.id==='gamecube')check(panel.emblem,'Approved tesseract missing',panel.id);
     for(const c of panel.controls){
      const button=state.value.buttons?.[c.key]||0;
      const directional=c.role==='directional-pad'?Math.max(...['up','down','left','right'].map(k=>state.value.buttons?.[k]||0)):button;
      const neutral=state.name==='neutral';
      if(neutral&&c.values.length)for(const v of c.values){
       if(c.role==='trigger'||c.key||c.role==='directional-pad'){
        check(same(v.fill,CONTROL_NEUTRAL),'Neutral mapped surface has inconsistent control color',{model:model.id,transparency,scene:panel.scene,c,v});
        check(Math.abs(v.alpha-(1-transparency/100))<1e-6,'Neutral alpha differs by control type',{model:model.id,c,v,transparency});
       }
      }
      if(directional===1&&!c.side&&c.values.length)for(const v of c.values){check(same(v.fill,'#ffffff'),'Pressed mapped surface not white',{model:model.id,state:state.name,c,v});check(v.alpha>.95,'Pressed mapped surface too transparent',{model:model.id,state:state.name,c,v});}
      if(c.side&&c.ring&&c.center){
       const move=Math.hypot(...(state.value[c.side]||[0,0]))>.5,click=!!state.value.buttons?.[c.side==='left'?'ls':'rs'];
       check(same(c.outline.stroke,CONTROL_CONTOURS[panel.scene]),'Stick contour changes color',{model:model.id,c});
       if(move)check(c.ring.alpha>.7&&same(c.ring.fill,'#ffffff'),'Analog movement did not illuminate ring surface',{model:model.id,c});
       if(click)check(c.center.alpha>.95&&same(c.center.fill,'#ffffff'),'Click did not illuminate center',{model:model.id,c});
       else check(Math.abs(c.center.alpha-(1-transparency/100))<1e-6,'Analog activity leaked into center',{model:model.id,c});
      }
     }
    }
    const supports=p.meshes.filter(m=>['stick-stem','stick-base','stick-well'].includes(m.role));
    for(const m of supports){const before=inventory.meshes.find(x=>x.file===m.file);check(m.color===before.color&&m.alpha===before.alpha&&m.emissive===0,'Input leaks into structural support',{model:model.id,m,before});}
    for(const m of p.meshes.filter(m=>m.region)){const before=inventory.meshes.find(x=>x.file===m.file);check(m.regionColor===before.regionColor&&m.regionAlpha===before.regionAlpha,'Input leaks into lower ring/dish region',{model:model.id,m,before});}
    report.checks.push({model:model.id,transparency,state:state.name,source:p.source,flat:p.flat,materials:p.meshes});
    if(transparency===70){const pixels=await sourceHash();if(state.name==='neutral')neutralPixelHash=pixels;else if([...keys].includes(state.name)||/-move$/.test(state.name))check(pixels!==neutralPixelHash,'Actual WebGL pixels do not react to input',{model:model.id,state:state.name});report.pixelStates.push({model:model.id,state:state.name,sha256:pixels});}
    if(state.name==='neutral'||(transparency===70&&['b1','up','combined','left-move','right-move','ls-click','rs-click','l2','r2','l1','r1'].includes(state.name)))await shot('3d-final-model-'+model.id.toLowerCase()+'-'+transparency+'-'+state.name+'.png',model.name+' / '+state.name+' / transparency '+transparency+' / 3 backgrounds / paired production renderers');
    if(['neutral','combined'].includes(state.name))for(const x of await exported()){
     const name='model-'+model.id.toLowerCase()+'-'+x.scene+'-'+transparency+'-'+state.name;await writeFile(path.join(fixtureDir,name+'.raw.svg'),x.raw);await writeFile(path.join(fixtureDir,name+'.svg'),x.svg);fixtures.fixtures.push({name,scene:x.scene,transparency,state:state.name,model:model.id});
    }
   }
  }
  await set('flatTransparency',70);
  for(const mix of [0,70,100]){
   await set('materialMix',mix);
   for(const view of ['front','angled','bottom']){
    await set('view',view);
    for(const state of [states[0],states.at(-1)]){await input(state.value);await shot('3d-final-model-'+model.id.toLowerCase()+'-mix'+mix+'-'+view+'-'+state.name+'.png',model.name+' / mix '+mix+' / '+view+' / '+state.name);await shotProof();}
   }
  }
  await set('view','front');await set('materialMix',70);await input({});
  for(const marks of [false,true]){
   await set('markingsToggle',marks);const p=await proof();
   check(p.meshes.filter(m=>m.markings!==undefined).every(m=>m.markings===(marks?1:0)),'3D marking toggle missed model',model.id);
   check(p.flat.every(f=>f.controls.every(c=>c.glyphs.every(g=>(g.display!=='none')===marks))),'2D marking toggle missed model',model.id);
   if(!marks)await shot('3d-final-model-'+model.id.toLowerCase()+'-markings-off.png',model.name+' / global markings off');
  }
  console.log('Model acceptance complete: '+model.id+' / '+states.length+' input states / 4 transparency levels / 3 backgrounds / 3 mixes x 3 views');
 }
 }finally{
  await page.evaluate(()=>{const d=window.__exoPbrLab.demo;d.sample=d.consistencyOriginalSample;delete d.consistencyOriginalSample;delete d.consistencyInput;});
 }
 await writeFile(path.join(output,'model-consistency.json'),JSON.stringify(report,null,2));
 await writeFile(path.join(fixtureDir,'manifest.json'),JSON.stringify(fixtures,null,2));
 await set('controller','DualSenseCompact');await set('view','front');await set('flatTransparency',70);await set('materialMix',70);await set('markingsToggle',true);await set('testControl','');
 await page.setViewportSize({width:1200,height:1120});await page.evaluate(()=>{document.querySelector('#appearanceSettings').open=true;document.querySelector('#inputDebug').open=true;});
 console.log('Cross-model browser PASS: '+models.length+' models, '+report.checks.length+' shared-state samples / '+report.checks.length*3+' backdrop samples, '+report.pixelStates.length+' actual WebGL state hashes');
 return {models:models.map(m=>m.id),samples:report.checks.length,backgroundSamples:report.checks.length*3};
}
