import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LAYOUTS} from '../controller-catalog.js';
import {analogStickLevel,controlLevel,lookPalette,mixColor,PRESS_WHITE,stickFeedbackLevels} from '../polish-2d-style.js';

const file=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const hex=code=>[1,3,5].map(i=>parseInt(code.slice(i,i+2),16));

test('stick analog intensity follows the requested 0/25/50/100% and click is independent',()=>{
  assert.equal(PRESS_WHITE,'#ffffff');
  for(const pct of [0,.25,.5,1]){
    close(analogStickLevel({x:pct,y:0}),pct);
    const entry={stickSide:'left',control:'ls',layer:{role:'stick'}};
    close(controlLevel(entry,new Map([['ls',1]]),{left:{x:pct,y:0}}),pct);
    close(controlLevel(entry,new Map(),{left:{x:pct,y:0}}),pct);
    for(const variant of ['ring','center']){
      const moved=stickFeedbackLevels(pct,false,variant);
      const clicked=stickFeedbackLevels(pct,true,variant);
      const motionPart=variant==='ring'?'ring':'center';
      const clickPart=variant==='ring'?'center':'ring';
      close(moved[motionPart],pct);
      close(moved[clickPart],0);
      close(clicked[motionPart],pct);
      close(clicked[clickPart],1);
    }
  }
  assert.deepEqual(stickFeedbackLevels(1,true,'ring'),{ring:1,center:1});
  assert.deepEqual(stickFeedbackLevels(1,true,'center'),{ring:1,center:1});
  assert.throws(()=>stickFeedbackLevels(.5,false,'socket'),TypeError);
  const trigger={stickSide:null,control:'l2',layer:{role:'trigger'}};
  for(const t of [0,.25,.5,1])close(controlLevel(trigger,new Map([['l2',t]])),t);
  assert.equal(mixColor('#000000','#ffffff',0),'#000000');
  assert.equal(mixColor('#000000','#ffffff',1),'#ffffff');
  assert.equal(mixColor('#000000','#ffffff',.5),'#808080');
});

test('Auto resolves to each model default; Light and Dark exist for EVERY 2D layout',()=>{
  for(const [id,defaultTone] of [['dualsense','light'],['dualshock4','light'],['xbox_series','dark']]){
    assert.equal(lookPalette(id,'solid','dark','auto').colorway,defaultTone);
  }
  for(const layout of LAYOUTS.filter(x=>x.has2D)){
    const auto=lookPalette(layout.id,'solid','dark');
    const light=lookPalette(layout.id,'solid','dark','light');
    const dark=lookPalette(layout.id,'solid','dark','dark');
    assert.ok(['light','dark'].includes(auto.colorway),layout.id);
    assert.equal(light.colorway,'light');
    assert.equal(dark.colorway,'dark');
    assert.notEqual(light.shell,dark.shell,layout.id);
    assert.notEqual(light.shell,light.core,layout.id);
  }
  assert.throws(()=>lookPalette('dualsense','solid','dark','default'),TypeError);
  assert.equal(lookPalette('xbox_series','solid','dark','light').shell,'#e4eaf0');
  assert.equal(lookPalette('dualsense','solid','dark').shell,'#f0f2f4');
});

test('neutral cap, trigger, D-pad and face materials have consistent base contrast',()=>{
  for(const colorway of ['light','dark']){
    const palettes=['dualsense','dualshock4','xbox_series','switch_pro','gamecube'].map(id=>
      lookPalette(id,'ghost','light',colorway));
    assert.ok(palettes.every(x=>x.control===palettes[0].control));
    const palette=palettes[0];
    const distance=(a,b)=>Math.max(...hex(a).map((v,i)=>Math.abs(v-hex(b)[i])));
    assert.ok(distance(palette.control,palette.cap)<25);
    assert.ok(distance(palette.control,palette.trigger)<25);
    assert.ok(palette.controlAlpha>=.7);
    assert.ok(palette.lineAlpha>=.6);
  }
  assert.ok(lookPalette('dualsense','ghost','dark').shellAlpha<.25);
  assert.equal(lookPalette('dualsense','solid','dark').shellAlpha,.99);
  assert.equal(lookPalette('dualsense','ghost','dark').glyph,
    lookPalette('dualsense','solid','light').glyph);
});

test('every tested stick uses authored moving outline + center; no synthetic click marker',async()=>{
  for(const id of ['dualsense','dualshock4','xbox_series']){
    const source=await file('references/controllers/'+id+'/source.svg');
    for(const side of ['l','r']){
      assert.ok(source.includes('id="stick-'+side+'-cap-top"'),id+' '+side);
      assert.ok(source.includes('id="stick-'+side+'-cap-outline"'),id+' '+side);
    }
    assert.ok(source.includes('id="outline-strong"'));
  }
  const code=await file('polish-2d-style.js');
  assert.doesNotMatch(code,/data-exo-stick-click/);
  assert.match(code,/ensureStickRingMask/);
  assert.match(code,/copy\(outer,'white'\),copy\(center,'black'\)/);
  assert.match(code,/paintSilhouetteGlow/);
  assert.match(code,/strength===0.*removeProperty\('filter'\)/);
  assert.match(code,/paintGlyphs/);
  assert.ok(!code.includes('CanvasTexture('));
});

test('page contract: row-first 2 x 3 real SVG viewers, correct toolbar and zoom',async()=>{
  const html=await file('polish-2d.html');
  const js=await file('polish-2d-lab.js');
  for(const id of ['layout','colorway','size','stickFeedback','stick','trigger',
    'glow','faceSymbols','faces','clicks','live'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/grid-template-columns:repeat\(3,var\(--panel-width\)\)/);
  assert.match(html,/grid-template-rows:repeat\(2,max-content\)/);
  assert.match(html,/<option value="480" selected>/);
  assert.match(html,/<input type="checkbox" id="faceSymbols" checked>/);
  assert.match(html,/<option value="auto" selected>Auto<\/option>/);
  assert.match(js,/for\(const \[mode,lookLabel\] of styles\)/);
  assert.match(js,/for\(const \[scene,sceneLabel\] of scenes\)/);
  assert.match(js,/new ControllerReference\(stage\)/);
  assert.match(js,/readStandardGamepad/);
  assert.match(js,/event.preventDefault\(\)/);
  assert.match(js,/passive:false/);
  assert.match(js,/paintPolished2D/);
  assert.match(js,/showFaceSymbols:\$\('faceSymbols'\).checked/);
  assert.match(js,/glow:Number\(\$\('glow'\).value\)\/100/);
  assert.ok(!js.includes('CanvasTexture('));
});

test('browser release will capture all specified 2D review states',async()=>{
  const capture=await file('tools/capture-pages.mjs');
  const names=['2d-dualsense-neutral-480.png','2d-dualsense-stick-ring.png',
    '2d-dualsense-stick-center.png','2d-dualsense-face-symbols-on.png',
    '2d-dualsense-face-symbols-off.png','2d-xbox-series-auto.png',
    '2d-xbox-series-light.png','2d-dualshock4-auto.png',
    '2d-dualshock4-dark.png','2d-ghost-glow-0.png','2d-ghost-glow-50.png',
    '2d-ghost-glow-100.png'];
  for(const name of names.filter(n=>!n.startsWith('2d-ghost-glow-')))
    assert.ok(capture.includes(name),name);
  assert.match(capture,/for\(const pct of \[0,50,100\]\)/);
  assert.match(capture,/2d-ghost-glow-/);
  assert.match(capture,/capturePolish\('2d-ghost-glow-'\+pct\+'\.png'/);
});
