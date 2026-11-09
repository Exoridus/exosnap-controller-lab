import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {canonicalFrame,canonicalControlId,buildControlBindings} from '../controller-pack-contract.js';
import {buildControllerPacks,isolateSvgElement} from '../tools/build-controller-packs.mjs';

const read=async(p)=>readFile(new URL('../'+p,import.meta.url),'utf8');
const data=async(p)=>JSON.parse(await read(p));
const readJson=async(p)=>JSON.parse(await readFile(p,'utf8'));
test('native GamepadState semantics are shared by 2D and 3D; player index must come from trusted provider',()=>{
  assert.equal(canonicalControlId('b1'),'south');
  assert.equal(canonicalControlId('up'),'dpad_up');
  assert.equal(canonicalControlId('ls'),'left_stick_click');
  assert.equal(canonicalControlId('l2'),'left_trigger');
  assert.equal(canonicalControlId('south'),'south');
  assert.equal(canonicalControlId('unknown_vendor_button'),null);
  const raw={source:'live',values:new Map([['b1',1],['l2',.33],['ls',0]]),
    left:{x:.4,y:-.2,click:false},right:{x:-.7,y:.3},triggers:{left:.45,right:.1},index:4};
  const unknown=canonicalFrame(raw,{playerIndex:4,playerSource:'browser'});
  assert.equal(unknown.buttons.south,1);
  assert.equal(unknown.buttons.left_trigger,.45);
  assert.equal(unknown.buttons.left_stick_click,0,'stick motion is not stick click');
  assert.deepEqual(unknown.axes.left_stick,{x:.4,y:-.2});
  assert.equal(unknown.player_index,null,'Gamepad.index never implies the Nintendo player LED');
  assert.equal(canonicalFrame(raw,{playerIndex:4,playerSource:'provider'}).player_index,4);
  assert.equal(canonicalFrame(raw,{playerIndex:8,playerSource:'provider'}).player_index,null);
});
test('2D native mapping extensions and physical analog click remain unmodified in generated bridge',async()=>{
  const gamecube=await data('references/controllers/gamecube/mapping.json');
  const bindings=buildControlBindings(gamecube);
  assert.equal(bindings.layoutId,'gamecube');
  const south=bindings.controls.find(c=>c.control==='south');
  const triggers=bindings.controls.find(c=>c.control==='left_trigger');
  assert.ok(south?.has2D&&triggers?.has2D);
  assert.equal(triggers.svg[0].role,'trigger');
  const direct=gamecube.layers.find(l=>l.clickControl);
  assert.ok(direct,'native-specific clickControl extension must survive source export');
  const svg=await read('references/controllers/gamecube/source.svg');
  const first=isolateSvgElement(svg,gamecube,gamecube.layers.find(l=>l.id==='body'));
  assert.ok(first?.includes('<g id="body"'));
  assert.ok(first?.includes('viewBox='));
});
test('actual interchange files are reproducible, typed, triangulated and preserve moving parts',async()=>{
  const a=await mkdtemp(path.join(tmpdir(),'exo-controller-pack-a-'));
  const b=await mkdtemp(path.join(tmpdir(),'exo-controller-pack-b-'));
  try{
    const one=await buildControllerPacks({destination:a,modelIds:['dualsense','gamecube','generic','xbox_series','wavebird']});
    const two=await buildControllerPacks({destination:b,modelIds:['dualsense','gamecube','generic','xbox_series','wavebird']});
    assert.equal(one.catalog.length,5);
    assert.deepEqual(one.catalog,two.catalog);
    for(const item of one.catalog){
      const pack=path.join(a,item.id),manifest=await readJson(path.join(pack,'manifest.json'));
      const repeat=await readFile(path.join(b,item.id,'manifest.json'));
      assert.deepEqual(await readFile(path.join(pack,'manifest.json')),repeat,'deterministic package manifest '+item.id);
      assert.equal(manifest.has3D,item.has3D);
      assert.equal(manifest.nativeQtValidated,false);
      assert.ok(manifest.fileHashes['controls.json']);
      if(item.has2D){
        assert.equal(manifest.fileHashes['source.svg'],manifest.sourceHashes['references/controllers/'+item.id+'/source.svg']);
        assert.ok(Object.keys(manifest.fileHashes).some(p=>p.startsWith('elements/')));
        assert.deepEqual(await readFile(path.join(pack,'source.svg')),await readFile(path.join(b,item.id,'source.svg')));
      }
      if(!item.has3D){
        await assert.rejects(readFile(path.join(pack,'model.glb')));
        continue;
      }
      const glb=await readFile(path.join(pack,'model.glb'));
      const second=await readFile(path.join(b,item.id,'model.glb'));
      assert.deepEqual(glb,second,'binary GLB deterministic '+item.id);
      assert.equal(glb.readUInt32LE(0),0x46546c67);
      assert.equal(glb.readUInt32LE(4),2);
      assert.equal(glb.readUInt32LE(8),glb.length);
      assert.equal(glb.readUInt32LE(16),0x4e4f534a);
      const jsonBytes=glb.readUInt32LE(12);
      const gltf=JSON.parse(glb.subarray(20,20+jsonBytes).toString('utf8'));
      const rig=await readJson(path.join(pack,'rig.json'));
      assert.equal(gltf.asset.version,'2.0');
      assert.ok(gltf.nodes.length>15);
      assert.equal(gltf.scenes[0].nodes[0],0);
      assert.ok(gltf.nodes.some(n=>n.name==='controller__'+item.id));
      assert.ok(gltf.nodes.some(n=>n.name==='part__top_shell'));
      assert.ok(gltf.meshes.every(m=>m.primitives.every(p=>gltf.accessors[p.indices].count%3===0)));
      assert.equal(rig.geometry.glbTriangles,rig.geometry.sourceTriangles,'never decimate source triangle topology');
      assert.ok(rig.geometry.uniqueVertices<=rig.geometry.sourceVertexReferences);
      assert.equal(manifest.sourceModelId,item.id==='generic'?'XboxOneClean':rig.sourceModelId);
      assert.equal(rig.nativeQtValidated,false);
    }
    assert.equal((await readJson(path.join(a,'xbox_series','manifest.json'))).has3D,false,
      'uncleared 3D models must never be silently fabricated');
    assert.equal((await readJson(path.join(a,'wavebird','manifest.json'))).has2D,false);
  }finally{await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true});}
});
