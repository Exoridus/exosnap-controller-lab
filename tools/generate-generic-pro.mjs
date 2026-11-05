// Deterministic ExoSnap original parametric controller geometry.
// Rebuilds native OBJ parts, supports later Blender editing. No third-party mesh input.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const generate=function generateGenericPro(){
 const parts=[],objs={},colors={shell:[.83,.84,.86],rear:[.24,.29,.35],well:[.34,.41,.48],button:[.26,.32,.39],bumper:[.44,.49,.56],stick:[.19,.24,.30],accent:[.38,.52,.63]};
 const n=x=>Number(x.toFixed(6));
 function put(name,V,F,color,parent=-1,position=[0,0,0]){
  if(V.length<3||F.length===0)throw Error("Invalid procedural part: "+name);
  objs[name]="# ExoSnap original procedural geometry; see tools/generate-generic-pro.mjs\n"+V.map(v=>`v ${v.map(n).join(" ")}`).join("\n")+"\n"+F.map(f=>`f ${f.map(x=>x+1).join(" ")}`).join("\n")+"\n";
  parts.push({filename:name,name:name.slice(0,-4).replace(/_/g," "),visible:true,parent,position,color});
 }
 const left=[[-.02,-.75],[-.48,-.75],[-.90,-.74],[-1.15,-.68],[-1.38,-.51],[-1.52,-.26],[-1.61,.06],[-1.64,.37],[-1.59,.69],[-1.48,.95],[-1.32,1.15],[-1.17,1.19],[-1.03,1.13],[-.88,.96],[-.73,.75],[-.53,.63],[-.30,.59],[0,.59]];
 const outline=[...left,...left.slice(1,-1).reverse().map(([x,z])=>[-x,z])];
 function shell(rings){const V=[],F=[],N=outline.length;for(const [y,scale] of rings)for(const [x,z] of outline)V.push([x*scale,y,z*scale]);
   for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){
    const a=j*N+i,b=j*N+(i+1)%N,c=(j+1)*N+(i+1)%N,d=(j+1)*N+i;F.push([a,b,c],[a,c,d]);
   }
   const base=V.length;V.push([0,rings[0][0],.1],[0,rings[rings.length-1][0],.1]);for(let i=0;i<N;i++){
    const k=(rings.length-1)*N;F.push([base,(i+1)%N,i],[base+1,k+i,k+(i+1)%N]);
   }return [V,F];
 }
 let [V,F]=shell([[-.06,.99],[.04,1],[.15,.97],[.20,.90]]);put("top_shell.obj",V,F,colors.shell);
 [V,F]=shell([[-.26,.79],[-.21,.93],[-.06,.99]]);put("bottom_shell.obj",V,F,colors.rear);
 function lathe(x,z,profile,seg=24){const V=[],F=[];for(const [r,y] of profile)for(let i=0;i<seg;i++){let a=i*2*Math.PI/seg;V.push([x+r*Math.cos(a),y,z+r*Math.sin(a)]);}
 for(let k=0;k<profile.length-1;k++)for(let i=0;i<seg;i++){
  const a=k*seg+i,b=k*seg+(i+1)%seg,c=(k+1)*seg+(i+1)%seg,d=(k+1)*seg+i;F.push([a,c,b],[a,d,c]);
 }return [V,F];}
 function disc(name,x,z,r,y0,y1,color,parent=-1,pos=[0,0,0]){const [V,F]=lathe(x,z,[[0,y0],[r*.93,y0],[r,y0+.02],[r*.98,y1-.025],[r*.84,y1],[0,y1]]);put(name,V,F,color,parent,pos);}
 function box(name,x,z,w,d,y0,y1,color){
  const V=[[x-w/2,y0,z-d/2],[x+w/2,y0,z-d/2],[x+w/2,y0,z+d/2],[x-w/2,y0,z+d/2],[x-w/2,y1,z-d/2],[x+w/2,y1,z-d/2],[x+w/2,y1,z+d/2],[x-w/2,y1,z+d/2]];
  const base=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  put(name,V,base.map(x=>x.slice().reverse()),color);
 }
 function torus(x,z,y,R=.22,r=.026){const V=[],F=[],N=32,T=8;for(let i=0;i<N;i++)for(let j=0;j<T;j++){
  const a=i*2*Math.PI/N,b=j*2*Math.PI/T,q=R+r*Math.cos(b);V.push([x+q*Math.cos(a),y+r*Math.sin(b),z+q*Math.sin(a)]);
 }for(let i=0;i<N;i++)for(let j=0;j<T;j++){const a=i*T+j,b=((i+1)%N)*T+j,c=((i+1)%N)*T+(j+1)%T,d=i*T+(j+1)%T;F.push([a,c,b],[a,d,c]);}return [V,F];}
 for(const [side,x] of [["left",-.53],["right",.53]]){
   const z=.28;
   [V,F]=torus(x,z,.225);put(side+"_ring.obj",V,F,colors.well);
   const stemIndex=parts.length;
   [V,F]=lathe(0,0,[[0,-.02],[.071,-.02],[.077,.12],[.065,.17],[0,.17]],20);
   put(side+"_stick.obj",V,F,colors.stick,-1,[x,.22,z]);
   [V,F]=lathe(0,0,[[0,.14],[.13,.14],[.16,.16],[.178,.19],[.176,.23],[.151,.245],[.09,.228],[0,.224]],28);
   put(side+"_cap.obj",V,F,colors.stick,stemIndex);
 }
 for(const [name,x,z] of [["a_button.obj",1.19,-.16],["b_button.obj",.99,.05],["x_button.obj",1.00,-.37],["y_button.obj",.79,-.16]])
   disc(name,x,z,.126,.195,.336,colors.button);
 for(const [name,x,z] of [["dpad_up.obj",-1.03,-.39],["dpad_down.obj",-1.03,-.05],["dpad_left.obj",-1.20,-.22],["dpad_right.obj",-.86,-.22]])
   box(name,x,z,.155,.155,.204,.29,colors.button);
 disc("back_button.obj",-.24,-.39,.067,.198,.267,colors.well);
 disc("start_button.obj",.24,-.39,.067,.198,.267,colors.well);
 disc("guide_button.obj",0,-.29,.080,.198,.282,colors.accent);
 for(const [side,x] of [["left",-1.19],["right",1.19]]){
   box(side+"_bumper.obj",x,-.69,.54,.23,.076,.225,colors.bumper);
   box(side+"_trigger.obj",x,-.83,.50,.27,-.19,-.038,colors.stick);
 }
 return {objs,manifest:{source:"ExoSnap original parametric model (no third-party mesh)",license:"MIT",description:"Compact, symmetric-sticks generic 3D gamepad with distinct controls and no brand markings",parts}};
};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/GenericPro');
const {objs,manifest}=generate();
await mkdir(root,{recursive:true});
for(const [filename,data] of Object.entries(objs))await writeFile(path.join(root,filename),data);
await writeFile(path.join(root,'info.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Created',Object.keys(objs).length,'original Generic Pro components');
