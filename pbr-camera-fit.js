// Perspective camera fitting for an authored 3D controller. No guesswork
// with fixed magic distances: bound all eight AABB corners in the view cone.
const radians=d=>d*Math.PI/180;
export function fitControllerRadius(extent,{yaw=0,pitch=0,fov=35,aspect=320/214,fill=.88}={}){
  const size=[extent?.x,extent?.y,extent?.z];
  if(size.some(x=>!Number.isFinite(x)||x<=0))throw new TypeError('Invalid controller bounds');
  if(fov<=0||fov>=120||aspect<=0||fill<=0||fill>=1)throw new RangeError('Invalid camera framing');
  const tanY=Math.tan(radians(fov)/2),tanX=tanY*aspect;
  const sinY=Math.sin(yaw),cosY=Math.cos(yaw);
  const sinP=Math.sin(pitch),cosP=Math.cos(pitch);
  let required=.5;
  for(const x of [-size[0]/2,size[0]/2]){
    for(const y of [-size[1]/2,size[1]/2]){
      for(const z of [-size[2]/2,size[2]/2]){
        const depth=x*cosP*sinY+y*sinP+z*cosP*cosY;
        const horizontal=x*cosY-z*sinY;
        const vertical=-x*sinY*sinP+y*cosP-z*cosY*sinP;
        required=Math.max(required,depth+Math.abs(horizontal)/(tanX*fill),
          depth+Math.abs(vertical)/(tanY*fill));
      }
    }
  }
  return Math.max(3.0,Math.min(15,required+0.08));
}
