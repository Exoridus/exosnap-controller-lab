// Browser Gamepad API standard mapping. Does not invent proprietary sensor fields.
export const STANDARD_BUTTONS = Object.freeze([
  'b1','b2','b3','b4','l1','r1','l2','r2','select','start','ls','rs','up','down','left','right','home','touchpad'
]);
export const clampUnit = value => Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0;
const rawStickAxes=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?
  {x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))}:{x:0,y:0};
export function deadzonePair(x,y,threshold=0.13) {
  const a=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;
  const b=Number.isFinite(y)?Math.max(-1,Math.min(1,y)):0;
  const r=Math.hypot(a,b);
  if(r<=threshold)return {x:0,y:0,amount:0};
  const size=Math.min(1,r), adjusted=(size-threshold)/(1-threshold);
  return {x:a/r*adjusted,y:b/r*adjusted,amount:adjusted};
}
export function readStandardGamepad(gamepad) {
  if(!gamepad || !gamepad.connected || gamepad.mapping!=='standard')return null;
  const values=new Map();
  STANDARD_BUTTONS.forEach((id,index)=>{
    const btn=gamepad.buttons?.[index];
    // GamepadButton.pressed may already be true for a partially depressed
    // analog trigger. Keep the supplied 0..1 analog value, never inflate to 1.
    const numericValue=Number(btn?.value);
    const value=clampUnit(Number.isFinite(numericValue)&&btn?.value!=null?numericValue:(btn?.pressed?1:0));
    // Index 17 is a Sony touchpad click extension, not universal across pads.
    if(id==='touchpad'&&!/dualsense|dualshock|wireless controller|(?:054c|05c4|09cc|0ce6|0df2)/i.test(gamepad.id))return;
    if(value>0.08 || btn?.pressed)values.set(id,value);
  });
  const left=deadzonePair(gamepad.axes?.[0],gamepad.axes?.[1]);
  const right=deadzonePair(gamepad.axes?.[2],gamepad.axes?.[3]);
  const rawLeft=rawStickAxes(gamepad.axes?.[0],gamepad.axes?.[1]);
  const rawRight=rawStickAxes(gamepad.axes?.[2],gamepad.axes?.[3]);
  return {values,left,right,rawLeft,rawRight,id:gamepad.id,index:gamepad.index,timestamp:gamepad.timestamp||0};
}


// True physical input starts the automatic, previously-authorized sensor path.
export function hasPhysicalInput(state){
  if(!state)return false;
  return [...state.values.values()].some(v=>v>.12) ||
    state.left?.amount>.2 || state.right?.amount>.2;
}

// 3dco+ joystick cap geometry is parented to the corresponding ring. Rotate
// the ring (once), but also highlight its cap when the live stick moves/clicks.
export function inheritedStickControl(filename,parentControl){
  const stem=String(filename).replace(/\.obj$/i,'').toLowerCase();
  const expected=/^(?:thumbstick_)?(left|right)(?:_(?:stick|ring|cap))?$/.exec(stem);
  if(!expected)return null;
  const control=expected[1]==='left'?'ls':'rs';
  return parentControl===control?control:null;
}


export function controlValuesFromGamepad(state){
  if(!state)return new Map();
  const values=new Map(state.values);
  // LS/RS are clickable buttons. Analog stick tilt is read separately from
  // state.left/right and must NOT cause a blue click highlight.

  return values;
}

export function isJoystickTip(filename){
  return /^(?:(?:left|right)_(?:stick|cap)|thumbstick_(?:left|right)(?:_(?:stick|cap))?)\.obj$/i.test(String(filename));
}
