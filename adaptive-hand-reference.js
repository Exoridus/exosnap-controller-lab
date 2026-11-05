// Experimental display-only long-term handhold reference.
// NEVER gates IMU packets, gyro fusion, button input or rendered movement.
// A sampled 1-second quaternion history informs a slowly changing neutral pose.
const G = 9.80665;
const DEG = Math.PI / 180;
const ID = {x:0,y:0,z:0,w:1};
const dot = (a,b)=>a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;
const negate = a=>({x:-a.x,y:-a.y,z:-a.z,w:-a.w});
const inverse = a=>({x:-a.x,y:-a.y,z:-a.z,w:a.w});
const multiply=(a,b)=>({
  x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z
});
function normalize(q){
  if(!q || !['x','y','z','w'].every(k=>Number.isFinite(q[k])))return null;
  const length=Math.hypot(q.x,q.y,q.z,q.w);
  if(length<1e-8)return null;
  return {x:q.x/length,y:q.y/length,z:q.z/length,w:q.w/length};
}
const lerpQuat=(from,to,alpha)=>{
  const dest=dot(from,to)<0?negate(to):to;
  return normalize({x:from.x+(dest.x-from.x)*alpha,y:from.y+(dest.y-from.y)*alpha,
    z:from.z+(dest.z-from.z)*alpha,w:from.w+(dest.w-from.w)*alpha})||from;
};
function meanQuat(history,anchor){
  let sx=0,sy=0,sz=0,sw=0;
  for(const {q} of history){const v=dot(anchor,q)<0?negate(q):q;
    sx+=v.x;sy+=v.y;sz+=v.z;sw+=v.w;
  }
  return normalize({x:sx,y:sy,z:sz,w:sw})||anchor;
}
export class AdaptiveHandReference {
  constructor({capacity=60,windowMs=1000,sampleMs=1000/60,stableMs=500,halfLifeMs=2000}={}){
    this.capacity=capacity;this.windowMs=windowMs;this.sampleMs=sampleMs;
    this.stableMs=stableMs;this.halfLifeMs=halfLifeMs;
    this.reset();
  }
  reset(){
    this.reference=null;this.history=[];this.lastSampleAt=null;
    this.lastUpdate=null;this.stableSince=null;this.stable=false;
  }
  // A quiet interval is only permission to update the *reference*, not a
  // requirement for displaying real input. No pose suppression on transitions.
  push(orientation, now, {gyroRadS,accelMS2,activeInput=false}={}){
    const q=normalize(orientation);
    if(!q||!Number.isFinite(now))return this.status;
    if(this.lastUpdate!==null && (now<this.lastUpdate || now-this.lastUpdate>1000))this.reset();
    const dt=this.lastUpdate===null?0:Math.max(0,Math.min(80,now-this.lastUpdate));
    this.lastUpdate=now;
    if(this.reference===null)this.reference=q;
    if(this.lastSampleAt===null||now-this.lastSampleAt>=this.sampleMs-.5){
      this.history.push({q,now});this.lastSampleAt=now;
      while(this.history.length>this.capacity || now-this.history[0].now>this.windowMs)
        this.history.shift();
    }
    const usable=Array.isArray(gyroRadS)&&gyroRadS.length===3&&
      Array.isArray(accelMS2)&&accelMS2.length===3&&
      [...gyroRadS,...accelMS2].every(Number.isFinite);
    const rate=usable?Math.hypot(...gyroRadS):Infinity;
    const gravity=usable?Math.hypot(...accelMS2):NaN;
    const quiet=usable && !activeInput && rate<3*DEG &&
      gravity>G*.92 && gravity<G*1.08;
    if(!quiet){this.stableSince=null;this.stable=false;return this.status;}
    this.stableSince??=now;
    this.stable=now-this.stableSince>=this.stableMs;
    if(this.stable && this.history.length>1 && dt>0){
      const referenceTarget=meanQuat(this.history,this.reference);
      // Half-life: after 2 s of stable pose, correct half the gap.
      const alpha=1-Math.exp(-Math.LN2*dt/this.halfLifeMs);
      this.reference=lerpQuat(this.reference,referenceTarget,alpha);
    }
    return this.status;
  }
  corrected(orientation){
    const current=normalize(orientation);
    if(!current)return {...ID};
    if(!this.reference)return current;
    return normalize(multiply(inverse(this.reference),current))||{...ID};
  }
  get status(){return {stable:this.stable,bufferSamples:this.history.length,capacity:this.capacity,
    adapting:this.stable&&this.history.length>1};}
}
