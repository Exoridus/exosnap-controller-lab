// v25-inspired surface-space Fresnel on existing PBR meshes.
// The cached physical shader has one uniform per material and no extra pass.
const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
export const GHOST_FRESNEL=Object.freeze({
  power:3.2,alphaGain:.26,lightGain:.35,color:'#c9e0fa'
});
export function addFresnelToPhysicalFragment(source){
  const marker='#include <opaque_fragment>';
  const common='#include <common>';
  if(!source.includes(marker)||!source.includes(common))
    throw new Error('Unsupported physical fragment shader');
  const body=[
    'if(uExoGhostFresnel>0.0001){',
    '  float exoFacing=abs(dot(normalize(normal),normalize(vViewPosition)));',
    '  float exoRim=pow(clamp(1.0-exoFacing,0.0,1.0),3.2);',
    '  float exoAmount=exoRim*uExoGhostFresnel;',
    '  outgoingLight=mix(outgoingLight,vec3(0.788,0.878,0.980),exoAmount*0.35);',
    '  diffuseColor.a=min(0.80,diffuseColor.a+exoAmount*0.26);',
    '}',
    marker
  ].join('\n');
  return source.replace(common,common+'\nuniform float uExoGhostFresnel;\n')
    .replace(marker,body);
}
export function setGhostFresnel(material,strength){
  if(!material?.isMeshPhysicalMaterial)return false;
  if(!material.userData.exoGhostFresnelUniform){
    const uniform={value:0};
    material.userData.exoGhostFresnelUniform=uniform;
    material.onBeforeCompile=shader=>{
      shader.uniforms.uExoGhostFresnel=uniform;
      shader.fragmentShader=addFresnelToPhysicalFragment(shader.fragmentShader);
    };
    material.customProgramCacheKey=()=> 'exo-ghost-fresnel-physical-v1';
    material.needsUpdate=true;
  }
  material.userData.exoGhostFresnelUniform.value=clamp(strength);
  return true;
}
