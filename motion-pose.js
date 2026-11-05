// Convert the *relative* DualSense IMU orientation to a physically meaningful
// scene pose. The model's unmirrored local axes are: +X right grip, +Y trigger
// edge, +Z out of the buttons. The scene uses +Y as world up.
//
// Flat (on table, buttons up): rotate the model -90 degrees around its X axis.
// Upright (buttons facing camera): no additional rotation.
// Relative sensor quaternions are in controller-local axes and MUST be
// applied after the chosen neutral mount: world = mount * relative.
const ID=Object.freeze({x:0,y:0,z:0,w:1});
const S=Math.SQRT1_2;
const FLAT=Object.freeze({x:-S,y:0,z:0,w:S});
const multiply=(a,b)=>({
  x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z
});
const normalize=q=>{
  const d=Math.hypot(q.x,q.y,q.z,q.w);
  return Number.isFinite(d)&&d>1e-10?{x:q.x/d,y:q.y/d,z:q.z/d,w:q.w/d}:{...ID};
};

/** Return a THREE-compatible quaternion from real controller pose data. */
export function controllerWorldOrientation({status='uncalibrated',mode='flat',relative=ID,enabled=true}={}){
  if(!enabled || !['calibrating','unstable','ready'].includes(status)) return {...ID};
  const mount=mode==='flat'?FLAT:ID;
  // Do not animate noisy sensor values before the calibration is accepted.
  return normalize(multiply(mount,status==='ready'?normalize(relative):ID));
}

/** Rotate a local direction; useful for independently verifying world axes. */
export function rotatePoseVector(q,v){
  const p={x:v[0],y:v[1],z:v[2],w:0};
  const inverse={x:-q.x,y:-q.y,z:-q.z,w:q.w};
  const output=multiply(multiply(q,p),inverse);
  return [output.x,output.y,output.z];
}

/** Suggest a visible camera angle for the physical neutral pose. */
export function suggestedCameraView({status='uncalibrated',mode='flat',enabled=true}={}){
  return enabled && ['calibrating','unstable','ready'].includes(status) && mode==='flat'?'table':'front';
}
