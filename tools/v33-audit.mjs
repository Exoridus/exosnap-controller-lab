// Runs without browser/GPU. Its expected draw counts are MODEL estimates, not
// substitutes for the live WebGL `renderer.info.render.calls` counters.
import {readFile,writeFile} from 'node:fs/promises';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {shareIdenticalStickGeometry,optimizeStaticHousing,instantiateStickPairs} from '../pbr-optimizer.js';
import {poseForStickDemo} from '../stick-activity.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
const root=new URL('../',import.meta.url);
const read=async file=>readFile(new URL(file.replace(/^\.\//,''),root),'utf8');
const rig=await loadNativeRig(CONTROLLERS[0],read);
const originalMeshes=rig.meshes.filter(m=>m.visible).length;
const originalTriangles=rig.meshes.filter(m=>m.visible).reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
const dedup=shareIdenticalStickGeometry(rig);
const staticBatches=optimizeStaticHousing(rig);
const instances=instantiateStickPairs(rig);
const pose=poseForStickDemo('neutral');
applyPbrRecipeToRig(rig,resolveHeroRecipe('ghost',.65),{...pose,allPressed:false});
const optimizedMeshes=rig.meshes.filter(m=>m.visible).length;
const optimizedTriangles=rig.meshes.filter(m=>m.visible).reduce((n,m)=>n+((m.geometry.index?.count||m.geometry.attributes.position.count)/3)*(m.isInstancedMesh?m.count:1),0);
const report={
 source:'Actual DualSense OBJ manifest + Three.js model parsing (not measured GPU calls)',
 original:{visibleMeshes:originalMeshes,visibleTriangles:originalTriangles,directThreeViewDrawsEstimated:originalMeshes*3},
 optimized:{visibleMeshes:optimizedMeshes,visibleTriangles:optimizedTriangles,
   sharedRenderSourceCallsEstimated:optimizedMeshes,sharedRenderCompositeCallsEstimated:3,
   threeViewTotalCallsEstimated:optimizedMeshes+3},
 savings:{staticMeshes:staticBatches.savedCalls,instancedStickPairs:instances.savedCalls,sharedStickGeometryBytes:dedup.savedBytes},
 blockers:['Real WebGL draw calls, visual alpha parity, native Qt GPU measurements still need a WebGL-/Qt-capable runtime'],
};
const target=new URL('../evidence/v33/audit.json',import.meta.url);
await writeFile(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
disposeNativeRig(rig);
