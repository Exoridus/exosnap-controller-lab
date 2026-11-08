// Occluded-only secondary contours. The physical depth mask remains the authority.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {useRearHint} from './v24-policy.js';

export function makeRearHint(mesh,role,key,alpha=.32,{contrastLayers=false}={}){
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
  line.userData.control=key;
  line.userData.role=role;
  if(contrastLayers){
  const outlineMaterial=new LineMaterial({color:'#17212c',linewidth:2.6,transparent:true,opacity:alpha,
    dashed:true,dashSize:.13,gapSize:.10,depthTest:true,depthWrite:false});
  outlineMaterial.depthFunc=THREE.GreaterDepth;
  const outline=new LineSegments2(g,outlineMaterial);
  outline.frustumCulled=false;outline.renderOrder=30;outline.visible=false;
  line.userData.hiddenOutline=outline;
  // The fill shares the original geometry and transform. It adds no source
  // geometry and appears solely in hidden active fragments, under the dashes.
  const fill=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({
    color:'#ffffff',transparent:true,opacity:0,depthTest:true,depthWrite:false,
    depthFunc:THREE.GreaterDepth,side:THREE.DoubleSide,toneMapped:false
  }));
  fill.userData.rearHintFill=true;fill.visible=false;fill.renderOrder=29;
  line.userData.hiddenFill=fill;
  }
  source.dispose();return line;
}
