#!/usr/bin/env node
// Release gate: only the original MIT geometry may be deployed.
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTROLLERS,APPROVED_3D_MODEL_IDS,isLicensedModel} from '../models.js';
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
 if(entry.isDirectory()&&!APPROVED_3D_MODEL_IDS.includes(entry.name))throw Error('Uncleared 3D asset folder '+entry.name);
}
console.log('Verified '+total+' original MIT OBJ meshes across '+APPROVED_3D_MODEL_IDS.length+' controller families ('+(bytes/1024/1024).toFixed(2)+' MiB)');
