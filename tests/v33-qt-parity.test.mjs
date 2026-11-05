import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
test('Qt export contains four current looks and original A–H archives',async()=>{
 const p=JSON.parse(await readFile(new URL('../qt-quick3d-port/pbr-reference-recipes.json',import.meta.url),'utf8'));
 assert.ok(p.snapshots.some(s=>s.key==='solid'&&s.mix===1));
 assert.ok(p.snapshots.some(s=>s.key==='ghost'&&s.mix===.7));
 assert.ok(p.snapshots.some(s=>s.key==='outline'&&s.mix===.7));
 assert.ok(p.snapshots.some(s=>s.key==='identity'&&s.mix===.7));
 assert.ok(p.snapshots.some(s=>s.key==='a'&&s.mix===0));
 assert.ok(p.snapshots.find(s=>s.key==='ghost'&&s.mix===1).qt.stickPolicy);
});
