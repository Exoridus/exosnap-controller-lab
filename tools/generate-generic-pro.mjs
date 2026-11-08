// Rebuild the existing segmented Generic Pro rig from its approved native SVG
// profile. This corrects the old blockout's topology and wrong control layout;
// it is not a replacement proxy mesh or a new controller design.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import * as THREE from 'three';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/GenericPro');
const profile=JSON.parse(await readFile(path.join(root,'source-profile.json'),'utf8'));
const source=await readFile(new URL('../references/controllers/generic/source.svg',import.meta.url));
if(createHash('sha256').update(source).digest('hex')!==profile.sha256)throw Error('Generic source profile is stale; run tools/extract-generic-profile.py');
const parts=[],objs={},colors={shell:[.83,.84,.86],rear:[.24,.29,.35],well:[.34,.41,.48],button:[.26,.32,.39],bumper:[.44,.49,.56],stick:[.19,.24,.30],accent:[.38,.52,.63]};
const number=n=>Number(n.toFixed(6));
function put(name,geometry,color,parent=-1,position=[0,0,0]){
 const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position;
 if(!g.attributes.normal)g.computeVertexNormals();const normal=g.attributes.normal;
 const lines=['# ExoSnap Generic Pro; approved SVG profile + bounded bevel/depth rig; MIT AND CC0-1.0'];
 for(let i=0;i<p.count;i++)lines.push('v '+[p.getX(i),p.getY(i),p.getZ(i)].map(number).join(' '));
 for(let i=0;i<p.count;i++)lines.push('vn '+[normal.getX(i),normal.getY(i),normal.getZ(i)].map(number).join(' '));
 for(let i=0;i<p.count;i+=3)lines.push('f '+[i+1,i+2,i+3].map(j=>j+'//'+j).join(' '));
 objs[name]=lines.join('\n')+'\n';parts.push({filename:name,name:name.slice(0,-4).replaceAll('_',' '),visible:true,parent,position,color});g.dispose();if(g!==geometry)geometry.dispose();
}
function contour(id){return profile.contours[id];}
function center(points){const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2];}
function extrude(points,y0,y1,bevel=.018){
 const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
 const g=new THREE.ExtrudeGeometry(shape,{depth:y1-y0,steps:1,bevelEnabled:bevel>0,bevelSegments:3,bevelSize:bevel,bevelThickness:bevel,curveSegments:12});
 return g.rotateX(-Math.PI/2).translate(0,y0,0);
}
// The author-approved perimeter is triangulated as a concave polygon, not a
// center fan (the old fan crossed the grip notch and duplicated interior caps).
put('top_shell.obj',extrude(contour('outline-strong'),.015,.19,.035),colors.shell);
put('bottom_shell.obj',extrude(contour('outline-strong').map(([x,z])=>[x*.97,z*.97]),-.205,-.045,.025),colors.rear);
function lathe(profile,segments=32){return new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);}
for(const [side,id]of [['left','stick-l-cap-outline'],['right','stick-r-cap-outline']]){
 const points=contour(id),[x,z]=center(points),radius=(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])))/2;
 // The visible outer ring belongs to the same physical moving cap assembly.
 const parent=parts.length;
 put(side+'_stick.obj',lathe([[0,-.02],[radius*.38,-.02],[radius*.38,.115],[radius*.31,.16],[0,.16]],24),colors.stick,-1,[x,.225,z]);
 const ring=new THREE.TorusGeometry(radius*1.02,.014,8,40).rotateX(-Math.PI/2).translate(0,.221,0);
 put(side+'_ring.obj',ring,colors.stick,parent);
 put(side+'_cap.obj',lathe([[0,.13],[radius*.75,.13],[radius*.95,.16],[radius,.19],[radius*.97,.225],[radius*.85,.237],[radius*.45,.218],[0,.214]],40),colors.stick,parent);
}
for(const letter of ['a','b','x','y'])put(letter+'_button.obj',extrude(contour('btn-'+letter+'-face'),.215,.29,.012),colors.button);
// Four sectors of the SAME approved connected D-pad perimeter, with no gaps,
// overlapping square pads, or invented direction glyphs. They retain separate
// input/material/push transforms like the other native rigs.
const dpad=contour('path19817'),[dx,dz]=center(dpad);
function clip(points,a,b){
 const out=[];for(let i=0;i<points.length;i++){
  const p=points[i],q=points[(i+1)%points.length],v=a*(p[0]-dx)+b*(p[1]-dz),w=a*(q[0]-dx)+b*(q[1]-dz);
  if(v>=-1e-9)out.push(p);
  if((v>0)!==(w>0)){const t=v/(v-w);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
 }return out.filter((p,i)=>i===0||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>1e-7);
}
for(const [dir,planes]of Object.entries({up:[[1,-1],[-1,-1]],down:[[1,1],[-1,1]],left:[[-1,1],[-1,-1]],right:[[1,1],[1,-1]]})){
 let points=dpad;for(const [a,b]of planes)points=clip(points,a,b);
 put('dpad_'+dir+'.obj',extrude(points,.22,.285,0),colors.button);
}
for(const [file,id]of [['back_button.obj','btn-view-face'],['start_button.obj','btn-menu-face'],['guide_button.obj','btn-home-face']])
 put(file,extrude(contour(id),.215,.267,.009),colors.well);
for(const [side,key]of [['left','l'],['right','r']]){
 put(side+'_bumper.obj',extrude(contour('btn-'+key+'1-pressure'),.08,.19,.018),colors.bumper);
 put(side+'_trigger.obj',extrude(contour('trigger-'+key+'2-pressure'),-.17,-.045,.018),colors.stick);
}
await mkdir(root,{recursive:true});for(const [name,data]of Object.entries(objs))await writeFile(path.join(root,name),data);
await writeFile(path.join(root,'info.json'),JSON.stringify({source:'ExoSnap segmented Generic Pro; profile from approved native SVG',license:'MIT AND CC0-1.0',profileSource:profile.source,profileSha256:profile.sha256,description:'Approved source contours, real bevel/depth surfaces, corrected button/stick locations, same 23-part mechanical rig',parts},null,2)+'\n');
console.log('Rebuilt',parts.length,'source-profile Generic Pro components');
