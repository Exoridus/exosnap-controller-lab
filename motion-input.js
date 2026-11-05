import { DEFAULT_AXIS_MAPPING, mapAxes, validAxisMapping } from './axis-alignment.js';
// Sony DualSense / Edge motion input. WebHID omits report IDs from report bodies.
// USB 0x01: 63-byte body, BT 0x31: 77-byte body, one-byte BT payload offset.
// Factory scale follows Linux hid-playstation feature report 0x05; fallback
// scale is deliberately marked approximate. There is no magnetometer.
export const SONY_VENDOR_ID = 0x054c;
export const DUALSENSE_PRODUCT_IDS = Object.freeze([0x0ce6, 0x0df2]);
const RAD = Math.PI/180;
export const STANDARD_GRAVITY = 9.80665; // SDL_STANDARD_GRAVITY
const GYRO_RES_PER_DEGREE = 1024;
const ACCEL_RES_PER_G = 8192;
const GYRO_FALLBACK_SENSITIVITY = 64;
const ID = Object.freeze({x:0,y:0,z:0,w:1});
// SDL-like normalized sensor axes are mapped to viewer Pitch/Roll/Yaw using
// the previously validated DualSense profile; display transforms stay separate.
export const sensorToViewer = values => mapAxes(values,DEFAULT_AXIS_MAPPING);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const length=v=>Math.hypot(...v);
const normalize=v=>{const r=length(v);return r>1e-8?v.map(x=>x/r):null;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const multiply=(a,b)=>({
 x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
 y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
 z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
 w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z
});
const conjugate=q=>({x:-q.x,y:-q.y,z:-q.z,w:q.w});
const unit=q=>{const n=Math.hypot(q.x,q.y,q.z,q.w);return n>0?{x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n}:{...ID};};
const axisAngle=(axis,angle)=>{const s=Math.sin(angle/2);return {x:axis[0]*s,y:axis[1]*s,z:axis[2]*s,w:Math.cos(angle/2)};};
function rotate(q,v){const p=multiply(multiply(q,{x:v[0],y:v[1],z:v[2],w:0}),conjugate(q));return [p.x,p.y,p.z];}
function mean(values){return values[0].map((_,axis)=>values.reduce((n,v)=>n+v[axis],0)/values.length);}
function maxStd(values,mu){return Math.max(...mu.map((v,j)=>Math.sqrt(values.reduce((s,x)=>s+(x[j]-v)**2,0)/values.length)));}

export function parseDualSenseMotion(reportId,data) {
  if(!(data instanceof DataView))return null;
  const o=reportId===0x01&&data.byteLength>=63?0:reportId===0x31&&data.byteLength>=64?1:-1;
  if(o<0 || data.byteLength<o+31)return null;
  const g=[15,17,19].map(n=>data.getInt16(o+n,true));
  const a=[21,23,25].map(n=>data.getInt16(o+n,true));
  const rawStamp=data.getUint32(o+27,true);
  const accelG=a.map(v=>v/8192);
  const [x,y,z]=accelG;
  return {reportId,gyroRaw:g,accelRaw:a,accelG,sensorTimestamp:rawStamp,
    rollDeg:Math.atan2(y,z)/RAD,pitchDeg:Math.atan2(-x,Math.hypot(y,z))/RAD,
    sensorClockHz:3000000,sensorTimestampBits:32};
}

// Adapted mathematically from SDL3's DualSense HIDAPI driver, not SDL code linked
// at runtime. WebHID returns report payloads without report ID (0x05) on Chrome.
// All six calibration channels must pass SDL's plausibility gate, otherwise
// use the documented SDL fallback for the whole IMU (not axis-by-axis heuristics).
export function parseDualSenseFactoryCalibration(view) {
  if(!(view instanceof DataView))return null;
  const offset=view.byteLength>=41&&view.getUint8(0)===0x05?1:0;
  if(view.byteLength-offset<34)return null;
  const s=n=>view.getInt16(offset+n,true);
  const gyroBias=[0,2,4].map(s);
  const gyroPlus=[6,10,14].map(s), gyroMinus=[8,12,16].map(s);
  const speedTotal=s(18)+s(20);
  if(!Number.isFinite(speedTotal)||speedTotal<=0)return null;
  const accelPlus=[22,26,30].map(s),accelMinus=[24,28,32].map(s);
  const gyroDpsPerCount=[],accelGPerCount=[],accelBias=[];
  for(let i=0;i<3;i++){
    const deltaG=gyroPlus[i]-gyroMinus[i];
    const deltaA=accelPlus[i]-accelMinus[i];
    if(deltaG===0||deltaA===0)return null;
    gyroDpsPerCount.push(speedTotal/deltaG);
    accelGPerCount.push(2/deltaA);
    accelBias.push(accelPlus[i]-Math.trunc(deltaA/2));
  }
  // SDL tests (bias <= 1024; sensitivity normalized by 64 for gyro and
  // by 1 for accel, max 50% deviation). Expressed in physical per-count units.
  const validGyro=gyroBias.every((bias,i)=>Math.abs(bias)<=1024&&
    Math.abs(1-gyroDpsPerCount[i]*GYRO_RES_PER_DEGREE/GYRO_FALLBACK_SENSITIVITY)<=.5);
  const validAccel=accelBias.every((bias,i)=>Math.abs(bias)<=1024&&
    Math.abs(1-accelGPerCount[i]*ACCEL_RES_PER_G)<=.5);
  if(!validGyro||!validAccel)return null;
  return {gyroBias,gyroDpsPerCount,accelBias,accelGPerCount};
}

// IMPORTANT: gyroRadS and accelMS2 are SENSOR-LOCAL X/Y/Z in physical units.
// No camera/model axis transformation is done here. Mapping to scene axes is
// a separate operation and does not affect the sensor calibration.
export function normalizeDualSenseSensorSample(sample,calibration=null){
  if(!sample||!Array.isArray(sample.gyroRaw)||!Array.isArray(sample.accelRaw)||
      sample.gyroRaw.length!==3||sample.accelRaw.length!==3||
      !sample.gyroRaw.every(Number.isFinite)||!sample.accelRaw.every(Number.isFinite))return null;
  const factory=!!calibration && [calibration.gyroBias,calibration.gyroDpsPerCount,
    calibration.accelBias,calibration.accelGPerCount].every(x=>Array.isArray(x)&&x.length===3&&x.every(Number.isFinite));
  const gyroRadS=sample.gyroRaw.map((v,i)=>
    (factory?(v-calibration.gyroBias[i])*calibration.gyroDpsPerCount[i]
      :v*GYRO_FALLBACK_SENSITIVITY/GYRO_RES_PER_DEGREE)*RAD);
  const accelMS2=sample.accelRaw.map((v,i)=>
    (factory?(v-calibration.accelBias[i])*calibration.accelGPerCount[i]
      :v/ACCEL_RES_PER_G)*STANDARD_GRAVITY);
  return {gyroRadS,accelMS2,source:factory?'factory':'fallback'};
}

export class MotionFusion {
  constructor(){
    this.ready=false;this.status='uncalibrated';this.mode='held';
    this.factory=null;this.gyroBias=[0,0,0];this.gyroBiasRadS=[0,0,0];this.neutralGravity=[0,0,-1];
    this.axisMapping=DEFAULT_AXIS_MAPPING.map(x=>({...x}));
    this.neutralRawGravity=[0,0,1];
    this.q={...ID};this.reference={...ID};
    this.lastClock=null;this.lastStamp=null;this.progress=0;
    this.samples=[];this.calibrationStart=0;
  }
  setFactoryCalibration(cal){
    // An incomplete/corrupt record cannot overwrite valid raw-scale fallback.
    const test=normalizeDualSenseSensorSample({gyroRaw:[0,0,0],accelRaw:[0,0,0]},cal);
    this.factory=test?.source==='factory'?cal:null;
  }
  sensorValues(sample){
    if(Array.isArray(sample?.gyroRadS)&&Array.isArray(sample?.accelMS2)&&
       sample.gyroRadS.length===3&&sample.accelMS2.length===3&&
       [...sample.gyroRadS,...sample.accelMS2].every(Number.isFinite))
      return {gyroRadS:sample.gyroRadS,accelMS2:sample.accelMS2,source:sample.source||'fallback'};
    return normalizeDualSenseSensorSample(sample,this.factory);
  }
  get calibrationSource(){return this.factory?'factory':'fallback';}
  setAxisMapping(mapping){
    if(!validAxisMapping(mapping))return false;
    this.axisMapping=mapping.map(x=>({...x}));
    this.neutralGravity=normalize(mapAxes(this.neutralRawGravity,this.axisMapping))||[0,0,-1];
    this.q={...ID};this.reference={...ID};this.lastClock=null;this.lastStamp=null;
    return true;
  }
  startCalibration(mode='held',now=0){
    this.mode=['held','flat','upright'].includes(mode)?mode:'held';this.ready=false;this.status='calibrating';
    this.samples=[];this.calibrationStart=now;this.progress=0;
    this.lastClock=null;this.lastStamp=null;
    this.q={...ID};this.reference={...ID};this.gyroBiasRadS=[0,0,0];
  }
  rawAccel(sample){
    // Internal gravity-fusion input is in g; UI/API expose m/s².
    const values=this.sensorValues(sample);
    return values?values.accelMS2.map(v=>v/STANDARD_GRAVITY):[0,0,0];
  }
  accel(sample){return mapAxes(this.rawAccel(sample),this.axisMapping);}
  rawDps(sample){
    const values=this.sensorValues(sample);
    return values?values.gyroRadS.map((v,i)=>(v-this.gyroBiasRadS[i])/RAD):[0,0,0];
  }
  dps(sample){return mapAxes(this.rawDps(sample),this.axisMapping);}
  get orientation(){return unit(multiply(this.reference,this.q));}
  get phase(){return {ready:this.ready,status:this.status,progress:this.progress,pose:this.mode};}
  recenter(){if(!this.ready)return false;this.reference=conjugate(this.q);return true;}
  update(sample,now=0){
    if(!sample||!Array.isArray(sample.gyroRaw))return this.phase;
    const a=this.accel(sample);
    if(this.status==='calibrating'||this.status==='unstable'){
      const calibrated=this.sensorValues(sample);
      if(!calibrated)return this.phase;
      this.samples.push({now,g:sample.gyroRaw.slice(),gRad:calibrated.gyroRadS.slice(),a:a.slice(),araw:this.rawAccel(sample)});
      // Rolling stable window: a brief motion doesn't permanently fail and
      // demand another click. The next steady second is accepted automatically.
      const firstAllowed=now-1250;
      while(this.samples.length>0&&this.samples[0].now<firstAllowed)this.samples.shift();
      this.progress=clamp(Math.min((now-this.calibrationStart)/1100, this.samples.length/45),0,1);
      if(this.samples.length<45||now-this.samples[0].now<1050)return this.phase;
      const ma=mean(this.samples.map(s=>s.a)),mg=mean(this.samples.map(s=>s.g));
      const stdA=maxStd(this.samples.map(s=>s.a),ma);
      const stdG=maxStd(this.samples.map(s=>s.g),mg);
      const unitA=normalize(ma),mag=length(ma);
      // A steady-rate yaw turn has near-zero gyro variance and constant ~1g.
      // Without checking the MEAN angular velocity the old code incorrectly
      // learned such intentional motion as a zero-rate sensor bias.
      const meanGyroRate=Math.hypot(...mean(this.samples.map(s=>s.gRad)));
      if(!unitA||mag<.7||mag>1.3||stdA>.09||stdG>65||meanGyroRate>3*Math.PI/180){
        this.status='unstable';
        return this.phase;
      }
      // Pose selection is user guidance, not an arbitrary raw-axis gate.
      // We capture the gravity vector actually observed in the neutral pose.
      this.gyroBias=mg;this.gyroBiasRadS=mean(this.samples.map(s=>s.gRad));
      this.neutralRawGravity=mean(this.samples.map(s=>s.araw));this.neutralGravity=unitA;
      this.q={...ID};this.reference={...ID};this.ready=true;this.status='ready';
      this.lastClock=now;this.lastStamp=sample.sensorTimestamp??null;
      this.samples=[];
      return this.phase;
    }
    if(!this.ready)return this.phase;
    let dt=clamp((now-(this.lastClock??now))/1000,.001,.045);
    this.lastClock=now;
    if(Number.isInteger(sample.sensorTimestamp)&&this.lastStamp!=null){
      const clock=sample.sensorClockHz||3_000_000;
      const ticksMax=2**(sample.sensorTimestampBits||32);
      const ticks=((sample.sensorTimestamp-this.lastStamp)%ticksMax+ticksMax)%ticksMax;
      const deviceDt=ticks/clock;
      if(deviceDt>=.001&&deviceDt<.06)dt=deviceDt;
    }
    this.lastStamp=sample.sensorTimestamp??null;
    // Very small residual rates may be thermal noise/uncalibrated offset.
    // Apply a tiny display-fusion deadband AFTER physical calibration;
    // sensorValues() remains unmodified for diagnostics.
    const quietDegPerSec=.45;
    const omega=this.dps(sample).map(v=>{
      const magnitude=Math.abs(v);
      return Math.sign(v)*Math.max(0,Math.min(1600,magnitude)-quietDegPerSec)*RAD;
    });
    const rate=length(omega);
    if(rate>1e-5)this.q=unit(multiply(this.q,axisAngle(omega.map(v=>v/rate),rate*dt)));
    // Use gravity to correct tilt, not yaw; acceleration during movement is
    // not reliable as an absolute direction. Correct only near 1g.
    const mag=length(a);
    if(mag>.83&&mag<1.17){
      const gravity=normalize(a);
      const predicted=rotate(this.q,gravity);
      const normal=cross(predicted,this.neutralGravity);
      const size=length(normal);
      if(size>1e-6){
        const angle=Math.atan2(size,clamp(dot(predicted,this.neutralGravity),-1,1));
        const weight=1-Math.exp(-dt*2.6);
        const correction=axisAngle(normal.map(v=>v/size),Math.min(angle,.55)*weight);
        this.q=unit(multiply(correction,this.q));
      }
    }
    return this.phase;
  }
}

export const supportedHid=()=>typeof navigator!=='undefined'&&!!navigator.hid&&
  typeof navigator.hid.requestDevice==='function'&&(globalThis.isSecureContext!==false);
