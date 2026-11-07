import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GHOST_REVIEW_LOOKS,ghostReviewSettings,CONTROL_PALETTE,controlSurfaceState} from '../polish-2d-style.js';

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
      assert.equal(x.controlAlpha,CONTROL_PALETTE.neutralAlpha);
      assert.equal(x.activeAlpha,CONTROL_PALETTE.activeAlpha);
      assert.equal(x.controlStroke,CONTROL_PALETTE.border);
    }
    assert.equal(a[0].edgeLight,0);
    assert.equal(a[0].edgeShadow,0);
    assert.ok(a[1].edgeLight>a[2].edgeLight);
    assert.ok(a[2].edgeShadow>a[1].edgeShadow);
    for(const key of ['control','cap','trigger','controlAlpha','activeAlpha','controlStroke','controlStrokeAlpha','line','lineAlpha','glyph'])
      assert.ok(a.every(x=>x[key]===a[0][key]),key+' differs across review looks');
  }
  const settings=['dark','light','mixed'].map(scene=>ghostReviewSettings('shadow',scene));
  for(const key of ['control','cap','trigger','controlAlpha','activeAlpha','controlStroke','controlStrokeAlpha','glyph','glyphAlpha'])
    assert.ok(settings.every(x=>x[key]===settings[0][key]),'Backdrop must not change '+key);
  const idle=controlSurfaceState(settings[0],0);
  const active=controlSurfaceState(settings[0],1);
  assert.equal(idle.fill,CONTROL_PALETTE.neutralFill);
  assert.equal(idle.alpha,CONTROL_PALETTE.neutralAlpha);
  assert.equal(active.fill,'#ffffff');
  assert.equal(active.alpha,CONTROL_PALETTE.activeAlpha);
  assert.equal(active.stroke,'#ffffff');
  assert.equal(active.strokeAlpha,CONTROL_PALETTE.activeBorderAlpha);
  assert.ok(active.alpha<=.42);
  assert.equal(settings[0].line,'#718b9d');

  assert.throws(()=>ghostReviewSettings('other','dark'),TypeError);
});
test('comparison uses original SVGs with correct independent input states',async()=>{
  const html=await source('polish-2d-review.html');
  const js=await source('polish-2d-review.js');
  const style=await source('polish-2d-style.js');
  assert.match(style,/feComponentTransfer/);
  assert.match(style,/type:'linear',slope:1\.70/);
  assert.match(style,/flood-opacity':'.58'/);
  assert.match(html,/Drei transparente Ghost-Looks/);
  for(const id of ['layout','size','stick','trigger','clicks','faces','allControls','faceSymbols','live'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(js.includes('new ControllerReference(stage)'));
  assert.ok(js.includes('isolateReferenceIds('));
  assert.ok(js.includes("stickFeedback:'ring'"));
  assert.ok(js.includes("paintPolished2D(item.reference,'ghost'"));
  assert.ok(style.includes('paintControlGroup(entry,colors,level)'));
  assert.ok(style.includes('data-exo-visible-control-fill'));
  assert.match(style,/for\(const node of shapes\)/);
  assert.match(style,/controlGeometry\(group\)/);
  assert.ok(!style.includes("group.id.endsWith('btn-touchpad')"));
  assert.ok(!html.includes('Gehaeusefarbe'));
  // The moving RIM cannot have any overlapping fill beneath the neutral
  // center: motion and L3 click must remain independently visible.
  assert.match(style,/paint\(outer,'fill','none'\)/);
  assert.match(style,/mixColor\(colors\.control,PRESS_WHITE,ring\)/);
});
