const EPSILON=1e-10;
const side=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);

function convexPolygon(vertices,containsOrigin=false){
  if(!Array.isArray(vertices)||vertices.length<3||!vertices.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)))return null;
  const scale=vertices.reduce((value,p)=>Math.max(value,Math.abs(p.x),Math.abs(p.y)),0);
  if(scale===0)return null;
  const points=vertices.map(p=>({x:p.x/scale,y:p.y/scale}));
  const winding=Math.sign(side(points[0],points[1],points[2]));
  if(!winding)return null;
  for(let i=0;i<points.length;i++){
    const next=(i+1)%points.length,a=points[i],b=points[next];
    // Every other vertex must lie strictly inside each edge, which also rejects crossing stars.
    for(let j=0;j<points.length;j++){
      if(j!==i&&j!==next&&winding*side(a,b,points[j])<=EPSILON)return null;
    }
    if(containsOrigin&&winding*side(a,b,{x:0,y:0})<=EPSILON)return null;
  }
  return {points,scale,winding};
}

/** Requires strict convexity. When requested, the origin must be strictly inside every edge. */
export function validateConvexPolygon(vertices,{containsOrigin=false}={}){
  return convexPolygon(vertices,containsOrigin)!==null;
}

/** Returns a unit-capped ray radius, or null for an invalid direction or gate. */
export function gateRadius(direction,gate){
  if(!Number.isFinite(direction?.x)||!Number.isFinite(direction?.y))return null;
  const scale=Math.max(Math.abs(direction.x),Math.abs(direction.y));
  if(scale===0)return null;
  const x=direction.x/scale,y=direction.y/scale,length=Math.hypot(x,y);
  if(gate==null||gate.type==='circle')return 1;
  if(gate.type!=='polygon')return null;
  const polygon=convexPolygon(gate.vertices,true);
  if(!polygon)return null;
  const ray={x:x/length,y:y/length};
  let radius=1;
  for(let i=0;i<polygon.points.length;i++){
    const a=polygon.points[i],b=polygon.points[(i+1)%polygon.points.length];
    const slope=polygon.winding*((b.x-a.x)*ray.y-(b.y-a.y)*ray.x);
    if(slope<0)radius=Math.min(radius,polygon.winding*side(a,b,{x:0,y:0})/-slope*polygon.scale);
  }
  return radius;
}

function validQuad(quad){
  if(!Array.isArray(quad)||quad.length!==4||!quad.every(p=>['x','y','z'].every(axis=>Number.isFinite(p?.[axis]))))return false;
  const scale=quad.reduce((value,p)=>Math.max(value,Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)),0);
  if(scale===0)return false;
  const p=quad.map(point=>[point.x/scale,point.y/scale,point.z/scale]);
  const a=p[1].map((value,i)=>value-p[0][i]),b=p[2].map((value,i)=>value-p[0][i]);
  const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const axes=[0,1,2].filter(axis=>axis!==drop);
  return validateConvexPolygon(p.map(point=>({x:point[axes[0]],y:point[axes[1]]})));
}

/** Quad corners follow UV (0,0), (1,0), (1,1), (0,1). Invalid or clipped points return null.
 * Pass column-major Matrix4.elements to transform local coordinates into world coordinates.
 */
export function touchSurfacePoint(uv,surface,matrixElements){
  if(!Number.isFinite(uv?.u)||!Number.isFinite(uv?.v)||uv.u<0||uv.u>1||uv.v<0||uv.v>1||!validQuad(surface?.quad))return null;
  if(surface.boundary!==undefined){
    const polygon=convexPolygon(surface.boundary);
    if(!polygon||!surface.boundary.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))return null;
    const point={x:uv.u/polygon.scale,y:uv.v/polygon.scale};
    for(let i=0;i<polygon.points.length;i++){
      if(polygon.winding*side(polygon.points[i],polygon.points[(i+1)%polygon.points.length],point)<-EPSILON)return null;
    }
  }
  const weights=[(1-uv.u)*(1-uv.v),uv.u*(1-uv.v),uv.u*uv.v,(1-uv.u)*uv.v];
  let point=Object.fromEntries(['x','y','z'].map(axis=>[axis,surface.quad.reduce((sum,p,i)=>sum+p[axis]*weights[i],0)]));
  if(matrixElements!==undefined){
    const m=matrixElements;
    if((!Array.isArray(m)&&!ArrayBuffer.isView(m))||m.length!==16||!Array.from(m).every(Number.isFinite))return null;
    const {x,y,z}=point,w=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(!Number.isFinite(w)||w===0)return null;
    point={x:(m[0]*x+m[4]*y+m[8]*z+m[12])/w,y:(m[1]*x+m[5]*y+m[9]*z+m[13])/w,z:(m[2]*x+m[6]*y+m[10]*z+m[14])/w};
  }
  return Object.values(point).every(Number.isFinite)?point:null;
}
