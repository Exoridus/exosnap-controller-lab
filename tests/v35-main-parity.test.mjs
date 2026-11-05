import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('main preview uses the same pressed blue and LED emission as the hero material lab',()=>{
 const app=read('app.js');
 assert.match(app,/new THREE\.Color\(EXO_PALETTE\.pressedBlue\)/);
 assert.match(app,/new THREE\.Color\(EXO_PALETTE\.pressedEmissive\)/);
 assert.match(app,/EXO_PALETTE\.idleControl/);
});
test('main 2D reference is re-themed on look changes with the same semantic recipe',()=>{
 const app=read('app.js');
 assert.match(app,/reference\.applyMaterialAppearance\(resolveHeroRecipe\('ghost',styleMix\)/);
 assert.match(app,/reference\.svg!==lastParityMaterialSvg/);
 assert.match(app,/parityLastKey=''; \/\/ 2D material paints changed/);
});
