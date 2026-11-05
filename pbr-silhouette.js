// Shaderless dual-tone silhouette. Same source BufferGeometry, no CPU geometry cloning.
// Draw only the outside-facing backs of the static visible body. No floor shadow.
import * as THREE from 'three';
import {isHousingRole} from './model-semantics.js';
export function prepareSilhouette(native){
  if(!native?.meshes)return;
  if(native.silhouetteLayers)return;
  native.silhouetteLayers=[];
  const housing=native.meshes.filter(m=>m.visible&&isHousingRole(m.userData.role)&&m.geometry?.attributes?.position);
  for(const mesh of housing){
    const name=String(mesh.userData.sourceFile||'');
    if(!/shell|body|housing|batch:/i.test(name))continue;
    for(const [scale,color,opacity,order] of [[1.018,'#23384a',.78,8],[1.009,'#d0e6f7',.8,9]]){
      const mat=new THREE.MeshBasicMaterial({color,side:THREE.BackSide,transparent:true,opacity,
        depthTest:true,depthWrite:false,toneMapped:false});
      const outline=new THREE.Mesh(mesh.geometry,mat);
      outline.name=`Silhouette ${scale}`;
      outline.scale.setScalar(scale);
      outline.frustumCulled=false;
      outline.renderOrder=order;
      outline.visible=false;
      mesh.add(outline);native.silhouetteLayers.push(outline);
    }
  }
}
export function updateSilhouette(native,recipe){
  if(!native?.silhouetteLayers)return;
  const visible=Boolean(recipe?.silhouette?.enabled);
  for(const layer of native.silhouetteLayers)layer.visible=visible;
}
export function disposeSilhouette(native){
  if(!native?.silhouetteLayers)return;
  for(const layer of native.silhouetteLayers){layer.parent?.remove(layer);layer.material?.dispose();}
  native.silhouetteLayers=[];
}
