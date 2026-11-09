// All panels share a renderer and controller state. The 2D reference has a
// front-facing camera that follows screen-space pan and zoom only.
// Coordinates to WebGL viewport use CSS pixels, converted by the renderer DPR.
export function panelViewport(canvas,cell){
  if(!canvas||!cell||cell.width<=0||cell.height<=0)return null;
  const left=Math.max(0,Math.round(cell.left-canvas.left));
  const bottom=Math.max(0,Math.round(canvas.bottom-cell.bottom));
  const right=Math.min(Math.round(canvas.width),Math.round(cell.right-canvas.left));
  const top=Math.min(Math.round(canvas.height),Math.round(canvas.bottom-cell.top));
  const width=right-left,height=top-bottom;
  return width>0&&height>0?{x:left,y:bottom,width,height}:null;
}
export function pointerPanel(cells,x,y){
  return cells.find(cell=>{const r=cell.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;})||null;
}
export function referencePlaneSize(width,aspect){
  if(!Number.isFinite(width)||width<=0||!Number.isFinite(aspect)||aspect<=0)throw Error('Invalid 2D plane aspect');
  return {width,height:width/aspect};
}

// Accumulate pan in the source camera's screen basis when the orbit target
// moves. Re-projecting the absolute target every frame would make an earlier
// pan rotate when the user orbits; copying target.x/y would lose side-view pan.
export function syncFlatReferenceCamera(flat,source,target,aspect){
  source.updateMatrixWorld(true);
  const pan=flat.userData.referencePan||(flat.userData.referencePan={x:0,y:0,lastX:0,lastY:0,lastZ:0});
  const dx=target.x-pan.lastX,dy=target.y-pan.lastY,dz=target.z-pan.lastZ;
  const basis=source.matrixWorld.elements;
  if(Math.abs(target.x)+Math.abs(target.y)+Math.abs(target.z)<1e-10){pan.x=0;pan.y=0;}
  else {
    pan.x+=dx*basis[0]+dy*basis[1]+dz*basis[2];
    pan.y+=dx*basis[4]+dy*basis[5]+dz*basis[6];
  }
  pan.lastX=target.x;pan.lastY=target.y;pan.lastZ=target.z;
  const height=source.isOrthographicCamera
    ?(source.top-source.bottom)/source.zoom
    :2*source.position.distanceTo(target)*Math.tan(source.fov*Math.PI/360)/source.zoom;
  const halfHeight=Math.max(1e-6,height/2),halfWidth=halfHeight*Math.max(1e-6,aspect);
  flat.left=-halfWidth;flat.right=halfWidth;flat.top=halfHeight;flat.bottom=-halfHeight;flat.zoom=1;
  flat.position.set(pan.x,pan.y,12);flat.up.set(0,1,0);flat.lookAt(pan.x,pan.y,0);
  flat.updateProjectionMatrix();flat.updateMatrixWorld(true);
  return flat;
}
