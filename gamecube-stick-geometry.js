import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// Source-unit features are smaller than the utility's 0.01 position hash.
export function smoothSourceNormals(geometry,creaseAngle=Math.PI/3){
  const scratch=geometry.clone().scale(100,100,100);
  const smoothed=toCreasedNormals(scratch,creaseAngle);
  geometry.setAttribute('normal',smoothed.getAttribute('normal').clone());
  smoothed.dispose();
  if(smoothed!==scratch)scratch.dispose();
  return geometry;
}

// These untextured surfaces need position and normal attributes only.
function refineSurface(geometry,selected,midpoint,levels){
  const source=geometry.index?geometry.toNonIndexed():geometry;
  const positions=source.getAttribute('position'),output=[];
  const emit=(a,b,c,level)=>{
    if(level===0){output.push(...a.toArray(),...b.toArray(),...c.toArray());return;}
    const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
    emit(a,ab,ca,level-1);emit(ab,b,bc,level-1);emit(ca,bc,c,level-1);emit(ab,bc,ca,level-1);
  };
  for(let i=0;i<positions.count;i+=3){
    const points=[0,1,2].map(offset=>new Vector3().fromBufferAttribute(positions,i+offset));
    emit(...points,selected(points)?levels:0);
  }
  const result=new BufferGeometry();
  result.setAttribute('position',new Float32BufferAttribute(output,3));
  smoothSourceNormals(result);
  if(source!==geometry)source.dispose();
  return result;
}

/** Refines spherical stem faces while preserving authored shaft junctions. */
export function refineStickSphere(geometry,radius,levels=2){
  return refineSurface(geometry,points=>points.every(v=>Math.abs(v.length()-radius)<.00003),
    (a,b)=>a.clone().add(b).normalize().multiplyScalar(radius),levels);
}

/** Subdivides the authored radial profile without changing its groove heights. */
export function refineRoundCap(geometry){
  return refineSurface(geometry,()=>true,(a,b)=>{
    const point=a.clone().add(b).multiplyScalar(.5);
    const radius=(Math.hypot(a.x,a.z)+Math.hypot(b.x,b.z))*.5;
    const length=Math.hypot(point.x,point.z);
    if(length>1e-12){point.x*=radius/length;point.z*=radius/length;}
    return point;
  },2);
}

export function polishGameCubePart(geometry,file){
  if(file==='left_stick.obj'||file==='right_stick.obj'){
    const refined=refineStickSphere(geometry,file==='left_stick.obj'?.20619:.17557);
    geometry.dispose();return refined;
  }
  if(file==='left_ring.obj'||file==='left_cap.obj'){
    const refined=refineRoundCap(geometry);geometry.dispose();return refined;
  }
  if(/^right_(ring|cap)\.obj$/.test(file))return smoothSourceNormals(geometry,Math.PI/4);

  return geometry;
}
