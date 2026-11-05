// Occluded-only secondary contours. The physical depth mask remains the authority.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {useRearHint} from './v24-policy.js';

export function makeRearHint(mesh,role,key,alpha=.32){
  if(!useRearHint(role,key)||!mesh.geometry)return null;
  const source=new THREE.EdgesGeometry(mesh.geometry,63);
  const p=source.getAttribute('position');
  if(!p||!p.count){source.dispose();return null;}
  const g=new LineSegmentsGeometry();g.setPositions(p.array);
  const m=new LineMaterial({color:'#8da7c1',linewidth:1.15,transparent:true,opacity:alpha,
    dashed:true,dashSize:.13,gapSize:.10,depthTest:true,depthWrite:false});
  // Render only fragments deeper than the already written physical shell depth.
  m.depthFunc=THREE.GreaterDepth;
  const line=new LineSegments2(g,m);
  line.computeLineDistances();line.renderOrder=8;line.frustumCulled=false;
  line.userData.rearHint=true;
  source.dispose();return line;
}
