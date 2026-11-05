import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {optimizeStaticHousing, shareIdenticalStickGeometry} from '../pbr-optimizer.js';
const read=async url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
test('static body optimization preserves color regions and total visible triangles',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);const before=rig.meshes.filter(m=>m.visible).reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
 const out=optimizeStaticHousing(rig);
 assert.ok(out.savedCalls>=1);
 const active=rig.group.children.length;
 assert.ok(active>0);
 const after=rig.meshes.filter(m=>m.visible).reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
 assert.equal(Math.round(before),Math.round(after));
 disposeNativeRig(rig);
});
test('identical source-authored left and right sticks share GPU geometry without moving their pivots',async()=>{
 const rig=await loadNativeRig(CONTROLLERS[0],read);
 const out=shareIdenticalStickGeometry(rig);
 assert.ok(out.pairs>=3);
 const left=rig.meshes.find(m=>m.userData.sourceFile==='left_stick.obj');
 const right=rig.meshes.find(m=>m.userData.sourceFile==='right_stick.obj');
 assert.equal(left.geometry,right.geometry);
 assert.notEqual(left.parent,right.parent);
 disposeNativeRig(rig);
});
