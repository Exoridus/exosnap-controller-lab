// Background-aware silhouette from the *already rendered* controller texture.
// One common 3D render is composited onto three known backgrounds. No CPU readback.
// In Qt Quick 3D this is a small fullscreen texture-compositor shader, NOT a
// substitute for the physical depth buffer or an automatic scene-light change.
import * as THREE from 'three';

const profiles=Object.freeze({
  dark:Object.freeze({mode:0,darkStrength:.05,lightStrength:.54,inkGain:0,preserveOpaque:true}),
  light:Object.freeze({mode:1,darkStrength:.56,lightStrength:.05,inkGain:.79,preserveOpaque:true}),
  mixed:Object.freeze({mode:2,darkStrength:.52,lightStrength:.24,inkGain:.41,preserveOpaque:true}),
});
// The accepted PBR shell remains untouched; only its composited outer
// rim receives a small extra emphasis, never outlines for individual parts.
export const DEFAULT_OUTER_SILHOUETTE_EMPHASIS=.18;
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
uniform float silhouetteEmphasis;
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
  // A roughly one-pixel exterior instead of the old 1.65px bright halo.
  float wide=max(0.,ring(1.10)-coverageHere);
  float narrow=max(0.,ring(.66)-coverageHere);
  // Only faint transparent surfaces receive a background-specific ink correction.
  // Opaque pressed buttons retain exactly their source RGB and alpha.
  float fade=1.-smoothstep(.42,.92,src.a);
  vec3 ink=vec3(.12);
  vec3 rgb=mix(src.rgb,ink*src.a,inkGain*fade);
  float alpha=clamp(src.a*(1.+.58*inkGain*fade),0.,1.);
  // Softer neutral inks. Strong near-white or near-black outlines distract
  // from the materials, especially on bright mixed scene backgrounds.
  vec3 darkInk=vec3(.16);
  vec3 lightInk=vec3(.82);
  // Extend ONLY the outer edge of the already composed controller image.
  // No source-part, hidden-part or overlapping per-mesh contours are drawn.
  float extra=clamp(silhouetteEmphasis,0.,1.)*narrow;
  float darkA=clamp(darkStrength*wide+extra*(mode==1?.16:mode==2?.105:.015),0.,.96);
  float lightA=clamp(lightStrength*(mode==2?narrow:wide)
    +extra*(mode==0?.14:mode==2?.038:.012),0.,.96);
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
      mode:{value:0},darkStrength:{value:0},lightStrength:{value:0},inkGain:{value:0},silhouetteEmphasis:{value:0},
    },
    vertexShader,fragmentShader,
    transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,
    blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
  });
  material.name='ExoSnap background-contrast composition';
  return material;
}
export function updateContrastComposite(material,scene,size,legacyOutline=true,silhouetteEmphasis=0){
  const p=sceneContrastProfile(scene);
  const width=Math.max(1,Number(size.width)||1);
  const height=Math.max(1,Number(size.height)||1);
  material.uniforms.pixelSize.value.set(1/width,1/height);
  material.uniforms.mode.value=legacyOutline?p.mode:3;
  material.uniforms.darkStrength.value=p.darkStrength;
  material.uniforms.lightStrength.value=p.lightStrength;
  material.uniforms.inkGain.value=p.inkGain;
  material.uniforms.silhouetteEmphasis.value=legacyOutline?Math.min(1,Math.max(0,Number(silhouetteEmphasis)||0)):0;
}
