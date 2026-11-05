import {writeFile,mkdir} from 'node:fs/promises';
import {PBR_VARIANTS,HERO_VARIANTS,resolvePbrRecipe,resolveHeroRecipe,qtQuickDescriptor} from '../pbr-recipes.js';
import {fileURLToPath} from 'node:url';
const target=new URL('../qt-quick3d-port/pbr-reference-recipes.json',import.meta.url);
await mkdir(fileURLToPath(new URL('../qt-quick3d-port/',import.meta.url)),{recursive:true});
const snapshots=[...HERO_VARIANTS,...PBR_VARIANTS].flatMap(v=>[0,.5,.7,1].map(t=>{
 const recipe=HERO_VARIANTS.some(hero=>hero.key===v.key)?resolveHeroRecipe(v.key,t):resolvePbrRecipe(v.key,t);
 return {key:v.key,mix:t,three:recipe,qt:qtQuickDescriptor(recipe)};
}));
await writeFile(target,JSON.stringify({
 schema:'exosnap.three-qt-pbr.v40',normalization:{max3DExtent:4.05,cameraFovDegrees:35},
 notes:['These recipes share material and source-space light positions, not calibrated brightness units.',
   'Qt mesh content must be imported from the original OBJ hierarchy.',
   'Current four Hero looks require a light/dark/mixed screen-space alpha-edge compositor; port silhouette-composite.js shader to Qt Quick rather than assuming default QML materials match.',
   'Original PlayStation face-button glyphs are two-triangle texture decals placed on source geometry.'],
 snapshots
},null,2)+'\n');
console.log(`Exported ${snapshots.length} real PBR recipes (including four v40 looks and archived A–H studies)`);
