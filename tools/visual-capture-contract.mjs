/** Pure release gate: only actual, successfully completed Three.js frames count. */
export const REQUIRED_LOOKS=Object.freeze(['white']);
export function verifyRenderedState(state){
  if(state?.status!=='three-rendered')throw Error('WebGL renderer has not produced an accepted 3D frame');
  if(state.sampleCount!==3)throw Error(`Expected three visible 3D panels, got ${state.sampleCount}`);
  if(state.nontransparentPixels!==undefined&&state.nontransparentPixels<250)throw Error('Offscreen 3D target has too few nontransparent pixels');
  for(const key of REQUIRED_LOOKS){
    const stats=state.drawStats?.[key];
    if(!stats||!(stats.calls>0)||!((stats.sourceCalls??stats.calls)>0))throw Error(`Missing real GPU draw counts for look ${key}`);
  }
  return true;
}
