import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROLLERS, SOURCES, remoteAssetUrl, remoteAssetMirrors, assetFolder,
  controlFromFilename, controlDisplayName
} from '../models.js';

const expectedCo = [
  'DualSenseCompact','DS4Compact','XboxOneClean','SwitchPro','JoyconGrip',
  'JoyconLeft','JoyconRight','Gamecube','Wavebird','SteamController2026'
];

test('curated final controller list exposes only compact clean models', () => {
  assert.equal(CONTROLLERS.length, 11);
  assert.equal(new Set(CONTROLLERS.map(m=>m.id)).size, 11);
  assert.deepEqual(Object.keys(SOURCES).sort(), ['co','padforge']);
  for (const model of CONTROLLERS) {
    assert.ok(model.id && model.name && model.brand && model.family);
    assert.ok(['co','padforge'].includes(model.source),model.id);
    assert.ok(assetFolder(model),model.id);
    assert.ok(typeof model.orbitY === 'number', model.id);
    assert.ok(Array.isArray(model.shellParts) && model.shellParts.length>0, model.id);
    if (model.manifest) {
      assert.equal(model.source,'co',model.id);
      assert.ok(expectedCo.includes(model.id),model.id);
      assert.ok(!model.parts,model.id);
    } else {
      assert.equal(model.id,'XboxSeries');
      assert.ok(model.parts.length>0,model.id);
      assert.equal(new Set(model.parts).size,model.parts.length,model.id);
      assert.ok(model.parts.every(x=>/^[\w-]+\.obj$/.test(x)),model.id);
    }
  }
  for (const id of expectedCo)assert.ok(CONTROLLERS.find(m=>m.id===id),id);
});

test('download URLs point at actual source-specific OBJ paths with encoded directory names',()=>{
  assert.equal(remoteAssetUrl(CONTROLLERS.find(m=>m.id==='SwitchPro'),'top_shell.obj'),
    'https://raw.githubusercontent.com/Khyretos/3dco-plus/main/assets/models/Switch%20Pro/top_shell.obj');
  assert.equal(remoteAssetUrl(CONTROLLERS.find(m=>m.id==='SteamController2026'),'shell_top.obj'),
    'https://raw.githubusercontent.com/Khyretos/3dco-plus/main/assets/models/Steam%20Controller%202026/shell_top.obj');
  assert.equal(remoteAssetUrl(CONTROLLERS.find(m=>m.id==='XboxSeries'),'MainBody.obj'),
    'https://raw.githubusercontent.com/hifihedgehog/PadForge/main/PadForge.App/3DModels/XboxSeries/Carbon/MainBody.obj');
});

test('button / D-pad / trigger / stick semantic IDs from supported source conventions', () => {
  const cases = {
    'B1ButtonSymbol.obj':'b1', 'B2-Button.obj':'b2', 'DPadRight.obj':'right',
    'Shoulder-Left-Trigger.obj':'l2', 'LeftStickClick.obj':'ls',
    'a_button.obj':'b1', 'b_button.obj':'b2', 'x_button.obj':'b3', 'y_button.obj':'b4',
    'button_a.obj':'b1', 'button_x.obj':'b3',
    'dpad_left.obj':'left', 'dpad_up.obj':'up',
    'left_bumper.obj':'l1', 'right_trigger.obj':'r2',
    'left_ring.obj':'ls', 'right_stick.obj':'rs',
    'thumbstick_left_ring.obj':'ls', 'thumbstick_right_cap.obj':'rs',
    'touchpad_left.obj':'leftpad', 'touchpad_right.obj':'rightpad',
    'MainBody.obj':null, 'top_shell.obj':null,
  };
  for(const [filename,expected] of Object.entries(cases))
    assert.equal(controlFromFilename(filename),expected,filename);
  assert.equal(controlDisplayName('b1','playstation'),'Cross');
  assert.equal(controlDisplayName('b1','xbox'),'A');
  assert.equal(controlDisplayName('leftpad','steam'),'Left touchpad');
});


test('fallback mirrors are emitted for compact co and padforge models', () => {
  const files = [
    [CONTROLLERS.find(m=>m.id==='XboxOneClean'),'dpad_left.obj'],
    [CONTROLLERS.find(m=>m.id==='XboxSeries'),'DPadRight.obj'],
  ];
  for (const [model,file] of files) {
    const mirrors=remoteAssetMirrors(model,file);
    assert.equal(mirrors.length,2);
    assert.equal(mirrors[0],remoteAssetUrl(model,file));
    assert.match(mirrors[1],/^https:\/\/cdn\.jsdelivr\.net\/gh\//);
  }
});
