// The OBJ coordinates must remain in a right-handed frame; applying a
// negative Y scale before rotation makes co meshes face away from the camera.
// Three.js uses T * R * S, i.e. scale happens BEFORE the rotation.
const TRANSFORMS=Object.freeze({
  exo:Object.freeze({rotationX:Math.PI/2, rotationY:0,scale:Object.freeze([1,1,1])}),
  co:Object.freeze({rotationX:Math.PI/2, rotationY:0,scale:Object.freeze([1,1,1])}),
  padforge:Object.freeze({rotationX:-Math.PI/2, rotationY:0,scale:Object.freeze([1,1,1])}),
});
export function frontFaceTransform(source) {
  const preset=TRANSFORMS[source];
  if(!preset)throw new Error('Unsupported 3D model source: '+source);
  return preset;
}
export function transformControllerPoint(source, point) {
  const p=frontFaceTransform(source);
  const [x,y,z]=point.map((v,i)=>v*p.scale[i]);
  const c=Math.cos(p.rotationX),s=Math.sin(p.rotationX);
  return [x,c*y-s*z,s*y+c*z];
}
