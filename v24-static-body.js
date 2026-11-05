// Display-side static-body batching. No Boolean union or loss of controller openings.
// Movable controls, stick rigs and child-owned animation remain separate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { isStaticBodyRole, staticBodyBucket } from './v24-policy.js';

export function bakeStaticBody({subgroups, holders, createMaterial, installDepthMask, disposeContours}){
  const original = new Set(holders);
  const retired = new Set();
  const added=[];
  const stats={sourceMeshes:0,bodyMeshes:0,sourceTriangles:0,bodyTriangles:0,groups:0};
  for(const [sourceId,subgroup] of subgroups){
    subgroup.updateWorldMatrix(true,true);
    const inv=new THREE.Matrix4().copy(subgroup.matrixWorld).invert();
    const buckets=new Map();
    for(const holder of holders){
      if(holder.userData?.sourceModel?.id!==sourceId)continue;
      const role=holder.userData?.role;
      const hasDynamicParent=Boolean(holder.parent && original.has(holder.parent));
      const hasChildHolder=holder.children.some(child=>original.has(child));
      if(!isStaticBodyRole(role,holder.userData?.control,hasDynamicParent)||hasChildHolder)continue;
      const meshes=holder.userData.meshes||[];
      if(!meshes.length || meshes.some(m=>!m.geometry?.getAttribute('position')))continue;
      const bucket=staticBodyBucket(holder.userData.file);
      if(!buckets.has(bucket))buckets.set(bucket,[]);
      for(const mesh of meshes){
        mesh.updateWorldMatrix(true,false);
        const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
        const simple=new THREE.BufferGeometry();
        simple.setAttribute('position',source.getAttribute('position').clone());
        if(source.getAttribute('normal'))simple.setAttribute('normal',source.getAttribute('normal').clone());
        else simple.computeVertexNormals();
        simple.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld));
        stats.sourceMeshes++;
        stats.sourceTriangles+=simple.getAttribute('position').count/3;
        buckets.get(bucket).push({simple,holder});
        source.dispose();
      }
      retired.add(holder);
    }
    for(const [bucket,group] of buckets){
      if(!group.length)continue;
      const geometry=mergeGeometries(group.map(x=>x.simple),false);
      for(const x of group)x.simple.dispose();
      if(!geometry)continue;
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const originalHolder=group[0].holder;
      const file=originalHolder.userData.file;
      const model=originalHolder.userData.sourceModel;
      const holder=new THREE.Group();holder.name=`static-solid-${bucket}`;
      holder.userData={file,sourceModel:model,meta:null,role:'housing',control:null,visualControl:null,
        shell:true,bakedStatic:true,staticBucket:bucket,mergedHousingContour:true,meshes:[],base:new THREE.Vector3()};
      const material=createMaterial(file,model,originalHolder.userData.meta);
      const mesh=new THREE.Mesh(geometry,material);mesh.name=`merged-${bucket}`;
      mesh.userData.control=null;
      holder.add(mesh);
      holder.userData.meshes.push(mesh);
      installDepthMask(mesh,'housing');
      subgroup.add(holder);added.push(holder);
      stats.bodyMeshes++;
      stats.bodyTriangles+=(geometry.index?.count||geometry.getAttribute('position').count)/3;
      stats.groups++;
    }
  }
  for(const holder of retired){
    holder.parent?.remove(holder);
    holder.traverse(obj=>{
      if(obj.userData?.depthMask)return;
      if(obj.userData?.edge)disposeContours(obj.userData.edge);
      if(obj.isMesh){obj.geometry?.dispose();obj.material?.dispose();}
    });
  }
  return {holders:holders.filter(x=>!retired.has(x)).concat(added),retired,stats};
}
