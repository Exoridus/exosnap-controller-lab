// WebHID IMU adapters. Sony and Nintendo raw reports are hardware-specific;
// outputs use the SDL3 physical convention: angular velocity rad/s,
// acceleration m/s². Model/world-axis mapping happens AFTER conversion.
// Based on SDL3 HIDAPI (zlib license); independently written JS decode.
import {SONY_VENDOR_ID,DUALSENSE_PRODUCT_IDS} from './motion-input.js';
const RAD=Math.PI/180;
const G=9.80665;
const DS4_PIDS=[0x05c4,0x09cc];
const NINTENDO_VENDOR=0x057e;
const SWITCH_PIDS=Object.freeze({0x2009:'switch',0x2006:'joycon-left',0x2007:'joycon-right'});
const PROFILES=Object.freeze([
  ...DUALSENSE_PRODUCT_IDS.map(productId=>({vendorId:SONY_VENDOR_ID,productId,id:'dualsense',name:'DualSense / Edge'})),
  ...DS4_PIDS.map(productId=>({vendorId:SONY_VENDOR_ID,productId,id:'ds4',name:'DualShock 4'})),
  ...Object.entries(SWITCH_PIDS).map(([productId,id])=>({vendorId:NINTENDO_VENDOR,productId:Number(productId),id,name:{switch:'Switch Pro','joycon-left':'Joy-Con L','joycon-right':'Joy-Con R'}[id]}))
]);
export function identifyMotionProfile(device){return PROFILES.find(p=>p.vendorId===device?.vendorId&&p.productId===device?.productId)||null;}
export function motionFilters(){return PROFILES.map(({vendorId,productId})=>({vendorId,productId}));}
const isDataView=d=>d instanceof DataView;
const signedArray=(v,o,n=3)=>Array.from({length:n},(_,i)=>v.getInt16(o+i*2,true));

export function parseDualShock4Motion(reportId,data){
  if(!isDataView(data))return null;
  // WebHID omits the report ID; BT extended 0x11-0x19 has two extra header bytes.
  const offset=reportId===0x01&&data.byteLength>=30?0:
     reportId>=0x11&&reportId<=0x19&&data.byteLength>=32?2:-1;
  if(offset<0||data.byteLength<offset+24)return null;
  return {gyroRaw:signedArray(data,offset+12),accelRaw:signedArray(data,offset+18),
    sensorTimestamp:data.getUint16(offset+9,true),sensorClockHz:187500,sensorTimestampBits:16};
}
// DS4 factory calibration: first 34 bytes after report ID. USB plus/minus
// interleaved; Bluetooth group all plus values, then all minus values.
export function parseDualShock4Calibration(view,{bluetooth=false,reportIdIncluded=false}={}){
  if(!isDataView(view)||view.byteLength<34)return null;
  // WebHID already strips the report ID; do not mistake a matching bias byte for one.
  const offset=reportIdIncluded?1:0;
  if(view.byteLength-offset<34)return null;
  const s=n=>view.getInt16(offset+n,true);
  const gyroBias=[0,2,4].map(s);
  const pos=[0,1,2].map(i=>s(bluetooth?6+2*i:6+4*i));
  const neg=[0,1,2].map(i=>s(bluetooth?12+2*i:8+4*i));
  const speed=s(18)+s(20);
  if(!Number.isFinite(speed)||speed<=0)return null;
  const accelPos=[22,26,30].map(s),accelNeg=[24,28,32].map(s);
  const gyroRadSPerCount=[],accelMS2PerCount=[],accelBias=[];
  for(let i=0;i<3;i++){
    const divisor=Math.abs(pos[i]-gyroBias[i])+Math.abs(neg[i]-gyroBias[i]);
    const accelRange=accelPos[i]-accelNeg[i];
    if(divisor<=0||accelRange<=0)return null;
    // SDL's default gyro_numerator/denominator is 1/16.
    const scale=speed/divisor*RAD;
    const accelScale=2*G/accelRange;
    gyroRadSPerCount.push(scale);
    accelMS2PerCount.push(accelScale);
    accelBias.push(accelPos[i]-Math.trunc(accelRange/2));
  }
  // SDL sanity threshold: within 50% of expected default sensitivity and bias <= 1024.
  const gyroDefault=RAD/16,accelDefault=G/8192;
  if(gyroBias.some(v=>Math.abs(v)>1024)||accelBias.some(v=>Math.abs(v)>1024))return null;
  if(gyroRadSPerCount.some(v=>!Number.isFinite(v)||Math.abs(v/gyroDefault-1)>.5) ||
     accelMS2PerCount.some(v=>!Number.isFinite(v)||Math.abs(v/accelDefault-1)>.5))return null;
  return {gyroBias,accelBias,gyroRadSPerCount,accelMS2PerCount};
}
export function normalizeDualShock4(sample,cal=null){
  if(!sample||!Array.isArray(sample.gyroRaw)||!Array.isArray(sample.accelRaw))return null;
  const gyroRadS=sample.gyroRaw.map((v,i)=>(v-(cal?.gyroBias?.[i]||0))*(cal?.gyroRadSPerCount?.[i]??RAD/16));
  const accelMS2=sample.accelRaw.map((v,i)=>(v-(cal?.accelBias?.[i]||0))*(cal?.accelMS2PerCount?.[i]??G/8192));
  return {...sample,gyroRadS,accelMS2,source:cal?'factory':'fallback'};
}

