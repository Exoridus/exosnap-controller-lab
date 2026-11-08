// Shared semantic colors, not device skins. Housing retains authored colors.
// Scalar/color interpolation ports directly to QPainter/atlas and Qt materials.
export const CONTROL_NEUTRAL='#9ca3aa';
export const CONTROL_CONTOURS=Object.freeze({dark:'#8d959d',light:'#737a81',mixed:'#77818b'});
export const SCENE_BACKDROPS=Object.freeze({dark:'#09111b',light:'#f4f6f9',mixed:'#9baab4'});
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16));
export function softenedLegendColor(surface,opacity=1,backdrop='#9baab4'){
 const p=rgb(surface),b=rgb(backdrop),a=clamp(opacity);
 const l=(.2126*(p[0]*a+b[0]*(1-a))+.7152*(p[1]*a+b[1]*(1-a))+.0722*(p[2]*a+b[2]*(1-a)))/255;
 // Continuous polarity transition. The neutral dark profile crosses between
 // the 30% and 70% coverage presets, rather than snapping to black or white.
 let t=clamp((l-.49)/.10);t=t*t*(3-2*t);
 return '#'+[210,218,225].map((v,i)=>Math.round(v+([72,81,91][i]-v)*t).toString(16).padStart(2,'0')).join('');
}
export function isStructuralRole(role){return ['stick-stem','stick-base','stick-well','structural-support'].includes(role);}
export function isInteractiveRole(role){return ['button','trigger','touch-surface','paddle','stick-pivot','stick-cap'].includes(role);}
