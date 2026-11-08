import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const js=await readFile(new URL('../pbr-lab.js',import.meta.url),'utf8');
const html=await readFile(new URL('../pbr-lab.html',import.meta.url),'utf8');
const qml=await readFile(new URL('../qt-quick3d-port/ControllerSurface.qml',import.meta.url),'utf8');

test('two curated looks use one true shared renderer and truthful per-view statistics',()=>{
 assert.ok(js.includes("filter(card=>!card.hidden).length*scenes.length"));
 assert.ok(js.includes('setVisibleLooks'));
 assert.ok(!/<iframe\b/i.test(html));
 assert.ok(js.includes('renderer.info.autoReset=false'));
 assert.ok(js.includes('renderer.info.reset()'));
 assert.ok(js.includes('renderer.info.render.calls'));
 assert.ok(!js.includes("rendered===18"));
 assert.ok(html.includes('id="gallery"'));
 assert.ok(html.includes('data-look="white"'));
 assert.ok(html.includes('data-look="cool"'));
 // Material opacity still has exactly one slider; the additional range input
  // is solely an explicit L2/R2 analog input simulator, not another material knob.
  assert.equal((html.match(/id="materialMix"/g)||[]).length,1);
  assert.equal((html.match(/id="triggerPressure"/g)||[]).length,1);
  assert.equal((html.match(/type="range"/g)||[]).length,2);
});

test('Qt example explicitly supports no-light and key-light standard materials',()=>{
 assert.ok(qml.includes('property bool unlit: false'));
 assert.ok(qml.includes('PrincipledMaterial.NoLighting'));
 assert.ok(qml.includes('PrincipledMaterial.FragmentLighting'));
});
