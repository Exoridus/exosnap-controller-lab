#!/usr/bin/env node
// Real browser/WebGL screenshots only. Fails loudly when the context cannot
// be created; never falls back to screenshots of invented 3D controller art.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const option=(key,defaultValue)=>{const pos=args.indexOf(key);return pos>=0?args[pos+1]:defaultValue;};
const base=option('--base','http://127.0.0.1:8792');
const dest=path.resolve(option('--out','evidence/local-pbr-webgl'));
let playwright;
try{playwright=await import('playwright');}
catch {console.error('Playwright missing. Optional: npm install --no-save --package-lock=false playwright');process.exit(2);}
const browser=await playwright.chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1580,height:960},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`${base.replace(/\/$/,'')}/pbr-lab.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>['three-rendered','webgl-unavailable','model-error'].includes(document.body.dataset.renderReady),{timeout:40000});
  const state=await page.locator('body').getAttribute('data-render-ready');
  if(state!=='three-rendered')throw Error(`No valid real WebGL render: ${state}; ${(await page.locator('#rendererStatus').innerText())}`);
  await mkdir(dest,{recursive:true});
  const manifest={source:'real Three.js renderer',base,images:[],errors};
  for(const view of ['front','angled']){
    await page.locator('#view').selectOption(view);
    for(const mix of [0,50,100]){
      await page.locator('#materialMix').fill(String(mix));
      // Changes schedule a render via requestAnimationFrame. Await actual frame
      // completion using a double RAF rather than a static timeout.
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      const name=`pbr-${view}-mix${mix}.png`;
      await page.screenshot({path:path.join(dest,name),fullPage:true});
      manifest.images.push({name,view,mix,variants:6,backgrounds:['dark','light','mixed']});
    }
  }
  await writeFile(path.join(dest,'capture-manifest.json'),JSON.stringify(manifest,null,2));
  console.log(`Saved ${manifest.images.length} real WebGL comparison screenshots to ${dest}`);
  if(errors.length)throw Error(`Browser runtime errors: ${errors.join('; ')}`);
}catch(error){console.error(error.stack||error.message);process.exitCode=1;}
finally{await browser.close();}
