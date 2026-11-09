import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {CONTROLLERS} from '../models.js';
import {controllerPresentationModel,prepareGenericCenterControls,GENERIC_SYSTEM_BUTTONS} from '../generic-xbox-proxy.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig,applyControlPoseToRig} from '../pbr-appearance.js';
import {resolveLabRecipe} from '../controller-lab-style.js';

const read=p=>readFile(new URL('../'+p.replace(/^\.\//,''),import.meta.url),'utf8');

test('Generic Pro uses the same licensed Xbox One original OBJ rig but retains its generic presentation identity',async()=>{
 const src=CONTROLLERS.find(m=>m.id==='GenericPro'),xbox=CONTROLLERS.find(m=>m.id==='XboxOneClean');
 const proxy=controllerPresentationModel(src);
 assert.equal(proxy.id,'GenericPro');
 assert.equal(proxy.name,'Generic Pro');
 assert.equal(proxy.family,'generic');
 assert.equal(proxy.source,'co');
 assert.equal(proxy.assetId,xbox.id);
 assert.equal(proxy.genericProxy,true);
 assert.equal(controllerPresentationModel(xbox),xbox,'real Xbox unchanged');
 const rig=await loadNativeRig(proxy,read);
 try{
  const back=rig.meshes.find(m=>m.userData.sourceFile==='back_button.obj');
  const original=back.geometry.attributes.position.array.slice();
  const count=rig.meshes.length,parts=rig.parts.length;
  assert.equal(prepareGenericCenterControls(rig),4);
  assert.equal(prepareGenericCenterControls(rig),4,'idempotent');
  assert.equal(rig.meshes.length,count+1);
  assert.equal(rig.parts.length,parts+1);
  assert.equal(rig.originalPartCount,parts);
  assert.equal(rig.physicalRigSource,'XboxOneClean');
  assert.deepEqual(back.geometry.attributes.position.array,original,'source Xbox View geometry remains intact');
  const keys=GENERIC_SYSTEM_BUTTONS.map(({key,artwork})=>{
    const mesh=rig.meshes.find(m=>m.userData.genericCenterControl===artwork);
    assert.ok(mesh,'physical centered button for '+key);
    assert.equal(mesh.userData.control,key);
    assert.equal(mesh.userData.artworkKey,artwork);
    const uv=mesh.geometry.attributes.controllerMarkUv;
    assert.equal(uv?.itemSize,2,artwork+' authored SVG artwork UV');
    return key;
  });
  assert.deepEqual(keys,['select','home','start','share']);
  const cap=rig.meshes.find(m=>m.userData.sourceFile==='generic_share_button.obj');
  assert.ok(cap,'share is a reused source cap, not a floating glyph');
  assert.equal(cap.parent.parent.parent,rig.group.children[0],'share physically attached to the native Xbox shell root');
  assert.ok(cap.geometry.boundingBox||cap.geometry.attributes.position.count);
  assert.equal(rig.meshes.filter(m=>m.userData.genericCenterControl).length,4);
  assert.equal(rig.meshes.filter(m=>m.userData.role==='button'&&/^[abxy]_button[.]obj$/.test(m.userData.sourceFile)).length,4);
  const labels=await read('references/controllers/generic/source.svg');
  for(const artwork of ['home','view','menu','share'])
    assert.ok(labels.includes('id="btn-'+artwork+'-glyph"'),artwork+' uses original generic 2D symbol');
  applyPbrRecipeToRig(rig,resolveLabRecipe('white',.7),{values:new Map([['share',1]])});
  const share=rig.meshes.find(m=>m.userData.sourceFile==='generic_share_button.obj');
  assert.ok(share.material.emissiveIntensity>0,'Share has independent press feedback');
  const holder=rig.parts.find(p=>p.file==='generic_share_button.obj').holder;
  const rest=holder.position.clone();
  applyControlPoseToRig(rig,{values:new Map([['share',1]])});
  assert.ok(holder.position.distanceTo(rest)>.0001,'Share has physical press travel');
  applyControlPoseToRig(rig,{values:new Map([['share',0]])});
  assert.ok(holder.position.distanceTo(rest)<1e-8,'Share returns to rest');
 }finally{disposeNativeRig(rig);}
});
