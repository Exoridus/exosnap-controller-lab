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
import {verifySvgSafeEdges} from './verify-svg-safe-edges.mjs';
import {captureConsolidated} from './capture-consolidated.mjs';
import {captureFinalPolish} from './capture-final-polish.mjs';
import {captureModelConsistency} from './capture-model-consistency.mjs';
import {captureVisualFinish} from './capture-visual-finish.mjs';
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
    executablePath:process.env.EXO_BROWSER_EXECUTABLE||undefined,
    args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],
    timeout:60000
  });
  const page=await browser.newPage({viewport:{width:1200,height:1120},deviceScaleFactor:1,reducedMotion:'reduce'});
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
    document.querySelectorAll('.sample--flat svg').length===3,
    {timeout:90000});
  const shotProof=async()=>{
    // Model switching renders WebGL before all independent 2D SVG loads finish.
    // Wait for the *paired* views instead of racing asynchronous SVG loading.
    await page.waitForFunction(()=>
      document.body.dataset.renderReady==='three-rendered' &&
      document.querySelectorAll('.sample--flat svg').length===3,
      {timeout:60000});
    const state=await page.evaluate(()=>({
      status:document.body.dataset.renderReady,
      revision:Number(document.body.dataset.renderRevision||0),
      sampleCount:document.querySelectorAll('.variant:not([hidden]) .sample:not(.sample--flat)').length,
      flatCount:document.querySelectorAll('.sample--flat svg').length,
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
    if(state.flatCount!==3)throw Error(`Expected 3 real authored SVG panels; got ${state.flatCount}`);
    if(!state.webglVersion)throw Error('Screenshot was not produced with a real WebGL2 context');
    if(runtimeErrors.length)throw Error(runtimeErrors.join('\n'));
    return state;
  };
  await mkdir(output,{recursive:true});
  const images=[];
  await verifySvgSafeEdges(browser,{base,output,images});
  // Focused 3D final-polish evidence. Screenshot ONLY the 3D panel, not the
  // 2D LEDs or status text, so a P1/P4 change must affect real PBR pixels.
  await page.locator('#demoToggle').uncheck();
  await page.locator('#pressAll').uncheck();
  await page.locator('#view').selectOption('front');
  await page.locator('#materialMix').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#outerContour').check();
  for(const [model,expectedCount] of [['SwitchPro',4],['JoyconGrip',8]]){
    await page.locator('#controller').selectOption(model);
    await page.waitForFunction(id=>document.body.dataset.renderReady==='three-rendered'&&
      window.__exoPbrLab?.model?.model?.id===id&&
      window.__exoPbrLab?.playerLedSurface3D?.count===(id==='SwitchPro'?4:8),
      model,{timeout:60000});
    let prior=null;
    for(const [playerIndex,mask] of [['0',1],['3',15]]){
      const previousRevision=await page.evaluate(()=>Number(document.body.dataset.renderRevision||0));
      await page.locator('#playerPreview').selectOption(playerIndex);
      await page.waitForFunction(({mask,previousRevision})=>window.__exoPbrLab?.playerLedSurface3D?.mask===mask&&
        Number(document.body.dataset.renderRevision||0)>previousRevision,
        {mask,previousRevision},{timeout:60000});
      await shotProof();
      const rect=await page.locator('.variant[data-variant="white"] .sample[data-scene="light"]')
        .boundingBox();
      if(!rect)throw Error('Missing visible 3D light panel for '+model);
      const name='final-3d-player-led-'+model.toLowerCase()+'-p'+(Number(playerIndex)+1)+'.png';
      const bytes=await page.screenshot({path:path.join(output,name),
        clip:{x:Math.max(0,rect.x),y:Math.max(0,rect.y),width:rect.width,height:rect.height},
        animations:'disabled',timeout:60000});
      const sha256=createHash('sha256').update(bytes).digest('hex');
      const ledDebug=await page.evaluate(()=>{
        const lab=window.__exoPbrLab,led=lab.playerLedSurface3D;
        const gl=lab.renderer.getContext();
        const programs=[];
        for(const p of lab.renderer.info.programs||[]){
          const program=p.program,loc=program&&gl.getUniformLocation(program,'playerLedActive[0]');
          if(!loc)continue;
          const activeValues=Array.from({length:8},(_,i)=>{
            const at=gl.getUniformLocation(program,'playerLedActive['+i+']');
            return at?gl.getUniform(program,at):null;
          });
          const countLoc=gl.getUniformLocation(program,'playerLedCount');
          const minLoc=gl.getUniformLocation(program,'playerLedFrontMinY');
          programs.push({key:String(p.cacheKey).slice(-100),values:activeValues,
            count:countLoc?gl.getUniform(program,countLoc):null,
            frontMinY:minLoc?gl.getUniform(program,minLoc):null});
        }
        return {mask:led?.mask,cpuValues:Array.from(led?.uniforms?.active?.value||[]),
          cpuCount:led?.uniforms?.count?.value,uniformPrograms:programs,
          meshVisible:led?.target?.visible,materialVersion:led?.target?.material?.version,
          model:lab.model.model.id};
      });
      console.log('3D_LED_UNIFORM_DIAGNOSTIC '+JSON.stringify(ledDebug));
      if(bytes.length<4000||sha256===prior)throw Error('3D player LEDs must actually change WebGL pixels: '+model+' '+name+' '+JSON.stringify(ledDebug));
      prior=sha256;
      images.push({file:name,modelId:model,playerMask:mask,bytes:bytes.length,sha256,
        source:'Actual WebGL2 source OBJ material LEDs; no physical LED readback'});
    }
  }
  await page.locator('#controller').selectOption('DualSenseCompact');
  await shotProof();
  await page.locator('#demoToggle').check();
  const finalPolish=await captureFinalPolish(page,{output,images,base});
  await captureVisualFinish(page,{output,images});
  await captureModelConsistency(page,{output,images,shotProof});
  await page.locator('#demoToggle').uncheck();
  await page.evaluate(()=>{document.querySelector('#appearanceSettings').open=true;document.querySelector('#inputDebug').open=true;});
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
  const consolidated=await captureConsolidated(page,{output,images,shotProof});
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
      if(obj.userData?.artworkSource==='2d-svg'&&obj.userData.buttonGlyph)marks.push(obj.userData.buttonGlyph);
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

  // CI-only, real Chromium/WebGL A/B proof. Geometric edge counts cannot
  // establish optical visibility at the actual 320px overlay scale.
  await page.locator('#demoToggle').uncheck();
  await page.locator('#pressAll').uncheck();
  const previousInkRevision=Number(await page.evaluate(()=>document.body.dataset.renderRevision||0));
  await page.locator('#view').selectOption('front');
  await page.locator('#materialMix').evaluate(el=>{
    el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForFunction(previous=>
    window.__exoPbrLab?.model?.model?.id==='Gamecube'&&
    document.body.dataset.renderReady==='three-rendered'&&
    Number(document.body.dataset.renderRevision||0)>previous,
    previousInkRevision,{timeout:30000});
  const proofState=await page.evaluate(()=>{
    const s=window.__exoPbrLab?.model?.interiorHousingContours;
    return {segments:s?.segments,recessSegments:s?.recessSegments,
      opacity:s?.material?.opacity,vertexRGBA:s?.geometry?.getAttribute('color')?.itemSize};
  });
  if(proofState.recessSegments<45||proofState.vertexRGBA!==4||proofState.opacity<.4)
    throw Error('GameCube recess ink did not reach its intended production material: '+JSON.stringify(proofState));
  const refreshInk=async disabled=>{
    const previous=Number(await page.evaluate(()=>document.body.dataset.renderRevision||0));
    await page.evaluate(disabled=>{
      const scene=window.__exoPbrLab.model.interiorHousingContours;
      scene.geometry.setDrawRange(0,disabled?0:Infinity);
      document.querySelector('#materialMix').dispatchEvent(new Event('input',{bubbles:true}));
    },disabled);
    await page.waitForFunction(previous=>
      Number(document.body.dataset.renderRevision||0)>previous,previous,{timeout:30000});
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  };
  const sampleRecess=async(label)=>{
    const file='gamecube-inner-recesses-'+label+'.png';
    const b=await page.locator('.variant[data-variant="white"] .sample[data-scene="light"]')
      .screenshot({path:path.join(output,file),animations:'disabled'});
    images.push({file,modelId:'Gamecube',scenario:'3D native recess contrast '+label,
      bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});
    await page.evaluate(label=>{
      const lab=window.__exoPbrLab,t=lab.renderTarget;
      const rgba=new Uint8Array(t.width*t.height*4);
      lab.renderer.readRenderTargetPixels(t,0,0,t.width,t.height,rgba);
      window.__exoGameCubeInkProof??={};
      window.__exoGameCubeInkProof[label]={rgba,width:t.width,height:t.height};
    },label);
  };
  await refreshInk(false);
  await sampleRecess('enabled');
  await refreshInk(true);
  await sampleRecess('disabled');
  await refreshInk(false);
  const visualInk=await page.evaluate(()=>{
    const on=window.__exoGameCubeInkProof.enabled,off=window.__exoGameCubeInkProof.disabled;
    if(on.width!==off.width||on.height!==off.height)throw Error('Recess A/B dimension mismatch');
    const region=(left)=>{
      const w=on.width,h=on.height;
      const startX=Math.floor(w*(left?.24:.52)),endX=Math.floor(w*(left?.52:.78));
      const startY=Math.floor(h*.18),endY=Math.floor(h*.60);
      let changed=0,totalDelta=0;
      for(let y=startY;y<endY;y++)for(let x=startX;x<endX;x++){
        const i=(y*w+x)*4;
        const delta=Math.abs(on.rgba[i]-off.rgba[i])+
          Math.abs(on.rgba[i+1]-off.rgba[i+1])+
          Math.abs(on.rgba[i+2]-off.rgba[i+2]);
        if(delta>=14)changed++;
        totalDelta+=delta;
      }
      return {changed,totalDelta};
    };
    return {left:region(true),right:region(false),width:on.width,height:on.height};
  });
  if(visualInk.left.changed<10||visualInk.right.changed<10||
    visualInk.left.totalDelta<400||visualInk.right.totalDelta<400)
    throw Error('Actual WebGL contour is still too faint on at least one lower lobe: '+
      JSON.stringify({visualInk,proofState}));
  console.log('GameCube visible-ink browser A/B PASS: '+JSON.stringify({visualInk,proofState}));
  await page.evaluate(()=>{delete window.__exoGameCubeInkProof;});
  const neutralPrevious=Number((await page.evaluate(()=>document.body.dataset.renderRevision))||0);
  await page.locator('#controller').selectOption('GenericPro');
  await page.waitForFunction(previous=>
    document.body.dataset.renderReady==='three-rendered' &&
    window.__exoPbrLab?.model?.model?.id==='GenericPro' &&
    window.__exoPbrLab?.flatReferences?.size===3 &&
    Number(document.body.dataset.renderRevision||0)>previous,
    neutralPrevious,{timeout:60000});
  let genericProof=await shotProof();
  const genericPartState=await page.evaluate(()=>{
    const rig=window.__exoPbrLab?.model;
    const legends=[];
    rig?.group?.traverse(x=>{if(['A','B','X','Y'].includes(x.userData?.buttonGlyph))legends.push(x.userData.buttonGlyph);});
    const centers=rig?.meshes?.filter(m=>m.userData.genericCenterControl)
      .map(m=>({file:m.userData.sourceFile,key:m.userData.control,artwork:m.userData.artworkKey,
        source:m.userData.artworkSource,markings:!!m.material.userData.surfaceMarking}));
    return {parts:rig?.partCount,originalParts:rig?.originalPartCount,
      modelSource:rig?.model?.assetId,physicalSource:rig?.physicalRigSource,
      originalSource:rig?.model?.source,triangles:rig?.triangles,legends,centers,
      genericLayout:[...window.__exoPbrLab.flatReferences.values()].every(ref=>ref.layout.id==='generic'),
      interiorSegments:rig?.interiorHousingContours?.segments,
      interiorOpacity:rig?.interiorHousingContours?.material?.opacity,
      modelStatus:document.querySelector('#modelInfo')?.textContent};
  });
  if(genericPartState.parts!==25||genericPartState.originalParts!==24||
      genericPartState.modelSource!=='XboxOneClean'||genericPartState.physicalSource!=='XboxOneClean'||
      genericPartState.originalSource!=='co'||!genericPartState.genericLayout||
      genericPartState.triangles<500||genericPartState.legends.sort().join(',')!=='A,B,X,Y'||
      genericPartState.centers?.length!==4||genericPartState.centers.some(m=>!m.markings||m.source!=='2d-svg')||
      genericPartState.centers.map(m=>m.artwork).sort().join(',')!=='home,menu,share,view'||
      !Number.isFinite(genericPartState.interiorOpacity)||
      !genericPartState.modelStatus?.includes('24 MIT-Originalteile (Xbox One) + 1 Share-Kappe'))
    throw Error('Generic 3D Xbox One proxy / 2D generic symbols or source seams incomplete: '+JSON.stringify(genericPartState));
  console.log('GENERIC_XBOX_PROXY_PASS '+JSON.stringify(genericPartState));
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
      window.__exoPbrLab?.flatReferences?.size===3 &&
      Number(document.body.dataset.renderRevision||0)>=previous,
      {id,previous},{timeout:60000});
    const proof=await shotProof();
    coreSmoke.push({id,threeViewports:proof.sampleCount,svgViewports:proof.flatCount,
      rendered:true,webgl:proof.webglVersion});
    if(['JoyconGrip','JoyconLeft','JoyconRight'].includes(id)){
      // Neutral now follows the shared semantic contract, not fixed black
      // source materials. Assert exact expected color and zero input emission.
      const materials=await page.evaluate(async()=>{
        const [{Color},{CONTROL_NEUTRAL,isStructuralRole,isInteractiveRole}]=await Promise.all([
          import('three'),import('./controller-visual-policy.js')]);
        const lab=window.__exoPbrLab,rig=lab.model,t=lab.mix,blend=t*t*(3-2*t);
        const retained=lab.model?.model?0.16:0;
        return rig.meshes.filter(m=>/^(?:left|right)_(?:cap|ring|stick|trigger|bumper)[.]obj$/.test(m.userData.sourceFile||'')).map(m=>{
          const structural=isStructuralRole(m.userData.role);
          const originalWeight=structural?blend:isInteractiveRole(m.userData.role)?blend*(1-retained):0;
          const expected=m.userData.sourceColor.clone().lerp(structural
            ?m.userData.supportShellColor||rig.supportShellColor:new Color(CONTROL_NEUTRAL),originalWeight);
          return {file:m.userData.sourceFile,expected:expected.getHexString(),actual:m.material.color.getHexString(),
            emissive:m.material.emissiveIntensity};
        });
      });
      if(materials.length<3||materials.some(m=>m.actual!==m.expected||m.emissive!==0))
        throw Error('Joy-Con neutral semantic material mismatch: '+JSON.stringify({id,materials}));
      const name='3d-joycon-'+id.slice('Joycon'.length).toLowerCase()+'-neutral.png';
      const bytes=await page.screenshot({path:path.join(output,name),
        fullPage:true,animations:'disabled',timeout:60000});
      if(bytes.length<40000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
        throw Error('Invalid Joy-Con WebGL screenshot '+name);
      images.push({file:name,modelId:id,pressed:false,
        bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
        source:'Real WebGL/OBJ neutral material, not native Qt 3D'});
    }
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
      ring:getComputedStyle(ring).stroke,center:getFill(center),ringStroke:getComputedStyle(ring).stroke,
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

  // Direct free-XY pointer movement must shift the SAME SVG stick layer in
  // all six panels, without implicitly pressing L3/R3.
  const dragTarget=polish.locator('.stage[data-look="solid"][data-scene="dark"] [id$="-stick-l-cap-top"]');
  const dragBox=await dragTarget.boundingBox();
  if(!dragBox)throw Error('Authored left stick is not pointer-targetable');
  const px=dragBox.x+dragBox.width/2,py=dragBox.y+dragBox.height/2;
  await polish.mouse.move(px,py);
  await polish.mouse.down();
  await polish.mouse.move(px+24,py-12,{steps:6});
  const dragProof=await polish.evaluate(()=>{
    const state=window.__exo2DPolish.inputState();
    return {left:state.left,right:state.right,clickL:state.values.get('ls')||0,
      clickR:state.values.get('rs')||0,
      positions:window.__exo2DPolish.refs.map(x=>{
        const entry=x.reference.controls.find(c=>c.stickSide==='left');
        return entry?.group.getAttribute('transform');
      })};
  });
  if(dragProof.left.x<.3||dragProof.left.y>-.2||
    Math.abs(dragProof.right.x)>1e-5||Math.abs(dragProof.right.y)>1e-5||
    dragProof.clickL||dragProof.clickR||new Set(dragProof.positions).size!==1)
    throw Error('Free XY drag not synchronized across views: '+JSON.stringify(dragProof));
  await capturePolish('2d-dualsense-free-xy-drag.png','dualsense',
    'Left stick true pointer XY drag, no L3', '.stage[data-look="solid"][data-scene="dark"]');
  await polish.mouse.up();
  const released=await polish.evaluate(()=>window.__exo2DPolish.inputState().left);
  if(Math.abs(released.x)>1e-5||Math.abs(released.y)>1e-5)
    throw Error('Stick failed to spring back to neutral: '+JSON.stringify(released));
  await polish.locator('#clickLeft').check();
  const isolatedClick=await polish.evaluate(()=>{
    const state=window.__exo2DPolish.inputState();
    return {ls:state.values.get('ls')||0,rs:state.values.get('rs')||0,
      left:state.left,right:state.right};
  });
  if(isolatedClick.ls!==1||isolatedClick.rs!==0||
    Math.hypot(isolatedClick.left.x,isolatedClick.left.y)>1e-5)
    throw Error('L3 click did not remain independent from stick travel: '+JSON.stringify(isolatedClick));
  await capturePolish('2d-dualsense-isolated-l3.png','dualsense',
    'Only L3 center pressed; neutral stick travel', '.stage[data-look="solid"][data-scene="dark"]');
  await polish.locator('#clickLeft').uncheck();

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
  // Pixel-backed Solid regression gate: rendered moving rings must be opaque
  // material, never holes; Xbox bumper fill must stop at its authored lobe.
  const xboxSolid=await polish.evaluate(()=>{
    const views=window.__exo2DPolish.refs;
    const solid=views.find(x=>x.mode==='solid'&&x.scene==='dark');
    const ghost=views.find(x=>x.mode==='ghost'&&x.scene==='dark');
    const inspect=(ref)=>{
      const svg=ref.reference.svg;
      const controls=ref.reference.controls;
      const stick=controls.find(x=>x.layer.id==='stick-l-cap');
      const outer=stick?.group.querySelector('[id$="-outline"]');
      return {fill:outer?getComputedStyle(outer).fill:null,
        alpha:outer?Number(getComputedStyle(outer).fillOpacity):0};
    };
    const shoulder=id=>{
      const entry=solid.reference.controls.find(x=>x.layer.id===id);
      const pressure=entry.group.querySelector('[id$="-pressure"]');
      const clipValue=getComputedStyle(pressure).clipPath;
      const clip=solid.reference.svg.querySelector(
        '[data-exo-bumper-clip="'+id+'"]');
      const rect=clip?.querySelector('rect');
      const box=pressure.getBBox();
      return {clipValue,clipId:clip?.id,pressureId:pressure.id,
        originalWidth:box.width,clippedWidth:Number(rect?.getAttribute('width'))};
    };
    const firstGlyph=solid.reference.controls.find(x=>x.control==='b1')
      ?.group.querySelector('.glyph');
    return {solid:inspect(solid),ghost:inspect(ghost),
      left:shoulder('btn-l1'),right:shoulder('btn-r1'),
      glyph:firstGlyph?getComputedStyle(firstGlyph).fill:null};
  });
  if(xboxSolid.solid.fill==='none'||xboxSolid.solid.alpha<.9||
    xboxSolid.ghost.fill!=='none')
    throw Error('Solid moving ring must be material-filled; Ghost stays thin: '+
      JSON.stringify(xboxSolid));
  if([xboxSolid.left,xboxSolid.right].some(x=>
    !x.clipValue.includes(x.clipId)||!x.clipId.startsWith(x.pressureId)||
    x.clippedWidth>=x.originalWidth*.68))
    throw Error('Xbox L1/R1 button fill extends into the central bridge: '+
      JSON.stringify(xboxSolid));
  if(xboxSolid.glyph!=='rgb(32, 52, 70)')
    throw Error('Solid face labels must remain legible on controls: '+
      JSON.stringify(xboxSolid));
  await capturePolish('2d-xbox-series-solid-fixed.png','xbox_series',
    'Original shoulder contours + filled moving ring',
    '.stage[data-look="solid"][data-scene="dark"]');
  await range2D('stick',100);
  await check2D('faces',true);
  await capturePolish('2d-xbox-series-solid-pressed.png','xbox_series',
    'White moving annulus + readable labels, bounded shoulder',
    '.stage[data-look="solid"][data-scene="dark"]');
  await range2D('stick',0);
  await check2D('faces',false);
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

  // Keep all authored 2D families in the visual approval matrix. Solid
  // moving rings must be material-filled, without changing Ghost topology.
  for(const [modelId,file] of [['switch_pro','2d-switch-pro-solid-fixed.png'],
    ['gamecube','2d-gamecube-solid-fixed.png'],
    ['generic','2d-generic-solid-fixed.png']]){
    await select2D('layout',modelId);
    await select2D('colorway','auto');
    const proof=await polish.evaluate(()=>{
      const refs=window.__exo2DPolish.refs;
      const solid=refs.find(x=>x.mode==='solid'&&x.scene==='dark');
      const ghost=refs.find(x=>x.mode==='ghost'&&x.scene==='dark');
      const sample=r=>{
        const group=r.reference.controls.find(x=>x.layer.id==='stick-l-cap')?.group;
        const outer=group?.querySelector('[id$="-outline"]');
        return outer?{fill:getComputedStyle(outer).fill,
          alpha:Number(getComputedStyle(outer).fillOpacity)}:null;
      };
      return {solid:sample(solid),ghost:sample(ghost)};
    });
    if(proof.solid&&proof.solid.fill==='none')
      throw Error('Solid ring is still transparent for '+modelId+': '+JSON.stringify(proof));
    if(proof.ghost&&proof.ghost.fill!=='none')
      throw Error('Ghost ring has unintended fill for '+modelId+': '+JSON.stringify(proof));
    const dpad=await polish.evaluate(()=>{
      const solid=window.__exo2DPolish.refs.find(x=>x.mode==='solid'&&x.scene==='dark');
      const group=solid.reference.controls.find(x=>x.layer.id==='dpad')?.group;
      if(!group)return {present:false,paints:[]};
      const paints=[...group.querySelectorAll('path,rect,ellipse')].filter(x=>
        !x.classList.contains('glyph')&&!x.closest('.glyph,defs,mask'))
        .map(x=>{const css=getComputedStyle(x);return {id:x.id,fill:css.fill,alpha:Number(css.fillOpacity)};})
        .filter(x=>x.fill!=='none'&&x.alpha>.01);
      return {present:true,paints};
    });
    if(dpad.present&&(dpad.paints.length<1||
      dpad.paints.some(x=>x.fill!=='rgb(168, 185, 199)')))
      throw Error('D-pad must share the neutral control material: '+
        JSON.stringify({modelId,dpad}));
    await capturePolish(file,
      modelId,'Solid original contours and material-filled moving sticks',
      '.stage[data-look="solid"][data-scene="dark"]');
  }
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
          glyphContrast: [...ghost.reference.svg.querySelectorAll('[data-exo-control-contrast]')]
            .some(filter=>getComputedStyle(face.group.querySelector('.glyph')).filter.includes('#'+filter.id)),
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
      if(scene==='mixed')assert2D(state.glyphContrast,true,'Mixed glyph keeps shared grayscale counter-edge');
      else assert2D(state.glyphFilter,'none','Neutral glyph has no silhouette relief or active glow');
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
  const ghostState=await ghost.evaluate(async()=>{
    const state=window.__exoGhostReview;
    const response=await fetch(state.items[0].reference.layout.source);
    if(!response.ok)throw Error('Original SVG unavailable for decorative path verification');
    const original=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
    const originalPaths=[...original.querySelector('#body').children].filter(node=>
      ['path','ellipse','rect'].includes(node.localName)&&node.id!=='outline-strong');
    const originalMute=original.querySelector('#btn-mute-face');
    const results=[];
    for(const item of state.items){
      const paths=[...item.reference.bodyShape?.children||[]].filter(node=>
        ['path','ellipse','rect'].includes(node.localName)&&
        node.id!=='outline-strong'&&!node.id.endsWith('-outline-strong'));
      const changedDecoration=paths.filter(p=>{
        const source=originalPaths.find(n=>n.localName===p.localName&&
          ['d','x','y','cx','cy','rx','ry','width','height','transform']
            .every(attr=>n.getAttribute(attr)===p.getAttribute(attr)));
        return !source||p.getAttribute('style')!==source.getAttribute('style');
      });
      const mute=item.reference.svg.querySelector('[id$="-btn-mute-face"]');
      const touchpad=item.reference.controls.find(c=>c.layer.id==='btn-touchpad');
      const touchpadFilled=[...touchpad?.group.querySelectorAll('path,rect,ellipse')||[]]
        .filter(p=>!p.classList.contains('glyph')&&getComputedStyle(p).fill!=='none'&&
          Number(getComputedStyle(p).fillOpacity)>.0001);
      results.push({look:item.look,scene:item.scene,
        body:changedDecoration.map(p=>({id:p.id,className:p.getAttribute('class'),
          fill:getComputedStyle(p).fill,alpha:getComputedStyle(p).fillOpacity,
          style:p.getAttribute('style')?.slice(0,180)})),
        bodyCount:paths.length,sourceBodyCount:originalPaths.length,
        muteStyle:mute?.getAttribute('style'),sourceMuteStyle:originalMute?.getAttribute('style'),
        touchpad:touchpadFilled.map(p=>p.id)});
    }
    return results;
  });
  if(ghostState.some(r=>r.body.length||r.bodyCount!==r.sourceBodyCount||
      r.muteStyle!==r.sourceMuteStyle||r.touchpad.length!==1))
    throw Error('Ghost A/B/C: complete authored decorations must retain paint; Touchpad must be one visible control: '+JSON.stringify(ghostState));
  // Explicit shape contract: source-authorized R1/L1 surface, not its
  // decorative open rim, must be the fill that users actually see.
  const pressureRoles=await ghost.evaluate(()=>{
    const item=window.__exoGhostReview.items.find(x=>x.look==='pure'&&x.scene==='dark');
    return ['btn-l1','btn-r1','trigger-l2','trigger-r2'].map(id=>{
      const group=item.reference.controls.find(x=>x.layer.id===id)?.group;
      const pressure=group?.querySelector('[id$="-pressure"]');
      const other=[...group?.querySelectorAll('path')||[]].filter(x=>x!==pressure);
      return {id,pressure:pressure?{
        fill:getComputedStyle(pressure).fill,alpha:getComputedStyle(pressure).fillOpacity,
        visible:pressure.getAttribute('data-exo-visible-control-fill')}:
        null,other:other.map(x=>getComputedStyle(x).fill)};
    });
  });
  for(const role of pressureRoles){
    if(role.pressure?.visible!=='1'||role.pressure.fill!=='rgb(255, 255, 255)'||
      Math.abs(Number(role.pressure.alpha)-.26)>.001||role.other.some(x=>x!=='none'))
      throw Error('Authored L1/R1/trigger SURFACE must be painted, not open outline: '+
        JSON.stringify(role));
  }
  const neutralControls=await ghost.evaluate(()=>{
    const data=[];
    for(const item of window.__exoGhostReview.items){
      const groups=item.reference.controls;
      const pick=id=>groups.find(x=>x.layer.id===id)?.group;
      const nodes={
        l1:pick('btn-l1')?.querySelector('[id$="-pressure"]'),
        share:pick('btn-view')?.querySelector('[id$="-face"]'),
        options:pick('btn-menu')?.querySelector('[id$="-face"]'),
        r1:pick('btn-r1')?.querySelector('[id$="-pressure"]'),
        dpad:pick('btn-up')?.querySelector('[id$="-face"]'),
        face:pick('btn-cross')?.querySelector('[id$="-face"]'),
        ps:pick('btn-home')?.querySelector('path'),
        touchpad:pick('btn-touchpad')?.querySelector('path'),
        stick:pick('stick-l-cap')?.querySelector('[id$="-top"]'),
        trigger:pick('trigger-l2')?.querySelector('[id$="-pressure"]')
      };
      const sample={look:item.look,scene:item.scene,values:{},
        glyph:(()=>{const n=pick('btn-cross')?.querySelector('.glyph');
          return n?{color:getComputedStyle(n).fill,alpha:getComputedStyle(n).opacity}:null;})()};
      for(const [key,n] of Object.entries(nodes)){
        if(!n)throw Error('Missing real SVG control '+key+' on '+item.scene);
        const css=getComputedStyle(n);
        sample.values[key]={fill:css.fill,alpha:Number(css.fillOpacity),
          stroke:css.stroke,strokeAlpha:Number(css.strokeOpacity)};
      }
      data.push(sample);
    }
    return data;
  });
  for(const panel of neutralControls){
    const sceneBaseline=neutralControls.find(x=>x.scene===panel.scene);
    const sceneInk=panel.scene==='light'?'rgb(0, 0, 0)':'rgb(255, 255, 255)';
    if(panel.values.face.fill!==sceneInk||Math.abs(panel.values.face.alpha-.26)>.001)
      throw Error('Neutral controls lost achromatic scene contrast or .26 alpha: '+JSON.stringify(panel));
    for(const [name,actual] of Object.entries(panel.values)){
      const expected=sceneBaseline.values.face;
      // Trigger pressure and its source-authored structural border are
      // separate SVG elements. Compare the material, not a deliberately
      // absent duplicate stroke over the pressure texture.
      // R1/L1 and triggers have a closed fill-only pressure path plus a
      // separate authored outline. Compare their REAL fill here and their
      // structural border via the dedicated pressure-geometry assertion.
      const sameBorder=['trigger','l1','r1'].includes(name)||(
        actual.stroke===expected.stroke&&
        Math.abs(actual.strokeAlpha-expected.strokeAlpha)<.001);
      if(actual.fill!==expected.fill||Math.abs(actual.alpha-expected.alpha)>.001 ||
         !sameBorder)
        throw Error('Inconsistent neutral '+name+' on '+panel.look+'/'+panel.scene+': '+
          JSON.stringify({actual,expected}));
    }
    if(panel.glyph?.color!==sceneInk||Math.abs(Number(panel.glyph?.alpha)-.86)>.001||
       JSON.stringify(panel.glyph)!==JSON.stringify(sceneBaseline.glyph))
      throw Error('Face glyph differs from the shared achromatic palette within its scene: '+JSON.stringify(panel));
  }

  // Pixel-level proof of visible control fills. A computed SVG style is
  // insufficient: the path might be invisible, occluded, or offscreen.
  // Suppress ONLY the marked physical fill and compare REAL Chromium
  // screenshot pixels of the same SVG over a hard mixed background.
  const visibleControlPixelAudit=[];
  const checkVisibleFill=async(scene,id)=>{
    const stage='.stage[data-look="pure"][data-scene="'+scene+'"]';
    const before=await ghost.locator(stage).screenshot({animations:'disabled',timeout:60000});
    const hidden=await ghost.evaluate(({scene,id})=>{
      const item=window.__exoGhostReview.items.find(x=>x.look==='pure'&&x.scene===scene);
      const entry=item.reference.controls.find(x=>x.layer.id===id);
      if(!entry)throw Error('Missing mapping for pixel audit '+id);
      const nodes=[...entry.group.querySelectorAll('[data-exo-visible-control-fill="1"]')];
      if(!nodes.length)throw Error('Missing colored control surface in '+id);
      for(const node of nodes)node.style.setProperty('fill-opacity','0','important');
      return nodes.length;
    },{scene,id});
    const after=await ghost.locator(stage).screenshot({animations:'disabled',timeout:60000});
    await ghost.evaluate(({scene,id})=>{
      const item=window.__exoGhostReview.items.find(x=>x.look==='pure'&&x.scene===scene);
      const entry=item.reference.controls.find(x=>x.layer.id===id);
      for(const node of entry.group.querySelectorAll('[data-exo-visible-control-fill="1"]'))
        node.style.setProperty('fill-opacity','0.26','important');
    },{scene,id});
    const diff=await ghost.evaluate(async({before,after})=>{
      async function rgba(base64){
        const pic=new Image();
        pic.src='data:image/png;base64,'+base64;await pic.decode();
        const can=document.createElement('canvas');can.width=pic.naturalWidth;can.height=pic.naturalHeight;
        const ctx=can.getContext('2d',{willReadFrequently:true});ctx.drawImage(pic,0,0);
        return ctx.getImageData(0,0,can.width,can.height).data;
      }
      const a=await rgba(before),b=await rgba(after);
      if(a.length!==b.length)throw Error('Pixel comparison size changed');
      let changed=0,sum=0,max=0;
      for(let i=0;i<a.length;i+=4){
        const value=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
        if(value>=3){changed++;sum+=value;max=Math.max(max,value);}
      }
      return {changed,sum,max};
    },{before:before.toString('base64'),after:after.toString('base64')});
    visibleControlPixelAudit.push({scene,id,nodes:hidden,...diff});
    if(diff.changed<3||diff.sum<35)
      throw Error('SVG control fill not actually visible in Chromium: '+
        JSON.stringify({scene,id,nodes:hidden,...diff}));
  };
  for(const scene of ['dark','light','mixed']){
    for(const id of ['btn-l1','btn-r1','btn-home','btn-view','btn-menu',
      'btn-touchpad','btn-cross','btn-up','stick-l-cap','trigger-l2'])
      await checkVisibleFill(scene,id);
  }
  console.log('Pixel-visible 2D controls verified: '+JSON.stringify(visibleControlPixelAudit));

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
  await ghost.locator('#allControls').check();
  await captureGhost('2d-ghost-review-all-controls.png');
  const pressedControls=await ghost.evaluate(()=>{
    return window.__exoGhostReview.items.map(item=>{
      const names=['btn-l1','btn-r1','btn-home','btn-view','btn-menu','btn-touchpad'];
      const controls=names.map(id=>{
        const entry=item.reference.controls.find(x=>x.layer.id===id);
        const p=entry?.group.querySelector('[data-exo-visible-control-fill="1"]');
        const style=p?getComputedStyle(p):null;
        return {id,fill:style?.fill,alpha:style?.fillOpacity};
      });
      return {look:item.look,scene:item.scene,controls,
        muteStyle:item.reference.svg.querySelector('[id$="-btn-mute-face"]')?.getAttribute('style')};
    });
  });
  for(const panel of pressedControls){
    const neutral=ghostState.find(x=>x.look===panel.look&&x.scene===panel.scene);
    if(panel.muteStyle!==neutral.muteStyle)
      throw Error('Decorative mute received input-dependent paint: '+JSON.stringify(panel));
    for(const ctl of panel.controls)
      if(ctl.fill!=='rgb(255, 255, 255)'||Math.abs(Number(ctl.alpha)-.40)>.001)
        throw Error('Pressed 2D control is not uniformly translucent white: '+JSON.stringify({panel:panel.scene,look:panel.look,...ctl}));
  }
  await ghost.locator('#allControls').uncheck();
  if(images.at(-1).sha256===images.find(x=>x.file==='2d-ghost-review-neutral.png').sha256)
    throw Error('Ghost review input activity produced identical pixels');
  if(ghostErrors.length)throw Error('Ghost A/B/C browser errors: '+ghostErrors.join('; '));
  await ghost.close();

  // Review the ALREADY installed source SVG + mapping, against our two looks.
  // The alternate ZIP is not silently substituted for repository assets.
  const sourceReviewErrors=[];
  const sourceReviewPage=await browser.newPage({viewport:{width:1600,height:920},deviceScaleFactor:1,reducedMotion:'reduce'});
  sourceReviewPage.on('pageerror',error=>sourceReviewErrors.push(error.message));
  sourceReviewPage.on('response',response=>{
    if(response.status()>=400&&!/\/favicon\.ico(?:\?|$)/.test(response.url()))
      sourceReviewErrors.push('HTTP '+response.status()+' '+response.url());
  });
  await sourceReviewPage.goto(new URL('artwork-source-review.html',base).href,
    {waitUntil:'domcontentloaded',timeout:60000});
  const checkSourceReview=async(selectedId,actualId=selectedId)=>{
    await sourceReviewPage.waitForFunction(({selected,actual})=>
      document.body.dataset.sourceReviewReady==='ready'&&
      window.__exoSourceReview?.selected===selected&&
      window.__exoSourceReview?.actual===actual&&
      document.querySelectorAll('.stage>svg').length===3,
      {selected:selectedId,actual:actualId},{timeout:60000});
    const inspected=await sourceReviewPage.evaluate(()=>{
      const refs=window.__exoSourceReview.refs;
      return {views:refs.map(item=>item.mode),
        mappingIds:refs.map(x=>x.reference.mapping.id),
        stats:document.getElementById('mappingStats').textContent,
        warning:document.getElementById('licenseWarning').textContent,
        layouts:document.querySelectorAll('#layout option').length};
    });
    if(inspected.layouts!==20||inspected.views.join(',')!=='source,solid,ghost'||
      inspected.mappingIds.some(id=>id!==actualId)||
      !/Druckflächen|Stick-Knockouts/.test(inspected.stats))
      throw Error('Source comparison lacks coherent original mapping: '+JSON.stringify(inspected));
    return inspected;
  };
  const captureSourceReview=async name=>{
    const bytes=await sourceReviewPage.screenshot({path:path.join(output,name),fullPage:true,
      animations:'disabled',timeout:60000});
    if(bytes.length<25000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
      throw Error('Invalid source-comparison browser PNG '+name);
    images.push({file:name,modelId:'2DSourceReview',bytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),
      source:'Existing repository SVG; not byte-verified alternate ZIP'});
  };
  await checkSourceReview('dualsense');
  // Free XY drag must work in all three source/solid/ghost panels.
  const sourceCap=sourceReviewPage.locator('.stage[data-view="solid"] [id$="-stick-l-cap-top"]');
  const capRect=await sourceCap.boundingBox();
  if(!capRect)throw Error('Source review has no pointer-targetable cap');
  const mx=capRect.x+capRect.width/2,my=capRect.y+capRect.height/2;
  await sourceReviewPage.mouse.move(mx,my);
  await sourceReviewPage.mouse.down();
  await sourceReviewPage.mouse.move(mx+22,my-11,{steps:5});
  const moving=await sourceReviewPage.evaluate(()=>{
    const state=window.__exoSourceReview.state();
    const transform=window.__exoSourceReview.refs.map(x=>
      x.reference.controls.find(e=>e.stickSide==='left')?.group.getAttribute('transform'));
    return {left:state.left,right:state.right,click:state.values.get('ls')||0,transform};
  });
  if(moving.left.x<.2||moving.left.y>-.1||moving.click||
    Math.hypot(moving.right.x,moving.right.y)>.0001||
    new Set(moving.transform).size!==1)
    throw Error('Source comparison free XY movement is broken: '+JSON.stringify(moving));
  await sourceReviewPage.mouse.up();
  const recentered=await sourceReviewPage.evaluate(()=>window.__exoSourceReview.state().left);
  if(Math.hypot(recentered.x,recentered.y)>.0001)
    throw Error('Source comparison did not release analog stick');
  await sourceReviewPage.locator('#clickRight').check();
  const r3=await sourceReviewPage.evaluate(()=>{
    const s=window.__exoSourceReview.state();
    return {ls:s.values.get('ls')||0,rs:s.values.get('rs')||0};
  });
  if(r3.ls!==0||r3.rs!==1)throw Error('Source comparison mixes L3/R3: '+JSON.stringify(r3));
  await sourceReviewPage.locator('#clickRight').uncheck();
  const unstyled=await sourceReviewPage.locator('.stage[data-view="source"]').screenshot();
  const colored=await sourceReviewPage.locator('.stage[data-view="solid"]').screenshot();
  if(createHash('sha256').update(unstyled).digest('hex')===
    createHash('sha256').update(colored).digest('hex'))
    throw Error('Raw SVG and styled Solid have identical pixels');
  await captureSourceReview('2d-source-solid-ghost-dualsense.png');
  await sourceReviewPage.locator('#layout').selectOption('xbox_series');
  await checkSourceReview('xbox_series');
  await captureSourceReview('2d-source-solid-ghost-xbox-series.png');
  await sourceReviewPage.locator('#layout').selectOption('steam_controller_2026');
  const safe=await checkSourceReview('steam_controller_2026','generic');
  if(!safe.warning.includes('Generic-Fallback'))
    throw Error('Steam Controller 2026 must use vetted generic fallback');
  if(sourceReviewErrors.length)
    throw Error('Source review browser errors: '+sourceReviewErrors.join('; '));
  await sourceReviewPage.close();

  const manifest={revision,capturedAt:new Date().toISOString(),url:new URL('pbr-lab.html',base).href,
    content:'Real Three.js/WebGL2 + original controller OBJ + authored SVG',looks:['white','cool'],
    viewports:['3D dark','3D light','3D mixed','2D dark','2D light','2D mixed'],images,
    scenarios:{consolidated,A:{genericModel:'GenericPro',parts:genericPartState.parts,neutralAndPressed:true},
      B:{coreSmoke,notCleared:['XboxSeries','SteamController2026'],fullTierABComplete:false}},
    visualAcceptance:'Pending human inspection; capture proves rendering, not visual quality'};
  await writeFile(path.join(output,'capture-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Captured real WebGL screenshots: ${images.map(x=>x.file).join(', ')} (${images[0].webgl})`);
}catch(e){console.error(`Real WebGL capture failed: ${e.stack||e}`);process.exitCode=1;}
finally{if(browser)await browser.close();}
