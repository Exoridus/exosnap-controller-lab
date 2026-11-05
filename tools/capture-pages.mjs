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
