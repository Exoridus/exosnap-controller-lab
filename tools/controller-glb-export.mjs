// Deterministic, lossless OBJ-rig -> glTF 2.0 GLB interchange.
// Keeps authored node transforms/pivots and triangle winding. Only IDENTICAL
// vertex tuples are welded: no decimation, smoothing, approximate comparisons,
// reduction of physical button nodes, or runtime remeshing.
import {createHash} from 'node:crypto';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const clean=name=>String(name||'part').replace(/[^a-zA-Z0-9_]+/g,'_');
const align4=n=>(n+3)&~3;
const numeric=x=>Object.is(x,-0)?0:x;

export function encodeControllerGlb(native,layoutId){
  if(!native?.group||!native.parts?.length)throw Error('Expected source-authored rig');
  const gltf={asset:{version:'2.0',generator:'ExoSnap Controller Pack v1 (lossless indexed)'},
    scene:0,scenes:[{nodes:[0]}],nodes:[],meshes:[],materials:[],
    buffers:[{byteLength:0}],bufferViews:[],accessors:[]};
  const binary=[],meshCache=new Map(),materialCache=new Map();
  const holderNames=new Map(native.parts.map(p=>[p.holder,'part__'+clean(p.file.replace(/\.obj$/i,''))]));
  const nodeNames=new Map(),partNodes={},sourceTriangles=native.triangles;
  let rawVertices=0,uniqueVertices=0,triangleCount=0,meshNodes=0,drawGeometryBytes=0;
  const append=(bytes,target)=>{
    const offset=binary.reduce((sum,item)=>sum+item.length,0);
    const data=Buffer.from(bytes);
    binary.push(data,Buffer.alloc(align4(data.length)-data.length));
    const index=gltf.bufferViews.length;
    gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length,target});
    return index;
  };
  function accessor(values,components,type,componentType,target,bounds=false){
    const view=append(Buffer.from(values.buffer,values.byteOffset,values.byteLength),target);
    const a={bufferView:view,componentType,count:values.length/components,type};
    if(bounds){
      a.min=Array.from({length:components},(_,k)=>Math.min(...Array.from(values).filter((_,i)=>i%components===k)));
      a.max=Array.from({length:components},(_,k)=>Math.max(...Array.from(values).filter((_,i)=>i%components===k)));
    }
    const index=gltf.accessors.length;gltf.accessors.push(a);return index;
  }
  const materialFor=mesh=>{
    const c=mesh.userData.sourceColor||mesh.material.color;
    const rgba=[c?.r??1,c?.g??1,c?.b??1,mesh.material.opacity??1].map(Number);
    const key=rgba.join('|');
    if(materialCache.has(key))return materialCache.get(key);
    const index=gltf.materials.length;
    gltf.materials.push({name:'source_color_'+index,
      pbrMetallicRoughness:{baseColorFactor:rgba,metallicFactor:0,roughnessFactor:.7},
      alphaMode:rgba[3]<1?'BLEND':'OPAQUE',doubleSided:false});
    materialCache.set(key,index);return index;
  };
  function meshFor(mesh){
    const geometry=mesh.geometry,position=geometry?.getAttribute('position');
    if(!position||position.itemSize!==3||!position.count)throw Error('Missing native OBJ positions');
    const normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    const marking=geometry.getAttribute('controllerMarkUv');
    const faceCount=geometry.index?.count||position.count;
    if(faceCount%3!==0)throw Error('Non-triangular native OBJ part: '+mesh.name);
    const tuples=new Map(),points=[],normals=[],uvs=[],indices=[];
    const texcoord=uv||marking;
    for(let i=0;i<faceCount;i++){
      const v=geometry.index?geometry.index.getX(i):i;
      const tuple=[position.getX(v),position.getY(v),position.getZ(v)];
      if(normal)tuple.push(normal.getX(v),normal.getY(v),normal.getZ(v));
      if(texcoord)tuple.push(texcoord.getX(v),texcoord.getY(v));
      const key=tuple.join(',');
      let index=tuples.get(key);
      if(index===undefined){
        index=tuples.size;tuples.set(key,index);
        points.push(...tuple.slice(0,3));
        if(normal)normals.push(...tuple.slice(3,6));
        if(texcoord)uvs.push(...tuple.slice(normal?6:3));
      }
      indices.push(index);
    }
    if(indices.length!==faceCount)throw Error('Triangle topology changed');
    rawVertices+=faceCount;triangleCount+=faceCount/3;
    const positionData=new Float32Array(points),normalData=new Float32Array(normals);
    const uvData=new Float32Array(uvs);
    const indexData=tuples.size<=65535?new Uint16Array(indices):new Uint32Array(indices);
    uniqueVertices+=tuples.size;
    const mat=materialFor(mesh);
    const cacheKey=digest(Buffer.concat([Buffer.from(positionData.buffer),Buffer.from(normalData.buffer),
      Buffer.from(uvData.buffer),Buffer.from(indexData.buffer),Buffer.from([mat])]));
    if(meshCache.has(cacheKey))return meshCache.get(cacheKey);
    const attributes={POSITION:accessor(positionData,3,'VEC3',5126,34962,true)};
    if(normal)attributes.NORMAL=accessor(normalData,3,'VEC3',5126,34962);
    if(texcoord)attributes.TEXCOORD_0=accessor(uvData,2,'VEC2',5126,34962);
    const primitive={attributes,indices:accessor(indexData,1,'SCALAR',tuples.size<=65535?5123:5125,34963),material:mat,mode:4};
    const index=gltf.meshes.length;
    gltf.meshes.push({name:'geometry__'+index,primitives:[primitive],
      extras:{artworkUv:!!marking,sourceFile:mesh.userData.sourceFile||null}});
    meshCache.set(cacheKey,index);
    drawGeometryBytes+=positionData.byteLength+normalData.byteLength+uvData.byteLength+indexData.byteLength;
    return index;
  }
  function visit(obj,parent=null){
    if(!obj.visible)return null;
    let name;
    if(obj===native.group)name='controller__'+clean(layoutId);
    else if(holderNames.has(obj))name=holderNames.get(obj);
    else if(obj.isMesh)name='surface__'+clean(obj.userData.sourceFile||obj.name)+'__'+meshNodes++;
    else name='transform__'+gltf.nodes.length;
    if(nodeNames.has(name))throw Error('Ambiguous GLB node name '+name);
    nodeNames.set(name,true);
    const node={name};
    const p=obj.position.toArray().map(numeric),r=obj.quaternion.toArray().map(numeric),
      scale=obj.scale.toArray().map(numeric);
    if(p.some(n=>n!==0))node.translation=p;
    if(r[0]!==0||r[1]!==0||r[2]!==0||r[3]!==1)node.rotation=r;
    if(scale.some(n=>n!==1))node.scale=scale;
    if(obj.isMesh){
      node.mesh=meshFor(obj);
      node.extras={sourceFile:obj.userData.sourceFile||null,role:obj.userData.role||'housing',
        sourceControl:obj.userData.control||null,artworkKey:obj.userData.artworkKey||null};
    }
    const index=gltf.nodes.length;gltf.nodes.push(node);
    if(parent!==null){gltf.nodes[parent].children??=[];gltf.nodes[parent].children.push(index);}
    if(holderNames.has(obj))partNodes[obj.userData.file||obj.name]=name;
    for(const child of obj.children)visit(child,index);
    return index;
  }
  visit(native.group);
  if(triangleCount!==sourceTriangles)throw Error('Visible source triangle count mismatch: '+triangleCount+' / '+sourceTriangles);
  if(!gltf.meshes.length)throw Error('Empty controller GLB');
  const bin=Buffer.concat(binary);
  gltf.buffers[0].byteLength=bin.length;
  const json=Buffer.from(JSON.stringify(gltf),'utf8');
  const jsonPadded=Buffer.concat([json,Buffer.alloc(align4(json.length)-json.length,0x20)]);
  const glb=Buffer.alloc(12+8+jsonPadded.length+8+bin.length);
  glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);
  glb.writeUInt32LE(jsonPadded.length,12);glb.writeUInt32LE(0x4e4f534a,16);
  jsonPadded.copy(glb,20);
  const binHeader=20+jsonPadded.length;
  glb.writeUInt32LE(bin.length,binHeader);glb.writeUInt32LE(0x004e4942,binHeader+4);
  bin.copy(glb,binHeader+8);
  return {glb,gltf,partNodes,stats:{sourceTriangles:triangleCount,glbTriangles:triangleCount,
    sourceVertexReferences:rawVertices,uniqueVertices,indexSavings:rawVertices-uniqueVertices,
    originalParts:native.parts.length,glbNodeCount:gltf.nodes.length,glbGeometryMeshes:gltf.meshes.length,
    glbBytes:glb.length,geometryBytes:drawGeometryBytes}};
}
