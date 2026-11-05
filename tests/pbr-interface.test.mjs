import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../pbr-lab.html',import.meta.url),'utf8');
const js=await readFile(new URL('../pbr-lab.js',import.meta.url),'utf8');
test('final PBR lab has one slider and exactly the two intended look rows',()=>{
  assert.equal((html.match(/type="range"/g)||[]).length,1);
  assert.ok(html.includes('id="materialMix"'));
  assert.ok(html.includes('id="gallery"'));
  assert.ok(js.includes('const variants=HERO_VARIANTS'));
  assert.ok(!html.includes('variants=all'));
  assert.ok(!html.includes('<iframe'));
  assert.ok(html.includes('data-look="solid"'));
  assert.ok(html.includes('data-look="ghost"'));
  assert.ok(js.includes("['dark','light','mixed']"));
});
test('one WebGL context and original OBJ model rig, no synthetic 3D previews',()=>{
  assert.equal((js.match(/new THREE\.WebGLRenderer\(/g)||[]).length,1);
  assert.ok(js.includes('loadNativeRig('));
  assert.ok(js.includes('renderer.setScissor('));
  assert.ok(!js.includes('SphereGeometry('));
  assert.ok(!js.includes('CanvasTexture('));
});
test('WebGL failure must be explicit and no fake canvas replacement',()=>{
  assert.ok(js.includes('webgl-unavailable'));
  assert.ok(html.includes('id="rendererStatus"'));
  assert.ok(!html.includes('base64,'));
});
test('exact screenshot panel sizes are preserved including the 320 by 214 preset',()=>{
  assert.ok(js.includes('320:214'), '320px panel height must be exactly 214px, not rounded to 213px');
});
