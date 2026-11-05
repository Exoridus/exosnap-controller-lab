#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const origin=new URL('../docs/3d-source-candidates.json',import.meta.url);
export const ACCEPTED_LICENSES=new Set(['MIT','CC0-1.0','CC-BY-4.0']);
export const SOURCE_STATUSES=new Set(['approved-in-repo','candidate','discovery','blocked']);
export function validateSourceRegistry(index){
 if(!index||index.schemaVersion!==1||!Array.isArray(index.candidates))throw new Error('Invalid 3D source registry');
 const ids=new Set();
 for(const item of index.candidates){
  if(!item.id||ids.has(item.id))throw new Error('Missing or duplicate source candidate ID');
  ids.add(item.id);
  if(!SOURCE_STATUSES.has(item.status)||typeof item.sourceUrl!=='string'||!/^https:\/\//.test(item.sourceUrl)||
     typeof item.licenseEvidenceUrl!=='string'||!/^https:\/\//.test(item.licenseEvidenceUrl)||
     !Array.isArray(item.layoutIds)||!item.layoutIds.length||typeof item.license!=='string'||
     typeof item.assetSpecific!=='boolean'||typeof item.mayAutoPublish!=='boolean'||!item.note)
    throw new Error('Incomplete 3D source candidate metadata: '+item.id);
  if(item.mayAutoPublish&&(!ACCEPTED_LICENSES.has(item.license)||item.status!=='approved-in-repo'||!item.assetSpecific))
    throw new Error('Uncleared source marked for automatic publication: '+item.id);
  if(item.status==='discovery'&&item.assetSpecific)throw new Error('Gallery search is not an individual asset: '+item.id);
  if(item.status==='blocked'&&item.mayAutoPublish)throw new Error('Blocked source cannot publish: '+item.id);
 }
 return {records:ids.size,approved:index.candidates.filter(x=>x.mayAutoPublish).length,
  blocked:index.candidates.filter(x=>x.status==='blocked').length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const filename=process.argv[2]||fileURLToPath(origin);
 const result=validateSourceRegistry(JSON.parse(await readFile(filename,'utf8')));
 console.log('3D source provenance index validated:',result);
}
