// Presentation policy only. Raw IMU values and fused sensor quaternion are not
// modified. Three.js YXZ Euler convention: X pitch, Y yaw, Z roll.
import { MOTION_TUNING_DEFAULTS,sanitizeMotionTuning } from './motion-tuning.js';
const ID=Object.freeze({x:0,y:0,z:0,w:1});
const rad=Math.PI/180;
export const OVERLAY_LIMITS=Object.freeze({
  pitch:MOTION_TUNING_DEFAULTS.pitchMaxDeg*rad,
  yaw:MOTION_TUNING_DEFAULTS.yawMaxDeg*rad,
  roll:MOTION_TUNING_DEFAULTS.rollMaxDeg*rad
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mult=(a,b)=>({x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z});
const axisQuat=(axis,angle)=>{const s=Math.sin(angle/2),c=Math.cos(angle/2);return axis==='x'?{x:s,y:0,z:0,w:c}:axis==='y'?{x:0,y:s,z:0,w:c}:{x:0,y:0,z:s,w:c};};
export function eulerQuaternion({pitch=0,yaw=0,roll=0}){
  return mult(mult(axisQuat('y',yaw),axisQuat('x',pitch)),axisQuat('z',roll));
}
export function eulerAngles(q){
  const {x,y,z,w}=q;
  const m11=1-2*(y*y+z*z), m13=2*(x*z+y*w);
  const m21=2*(x*y+z*w), m22=1-2*(x*x+z*z);
  const m23=2*(y*z-x*w), m31=2*(x*z-y*w), m33=1-2*(x*x+y*y);
  const pitch=Math.asin(-clamp(m23,-1,1));
  const yaw=Math.abs(m23)<.9999999?Math.atan2(m13,m33):Math.atan2(-m31,m11);
  const roll=Math.abs(m23)<.9999999?Math.atan2(m21,m22):0;
  return {pitch,yaw,roll};
}
const angleLimits=options=>({
  pitch:(options?.pitchMaxDeg ?? MOTION_TUNING_DEFAULTS.pitchMaxDeg)*rad,
  yaw:(options?.yawMaxDeg ?? MOTION_TUNING_DEFAULTS.yawMaxDeg)*rad,
  roll:(options?.rollMaxDeg ?? MOTION_TUNING_DEFAULTS.rollMaxDeg)*rad,
  combined:(options?.rollYawCombinedMaxDeg ?? MOTION_TUNING_DEFAULTS.rollYawCombinedMaxDeg)*rad,
  total:(options?.totalCombinedMaxDeg ?? MOTION_TUNING_DEFAULTS.totalCombinedMaxDeg)*rad
});
// Project an over-limit diagonal back to a shared roll/yaw circular envelope.
// This caps the accumulator itself: excess IMU movement is never stored as
// "angle debt", so reversing from the limit has no hidden dead travel.
function sharedRollYawBound(angles,limits){
  const r=Math.hypot(angles.roll,angles.yaw);
  if(r>limits.combined && r>0){
    const scale=limits.combined/r;
    angles.roll*=scale;
    angles.yaw*=scale;
  }
  return angles;
}
// The combined pitch/roll/yaw envelope is a sphere centered on the held
// neutral pose (not the -12° display tilt). Projecting the integrated pose,
// rather than just the rendered pose, prevents hidden angular debt.
function sharedTotalBound(angles,limits){
  const length=Math.hypot(angles.pitch,angles.roll,angles.yaw);
  if(length>limits.total && length>0){
    const ratio=limits.total/length;
    angles.pitch*=ratio;
    angles.roll*=ratio;
    angles.yaw*=ratio;
  }
  return angles;
}
function boundAll(angles,limits){
  for(const key of ['pitch','roll','yaw'])
    angles[key]=clamp(angles[key],-limits[key],limits[key]);
  sharedRollYawBound(angles,limits);
  sharedTotalBound(angles,limits);
  return angles;
}
export function overlayOrientation(relative,mode='overlay',options){
  const q=relative && ['x','y','z','w'].every(k=>Number.isFinite(relative[k]))?relative:ID;
  if(mode==='free')return q;
  const a=eulerAngles(q), limit=angleLimits(options);
  const pose=boundAll({pitch:a.pitch,yaw:a.yaw,roll:a.roll},limit);
  return eulerQuaternion(pose);
}

// Local incremental orientation with anti-windup, optional recenter, a tiny
// angle deadzone and a frame-time-based response filter. This is *not* a gyro
// deadzone: tiny sensor increments are still integrated into desired angles.
export const HANDHELD_PITCH_DEG=-12;
export const HANDHELD_GAINS=Object.freeze({pitch:MOTION_TUNING_DEFAULTS.pitchGain,roll:MOTION_TUNING_DEFAULTS.rollGain,yaw:MOTION_TUNING_DEFAULTS.yawGain});
export const HANDHELD_PITCH=HANDHELD_PITCH_DEG*rad;
const neutralHeld=()=>eulerQuaternion({pitch:HANDHELD_PITCH});
const normalizeQ=q=>{
  if(!q || !['x','y','z','w'].every(k=>Number.isFinite(q[k])))return {...ID};
  const len=Math.hypot(q.x,q.y,q.z,q.w);
  return len>1e-7?{x:q.x/len,y:q.y/len,z:q.z/len,w:q.w/len}:{...ID};
};
const inverted=q=>({x:-q.x,y:-q.y,z:-q.z,w:q.w});
const negate=q=>({x:-q.x,y:-q.y,z:-q.z,w:-q.w});
const qDot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;
const smoothDeadzone=(value,threshold,limit)=>{
  if(threshold<=0)return value;
  const a=Math.abs(value);
  if(a<=threshold)return 0;
  return Math.sign(value)*Math.min(limit,(a-threshold)*limit/(limit-threshold));
};
export function handheldNeutralOrientation(){return neutralHeld();}
export function heldDirectOrientation(relative,options){return mult(neutralHeld(),overlayOrientation(relative,'overlay',options));}

export class HandheldOverlayMotion {
  constructor(options={}){
    this.options=sanitizeMotionTuning(options);
    this.reset();
  }
  reset(){
    this.previous=null;
    this.lastTime=null;
    this.lastActiveAt=null;
    this.desired={pitch:0,yaw:0,roll:0};
    this.display={pitch:0,yaw:0,roll:0};
    this.activityVector={pitch:0,yaw:0,roll:0};
    this.activityStart=null;
  }
  // Re-anchors the local display integrator without snapping the visible
  // quaternion. The existing response filter eases its prior display angle
  // back toward the neutral hand-pose, while future IMU movement starts from
  // exactly this physical orientation. No hidden angle debt is retained.
  rebase(relative,now=0){
    this.previous=normalizeQ(relative);
    this.lastTime=Number.isFinite(now)?now:0;
    this.lastActiveAt=null;
    this.desired={pitch:0,yaw:0,roll:0};
    this.activityVector={pitch:0,yaw:0,roll:0};
    this.activityStart=null;
  }
  setOptions(options={}){
    this.options=sanitizeMotionTuning({...this.options,...options});
    const limits=angleLimits(this.options);
    boundAll(this.desired,limits);
    boundAll(this.display,limits);
    return this.options;
  }
  get orientation(){return eulerQuaternion({
    pitch:HANDHELD_PITCH+this.display.pitch,
    yaw:this.display.yaw,
    roll:this.display.roll
  });}
  update(relative,now=0){
    const incoming=normalizeQ(relative);
    if(this.previous===null || this.lastTime===null || !Number.isFinite(now)){
      this.previous=incoming;this.lastTime=Number.isFinite(now)?now:0;
      return this.orientation;
    }
    const rawDt=(now-this.lastTime)/1000;
    const dt=clamp(rawDt,0,.05);
    const previous=this.previous;
    const current=qDot(previous,incoming)<0?negate(incoming):incoming;
    this.previous=current;this.lastTime=now;
    if(rawDt<=0 || rawDt>.25)return this.orientation;
    const limits=angleLimits(this.options);
    // The previous controller-local quaternion delta mixed the three *display*
    // axes as soon as the physical controller had compound pitch/roll/yaw.
    // Use the independently calibrated screen-space Euler directions instead.
    // Wrap around +/-180° so the short physical return never jumps 360°.
    const oldAngles=eulerAngles(previous),newAngles=eulerAngles(current);
    let delta;
    // Y-X-Z Euler decomposition is singular at +/-90° physical pitch. Past
    // about 70° of total physical turn, integrate the local quaternion
    // difference instead, so turning beyond the singularity cannot unwind
    // the virtual controller in the opposite direction.
    const turned=Math.max(2*Math.acos(clamp(Math.abs(previous.w),0,1)),2*Math.acos(clamp(Math.abs(current.w),0,1)));
    if(turned>70*rad){
      let change=normalizeQ(mult(inverted(previous),current));
      if(change.w<0)change=negate(change);
      delta=eulerAngles(change);
    }else{
      delta={};
      for(const key of ['pitch','yaw','roll']){
        const difference=newAngles[key]-oldAngles[key];
        delta[key]=Math.atan2(Math.sin(difference),Math.cos(difference));
      }
    }

    const amplitude=Math.hypot(delta.pitch,delta.yaw,delta.roll);
    // The former per-frame 0.06° threshold lost deliberate slow gestures:
    // at 120Hz, 3°/sec is only 0.025° per packet. Integrate each valid
    // increment; the display deadzone removes resulting visual jitter.
    if(amplitude<.45){
      for(const key of ['pitch','yaw','roll']){
        this.desired[key]+=delta[key]*this.options[key+'Gain'];
        this.activityVector[key]+=delta[key];
      }
      boundAll(this.desired,limits);
    }
    // A short net-motion window distinguishes a real slow turn from random
    // oscillating gyro noise, including when auto-return is enabled.
    if(this.activityStart===null)this.activityStart=now;
    const activityDt=(now-this.activityStart)/1000;
    if(activityDt>=.16){
      const motionRate=Math.hypot(this.activityVector.pitch,this.activityVector.yaw,this.activityVector.roll)/activityDt;
      if(motionRate>1.5*rad)this.lastActiveAt=now;
      this.activityStart=now;
      this.activityVector={pitch:0,yaw:0,roll:0};
    }
    if(this.options.autoReturn && this.lastActiveAt!==null && now-this.lastActiveAt>=this.options.returnDelayMs){
      const decay=Math.exp(-Math.LN2*(dt*1000)/this.options.returnHalfLifeMs);
      for(const key of ['pitch','yaw','roll'])this.desired[key]*=decay;
    }
    const blend=1-Math.exp(-(dt*1000)/this.options.responseMs);
    for(const key of ['pitch','yaw','roll']){
      const target=smoothDeadzone(this.desired[key],this.options.deadzoneDeg*rad,limits[key]);
      this.display[key]+= (target-this.display[key])*blend;
      this.display[key]=clamp(this.display[key],-limits[key],limits[key]);
    }
    boundAll(this.display,limits);
    return this.orientation;
  }
}
