import {readFile, readdir, writeFile, mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditObj} from './obj-topology.js';
const root=dirname(fileURLToPath(import.meta.url));
const assets=join(root,'assets');
const output=process.argv[2]||join(root,'.workspace','v24-topology.json');
const report={kind:'source-topology',version:'v24',note:'OBJ-source numbers only; static batching does not decimate source triangles.',models:{}};
let models=[];try{models=(JSON.parse(await readFile(join(assets,'index.json'),'utf8')).models||[]);}catch{
  console.error('No cached assets. Run npm run download-assets first.');process.exit(2);
}
for(const model of models){
  const dir=join(assets,model);let names=[];
  try{names=(await readdir(dir)).filter(x=>/\.obj$/i.test(x));}catch{continue;}
  const parts={};let triangles=0,nonManifold=0;
  for(const name of names){
    const t=auditObj(await readFile(join(dir,name),'utf8'));
    parts[name]=t;triangles+=t.triangles;nonManifold+=t.nonManifoldEdges;
  }
  report.models[model]={meshCount:names.length,triangles,nonManifoldEdges:nonManifold,parts};
}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2));
console.log(`Source topology: ${Object.keys(report.models).length} models, ${output}`);
