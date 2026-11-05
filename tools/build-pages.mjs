#!/usr/bin/env node
import {cp, copyFile, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=process.argv.slice(2);
const arg=(name,otherwise)=>{const n=cli.indexOf(name);return n<0?otherwise:cli[n+1]};
const allowedDirs=['assets','backgrounds','references','reference-v23.2','licenses'];
const rootFiles=/\.(?:html|css|js)$/i;
export async function buildPages(source,dest,{captureDir=null,historyFile=null}={}){
  await mkdir(dest,{recursive:true});
  for(const file of await readdir(source,{withFileTypes:true})){
    if(!file.isFile())continue;
    if(rootFiles.test(file.name)||file.name==='THIRD_PARTY_NOTICES.md') await copyFile(path.join(source,file.name),path.join(dest,file.name));
  }
  for(const dir of allowedDirs)await cp(path.join(source,dir),path.join(dest,dir),{recursive:true});
  // Commit only the vetted, stable v40 browser modules; npm ci is for Node tests.
  await cp(path.join(source,'vendor/three'),path.join(dest,'node_modules/three'),{recursive:true});
  await writeFile(path.join(dest,'.nojekyll'),'');
  await mkdir(path.join(dest,'screenshots'),{recursive:true});
  if(captureDir){
    const shots=[['overview-neutral.png','latest.png'],['overview-pressed.png','pressed.png']];
    for(const [src,dst] of shots)await copyFile(path.join(captureDir,src),path.join(dest,'screenshots',dst));
    // Optional model-specific comparison, absent in older history builds.
    try{await copyFile(path.join(captureDir,'gamecube-neutral.png'),path.join(dest,'screenshots','gamecube.png'));}
    catch(error){if(error.code!=='ENOENT')throw error;}
    for(const [source,target] of [['generic-neutral.png','generic.png'],['generic-pressed.png','generic-pressed.png']]){
      try{await copyFile(path.join(captureDir,source),path.join(dest,'screenshots',target));}
      catch(error){if(error.code!=='ENOENT')throw error;}
    }
    await copyFile(path.join(captureDir,'capture-manifest.json'),path.join(dest,'screenshots','latest.json'));
  }
  if(historyFile){const text=await readFile(historyFile,'utf8'); JSON.parse(text);await writeFile(path.join(dest,'screenshots','history.json'),text);}
  else await writeFile(path.join(dest,'screenshots','history.json'),'[]\n');
  return dest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=path.resolve(arg('--out','dist'));
  await buildPages(root,out,{captureDir:arg('--capture',null),historyFile:arg('--history',null)});
  console.log(`Static GitHub Pages export: ${out}`);
}
