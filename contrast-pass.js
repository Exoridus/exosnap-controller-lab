import * as THREE from 'three';

// A–E are diagnostic alternatives, never additional preview controls.
// D is a provisional RC candidate. No visual selection is claimed while the
// acceptance environment cannot create a WebGL context; see V29_REPORT.md.
export const CONTRAST_VARIANTS=Object.freeze({off:0,A:1,B:2,C:3,D:4,E:5});
export function contrastVariant(value){return Object.hasOwn(CONTRAST_VARIANTS,value)?value:'D';}

const vertexShader=`varying vec2 vUv;
void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const fragmentShader=`
precision highp float;
uniform sampler2D maskTexture;
uniform sampler2D backgroundTexture;
uniform vec2 texel;
uniform vec2 backgroundScale;
uniform float dpr;
uniform float variant;
uniform float backgroundKind;
varying vec2 vUv;
vec4 maskAt(vec2 uv){
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec4(0.);
  return texture2D(maskTexture,uv);
}
float boundary(vec4 center,vec4 neighbor){
  float different=step(.0015,abs(center.r-neighbor.r));
  // MSAA coverage attenuates RGB at the exterior, including the numeric ID.
  // Those pixels belong to the silhouette, not to another physical control.
  return different*step(.98,center.a)*step(.98,neighbor.a)*step(.45,center.b);
}
void main(){
  vec4 c=maskAt(vUv);
  float outside=0.,inside=0.,controlEdge=0.,soft=0.,drop=0.;
  // All radii are CSS pixels, independent of overlay size. No mesh edges.
  for(int i=0;i<8;i++){
    float angle=float(i)*.78539816339;
    vec2 dir=vec2(cos(angle),sin(angle));
    vec4 n=maskAt(vUv+dir*texel*dpr*.85);
    outside=max(outside,n.a-c.a);
    inside=max(inside,c.a-n.a);
    controlEdge=max(controlEdge,boundary(c,n));
    soft+=maskAt(vUv+dir*texel*dpr*1.5).a*.075;
    soft+=maskAt(vUv+dir*texel*dpr*.7).a*.05;
    drop+=maskAt(vUv+(dir*1.25+vec2(0.,.85))*texel*dpr).a*.125;
  }
  outside=clamp(outside,0.,1.);inside=clamp(inside,0.,1.);
  soft=max(0.,soft-c.a);drop=max(0.,drop-c.a);
  float dark=0.,light=0.;
  if(variant<.5){discard;}
  else if(variant<1.5){
    dark=outside*.58+controlEdge*.27;
    light=inside*.62+controlEdge*.18;
  }else if(variant<2.5){
    dark=drop*.48+controlEdge*.11;
  }else if(variant<3.5){
    dark=soft*.68+controlEdge*.22;
  }else if(variant<4.5){
    dark=outside*.56+controlEdge*.25;
    // The lighter side is supplied by the real surface Fresnel shader.
  }else{
    vec3 bg=backgroundKind<.5?vec3(.025,.035,.052):vec3(.97,.975,.98);
    if(backgroundKind>1.5){
      vec2 uv=(vUv-.5)*backgroundScale+.5;
      bg=texture2D(backgroundTexture,uv).rgb;
    }
    float luminance=dot(bg,vec3(.2126,.7152,.0722));
    float darkWeight=smoothstep(.12,.70,luminance);
    dark=(outside*.63+controlEdge*.33)*darkWeight;
    light=(outside*.69+controlEdge*.30)*(1.-darkWeight);
  }
  // Keep active blue surfaces intact: only their narrow boundary is treated.
  dark*=mix(1.,.72,c.g);
  vec3 ink=vec3(.038,.066,.090),highlight=vec3(.82,.90,.96);
  float alpha=clamp(dark+light,0.,.8);
  if(alpha<.001)discard;
  gl_FragColor=vec4((ink*dark+highlight*light)/max(.0001,dark+light),alpha);
}`;

export class ContrastPass{
  constructor({variant='D'}={}){
    this.variant=contrastVariant(variant);
    this.meshes=[];
    this.target=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false,samples:4});
    this.target.texture.name='physical-silhouette-and-control-ids';
    this.target.texture.generateMipmaps=false;
    this.maskMaterial=new THREE.ShaderMaterial({
      uniforms:{maskCode:{value:new THREE.Vector3()}},
      vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 maskCode;void main(){gl_FragColor=vec4(maskCode,1.);}',
      depthTest:true,depthWrite:true,side:THREE.DoubleSide,toneMapped:false,blending:THREE.NoBlending
    });
    this.material=new THREE.ShaderMaterial({
      uniforms:{maskTexture:{value:this.target.texture},texel:{value:new THREE.Vector2(1,1)},dpr:{value:1},
        variant:{value:CONTRAST_VARIANTS[this.variant]},backgroundKind:{value:0},
        backgroundTexture:{value:null},backgroundScale:{value:new THREE.Vector2(1,1)}},
      vertexShader,fragmentShader,transparent:true,depthTest:false,depthWrite:false,toneMapped:false
    });
    // A single full-screen triangle is an image operation, not a controller scene.
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    this.triangle=new THREE.Mesh(geo,this.material);this.triangle.frustumCulled=false;
    this.camera=new THREE.Camera();
    this.savedClear=new THREE.Color();this.savedViewport=new THREE.Vector4();this.savedScissor=new THREE.Vector4();
    this.width=1;this.height=1;
  }
  get meshCount(){return this.meshes.length;}
  setModel(holders){
    for(const mesh of this.meshes){mesh.layers.disable(1);mesh.onBeforeRender=mesh.userData.beforeContrastRender;delete mesh.userData.beforeContrastRender;delete mesh.userData.contrastId;}
    this.meshes=[];
    const ids=new Map([['housing',1]]);
    for(const part of holders){
      const key=part.userData.shell?'housing':part.userData.visualControl||part.userData.control||'housing';
      if(!ids.has(key))ids.set(key,ids.size+1);
      const id=ids.get(key);
      for(const mesh of part.userData.meshes||[]){
        this.meshes.push(mesh);mesh.layers.enable(1);
        mesh.userData.contrastId=id;
        mesh.userData.beforeContrastRender=mesh.onBeforeRender;
        mesh.onBeforeRender=(renderer,scene,camera,geometry,material,group)=>{
          mesh.userData.beforeContrastRender?.call(mesh,renderer,scene,camera,geometry,material,group);
          if(material===this.maskMaterial){
            material.uniforms.maskCode.value.set(id/255,mesh.userData.pressStrength||0,key==='housing'?0:1);
            material.uniformsNeedUpdate=true;
          }
        };
      }
    }
  }
  prepare(renderer,scene,camera,width,height){
    if(this.variant==='off'||!this.meshes.length)return;
    const dpr=renderer.getPixelRatio();
    const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
    if(w!==this.width||h!==this.height){this.target.setSize(w,h);this.width=w;this.height=h;}
    this.material.uniforms.texel.value.set(1/w,1/h);this.material.uniforms.dpr.value=dpr;
    const target=renderer.getRenderTarget(),autoClear=renderer.autoClear,scissorTest=renderer.getScissorTest();
    const clearAlpha=renderer.getClearAlpha();renderer.getClearColor(this.savedClear);
    renderer.getViewport(this.savedViewport);renderer.getScissor(this.savedScissor);
    const layers=camera.layers.mask,override=scene.overrideMaterial;
    try{
      // setRenderTarget installs its physical-pixel viewport. setViewport is
      // specified in CSS pixels and would apply DPR a second time here.
      renderer.setRenderTarget(this.target);renderer.setScissorTest(false);
      renderer.setClearColor(0,0);renderer.clear(true,true,true);
      renderer.autoClear=false;camera.layers.set(1);scene.overrideMaterial=this.maskMaterial;
      renderer.render(scene,camera);
    }finally{
      camera.layers.mask=layers;scene.overrideMaterial=override;
      renderer.setRenderTarget(target);renderer.setViewport(this.savedViewport);renderer.setScissor(this.savedScissor);
      renderer.setScissorTest(scissorTest);renderer.setClearColor(this.savedClear,clearAlpha);renderer.autoClear=autoClear;
    }
  }
  render(renderer,background='dark'){
    if(this.variant==='off'||!this.meshes.length)return;
    this.material.uniforms.backgroundKind.value=background==='light'?1:background==='mixed'||background==='racing'?2:0;
    const tex=this.material.uniforms.backgroundTexture.value;
    if(tex?.image){
      const viewAspect=this.width/this.height,imageAspect=tex.image.width/tex.image.height;
      this.material.uniforms.backgroundScale.value.set(viewAspect>imageAspect?1:viewAspect/imageAspect,viewAspect>imageAspect?imageAspect/viewAspect:1);
    }
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.render(this.triangle,this.camera);}finally{renderer.autoClear=autoClear;}
  }
  dispose(){
    this.setModel([]);this.target.dispose();this.maskMaterial.dispose();this.material.dispose();this.triangle.geometry.dispose();
    this.material.uniforms.backgroundTexture.value?.dispose();
  }
}
