// A deterministic, synthetic maximum-deflection pose for the six-up comparison.
// Gamepad axes: +x right, +y down. This is NEVER read as live hardware input.
export const STICK_TEST_INTERVAL_MS = 3000;
export const STICK_TEST_BLEND_MS = 220;
const diagonal = Math.SQRT1_2;
export const STICK_TEST_DIRECTIONS = Object.freeze([
  Object.freeze({id:'up-right',label:'↗ Oben rechts',x:diagonal,y:-diagonal}),
  Object.freeze({id:'right',label:'→ Rechts',x:1,y:0}),
  Object.freeze({id:'down-right',label:'↘ Unten rechts',x:diagonal,y:diagonal}),
  Object.freeze({id:'down',label:'↓ Unten',x:0,y:1}),
  Object.freeze({id:'down-left',label:'↙ Unten links',x:-diagonal,y:diagonal}),
  Object.freeze({id:'left',label:'← Links',x:-1,y:0}),
  Object.freeze({id:'up-left',label:'↖ Oben links',x:-diagonal,y:-diagonal}),
  Object.freeze({id:'up',label:'↑ Oben',x:0,y:-1}),
]);

/**
 * @returns {{x:number,y:number,id:string,label:string,index:number,auto:boolean}}
 * Both sticks receive this exact pose. In automatic mode it changes every 3 s
 * with a brief spherical-normalized blend, never reducing stick magnitude.
 */
export function previewStickPose(now, mode='auto', startedAt=0){
  if(mode !== 'auto'){
    const fixed=STICK_TEST_DIRECTIONS.find(p=>p.id===mode);
    if(!fixed)throw new RangeError('Unknown stick test direction: '+mode);
    return {...fixed,index:STICK_TEST_DIRECTIONS.indexOf(fixed),auto:false};
  }
  const elapsed=Math.max(0,(Number.isFinite(now)?now:0)-(Number.isFinite(startedAt)?startedAt:0));
  const index=Math.floor(elapsed/STICK_TEST_INTERVAL_MS)%STICK_TEST_DIRECTIONS.length;
  const target=STICK_TEST_DIRECTIONS[index];
  const phase=elapsed%STICK_TEST_INTERVAL_MS;
  if(elapsed<STICK_TEST_INTERVAL_MS||phase>=STICK_TEST_BLEND_MS){
    return {...target,index,auto:true};
  }
  const previous=STICK_TEST_DIRECTIONS[(index+STICK_TEST_DIRECTIONS.length-1)%STICK_TEST_DIRECTIONS.length];
  const t=phase/STICK_TEST_BLEND_MS;
  const eased=t*t*(3-2*t);
  const vx=previous.x+(target.x-previous.x)*eased;
  const vy=previous.y+(target.y-previous.y)*eased;
  const length=Math.hypot(vx,vy);
  return {...target,x:vx/length,y:vy/length,index,auto:true};
}
