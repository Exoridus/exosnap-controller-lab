// Source-topology-based INTERNAL housing contours, not an edge detector on
// the composited image. Only manifold edges between two non-coplanar surface
// triangles qualify; open mesh edges, outline silhouettes and triangulation
// diagonals never qualify. Generated once per original rig, no CPU readback.
import * as THREE from 'three';
import {isHousingRole} from './model-semantics.js';

const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3(),tmpC=new THREE.Vector3();
const quantize=p=>[p.x,p.y,p.z].map(x=>Math.round(x*10000)).join(',');
const edgeKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const clamp=n=>Math.max(-1,Math.min(1,n));
const MAX_SEGMENTS=1400;
export const INTERIOR_CONTOUR_POLICY=Object.freeze({
  minimumAngleDegrees:37,minimumWorldLength:.011,maxSegments:MAX_SEGMENTS,
  tone:'#59697b',solidOpacity:.26,ghostOpacity:0,
});

export function extractInteriorHousingEdges(meshes,root,{minimumAngleDegrees=INTERIOR_CONTOUR_POLICY.minimumAngleDegrees,maxSegments=MAX_SEGMENTS,includeGameCubeInsets=false}={}){
  if(!root?.isObject3D)throw new TypeError('Expected original rig root');
  root.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
  // The GameCube top shell has actual open inset lips around its controls.
  // These are source topology, not artificial silhouettes or triangulation.
  // Restrict them to the original button neighborhoods so outer mesh boundaries
  // and open backside edges cannot masquerade as decorative interior seams.
  const insets=includeGameCubeInsets?[...(meshes||[])].filter(m=>
    /^(?:dpad_(?:up|down|left|right)|[abxy]_button)[.]obj$/i.test(m?.userData?.sourceFile||''))
    .map(m=>{
      const b=new THREE.Box3().setFromObject(m),c=b.getCenter(new THREE.Vector3()).applyMatrix4(inv);
      const size=b.getSize(new THREE.Vector3());
      return {file:m.userData.sourceFile,center:c,radius:Math.max(.26,Math.max(size.x,size.y)*1.25)};
    }):[];
  const padParts=insets.filter(({file})=>/^dpad_(?:up|down|left|right)[.]obj$/i.test(file));
  const leftGameCubeInset=padParts.length===4?
    padParts.reduce((center,{center:part})=>center.add(part),new THREE.Vector3()).multiplyScalar(.25):null;
  const edges=[];
  const minAngle=Math.max(5,Math.min(89,Number(minimumAngleDegrees)||37))*Math.PI/180;
  for(const mesh of meshes||[]){
    if(!mesh?.isMesh||!mesh.visible||!isHousingRole(mesh.userData.role))continue;
    if(!/^(?:top_shell|bottom_shell|extra)[.]obj$/i.test(mesh.userData.sourceFile||''))continue;
    const pos=mesh.geometry?.getAttribute('position');
    if(!pos?.count)continue;
    mesh.updateWorldMatrix(true,false);
    const transform=new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld);
    const points=Array.from({length:pos.count},(_,i)=>
      new THREE.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(transform));
    const index=mesh.geometry.index;
    const size=index?.count||pos.count;
    const incident=new Map();
    for(let i=0;i+2<size;i+=3){
      const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
      const a=points[ia],b=points[ib],c=points[ic];
      const n=tmpA.copy(b).sub(a).cross(tmpB.copy(c).sub(a)).normalize().clone();
      if(n.lengthSq()<.5)continue;
      for(const [u,v] of [[a,b],[b,c],[c,a]]){
        if(u.distanceToSquared(v)<1e-8)continue;
        const ku=quantize(u),kv=quantize(v),key=edgeKey(ku,kv);
        if(!incident.has(key))incident.set(key,{u:u.clone(),v:v.clone(),faces:[]});
        const entry=incident.get(key);
        if(entry.faces.length<3)entry.faces.push(n);
      }
    }
    for(const edge of incident.values()){
      if(edge.faces.length===1&&insets.length){
        const face=edge.faces[0],mid=edge.u.clone().add(edge.v).multiplyScalar(.5);
        const len=edge.u.distanceTo(edge.v);
        const nearInset=insets.some(inset=>
          Math.hypot(mid.x-inset.center.x,mid.y-inset.center.y)<inset.radius&&
          Math.abs(mid.z-inset.center.z)<.25);
        if(!nearInset||face.z<.27||
            len<INTERIOR_CONTOUR_POLICY.minimumWorldLength||len>.40)continue;
        const bias=face.clone().multiplyScalar(.004);
        edges.push({a:edge.u.clone().add(bias),b:edge.v.clone().add(bias),
          score:.55+Math.min(len,.2),len});
        continue;
      }
      // Two-face creases only; one-face boundaries on other models are NOT seams.
      if(edge.faces.length!==2)continue;
      const [n1,n2]=edge.faces;
      const angle=Math.acos(clamp(n1.dot(n2)));
      // GameCube's lower-left D-pad recess is a genuine, GENTLER curve than
      // the right C-stick recess (~25-33° versus ~42-54°). The universal 37°
      // threshold silently erased its outline while keeping the right one.
      // Lower the threshold ONLY on the source-authored, front-facing left
      // recess, not for its overall shell, the outer silhouette, or other rigs.
      const mid=edge.u.clone().add(edge.v).multiplyScalar(.5);
      const leftPadRecess=leftGameCubeInset&&mesh.userData.sourceFile==='top_shell.obj'&&
        Math.hypot(mid.x-leftGameCubeInset.x,mid.y-leftGameCubeInset.y)<.58&&
        Math.max(n1.z,n2.z)>.96&&Math.min(n1.z,n2.z)>.78;
      const localMinimum=leftPadRecess?Math.min(minAngle,22*Math.PI/180):minAngle;
      if(angle<localMinimum||angle>2.36)continue;
      // The co/Exo source front (+Y) is +Z after native rig normalization.
      // Exclude hidden rear geometry and exterior silhouette front/back folds.
      if(Math.max(n1.z,n2.z)<.20||Math.min(n1.z,n2.z)<-.14)continue;
      const len=edge.u.distanceTo(edge.v);
      if(len<INTERIOR_CONTOUR_POLICY.minimumWorldLength||len>.75)continue;
      const bias=tmpC.copy(n1).add(n2).normalize().multiplyScalar(.0035);
      edges.push({a:edge.u.clone().add(bias),b:edge.v.clone().add(bias),
        score:angle*(.5+Math.min(len,.15)*2),len});
    }
  }
  edges.sort((a,b)=>b.score-a.score);
  return edges.slice(0,Math.max(0,Math.min(MAX_SEGMENTS,Math.floor(maxSegments)||0)));
}

