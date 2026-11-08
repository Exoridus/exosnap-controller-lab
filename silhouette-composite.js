// Background-aware silhouette from the *already rendered* controller texture.
// One common 3D render is composited onto three known backgrounds. No CPU readback.
// In Qt Quick 3D this is a small fullscreen texture-compositor shader, NOT a
// substitute for the physical depth buffer or an automatic scene-light change.
import * as THREE from 'three';

const profiles=Object.freeze({
  dark:Object.freeze({mode:0,darkStrength:.08,lightStrength:.80,inkGain:0,preserveOpaque:true}),
  light:Object.freeze({mode:1,darkStrength:.76,lightStrength:.08,inkGain:.79,preserveOpaque:true}),
  mixed:Object.freeze({mode:2,darkStrength:.71,lightStrength:.35,inkGain:.41,preserveOpaque:true}),
});
export function sceneContrastProfile(scene){
  if(!Object.hasOwn(profiles,scene))throw new Error(`Unknown contrast backdrop ${scene}`);
  return profiles[scene];
}

const vertexShader=`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const fragmentShader=`
uniform sampler2D colorTexture;
uniform vec2 pixelSize;
uniform int mode;
uniform float darkStrength;
uniform float lightStrength;
uniform float inkGain;
varying vec2 vUv;
float coverage(float a){return smoothstep(0.003,0.017,a);}
float ring(float radius){
  vec2 d=pixelSize*radius;
  float c=coverage(texture2D(colorTexture,clamp(vUv+vec2(d.x,0.),vec2(0.),vec2(1.))).a);
  c=max(c,coverage(texture2D(colorTexture,clamp(vUv-vec2(d.x,0.),vec2(0.),vec2(1.))).a));
  c=max(c,coverage(texture2D(colorTexture,clamp(vUv+vec2(0.,d.y),vec2(0.),vec2(1.))).a));
  c=max(c,coverage(texture2D(colorTexture,clamp(vUv-vec2(0.,d.y),vec2(0.),vec2(1.))).a));
  c=max(c,coverage(texture2D(colorTexture,clamp(vUv+vec2(d.x,d.y),vec2(0.),vec2(1.))).a));
  c=max(c,coverage(texture2D(colorTexture,clamp(vUv-vec2(d.x,d.y),vec2(0.),vec2(1.))).a));
  c=max(c,coverage(texture2D(colorTexture,clamp(vUv+vec2(d.x,-d.y),vec2(0.),vec2(1.))).a));
  c=max(c,coverage(texture2D(colorTexture,clamp(vUv+vec2(-d.x,d.y),vec2(0.),vec2(1.))).a));
  return c;
}
void main(){
  vec4 src=texture2D(colorTexture,vUv);
  if(mode==3){
    // Physical Fresnel is already in the material: NO dilation, ink gain or
    // background-dependent postprocessing. Only the shared GPU texture blit.
    gl_FragColor=src;
    #include <colorspace_fragment>
    gl_FragColor.rgb*=gl_FragColor.a;
    return;
  }
  float coverageHere=coverage(src.a);
  float wide=max(0.,ring(1.65)-coverageHere);
  float narrow=max(0.,ring(.72)-coverageHere);
  // Only faint transparent surfaces receive a background-specific ink correction.
  // Opaque pressed buttons retain exactly their source RGB and alpha.
  float fade=1.-smoothstep(.42,.92,src.a);
  vec3 ink=vec3(.12);
  vec3 rgb=mix(src.rgb,ink*src.a,inkGain*fade);
  float alpha=clamp(src.a*(1.+.58*inkGain*fade),0.,1.);
  vec3 darkInk=vec3(.08);
  vec3 lightInk=vec3(.94);
  float darkA=darkStrength*wide;
  float lightA=lightStrength*(mode==2?narrow:wide);
  float combined=1.-(1.-darkA)*(1.-lightA);
  vec3 outline=darkInk*darkA+lightInk*lightA*(1.-darkA);
  // RGB is premultiplied; the fixed-function blending is ONE / ONE_MINUS_SRC_ALPHA.
  vec4 premult=vec4(rgb*(1.-combined)+outline*(1.-alpha),alpha+combined*(1.-alpha));
  // Three applies output color-space conversion to straight RGB.
  // Re-premultiply AFTER conversion so ONE/ONE_MINUS_SRC_ALPHA remains correct.
  gl_FragColor=vec4(premult.rgb/max(premult.a,0.00001),premult.a);
  #include <colorspace_fragment>
  gl_FragColor.rgb*=gl_FragColor.a;
}`;

export function createContrastCompositeMaterial(texture){
  const material=new THREE.ShaderMaterial({
    uniforms:{
      colorTexture:{value:texture},pixelSize:{value:new THREE.Vector2(1,1)},
      mode:{value:0},darkStrength:{value:0},lightStrength:{value:0},inkGain:{value:0},
    },
    vertexShader,fragmentShader,
    transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,
    blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
  });
  material.name='ExoSnap background-contrast composition';
  return material;
}
export function updateContrastComposite(material,scene,size,legacyOutline=true){
  const p=sceneContrastProfile(scene);
  const width=Math.max(1,Number(size.width)||1);
  const height=Math.max(1,Number(size.height)||1);
  material.uniforms.pixelSize.value.set(1/width,1/height);
  material.uniforms.mode.value=legacyOutline?p.mode:3;
  material.uniforms.darkStrength.value=p.darkStrength;
  material.uniforms.lightStrength.value=p.lightStrength;
  material.uniforms.inkGain.value=p.inkGain;
}
