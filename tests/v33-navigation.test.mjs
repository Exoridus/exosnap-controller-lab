import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
test('index and old directory addresses lead to the one real comparison page',async()=>{
 const home=await readFile(new URL('index.html',root),'utf8');
 assert.ok(home.includes("location.replace('./pbr-lab.html')"));
 for(const legacy of ['labs.html','showcase.html','look-matrix.html']){
  const html=await readFile(new URL(legacy,root),'utf8');
  assert.ok(html.includes("location.replace('./pbr-lab.html')"));
  assert.ok(!/<iframe\b/i.test(html),legacy);
 }
 for(const page of ['pbr-lab.html','comparison.html','gallery-2d.html','qt-material-lab.html','qt-native-render-audit.html','gallery-v24.html','reference-check.html'])
  assert.ok(existsSync(new URL(page,root)),page);
});
test('hero comparison exposes two looks, one mix slider and explicit shared vs direct rendering',async()=>{
 const html=await readFile(new URL('pbr-lab.html',root),'utf8');
 const js=await readFile(new URL('pbr-lab.js',root),'utf8');
 assert.equal((html.match(/type="range"/g)||[]).length,1);
 assert.ok(html.includes('id="renderMode"'));
 assert.ok(html.includes('id="stickPose"'));
 assert.ok(js.includes('WebGLRenderTarget'));
 assert.ok(js.includes('renderer.info.reset()'));
});
