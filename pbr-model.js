// Original OBJ model rig for the PBR comparison gallery. No proxy meshes,
// synthetic controller silhouettes, duplicated rigs, or vertex regeneration.
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {modelPartSemantics} from './model-semantics.js';
import {controllerPartTransform} from './thumbstick-geometry.js';
import {frontFaceTransform} from './model-orientation.js';
import {makeControlGlyph} from './control-glyphs.js';
import {disposeSilhouette} from './pbr-silhouette.js';

async function httpText(url){
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw new Error(`OBJ cache missing: ${url} (HTTP ${response.status}); run npm run download-assets -- MODEL_ID`);
  return response.text();
}
const assetPath=(model,file)=>`./assets/${encodeURIComponent(model.id)}/${encodeURIComponent(file)}`;
export async function loadNativeRig(model, readText=httpText){
  if(!model?.id||!model?.source)throw Error('Expected a known native OBJ model');
  const loader=new OBJLoader();
  let specs;
  if(model.manifest){
    const data=JSON.parse(await readText(assetPath(model,'info.json')));
    if(!Array.isArray(data.parts))throw new Error('Source manifest has no parts[]');
    specs=data.parts.map((meta,index)=>({meta,index,file:meta.filename})).filter(x=>x.meta.visible!==false&&/^[\w.-]+\.obj$/i.test(x.file));
  }else{
    specs=model.parts.map((file,index)=>({meta:null,index,file}));
  }
  if(!specs.length)throw new Error('No model OBJ parts');
  if(new Set(specs.map(x=>x.file)).size!==specs.length)throw new Error('Duplicate OBJ filenames in manifest');
  // Read ALL model parts first: a missing part rejects the controller instead
  // of presenting a plausible but incomplete model with a floating joystick.
  const sources=await Promise.all(specs.map(async spec=>({...spec,text:await readText(assetPath(model,spec.file))})));
  const frame=frontFaceTransform(model.source);
  const normalized=new THREE.Group();normalized.name=`Original ${model.name}`;
  const rotated=new THREE.Group();rotated.rotation.set(frame.rotationX,frame.rotationY,0);
  normalized.add(rotated);
  const partMap=new Map(),parts=[],meshes=[];
  const baseFallback=new THREE.Color(model.color||'#9da7b1');
  for(const source of sources){
    const parsed=loader.parse(source.text);
    const holder=new THREE.Group();holder.name=source.file;
    const role=modelPartSemantics(source.file,model,source.meta);
    const sourceBounds=new THREE.Box3().setFromObject(parsed);
    const localCenter=sourceBounds.getCenter(new THREE.Vector3());
    const transform=controllerPartTransform(model.source,source.meta,localCenter.toArray());
    parsed.position.set(...transform.geometryOffset);
    holder.position.set(...transform.pivot);
    holder.userData={file:source.file,control:role.control||role.pickControl||null,role:role.role,sourceIndex:source.index};
    const originalColor=Array.isArray(source.meta?.color)&&source.meta.color.length>=3
      ? new THREE.Color().setRGB(...source.meta.color.slice(0,3),THREE.SRGBColorSpace)
      :baseFallback.clone();
    parsed.traverse(o=>{
      if(!o.isMesh)return;
      if(!o.geometry.attributes.position?.count)return;
      if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();
      o.userData.sourceFile=source.file;
      o.userData.role=role.role;
      o.userData.control=role.control||role.pickControl||null;
      o.userData.sourceColor=originalColor.clone();
      o.material=new THREE.MeshPhysicalMaterial({
        color:originalColor.clone(),roughness:.7,metalness:0,clearcoat:.1,
        transparent:true,opacity:1,depthTest:true,depthWrite:true,side:THREE.FrontSide
      });
      if(role.role==='touch-contact')o.visible=false;
      meshes.push(o);
    });
    if(parsed.children.every(c=>!c.isMesh && !c.children?.some(d=>d.isMesh)))throw new Error(`OBJLoader returned no triangles: ${source.file}`);
    const glyph=makeControlGlyph(source.file,model.source,sourceBounds,model);
    if(glyph)parsed.add(glyph);
    holder.add(parsed);partMap.set(source.index,holder);parts.push({file:source.file,meta:source.meta,holder});
  }
  for(const source of sources){
    const holder=partMap.get(source.index);
    const parentIndex=source.meta?.parent;
    if(Number.isInteger(parentIndex)&&parentIndex>=0){
      const parent=partMap.get(parentIndex);
      if(!parent||parent===holder)throw new Error(`Missing/invalid parent ${parentIndex} for ${source.file}`);
      parent.add(holder);
    }else rotated.add(holder);
  }
  normalized.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(normalized);
  const extent=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(extent.length())||extent.length()<.001)throw new Error('Invalid model bounding box');
  rotated.scale.setScalar(4.05/Math.max(extent.x,extent.y,extent.z));
  rotated.updateMatrixWorld(true);
  const center=new THREE.Box3().setFromObject(normalized).getCenter(new THREE.Vector3());
  rotated.position.sub(center);
  normalized.updateMatrixWorld(true);
  const triangles=meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
  if(triangles<10)throw new Error('Model does not contain real triangle geometry');
  return {group:normalized,meshes,parts,partCount:specs.length,triangles,model};
}
export function disposeNativeRig(native){
  if(!native)return;
  disposeSilhouette(native);
  const geometries=new Set(),materials=new Set(),instances=new Set();
  for(const m of native.meshes){
    if(m.isInstancedMesh)instances.add(m);
    if(m.geometry)geometries.add(m.geometry);
    for(const mat of [m.material,m.userData.pbrMaterial,m.userData.unlitMaterial])if(mat)materials.add(mat);
  }
  for(const hint of native.rearHintLines||[]){
    const fill=hint.userData.hiddenFill;
    fill?.parent?.remove(fill);fill?.material?.dispose();
    const outline=hint.userData.hiddenOutline;
    outline?.parent?.remove(outline);outline?.material?.dispose();
    hint.parent?.remove(hint);
    hint.geometry?.dispose();hint.material?.dispose();
  }
  native.group.traverse(o=>{
    if(!o.userData?.surfaceArtwork)return;
    o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();
  });
  // InstancedMesh owns GPU instanceMatrix/instanceColor attributes separately
  // from its shared geometry and material. Its dispose event releases those.
  for(const instance of instances)instance.dispose();
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  native.group.parent?.remove(native.group);
}
