import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=await readFile(new URL('../qt-quick3d-port/QtPbrLightRig.qml',import.meta.url),'utf8');
test('Qt reference light rig disables zero brightness lights for unlit/one-key recipes',()=>{
 assert.ok(text.includes('visible: root.keyBrightness > 0'));
 assert.ok(text.includes('visible: root.rimBrightness > 0'));
 assert.ok(text.includes('visible: root.fillBrightness > 0'));
});
