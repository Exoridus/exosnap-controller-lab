// Renderer-neutral, independently usable with Three.js and Qt Quick 3D.
// Movement brightens a thumbstick; only L3/R3 click marks it pressed.
const clamp=(n)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export function normalizeStickInput({x=0,y=0,click=false}={}){
  const xx=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;
  const yy=Number.isFinite(y)?Math.max(-1,Math.min(1,y)):0;
  const length=Math.min(1,Math.hypot(xx,yy));
  const activity=clamp((length-.08)/.92);
  return {x:xx,y:yy,activity,click:!!click};
}
export function stickVisualState(stick){
  const moving=clamp(stick?.activity??0);
  const click=stick?.click?1:0;
  return {moving,click,colorWeight:clamp(.27*moving+.56*click),
    opacityBoost:Math.min(.70,.08*moving+.44*click),glow:.06*moving+.17*click};
}
export function poseForStickDemo(mode){
  switch(mode){
    case 'move':return {left:normalizeStickInput({x:.7,y:.5}),right:normalizeStickInput({x:-.6,y:.6})};
    case 'click':return {left:normalizeStickInput({x:.7,y:.5,click:true}),right:normalizeStickInput({x:-.6,y:.6,click:true})};
    default:return {left:normalizeStickInput(),right:normalizeStickInput()};
  }
}
