// Short, fail-fast real Chromium verification of source SVG outer strokes.
// Keep it ahead of the 10-model 3D capture matrix so an edge regression is
// diagnosed immediately, not only after minutes of unrelated screenshot work.
import {createHash} from 'node:crypto';
import path from 'node:path';

export async function verifySvgSafeEdges(browser,{base,output,images}){
  const page=await browser.newPage({viewport:{width:1640,height:1120},deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&!/\/favicon\.ico(?:\?|$)/.test(r.url()))errors.push('HTTP '+r.status()+' '+r.url());});
  try{
    await page.goto(new URL('polish-2d.html',base).href,{waitUntil:'domcontentloaded',timeout:60000});
    const layouts=['dualsense','dualshock4','xbox_one','xbox_360','generic',
      'switch_pro','joycon_grip','joycon_left','joycon_right','gamecube'];
    const sizes=[240,320,480];
    let measured=0,masks=0,minimumGap=Infinity;
    for(const layout of layouts){
      await page.locator('#layout').selectOption(layout);
      await page.waitForFunction(id=>{
        const refs=window.__exo2DPolish?.refs||[];
        return document.body.dataset.polishReady==='ready'&&refs.length===6&&
          refs.every(r=>r.reference.svg&&r.reference.layout.id===id);
      },layout,{timeout:60000});
      for(const width of sizes){
        await page.locator('#size').selectOption(String(width));
        const measurements=await page.evaluate(()=>{
          return window.__exo2DPolish.refs.map(({reference,stage,mode,scene})=>{
            const svg=reference.svg;
            // Joy-Con Right has a body outline group rather than an
            // outline-strong ID. No synthetic geometry may be substituted.
            const outline=svg.querySelector('[id$="-outline-strong"]')||reference.bodyShape;
            if(!outline)return {mode,scene,error:'Missing authored outside contour'};
            const box=outline.getBoundingClientRect(),frame=stage.getBoundingClientRect();
            // Compare authored attribute values, not the float32 SVGRect DOM API.
            // The actual mask was created from the same exact viewBox string.
            const vb=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
            const maskAttr=reference.bodyShape?.getAttribute('mask')||'';
            const maskId=maskAttr.match(/^url\(#([^)]*)\)$/)?.[1]||null;
            const mask=maskId?svg.querySelector('#'+CSS.escape(maskId)):null;
            const m=mask?['x','y','width','height'].map(n=>Number(mask.getAttribute(n))):null;
            const maskValid=maskId?Boolean(m&&vb.length===4&&
              vb.every((n,i)=>Number.isFinite(n)&&Math.abs(n-m[i])<1e-6)):true;
            return {
              mode,scene,
              gaps:[box.left-frame.left,frame.right-box.right,box.top-frame.top,frame.bottom-box.bottom],
              maskValid,maskId,maskBounds:m,viewBox:vb,
              padded:svg.getAttribute('data-exo-padded-viewbox')==='1'
            };
          });
        });
        const bad=measurements.filter(m=>m.error||!m.padded||!m.maskValid||
          m.gaps.some(v=>!Number.isFinite(v)||v<2));
        if(bad.length)throw Error('Clipped authored 2D SVG at '+layout+'/'+width+
          'px: '+JSON.stringify(bad));
        measured+=measurements.length;
        masks+=measurements.filter(m=>m.maskId).length;
        minimumGap=Math.min(minimumGap,...measurements.flatMap(m=>m.gaps));
        if(width===320&&['dualsense','switch_pro','generic','gamecube'].includes(layout)){
          const filename='2d-safe-outline-'+layout+'-320.png';
          const bytes=await page.locator('.stage[data-look="ghost"][data-scene="light"]')
            .screenshot({path:path.join(output,filename),animations:'disabled',timeout:60000});
          if(bytes.length<4000)throw Error('Missing real SVG safe-edge frame '+filename);
          images.push({file:filename,modelId:layout,variant:'full 2D SVG border',
            bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
            source:'Chromium authored SVG with symmetric viewBox and full knockout mask'});
        }
      }
    }
    if(errors.length)throw Error('2D safe-edge browser errors: '+errors.join('; '));
    console.log('2D_SAFE_EDGE_PASS '+JSON.stringify({layouts:layouts.length,sizes,views:measured,
      verifiedMasks:masks,minimumClearancePx:Number(minimumGap.toFixed(2))}));
    return {layouts:layouts.length,views:measured,minimumGap};
  }finally{await page.close();}
}
