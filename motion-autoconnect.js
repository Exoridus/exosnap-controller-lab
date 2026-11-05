// Browser permission policy: this only picks from devices previously granted
// through a real user gesture (navigator.hid.requestDevice()). No permission
// prompt is initiated from the render loop.
import { identifyMotionProfile } from './sensor-profiles.js';

function knownFamily(name){
  const id=String(name||'').toLowerCase();
  if(/dual\s*sense|dualsense|ps5 controller/.test(id))return 'dualsense';
  if(/dual\s*shock\s*4|dualshock 4|playstation 4/.test(id))return 'ds4';
  if(/joy.?con.*(left|\(l\)|-l\b)/.test(id))return 'joycon-left';
  if(/joy.?con.*(right|\(r\)|-r\b)/.test(id))return 'joycon-right';
  if(/switch.*pro|pro controller/.test(id))return 'switch';
  return null;
}
export function matchAuthorizedSensor(gamepad,devices=[]){
  if(!gamepad || !Array.isArray(devices))return null;
  const id=String(gamepad.id||'');
  const available=devices.filter(d=>identifyMotionProfile(d));
  // Chromium often embeds VID/PID in the standard Gamepad ID.
  const match=/vendor\s*:\s*([0-9a-f]{4})[\s\S]*?product\s*:\s*([0-9a-f]{4})/i.exec(id);
  if(match){
    const vid=parseInt(match[1],16), pid=parseInt(match[2],16);
    const exact=available.filter(d=>d.vendorId===vid && d.productId===pid);
    return exact.length===1?exact[0]:null;
  }
  const family=knownFamily(id);
  if(!family)return null;
  const matching=available.filter(d=>identifyMotionProfile(d)?.id===family);
  return matching.length===1?matching[0]:null;
}

export async function findApprovedSensorForGamepad(gamepad,hid){
  if(!gamepad || typeof hid?.getDevices!=='function')return null;
  return matchAuthorizedSensor(gamepad,await hid.getDevices());
}
