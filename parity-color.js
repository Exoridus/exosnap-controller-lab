import {EXO_PALETTE} from './palette.js';
/**
 * Fast, alpha-preserving 2D SVG stroke contrast remap for the bright panel.
 * Pressed blue and nonneutral original gamepad colors are never altered.
 */
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const darkStroke=rgb(EXO_PALETTE.strokeDark);
const darkOuter=rgb(EXO_PALETTE.outlineDarkScene);
const lightStroke=rgb(EXO_PALETTE.strokeLight);
const lightOuter=rgb(EXO_PALETTE.outlineLight);
const close=(r,g,b,[rr,gg,bb])=>Math.abs(r-rr)<=3&&Math.abs(g-gg)<=3&&Math.abs(b-bb)<=3;
export function recolorNeutralForLight(data) {
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]===0)continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    const paint=close(r,g,b,darkStroke)?lightStroke:close(r,g,b,darkOuter)?lightOuter:null;
    if(paint){data[i]=paint[0];data[i+1]=paint[1];data[i+2]=paint[2];continue;}
    if(Math.min(r,g,b)<177||Math.max(r,g,b)-Math.min(r,g,b)>18)continue;
    const k=(r+g+b)/(3*255);
    data[i]=Math.round(EXO_PALETTE.lightLine[0]+12*(1-k));
    data[i+1]=Math.round(EXO_PALETTE.lightLine[1]+12*(1-k));
    data[i+2]=Math.round(EXO_PALETTE.lightLine[2]+12*(1-k));
  }
  return data;
}
