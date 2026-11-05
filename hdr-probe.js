// Small strict Radiance RGBE RLE decoder, for our single authored neutral HDRI.
// Qt Quick 3D loads the same studio-neutral.hdr through SceneEnvironment.lightProbe.
import * as THREE from 'three';
export function parseRadianceHDR(buffer){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  const text=new TextDecoder('ascii').decode(bytes.subarray(0,Math.min(512,bytes.length)));
  if(!text.startsWith('#?RADIANCE\n')||!text.includes('FORMAT=32-bit_rle_rgbe'))throw new Error('Invalid Radiance RGBE header');
  const match=/\n-Y\s+(\d+)\s+\+X\s+(\d+)\n/.exec(text);
  if(!match)throw new Error('Radiance dimensions missing');
  const height=Number(match[1]),width=Number(match[2]);
  if(width<8||width>4096||height<1||height>4096)throw new Error('Radiance dimensions unsupported');
  let offset=match.index+match[0].length;
  const rgba=new Float32Array(width*height*4);
  const row=new Uint8Array(width*4);
  for(let y=0;y<height;y++){
    if(offset+4>bytes.length||bytes[offset++]!==2||bytes[offset++]!==2||
       ((bytes[offset++]<<8)|bytes[offset++])!==width)throw new Error('Corrupt Radiance scanline');
    for(let channel=0;channel<4;channel++){
      let x=0;
      while(x<width){
        if(offset>=bytes.length)throw new Error('Truncated Radiance RLE');
        const code=bytes[offset++];
        const run=code>128?code-128:code;
        if(!run||x+run>width||offset+(code>128?1:run)>bytes.length)throw new Error('Invalid Radiance RLE run');
        if(code>128){const value=bytes[offset++];row.fill(value,channel*width+x,channel*width+x+run);}
        else {row.set(bytes.subarray(offset,offset+run),channel*width+x);offset+=run;}
        x+=run;
      }
    }
    for(let x=0;x<width;x++){
      const exponent=row[3*width+x];
      const scale=exponent?2**(exponent-136):0;
      const index=(y*width+x)*4;
      rgba[index]=row[x]*scale;
      rgba[index+1]=row[width+x]*scale;
      rgba[index+2]=row[2*width+x]*scale;
      rgba[index+3]=1;
    }
  }
  return {width,height,rgba};
}
export async function loadStudioEnvironment(url){
  const response=await fetch(url);
  if(!response.ok)throw new Error(`HDR probe HTTP ${response.status}`);
  const {width,height,rgba}=parseRadianceHDR(await response.arrayBuffer());
  const texture=new THREE.DataTexture(rgba,width,height,THREE.RGBAFormat,THREE.FloatType);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.LinearSRGBColorSpace;
  texture.generateMipmaps=false;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;
  texture.flipY=true;texture.needsUpdate=true;
  return texture;
}
