// Stick-click (L3/R3) and analog X/Y motion are independent physical inputs.
// A click alone must never invent a tilt or make a stick orbit in place.
import {gateRadius} from './input-surface-geometry.js';
const unit=n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
export const STICK_VISUAL_DEFAULTS=Object.freeze({innerDeadzone:.05,outerSaturation:.05,maxTiltDeg:16});

export function radialStickAxes(axes,config){
  const neutral={x:0,y:0,amount:0};
  if(axes?.available===false||axes?.supported===false||axes?.status==='Unavailable'||axes?.status==='Unsupported'||!Number.isFinite(axes?.x)||!Number.isFinite(axes?.y))return neutral;
  let inner=config?.innerDeadzone,outer=config?.outerSaturation??config?.outerDeadzone;
  if(!Number.isFinite(inner)||inner<0||inner>=1)inner=STICK_VISUAL_DEFAULTS.innerDeadzone;
  if(!Number.isFinite(outer)||outer<0||outer>=1)outer=STICK_VISUAL_DEFAULTS.outerSaturation;
  if(inner+outer>=1){inner=STICK_VISUAL_DEFAULTS.innerDeadzone;outer=STICK_VISUAL_DEFAULTS.outerSaturation;}
  const scale=Math.max(Math.abs(axes.x),Math.abs(axes.y));
  if(scale===0)return neutral;
  // Scale before normalizing so even finite, over-range inputs cannot overflow the direction.
  const x=axes.x/scale,y=axes.y/scale,length=Math.hypot(x,y);
  const radius=Math.min(1,scale*length);
  if(radius<=inner)return neutral;
  const reach=gateRadius({x,y},config?.gate);
  if(reach===null)return neutral;
  const amount=Math.min(1,(radius-inner)/(1-inner-outer))*reach;
  return {x:x/length*amount,y:y/length*amount,amount};
}

export function stickTiltQuaternion(axes,source,config){
  const identity={x:0,y:0,z:0,w:1};
  if(source!=='co'&&source!=='padforge')return identity;
  const mapped=radialStickAxes(axes,config);
  let maxTiltDeg=config?.maxTiltDeg;
  if(!Number.isFinite(maxTiltDeg)||maxTiltDeg<0)maxTiltDeg=STICK_VISUAL_DEFAULTS.maxTiltDeg;
  if(mapped.amount===0||maxTiltDeg===0)return identity;
  const halfAngle=mapped.amount*maxTiltDeg*(Math.PI/360);
  const direction=source==='padforge'?-1:1,sine=Math.sin(halfAngle);
  return {x:direction*mapped.y/mapped.amount*sine,y:0,z:-direction*mapped.x/mapped.amount*sine,w:Math.cos(halfAngle)};
}

export function demoStickAxes(now,side){
  const t=Math.max(0,Number(now)||0);
  return side==='left'?{x:.54*Math.sin(t/730),y:.58*Math.cos(t/630)}:
    {x:.45*Math.sin(t/940),y:.6*Math.cos(t/850)};
}
export function stickTiltAngles(axes,source){
  const x=unit(axes?.x),y=unit(axes?.y);
  const inverted=source==='padforge';
  return {x:(inverted?-y:y)*.22,z:(inverted?x:-x)*.22};
}
