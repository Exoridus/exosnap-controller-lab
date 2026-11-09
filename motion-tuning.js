// Display-only motion tuning. Physical IMU values and fusion are never scaled.
// Shared roll/yaw and overall 3D caps constrain angular coordinates (degrees).
export const MOTION_TUNING_STORAGE_KEY='exosnap-controller3d-motion-tuning-v3';
const V17_STORAGE_KEY='exosnap-controller3d-motion-tuning-v2';
const LEGACY_STORAGE_KEY='exosnap-controller3d-motion-tuning-v1';
export const MOTION_TUNING_DEFAULTS=Object.freeze({
  pitchGain:.90,rollGain:.90,yawGain:.90,
  pitchMaxDeg:20,rollMaxDeg:20,yawMaxDeg:20,
  rollYawCombinedMaxDeg:20,totalCombinedMaxDeg:25,
  deadzoneDeg:.20,responseMs:50,autoReturn:false,adaptiveHand:false,
  returnDelayMs:850,returnHalfLifeMs:1350
});
// Presets affect the overlay, not sensor calibration. Auto-recenter is independent.
const TUNABLE_KEYS=Object.freeze(['pitchGain','rollGain','yawGain','pitchMaxDeg','rollMaxDeg','yawMaxDeg','rollYawCombinedMaxDeg','totalCombinedMaxDeg','deadzoneDeg','responseMs','adaptiveHand']);
export const MOTION_TUNING_PRESETS=Object.freeze({
  comfort:Object.freeze({...MOTION_TUNING_DEFAULTS}),
  adaptive60:Object.freeze({...MOTION_TUNING_DEFAULTS,adaptiveHand:true,autoReturn:false,
    totalCombinedMaxDeg:20,rollYawCombinedMaxDeg:20,responseMs:45}),
  balanced:Object.freeze({...MOTION_TUNING_DEFAULTS,pitchGain:.90,rollGain:.90,yawGain:.88,
    pitchMaxDeg:28,rollMaxDeg:25,yawMaxDeg:25,rollYawCombinedMaxDeg:28,totalCombinedMaxDeg:35,deadzoneDeg:.20,responseMs:55}),
  dynamic:Object.freeze({...MOTION_TUNING_DEFAULTS,pitchGain:.95,rollGain:.95,yawGain:.95,
    pitchMaxDeg:40,rollMaxDeg:30,yawMaxDeg:42,rollYawCombinedMaxDeg:45,totalCombinedMaxDeg:55,
    deadzoneDeg:.10,responseMs:35})
});
export function matchMotionPreset(options){
  const opts=sanitizeMotionTuning(options);
  for(const [name,preset] of Object.entries(MOTION_TUNING_PRESETS)){
    if(TUNABLE_KEYS.every(k=>Math.abs(opts[k]-preset[k])<1e-7))return name;
  }
  return 'custom';
}
const bounds=Object.freeze({
  pitchGain:[.10,1.5],rollGain:[.10,1.5],yawGain:[.10,1.5],
  pitchMaxDeg:[10,65],rollMaxDeg:[8,45],yawMaxDeg:[8,70],
  rollYawCombinedMaxDeg:[8,70],totalCombinedMaxDeg:[10,70],
  deadzoneDeg:[0,3],responseMs:[25,180],
  returnDelayMs:[100,3000],returnHalfLifeMs:[200,4000]
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function sanitizeMotionTuning(raw={}){
  const input=raw&&typeof raw==='object'?raw:{};
  const result={};
  for(const [key,defaultValue] of Object.entries(MOTION_TUNING_DEFAULTS)){
    if(key==='autoReturn'||key==='adaptiveHand'){
      result[key]=typeof input[key]==='boolean'?input[key]:defaultValue;
    }else{
      const value=Number(input[key]);
      const [lo,hi]=bounds[key];
      result[key]=(input[key]===undefined || input[key]===null || typeof input[key]==='boolean' || input[key]==='' || !Number.isFinite(value))
        ?defaultValue:clamp(value,lo,hi);
    }
  }
  return result;
}
// Preserve deliberate v15 custom tuning. Old untouched presets inherit new v16
// defaults instead of silently overriding the requested new defaults.
const LEGACY_PRESETS=Object.freeze([
  {pitchGain:.75,rollGain:.65,yawGain:.55,pitchMaxDeg:35,rollMaxDeg:22,yawMaxDeg:25,deadzoneDeg:.35,responseMs:65},
  {pitchGain:.82,rollGain:.78,yawGain:.72,pitchMaxDeg:35,rollMaxDeg:26,yawMaxDeg:32,deadzoneDeg:.25,responseMs:65},
  {pitchGain:.95,rollGain:.90,yawGain:.88,pitchMaxDeg:40,rollMaxDeg:30,yawMaxDeg:42,deadzoneDeg:.15,responseMs:50}
]);
const legacyPreset=raw=>LEGACY_PRESETS.some(preset=>
  Object.entries(preset).every(([key,value])=>Math.abs(Number(raw[key])-value)<1e-7));
export function loadMotionTuning(storage){
  try {
    const current=storage?.getItem(MOTION_TUNING_STORAGE_KEY);
    if(current!=null)return sanitizeMotionTuning(JSON.parse(current));
    const v17=storage?.getItem(V17_STORAGE_KEY);
    if(v17!=null)return sanitizeMotionTuning({...JSON.parse(v17),adaptiveHand:false});
    const old=storage?.getItem(LEGACY_STORAGE_KEY);
    if(old!=null){
      const config=JSON.parse(old);
      if(config&&legacyPreset(config))return sanitizeMotionTuning({autoReturn:config.autoReturn});
      return sanitizeMotionTuning(config);
    }
  }catch{/* Use safe defaults on invalid or inaccessible browser storage */}
  return sanitizeMotionTuning();
}
export function saveMotionTuning(storage,settings){
  try {storage?.setItem(MOTION_TUNING_STORAGE_KEY,JSON.stringify(sanitizeMotionTuning(settings)));return true;}
  catch{return false;}
}
