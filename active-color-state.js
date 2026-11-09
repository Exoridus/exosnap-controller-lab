// Both renderers start synchronized. Lab users may explicitly unlink the color pickers.
import {EXO_PALETTE} from './palette.js';
const pattern=/^#[0-9a-f]{6}$/i;
const hex=(color)=>{
  if(!pattern.test(color))throw new TypeError('Color must be #RRGGBB');
  return color.toLowerCase();
};
const brighten=(hexString,amount)=>{
  const value=hexString.slice(1);
  return '#'+[0,2,4].map(i=>{
    const n=parseInt(value.slice(i,i+2),16);
    return Math.round(n+(255-n)*amount).toString(16).padStart(2,'0');
  }).join('');
};
export class ActiveColorState{
  constructor({color2D=EXO_PALETTE.pressedSurface,color3D=EXO_PALETTE.pressedSurface,sync=true}={}){
    this.color2D=hex(color2D);this.color3D=hex(color3D);this.sync=Boolean(sync);
    if(this.sync)this.color3D=this.color2D;
  }
  edit(target,color){
    if(target!=='2d'&&target!=='3d')throw new TypeError('Unknown color target');
    const value=hex(color);
    if(target==='2d')this.color2D=value;
    else this.color3D=value;
    if(this.sync){this.color2D=value;this.color3D=value;}
    return {color2D:this.color2D,color3D:this.color3D};
  }
  setSync(yes,source='2d'){
    this.sync=Boolean(yes);
    if(this.sync)this.edit(source,source==='3d'?this.color3D:this.color2D);
    return this.sync;
  }
  overrideRecipe(recipe,target){
    if(target!=='2d'&&target!=='3d')throw new TypeError('Unknown color target');
    const color=target==='2d'?this.color2D:this.color3D;
    return {...recipe,material:{...recipe.material,pressBlue:color,
      pressEmissive:brighten(color,.14),
      pressEmissiveIntensity:target==='2d'?.86:.88}};
  }
}
