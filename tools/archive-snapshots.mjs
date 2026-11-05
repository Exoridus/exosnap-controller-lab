#!/usr/bin/env node
// Copies VERIFIED browser captures into a versioned Git branch, never invented images.
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const arg=name=>{const idx=args.indexOf(name);if(idx<0||!args[idx+1])throw Error(`${name} required`);return args[idx+1]};
export async function archiveSnapshots(captureDir,archiveDir,repository,commit){
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))throw Error('Invalid GitHub repository');
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Expected a full 40-character Git commit SHA');
  const manifest=JSON.parse(await readFile(path.join(captureDir,'capture-manifest.json'),'utf8'));
  if(manifest.revision!==commit)throw Error('Capture was produced for a different source revision');
  const targets=['overview-neutral.png','overview-pressed.png'];
  if(manifest.images.some(image=>image.file==='gamecube-neutral.png'))targets.push('gamecube-neutral.png');
  if(targets.some(name=>!manifest.images.some(x=>x.file===name&&x.bytes>=40000)))throw Error('Both verified screenshots are required');
  for(const name of targets){
    const record=manifest.images.find(x=>x.file===name);
    const bytes=await readFile(path.join(captureDir,name));
    if(bytes.length!==record.bytes||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||createHash('sha256').update(bytes).digest('hex')!==record.sha256)
      throw Error(`Screenshot integrity failed: ${name}`);
  }
  const dir=path.join(archiveDir,'snapshots',commit);
  await mkdir(dir,{recursive:true});
  for(const name of targets)await copyFile(path.join(captureDir,name),path.join(dir,name));
  await copyFile(path.join(captureDir,'capture-manifest.json'),path.join(dir,'capture-manifest.json'));
  let index=[];
  try{index=JSON.parse(await readFile(path.join(archiveDir,'index.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!Array.isArray(index))throw Error('Visual history index must be an array');
  const root=`https://raw.githubusercontent.com/${repository}/visual-history/snapshots/${commit}/`;
  const record={sha:commit,capturedAt:manifest.capturedAt,neutralUrl:root+'overview-neutral.png',pressedUrl:root+'overview-pressed.png',manifestUrl:root+'capture-manifest.json'};
  if(targets.includes('gamecube-neutral.png'))record.gamecubeUrl=root+'gamecube-neutral.png';
  index=[record,...index.filter(x=>x.sha!==commit)].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
  await writeFile(path.join(archiveDir,'index.json'),JSON.stringify(index,null,2)+'\n');
  return record;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const record=await archiveSnapshots(path.resolve(arg('--capture')),path.resolve(arg('--archive')),arg('--repo'),arg('--sha'));
  console.log(`Archived source ${record.sha} at ${record.neutralUrl}`);
}
