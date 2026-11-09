import { BufferGeometry, EdgesGeometry, Matrix4 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Returns caller-owned contour geometry in root-local coordinates, leaving source meshes intact.
export function createHousingContourGeometry(meshes,root,thresholdAngle=63){
  if(!meshes.length)return null;
  root.updateWorldMatrix(true,true);
  const rootInverse=new Matrix4().copy(root.matrixWorld).invert();
  const pieces=meshes.map(mesh=>{
    mesh.updateWorldMatrix(true,false);
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',mesh.geometry.getAttribute('position').clone());
    if(mesh.geometry.index)geometry.setIndex(mesh.geometry.index.clone());
    geometry.applyMatrix4(new Matrix4().multiplyMatrices(rootInverse,mesh.matrixWorld));
    if(!geometry.index)return geometry;
    const expanded=geometry.toNonIndexed();
    geometry.dispose();
    return expanded;
  });
  const combined=mergeGeometries(pieces);
  // UV and normal seams must not keep coincident housing positions disconnected.
  const welded=mergeVertices(combined,1e-4);
  const result=new EdgesGeometry(welded,thresholdAngle);
  for(const piece of pieces)piece.dispose();
  combined.dispose();
  welded.dispose();
  return result;
}
