import {readFileSync} from 'node:fs';
import {recolorNeutralForLight} from '../../parity-color.js';

// Execute the actual raster callback with an in-memory Canvas boundary. A crop
// in getImageData/putImageData must lose the corresponding fixture pixels.
export function runReferenceRaster(){
  const width=2048,height=2;
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    pixels.set(x===width-1?[85,186,255,128]:[255,255,255,180],(y*width+x)*4);
  }
  class Canvas{
    constructor(){this.width=width;this.height=height;this.pixels=new Uint8ClampedArray(pixels.length);}
    getContext(){
      return {
        clearRect:()=>this.pixels.fill(0),
        drawImage:()=>this.pixels.set(pixels),
        getImageData:(x,y,w,h)=>{
          const data=new Uint8ClampedArray(w*h*4);
          for(let row=0;row<h;row++)data.set(this.pixels.subarray(((y+row)*width+x)*4,((y+row)*width+x+w)*4),row*w*4);
          return {data,width:w,height:h};
        },
        putImageData:(image,x,y)=>{
          for(let row=0;row<image.height;row++)this.pixels.set(image.data.subarray(row*image.width*4,(row+1)*image.width*4),((y+row)*width+x)*4);
        }
      };
    }
  }
  const source=readFileSync(new URL('../../app.js',import.meta.url),'utf8');
  const start=source.indexOf('function refreshParitySvg('),end=source.indexOf('\nfunction renderParity(',start);
  if(start<0||end<0)throw Error('Raster entry point not found');
  const parityTextureCanvas=new Canvas(),parityLightCanvas=new Canvas();
  const authoredWidths=['0.1096','0.1644','1.773'];
  const rasterNodes=authoredWidths.map(strokeWidth=>({style:{strokeWidth,stroke:'rgb(255, 255, 255)'}}));
  const svg={viewBox:{baseVal:{width,height}},cloneNode:()=>({querySelectorAll:()=>rasterNodes,setAttribute:()=>{}})};
  const run=new Function('env',`const {reference,parityTextureCanvas,parityLightCanvas,recolorNeutralForLight}=env;
    const PARITY_RASTER_WIDTH=2048,currentLayout={id:'fixture'},controlAmounts=new Map();
    let parityRasterPending=false,parityLastRasterAt=0,parityLastKey='',paritySvgIdentity=null,parityRasterGeneration=0;
    const parityTexture={},parityLightTexture={},parityPlane={visible:false};
    const syncParityPlaneSize=()=>{};
    const URL={createObjectURL:()=>'',revokeObjectURL:()=>{}};
    const XMLSerializer=class{serializeToString(){return '<svg/>';}};
    const Image=class{set src(value){this.onload();}};
    ${source.slice(start,end)}
    refreshParitySvg(1000,null,null);
    return {visible:parityPlane.visible,darkUpdated:parityTexture.needsUpdate,lightUpdated:parityLightTexture.needsUpdate};`);
  const result=run({reference:{svg},parityTextureCanvas,parityLightCanvas,recolorNeutralForLight});
  return {...result,width,height,rasterStrokeWidths:rasterNodes.map(n=>n.style.strokeWidth),dark:parityTextureCanvas.pixels,light:parityLightCanvas.pixels};
}
