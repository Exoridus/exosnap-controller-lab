const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
// A control's own material is translucent at rest and clearly visible while
// pressed. Do not reuse shell alpha for controls.
export function ghostControlAlpha(restOpacity,pressedAmount) {
  return clamp(restOpacity)+(1-clamp(restOpacity))*clamp(pressedAmount);
}

// One consistent blue pressed-state across buttons, D-pad, bumpers and triggers.
export function pressedControlStyle(idleOpacity, pressedAmount){
  const amount=clamp(pressedAmount);
  return {
    opacity:ghostControlAlpha(idleOpacity,amount),
    glow:1.15*amount,
    color:'#55baff'
  };
}

// Distinct idle input outlines keep translucent controls findable without
// making the whole stick light up when its analog axes move.
export function ghostControlContourOpacity(strength){
  return clamp(strength)*.78;
}

// High-contrast dual stroke works on both dark and bright game captures.
// Uses screen-space widths, unlike WebGL's commonly fixed 1px gl.LINES.
export function ghostOutlineStyle({strength=.5,kind='control',brightBackground=false}={}){
  const s=clamp(strength);
  const control=kind==='control';
  return {
    shadowColor:'#07121e',
    highlightColor:control?'#e8f6ff':'#b9d5e9',
    shadowWidthPx:control?3.3:2.8,
    highlightWidthPx:control?1.45:1.2,
    shadowOpacity:(brightBackground?.77:.52)*s/.5,
    highlightOpacity:(control?.83:.69)*s/.5
  };
}
export function isSecondaryHousing(file){
  return /(^|[_-])(bottom[_-]?shell|back[_-]?shell|body[_-]?back|mainbodyback|battery[_-]?door)(\.|_|$)/i.test(String(file));
}
export function ghostShellSurfaceOpacity(file,restOpacity){
  return clamp(restOpacity)*.35*(isSecondaryHousing(file)?.18:1);
}

export function ghostShellFragmentShader(source,strength){
  const anchor='#include <opaque_fragment>';
  if(!source.includes(anchor))throw new Error('Unsupported physical shader output chunk');
  const amount=clamp(strength).toFixed(4);
  return source.replace(anchor,`float ghostFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
    float ghostRim = pow(clamp(1.0 - ghostFacing, 0.0, 1.0), 4.0);
    float ghostEdge = 1.0 - smoothstep(0.0, 0.12, ghostFacing);
    outgoingLight = mix(outgoingLight, vec3(0.65, 0.78, 0.90), ghostRim);
    outgoingLight = mix(outgoingLight, vec3(0.018, 0.03, 0.045), ghostEdge);
    diffuseColor.a = min(0.85, diffuseColor.a + ${amount} * ghostRim + 0.35 * ghostEdge);
    ${anchor}`);
}
