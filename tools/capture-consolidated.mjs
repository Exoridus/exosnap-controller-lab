// Browser-level acceptance checks for the final controller comparison.
// Invoked by capture-pages.mjs with its real WebGL page, not a second renderer.
import {createHash} from 'node:crypto';
import path from 'node:path';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function captureConsolidated(page,{output,images,shotProof}){
  const frame=async action=>{
    const revision=await page.evaluate(()=>Number(document.body.dataset.renderRevision||0));
    await action();
    await page.waitForFunction(previous=>document.body.dataset.renderReady==='three-rendered'&&
      Number(document.body.dataset.renderRevision||0)>previous,revision,{timeout:60000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const mix=value=>frame(()=>page.locator('#materialMix').evaluate((input,value)=>{
    input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));
  },value));
  const select=(id,value)=>frame(()=>page.locator('#'+id).selectOption(value));
  // Compare the same offscreen pixel grid. DOM rows may start at different
  // fractional CSS y positions, so hashes of two clipped PNGs are not a valid
  // test of equal materials. Readback is confined to this CI evidence harness.
  const sourceHash=async()=>hash(Buffer.from(await page.evaluate(()=>{
    const {renderer,renderTarget:target}=window.__exoPbrLab;
    const pixels=new Uint8Array(target.width*target.height*4);
    renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
    return Array.from(pixels);
  })));
  const capture=async(file,scenario)=>{
    const proof=await shotProof();
    const bytes=await page.screenshot({path:path.join(output,file),fullPage:true,animations:'disabled'});
    images.push({file,scenario,bytes:bytes.length,sha256:hash(bytes),
      webgl:proof.webglVersion,revision:proof.revision,drawStats:proof.drawStats});
  };
  await frame(()=>page.locator('#pressAll').uncheck());
  // The final design evidence uses the available 480 px inspection size so
  // source glyphs and hidden dashed inputs remain assessable in the PNGs.
  await frame(()=>page.setViewportSize({width:1600,height:1400}));
  await select('panelSize','480');
  await mix(0);
  const neutralFlat=hash(await page.locator('.flat-reference').screenshot());
  const neutral3D=await sourceHash();
  await capture('3d-consolidated-original.png','Materialmix 0%, neutral; one source-colored 3D recipe');
  const artwork=await page.evaluate(()=>{
    const marks=[];window.__exoPbrLab.model.group.traverse(mesh=>{
      if(mesh.userData.artworkSource==='2d-svg')marks.push(mesh.userData.artworkKey);
    });return marks.sort();
  });
  if(artwork.join(',')!==['circle','cross','down','left','menu','right','square','triangle','up','view'].sort().join(','))
    throw Error('DualSense is missing original source artwork: '+JSON.stringify(artwork));
  await mix(50);
  if(hash(await page.locator('.flat-reference').screenshot())!==neutralFlat)
    throw Error('3D material mix changed 2D pixels at 50%');
  await mix(100);
  if(hash(await page.locator('.flat-reference').screenshot())!==neutralFlat)
    throw Error('3D material mix changed 2D pixels at 100%');
  if(await sourceHash()===neutral3D)
    throw Error('Original and Ghost 3D endpoints produce identical pixels');
  await capture('3d-consolidated-ghost.png','Materialmix 100%, neutral; independent 2D');
  const independent=[];
  for(const control of ['l1','r1','l2','r2']){
    await select('testControl',control);
    const hints=await page.evaluate(()=>window.__exoPbrLab.model.rearHintLines.map(hint=>({
      control:hint.userData.control,visible:hint.visible,opacity:hint.material.opacity,
      fill:hint.userData.hiddenFill.visible,fillOpacity:hint.userData.hiddenFill.material.opacity,
      depth:hint.material.depthFunc,outline:hint.userData.hiddenOutline.visible
    })));
    const active=hints.filter(h=>h.opacity>.5);
    if(active.length!==1||active[0].control!==control||!active[0].fill||!active[0].outline||active[0].depth!==6)
      throw Error('Hidden feedback is not individually depth-tested: '+JSON.stringify({control,hints}));
    independent.push({control,hints});
    if(control==='l2'||control==='r1')
      await capture('3d-consolidated-hidden-'+control+'.png','Front, Ghost 100%, only '+control+' active');
  }
  await select('testControl','');
  const angles=[];
  for(const view of ['front','angled','top','profile','rear']){
    await select('view',view);
    const triggers=await page.evaluate(()=>window.__exoPbrLab.model.meshes
      .filter(mesh=>mesh.userData.role==='trigger').map(mesh=>({
        control:mesh.userData.control,visible:mesh.visible,
        colorWrite:mesh.material.colorWrite,depthWrite:mesh.material.depthWrite
      })));
    if(triggers.length!==2||triggers.some(t=>!t.visible||!t.colorWrite||!t.depthWrite))
      throw Error('A complete trigger was suppressed by camera angle: '+JSON.stringify({view,triggers}));
    angles.push({view,triggers});
    if(view==='top')await capture('3d-consolidated-top.png','High camera angle, both triggers physically rendered');
  }
  await select('view','front');
  await mix(0);
  await select('testControl','b1');
  const activeWhite=await sourceHash();
  if(activeWhite===neutral3D)throw Error('White feedback does not react to an individually active face button');
  await capture('3d-consolidated-feedback.png','Materialmix 0%, only cross active: white feedback');
  await select('testControl','ls');
  const clicks=await page.evaluate(()=>window.__exoPbrLab.model.meshes
    .filter(mesh=>mesh.userData.role==='stick-cap'&&!mesh.isInstancedMesh).map(mesh=>({
      source:mesh.userData.sourceFile,alpha:mesh.material.opacity,
      emissive:mesh.material.emissiveIntensity,visible:mesh.visible
    })));
  if(clicks.length!==2||clicks.some(c=>!c.visible)||clicks.filter(c=>c.emissive>0).length!==1||
      !clicks.find(c=>/left/.test(c.source)&&c.emissive>0))
    throw Error('L3 feedback leaked to the other stick: '+JSON.stringify(clicks));
  await select('testControl','');
  await select('stickPose','move');
  await mix(70);
  await capture('3d-consolidated-sticks.png','Analog motion: ring feedback and complete moving assembly');
  await select('stickPose','neutral');
  await select('panelSize','320');
  await frame(()=>page.setViewportSize({width:1200,height:1120}));
  console.log('Consolidated browser checks: '+JSON.stringify({artwork,flatMixInvariant:true,
    singleWhiteFeedback:true,independent,angles,clicks}));
  return {artwork,flatMixInvariant:true,singleWhiteFeedback:true,independent,angles,clicks};
}
