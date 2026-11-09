#!/usr/bin/env node
// Reproducible interchange packages. Source SVG and original OBJ remain
// authoritative; generated elements and GLB are never edited by hand.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTROLLERS,isLicensedModel} from '../models.js';
import {VIEWER_LAYOUTS} from '../controller-catalog.js';
import {buildControlBindings} from '../controller-pack-contract.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {prepareGenericCenterControls,controllerPresentationModel} from '../generic-xbox-proxy.js';
import {encodeControllerGlb} from './controller-glb-export.mjs';
import {describeRigMotions} from './controller-rig-motion.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=data=>JSON.stringify(data,null,2)+'\n';
function groupFromSource(source,id){
  // These authored SVGs carry one named <g> per mapped layer; preserve ALL
  // nested groups, path transforms and the original document-coordinate frame.
  if(!/^[a-z0-9_-]+$/i.test(id))throw Error('Untrusted SVG group: '+id);
  const start=new RegExp('<g\\b[^>]*\\bid="'+id+'"[^>]*>');
  const match=start.exec(source);if(!match)return null;
  const tokens=/<\/?g\b[^>]*>/g;tokens.lastIndex=match.index;
  let depth=0,token;
  while((token=tokens.exec(source))){
    depth+=token[0].startsWith('</')?-1:1;
    if(depth===0)return source.slice(match.index,tokens.lastIndex);
  }
  throw Error('Unbalanced SVG element '+id);
}
export function isolateSvgElement(source,mapping,layer){
  const fragment=groupFromSource(source,layer.id);
  if(!fragment)return null;
  const view=mapping.viewBox;
  if(!Array.isArray(view)||view.length!==4||!view.every(Number.isFinite))throw Error('Invalid SVG viewBox');
  // Keep the original source definitions, masks and styles. No coordinate or
  // geometric approximation, and no browser DOM dependency in the build.
  const defs=(source.match(/<defs\b[^>]*>[\s\S]*?<\/defs>/)||[])[0]||'';
  const styles=[...source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)]
    .map(m=>m[0]).filter(s=>!defs.includes(s)).join('\n');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view.join(' ')+'">\n'+
    defs+'\n'+styles+'\n'+fragment+'\n</svg>\n';
}
function safeOut(destination){
  const out=path.resolve(destination);
  if(out===path.parse(out).root||out===root||root.startsWith(out+path.sep)||out.startsWith(path.join(root,'assets')+path.sep)||
    out.startsWith(path.join(root,'references')+path.sep))throw Error('Refusing to replace a source directory: '+out);
  return out;
}
export async function buildControllerPacks({destination=path.join(root,'.workspace','controller-packs'),
  modelIds=null,sourceRoot=root}={}){
  const out=safeOut(destination);
  const active=VIEWER_LAYOUTS.filter(layout=>!modelIds||modelIds.includes(layout.id)||modelIds.includes(layout.modelId));
  if(!active.length)throw Error('No controller layouts matched requested models');
  if(modelIds){
    for(const id of modelIds)if(!active.some(layout=>layout.id===id||layout.modelId===id))
      throw Error('Unknown controller pack: '+id);
  }
  const reader=async p=>readFile(path.join(sourceRoot,p.replace(/^\.\//,'')),'utf8');
  await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  const catalog=[];
  for(const layout of active){
    const dir=path.join(out,layout.id);await mkdir(dir,{recursive:true});
    const hashes={},sources={};
    const write=async(name,bytes)=>{
      const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
      await mkdir(path.dirname(path.join(dir,name)),{recursive:true});
      await writeFile(path.join(dir,name),data);
      hashes[name]=digest(data);
    };
    let mapping=null,missing2D=[];
    if(layout.has2D){
      const sourceFile='references/controllers/'+layout.id+'/source.svg';
      const mappingFile='references/controllers/'+layout.id+'/mapping.json';
      const source=await reader(sourceFile),mappingText=await reader(mappingFile);
      mapping=JSON.parse(mappingText);
      if(mapping.id!==layout.id)throw Error('Source mapping mismatch: '+layout.id);
      await write('source.svg',source);await write('mapping.json',mappingText);
      sources[sourceFile]=digest(Buffer.from(source));
      sources[mappingFile]=digest(Buffer.from(mappingText));
      const named=new Set();
      for(const layer of mapping.layers){
        if(typeof layer.file!=='string'||!/^elements\/[a-z0-9_-]+\.svg$/i.test(layer.file))
          throw Error('Untrusted SVG layer name: '+layout.id+'/'+layer.file);
        if(named.has(layer.file))throw Error('Duplicate layer file: '+layer.file);
        named.add(layer.file);
        const text=isolateSvgElement(source,mapping,layer);
        if(text)await write(layer.file,text);
        else missing2D.push(layer.id);
      }
    }
    const base=CONTROLLERS.find(m=>m.id===layout.modelId);
    const physical=(layout.availability==='native'||layout.availability==='3d-only')&&isLicensedModel(base);
    let rig=null,stats=null,source3D=null,bindings;
    if(physical){
      const presented=controllerPresentationModel(base);
      source3D=presented.assetId||presented.id;
      const infoFile='assets/'+source3D+'/info.json';
      const infoBytes=await readFile(path.join(sourceRoot,infoFile));
      sources[infoFile]=digest(infoBytes);
      const info=JSON.parse(infoBytes);
      for(const part of info.parts.filter(x=>x.visible!==false)){
        const file='assets/'+source3D+'/'+part.filename;
        sources[file]=digest(await readFile(path.join(sourceRoot,file)));
      }
      rig=await loadNativeRig(presented,reader);
      try{
        prepareGenericCenterControls(rig);
        const output=encodeControllerGlb(rig,layout.id);
        stats=output.stats;
        const motion=describeRigMotions(rig);
        const parts=rig.parts.map(p=>({
          file:p.file,node:output.partNodes[p.file],
          role:p.holder.userData.role,control:p.holder.userData.control,
          parent:(rig.parts.find(q=>q.holder===p.holder.parent)?.file)||null,
          pivot:p.holder.position.toArray(),rotation:p.holder.quaternion.toArray(),
          sourceIndex:p.holder.userData.sourceIndex,
          motion:motion.get(p.holder)||null,
          physicalSource:p.holder.userData.reusedPhysicalCapFrom||source3D
        }));
        bindings=buildControlBindings(mapping||{id:layout.id,layers:[]},parts);
        await write('model.glb',output.glb);
        await write('rig.json',json({
          schemaVersion:1,id:layout.id,modelId:base.id,sourceModelId:source3D,
          rootNode:'controller__'+layout.id,sourceUnits:'native OBJ normalized to 4.05 maximum extent',
          geometry:stats,parts,controls:bindings.controls,
          motionPolicy:'Source pivots and original mechanics; analog control amounts 0..1; sticks X/Y -1..1',
          materials:{sourceColors:true,markings:'external source SVG mask / Qt CustomMaterial',
            ghost:'runtime material shader, not baked into GLB'},
          nativeQtValidated:false
        }));
      }finally{disposeNativeRig(rig);}
    }else bindings=buildControlBindings(mapping||{id:layout.id,layers:[]});
    await write('controls.json',json(bindings));
    const manifest={
      schemaVersion:1,id:layout.id,label:layout.name,has2D:!!layout.has2D,
      has3D:!!physical,availability:layout.availability,sourceModelId:source3D,
      format2D:layout.has2D?'source.svg + mapping.json + generated elements + controls.json':null,
      format3D:physical?'glTF 2.0 binary GLB with named nodes + rig.json':null,
      runtime2D:'Qt QPainter/QSvgRenderer prepared atlas, not SVG render on every frame',
      runtime3D:physical?'Balsam Qt Mesh/QML pre-import preferred; Qt 6.12 RuntimeLoader for development':null,
      controlContract:'canonical GamepadState v1; one host input, separate 2D/3D render rules',
      playerIndex:'provider-only; unknown is null; browser Gamepad.index is not player index',
      licensing:{svg:mapping?.license?.spdx||null,
        svgCopyright:mapping?.license?.copyright||null,
        mesh:physical?'MIT (licensed 3dco+ / Xbox One source)':null,
        separateSourceLicenses:true},
      missing2DElements:missing2D,geometry:stats,
      sourceHashes:sources,fileHashes:hashes,
      nativeQtValidated:false
    };
    await writeFile(path.join(dir,'manifest.json'),json(manifest));
    catalog.push({id:layout.id,label:layout.name,availability:layout.availability,
      has2D:manifest.has2D,has3D:manifest.has3D,
      controls:bindings.controls.length,pack:layout.id+'/manifest.json',
      svgLicense:manifest.licensing.svg,meshLicense:manifest.licensing.mesh});
  }
  await writeFile(path.join(out,'catalog.json'),json({schemaVersion:1,packs:catalog}));
  return {directory:out,catalog};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const argv=process.argv.slice(2),readOpt=name=>{
    const i=argv.indexOf(name);return i<0?null:argv[i+1];
  };
  const models=readOpt('--models')?.split(',').map(s=>s.trim()).filter(Boolean)||null;
  const {directory,catalog}=await buildControllerPacks({
    destination:readOpt('--out')||undefined,modelIds:models});
  console.log('Controller packs: '+catalog.packs.length+' generated at '+directory);
  console.table(catalog.packs.map(({id,has2D,has3D,controls,svgLicense})=>({id,has2D,has3D,controls,svgLicense})));
}
