// Node/browser-independent source OBJ audit; does not change meshes.
export function auditObj(text){
  if(typeof text!=='string')return null;
  const vertices=[];
  const edges=new Map();
  let faces=0, triangles=0, degenerates=0,invalid=0, ngons=0;
  for(const line of text.split(/\r?\n/)){
    if(line.startsWith('v ')){
      const arr=line.trim().split(/\s+/).slice(1,4).map(Number);
      vertices.push(arr);
    }else if(line.startsWith('f ')){
      const ids=line.trim().split(/\s+/).slice(1).map(token=>{
        const k=Number(token.split('/')[0]);
        return Number.isInteger(k)?(k<0?vertices.length+k:k-1):-1;
      });
      if(ids.length<3){invalid++;continue;}
      faces++;if(ids.length>4)ngons++;
      for(let j=1;j<ids.length-1;j++){
        triangles++;
        const a=vertices[ids[0]],b=vertices[ids[j]],c=vertices[ids[j+1]];
        if(!a||!b||!c){invalid++;continue;}
        const u=b.map((v,n)=>v-a[n]),v=c.map((v,n)=>v-a[n]);
        const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        if(Math.hypot(...cross)<1e-10)degenerates++;
      }
      for(let j=0;j<ids.length;j++){
        const a=ids[j],b=ids[(j+1)%ids.length];
        if(a<0||b<0||a>=vertices.length||b>=vertices.length){invalid++;continue;}
        const key=a<b?a+':'+b:b+':'+a;
        edges.set(key,(edges.get(key)||0)+1);
      }
    }
  }
  const edgeCounts=[...edges.values()];
  return {
    vertices:vertices.length,faces,triangles,ngons,degenerateTriangles:degenerates,
    invalidReferences:invalid,boundaryEdges:edgeCounts.filter(c=>c===1).length,
    nonManifoldEdges:edgeCounts.filter(c=>c>2).length
  };
}
