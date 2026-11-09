import {LineBasicMaterial,LineDashedMaterial,Vector2} from 'three';
export class LineMaterial extends LineDashedMaterial {
  constructor(args={}){super({color:args.color,transparent:args.transparent,opacity:args.opacity,depthTest:args.depthTest,depthWrite:args.depthWrite,dashSize:args.dashSize||.10,gapSize:args.gapSize||.07,scale:1});this.resolution=new Vector2(1024,720);this.linewidth=args.linewidth||1;this.depthFunc=args.depthFunc;this.isLineMaterial=true;this.dashed=Boolean(args.dashed);}
}
