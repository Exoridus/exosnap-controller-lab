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
 decal.userData.sourceFaceDimensions={width:Math.abs(bounds.max.x-bounds.min.x),height:Math.abs(bounds.max.z-bounds.min.z)};
 return decal;
}

// The GameCube A/B/X/Y shapes are sourced from the actual authored 2D SVG,
// rather than a generic system-font approximation. At overlay resolutions the
// projected glyph must be optically enlarged to remain legible.
export function faceDecalSizeFrom2D(dimensions,faceBox,glyphBox){
 const {width,height}=dimensions||{};
 const surface=Math.min(width,height);
 if(![surface,faceBox?.width,faceBox?.height,glyphBox?.width,glyphBox?.height].every(x=>Number.isFinite(x)&&x>0))
   throw new RangeError('Expected positive source SVG and 3D button dimensions');
 const originalCoverage=Math.max(glyphBox.width/faceBox.width,glyphBox.height/faceBox.height);
 const readableCoverage=THREE.MathUtils.clamp(originalCoverage*1.65,.54,.68);
 return {size:surface*readableCoverage/.75,originalCoverage,readableCoverage};
}
function gamecubeGlyphTexture(paths){
 const boxes=paths.map(node=>node.getBBox());
 const minX=Math.min(...boxes.map(x=>x.x)),maxX=Math.max(...boxes.map(x=>x.x+x.width));
 const minY=Math.min(...boxes.map(x=>x.y)),maxY=Math.max(...boxes.map(x=>x.y+x.height));
 const extent=Math.max(maxX-minX,maxY-minY);
 if(!(extent>0))throw new Error('Empty GameCube glyph path');
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Cannot create 2D button-glyph texture');
 ctx.clearRect(0,0,128,128);
 ctx.translate(64,64);ctx.scale(96/extent,96/extent);
 ctx.translate(-(minX+maxX)/2,-(minY+maxY)/2);
 ctx.lineJoin='round';ctx.lineCap='round';
 ctx.lineWidth=extent*.075;ctx.strokeStyle='#192d42';ctx.fillStyle='#f5fbff';
 for(const item of paths){
   const mark=new Path2D(item.getAttribute('d'));
   ctx.stroke(mark);ctx.fill(mark);
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.magFilter=THREE.LinearFilter;
 return texture;
}
// Call only after the full original 2D SVG has loaded; preserve the physical
// GameCube OBJ geometry, pivot hierarchy and original palette.
export function applyGameCubeButtonArtwork(native,original2DSvg){
 if(native?.model?.id!=='Gamecube'||!original2DSvg||typeof Path2D==='undefined')return 0;
 const decals=new Map();
 native.group.traverse(node=>{
   if(['A','B','X','Y'].includes(node.userData?.buttonGlyph))
     decals.set(node.userData.buttonGlyph,node);
 });
 let updated=0;
 for(const letter of ['a','b','x','y']){
   const group=original2DSvg.querySelector(`g[id$="-btn-${letter}"]`);
   const face=group?.querySelector(`[id$="-btn-${letter}-face"]`);
   const paths=[...(group?.querySelectorAll('path.glyph')||[])].filter(x=>x.getAttribute('d'));
   const decal=decals.get(letter.toUpperCase());
   if(!face||!paths.length||!decal)continue;
   const boxes=paths.map(x=>x.getBBox());
   const glyphBox={
     width:Math.max(...boxes.map(x=>x.x+x.width))-Math.min(...boxes.map(x=>x.x)),
     height:Math.max(...boxes.map(x=>x.y+x.height))-Math.min(...boxes.map(x=>x.y))
   };
   const metrics=faceDecalSizeFrom2D(decal.userData.sourceFaceDimensions,face.getBBox(),glyphBox);
   const texture=gamecubeGlyphTexture(paths);
   const oldGeometry=decal.geometry,oldTexture=decal.material.map;
   decal.geometry=new THREE.PlaneGeometry(metrics.size,metrics.size);
   decal.material.map=texture;decal.material.needsUpdate=true;
   oldGeometry.dispose();oldTexture?.dispose();
   decal.userData.artworkSource='2d-svg';
   decal.userData.readableCoverage=metrics.readableCoverage;
   decal.userData.originalCoverage=metrics.originalCoverage;
   updated++;
 }
 return updated;
}
