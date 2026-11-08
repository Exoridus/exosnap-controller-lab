"""Bake source SVG contours for the existing GenericPro OBJ asset generator.
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
