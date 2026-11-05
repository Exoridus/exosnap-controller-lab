import { inspectObjText } from './mesh-validation.js';
import { CONTROLLERS, remoteAssetMirrors } from './models.js';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const dir=path.join(root,'assets');
const requested=process.argv.slice(2);
const models=requested.length?CONTROLLERS.filter(x=>requested.includes(x.id)):CONTROLLERS;
if(!models.length){console.error('No matching model. Available:',CONTROLLERS.map(x=>x.id).join(', '));process.exitCode=1;process.exit();}
await mkdir(dir,{recursive:true});
let existing=[];
try {existing=JSON.parse(await readFile(path.join(dir,'index.json'),'utf8')).models||[];}catch{}
async function fetchRetry(urls,{mesh=false}={}){
  let last;
  for(const url of urls){
    for(let attempt=0;attempt<2;attempt++){
      try {
        const response=await fetch(url,{signal:AbortSignal.timeout(40000),cache:attempt?'reload':'default'});
        if(!response.ok)throw new Error(`HTTP ${response.status} from ${url}`);
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.byteLength<60)throw new Error(`Unexpectedly small file: ${url}`);
        if(mesh){const report=inspectObjText(bytes.toString('utf8'));if(!report.valid)throw new Error(`${report.reason}: ${url}`);}
        return bytes;
      }catch(e){last=e;if(attempt===0)await new Promise(r=>setTimeout(r,650));}
    }
  }
  throw last||new Error('All source hosts failed');
}
for(const model of models){
  const folder=path.join(dir,model.id);await mkdir(folder,{recursive:true});
  let files=model.parts;
  let manifestBytes;
  if(model.manifest){
    try{
      manifestBytes=await fetchRetry(remoteAssetMirrors(model,'info.json'));
      const info=JSON.parse(manifestBytes.toString('utf8'));
      files=info.parts.filter(p=>p.visible!==false&&typeof p.filename==='string'&&/^[\w.-]+\.obj$/i.test(p.filename)).map(p=>p.filename);
      if(!files.length)throw new Error('Source manifest contains no OBJ parts');
    }catch(e){console.error(`Could not load manifest for ${model.name}:`,e.message);process.exitCode=1;continue;}
  }
  console.log(`\n${model.name}: ${files.length} real OBJ meshes (${model.source})`);
  let cursor=0,completed=0;
  const errors=[];
  async function worker(){
    while(cursor<files.length){
      const file=files[cursor++];const output=path.join(folder,file);
      try {
        let exists=false;
        try{
          if((await stat(output)).size>100){
            const report=inspectObjText(await readFile(output,'utf8'));
            exists=report.valid;
          }
        }catch{}
        if(!exists)await writeFile(output,await fetchRetry(remoteAssetMirrors(model,file),{mesh:true}));
      }catch(e){errors.push({file,message:e.message});}
      completed++;
      process.stdout.write(`\r${completed}/${files.length} files  `);
    }
  }
  await Promise.all(Array.from({length:Math.min(6,files.length)},()=>worker()));
  if(errors.length){
    console.error(`\n${errors.length} missing file(s); local cache not activated for ${model.name}.`);
    for(const e of errors)console.error(`  ${e.file}: ${e.message}`);
    existing=existing.filter(x=>x!==model.id);
    process.exitCode=1;
  }else{
    if(manifestBytes)await writeFile(path.join(folder,'info.json'),manifestBytes);
    if(!existing.includes(model.id))existing.push(model.id);
    console.log(`\n${model.name} available locally.`);
  }
  await writeFile(path.join(dir,'index.json'),JSON.stringify({models:existing,downloadedAt:new Date().toISOString()},null,2));
}
console.log('\nDone. Run start.cmd or npm start.');
