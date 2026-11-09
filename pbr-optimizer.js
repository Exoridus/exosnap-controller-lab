// Conservative, reversible optimization of source-authored OBJ geometry.
// Static housing batching and exact source control buffer reuse.
// Similar-looking controls are kept distinct unless every attribute is proven.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {isHousingRole} from './model-semantics.js';
const triangles=geometry=>(geometry.index?.count||geometry.attributes.position.count)/3;
const STICK_ROLES=new Set(['stick-stem','stick-cap','stick-pivot']);
const CONTROL_ROLES=new Set([...STICK_ROLES,'stick-base','button','trigger','paddle','touch-surface']);
const IDENTITY={axes:[0,1,2],signs:[1,1,1]};
// Only proper signed axis rotations: determinant +1 preserves authored winding.
// No epsilon, scaling, vertex regeneration or triangle reordering is permitted.
const ROTATIONS=[IDENTITY];
for(const axes of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
  let inversions=0;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(axes[i]>axes[j])inversions++;
  for(const x of [1,-1])for(const y of [1,-1])for(const z of [1,-1]){
    const signs=[x,y,z];
    if((inversions%2?-1:1)*x*y*z!==1)continue;
    if(axes.every((a,i)=>a===i)&&signs.every(s=>s===1))continue;
    ROTATIONS.push({axes,signs});
  }
}
function sameArray(a,b){
  if(a.constructor!==b.constructor||a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
}
function geometryTransform(a,b,allowTransforms){
  if(!a||!b||Boolean(a.index)!==Boolean(b.index)||a.morphTargetsRelative!==b.morphTargetsRelative)return null;
  if(Object.keys(a.morphAttributes).length||Object.keys(b.morphAttributes).length)return null;
  if(a.drawRange.start!==b.drawRange.start||a.drawRange.count!==b.drawRange.count)return null;
  if(JSON.stringify(a.groups)!==JSON.stringify(b.groups))return null;
  const names=Object.keys(a.attributes).sort();
  if(names.join('|')!==Object.keys(b.attributes).sort().join('|')||!a.attributes.position?.count)return null;
  for(const name of names){
    const x=a.attributes[name],y=b.attributes[name];
    if(x.isInterleavedBufferAttribute||y.isInterleavedBufferAttribute||x.itemSize!==y.itemSize||x.count!==y.count||
      x.normalized!==y.normalized||x.gpuType!==y.gpuType||x.array.constructor!==y.array.constructor)return null;
    if(!['position','normal'].includes(name)&&!sameArray(x.array,y.array))return null;
  }
  if(a.index&&!sameArray(a.index.array,b.index.array))return null;
  const position=a.attributes.position;
  if(position.itemSize!==3||names.some(n=>n==='normal'&&a.attributes[n].itemSize!==3))return null;
  for(const rotation of allowTransforms?ROTATIONS:[IDENTITY]){
    const {axes,signs}=rotation;
    const offset=axes.map((axis,j)=>b.attributes.position.array[j]-signs[j]*position.array[axis]);
    // An exact identity is safe even with additional vector/skin attributes;
    // transformed tangent/skin attributes need a separate proof, so decline.
    const transformed=rotation!==IDENTITY||offset.some(v=>v!==0);
    if(!allowTransforms&&transformed)continue;
    if(transformed&&(position.normalized||a.attributes.normal?.normalized))continue;
    if(transformed&&names.some(n=>!['position','normal','uv','uv1','uv2','color'].includes(n)))continue;
    let equal=true;
    for(const name of ['position','normal']){
      if(!a.attributes[name])continue;
      const x=a.attributes[name].array,y=b.attributes[name].array;
      for(let i=0;equal&&i<x.length;i+=3)for(let j=0;j<3;j++){
        if(signs[j]*x[i+axes[j]]+(name==='position'?offset[j]:0)!==y[i+j]){equal=false;break;}
      }
    }
    if(!equal)continue;
    const elements=new Array(16).fill(0);elements[15]=1;
    for(let j=0;j<3;j++){elements[axes[j]*4+j]=signs[j];elements[12+j]=offset[j];}
    return {matrix:new THREE.Matrix4().fromArray(elements),transformed};
  }
  return null;
}
function geometryStats(native){
  const geometries=new Set(native.meshes.map(m=>m.geometry).filter(Boolean)),buffers=new Set();
  for(const geometry of geometries){
    for(const attribute of [...Object.values(geometry.attributes),geometry.index,
      ...Object.values(geometry.morphAttributes).flat()].filter(Boolean)){
      buffers.add(attribute.isInterleavedBufferAttribute?attribute.data:attribute);
    }
  }
  return {geometries:geometries.size,bytes:[...buffers].reduce((sum,buffer)=>sum+(buffer.array?.byteLength||0),0)};
}
function shareControlGeometry(native,roles,allowTransforms){
  const before=geometryStats(native),representatives=new Map(),matches=[];
  const candidates=native.meshes.filter(m=>!m.isInstancedMesh&&roles.has(m.userData.role));
  for(const mesh of candidates){
    const list=representatives.get(mesh.userData.role)||[];
    let matching=null,transform=null;
    for(const other of list){
      if(mesh.geometry===other.geometry){matching=other;break;}
      transform=geometryTransform(other.geometry,mesh.geometry,allowTransforms);
      if(transform){matching=other;break;}
    }
    if(matching&&mesh.geometry!==matching.geometry){
      const previous=mesh.geometry;
      if(transform.transformed){
        if(mesh.matrixAutoUpdate)mesh.updateMatrix();
        // Preserve the holder/pivot hierarchy. The source-to-target transform
        // belongs after the mesh's own existing local transform.
        mesh.matrix.multiply(transform.matrix);
        mesh.matrixAutoUpdate=false;mesh.matrixWorldNeedsUpdate=true;
      }
      mesh.geometry=matching.geometry;
      if(!native.meshes.some(m=>m.geometry===previous))previous.dispose();
      matches.push({source:matching.userData.sourceFile,target:mesh.userData.sourceFile,
        role:mesh.userData.role,transformed:transform.transformed});
    }else if(!matching)list.push(mesh);
    representatives.set(mesh.userData.role,list);
  }
  const after=geometryStats(native);
  return {pairs:matches.length,transformedPairs:matches.filter(m=>m.transformed).length,
    sourceMeshes:native.meshes.length,controlMeshes:candidates.length,uniqueGeometriesBefore:before.geometries,uniqueGeometriesAfter:after.geometries,
    bytesBefore:before.bytes,bytesAfter:after.bytes,savedBytes:before.bytes-after.bytes,savedCalls:0,matches};
}
export function shareIdenticalStickGeometry(native){
  return shareControlGeometry(native,STICK_ROLES,false);
}
// Source-authored controls may share immutable buffers while retaining their
// own pivots, materials and input state. Shared buffers do not save draw calls.
export function shareEquivalentControlGeometry(native){
  return shareControlGeometry(native,CONTROL_ROLES,true);
}
export function optimizeStaticHousing(native){
  native.group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(native.group.matrixWorld).invert();
  const groups=new Map();
  for(const m of native.meshes){
    if(!m.visible||!isHousingRole(m.userData.role)||!m.geometry?.attributes.position)continue;
    // Nintendo status LEDs are rasterized directly in original source-space
    // coordinates by the shell material. Never bake that mesh into a batch.
    if(m.userData.playerLedNativeSurface)continue;
    // Preserve the one-pass structural-region material instead of dropping its attribute.
    if(m.material.userData.rimSurface)continue;
    // Keep original source color and semantic role; no dynamic or stick part is batched.
    const key=`${m.userData.role}|${m.userData.sourceColor.getHexString()}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(m);
  }
  const batches=[];let savedCalls=0;
  for(const group of groups.values()){
    if(group.length<2)continue;
    const prepared=[];
    for(const mesh of group){
      const geo=mesh.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld));
      // BufferGeometryUtils demands matching attribute signatures.
      const simple=new THREE.BufferGeometry();
      simple.setAttribute('position',geo.getAttribute('position').clone());
      if(geo.getAttribute('normal'))simple.setAttribute('normal',geo.getAttribute('normal').clone());
      else simple.computeVertexNormals();
      if(geo.index)simple.setIndex(geo.index.clone());
      prepared.push(simple);geo.dispose();
    }
    const merged=mergeGeometries(prepared,false);
    prepared.forEach(g=>g.dispose());
    if(!merged)continue;
    const source=group[0];
    const batch=new THREE.Mesh(merged,source.material.clone());
    batch.name=`Static housing batch (${group.length} parts)`;
    batch.userData={...source.userData,sourceFile:`batch:${group.map(m=>m.userData.sourceFile).join('+')}`,sourceColor:source.userData.sourceColor.clone(),batchSourceFiles:group.map(m=>m.userData.sourceFile)};
    native.group.add(batch);
    for(const m of group)m.visible=false;
    native.meshes.push(batch);batches.push(batch);savedCalls+=group.length-1;
  }
  native.optimizedBatches=batches;
  return {savedCalls,batches:batches.length,triangles:batches.reduce((s,m)=>s+triangles(m.geometry),0)};
}

// One draw for each of the three genuinely identical L/R stick elements.
// Instance matrices preserve each original OBJ pivot / hierarchy. Independent
// final material states can force a lossless fallback to the source meshes.
export function instantiateStickPairs(native){
  if(native.stickInstances?.length)return {pairs:native.stickInstances.length,
    savedCalls:native.stickInstances.filter(g=>g.instance.visible).length};
  // Sharing geometry is a prerequisite; safe to repeat on already-shared pairs.
  shareIdenticalStickGeometry(native);
  native.group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(native.group.matrixWorld).invert();
  const instances=[];
  for(const role of ['stick-stem','stick-pivot','stick-cap']){
    const matched=native.meshes.filter(m=>m.userData.role===role&&m.visible&&/^(?:left|right)_/.test(m.userData.sourceFile));
    const left=matched.find(m=>m.userData.sourceFile.startsWith('left_'));
    const right=matched.find(m=>m.userData.sourceFile.startsWith('right_'));
    if(!left||!right||left.geometry!==right.geometry||!left.userData.sourceColor.equals(right.userData.sourceColor))continue;
    const instance=new THREE.InstancedMesh(left.geometry,left.material,2);
    instance.name=`L/R ${role} instances`;
    instance.userData={...left.userData,sourceColor:left.userData.sourceColor.clone(),stickInstance:true};
    instance.frustumCulled=false;
    const originals=[left,right];
    for(let i=0;i<originals.length;i++){
      const relative=new THREE.Matrix4().multiplyMatrices(inv,originals[i].matrixWorld);
      instance.setMatrixAt(i,relative);
      originals[i].visible=false;
    }
    instance.instanceMatrix.needsUpdate=true;
    native.group.add(instance);native.meshes.push(instance);
    instances.push({role,instance,originals});
  }
  native.stickInstances=instances;
  updateStickInstances(native);
  return {pairs:instances.length,savedCalls:instances.filter(g=>g.instance.visible).length};
}
// Compare renderer state directly; never serialize/read texture pixels. Textures
// and custom objects must be identical references unless they provide equals().
function sameMaterialValue(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||a.constructor!==b.constructor)return false;
  if(a.isTexture)return false;
  if(typeof a.equals==='function')return a.equals(b);
  if(Array.isArray(a))return a.length===b.length&&a.every((v,i)=>sameMaterialValue(v,b[i]));
  if(Object.getPrototypeOf(a)!==Object.prototype)return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameMaterialValue(a[k],b[k]));
}
function equivalentFinalMaterials(a,b){
  if(!a?.isMaterial||!b?.isMaterial)return false;
  if(a.onBeforeCompile!==b.onBeforeCompile||a.onBeforeRender!==b.onBeforeRender||
    a.customProgramCacheKey!==b.customProgramCacheKey)return false;
  const ignored=new Set(['uuid','name','version']);
  const keys=Object.keys(a).filter(k=>!ignored.has(k));
  return keys.length===Object.keys(b).filter(k=>!ignored.has(k)).length&&
    keys.every(k=>Object.hasOwn(b,k)&&sameMaterialValue(a[k],b[k]));
}
export function updateStickInstances(native,input){
  if(!native?.stickInstances?.length)return;
  native.group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(native.group.matrixWorld).invert();
  for(const group of native.stickInstances){
    const [left,right]=group.originals;
    const compatible=equivalentFinalMaterials(left.material,right.material)&&left.renderOrder===right.renderOrder&&
      left.layers.mask===right.layers.mask&&left.castShadow===right.castShadow&&left.receiveShadow===right.receiveShadow;
    group.instance.visible=compatible;
    for(let i=0;i<2;i++){
      const original=group.originals[i];original.visible=!compatible;
      if(compatible)group.instance.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inv,original.matrixWorld));
    }
    if(compatible){
      // The applicator has just resolved each original's final recipe/input
      // material. Use that actual material instead of a left-labelled clone.
      group.instance.material=left.material;
      group.instance.renderOrder=left.renderOrder;
      group.instance.layers.mask=left.layers.mask;
      group.instance.castShadow=left.castShadow;group.instance.receiveShadow=left.receiveShadow;
      group.instance.instanceMatrix.needsUpdate=true;
    }
  }
}
