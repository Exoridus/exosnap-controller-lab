// Source-vertex role mask, generated once at load. No replacement geometry,
// added render pass, readback or per-frame texture. Qt: vertex attribute +
// the existing CustomMaterial surface stage (see MODEL_CONSISTENCY.md).
import * as THREE from 'three';
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
function surfaceProgramKey(){return 'controller-rim-surface-v1';}
function compileRim(shader){
 const s=this.userData.rimSurface;
 shader.uniforms.controllerRimEnabled=s.enabled;
 shader.uniforms.controllerSupportColor=s.color;
 shader.uniforms.controllerSupportAlpha=s.alpha;
 shader.vertexShader=shader.vertexShader.replace('#include <common>',
  '#include <common>\nattribute float controllerRimWeight;\nvarying float vControllerRimWeight;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\nvControllerRimWeight=controllerRimWeight;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
  '#include <common>\nuniform float controllerRimEnabled;\nuniform vec3 controllerSupportColor;\nuniform float controllerSupportAlpha;\nvarying float vControllerRimWeight;')
  .replace('#include <map_fragment>',`#include <map_fragment>
    float rimWeight=mix(1.0,vControllerRimWeight,controllerRimEnabled);
    diffuseColor.rgb=mix(controllerSupportColor,diffuseColor.rgb,rimWeight);
    diffuseColor.a=mix(controllerSupportAlpha,diffuseColor.a,rimWeight);`)
  .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=rimWeight;');
}
export function prepareRimSurface(mesh,bounds,meta=null,sourceText=null){
 if(meta?.structuralRegions){prepareStructuralRegions(mesh,meta.structuralRegions,sourceText);return;}
 if(mesh.userData.role!=='stick-pivot')return;
 const positions=mesh.geometry.attributes.position,range=bounds.max.y-bounds.min.y;
 if(!(range>0))return;
 const weights=new Float32Array(positions.count);
 for(let i=0;i<weights.length;i++)weights[i]=smooth(((positions.getY(i)-bounds.min.y)/range-.30)/.40);
 installSurfaceWeights(mesh,weights);
}
function installSurfaceWeights(mesh,weights){
 mesh.geometry.setAttribute('controllerRimWeight',new THREE.BufferAttribute(weights,1));
 mesh.material.userData.rimSurface={enabled:{value:0},color:{value:mesh.userData.sourceColor.clone()},alpha:{value:1}};
 // Shared functions preserve equality-based GPU instancing when both states
 // are equal. The independent uniforms participate in material comparison.
 mesh.material.onBeforeCompile=compileRim;mesh.material.customProgramCacheKey=surfaceProgramKey;
}
export function updateRimSurface(material,enabled,color,alpha){
 const s=material.userData.rimSurface;if(!s)return;
 s.enabled.value=enabled?1:0;s.color.value.copy(color);s.alpha.value=alpha;
}

// A source mesh can contain independently authored housing-well components.
// Identify connected source triangles, not a spatial cut through the shell.
// Metadata only names inspected component bounds. Vertex positions/normals and
// source object/hierarchy are untouched; the shared material consumes a mask.
function prepareStructuralRegions(mesh,regions,sourceText){
 const vertices=[],faces=[];
 for(const line of sourceText.split('\n')){
  if(line.startsWith('v '))vertices.push(line.trim().split(/\s+/).slice(1).map(Number));
  else if(line.startsWith('f '))faces.push(line.trim().split(/\s+/).slice(1).map(v=>Number(v.split('/')[0])-1));
 }
 // Keep original vertex IDs: separate authored components can share seam
 // positions. Welding coordinates here would fuse the wells into the shell.
 const parent=Int32Array.from(vertices,(_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(const face of faces)for(const v of face.slice(1))parent[root(v)]=root(face[0]);
 const groups=new Map();for(let i=0;i<vertices.length;i++){const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(vertices[i]);}
 const supports=new Set();
 for(const [id,points] of groups){
  const lo=[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),hi=[0,1,2].map(j=>Math.max(...points.map(p=>p[j])));
  if(regions.some(r=>lo.every((v,j)=>Math.abs(v-r.min[j])<.002)&&hi.every((v,j)=>Math.abs(v-r.max[j])<.002)))supports.add(id);
 }
 if(supports.size!==regions.length)throw Error('Inspected structural components changed in '+mesh.userData.sourceFile);
 const weights=[];
 // OBJLoader triangulates each source polygon as this same indexed fan.
 for(const face of faces)for(let i=1;i<face.length-1;i++)for(const v of [face[0],face[i],face[i+1]])weights.push(supports.has(root(v))?0:1);
 if(weights.length!==mesh.geometry.attributes.position.count)throw Error('Structural source polygon mapping differs from OBJLoader');
 installSurfaceWeights(mesh,new Float32Array(weights));mesh.userData.structuralComponents=supports.size;
}
