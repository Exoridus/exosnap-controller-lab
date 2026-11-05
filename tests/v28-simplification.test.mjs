import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runReferenceRaster} from './support/parity-raster-harness.mjs';
const load=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=load('index.html'),app=load('app.js'),css=load('styles-parity.css');
test('one physical silhouette compositor, no overlapping halo/shadow controls',()=>{
  for(const id of ['simpleHalo','simpleShadow','simpleContour']){
    assert.ok(!html.includes(`id="${id}"`),`no extra slider ${id}`);
    assert.ok(!app.includes(`$('${id}')`),`no inactive listener ${id}`);
  }
  // v29 replaces the convex DOM hull with an exact physical coverage pass.
  assert.equal((app.match(/new ContrastPass\(/g)||[]).length,1);
  assert.ok(app.includes('contrastPass.prepare(renderer,scene,camera'));
  assert.ok(app.includes('contrastPass.render(renderer,cell.dataset.parityScene)'));
  assert.ok(!app.includes('const separationPaths='));
  assert.ok(!css.includes('.separation-shadow'));
  assert.ok(!html.includes('class="parity-halo"'));
});
test('2D raster preserves authored stroke widths and full-width light coverage',()=>{
  const result=runReferenceRaster();
  assert.equal(result.width,2048);
  assert.deepEqual(result.rasterStrokeWidths,['0.1096','0.1644','1.773'],'SVG transforms, not arbitrary local width thresholds, determine visible line weight');
  assert.equal(result.lightUpdated,true);
  assert.deepEqual([...result.light.subarray(1500*4,1500*4+4)],[46,67,89,180]);
});
