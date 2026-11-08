// Read only the installed, licensed/generated source rigs. No asset rewriting.
import {readFile} from 'node:fs/promises';
import {CONTROLLERS,isLicensedModel} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {shareEquivalentControlGeometry,instantiateStickPairs} from '../pbr-optimizer.js';
const read=url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
const report=[];
for(const model of CONTROLLERS.filter(isLicensedModel)){
 const rig=await loadNativeRig(model,read);
 try{
  const meshCount=rig.meshes.length;
  const shared=shareEquivalentControlGeometry(rig);
  const instances=instantiateStickPairs(rig);
  report.push({model:model.id,sourceMeshes:meshCount,triangles:rig.triangles,...shared,
   restingStickInstancePairs:instances.pairs,restingStickSavedCalls:instances.savedCalls});
 }finally{disposeNativeRig(rig);}
}
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.table(report.map(r=>({model:r.model,meshes:r.sourceMeshes,triangles:r.triangles,
  uniqueBefore:r.uniqueGeometriesBefore,uniqueAfter:r.uniqueGeometriesAfter,shared:r.pairs,
  transformed:r.transformedPairs,savedBytes:r.savedBytes,geometrySavedCalls:r.savedCalls,
  restingStickSavedCalls:r.restingStickSavedCalls})));
 for(const row of report)console.log(`${row.model}: ${row.matches.map(m=>`${m.source} → ${m.target}${m.transformed?' (exact transform)':''}`).join('; ')||'no exact match'}`);
}
