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
function authoredTexture(paths,faceFrame){
 const frames=paths.map(pathFrame);
 const box=faceFrame||{minX:Math.min(...frames.map(f=>f.minX)),maxX:Math.max(...frames.map(f=>f.maxX)),
  minY:Math.min(...frames.map(f=>f.minY)),maxY:Math.max(...frames.map(f=>f.maxY))};
 const width=box.maxX-box.minX,height=box.maxY-box.minY;
 if(!(width>0&&height>0))return null;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.clearRect(0,0,256,256);
 ctx.scale(256/width,256/height);ctx.translate(-box.minX,-box.minY);
 for(const {node,m}of frames){
  ctx.save();ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
  ctx.lineJoin='round';ctx.lineCap='round';ctx.fillStyle='#ffffff';ctx.strokeStyle='#ffffff';
  const mark=new Path2D(node.getAttribute('d'));
  const style=node.style,fill=style?.fill||node.getAttribute('fill');
  if(fill==='none'){
   ctx.lineWidth=parseFloat(style?.strokeWidth||node.getAttribute('stroke-width'))||.5;ctx.stroke(mark);
  }else ctx.fill(mark,style?.fillRule||node.getAttribute('fill-rule')||'nonzero');
  ctx.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 return texture;
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

// Record planar UVs on existing source vertices before exact geometry sharing.
// No extra mesh, offset plane, z-fighting, side-wall bleed or additional draw.
export function prepareSurfaceArtwork(mesh,source,bounds,model){
 if(source!=='co'&&source!=='exo')return false;
 const file=mesh.userData.sourceFile;
 const face=faceButtonGlyph(file,model);
 const key=face?.toLowerCase()||String(file).match(/^dpad_(up|down|left|right)[.]obj$/)?.[1];
 if(!key)return false; // Share/Options artwork above the surface is deliberately removed.
 const width=bounds.max.x-bounds.min.x,height=bounds.max.z-bounds.min.z;
 if(!(width>0&&height>0))return false;
 const positions=mesh.geometry.getAttribute('position'),uv=new Float32Array(positions.count*2);
 for(let i=0;i<positions.count;i++){
  uv[i*2]=(positions.getX(i)-bounds.min.x)/width;
  uv[i*2+1]=1-(positions.getZ(i)-bounds.min.z)/height;
 }
 mesh.geometry.setAttribute('controllerMarkUv',new THREE.BufferAttribute(uv,2));
 Object.assign(mesh.userData,{artworkKey:key,buttonGlyph:face||undefined,
  surfaceArtwork:'button-material',sourceFaceDimensions:{width,height}});
 return true;
}
export function installSurfaceMarking(mesh,texture){
 const material=mesh.material;
 const directional=/^(up|down|left|right)$/.test(mesh.userData.artworkKey);
 const c=mesh.userData.sourceColor||new THREE.Color('#eeeeee');
 const light=.2126*c.r+.7152*c.g+.0722*c.b>.25;
 const idle=new THREE.Color(directional||light?'#303030':'#eeeeee');
 const state={mask:{value:texture},enabled:{value:1},ink:{value:idle.clone()},idle,active:new THREE.Color('#ffffff')};
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.controllerMarkMask=state.mask;shader.uniforms.controllerMarkEnabled=state.enabled;shader.uniforms.controllerMarkInk=state.ink;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nattribute vec2 controllerMarkUv;\nvarying vec2 vControllerMarkUv;\nvarying float vControllerMarkFacing;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvControllerMarkUv=controllerMarkUv;\nvControllerMarkFacing=normal.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\nuniform sampler2D controllerMarkMask;\nuniform float controllerMarkEnabled;\nuniform vec3 controllerMarkInk;\nvarying vec2 vControllerMarkUv;\nvarying float vControllerMarkFacing;')
   .replace('#include <map_fragment>','#include <map_fragment>\nfloat inkAlpha=texture2D(controllerMarkMask,vControllerMarkUv).a*controllerMarkEnabled*step(0.45,vControllerMarkFacing);\ndiffuseColor.rgb=mix(diffuseColor.rgb,controllerMarkInk,inkAlpha);');
 };
 material.customProgramCacheKey=()=>previousKey+'|controller-surface-ink-v1';
 material.userData.surfaceMarking=state;material.needsUpdate=true;
 return state;
}
export function setControllerMarkings(native,enabled){
 for(const mesh of native?.meshes||[]){
  const state=mesh.material?.userData.surfaceMarking;
  if(state)state.enabled.value=enabled?1:0;
 }
}
// Source symbols keep their actual position inside each authored 2D button.
// One immutable alpha mask per surface, prepared once at model/artwork load.
export function applyControllerArtwork(native,original2DSvg){
 if(!native?.group||!original2DSvg||typeof document==='undefined'||typeof Path2D==='undefined')return 0;
 let count=0;native.artworkTextures??=new Set();
 for(const mesh of native.meshes){
  const key=mesh.userData.artworkKey;if(!key)continue;
  const group=groupFor(original2DSvg,key);
  const paths=[...(group?.querySelectorAll('path.glyph')||[])].filter(n=>n.getAttribute('d'));
  if(!paths.length)continue;
  const face=group.querySelector(`[id="btn-${key}-face"],[id$="-btn-${key}-face"]`);
  const texture=authoredTexture(paths,face?pathFrame(face):null);if(!texture)continue;
  const existing=mesh.material.userData.surfaceMarking;
  if(existing){existing.mask.value.dispose();native.artworkTextures.delete(existing.mask.value);existing.mask.value=texture;}
  else installSurfaceMarking(mesh,texture);
  native.artworkTextures.add(texture);
  mesh.userData.artworkSource='2d-svg';mesh.userData.authoredPathCount=paths.length;count++;
 }
 return count;
}
export function applyGameCubeButtonArtwork(native,original2DSvg){
 return native?.model?.id==='Gamecube'?applyControllerArtwork(native,original2DSvg):0;
}
