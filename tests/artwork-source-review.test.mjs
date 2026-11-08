import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LAYOUTS} from '../controller-catalog.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('20 source/mapping layouts remain available without a second asset fork',()=>{
  assert.equal(LAYOUTS.filter(x=>x.has2D).length,20);
  assert.equal(new Set(LAYOUTS.filter(x=>x.has2D).map(x=>x.id)).size,20);
});
test('source artwork comparison uses the same original files and live material painter',async()=>{
  const html=await read('artwork-source-review.html');
  const script=await read('artwork-source-review.js');
  assert.match(html,/Quell-SVG \/ Solid \/ Ghost/);
  for(const mode of ['source','solid','ghost'])assert.ok(html.includes('data-view="'+mode+'"'));
  for(const field of ['layout','scene','size','stick','trigger','clicks','clickLeft','clickRight','faces','allControls','faceSymbols'])
    assert.ok(html.includes('id="'+field+'"'),field);
  assert.ok(script.includes('new ControllerReference(stage'));
  assert.ok(script.includes('paintPolished2D(item.reference,item.mode'));
  assert.ok(script.includes('isolateReferenceIds('));
  assert.ok(script.includes('attachStickDrag(item.reference'));
  assert.ok(script.includes('drag[side]=null;render();'));
  assert.ok(script.includes('item.reference.update(new Map(),'));
  assert.ok(script.includes("selected.id==='steam_controller_2026'?layoutForId('generic'):selected"));
  assert.ok(!script.includes('fetch("gamepad-overlay-pads.zip")'));
});
test('controller mapping metadata and 3D coverage stay visible, not silently guessed',async()=>{
  const js=await read('artwork-source-review.js');
  for(const key of ['pressElement','knockout','preview','touch','availability','license?.spdx'])
    assert.ok(js.includes(key),'missing metadata '+key);
  assert.match(js,/nicht verändert/);
});
