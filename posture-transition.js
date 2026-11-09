// Overlay-only heuristic for picking a gamepad up from a desk and putting it
// back down. Physical sensor fusion and absolute 360° motion are untouched.
// SDL/GameInput controller axes: X right, Y outward through buttons, Z toward
// the player. A gamepad flat on a desk, buttons up, reports approximately
// (0, +9.80665, 0) m/s² while stationary.
//
// Limitation: IMU data alone cannot unambiguously distinguish an intentional
// pitch gesture from lifting a resting controller. Suppress only across a
// *confirmed* tabletop/handheld transition and never while gamepad input is
// active. The optional UI switch lets users disable this policy.
const RAD=Math.PI/180;
const G=9.80665;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function sensedPosture({accelMS2,gyroRadS}={}){
  if(!Array.isArray(accelMS2)||!Array.isArray(gyroRadS)||
     accelMS2.length!==3||gyroRadS.length!==3||
     ![...accelMS2,...gyroRadS].every(Number.isFinite))return null;
  const a=Math.hypot(...accelMS2), rate=Math.hypot(...gyroRadS)/RAD;
  if(a<.55*G || a>1.6*G)return null;
  const pitchFromTable=Math.acos(clamp(accelMS2[1]/a,-1,1))/RAD;
  return {
    pitchFromTable,
    stable:a>=.85*G && a<=1.15*G && rate<3,
    nearTable:pitchFromTable<=7,
    leavingTable:pitchFromTable>=4.5,
    inHands:pitchFromTable>=10,
    angularSpeed:rate
  };
}

export class PostureTransitionGuard {
  constructor(){this.reset();}
  reset(){
    this.posture='unknown';
    this.stableTarget=null;
    this.stableSince=null;
    this.transitionStarted=null;
    this.lastTime=null;
    this.holding=false;
  }
  update({now=0,accelMS2,gyroRadS,activeInput=false,knownStable=false}={}){
    const result=(rebase=false)=>({posture:this.posture,hold:this.holding,rebase});
    const sensed=sensedPosture({accelMS2,gyroRadS});
    if(!sensed||!Number.isFinite(now)){
      // A pickup often includes non-gravitational acceleration. Do not
      // unfreeze on one such report; briefly keep the transfer state.
      // But also never leave the scene frozen on a dead sensor stream.
      this.stableTarget=null;this.stableSince=null;
      if(this.holding && Number.isFinite(now) && this.lastTime!==null &&
          now-this.lastTime<=700)return result();
      this.holding=false;this.posture='unknown';this.transitionStarted=null;
      return result();
    }
    if(this.lastTime!==null && (now<this.lastTime || now-this.lastTime>1600)){
      // A stale sensor stream must not preserve the motion-suppression gate.
      this.reset();
    }
    this.lastTime=now;
    const target=sensed.nearTable?'table':sensed.inHands?'hand':null;
    const waitStable=(candidate,ms)=>{
      if(!sensed.stable||candidate==null){this.stableTarget=null;this.stableSince=null;return false;}
      if(this.stableTarget!==candidate){this.stableTarget=candidate;this.stableSince=now;}
      return now-this.stableSince>=ms;
    };
    if(this.posture==='unknown'){
      // The IMU fusion itself has already completed a >=1-second stable
      // calibration window. Do not demand a *second* dwell before allowing
      // a pickup immediately after its ready signal.
      if(knownStable && sensed.stable && target){
        this.posture=target;
        this.stableSince=null;this.stableTarget=null;
        return result(true);
      }
      if(waitStable(target,600)){
        this.posture=target;
        this.stableSince=null;this.stableTarget=null;
        return result(true);
      }
      return result();
    }
    if(this.posture==='table'){
      if(!activeInput && sensed.leavingTable && sensed.angularSpeed>4){
        this.posture='transfer';this.transitionStarted=now;this.holding=true;
        this.stableTarget=null;this.stableSince=null;
        return result();
      }
      return result();
    }
    if(this.posture==='hand'){
      if(!activeInput && sensed.nearTable){
        this.posture='transfer';this.transitionStarted=now;this.holding=true;
        this.stableTarget=null;this.stableSince=null;
        return result();
      }
      return result();
    }
    // A transfer was observed. Keep the already-rendered pose steady until the
    // controller has settled, then discard the old display-reference delta.
    if(this.posture==='transfer'){
      const timedOut=now-this.transitionStarted>2600;
      const resumedPlaying=activeInput && now-this.transitionStarted>120;
      if((target&&waitStable(target,420))||timedOut||resumedPlaying){
        this.posture=target || 'hand';
        this.holding=false;this.transitionStarted=null;
        this.stableTarget=null;this.stableSince=null;
        return result(true);
      }
      return result();
    }
    return result();
  }
}
