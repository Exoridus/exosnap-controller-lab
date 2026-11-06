import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GHOST_REVIEW_LOOKS,ghostReviewSettings} from '../polish-2d-style.js';

const source=async name=>readFile(new URL('../'+name,import.meta.url),'utf8');
test('A/B/C only change edge relief and always leave shell 100% transparent',()=>{
  assert.deepEqual(GHOST_REVIEW_LOOKS.map(x=>x.key),['pure','soft','shadow']);
  for(const scene of ['dark','light','mixed']){
    const a=GHOST_REVIEW_LOOKS.map(x=>ghostReviewSettings(x.key,scene));
    for(const x of a){
      assert.equal(x.shellAlpha,0);
      assert.equal(x.coreAlpha,0);
      assert.equal(x.detailAlpha,0);
      assert.equal(x.control,x.cap);
      assert.equal(x.control,x.trigger);
      assert.equal(x.controlAlpha,.23);
    }
    assert.equal(a[0].edgeLight,0);
    assert.equal(a[0].edgeShadow,0);
    assert.ok(a[1].edgeLight>a[2].edgeLight);
    assert.ok(a[2].edgeShadow>a[1].edgeShadow);
    for(const key of ['control','cap','trigger','controlAlpha','line','lineAlpha','glyph'])
      assert.ok(a.every(x=>x[key]===a[0][key]),key+' differs across review looks');
  }
  assert.throws(()=>ghostReviewSettings('other','dark'),TypeError);
});
test('comparison uses original SVGs with correct independent input states',async()=>{
  const html=await source('polish-2d-review.html');
  const js=await source('polish-2d-review.js');
  const style=await source('polish-2d-style.js');
  assert.match(html,/Drei transparente Ghost-Looks/);
  for(const id of ['layout','size','stick','trigger','clicks','faces','faceSymbols','live'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(js.includes('new ControllerReference(stage)'));
  assert.ok(js.includes('isolateReferenceIds('));
  assert.ok(js.includes("stickFeedback:'ring'"));
  assert.ok(js.includes("paintPolished2D(item.reference,'ghost'"));
  assert.ok(style.includes("group.id.endsWith('btn-touchpad')"));
  assert.ok(!html.includes('Gehaeusefarbe'));
});
