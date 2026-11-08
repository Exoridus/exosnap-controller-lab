#!/usr/bin/env node
// Release gate: only the original MIT geometry may be deployed.
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CONTROLLERS,APPROVED_3D_MODEL_IDS,GENERATED_3D_MODEL_IDS,isLicensedModel} from '../models.js';
import {inspectObjText} from '../mesh-validation.js';
const assets=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets');
let total=0,bytes=0;
for(const id of APPROVED_3D_MODEL_IDS){
 const model=CONTROLLERS.find(x=>x.id===id);
 if(!isLicensedModel(model)||!model.manifest||model.source!=='co')throw Error('Uncleared source: '+id);
 const folder=path.join(assets,id);
 const info=JSON.parse(await readFile(path.join(folder,'info.json'),'utf8'));
 const names=info.parts.filter(x=>x.visible!==false&&typeof x.filename==='string').map(x=>x.filename);
 if(!names.length||new Set(names).size!==names.length)throw Error('Invalid model manifest: '+id);
 for(const filename of names){
  if(!/^[\w.-]+\.obj$/i.test(filename))throw Error('Unexpected OBJ filename: '+filename);
  const file=path.join(folder,filename);
  const contents=await readFile(file,'utf8'),result=inspectObjText(contents);
  if(!result.valid)throw Error('Invalid OBJ '+id+'/'+filename+': '+result.reason);
  total++;bytes+=(await stat(file)).size;
 }
}
for(const entry of await readdir(assets,{withFileTypes:true})){
 if(entry.isDirectory()&&![...APPROVED_3D_MODEL_IDS,...GENERATED_3D_MODEL_IDS].includes(entry.name))throw Error('Uncleared 3D asset folder '+entry.name);
}
for(const id of GENERATED_3D_MODEL_IDS){
 const folder=path.join(assets,id);const info=JSON.parse(await readFile(path.join(folder,'info.json'),'utf8'));
 if(info.source!=='ExoSnap segmented Generic Pro; profile from approved native SVG'||info.license!=='MIT AND CC0-1.0')throw Error('Unapproved generated model provenance');
 const profile=JSON.parse(await readFile(path.join(folder,'source-profile.json'),'utf8'));
 const source=await readFile(path.join(assets,'..',profile.source));
 if(createHash('sha256').update(source).digest('hex')!==info.profileSha256||profile.sha256!==info.profileSha256)throw Error('Generated profile provenance mismatch');
 for(const p of info.parts){if(!/^[\w.-]+\.obj$/.test(p.filename))throw Error('Invalid generated OBJ filename');
 const report=inspectObjText(await readFile(path.join(folder,p.filename),'utf8'));
 if(!report.valid)throw Error('Invalid original model part: '+id+'/'+p.filename);
 total++;bytes+=(await stat(path.join(folder,p.filename))).size;}
}
console.log('Verified '+total+' cleared OBJ meshes (Larf MIT + Generic MIT/CC0 profile) across '+APPROVED_3D_MODEL_IDS.length+' controller families ('+(bytes/1024/1024).toFixed(2)+' MiB)');