export function interiorContourOpacity(mix){
  const t=THREE.MathUtils.clamp(Number(mix)||0,0,1);
  return INTERIOR_CONTOUR_POLICY.solidOpacity*(1-t*t);
}

export function prepareInteriorHousingContours(native){
  if(!native?.meshes||!native.group)throw new TypeError('Expected original rig');
  if(native.interiorHousingContours)return native.interiorHousingContours;
  const gameCube=native.model?.id==='Gamecube';
  const edges=extractInteriorHousingEdges(native.meshes,native.group,{includeGameCubeInsets:gameCube});
  const vertices=new Float32Array(edges.length*6);
  edges.forEach(({a,b},i)=>{vertices.set(a.toArray(),6*i);vertices.set(b.toArray(),6*i+3);});
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  const material=new THREE.LineBasicMaterial({
    color:INTERIOR_CONTOUR_POLICY.tone,transparent:true,opacity:0,
    depthTest:true,depthWrite:false,toneMapped:false,
    blending:THREE.NormalBlending
  });
  const lines=new THREE.LineSegments(geometry,material);
  lines.name='Native shell internal seams (shared source topology)';
  lines.renderOrder=-34;lines.frustumCulled=false;lines.visible=false;
  lines.userData.interiorHousingContour=true;
  native.group.add(lines);
  native.interiorHousingContours={lines,geometry,material,segments:edges.length,gameCube};
  return native.interiorHousingContours;
}
export function updateInteriorHousingContours(native,recipe){
  const state=native?.interiorHousingContours;if(!state)return;
  const opacity=interiorContourOpacity(recipe?.mix);
  // The recessed GameCube seams need a little more contrast at intermediate
  // transparency; full Ghost still fades to zero and other rigs are unchanged.
  state.material.opacity=state.gameCube?Math.min(.39,opacity*1.35):opacity;
  state.lines.visible=state.segments>0&&opacity>.004;
}
export function disposeInteriorHousingContours(native){
  const state=native?.interiorHousingContours;if(!state)return;
  state.lines.parent?.remove(state.lines);
  state.geometry.dispose();
  state.material.dispose();
  native.interiorHousingContours=null;
}
