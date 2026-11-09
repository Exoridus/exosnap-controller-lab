// Audit model derived from Exoridus/exosnap PR #517 ControllerGeometry.cpp and ControllerScene.qml.
// SHA: 161630c2b3b01023970a9505a10cd8d0d5e89a30. This is not a live Qt GPU counter.
// Every lathed profile segment contributes 2*(radialSegments+1) duplicate vertices and 2*radialSegments triangles.
const PROFILE_SEGMENTS=Object.freeze({stem:19,rim:16,cap:18,well:16});
export const NATIVE_QT_MODELS=Object.freeze({shell:1,sticks:8,buttons:17,total:26});
export function geometryBudget(radialSegments=64){
  if(!Number.isInteger(radialSegments)||radialSegments<3||radialSegments>256)throw new RangeError('Expected 3..256 radial segments');
  const profileSections=Object.values(PROFILE_SEGMENTS).reduce((n,c)=>n+c,0);
  const verticesPerPart=Object.fromEntries(Object.entries(PROFILE_SEGMENTS).map(([part,sections])=>[part,2*(radialSegments+1)*sections]));
  const uniqueVertices=Object.values(verticesPerPart).reduce((a,b)=>a+b,0);
  return Object.freeze({radialSegments,uniqueVertices,trianglesPerStick:2*radialSegments*profileSections,
    drawnStickVerticesTwo:2*uniqueVertices,verticesPerPart});
}
