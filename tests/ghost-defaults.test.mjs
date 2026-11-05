import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { ghostControlAlpha } from '../ghost-appearance.js';
import { styleAt, STYLE_PRESETS } from '../style-mix.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('current Ghost is translucent, contour-free; Glass is the initial visible preview',()=>{
  assert.deepEqual(styleAt(1),STYLE_PRESETS.ghost);
  assert.equal(STYLE_PRESETS.ghost.shell,.06);
  assert.equal(STYLE_PRESETS.ghost.control,.36);
  assert.equal(STYLE_PRESETS.ghost.cap,.50);
  assert.equal(STYLE_PRESETS.ghost.contour,0);
  assert.match(html,/id="simpleLookMix"[^>]*value="50"/);
  assert.match(app,/function effectiveLook\(\)\{return \{\.\.\.styleAt\(styleMix\),\.\.\.lookOverrides\};\}/);
  for(const retired of ['simpleContour','simpleShadow','simpleHalo'])
    assert.ok(!html.includes(`id="${retired}"`),retired);
});

test('glass-mode control opacity helper reaches 100% on press',()=>{
  assert.equal(ghostControlAlpha(.20,0),.20);
  assert.equal(ghostControlAlpha(.20,1),1);
  assert.ok(ghostControlAlpha(.20,.5)>.20);
  assert.ok(ghostControlAlpha(.20,.5)<1);
});
