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
export function makeFaceGlyph(file,source,bounds,model){
 if(source!=='co'&&source!=='exo')return null;
 const glyph=faceButtonGlyph(file,model);
 if(!glyph)return null;
 const face=Math.min(Math.abs(bounds.max.x-bounds.min.x),Math.abs(bounds.max.z-bounds.min.z));
 const extent=face*.85;
 const geo=new THREE.PlaneGeometry(extent,extent);
 const material=new THREE.MeshBasicMaterial({
   color:'#ffffff',transparent:true,opacity:1,side:THREE.DoubleSide,
   depthTest:true,depthWrite:false,toneMapped:false,alphaTest:.02,
 });
 const decal=new THREE.Mesh(geo,material);
 decal.position.set((bounds.min.x+bounds.max.x)/2,bounds.max.y+.008,(bounds.min.z+bounds.max.z)/2);
 decal.rotation.x=-Math.PI/2; // CO OBJ face is local +Y; camera-facing after co rotation.
 decal.visible=Boolean(material.map);
 decal.renderOrder=8;
 decal.name=`Face glyph ${glyph}`;
 decal.userData.buttonGlyph=glyph;
 decal.userData.artworkKey=glyph.toLowerCase();
 decal.userData.sourceFile=file;
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
// SVG getBBox ignores the element transform. Work in the authored SVG frame,
// then apply each complete CTM while drawing its unchanged path. This retains
// the source's tiny Create/Options marks and transformed D-pad arrow shapes.
function pathFrame(node){
 const box=node.getBBox();
 const m=node.getCTM?.()||{a:1,b:0,c:0,d:1,e:0,f:0};
 const corners=[[box.x,box.y],[box.x+box.width,box.y],
  [box.x,box.y+box.height],[box.x+box.width,box.y+box.height]];
 const points=corners.map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
 return {node,m,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
  minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
function authoredTexture(paths){
 const frames=paths.map(pathFrame);
 const minX=Math.min(...frames.map(x=>x.minX)),maxX=Math.max(...frames.map(x=>x.maxX));
 const minY=Math.min(...frames.map(x=>x.minY)),maxY=Math.max(...frames.map(x=>x.maxY));
 const extent=Math.max(maxX-minX,maxY-minY);
 if(!(extent>0))return null;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.clearRect(0,0,256,256);
 ctx.translate(128,128);ctx.scale(192/extent,192/extent);
 ctx.translate(-(minX+maxX)/2,-(minY+maxY)/2);
 for(const {node,m}of frames){
  ctx.save();ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
  ctx.lineJoin='round';ctx.lineCap='round';
  const scale=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d),1e-6);
  ctx.lineWidth=extent*.055/scale;ctx.strokeStyle='#17212c';ctx.fillStyle='#ffffff';
  const mark=new Path2D(node.getAttribute('d'));
  const style=node.style;
  const fill=style?.fill||node.getAttribute('fill');
  const rule=style?.fillRule||node.getAttribute('fill-rule')||'nonzero';
  if(fill==='none'){
   // A stroked authored mark (e.g. outline symbol) retains its center path.
   const width=parseFloat(style?.strokeWidth||node.getAttribute('stroke-width'))||extent*.035/scale;
   ctx.lineWidth=width+extent*.055/scale;ctx.stroke(mark);
   ctx.lineWidth=width;ctx.strokeStyle='#ffffff';ctx.stroke(mark);
  }else{ctx.stroke(mark);ctx.fill(mark,rule);}
  ctx.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 return {texture,width:maxX-minX,height:maxY-minY};
}
function groupFor(svg,key){
 return svg.querySelector(`g[id="btn-${key}"],g[id$="-btn-${key}"]`);
}

// Only interactive controls get artwork slots. Decoration, speaker holes and
// shell marks retain their source assets and never receive input glyphs.
export function makeControlGlyph(file,source,bounds,model){
 const face=makeFaceGlyph(file,source,bounds,model);if(face)return face;
 if(source!=='co'&&source!=='exo')return null;
 const n=String(file).toLowerCase();
 const key=n.match(/^dpad_(up|down|left|right)[.]obj$/)?.[1]||
  ({'back_button.obj':'view','start_button.obj':'menu'})[n];
 if(!key)return null;
 const width=Math.abs(bounds.max.x-bounds.min.x),height=Math.abs(bounds.max.z-bounds.min.z);
 const small=key==='view'||key==='menu';
 const extent=small?Math.max(width,height)*1.25:Math.min(width,height)*.85;
 const material=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:1,
  side:THREE.DoubleSide,depthTest:true,depthWrite:false,toneMapped:false,alphaTest:.02});
 const decal=new THREE.Mesh(new THREE.PlaneGeometry(extent,extent),material);
 decal.position.set((bounds.min.x+bounds.max.x)/2,bounds.max.y+.008,
  small?bounds.min.z-extent*.65:(bounds.min.z+bounds.max.z)/2);
 decal.rotation.x=-Math.PI/2;decal.visible=false;decal.renderOrder=8;
 decal.name=`Source artwork ${key}`;
 decal.userData={surfaceArtwork:small?'control-label':'button-face',artworkKey:key,sourceFile:file,
  aboveButton:small,sourceFaceDimensions:{width,height}};
 return decal;
}

// Synchronous: the root can render immediately after its two source loads.
// One texture per control is then reused by the same rig across backgrounds.
export function applyControllerArtwork(native,original2DSvg){
 if(!native?.group||!original2DSvg||typeof document==='undefined'||typeof Path2D==='undefined')return 0;
 let updated=0;
 native.group.traverse(decal=>{
  const key=decal.userData?.artworkKey;if(!key)return;
  const group=groupFor(original2DSvg,key);
  const paths=[...(group?.querySelectorAll('path.glyph')||[])].filter(n=>n.getAttribute('d'));
  if(!paths.length)return;
  const source=authoredTexture(paths);if(!source)return;
  const face=group.querySelector(`[id="btn-${key}-face"],[id$="-btn-${key}-face"]`);
  const frame=face?pathFrame(face):null;
  const glyphBox={width:source.width,height:source.height};
  const faceBox=frame?{width:frame.maxX-frame.minX,height:frame.maxY-frame.minY}:glyphBox;
  const metrics=faceDecalSizeFrom2D(decal.userData.sourceFaceDimensions,faceBox,glyphBox);
  const small=decal.userData.aboveButton;
  const size=small?Math.max(decal.userData.sourceFaceDimensions.width,
   decal.userData.sourceFaceDimensions.height)*1.25:metrics.size;
  const oldGeometry=decal.geometry,oldTexture=decal.material.map;
  decal.geometry=new THREE.PlaneGeometry(size,size);decal.material.map=source.texture;
  decal.material.needsUpdate=true;decal.visible=true;
  oldGeometry.dispose();oldTexture?.dispose();
  decal.userData.artworkSource='2d-svg';decal.userData.authoredPathCount=paths.length;
  decal.userData.readableCoverage=metrics.readableCoverage;
  decal.userData.originalCoverage=metrics.originalCoverage;
  updated++;
 });
 return updated;
}
// Historical public helper remains compatible, using the generalized source path.
export function applyGameCubeButtonArtwork(native,original2DSvg){
 return native?.model?.id==='Gamecube'?applyControllerArtwork(native,original2DSvg):0;
}
