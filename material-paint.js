// Renderer-neutral material colors/alpha for native SVG references. No geometry
// replacement: 2D and Three.js receive the same semantic recipe and blue.
import {EXO_PALETTE} from './palette.js';
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,Number.isFinite(v)?v:lo));
const OUTLINES=Object.freeze({
  dark:{stroke:EXO_PALETTE.strokeDark,outline:EXO_PALETTE.outlineDarkScene,glyph:'#f0f7fc'},
  light:{stroke:EXO_PALETTE.strokeLight,outline:EXO_PALETTE.outlineLight,glyph:'#344b60'},
  mixed:{stroke:'#9fbfd4',outline:'#dae8f2',glyph:'#d6e9f5'},
});
export function appearanceCacheKey(recipe,scene='dark'){
  const p=resolve2DPaint(recipe,scene);
  return [recipe.variant,Number(recipe.mix).toFixed(4),scene,p.pressedBlue,p.emission.color,
    p.pressedEdge,p.shellFill,p.idleControl,p.neutralStick,p.neutralTrigger,p.shellOpacity.toFixed(4),p.controlsOpacity.toFixed(4),
    p.outlineColor,p.strokeColor,p.strokeOpacity.toFixed(4)].join('|');
}
export function resolve2DPaint(recipe,scene='dark'){
  if(!recipe?.material?.shell||!recipe.material.controls)throw new TypeError('A PBR material recipe is required');
  const shell=recipe.material.shell,controls=recipe.material.controls;
  const look=OUTLINES[scene]||OUTLINES.dark;
  const mix=clamp(recipe.mix);
  const visibilityBoost=scene==='light'?1.42:scene==='mixed'?1.20:1;
  const shellOpacity=clamp(shell.opacity*.64*visibilityBoost,.035,.72);
  const controlsOpacity=Math.max(shellOpacity,clamp(controls.opacity*.75*visibilityBoost,.08,.83));
  const pressedOpacity=1; // LED face is opaque even in Ghost; idle surfaces remain translucent.
  return Object.freeze({
    shellFill:scene==='light'?'#6c8192':scene==='mixed'?'#7c98aa':shell.ghostTint,
    idleControl:controls.idleTint||EXO_PALETTE.idleControl,
    neutralStick:EXO_PALETTE.neutralStick,
    neutralTrigger:EXO_PALETTE.neutralTrigger,
    shellOpacity,controlsOpacity,pressedOpacity,
    pressedBlue:recipe.material.pressBlue||EXO_PALETTE.pressedSurface,pressedEdge:EXO_PALETTE.pressedEdge,
    outlineColor:look.outline,strokeColor:look.stroke,glyphColor:look.glyph,
    strokeOpacity:clamp(.66+.18*mix),
    emission:{color:EXO_PALETTE.pressedEmissive,intensity:recipe.material.pressEmissiveIntensity??.55},
  });
}
