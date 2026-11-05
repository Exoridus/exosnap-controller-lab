// Optional caps for incomplete legacy stick meshes. Complete source-authored
// assemblies retain their native surface joins, placement and pivot metadata.
import * as THREE from 'three';
import { stickProfile, capProfile } from './v24-policy.js';
import { MODEL_MECHANICS } from './model-mechanics.js';
export function parametricCapGeometry(modelId,sourceGeometry){
  // Authored caps can be an inset joined to a separate outer rubber wall.
  // Replacing that inset with a whole cap breaks its shared boundary.
  if(MODEL_MECHANICS[modelId]?.authoredCapAssembly)return null;
  const preset=stickProfile(modelId);if(!preset)return null;
  const bounds=new THREE.Box3().setFromBufferAttribute(sourceGeometry.getAttribute('position'));
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const radius=Math.max(size.x,size.z)*.5;
  if(radius<=1e-6)return null;
  const height=Math.max(size.y, radius*preset.height);
  const profile=capProfile(modelId,radius,height,bounds.max.y);
  const geometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),preset.segments);
  geometry.translate(center.x,0,center.z);
  geometry.computeVertexNormals();
  return geometry;
}
