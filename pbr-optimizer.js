// Conservative, reversible optimization of source-authored OBJ geometry.
// It batches STATIC same-color housing only and shares truly byte-identical
// stick buffers; it deliberately does not invent identical face-button shapes.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {isHousingRole} from './model-semantics.js';
const triangles=geometry=>(geometry.index?.count||geometry.attributes.position.count)/3;
function equalGeometry(a,b){
  if(!a||!b||Boolean(a.index)!==Boolean(b.index))return false;
  const names=Object.keys(a.attributes).sort();
  if(names.join('|')!==Object.keys(b.attributes).sort().join('|'))return false;
  for(const name of names){
    const x=a.attributes[name],y=b.attributes[name];
    if(x.itemSize!==y.itemSize||x.count!==y.count||x.array.length!==y.array.length)return false;
    for(let i=0;i<x.array.length;i++)if(Math.abs(x.array[i]-y.array[i])>1e-6)return false;
  }
  if(a.index){const x=a.index.array,y=b.index.array;if(x.length!==y.length)return false;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;}
  return true;
}
export function shareIdenticalStickGeometry(native){
  const shared=new Map();let pairs=0,savedBytes=0;
  for(const mesh of native.meshes){
    if(!['stick-stem','stick-cap','stick-pivot'].includes(mesh.userData.role))continue;
    const role=mesh.userData.role;
    const list=shared.get(role)||[];
    const matching=list.find(other=>equalGeometry(other.geometry,mesh.geometry));
    if(matching){
      for(const attr of Object.values(mesh.geometry.attributes))savedBytes+=attr.array.byteLength;
      savedBytes+=mesh.geometry.index?.array.byteLength||0;
      mesh.geometry.dispose();mesh.geometry=matching.geometry;pairs++;
    }else list.push(mesh);
    shared.set(role,list);
  }
  return {pairs,savedBytes};
}
export function optimizeStaticHousing(native){
  native.group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(native.group.matrixWorld).invert();
  const groups=new Map();
  for(const m of native.meshes){
    if(!m.visible||!isHousingRole(m.userData.role)||!m.geometry?.attributes.position)continue;
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
// press alpha can force a lossless fallback to the two source meshes.
export function instantiateStickPairs(native){
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
    const instance=new THREE.InstancedMesh(left.geometry,left.material.clone(),2);
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
  return {pairs:instances.length,savedCalls:instances.length};
}
export function updateStickInstances(native,input){
  if(!native?.stickInstances?.length)return;
  const left=input.left,right=input.right;
  const sameAlpha=Boolean(left.click)===Boolean(right.click)&&Math.abs(left.activity-right.activity)<.035;
  native.group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(native.group.matrixWorld).invert();
  for(const group of native.stickInstances){
    group.instance.visible=sameAlpha;
    for(let i=0;i<2;i++){
      const original=group.originals[i];original.visible=!sameAlpha;
      if(sameAlpha){
        group.instance.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inv,original.matrixWorld));
      }
    }
    if(sameAlpha)group.instance.instanceMatrix.needsUpdate=true;
  }
}
