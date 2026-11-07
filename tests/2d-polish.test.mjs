import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LAYOUTS} from '../controller-catalog.js';
import {analogStickLevel,controlLevel,lookPalette,mixColor,PRESS_WHITE,stickFeedbackLevels,edgeReliefProfile} from '../polish-2d-style.js';

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

test('Solid ring has its own material, Xbox bumpers do not flood the center',async()=>{
  const code=await file('polish-2d-style.js');
  assert.match(code,/const solid=!colors\.ghost/);
  assert.match(code,/paint\(outer,'fill',solid\?mixColor/);
  assert.match(code,/clip\.setAttribute\('id',pressure\.id\+'-material-clip'\)/);
  assert.match(code,/entry\.layoutId=reference\.layout\.id/);
  assert.match(code,/glyph:ghost\?CONTROL_PALETTE\.glyph:'#203446'/);
});
test('Solid paints a full authored source silhouette, while Ghost leaves it empty',async()=>{
  const code=await file('polish-2d-style.js');
  assert.match(code,/silhouette\.setAttribute\('d',source\.getAttribute\('d'\)\)/);
  assert.match(code,/silhouette\.setAttribute\('fill-rule','evenodd'\)/);
  assert.match(code,/if\(colors\.ghost\)/);
  assert.doesNotMatch(code,/function\s+firstContour\s*\(/i);
  for(const id of ['dualsense','dualshock4','switch_pro','xbox_series','gamecube']){
    const source=await file('references/controllers/'+id+'/source.svg');
    assert.ok(source.includes('id="outline-strong"'),id+' needs a real authored silhouette');
  }
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
    assert.ok(palette.controlAlpha<=.3);
    assert.ok(palette.lineAlpha>=.6);
  }
  assert.ok(lookPalette('dualsense','ghost','dark').shellAlpha<.25);
  assert.equal(lookPalette('dualsense','solid','dark').shellAlpha,.99);
  assert.notEqual(lookPalette('dualsense','ghost','dark').glyph,
    lookPalette('dualsense','solid','light').glyph);
  assert.equal(lookPalette('dualsense','solid','light').glyph,'#203446');
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
  assert.doesNotMatch(code,/ensureStickRingMask|polish-ring-mask|cloneNode\(false\)/);
  assert.match(code,/group\.querySelector\('\[id\$="-outline"\]'\)/);
  assert.match(code,/group\.querySelector\('\[id\$="-top"\]'\)/);
  assert.match(code,/paintEdgeRelief/);
  assert.match(code,/if\(p\.light===0&&p\.shadow===0\)\{remove\(\);return;\}/);
  assert.ok(!code.includes('drop-shadow('),'no generic per-element halo');
  assert.match(code,/paintGlyphs/);
  assert.ok(!code.includes('CanvasTexture('));
});

test('page contract: row-first 2 x 3 real SVG viewers, correct toolbar and zoom',async()=>{
  const html=await file('polish-2d.html');
  const js=await file('polish-2d-lab.js');
  for(const id of ['layout','colorway','size','stick','trigger',
    'edgeLight','edgeShadow','faceSymbols','faces','clicks','live'])assert.ok(html.includes('id="'+id+'"'),id);
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
  assert.match(js,/edgeLight:Number\(\$\('edgeLight'\).value\)\/100/);
  assert.match(js,/edgeShadow:Number\(\$\('edgeShadow'\).value\)\/100/);
  assert.doesNotMatch(html,/id="glow"|id="stickFeedback"/);
  assert.ok(!js.includes('CanvasTexture('));
});

test('browser release will capture all specified 2D review states',async()=>{
  const capture=await file('tools/capture-pages.mjs');
  const names=['2d-switch-pro-solid-fixed.png','2d-gamecube-solid-fixed.png','2d-generic-solid-fixed.png',
    '2d-xbox-series-solid-fixed.png','2d-xbox-series-solid-pressed.png',
    '2d-dualsense-neutral-480.png','2d-dualsense-stick-ring.png',
    '2d-dualsense-stick-click.png','2d-dualsense-motion-ring.png',
    '2d-dualsense-face-symbols-on.png','2d-dualsense-face-symbols-off.png',
    '2d-xbox-series-auto.png','2d-xbox-series-light.png',
    '2d-dualshock4-auto.png','2d-dualshock4-dark.png',
    '2d-dualsense-trigger-neutral.png','2d-dualsense-trigger-100.png'];
  for(const name of names)assert.ok(capture.includes(name),name);
  for(const scene of ['dark','light','mixed'])
    for(const mode of ['off','light','shadow','combined'])
      assert.ok(capture.includes("'2d-edge-'+scene+'-'+mode+'.png'"),
        'Edge capture matrix missing '+scene+'/'+mode);
  assert.doesNotMatch(capture,/2d-ghost-glow-|2d-dualsense-stick-center\.png/);
});

test('authored trigger pressure is painted, with its own source outline above it',async()=>{
  const code=await file('polish-2d-style.js');
  assert.match(code,/const trigger=layer\.role==='trigger'/);
  assert.match(code,/paintControlGroup\(entry,colors,level\)/);
  assert.match(code,/activeEdgeFilter\(node,level\)/);
  assert.match(code,/if\(node===pressure\)\s*\{?\s*paintControl\(node,colors,level,\{stroke:shapes\.length===1\}\)/);
  assert.match(code,/else paintControl\(node,colors,level,\{fill:false\}\)/);
  assert.doesNotMatch(code,/data-exo-stick-click|polish-ring-mask/);
});

test('one backdrop-independent edge profile; no adaptive scene heuristics',()=>{
  const samples=['dark','light','mixed'].map(s=>edgeReliefProfile('ghost',s,.65,.45));
  assert.deepEqual(samples[0],samples[1]);
  assert.deepEqual(samples[1],samples[2]);
  assert.equal(edgeReliefProfile('ghost','mixed',0,0).light,0);
  assert.equal(edgeReliefProfile('ghost','light',0,0).shadow,0);
  assert.equal(edgeReliefProfile('solid','dark',1,1).light,0);
  assert.equal(edgeReliefProfile('solid','light',1,1).shadow,0);
  assert.throws(()=>edgeReliefProfile('ghost','underwater',1,1),TypeError);
  assert.ok(!file.toString().includes('background-pixels'));
});
test('relief filter is silhouette-only; zero removes it and does not touch glyphs or sticks',async()=>{
  const code=await file('polish-2d-style.js');
  assert.match(code,/querySelector\('\[id="outline-strong"\],\[id\$="-outline-strong"\]'\)/);
  assert.match(code,/feComposite'.*operator:'out'/);
  assert.match(code,/feComposite'.*operator:'in'/);
  assert.match(code,/in:'SourceAlpha'/);
  assert.match(code,/reference\.edgeReliefFilter\?\.remove\(\)/);
  assert.match(code,/outline\.style\.removeProperty\('filter'\)/);
  assert.match(code,/filter\.replaceChildren/);
  assert.doesNotMatch(code,/data-exo-stick-click|polish-ring-mask|CanvasTexture\(/);
  assert.doesNotMatch(code,/filter\(glyph|paint\(glyph,'filter'/);
});
