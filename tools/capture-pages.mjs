#!/usr/bin/env node
/**
 * CI screenshots from the ACTUAL 3D Three.js renderer and authored 2D SVGs.
 * No fallback images. A failed WebGL render fails the job and does not publish.
 * Run after `npm install --no-save --package-lock=false playwright@1.64.1`.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {verifyRenderedState} from './visual-capture-contract.mjs';
const args=process.argv.slice(2);
const arg=(name,def)=>{const i=args.indexOf(name);return i<0?def:args[i+1]};
const base=arg('--base',process.env.CAPTURE_BASE_URL||'http://127.0.0.1:8792/');
const output=path.resolve(arg('--out','.capture'));
const revision=process.env.CAPTURE_COMMIT_SHA||process.env.GITHUB_SHA||'local-uncommitted';
const playwright=await import('playwright').catch(()=>{throw Error('Playwright missing: npm install --no-save --package-lock=false playwright@1.64.1')});
let browser;
const runtimeErrors=[];
try{
  browser=await playwright.chromium.launch({
    headless:true,channel:'chromium',
    args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],
    timeout:60000
  });
  const page=await browser.newPage({viewport:{width:2170,height:1250},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',error=>runtimeErrors.push('pageerror: '+error.message));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const url=message.location()?.url||'';
    // Missing default favicons are harmless; retain all other browser errors.
    if(/\/favicon\.ico(?:\?|$)/.test(url)&&/Failed to load resource/i.test(message.text()))return;
    runtimeErrors.push(`console.error (${url||'unknown source'}): ${message.text()}`);
  });
  page.on('response',response=>{if(response.status()>=400&&!/\/favicon\.ico(?:\?|$)/.test(response.url()))runtimeErrors.push(`HTTP ${response.status()}: ${response.url()}`);});
  page.on('requestfailed',request=>{if(!/\/favicon\.ico(?:\?|$)/.test(request.url()))runtimeErrors.push(`request failed: ${request.url()}: ${request.failure()?.errorText}`);});
  await page.goto(new URL('pbr-lab.html',base).href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>
    document.body.dataset.renderReady==='three-rendered' &&
    document.querySelectorAll('.variant:not([hidden]) .sample--flat svg').length===12,
    {timeout:90000});
  const shotProof=async()=>{
    // Model switching renders WebGL before all independent 2D SVG loads finish.
    // Wait for the *paired* views instead of racing asynchronous SVG loading.
    await page.waitForFunction(()=>
      document.body.dataset.renderReady==='three-rendered' &&
      document.querySelectorAll('.variant:not([hidden]) .sample--flat svg').length===12,
      {timeout:60000});
    const state=await page.evaluate(()=>({
      status:document.body.dataset.renderReady,
      revision:Number(document.body.dataset.renderRevision||0),
      sampleCount:document.querySelectorAll('.variant:not([hidden]) .sample:not(.sample--flat)').length,
      flatCount:document.querySelectorAll('.variant:not([hidden]) .sample--flat svg').length,
      drawStats:window.__exoPbrLab?.drawStats,
      nontransparentPixels:(()=>{
        const lab=window.__exoPbrLab;const target=lab?.renderTarget;const renderer=lab?.renderer;
        if(!target||!renderer||target.width<32||target.height<32)return 0;
        const rgba=new Uint8Array(target.width*target.height*4);
        renderer.readRenderTargetPixels(target,0,0,target.width,target.height,rgba);
        let count=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>8)count++;
        return count;
      })(),
      webglVersion:(()=>{const gl=document.querySelector('#threeCanvas')?.getContext('webgl2');return gl?.getParameter(gl.VERSION) || null})(),
    }));
    verifyRenderedState(state);
    if(state.flatCount!==12)throw Error(`Expected 12 real authored SVG panels; got ${state.flatCount}`);
    if(!state.webglVersion)throw Error('Screenshot was not produced with a real WebGL2 context');
    if(runtimeErrors.length)throw Error(runtimeErrors.join('\n'));
    return state;
  };
  await mkdir(output,{recursive:true});
  const images=[];
  let before=await shotProof();
  for(const [filename,pressed] of [['overview-neutral.png',false],['overview-pressed.png',true]]){
    if(pressed){
      await page.locator('#pressAll').check();
      await page.waitForFunction(previous=>Number(document.body.dataset.renderRevision||0)>previous,before.revision,{timeout:30000});
    }
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const proof=await shotProof();
    const file=path.join(output,filename);
    const bytes=await page.screenshot({path:file,fullPage:true,animations:'disabled',timeout:60000});
    if(bytes.length<40000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(`${filename} is missing or not a valid nontrivial PNG`);
    images.push({file:filename,pressed,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),webgl:proof.webglVersion,revision:proof.revision,drawStats:proof.drawStats});
    before=proof;
  }
  if(images[0].sha256===images[1].sha256)throw Error('Neutral and pressed-state screenshots are identical: input response not verified');
  // A separate, actual GameCube render validates model switching, model-specific
  // A/B/X/Y button legends and the source-authored purple/green/red/yellow palette.
  const previousRevision=before.revision;
  await page.locator('#pressAll').uncheck();
  await page.locator('#controller').selectOption('Gamecube');
  await page.waitForFunction(previous=>
    document.body.dataset.renderReady==='three-rendered' &&
    window.__exoPbrLab?.model?.model?.id==='Gamecube' &&
    Number(document.body.dataset.renderRevision||0)>previous,
    previousRevision,{timeout:60000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const cube=await shotProof();
  const artwork=await page.evaluate(()=>{
    const marks=[];window.__exoPbrLab?.model?.group?.traverse(obj=>{
      if(obj.userData?.artworkSource==='2d-svg')marks.push(obj.userData.buttonGlyph);
    });return marks;
  });
  if(artwork.sort().join(',')!=='A,B,X,Y')
    throw Error('Expected all four original GameCube 2D face-glyph paths as 3D decals');

  const cubeFile='gamecube-neutral.png';
  const cubeBytes=await page.screenshot({path:path.join(output,cubeFile),fullPage:true,animations:'disabled',timeout:60000});
  if(cubeBytes.length<40000||cubeBytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
    throw Error('GameCube screenshot is missing or invalid');
  images.push({file:cubeFile,modelId:'Gamecube',pressed:false,bytes:cubeBytes.length,
    sha256:createHash('sha256').update(cubeBytes).digest('hex'),
    webgl:cube.webglVersion,revision:cube.revision,drawStats:cube.drawStats});
  const neutralPrevious=Number((await page.evaluate(()=>document.body.dataset.renderRevision))||0);
  await page.locator('#controller').selectOption('GenericPro');
  await page.waitForFunction(previous=>
    document.body.dataset.renderReady==='three-rendered' &&
    window.__exoPbrLab?.model?.model?.id==='GenericPro' &&
    window.__exoPbrLab?.flatReferences?.size===12 &&
    Number(document.body.dataset.renderRevision||0)>previous,
    neutralPrevious,{timeout:60000});
  let genericProof=await shotProof();
  const genericPartState=await page.evaluate(()=>{
    const rig=window.__exoPbrLab?.model;
    const legends=[];
    rig?.group?.traverse(x=>{if(['A','B','X','Y'].includes(x.userData?.buttonGlyph))legends.push(x.userData.buttonGlyph);});
    return {parts:rig?.partCount,triangles:rig?.triangles,legends};
  });
  if(genericPartState.parts!==23||genericPartState.triangles<500||
      genericPartState.legends.sort().join(',')!=='A,B,X,Y')
    throw Error('Generic Pro is incomplete or has wrong button faces: '+JSON.stringify(genericPartState));
  for(const [file,pressed] of [['generic-neutral.png',false],['generic-pressed.png',true]]){
    if(pressed){
      await page.locator('#pressAll').check();
      await page.waitForFunction(previous=>Number(document.body.dataset.renderRevision||0)>previous,
        genericProof.revision,{timeout:30000});
      genericProof=await shotProof();
    }
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const bytes=await page.screenshot({path:path.join(output,file),fullPage:true,animations:'disabled',timeout:60000});
    if(bytes.length<40000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
      throw Error('Invalid Generic Pro browser capture: '+file);
    images.push({file,modelId:'GenericPro',pressed,bytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),
      webgl:genericProof.webglVersion,revision:genericProof.revision,drawStats:genericProof.drawStats});
  }
  if(images.at(-1).sha256===images.at(-2).sha256)
    throw Error('Generic Pro neutral and pressed captures are identical');
  await page.locator('#pressAll').uncheck();

  // Scenario B: ensure every CURRENTLY CLEARED core model can actually load,
  // produce a WebGL frame, and pair with its corresponding authored 2D SVG.
  // Do not call Xbox Series or Steam Controller 2026 cleared until licensed.
  const coreModels=['GenericPro','DualSenseCompact','DS4Compact','XboxOneClean',
    'SwitchPro','Gamecube','JoyconGrip','JoyconLeft','JoyconRight'];
  const coreSmoke=[];
  for(const id of coreModels){
    const previous=Number((await page.evaluate(()=>document.body.dataset.renderRevision))||0);
    if((await page.locator('#controller').inputValue())!==id)
      await page.locator('#controller').selectOption(id);
    await page.waitForFunction(({id,previous})=>
      document.body.dataset.renderReady==='three-rendered' &&
      window.__exoPbrLab?.model?.model?.id===id &&
      window.__exoPbrLab?.flatReferences?.size===12 &&
      Number(document.body.dataset.renderRevision||0)>=previous,
      {id,previous},{timeout:60000});
    const proof=await shotProof();
    coreSmoke.push({id,threeViewports:proof.sampleCount,svgViewports:proof.flatCount,
      rendered:true,webgl:proof.webglVersion});
  }
  // Browser-only visual acceptance matrix: genuine Chromium renderings of
  // the same authored SVGs. Fail the release for missing shapes or bad states.
  const polishErrors=[];
  const polish=await browser.newPage({viewport:{width:1640,height:1120},deviceScaleFactor:1,reducedMotion:'reduce'});
  polish.on('pageerror',error=>polishErrors.push(error.message));
  polish.on('response',response=>{
    if(response.status()>=400&&!/\/favicon\.ico(?:\?|$)/.test(response.url()))
      polishErrors.push('HTTP '+response.status()+' '+response.url());
  });
  polish.on('requestfailed',request=>polishErrors.push(
    'request failed: '+request.url()+' '+request.failure()?.errorText));
  await polish.goto(new URL('polish-2d.html',base).href,{waitUntil:'domcontentloaded',timeout:60000});
  const ready2D=async(modelId)=>{
    await polish.waitForFunction(id=>{
      const refs=window.__exo2DPolish?.refs||[];
      return document.body.dataset.polishReady==='ready'&&refs.length===6&&
        refs.every(x=>x.reference.svg&&x.reference.layout.id===id)&&
        document.querySelectorAll('.stage svg').length===6;
    },modelId,{timeout:60000});
    await polish.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const select2D=async(id,value)=>{
    await polish.locator('#'+id).selectOption(value);
    if(id==='layout')await ready2D(value);
  };
  const range2D=async(id,value)=>{
    await polish.locator('#'+id).evaluate((element,val)=>{
      element.value=String(val);element.dispatchEvent(new Event('input',{bubbles:true}));
    },value);
  };
  const check2D=async(id,enabled)=>{
    if(enabled)await polish.locator('#'+id).check();
    else await polish.locator('#'+id).uncheck();
  };
  const visual2D=()=>polish.evaluate(()=>{
    const entry=window.__exo2DPolish.refs.find(e=>e.mode==='ghost'&&e.scene==='light');
    const stick=entry.reference.controls.find(c=>c.stickSide==='left');
    const group=stick.group;
    const ring=group.querySelector('[id$="-outline"]');
    const center=group.querySelector('[id$="-top"]');
    const face=entry.reference.controls.find(c=>c.control==='b1');
    const trigger=entry.reference.controls.find(c=>c.control==='l2');
    const system=entry.reference.controls.find(c=>c.layer.id==='btn-view');
    const outline=entry.reference.svg.querySelector('[id$="-outline-strong"]');
    const getFill=node=>node?getComputedStyle(node).fill:null;
    return {
      ring:getFill(ring),center:getFill(center),ringStroke:getComputedStyle(ring).stroke,
      triggerFill:getFill(trigger?.group.querySelector('[id$="-face"]')||trigger?.surface),
      ringMask:ring.getAttribute('mask'),
      faceGlyphDisplay:face?.group.querySelector('.glyph')?.style.display||'',
      systemGlyphDisplay:system?.group.querySelector('.glyph')?.style.display||'',
      glow:outline?getComputedStyle(outline).filter:null,
      input:[...window.__exo2DPolish.inputState().values],
      bodySocketFill:getFill(entry.reference.bodyShape.querySelector('path')),
      layout:document.querySelectorAll('.stage').length,
      grid:[...document.querySelectorAll('.stage')].map(e=>e.dataset.look+':'+e.dataset.scene),
    };
  });
  const assert2D=(actual,expected,message)=>{
    if(actual!==expected)throw Error(message+': expected '+expected+', got '+actual);
  };
  const capturePolish=async(file,modelId,variant,element=null)=>{
    await ready2D(modelId);
    if(polishErrors.length)throw Error('2D polish browser errors: '+polishErrors.join('; '));
    const options={path:path.join(output,file),animations:'disabled',timeout:60000};
    const bytes=element
      ?await polish.locator(element).screenshot(options)
      :await polish.screenshot({...options,fullPage:true});
    if(bytes.length<8000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
      throw Error('Invalid REAL Chromium 2D screenshot: '+file);
    images.push({file,modelId,variant,bytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),
      source:'Chromium authored SVG; not native Qt/D3D11'});
  };
  await ready2D('dualsense');
  const initial=await visual2D();
  assert2D(initial.layout,6,'2D panel count');
  assert2D(initial.grid.join(','),'solid:dark,solid:light,solid:mixed,ghost:dark,ghost:light,ghost:mixed','2x3 look grid');
  assert2D(initial.glow,'none','0% contour glow');
  if(initial.ringMask===null)throw Error('Source-authored stick ring was not composited separately');
  const sizes=[[240,160],[320,214],[480,320]];
  for(const [width,height] of sizes){
    await select2D('size',String(width));
    const dims=await polish.evaluate(()=>[...document.querySelectorAll('.stage')].map(n=>[
      Math.round(n.getBoundingClientRect().width),Math.round(n.getBoundingClientRect().height)]));
    if(dims.some(d=>d[0]!==width||d[1]!==height))
      throw Error('Mismatch across six 2D sizes: '+JSON.stringify(dims));
  }
  await capturePolish('2d-dualsense-neutral-480.png','dualsense','solid+ghost neutral');
  // The wheel MUST zoom all six SVGs, not scroll the document.
  const beforeWheel=await polish.evaluate(()=>({scroll:window.scrollY,zoom:window.__exo2DPolish.zoom}));
  await polish.locator('.stage[data-look="ghost"][data-scene="dark"]').hover();
  await polish.mouse.wheel(0,-240);
  const afterWheel=await polish.evaluate(()=>({scroll:window.scrollY,zoom:window.__exo2DPolish.zoom}));
  if(afterWheel.zoom<=beforeWheel.zoom||afterWheel.scroll!==beforeWheel.scroll)
    throw Error('Viewer wheel did not synchronously zoom without document scrolling');
  await polish.locator('.stage[data-look="ghost"][data-scene="dark"]').dblclick();

  // Verify true 0/25/50/100 continuous stick+trigger intensities.
  const sample=[];
  for(const pct of [0,25,50,100]){
    await range2D('stick',pct);await range2D('trigger',pct);
    const s=await visual2D();sample.push({pct,ring:s.ring,center:s.center,trigger:s.triggerFill});
  }
  if(sample[0].ring===sample[1].ring||sample[1].ring===sample[2].ring||
      sample[2].ring===sample[3].ring)
    throw Error('Stick ring lost intermediate 25/50/100% interpolation');
  assert2D(sample[3].ring,'rgb(255, 255, 255)','100% motion ring');
  assert2D(sample[3].trigger,'rgb(255, 255, 255)','100% analog trigger');
  if(sample[0].trigger===sample[1].trigger||sample[1].trigger===sample[2].trigger||
      sample[2].trigger===sample[3].trigger)
    throw Error('Analog trigger lost intermediate 25/50/100% interpolation');
  assert2D(sample[0].center,sample[3].center,'Movement must not click the stick');

  await range2D('trigger',0);
  await check2D('clicks',true);
  const clickedA=await visual2D();
  assert2D(clickedA.ring,'rgb(255, 255, 255)','A full motion ring');
  assert2D(clickedA.center,'rgb(255, 255, 255)','A L3 click center');
  await capturePolish('2d-dualsense-stick-ring.png','dualsense','A 100% motion + L3/R3');
  await select2D('stickFeedback','center');
  const clickedB=await visual2D();
  assert2D(clickedB.ring,'rgb(255, 255, 255)','B L3 click ring');
  assert2D(clickedB.center,'rgb(255, 255, 255)','B full motion center');
  await capturePolish('2d-dualsense-stick-center.png','dualsense','B 100% motion + L3/R3');
  // At movement=100% AND L3 click=on both variants intentionally light both
  // parts. Movement-only and click-only states MUST still differ.
  await check2D('clicks',false);
  const motionB=await visual2D();
  assert2D(motionB.center,'rgb(255, 255, 255)','B movement-only center');
  assert2D(motionB.ring,initial.ring,'B movement must leave the rim neutral');
  await capturePolish('2d-dualsense-motion-center.png','dualsense','B 100% movement; no L3/R3');
  await select2D('stickFeedback','ring');
  const motionA=await visual2D();
  assert2D(motionA.ring,'rgb(255, 255, 255)','A movement-only ring');
  assert2D(motionA.center,initial.center,'A movement must leave the center neutral');
  await capturePolish('2d-dualsense-motion-ring.png','dualsense','A 100% movement; no L3/R3');
  if(images.at(-1).sha256===images.at(-2).sha256)
    throw Error('Movement-only feedback variants produced identical screenshots');
  await range2D('stick',0);
  await check2D('clicks',true);
  const clickOnlyA=await visual2D();
  assert2D(clickOnlyA.center,'rgb(255, 255, 255)','A click-only center');
  assert2D(clickOnlyA.ring,initial.ring,'A click must not move the ring');
  await select2D('stickFeedback','center');
  const clickOnlyB=await visual2D();
  assert2D(clickOnlyB.ring,'rgb(255, 255, 255)','B click-only ring');
  assert2D(clickOnlyB.center,initial.center,'B click must not move the center');
  await check2D('clicks',false);
  await range2D('stick',0);
  const neutralB=await visual2D();
  assert2D(neutralB.ring,initial.ring,'Neutral cap ring after click release');
  assert2D(neutralB.center,initial.center,'Neutral cap center after click release');
  await check2D('faces',true);
  await check2D('faceSymbols',true);
  const symbolsOn=await visual2D();
  const inputBefore=JSON.stringify(symbolsOn.input);
  await capturePolish('2d-dualsense-face-symbols-on.png','dualsense','face symbols on; faces pressed');
  await check2D('faceSymbols',false);
  const symbolsOff=await visual2D();
  assert2D(symbolsOff.faceGlyphDisplay,'none','Face symbols hidden');
  if(symbolsOff.systemGlyphDisplay==='none')throw Error('System glyph incorrectly hidden');
  assert2D(JSON.stringify(symbolsOff.input),inputBefore,'Face glyph toggle changed button mapping');
  await capturePolish('2d-dualsense-face-symbols-off.png','dualsense','face symbols off; faces pressed');
  if(images.at(-1).sha256===images.at(-2).sha256)
    throw Error('Face-symbol toggle had no visible browser effect');
  await check2D('faceSymbols',true);
  await check2D('faces',false);
  await select2D('stickFeedback','ring');

  await select2D('layout','xbox_series');
  await select2D('colorway','auto');
  await capturePolish('2d-xbox-series-auto.png','xbox_series','Auto dark');
  await select2D('colorway','light');
  await capturePolish('2d-xbox-series-light.png','xbox_series','Light');
  if(images.at(-1).sha256===images.at(-2).sha256)
    throw Error('Xbox Series light and Auto screenshots identical');
  await select2D('layout','dualshock4');
  await select2D('colorway','auto');
  await capturePolish('2d-dualshock4-auto.png','dualshock4','Auto light');
  await select2D('colorway','dark');
  await capturePolish('2d-dualshock4-dark.png','dualshock4','Dark');
  if(images.at(-1).sha256===images.at(-2).sha256)
    throw Error('DualShock 4 Auto and dark screenshots identical');

  await select2D('layout','dualsense');
  await select2D('colorway','auto');
  for(const pct of [0,50,100]){
    await range2D('glow',pct);
    const s=await visual2D();
    if((pct===0)!==(s.glow==='none'))throw Error('Contour glow zero/nonzero mismatch at '+pct+'%: '+s.glow);
    await capturePolish('2d-ghost-glow-'+pct+'.png','dualsense',
      'Ghost mixed backdrop; glow '+pct+'%', '.stage[data-look="ghost"][data-scene="mixed"]');
  }
  if(new Set(images.slice(-3).map(x=>x.sha256)).size!==3)
    throw Error('0/50/100 glow captures did not change the actual browser pixels');
  if(polishErrors.length)throw Error('2D polish browser errors: '+polishErrors.join('; '));
  await polish.close();

  const manifest={revision,capturedAt:new Date().toISOString(),url:new URL('pbr-lab.html',base).href,
    content:'Real Three.js/WebGL2 + original controller OBJ + authored SVG',looks:['solid','ghost','outline','identity'],
    viewports:['3D dark','3D light','3D mixed','2D dark','2D light','2D mixed'],images,
    scenarios:{A:{genericModel:'GenericPro',parts:genericPartState.parts,neutralAndPressed:true},
      B:{coreSmoke,notCleared:['XboxSeries','SteamController2026'],fullTierABComplete:false}},
    visualAcceptance:'Pending human inspection; capture proves rendering, not visual quality'};
  await writeFile(path.join(output,'capture-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Captured real WebGL screenshots: ${images.map(x=>x.file).join(', ')} (${images[0].webgl})`);
}catch(e){console.error(`Real WebGL capture failed: ${e.stack||e}`);process.exitCode=1;}
finally{if(browser)await browser.close();}
