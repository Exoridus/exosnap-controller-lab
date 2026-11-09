// Qt-free and renderer-free policy: one static shell, individual physical controls.
export const V24_STICK_MODELS = Object.freeze(['DualSenseCompact','XboxOneClean','SwitchPro']);
export const V24_PROFILES = Object.freeze({
  DualSenseCompact: Object.freeze({radius:1, height:.31, lip:.115, dish:.11, segments:32, shaftSegments:16, maxTiltDeg:14}),
  XboxOneClean: Object.freeze({radius:1.03, height:.35, lip:.12, dish:.13, segments:32, shaftSegments:16, maxTiltDeg:17}),
  SwitchPro: Object.freeze({radius:.96, height:.28, lip:.095, dish:.09, segments:32, shaftSegments:16, maxTiltDeg:15})
});
export function stickProfile(modelId){return V24_PROFILES[modelId]||null;}
export function isStaticBodyRole(role,control,hasAnimatedParent=false){
  return !control && !hasAnimatedParent && (role==='housing'||role==='decoration');
}
export function staticBodyBucket(file){
  const s=String(file).toLowerCase();
  if(/bottom|back[_-]?shell|battery|bodyback|undercarriage/.test(s))return 'rear';
  if(/top[_-]?shell|mainbody|front[_-]?shell|bodyfront/.test(s))return 'front';
  return 'trim';
}
export function useRearHint(role,key){
  return role==='paddle' || ['l1','r1','l2','r2'].includes(key);
}
export function ghostPressOpacity(idle,amount){
  return Math.max(0,Math.min(1,idle))+(1-Math.max(0,Math.min(1,idle)))*Math.max(0,Math.min(1,amount));
}
export function capProfile(modelId,radius,height,top){
  const p=stickProfile(modelId);
  if(!p||!(radius>0)||!(height>=0)||!Number.isFinite(top))return null;
  // Bottom -> outside grip -> raised lip -> cupped upper surface -> axis.
  const r=radius*p.radius;
  return [
    [0,top-height],[.50*r,top-height],[.73*r,top-height*.85],
    [.92*r,top-height*.60],[1.00*r,top-height*.35],
    [1.02*r,top+.005*r],[.985*r,top+p.lip*r],
    [.87*r,top+(p.lip+.012)*r],[.73*r,top+(p.lip-.022)*r],
    [.49*r,top+(p.lip-p.dish*.60)*r],
    [.20*r,top+(p.lip-p.dish)*r],[0,top+(p.lip-p.dish)*r]
  ];
}
export function pressTravelFor(key,source='co'){
  if(key==='select'||key==='start')return {x:0,y:source==='co' ? -.003 : 0,z:source==='co'?0:-.003};
  if(key==='l1'||key==='r1')return {x:0,y:source==='co'?-.008:0,z:source==='co'?.003:-.006};
  if(['l2','r2'].includes(key))return {x:0,y:0,z:0};
  return {x:0,y:source==='co'?-.008:0,z:source==='co'?0:-.008};
}
