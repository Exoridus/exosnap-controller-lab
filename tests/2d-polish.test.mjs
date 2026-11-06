import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analogStickLevel,controlLevel,lookPalette,mixColor,PRESS_WHITE} from '../polish-2d-style.js';

test('2D white is continuous for radial sticks and triggers, clicks independent',()=>{
  assert.equal(PRESS_WHITE,'#ffffff');
  assert.equal(analogStickLevel({x:0,y:0}),0);
  assert.equal(analogStickLevel({x:1,y:0}),1);
  assert.equal(analogStickLevel({x:0,y:-1}),1);
  assert.ok(analogStickLevel({x:.5,y:.5})>analogStickLevel({x:.5,y:0}));
  assert.equal(mixColor('#000000','#ffffff',0),'#000000');
  assert.equal(mixColor('#000000','#ffffff',1),'#ffffff');
  assert.equal(mixColor('#000000','#ffffff',.5),'#808080');
  const entry={stickSide:'left',control:'ls',layer:{role:'stick'}};
  assert.equal(controlLevel(entry,new Map(),{left:{x:0,y:0}}),0);
  assert.equal(controlLevel(entry,new Map([['ls',1]]),{left:{x:0,y:0}}),0); // independent white center marker on click
  assert.equal(controlLevel(entry,new Map(),{left:{x:1,y:0}}),1);
  const trigger={stickSide:null,control:'l2',layer:{role:'trigger'}};
  assert.equal(controlLevel(trigger,new Map([['l2',.25]])),.25);
});
test('ghost keeps a single subdued edge and distinct dualsense materials',()=>{
  const solid=lookPalette('dualsense','solid','dark');
  const ghost=lookPalette('dualsense','ghost','light');
  assert.notEqual(solid.shell,solid.core);
  assert.equal(solid.shellAlpha,.99);
  assert.ok(ghost.shellAlpha<.25);
  assert.ok(ghost.lineAlpha<.8);
  assert.notEqual(ghost.shell,ghost.core);
  assert.equal(lookPalette('dualshock4','solid','dark').shell,'#e5e9ee');
  assert.equal(lookPalette('xbox_series','solid','dark').shell,'#313a44');
  assert.equal(lookPalette('xbox_series','solid','dark','light').shell,'#e3e8ed');
});
test('review page is a true SVG binding comparison, not a fake native screenshot',async()=>{
  const html=await readFile(new URL('../polish-2d.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../polish-2d-lab.js',import.meta.url),'utf8');
  assert.match(html,/Qt|Browser-Look|Browser/);
  assert.match(html,/id="live"/);
  assert.match(html,/id="colorway"/);
  const code=await readFile(new URL('../polish-2d-style.js',import.meta.url),'utf8');
  assert.ok(!code.includes('data-exo-polish-core'));
  assert.match(code,/data-exo-stick-click/);
  assert.match(js,/new ControllerReference/);
  assert.match(js,/readStandardGamepad/);
  assert.match(js,/paintPolished2D/);
  assert.ok(!js.includes('CanvasTexture('));
});