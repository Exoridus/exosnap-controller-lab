// Browser-only free XY stick input, using authored motion.travelRadius.
export function clampStick(x,y){
  const a=Number.isFinite(x)?x:0,b=Number.isFinite(y)?y:0;
  const r=Math.hypot(a,b);
  return r>1?{x:a/r,y:b/r}:{x:a,y:b};
}
export function stickDragVector(start,current,radius){
  if(!(radius>0))throw new RangeError('Invalid authored stick travel radius');
  return clampStick((current.x-start.x)/radius,(current.y-start.y)/radius);
}
export function attachStickDrag(reference,{start=()=>{},move=()=>{},end=()=>{}}={}){
  const svg=reference.svg;
  if(!svg)return ()=>{};
  let dragging=null;
  const point=e=>{
    const transform=svg.getScreenCTM();if(!transform)return null;
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(transform.inverse());
    return {x:p.x,y:p.y};
  };
  const down=e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const entry=reference.controls.find(x=>x.stickSide&&x.group.contains(e.target));
    const p=point(e),radius=Number(entry?.layer.motion?.travelRadius);
    if(!entry||!p||!(radius>0))return;
    e.preventDefault();dragging={id:e.pointerId,side:entry.stickSide,origin:p,radius};
    start(entry.stickSide);
    try{svg.setPointerCapture(e.pointerId)}catch{}
  };
  const motion=e=>{
    if(!dragging||e.pointerId!==dragging.id)return;
    const p=point(e);if(!p)return;
    move(dragging.side,stickDragVector(dragging.origin,p,dragging.radius));
    e.preventDefault();
  };
  const release=e=>{
    if(!dragging||e.pointerId!==dragging.id)return;
    const side=dragging.side;dragging=null;end(side);
    try{if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId)}catch{}
  };
  svg.addEventListener('pointerdown',down);
  svg.addEventListener('pointermove',motion);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(name,release);
  return ()=>{
    if(dragging)end(dragging.side);
    dragging=null;
    svg.removeEventListener('pointerdown',down);
    svg.removeEventListener('pointermove',motion);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])svg.removeEventListener(name,release);
  };
}
