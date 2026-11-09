// Shared values for the browser material preview. Opacity is actual base alpha;
// rim and contour contribute separately, not as a hidden multiplier.
const clamp=(v)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const normal=Object.freeze({shell:1,control:1,cap:1,rim:.18,contour:0,shadow:0,rear:0,inner:.15});
const glass=Object.freeze({shell:.26,control:.62,cap:.70,rim:.38,contour:0,shadow:.02,rear:.20,inner:.10});
const ghost=Object.freeze({shell:.06,control:.36,cap:.50,rim:.50,contour:0,shadow:0,rear:.30,inner:.03});
export const STYLE_PRESETS=Object.freeze({normal,glass,ghost});
export function styleAt(value){
  const v=clamp(value);
  if(v===0)return {...normal};
  if(v===.5)return {...glass};
  if(v===1)return {...ghost};
  const left=v<.5?normal:glass;
  const right=v<.5?glass:ghost;
  const t=v<.5?v*2:(v-.5)*2;
  const k=t*t*(3-2*t);
  return Object.fromEntries(Object.keys(normal).map(key=>[key,left[key]+(right[key]-left[key])*k]));
}
export function styleName(value){
  const v=clamp(value);
  return v<=.02?'Normal':v>=.98?'Ghost':Math.abs(v-.5)<.025?'Glass':`Mix ${Math.round(v*100)} %`;
}
