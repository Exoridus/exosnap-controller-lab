import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSourceRegistry} from '../tools/validate-3d-sources.mjs';
import {LAYOUTS} from '../controller-catalog.js';

const read=async()=>JSON.parse(await readFile(new URL('../docs/3d-source-candidates.json',import.meta.url),'utf8'));

test('3D source discovery keeps unreviewed Meshy and noncommercial Valve/PadForge scans out of automatic imports',async()=>{
 const registry=await read();
 const verified=validateSourceRegistry(registry);
 assert.ok(verified.records>=8);
 assert.ok(verified.blocked>=2);
 assert.equal(LAYOUTS.length,20);
 const block=id=>registry.candidates.find(x=>x.id===id);
 assert.equal(block('meshy-community-controller-discovery').assetSpecific,false);
 assert.equal(block('meshy-community-controller-discovery').mayAutoPublish,false);
 assert.equal(block('valve-steam-deck-cad').mayAutoPublish,false);
 assert.equal(block('handheld-companion-steamdeck').mayAutoPublish,false);
 for(const x of registry.candidates.filter(y=>y.status==='candidate'))
   assert.equal(x.mayAutoPublish,false,x.id);
});

test('source publication gate rejects unapproved community items even when license field says CC0',async()=>{
 const registry=await read();
 const bad=structuredClone(registry);
 const item=bad.candidates.find(x=>x.id==='meshy-community-controller-discovery');
 item.mayAutoPublish=true;
 assert.throws(()=>validateSourceRegistry(bad),/Uncleared source/);
});
