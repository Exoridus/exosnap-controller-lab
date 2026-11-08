import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HERO_VARIANTS,resolveHeroRecipe,qtQuickDescriptor} from '../pbr-recipes.js';
import {appearanceCacheKey,resolve2DPaint} from '../material-paint.js';

const keys=['solid','ghost','outline','identity'];
test('four deliberately different selectable looks with Qt-compatible lighting contracts',()=>{
  assert.deepEqual(HERO_VARIANTS.map(v=>v.key),keys);
  const recipes=keys.map(key=>resolveHeroRecipe(key,.7));
  assert.equal(recipes[0].lightingMode,'ibl');
  assert.equal(recipes[1].lightingMode,'ibl');
  assert.equal(recipes[2].lightingMode,'unlit');
  assert.equal(recipes[3].lightingMode,'ibl');
  for(const recipe of recipes){
    assert.equal(recipe.lights.keyPoint.intensity,0);
    assert.equal(recipe.lights.fillDirectional.intensity,0);
    assert.equal(recipe.lights.rimPoint.intensity,0);
    assert.ok(recipe.material.controls.opacity>=recipe.material.shell.opacity);
    const qt=qtQuickDescriptor(recipe);
    assert.equal(qt.environmentProbe,'./assets/studio-neutral.hdr');
  }
  assert.ok(recipes[0].material.shell.opacity > recipes[1].material.shell.opacity);
  assert.ok(recipes[2].material.shell.opacity < recipes[3].material.shell.opacity);
  assert.notEqual(recipes[1].material.shell.ghostTint,recipes[3].material.shell.ghostTint);
});

test('2D reapplication cache changes if only pressed color changes; SVG Press blue stays channel-specific',()=>{
  const base=resolveHeroRecipe('ghost',.7);
  const blue={...base,material:{...base.material,pressBlue:'#79bdff',pressEmissive:'#aae4ff'}};
  const green={...base,material:{...base.material,pressBlue:'#36ed97',pressEmissive:'#9af7c8'}};
  assert.notEqual(appearanceCacheKey(blue,'dark'),appearanceCacheKey(green,'dark'));
  assert.equal(resolve2DPaint(green,'dark').pressedBlue,'#36ed97');
  assert.equal(resolve2DPaint(blue,'dark').pressedBlue,'#79bdff');
});

test('main comparison uses white feedback and fixed authored 2D with separate active colors',()=>{
  const html=fs.readFileSync(new URL('../pbr-lab.html',import.meta.url),'utf8');
  const js=fs.readFileSync(new URL('../pbr-lab.js',import.meta.url),'utf8');
  assert.ok(!/<iframe\b/i.test(html));
  assert.deepEqual([...html.matchAll(/data-look="([^"]+)"/g)].map(m=>m[1]),[]);
  assert.match(html,/Aktiv: Weiß/);
   assert.match(html,/id="color2D"/);
  assert.match(html,/id="color3D"/);
  assert.match(js,/paintPolished2D\(ref,'ghost',sceneName/);
  assert.doesNotMatch(js,/recipeFor2D|applyMaterialAppearance/);
  const flatPaint=js.split('function updateFlatReferences(input=state.frameInput){')[1].split('function makeScene(){')[0];
  assert.match(flatPaint,/flatAppearanceKey\(input,activeColors\.color2D\)/);
  assert.doesNotMatch(flatPaint,/state\.mix|recipeFor3D/);
  assert.match(js,/recipeFor3D\(variant\.key\)/);
  assert.match(js,/activeColors\.edit\('2d'/);
  assert.match(js,/activeColors\.edit\('3d'/);
});

test('real HDR environment is provided for both Three.js and Qt Quick 3D',()=>{
  const hdr=fs.readFileSync(new URL('../assets/studio-neutral.hdr',import.meta.url));
  assert.ok(hdr.subarray(0,50).toString().startsWith('#?RADIANCE'));
  const js=fs.readFileSync(new URL('../pbr-lab.js',import.meta.url),'utf8');
  assert.match(js,/loadStudioEnvironment/);
  assert.match(js,/scene\.environment\s*=/);
  assert.match(js,/scene\.environmentIntensity\s*=/);
  assert.doesNotMatch(js,/new THREE\.(?:DirectionalLight|PointLight|AmbientLight)\s*\(/);
});

test('row toggles clear the full shared canvas before redrawing so hidden rows leave no old pixels',()=>{
 const js=fs.readFileSync(new URL('../pbr-lab.js',import.meta.url),'utf8');
 const body=js.split('function render(now=performance.now()){')[1]?.split('function getLiveStickPose()')[0]||'';
 assert.match(body,/renderer\.setScissorTest\(false\);\s*renderer\.setRenderTarget\(null\);\s*renderer\.clear\(true,true,true\);\s*renderer\.setScissorTest\(true\);/);
});
