// Small vector decals on the actual source-authored face buttons.
// Four transparent 2-triangle planes; never replace model geometry.
// Canvas is used only to prepare 64px glyph textures at load time, not per frame.
import * as THREE from 'three';
const buttons=Object.freeze({
  'a_button.obj':'cross',
  'b_button.obj':'circle',
  'x_button.obj':'triangle',
  'y_button.obj':'square',
});
export function makeFaceGlyph(file,source,bounds){
  if(source!=='co'||!(file in buttons))return null;
  const glyph=buttons[file];
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
      const path=new Path2D();
      if(glyph==='cross'){path.moveTo(29,29);path.lineTo(67,67);path.moveTo(67,29);path.lineTo(29,67);}
      if(glyph==='circle')path.arc(48,48,22,0,Math.PI*2);
      if(glyph==='square')path.rect(27,27,42,42);
      if(glyph==='triangle'){path.moveTo(48,22);path.lineTo(72,67);path.lineTo(24,67);path.closePath();}
      ctx.strokeStyle='#192d42';ctx.lineWidth=12;ctx.stroke(path);
      ctx.strokeStyle='#f5fbff';ctx.lineWidth=6;ctx.stroke(path);
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
  return decal;
}
