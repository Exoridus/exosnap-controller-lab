// The 3dco+ OBJ files carry local vertex positions and their info.json adds
// parent transforms. Re-centering a child before parenting double-translates
// its geometry, moving thumbstick caps away from their shafts.
export function controllerPartTransform(source,meta,center){
  const p=Array.isArray(meta?.position)?meta.position.map(Number):[0,0,0];
  if(source==='co'||source==='exo')return {pivot:p,geometryOffset:[0,0,0]};
  return {pivot:center.map((v,i)=>v+p[i]),geometryOffset:center.map(v=>-v)};
}

export function isFlatThumbCap({radius,height}){
  return radius>0 && height>=0 && height<radius*.35;
}

// Lathed rubber thumb cap with a deep side wall, raised rim and recessed
// dish. The source analog stem/ring remain genuine upstream OBJ meshes.
export function thumbstickCapProfile({radius,top}){
  const r=radius,y=top;
  return [
    [0,y-.30*r],
    [.55*r,y-.30*r],
    [.85*r,y-.27*r],
    [1.06*r,y-.16*r],
    [1.12*r,y-.05*r],
    [1.12*r,y+.085*r],
    [1.06*r,y+.16*r],
    [.93*r,y+.16*r],
    [.79*r,y+.055*r],
    [.44*r,y+.018*r],
    [0,y+.024*r]
  ];
}

// v21: add a side-wall to thin legacy OBJ caps while KEEPING their actual
// textured top surface (knurling, notches, octagonal C-stick, etc.). Each
// profile is intentionally different; no single generic replacement cap.
// Coordinates: (radius-factor, height above original cap top / source radius).
// Start underneath the existing OBJ top; round over a raised *hollow* lip.
// The center is intentionally unfilled: upstream rubber top/texture remains.
const SKIRT_PROFILES=Object.freeze({
  sony:   [[.56,-.42],[.76,-.40],[.91,-.31],[1.02,-.18],[1.065,-.075],[1.07,.035],[1.03,.10],[.97,.125],[.88,.105],[.81,.045],[.76,-.006]],
  xbox:   [[.55,-.42],[.75,-.40],[.91,-.30],[1.015,-.17],[1.05,-.06],[1.04,.045],[1.00,.115],[.92,.13],[.83,.082],[.77,.01]],
  switch: [[.51,-.35],[.72,-.33],[.91,-.24],[1.025,-.13],[1.045,-.03],[1.01,.09],[.95,.13],[.84,.085],[.78,.01]],
  joycon: [[.48,-.27],[.71,-.26],[.90,-.21],[1.01,-.10],[1.02,-.035],[.98,.065],[.91,.097],[.82,.06],[.75,.0]],
  gamecubeMain:[[.46,-.45],[.74,-.43],[.91,-.32],[1.055,-.18],[1.065,-.065],[1.03,.075],[.98,.125],[.88,.085],[.78,.01]],
  gamecubeC: [[.43,-.27],[.68,-.27],[.86,-.22],[.95,-.12],[.97,-.04],[.935,.055],[.89,.075],[.80,.04],[.73,-.005]],
  steam:  [[.54,-.39],[.76,-.37],[.92,-.29],[1.045,-.16],[1.05,-.065],[1.03,.045],[.985,.12],[.91,.12],[.81,.06],[.75,-.006]],
});
export function thumbstickCapStyle(modelId,side='left'){
  if(['DualSenseCompact','DS4Compact'].includes(modelId))return 'sony';
  if(['XboxOneClean','XboxSeries','GenericPro'].includes(modelId))return 'xbox';
  if(modelId==='SwitchPro')return 'switch';
  if(['JoyconGrip','JoyconLeft','JoyconRight'].includes(modelId))return 'joycon';
  if(['Gamecube','Wavebird'].includes(modelId))return side==='right'?'gamecubeC':'gamecubeMain';
  return 'steam';
}
export function thumbstickCapSkirtProfile({radius,top,modelId,side='left'}){
  if(!(Number.isFinite(radius)&&radius>0&&Number.isFinite(top)))throw new Error('Invalid cap geometry');
  const kind=thumbstickCapStyle(modelId,side);
  return SKIRT_PROFILES[kind].map(([r,y])=>[r*radius,top+y*radius]);
}
// Add a shallow cupped or domed surface to source OBJ caps while preserving
// every original vertex and all source-authored notches/knurling. This is not
// a flat replacement disc and requires no extra textures.
const TOP_CURVE=Object.freeze({
  sony:-.095, xbox:-.080, switch:-.080, joycon:.055,
  gamecubeMain:.065, gamecubeC:.035, steam:-.085,
});
export function thumbstickTopDisplacement({radius,distance,modelId,side='left'}){
  if(!(Number.isFinite(radius)&&radius>0&&Number.isFinite(distance)))return 0;
  const r=Math.max(0,Math.min(1,distance/radius));
  return TOP_CURVE[thumbstickCapStyle(modelId,side)]*radius*(1-r*r);
}
export function thumbstickCapRadialSegments(modelId,control='ls'){
  return ['Gamecube','Wavebird'].includes(modelId)&&control==='rs'?8:48;
}
