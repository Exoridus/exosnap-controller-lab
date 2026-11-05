import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRadianceHDR} from '../hdr-probe.js';

test('bundled Radiance RGBE probe decodes into finite linear pixels for Three.js and Qt',async()=>{
 const bytes=await readFile(new URL('../assets/studio-neutral.hdr',import.meta.url));
 const img=parseRadianceHDR(bytes);
 assert.equal(img.width,256);assert.equal(img.height,128);
 assert.equal(img.rgba.length,256*128*4);
 for(let i=0;i<img.rgba.length;i+=4){assert.ok(Number.isFinite(img.rgba[i]));assert.ok(img.rgba[i]>=0);assert.equal(img.rgba[i+3],1);}
 assert.ok(Math.max(...img.rgba.filter((_,i)=>i%4===0))>1,'Studio contains strong softbox highlights');
});
