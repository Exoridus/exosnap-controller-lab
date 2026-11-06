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
    headless:true,channel:process.env.EXO_BROWSER_CHANNEL||'chromium',
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
    const triggerFace=trigger?.group.querySelector('[id$="-face"],[id$="-outline"]')||
      [...(trigger?.group.children||[])].find(node=>
        ['path','ellipse','rect'].includes(node.localName)&&node!==trigger?.surface&&
        !node.classList.contains('glyph'))||trigger?.surface;
    const system=entry.reference.controls.find(c=>c.layer.id==='btn-view');
    const outline=entry.reference.svg.querySelector('[id$="-outline-strong"]');
    const getFill=node=>node?getComputedStyle(node).fill:null;
    return {
      ring:getFill(ring),center:getFill(center),ringStroke:getComputedStyle(ring).stroke,
      triggerFill:getFill(trigger?.surface),
      triggerVisibleFace:getFill(triggerFace),
      triggerPressureOpacity:trigger?.surface?getComputedStyle(trigger.surface).fillOpacity:null,
      ringMask:ring.getAttribute('mask'),
      faceGlyphDisplay:face?.group.querySelector('.glyph')?.style.display||'',
      systemGlyphDisplay:system?.group.querySelector('.glyph')?.style.display||'',
      edgeFilter:outline?getComputedStyle(outline).filter:null,
      edgeFilterCount:entry.reference.svg.querySelectorAll('filter[data-exo-edge-relief]').length,
      edgeGlyphFilter:face?.group.querySelector('.glyph')?
        getComputedStyle(face.group.querySelector('.glyph')).filter:null,
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
  if(initial.edgeFilter==='none'||initial.edgeFilterCount!==1)
    throw Error('Default Ghost relief must be active on authored outline');
  if(initial.ringMask!==null)throw Error('Stick rim has an unexpected mask or clipped geometry');
  const sizes=[[240,160],[320,214],[480,320]];
  for(const [width,height] of sizes){
    await select2D('size',String(width));
    const dims=await polish.evaluate(()=>[...document.querySelectorAll('.stage')].map(n=>[
      Math.round(n.getBoundingClientRect().width),Math.round(n.getBoundingClientRect().height)]));
    if(dims.some(d=>d[0]!==width||d[1]!==height))
      throw Error('Mismatch across six 2D sizes: '+JSON.stringify(dims));
  }
  await capturePolish('2d-dualsense-neutral-480.png','dualsense','solid+ghost neutral');
  // Trigger tests compare the actual STAGE pixels: changing only a slider
  // label or a hidden DOM element cannot pass this screenshot check.
  await capturePolish('2d-dualsense-trigger-neutral.png','dualsense',
    'L2/R2 neutral, rendered surface', '.stage[data-look="solid"][data-scene="dark"]');
  await range2D('trigger',100);
  const fullTrigger=await visual2D();
  assert2D(fullTrigger.triggerFill,'rgb(255, 255, 255)','100% trigger authored pressure fill');
  assert2D(fullTrigger.triggerVisibleFace,'none','Trigger contour does not cover its pressure path');
  await capturePolish('2d-dualsense-trigger-100.png','dualsense',
    'L2/R2 100%, rendered surface', '.stage[data-look="solid"][data-scene="dark"]');
  if(images.at(-1).sha256===images.at(-2).sha256)
    throw Error('L2/R2 100% pressure produced no visible change in actual Chromium stage pixels');
  await range2D('trigger',0);
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
  const both=await visual2D();
  assert2D(both.ring,'rgb(255, 255, 255)','Full motion must activate moving rim');
  assert2D(both.center,'rgb(255, 255, 255)','L3/R3 must activate moving center');
  await capturePolish('2d-dualsense-stick-ring.png','dualsense','100% motion + L3/R3');
  await check2D('clicks',false);
  const motion=await visual2D();
  assert2D(motion.ring,'rgb(255, 255, 255)','Movement-only ring stays white');
  assert2D(motion.center,initial.center,'Movement-only must not click center');
  await capturePolish('2d-dualsense-motion-ring.png','dualsense','100% movement without click');
  await range2D('stick',0);
  await check2D('clicks',true);
  const clickOnly=await visual2D();
  assert2D(clickOnly.ring,initial.ring,'Click-only leaves ring neutral');
  assert2D(clickOnly.center,'rgb(255, 255, 255)','Click-only center is white');
  await capturePolish('2d-dualsense-stick-click.png','dualsense','L3/R3 click with zero stick movement');
  if(images.at(-1).sha256===images.at(-2).sha256)
    throw Error('Independent movement and click created identical SVG screenshots');
  await check2D('clicks',false);
  const neutral=await visual2D();
  assert2D(neutral.ring,initial.ring,'Neutral rim after releasing click');
  assert2D(neutral.center,initial.center,'Neutral center after releasing click');
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
  await range2D('stick',0);
  await range2D('trigger',0);
  await check2D('clicks',false);
  await check2D('faces',false);
  await check2D('faceSymbols',true);
  // Four genuinely rendered edge states on each of the three backgrounds.
  // A changed slider label cannot satisfy the stage-only PNG hash checks.
  const edgeCases=[['off',0,0],['light',100,0],['shadow',0,100],['combined',65,65]];
  for(const scene of ['dark','light','mixed']){
    const hashes=[];
    for(const [mode,light,shadow] of edgeCases){
      await range2D('edgeLight',light);
      await range2D('edgeShadow',shadow);
      const state=await polish.evaluate(scene=>{
        const refs=window.__exo2DPolish.refs;
        const ghost=refs.find(x=>x.mode==='ghost'&&x.scene===scene);
        const solid=refs.find(x=>x.mode==='solid'&&x.scene===scene);
        const outline=ghost.reference.svg.querySelector('[id$="-outline-strong"]');
        const edge=ghost.reference.svg.querySelector('filter[data-exo-edge-relief]');
        const solidOutline=solid.reference.svg.querySelector('[id$="-outline-strong"]');
        const face=ghost.reference.controls.find(x=>x.control==='b1');
        return {
          filter: getComputedStyle(outline).filter,
          activeFilters: ghost.reference.svg.querySelectorAll('filter[data-exo-edge-relief]').length,
          hasLight: Boolean(edge?.querySelector('[result="edge-light"]')),
          hasShadow: Boolean(edge?.querySelector('[result="edge-shadow"]')),
          glyphFilter: getComputedStyle(face.group.querySelector('.glyph')).filter,
          solidFilter: getComputedStyle(solidOutline).filter,
          clipped: edge?.getAttribute('width'),
          geometryCopies: ghost.reference.svg.querySelectorAll('[data-exo-stick-click],[data-exo-polish-ring-mask]').length,
        };
      },scene);
      const expectLight=light>0,expectShadow=shadow>0;
      assert2D(state.filter==='none',!(expectLight||expectShadow),'Ghost edge filter active');
      assert2D(state.activeFilters,expectLight||expectShadow?1:0,'No residual filter at zero');
      assert2D(state.hasLight,expectLight,'Light channel only when requested');
      assert2D(state.hasShadow,expectShadow,'Shadow channel only when requested');
      assert2D(state.glyphFilter,'none','No per-glyph glow/edge pass');
      assert2D(state.solidFilter,'none','Solid baseline remains unfiltered');
      assert2D(state.geometryCopies,0,'No synthetic stick geometry');
      if(state.clipped&&state.clipped!=='116%')
        throw Error('Unexpected edge filter bounds: '+state.clipped);
      const file='2d-edge-'+scene+'-'+mode+'.png';
      await capturePolish(file,'dualsense',
        scene+' Ghost edge light '+light+'% / shadow '+shadow+'%',
        '.stage[data-look="ghost"][data-scene="'+scene+'"]');
      hashes.push(images.at(-1).sha256);
    }
    if(new Set(hashes).size!==4)
      throw Error('Light, shadow and combined edge states are not distinguishable in Chromium pixels on '+scene);
  }
  await range2D('edgeLight',38);
  await range2D('edgeShadow',45);
  if(polishErrors.length)throw Error('2D polish browser errors: '+polishErrors.join('; '));
  await polish.close();

  // A/B/C zero-shell review, compared on identical original 2D SVGs.
  // Browser QA only; the native ExoSnap path is not exercised here.
  const ghostErrors=[];
  const ghost=await browser.newPage({viewport:{width:1210,height:1120},deviceScaleFactor:1,reducedMotion:'reduce'});
  ghost.on('pageerror',error=>ghostErrors.push(error.message));
  ghost.on('response',response=>{
    if(response.status()>=400&&!/\/favicon\.ico(?:\?|$)/.test(response.url()))
      ghostErrors.push('HTTP '+response.status()+' '+response.url());
  });
  await ghost.goto(new URL('polish-2d-review.html',base).href,{waitUntil:'domcontentloaded',timeout:60000});
  const waitGhost=()=>ghost.waitForFunction(()=>
    document.body.dataset.ghostReviewReady==='ready'&&
    document.querySelectorAll('.stage svg').length===9&&
    ['pure','soft','shadow'].every(k=>document.querySelector('.review-row[data-look="'+k+'"]')),
    null,{timeout:60000});
  await waitGhost();
  const ghostState=await ghost.evaluate(()=>{
    const state=window.__exoGhostReview;
    const results=[];
    for(const item of state.items){
      const paths=[...item.reference.bodyShape?.children||[]].filter(node=>
        ['path','ellipse','rect'].includes(node.localName)&&
        node.id!=='outline-strong'&&!node.id.endsWith('-outline-strong'));
      const notTransparent=paths.filter(p=>{
        const st=getComputedStyle(p);
        return st.fill!=='none'&&Number(st.fillOpacity)>.0001;
      });
      const touchpad=item.reference.controls.find(c=>c.layer.id==='btn-touchpad');
      const touchpadFilled=[...touchpad?.group.querySelectorAll('path,rect,ellipse')||[]]
        .filter(p=>!p.classList.contains('glyph')&&getComputedStyle(p).fill!=='none'&&
          Number(getComputedStyle(p).fillOpacity)>.0001);
      results.push({look:item.look,scene:item.scene,
        body:notTransparent.map(p=>({id:p.id,className:p.getAttribute('class'),
          fill:getComputedStyle(p).fill,alpha:getComputedStyle(p).fillOpacity,
          style:p.getAttribute('style')?.slice(0,180)})),
        touchpad:touchpadFilled.map(p=>p.id)});
    }
    return results;
  });
  if(ghostState.some(r=>r.body.length||r.touchpad.length))
    throw Error('Ghost A/B/C must have completely transparent shell and idle touchpad: '+JSON.stringify(ghostState));
  const captureGhost=async(file,element=null)=>{
    const target=element?ghost.locator(element):ghost;
    const bytes=await target.screenshot({path:path.join(output,file),fullPage:!element,animations:'disabled',timeout:60000});
    if(bytes.length<25000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
      throw Error('Missing browser Ghost review image: '+file);
    images.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
      source:'Real browser SVG Ghost A/B/C, not native Qt/ExoSnap'});
  };
  await captureGhost('2d-ghost-review-neutral.png');
  for(const key of ['pure','soft','shadow'])
    await captureGhost('2d-ghost-review-'+key+'.png','.review-row[data-look="'+key+'"]');
  for(const [id,value] of [['stick','100'],['trigger','50']]){
    await ghost.locator('#'+id).evaluate((element,n)=>{
      element.value=String(n);element.dispatchEvent(new Event('input',{bubbles:true}));
    },value);
  }
  await ghost.locator('#clicks').check();
  await ghost.locator('#faces').check();
  await captureGhost('2d-ghost-review-active.png');
  if(images.at(-1).sha256===images.find(x=>x.file==='2d-ghost-review-neutral.png').sha256)
    throw Error('Ghost review input activity produced identical pixels');
  if(ghostErrors.length)throw Error('Ghost A/B/C browser errors: '+ghostErrors.join('; '));
  await ghost.close();

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
