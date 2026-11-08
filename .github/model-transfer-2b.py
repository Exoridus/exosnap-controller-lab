import hashlib,pathlib
items=[
('tools/capture-consolidated.mjs', '9dd474fa25b149b41b587e57eec3d3c0617e35343c6bc280b7cd4f844ce40f51', 'db77c2d84b3b20b8c3db409d8fd205ad4385872d1f8e702b3188e8ec83b4fe18', [
(4,4,r"""import {CONTROL_CONTOURS} from '../controller-visual-policy.js';
"""),
(13,14,r"""  if(!expected||!same(item.housing,expected)||!same(item.button,CONTROL_CONTOURS[item.scene]))
"""),
(22,23,r"""  if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)<3)
"""),
(72,73,r"""      button:stroke([...svg.querySelectorAll('[id$="-btn-cross"] path,[id$="-btn-cross"] ellipse')].find(n=>!n.classList.contains('glyph')&&getComputedStyle(n).stroke!=='none'))||stroke(button),glyph:fill(glyph),surface:button?getComputedStyle(button).fill:'',
"""),
]),
('tools/capture-pages.mjs', 'fbdd3fa680f0fe57a469b52d2aba54abb44b5ec5525ffad3e7028fc088f2187b', '7a14a00c4fdfa6264e2a8d363752ab1f6faae8d30d388c11d30426c13bfe01bc', [
(12,12,r"""import {captureModelConsistency} from './capture-model-consistency.mjs';
"""),
(77,77,r"""  await captureModelConsistency(page,{output,images,shotProof});
"""),
]),
('tools/extract-generic-profile.py', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '36caae7fbf66ea22dbeee2e09cb8f8e764d4bf70c83b87b0ab047aaff927436d', [
(0,0,r'''"""Bake source SVG contours for the existing GenericPro OBJ asset generator.
Build-time only: requires fonttools and lxml. No SVG parsing or texture work per frame.
Coordinates and control locations come from the pinned, approved native SVG.
"""
import hashlib,json,math,re
from pathlib import Path
from lxml import etree
from fontTools.svgLib.path import parse_path
from fontTools.pens.basePen import BasePen
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'references/controllers/generic/source.svg'
class Flatten(BasePen):
    def __init__(self):super().__init__(None);self.contours=[];self.points=[]
    def _moveTo(self,p):
        if self.points:self.contours.append(self.points)
        self.points=[p]
    def _lineTo(self,p):self.points.append(p)
    def _curveToOne(self,a,b,c):
        p=self._getCurrentPoint()
        for i in range(1,9):
            t=i/8;u=1-t;self.points.append(tuple(u**3*p[j]+3*u*u*t*a[j]+3*u*t*t*b[j]+t**3*c[j] for j in range(2)))
    def _qCurveToOne(self,a,b):
        p=self._getCurrentPoint()
        for i in range(1,9):
            t=i/8;u=1-t;self.points.append(tuple(u*u*p[j]+2*u*t*a[j]+t*t*b[j] for j in range(2)))
    def _closePath(self):self.contours.append(self.points);self.points=[]
    def _endPath(self):self._closePath()
def multiply(a,b):return [[sum(a[i][k]*b[k][j] for k in range(3))for j in range(3)]for i in range(3)]
def matrix(text):
    result=[[1,0,0],[0,1,0],[0,0,1]]
    for name,raw in re.findall(r'(\w+)\(([^)]+)\)',text or ''):
        v=[float(x)for x in re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',raw)]
        if name=='matrix':a,b,c,d,e,f=v;m=[[a,c,e],[b,d,f],[0,0,1]]
        elif name=='translate':m=[[1,0,v[0]],[0,1,v[1] if len(v)>1 else 0],[0,0,1]]
        elif name=='scale':m=[[v[0],0,0],[0,v[1] if len(v)>1 else v[0],0],[0,0,1]]
        elif name=='rotate':
            a=math.radians(v[0]);c,s=math.cos(a),math.sin(a);m=[[c,-s,0],[s,c,0],[0,0,1]]
            if len(v)>1:m=multiply(multiply([[1,0,v[1]],[0,1,v[2]],[0,0,1]],m),[[1,0,-v[1]],[0,1,-v[2]],[0,0,1]])
        else:raise ValueError('Unsupported source transform '+name)
        result=multiply(result,m)
    return result
def simplify(points,tolerance=1.0):
    if len(points)<3:return points
    a,b=points[0],points[-1];vx,vy=b[0]-a[0],b[1]-a[1];length=math.hypot(vx,vy)
    distances=[abs(vx*(p[1]-a[1])-vy*(p[0]-a[0]))/length if length else math.dist(a,p)for p in points]
    at=max(range(len(points)),key=distances.__getitem__)
    if distances[at]<=tolerance:return [a,b]
    return simplify(points[:at+1],tolerance)[:-1]+simplify(points[at:],tolerance)
root=etree.fromstring(SOURCE.read_bytes())
def contour(id):
    n=root.xpath('//*[@id=$id]',id=id)[0];tag=etree.QName(n).localname
    if tag in ['ellipse','circle']:
        cx=float(n.get('cx'));cy=float(n.get('cy'));rx=float(n.get('rx',n.get('r','0')));ry=float(n.get('ry',n.get('r','0')))
        pts=[(cx+rx*math.cos(i*math.tau/64),cy+ry*math.sin(i*math.tau/64))for i in range(64)]
    else:
        pen=Flatten();parse_path(n.get('d'),pen)
        if pen.points:pen._endPath()
        pts=max(pen.contours,key=len)
    mats=[matrix(p.get('transform'))for p in reversed([n,*n.iterancestors()])];m=[[1,0,0],[0,1,0],[0,0,1]]
    for mat in mats:m=multiply(m,mat)
    transformed=[(m[0][0]*x+m[0][1]*y+m[0][2],m[1][0]*x+m[1][1]*y+m[1][2])for x,y in pts]
    return simplify(transformed+[transformed[0]],.85)[:-1]
ids=['outline-strong','path19817','btn-a-face','btn-b-face','btn-x-face','btn-y-face','btn-view-face','btn-menu-face','btn-home-face','btn-share-face','stick-l-cap-outline','stick-r-cap-outline','btn-l1-pressure','btn-r1-pressure','trigger-l2-pressure','trigger-r2-pressure']
shapes={id:contour(id)for id in ids};shell=shapes['outline-strong'];minx=min(x for x,y in shell);maxx=max(x for x,y in shell);miny=min(y for x,y in shell);maxy=max(y for x,y in shell);scale=3.28/(maxx-minx)
shapes={id:[[round((x-(minx+maxx)/2)*scale,6),round((y-(miny+maxy)/2)*scale,6)]for x,y in pts]for id,pts in shapes.items()}
out={'source':'references/controllers/generic/source.svg','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'license':'MIT AND CC0-1.0','contours':shapes}
(ROOT/'assets/GenericPro/source-profile.json').write_text(json.dumps(out,indent=2)+'\n')
print({k:len(v)for k,v in shapes.items()})
'''),
]),
('tools/generate-generic-pro.mjs', '03b0c171ff1bb7fa4f4a2112c1b5a139b54cd5cf06c58691f08148eaf360eec3', 'def95f4179ffcc1e0b58b0e1f14b46f8202c9d5fff00582c1c743065dcff36a4', [
(0,60,r"""// Rebuild the existing segmented Generic Pro rig from its approved native SVG
// profile. This corrects the old blockout's topology and wrong control layout;
// it is not a replacement proxy mesh or a new controller design.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import * as THREE from 'three';
"""),
(61,66,r"""const profile=JSON.parse(await readFile(path.join(root,'source-profile.json'),'utf8'));
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
"""),
]),
('tools/verify-licensed-assets.mjs', 'a17d030debb217cd8980f6e8955192ef185abf91d33ae465b5f296ae8df3a16a', 'fe2dd1f85358e9c23ac1099b3de1f7030ce749d1fbbe24404bdc4a95315bbc2d', [
(4,4,r"""import {createHash} from 'node:crypto';
"""),
(29,30,r""" if(info.source!=='ExoSnap segmented Generic Pro; profile from approved native SVG'||info.license!=='MIT AND CC0-1.0')throw Error('Unapproved generated model provenance');
 const profile=JSON.parse(await readFile(path.join(folder,'source-profile.json'),'utf8'));
 const source=await readFile(path.join(assets,'..',profile.source));
 if(createHash('sha256').update(source).digest('hex')!==info.profileSha256||profile.sha256!==info.profileSha256)throw Error('Generated profile provenance mismatch');
"""),
(35,36,r"""console.log('Verified '+total+' cleared OBJ meshes (Larf MIT + Generic MIT/CC0 profile) across '+APPROVED_3D_MODEL_IDS.length+' controller families ('+(bytes/1024/1024).toFixed(2)+' MiB)');
"""),
]),
]
for name,before,after,edits in items:
 p=pathlib.Path(name);source=p.read_text() if p.exists() else ''
 assert hashlib.sha256(source.encode()).hexdigest()==before, 'Source changed: '+name
 lines=source.splitlines(keepends=True)
 for a,b,text in reversed(edits):lines[a:b]=[text]
 result=''.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==after, 'Result mismatch: '+name
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(result)
print('Exact source files applied:',len(items))
