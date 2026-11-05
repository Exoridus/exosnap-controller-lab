// Shared renderer-neutral state palette (2D SVG, Three.js, native Qt recipe).
// The physical stick socket is still modeled, but NEVER has an idle blue halo.
export const EXO_PALETTE=Object.freeze({
  idleControl:'#a4c5df',
  neutralStick:'#e6eff6',
  neutralStickSocket:'#52606e',
  movingControl:'#bbdcf5',
  neutralTrigger:'#e6eff6',
  pressedBlue:'#4f9eeb',
  pressedSurface:'#4f9eeb',
  pressedEmissive:'#85c4fa',
  pressedEdge:'#a2d5f5',
  glyphLight:'#dcecf7',
  outlineDark:'#344b60',
  lightLine:[46,67,89],
  strokeDark:'#c1d8e9',outlineDarkScene:'#d6e9f5',
  strokeLight:'#435b70',outlineLight:'#344b60',
});
const unit=x=>Math.max(0,Math.min(1,Number.isFinite(Number(x))?Number(x):0));
export function blendHexColor(start,end,amount){
  const t=unit(amount);
  if(!/^#[0-9a-f]{6}$/i.test(start)||!/^#[0-9a-f]{6}$/i.test(end))throw TypeError('Expected #RRGGBB colors');
  return '#'+[1,3,5].map(i=>{
    const a=parseInt(start.slice(i,i+2),16),b=parseInt(end.slice(i,i+2),16);
    return Math.round(a+(b-a)*t).toString(16).padStart(2,'0');
  }).join('');
}
export function stickSurfaceColor(activity=0,click=false,active=EXO_PALETTE.pressedSurface){
  if(click)return active.toLowerCase();
  return blendHexColor(EXO_PALETTE.neutralStick,EXO_PALETTE.movingControl,unit(activity));
}
export function triggerSurfaceColor(pressure=0,active=EXO_PALETTE.pressedSurface){
  return blendHexColor(EXO_PALETTE.neutralTrigger,active,unit(pressure));
}
