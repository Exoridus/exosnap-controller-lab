// Model-family-aware, button-only artwork for the real source-authored controls.
// Keep functional legends in face buttons; do not add any markings to the shell.
// These decals do not alter or overwrite source geometry or model ownership.
import * as THREE from 'three';

const FACE_BUTTONS=Object.freeze({
 'a_button.obj':'a', 'b_button.obj':'b',
 'x_button.obj':'x', 'y_button.obj':'y',
});
const PLAYSTATION_GLYPHS=Object.freeze({
 a:'cross', b:'circle', x:'triangle', y:'square'
});
export function faceButtonGlyph(file,model){
 const key=FACE_BUTTONS[String(file).toLowerCase()];
 if(!key)return null;
 return model?.family==='playstation'?PLAYSTATION_GLYPHS[key]:key.toUpperCase();
}
function drawMark(ctx,glyph){
 const path=new Path2D();
 if(glyph==='cross'){path.moveTo(29,29);path.lineTo(67,67);path.moveTo(67,29);path.lineTo(29,67);}
 if(glyph==='circle')path.arc(48,48,22,0,Math.PI*2);
 if(glyph==='square')path.rect(27,27,42,42);
 if(glyph==='triangle'){path.moveTo(48,22);path.lineTo(72,67);path.lineTo(24,67);path.closePath();}
 ctx.strokeStyle='#192d42';ctx.lineWidth=12;
 if(['cross','circle','square','triangle'].includes(glyph)){
   ctx.stroke(path);ctx.strokeStyle='#f5fbff';ctx.lineWidth=6;ctx.stroke(path);
 }else{
   // A/B/X/Y are functional button legends, not branding.
   ctx.font='bold 58px Arial, sans-serif';
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
   ctx.strokeStyle='#192d42';ctx.lineWidth=8;
   ctx.strokeText(glyph,48,52);
   ctx.fillStyle='#f5fbff';ctx.fillText(glyph,48,52);
 }
}
export function makeFaceGlyph(file,source,bounds,model){
 if(source!=='co')return null;
 const glyph=faceButtonGlyph(file,model);
 if(!glyph)return null;
 const geo=new THREE.PlaneGeometry(.075,.075);
 const material=new THREE.MeshBasicMaterial({
   color:'#ffffff',transparent:true,opacity:1,side:THREE.DoubleSide,
   depthTest:true,depthWrite:false,toneMapped:false,alphaTest:.02,
 });
 if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
   const ctx=canvas.getContext('2d');
   if(ctx){
     ctx.clearRect(0,0,96,96);ctx.lineJoin='round';ctx.lineCap='round';
     drawMark(ctx,glyph);
     const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
     tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;
     material.map=tex;
   }
 }
 const decal=new THREE.Mesh(geo,material);
 decal.position.set((bounds.min.x+bounds.max.x)/2,bounds.max.y+.008,(bounds.min.z+bounds.max.z)/2);
 decal.rotation.x=-Math.PI/2; // CO OBJ face is local +Y; camera-facing after co rotation.
 decal.visible=Boolean(material.map);
 decal.renderOrder=8;
 decal.name=`Face glyph ${glyph}`;
 decal.userData.buttonGlyph=glyph;
 decal.userData.surfaceArtwork='button-face';
 return decal;
}
