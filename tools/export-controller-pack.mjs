#!/usr/bin/env node
// Build artifact generator: original OBJ+info.json -> one GLB with individually
// named/animated nodes, plus SVG elements, rig, controls and provenance.
// No mesh decimation and no runtime OBJ fetch in Qt.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {CONTROLLERS,isLicensedModel} from '../models.js';
import {layoutForModel} from '../controller-catalog.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {controllerPresentationModel,prepareGenericCenterControls} from '../generic-xbox-proxy.js';
import {shareEquivalentControlGeometry} from '../pbr-optimizer.js';
import {stickMechanics,triggerMechanics} from '../model-mechanics.js';
import {CONTROLLER_PACK_VERSION,canonicalControlsForLayout,canonicalRigParts} from '../controller-asset-contract.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const sha=b=>createHash('sha256').update(b).digest('hex');
const pretty=x=>JSON.stringify(x,null,2)+'\n';
const readSource=async url=>readFile(path.join(root,url.replace(/^\.\//,'')),'utf8');
if(typeof globalThis.FileReader==='undefined'){
 globalThis.FileReader=class {
  result=null;error=null;onloadend=null;onerror=null;
  async readAsArrayBuffer(blob){try{this.result=await blob.arrayBuffer();this.onloadend?.({target:this});}
   catch(error){this.error=error;this.onerror?.({target:this});}}
  async readAsDataURL(blob){try{const b=Buffer.from(await blob.arrayBuffer());
   this.result='data:'+(blob.type||'application/octet-stream')+';base64,'+b.toString('base64');
   this.onloadend?.({target:this});}
   catch(error){this.error=error;this.onerror?.({target:this});}}
 };
}
function groupXML(svg,id){
 const tags=/<\/?g\b[^>]*>/g;let start=-1,depth=0;
 for(let m;(m=tags.exec(svg));){
  if(start<0){
   if(m[0].startsWith('</'))continue;
   if(new RegExp('\\bid=["\\x27]'+id+'["\\x27]').test(m[0])){start=m.index;depth=1;}
   continue;
  }
  if(m[0].startsWith('</'))depth--;
  else if(!m[0].endsWith('/>'))depth++;
  if(depth===0)return svg.slice(start,tags.lastIndex);
 }
 return null;
}
function elementSvg(svg,id,viewBox){
 const xml=groupXML(svg,id);if(!xml)throw Error('SVG layer missing: '+id);
 const defs=svg.match(/<defs\b[^>]*>[\s\S]*?<\/defs>/i)?.[0]||'';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+viewBox.join(' ')+'">'+defs+xml+'</svg>\n';
}
function rigData(model,source,rig){
 const lookup=new Map(canonicalRigParts(model,source).map(x=>[x.node,x]));
 return {version:CONTROLLER_PACK_VERSION,model:model.id,unit:'normalized',
  maxExtent:4.05,sourceTriangles:rig.triangles,decimation:false,
  parts:rig.parts.map(p=>{
   const x=lookup.get(p.file)||{};
   return {...x,node:p.file,control:x.control||p.holder.userData.control||null,
    pivot:p.holder.position.toArray()};
  }),
  sticks:Object.fromEntries(['left','right'].map(side=>[side,stickMechanics(model.id,side)])),
  triggers:triggerMechanics(model.id),
  effects:{nativeValidated:false,markings:'Qt material alpha mask',
   depth:'Qt explicit render pass',silhouette:'Qt compositing shader'}};
}
export async function exportControllerPack(id,output){
 const selected=CONTROLLERS.find(m=>m.id===id);
 if(!isLicensedModel(selected))throw Error('Uncleared 3D model '+id);
 const model=controllerPresentationModel(selected);
 const folder=path.join(output,id);await mkdir(folder,{recursive:true});
 const sourceId=model.assetId||model.id;
 const original=path.join(root,'assets',sourceId);
 const info=JSON.parse(await readFile(path.join(original,'info.json'),'utf8'));
 const rig=await loadNativeRig(model,readSource);
 try{
  if(model.genericProxy)prepareGenericCenterControls(rig);
  const shared=shareEquivalentControlGeometry(rig);
  const exporter=new GLTFExporter();
  const buffer=await exporter.parseAsync(rig.group,{
   binary:true,onlyVisible:true,trs:true,includeCustomExtensions:false
  });
  if(!(buffer instanceof ArrayBuffer))throw Error('Expected a binary GLB');
  const glb=Buffer.from(buffer);
  const descriptor=rigData(model,info,rig);
  const layout=layoutForModel(id);
  let mappingControls=[],elements=[];
  if(layout?.has2D){
   const origin=path.join(root,'references/controllers',layout.id);
   const [svg,mapText]=await Promise.all([
    readFile(path.join(origin,'source.svg'),'utf8'),
    readFile(path.join(origin,'mapping.json'),'utf8')]);
   const mapping=JSON.parse(mapText);
   mappingControls=canonicalControlsForLayout(layout,mapping);
   await mkdir(path.join(folder,'elements'),{recursive:true});
   for(const layer of mapping.layers){
    const file='elements/'+layer.id+'.svg';
    await writeFile(path.join(folder,file),elementSvg(svg,layer.id,mapping.viewBox));
    elements.push(file);
   }
   await writeFile(path.join(folder,'source.svg'),svg);
   await writeFile(path.join(folder,'mapping.json'),mapText);
  }
  await writeFile(path.join(folder,'model.glb'),glb);
  await writeFile(path.join(folder,'rig.json'),pretty(descriptor));
  await writeFile(path.join(folder,'controls.json'),pretty({
   version:CONTROLLER_PACK_VERSION,model:id,layout:layout?.id||null,
   nativeMappingPriority:'Preserve the ExoSnap mapping; do not overwrite it',
   controls:mappingControls,
   rigNodes:descriptor.parts.map(p=>({node:p.node,control:p.control,role:p.role}))
  }));
  const names=['model.glb','rig.json','controls.json',
   ...(layout?.has2D?['source.svg','mapping.json',...elements]:[])];
  const hashes=Object.fromEntries(await Promise.all(names.map(async file=>[
   file,sha(await readFile(path.join(folder,file)))])));
  const upstreamFiles=(await readdir(original)).filter(name=>name.endsWith('.obj')||name==='info.json').sort();
  const upstream=Object.fromEntries(await Promise.all(upstreamFiles.map(async name=>[
   name,sha(await readFile(path.join(original,name)))])));
  await writeFile(path.join(folder,'manifest.json'),pretty({
   schemaVersion:CONTROLLER_PACK_VERSION,model:id,layout:layout?.id||null,
   sourceModel:sourceId,sourceType:model.source,generated:true,
   source:'assets/'+sourceId+'/info.json + OBJ',
   notice:'THIRD_PARTY_NOTICES.md / references/SOURCE_README.md',
   original2DLicense:layout?.id?'references/controllers/'+layout.id+'/mapping.json':null,
   exactBufferSharing:{pairs:shared.pairs,savedBytes:shared.savedBytes},
   Qt:{balsam:'offline GLB -> Qt mesh and QML',runtimeLoader:'preview only',
    nativeValidated:false},
   files:hashes,sourceHashes:upstream
  }));
  return {id,folder,parts:rig.parts.length,triangles:rig.triangles,
   svgElements:elements.length,glbBytes:glb.length};
 }finally{disposeNativeRig(rig);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const model=arg('--model','DualSenseCompact');
 const output=path.resolve(arg('--out',path.join(root,'.workspace/controller-packs')));
 const selected=model==='all'?CONTROLLERS.filter(isLicensedModel).map(x=>x.id):[model];
 for(const id of selected)console.log(JSON.stringify(await exportControllerPack(id,output)));
}
