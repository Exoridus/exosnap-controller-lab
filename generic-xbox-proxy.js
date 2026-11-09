// Only the LAB presentation changes: the separately licensed Xbox One OBJ rig
// is reused for Generic Pro while the 'generic' SVG/input layout stays authored.
// No duplicated source assets or changes to the genuine Xbox One selector.
import * as THREE from 'three';
import {CONTROLLERS} from './models.js';

const ORIGINAL='XboxOneClean';
export const GENERIC_SYSTEM_BUTTONS=Object.freeze([
  Object.freeze({key:'select',file:'back_button.obj',artwork:'view'}),
  Object.freeze({key:'home',file:'guide_button.obj',artwork:'home'}),
  Object.freeze({key:'start',file:'start_button.obj',artwork:'menu'}),
  Object.freeze({key:'share',file:'generic_share_button.obj',artwork:'share'}),
]);

export function controllerPresentationModel(model){
  if(model?.id!=='GenericPro')return model;
  const xbox=CONTROLLERS.find(m=>m.id===ORIGINAL);
  if(!xbox?.manifest||xbox.source!=='co')throw Error('Missing licensed Xbox One base rig');
  // Keep identity for input and 2D mapping, but source/asset location comes
  // from the existing original Xbox One family.
  return {...xbox,id:model.id,name:model.name,brand:'ExoSnap',
    family:'generic',assetId:xbox.id,modelSourceId:xbox.id,genericProxy:true};
}
function bounds(mesh){
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox;
}
function installFaceUV(mesh,key){
  const b=bounds(mesh),pos=mesh.geometry.getAttribute('position');
  const dx=b.max.x-b.min.x,dz=b.max.z-b.min.z;
  if(!(dx>.001&&dz>.001))throw Error('Invalid generic center button '+key);
  const array=new Float32Array(pos.count*2);
  for(let i=0;i<pos.count;i++){
    array[2*i]=(pos.getX(i)-b.min.x)/dx;
    array[2*i+1]=1-(pos.getZ(i)-b.min.z)/dz;
  }
  mesh.geometry.setAttribute('controllerMarkUv',new THREE.BufferAttribute(array,2));
  mesh.userData.artworkKey=key;
  mesh.userData.surfaceArtwork='button-material';
  mesh.userData.genericCenterControl=key;
}
function shellHeight(native,x,z){
  const shell=native.meshes.find(m=>m.userData.sourceFile==='top_shell.obj');
  if(!shell)throw Error('Generic Xbox base has no front shell');
  const frame=native.group.children[0],world=new THREE.Matrix4();
  native.group.updateMatrixWorld(true);
  world.copy(frame.matrixWorld);
  const ray=new THREE.Raycaster(
    new THREE.Vector3(x,3,z).applyMatrix4(world),
    new THREE.Vector3(0,-1,0).transformDirection(world),0,10);
  const hit=ray.intersectObject(shell,false).find(h=>h.face?.normal?.y>.30);
  if(!hit)throw Error('Generic Share position does not intersect original front shell');
  return hit.point.clone().applyMatrix4(world.clone().invert()).y;
}
export function prepareGenericCenterControls(native){
  if(native?.model?.id!=='GenericPro'||!native.model.genericProxy)return 0;
  if(native.genericCenterPrepared)return 4;
  const originals=GENERIC_SYSTEM_BUTTONS.slice(0,3).map(spec=>{
    const mesh=native.meshes.find(m=>m.userData.sourceFile===spec.file);
    if(!mesh||mesh.userData.control!==spec.key||!mesh.geometry)throw Error('Missing Xbox One center control '+spec.file);
    return mesh;
  });
  // The physical View/Home/Menu caps stay on their original source holes.
  // Only Share is a fourth shallow cap, reused from the original View mesh:
  // it sits below the middle row, as in our existing generic 2D diagram.
  const back=originals[0],geo=back.geometry.clone(),box=bounds(back);
  const old=box.getCenter(new THREE.Vector3()),z=-.105;
  const y=shellHeight(native,0,z)+.0175;
  geo.translate(-old.x,y-old.y,z-old.z);
  const share=new THREE.Mesh(geo,back.material.clone());
  share.name='Generic Share (reused Xbox One cap)';
  share.userData={...back.userData,sourceFile:'generic_share_button.obj',
    role:'button',control:'share',sourceColor:back.userData.sourceColor.clone()};
  const holder=new THREE.Group();
  holder.name='generic_share_button.obj';
  holder.userData={file:'generic_share_button.obj',control:'share',role:'button',
    sourceIndex:-1,reusedPhysicalCapFrom:'XboxOneClean/back_button.obj'};
  holder.add(share);
  native.group.children[0].add(holder);
  native.parts.push({file:holder.name,meta:null,holder});
  native.meshes.push(share);
  native.generatedPartCount=1;
  native.physicalRigSource='XboxOneClean';
  native.originalPartCount=native.partCount;
  native.partCount+=1;
  native.triangles+=(geo.index?.count||geo.attributes.position.count)/3;
  const neutral=new THREE.Color('#566675');
  for(let i=0;i<GENERIC_SYSTEM_BUTTONS.length;i++){
    const mesh=i<3?originals[i]:share,spec=GENERIC_SYSTEM_BUTTONS[i];
    mesh.userData.sourceColor.copy(neutral);
    mesh.material.color.copy(neutral);
    installFaceUV(mesh,spec.artwork);
  }
  // Neutral buttons are device-generic, not Xbox-green/red/blue/yellow.
  // Their actual A/B/X/Y legends still come from the source Generic SVG.
  const face=new THREE.Color('#46515d');
  for(const mesh of native.meshes){
    if(!/^[abxy]_button\.obj$/.test(mesh.userData.sourceFile||''))continue;
    mesh.userData.sourceColor.copy(face);
    mesh.material.color.copy(face);
  }
  native.genericCenterPrepared=true;
  return 4;
}
