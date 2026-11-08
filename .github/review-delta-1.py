import hashlib,pathlib
items=[
('control-glyphs.js', 'c46a9906dda2d1f3be4af95c7751ea4bb73ad817d517d000a19504b3e075209e', 'ca6f4760cbdcf2fd88141025f3715c005d4186679e62f6ab20bf5b7dcc6024e9', [
(66,67,r"""function authoredTexture(paths,faceFrame){
"""),
(68,72,r""" const box=faceFrame||{minX:Math.min(...frames.map(f=>f.minX)),maxX:Math.max(...frames.map(f=>f.maxX)),
  minY:Math.min(...frames.map(f=>f.minY)),maxY:Math.max(...frames.map(f=>f.maxY))};
 const width=box.maxX-box.minX,height=box.maxY-box.minY;
 if(!(width>0&&height>0))return null;
"""),
(75,77,r""" ctx.scale(256/width,256/height);ctx.translate(-box.minX,-box.minY);
"""),
(79,82,r"""  ctx.lineJoin='round';ctx.lineCap='round';ctx.fillStyle='#ffffff';ctx.strokeStyle='#ffffff';
"""),
(83,86,r"""  const style=node.style,fill=style?.fill||node.getAttribute('fill');
"""),
(87,92,r"""   ctx.lineWidth=parseFloat(style?.strokeWidth||node.getAttribute('stroke-width'))||.5;ctx.stroke(mark);
  }else ctx.fill(mark,style?.fillRule||node.getAttribute('fill-rule')||'nonzero');
"""),
(94,95,r""" const texture=new THREE.CanvasTexture(canvas);
"""),
(96,97,r""" return texture;
"""),
(126,128,r"""// Record planar UVs on existing source vertices before exact geometry sharing.
// No extra mesh, offset plane, z-fighting, side-wall bleed or additional draw.
export function prepareSurfaceArtwork(mesh,source,bounds,model){
 if(source!=='co'&&source!=='exo')return false;
 const file=mesh.userData.sourceFile;
 const face=faceButtonGlyph(file,model);
 const key=face?.toLowerCase()||String(file).match(/^dpad_(up|down|left|right)[.]obj$/)?.[1];
 if(!key)return false; // Share/Options artwork above the surface is deliberately removed.
 const width=bounds.max.x-bounds.min.x,height=bounds.max.z-bounds.min.z;
 if(!(width>0&&height>0))return false;
 const positions=mesh.geometry.getAttribute('position'),uv=new Float32Array(positions.count*2);
 for(let i=0;i<positions.count;i++){
  uv[i*2]=(positions.getX(i)-bounds.min.x)/width;
  uv[i*2+1]=1-(positions.getZ(i)-bounds.min.z)/height;
 }
 mesh.geometry.setAttribute('controllerMarkUv',new THREE.BufferAttribute(uv,2));
 Object.assign(mesh.userData,{artworkKey:key,buttonGlyph:face||undefined,
  surfaceArtwork:'button-material',sourceFaceDimensions:{width,height}});
 return true;
}
export function installSurfaceMarking(mesh,texture){
 const material=mesh.material;
 const directional=/^(up|down|left|right)$/.test(mesh.userData.artworkKey);
 const c=mesh.userData.sourceColor||new THREE.Color('#eeeeee');
 const light=.2126*c.r+.7152*c.g+.0722*c.b>.25;
 const idle=new THREE.Color(directional||light?'#303030':'#eeeeee');
 const state={mask:{value:texture},enabled:{value:1},ink:{value:idle.clone()},idle,active:new THREE.Color('#ffffff')};
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.controllerMarkMask=state.mask;shader.uniforms.controllerMarkEnabled=state.enabled;shader.uniforms.controllerMarkInk=state.ink;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nattribute vec2 controllerMarkUv;\nvarying vec2 vControllerMarkUv;\nvarying float vControllerMarkFacing;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvControllerMarkUv=controllerMarkUv;\nvControllerMarkFacing=normal.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\nuniform sampler2D controllerMarkMask;\nuniform float controllerMarkEnabled;\nuniform vec3 controllerMarkInk;\nvarying vec2 vControllerMarkUv;\nvarying float vControllerMarkFacing;')
   .replace('#include <map_fragment>','#include <map_fragment>\nfloat inkAlpha=texture2D(controllerMarkMask,vControllerMarkUv).a*controllerMarkEnabled*step(0.45,vControllerMarkFacing);\ndiffuseColor.rgb=mix(diffuseColor.rgb,controllerMarkInk,inkAlpha);');
 };
 material.customProgramCacheKey=()=>previousKey+'|controller-surface-ink-v1';
 material.userData.surfaceMarking=state;material.needsUpdate=true;
 return state;
}
export function setControllerMarkings(native,enabled){
 for(const mesh of native?.meshes||[]){
  const state=mesh.material?.userData.surfaceMarking;
  if(state)state.enabled.value=enabled?1:0;
 }
}
// Source symbols keep their actual position inside each authored 2D button.
// One immutable alpha mask per surface, prepared once at model/artwork load.
"""),
(130,133,r""" let count=0;native.artworkTextures??=new Set();
 for(const mesh of native.meshes){
  const key=mesh.userData.artworkKey;if(!key)continue;
"""),
(135,138,r"""  if(!paths.length)continue;
"""),
(139,160,r"""  const texture=authoredTexture(paths,face?pathFrame(face):null);if(!texture)continue;
  const existing=mesh.material.userData.surfaceMarking;
  if(existing){existing.mask.value.dispose();native.artworkTextures.delete(existing.mask.value);existing.mask.value=texture;}
  else installSurfaceMarking(mesh,texture);
  native.artworkTextures.add(texture);
  mesh.userData.artworkSource='2d-svg';mesh.userData.authoredPathCount=paths.length;count++;
 }
 return count;
"""),
(161,162,r""""""),
]),
('controller-demo.js', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'dc74de1500300879f5fb0a3af1f47dc5048e645f18285a32202eac46d9653b61', [
(0,0,r"""// Renderer-neutral input only. Restored from the v40 app.js updateDemo sequence
// and demoStickAxes; the same state feeds SVG and physical PBR controls.
import {demoStickAxes} from './stick-visual-state.js';
const KEYS=Object.freeze(['b1','b2','b3','b4','up','right','down','left','l1','r1','l2','r2','ls','rs','select','start','home','touchpad']);
const SEQUENCE=Object.freeze(['b1','b2','b3','b4','up','right','down','left','l1','r1','l2','r2','ls','rs','b1+b4','l2+r2','ls+rs','l2+b1']);
const stepMs=1000,leadMs=1200,tailMs=800;
export const DEMO_DURATION_MS=leadMs+SEQUENCE.length*stepMs+tailMs;
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const smooth=n=>{const x=clamp(n);return x*x*(3-2*x);};
export function createControllerState(){
 return {values:new Map(KEYS.map(k=>[k,0])),left:{x:0,y:0,click:false,activity:0},
  right:{x:0,y:0,click:false,activity:0},triggers:{left:0,right:0},allPressed:false,source:'neutral',normalized:true};
}
function clear(out){
 for(const k of out.values.keys())out.values.set(k,0);
 for(const side of ['left','right'])Object.assign(out[side],{x:0,y:0,click:false,activity:0});
 out.triggers.left=out.triggers.right=0;out.allPressed=false;return out;
}
function sync(out){
 for(const [side,key]of [['left','ls'],['right','rs']]){
  out[side].click=out.values.get(key)>.5;
  out[side].activity=clamp((Math.hypot(out[side].x,out[side].y)-.08)/.92);
 }
 out.triggers.left=out.values.get('l2')||0;out.triggers.right=out.values.get('r2')||0;return out;
}
export function demoStateAt(milliseconds,out=createControllerState()){
 clear(out);out.source='demo';
 const t=((Number(milliseconds)||0)%DEMO_DURATION_MS+DEMO_DURATION_MS)%DEMO_DURATION_MS;
 // Neutral seam, slow entry/exit, and the existing non-identical left/right arcs.
 const envelope=smooth(t/700)*smooth((DEMO_DURATION_MS-t)/tailMs);
 const left=demoStickAxes(t,'left'),right=demoStickAxes(t,'right');
 out.left.x=left.x*envelope;out.left.y=left.y*envelope;
 out.right.x=right.x*envelope;out.right.y=right.y*envelope;
 const tick=(t-leadMs)/stepMs,index=Math.floor(tick),p=tick-index;
 if(index>=0&&index<SEQUENCE.length){
  const keys=SEQUENCE[index].split('+');
  // Deliberate long/short presses; analog triggers ramp up and down.
  const end=index%3===0?.56:.83;
  const digital=smooth((p-.10)/.08)*smooth((end-p)/.10);
  for(const key of keys)out.values.set(key,key==='l2'||key==='r2'
    ?smooth((p-.08)/.30)*smooth((.92-p)/.30):digital);
 }
 return sync(out);
}
function copyState(from,out,source){
 clear(out);out.source=source;
 if(from){
  for(const [key,v]of from.values||[])out.values.set(key,clamp(v));
  for(const side of ['left','right']){
   const stick=from[side];out[side].x=Number(stick?.x)||0;out[side].y=Number(stick?.y)||0;
   if(stick?.click)out.values.set(side==='left'?'ls':'rs',1);
  }
  out.values.set('l2',Math.max(out.values.get('l2')||0,clamp(from.triggers?.left)));
  out.values.set('r2',Math.max(out.values.get('r2')||0,clamp(from.triggers?.right)));
  if(from.allPressed)for(const key of KEYS)out.values.set(key,1);
 }
 return sync(out);
}
function active(state){
 if(!state)return false;
 for(const v of state.values?.values()||[])if(v>.08)return true;
 return Math.hypot(state.left?.x||0,state.left?.y||0)>.08||Math.hypot(state.right?.x||0,state.right?.y||0)>.08;
}
export class ControllerDemo{
 constructor(){this.enabled=true;this.demoTime=0;this.lastTime=null;this.liveUntil=0;this.output=createControllerState();}
 setEnabled(value){this.enabled=Boolean(value);this.lastTime=null;}
 resetClock(){this.lastTime=null;}
 sample(now,{manual=null,live=null}={}){
  const dt=this.lastTime===null?0:Math.max(0,Math.min(100,now-this.lastTime));this.lastTime=now;
  if(active(live))this.liveUntil=now+1000;
  if(manual)return copyState(manual,this.output,'manual');
  if(live&&now<this.liveUntil)return copyState(live,this.output,'live');
  if(!this.enabled)return copyState(live,this.output,live?'live':'neutral');
  this.demoTime+=dt;
  return demoStateAt(this.demoTime,this.output);
 }
}
"""),
]),
('controller-lab-style.js', '8e7419520f783c55ab33179b09b757e9711d938e6eb7c6b8f4d78c427d994194', '28a2d802332235c9a634e06e81740e8ed56d7897cf28972b1c6b3970278fa362', [
(48,49,r"""    nativeValidated:false,demoDefault:true,markingsDefault:true,
    markings:{technique:'alpha mask in existing button material',extraDrawCalls:0,floatingMenuLabels:false},
"""),
(52,53,r"""      controlOpacity:.30,activeOpacity:.96,activeColor:activeColor2D,
"""),
(64,64,r"""
// Independent 2D material control. 70% transparency -> 30% resting coverage;
// inputs can still reach nearly opaque white at every neutral setting.
export function resolveFlatMaterial(transparency=.70){
 return {neutralOpacity:1-clamp(transparency),activeOpacity:.96};
}
"""),
]),
('controller-reference.js', 'e4b7f52e8dfb9d643fee91796d8e6ce835011927eed164e94bf58b9fefd732df', '7203f2708b0e30796f6b50c246a83284cae6179b1a0f5e7eb99ce760792026d3', [
(86,87,r"""        if(entry?.control)this.onPress(entry.control,event);
"""),
]),
('pbr-appearance.js', 'b365933d0f26c85e2291f416ce22cccede840f1178003cbbbab2e6e894ff6054', 'd2cefbe5c8bd6a613a8cd23f43f379f5178a749d23fb838f87f1164ec76c4293', [
(9,10,r"""import {stickMechanics,triggerMechanics} from './model-mechanics.js';
import {pressTravelFor} from './v24-policy.js';
"""),
(16,16,r"""const stickPoseRotation=new THREE.Quaternion();
"""),
(19,19,r"""  if(input?.normalized===true)return input;
"""),
(104,104,r"""      const marking=m.userData.surfaceMarking;
      if(marking)marking.ink.value.copy(marking.idle).lerp(marking.active,amount*.35);
"""),
(188,189,r"""    const q=stickPoseRotation.setFromEuler(tmpEuler.set(s.y*tilt,0,-s.x*tilt*frontSign));
"""),
(194,194,r"""
// Restore the v40 artifact's highlightPart mechanics in the existing PBR rig.
// Pose only: materials and child-attached contours/markings remain independent.
const controlRotation=new THREE.Quaternion();
export function applyControlPoseToRig(native,input={}){
  if(!native?.parts)return;
  applyStickPoseToRig(native,input);
  if(!native.controlMotionBindings){
    const mechanism=triggerMechanics(native.model?.id);
    native.controlMotionBindings=native.parts.filter(p=>p.holder.userData.control&&
      !p.holder.userData.role.startsWith('stick-')).map(p=>{
      const key=p.holder.userData.control,trigger=key==='l2'||key==='r2';
      const travel=trigger?{x:0,y:0,z:0}:pressTravelFor(key,native.model.source==='padforge'?'padforge':'co');
      if(trigger&&mechanism.translation)[travel.x,travel.y,travel.z]=mechanism.translation;
      return {holder:p.holder,key,trigger,travel,
        angle:trigger?-mechanism.maxRotationDeg*Math.PI/180:0,
        rest:p.holder.position.clone(),rotation:p.holder.quaternion.clone()};
    });
  }
  for(const b of native.controlMotionBindings){
    const raw=input?.values instanceof Map?input.values.get(b.key):input?.values?.[b.key];
    const analog=b.key==='l2'?input?.triggers?.left:b.key==='r2'?input?.triggers?.right:0;
    const amount=input===true||input?.allPressed?1:Math.max(clamp01(raw),clamp01(analog));
    b.holder.position.set(b.rest.x+b.travel.x*amount,b.rest.y+b.travel.y*amount,b.rest.z+b.travel.z*amount);
    b.holder.quaternion.copy(b.rotation);
    if(b.angle)b.holder.quaternion.multiply(controlRotation.setFromEuler(tmpEuler.set(b.angle*amount,0,0)));
  }
}
"""),
]),
('pbr-model.js', '84c0c10ac01f53b8965f4c555244a4d94cbfccc29e3a79aa470f1530f561715a', 'fa9b4179a954e53881b6d3dba7f833eec028e430755767f34683b758128ae69c', [
(7,8,r"""import {prepareSurfaceArtwork} from './control-glyphs.js';
"""),
(45,45,r"""    // Generated Generic Pro parts have global vertices and no authored hinge.
    // Rebase its trigger at the front/top attachment, preserving its rest pose.
    if(model.source==='exo'&&role.role==='trigger'){
      transform.pivot=[localCenter.x,sourceBounds.max.y,sourceBounds.max.z];
      transform.geometryOffset=transform.pivot.map(v=>-v);
    }
"""),
(64,64,r"""      prepareSurfaceArtwork(o,model.source,sourceBounds,model);
"""),
(67,69,r""""""),
(110,114,r"""  for(const texture of native.artworkTextures||[])texture.dispose();
"""),
]),
('polish-2d-style.js', 'b773c24051ac2d58c9fc6bc539ae25cc646040faa4be0b018174b4be60015164', '08e144f41dca0339c868b42ce0a33f31c698c896d51426c54254e4c761e1ec31', [
(119,120,r"""function paint(node,name,value){const v=String(value);if(node.style.getPropertyValue(name)!==v)node.style.setProperty(name,v,'important');}
"""),
(349,349,r"""// One source-shaped annulus per stick, with the original center cut out.
// The mask is applied to an untransformed wrapper in the stick GROUP frame.
// Both cloned shapes retain their authored transforms; no getBBox-on-ellipse
// shortcut, no cut-off crescents, and no second alpha layer under the center.
function ensureStickAnnulus(reference,entry,outer,center){
 if(entry.polishAnnulusFill)return entry.polishAnnulusFill;
 const svg=reference.svg;
 let defs=svg.querySelector('defs');
 if(!defs){defs=document.createElementNS(svgNs,'defs');svg.insertBefore(defs,svg.firstChild);}
 const box=entry.group.getBBox(),id=outer.id+'-annulus-mask';
 const mask=filterNode('mask',{id,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',
  x:box.x-2,y:box.y-2,width:box.width+4,height:box.height+4});
 mask.appendChild(filterNode('rect',{x:box.x-2,y:box.y-2,width:box.width+4,height:box.height+4,fill:'white'}));
 const cutout=center.cloneNode(true);cutout.removeAttribute('id');cutout.removeAttribute('style');
 for(const [k,v]of Object.entries({fill:'black',stroke:'none',opacity:1,'fill-opacity':1}))cutout.setAttribute(k,String(v));
 mask.appendChild(cutout);defs.appendChild(mask);
 const wrapper=filterNode('g',{mask:'url(#'+id+')','pointer-events':'none','data-exo-stick-annulus':'1'});
 const ring=outer.cloneNode(true);ring.removeAttribute('id');ring.removeAttribute('style');
 ring.setAttribute('data-exo-stick-annulus-fill','1');ring.setAttribute('stroke','none');ring.setAttribute('opacity','1');
 wrapper.appendChild(ring);entry.group.insertBefore(wrapper,outer);
 entry.polishAnnulusFill=ring;return ring;
}
"""),
(365,365,r"""  if(colors.ringSurface&&center){
    const annulus=ensureStickAnnulus(reference,entry,outer,center);
    const state=controlSurfaceState(colors,ring);
    paint(annulus,'fill',state.fill);paint(annulus,'fill-opacity',state.alpha);
    paint(annulus,'stroke','none');
    paint(outer,'fill','none');paint(outer,'fill-opacity',0);
    paint(outer,'stroke',colors.controlStroke);paint(outer,'stroke-opacity',colors.controlStrokeAlpha);
    outer.style.removeProperty('filter');
    paintControl(center,colors,levels.center);
    paint(center,'stroke',colors.controlStroke);paint(center,'stroke-opacity',colors.controlStrokeAlpha);
    return;
  }
"""),
(415,419,r"""    if(colors.markingsVisible!==false&&(!isFace||showFaceSymbols))glyph.style.removeProperty('display');
    else paint(glyph,'display','none');
"""),
(519,520,r"""  coherentContours=false,ringSurface=false,material2D=null,markings=true
"""),
(527,527,r"""  colors.markingsVisible=markings;colors.ringSurface=ringSurface;
  if(material2D){colors.controlAlpha=clamp(material2D.neutralOpacity);colors.activeAlpha=clamp(material2D.activeOpacity);}
"""),
]),
 ]
for name,before,after,edits in items:
 p=pathlib.Path(name)
 source=p.read_text() if p.exists() else ''
 assert hashlib.sha256(source.encode()).hexdigest()==before, 'Source changed: '+name
 lines=source.splitlines(keepends=True)
 for a,b,text in reversed(edits): lines[a:b]=[text]
 result=''.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==after, 'Result mismatch: '+name
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(result)
print('Verified source files:', len(items))