export function parseSwitchMotion(reportId,view){
  if(reportId!==0x30||!isDataView(view)||view.byteLength<48)return null;
  const samples=[];
  for(let j=0;j<3;j++){
    const b=12+j*12;
    samples.push({gyroRaw:signedArray(view,b+6),accelRaw:signedArray(view,b),
      sensorTimestamp:null,sensorClockHz:0,sensorTimestampBits:0});
  }
  return samples;
}
export function parseSwitchImuCalibration(view){
  if(!isDataView(view)||view.byteLength<24)return null;
  const a=signedArray(view,0),as=signedArray(view,6),g=signedArray(view,12),gs=signedArray(view,18);
  const accelMS2PerCount=[],gyroRadSPerCount=[];
  for(let i=0;i<3;i++){
    if(as[i]-a[i]<=0||gs[i]-g[i]<=0)return null;
    const acc=4*G/(as[i]-a[i]),gyro=936*RAD/(gs[i]-g[i]);
    if(!(acc>0&&gyro>0)||!(acc<.02&&gyro<.1))return null;
    accelMS2PerCount.push(acc);gyroRadSPerCount.push(gyro);
  }
  return {gyroBias:g,accelMS2PerCount,gyroRadSPerCount};
}
// SDL Switch HIDAPI checks the 0xA1B2 magic in optional SPI user-calibration
// 0x8026. It overrides offsets but retains factory sensitivity coefficients.
export function applySwitchUserCalibration(factory,view){
  if(!factory||!(view instanceof DataView)||view.byteLength<20||
     view.getUint16(0,true)!==0xa1b2)return factory;
  const bias=[14,16,18].map(n=>view.getInt16(n,true));
  if(bias.some(x=>Math.abs(x)>2048))return factory;
  return {...factory,gyroBias:bias,source:'user'};
}
// SDL switch.cpp uses [-Y,+Z,-X] on both gyro and accel, with X/Y
// negated for the right Joy-Con to restore consistent physical orientation.
function toSdlAxes(values,id){
  const result=[-values[1],values[2],-values[0]];
  if(id==='joycon-right'){result[0]*=-1;result[1]*=-1;}
  return result;
}
export function normalizeSwitchMotion(sample,cal=null,id='switch'){
  if(!sample||!Array.isArray(sample.gyroRaw)||!Array.isArray(sample.accelRaw))return null;
  const gyroLocal=sample.gyroRaw.map((v,i)=>(v-(cal?.gyroBias?.[i]||0))*(cal?.gyroRadSPerCount?.[i]??RAD/14.2842));
  const accelLocal=sample.accelRaw.map((v,i)=>v*(cal?.accelMS2PerCount?.[i]??G/4096));
  return {...sample,gyroRadS:toSdlAxes(gyroLocal,id),accelMS2:toSdlAxes(accelLocal,id),source:cal?.source|| (cal?'factory':'fallback')};
}
let counter=0;
export function switchSubcommandPacket(subcommand,args=[],number=counter++){
  const data=new Uint8Array(49);
  data[0]=number&0x0f;
  data.set([0,1,0x40,0x40,0,1,0x40,0x40],1);
  data[9]=subcommand;
  data.set(args,10);
  return data;
}
export function parseSwitchSpiReply(reportId,data,address,size){
  if(reportId!==0x21||!isDataView(data)||data.byteLength<20+size)return null;
  if(data.getUint8(14)!==0x10)return null;
  if(data.getUint32(15,true)!==address||data.getUint8(19)!==size)return null;
  return new Uint8Array(data.buffer.slice(data.byteOffset+20,data.byteOffset+20+size));
}
