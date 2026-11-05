import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ContrastPass} from '../contrast-pass.js';

// v29 deliberately removes the convex projection cache that crashed in v28.
// The same empty/loaded first-frame contract now exercises the replacement
// mask pass and checks restoration after render errors as well.
function fixture({throws=false}={}){
  const pass=new ContrastPass(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1.5,.01,100);
  const originalTarget={name:'prior'},override=new THREE.MeshBasicMaterial();
  scene.overrideMaterial=override;camera.layers.set(0);
  const state={target:originalTarget,color:new THREE.Color('#123456'),alpha:.4,viewport:new THREE.Vector4(12,13,320,214),scissor:new THREE.Vector4(10,11,300,200),scissorTest:true,renders:0,clears:0};
  const renderer={autoClear:true,getPixelRatio:()=>1.5,getRenderTarget:()=>state.target,setRenderTarget:v=>{state.target=v;},
    getClearAlpha:()=>state.alpha,getClearColor:c=>c.copy(state.color),setClearColor:(v,a)=>{state.color.set(v);state.alpha=a;},
    getViewport:v=>v.copy(state.viewport),setViewport:(...args)=>{args.length===1?state.viewport.copy(args[0]):state.viewport.set(...args);},
    getScissor:v=>v.copy(state.scissor),setScissor:v=>state.scissor.copy(v),getScissorTest:()=>state.scissorTest,setScissorTest:v=>{state.scissorTest=v;},
    clear:()=>{state.clears++;},render:(s,c)=>{
      state.renders++;assert.equal(s,scene);assert.equal(c,camera);assert.equal(camera.layers.mask,2);
      assert.equal(scene.overrideMaterial,pass.maskMaterial);assert.equal(state.target,pass.target);
      if(throws)throw Error('simulated WebGL failure');
    }};
  return {pass,scene,camera,state,renderer,originalTarget,override};
}
test('first animation frame safely handles the model still loading',()=>{
  const f=fixture();assert.doesNotThrow(()=>f.pass.prepare(f.renderer,f.scene,f.camera,320,214));
  assert.equal(f.state.renders,0);assert.equal(f.state.clears,0);assert.equal(f.renderer.autoClear,true);
  f.pass.dispose();
});
for(const throws of [false,true])test(`loaded silhouette pass restores camera and renderer state${throws?' after an exception':''}`,()=>{
  const f=fixture({throws});
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material);
  f.scene.add(mesh);f.pass.setModel([{userData:{shell:true,meshes:[mesh]}}]);
  const run=()=>f.pass.prepare(f.renderer,f.scene,f.camera,320,214);
  if(throws)assert.throws(run,/simulated WebGL failure/);else assert.doesNotThrow(run);
  assert.equal(f.state.renders,1);assert.equal(f.state.clears,1);
  assert.equal(f.pass.target.width,480);assert.equal(f.pass.target.height,321);
  assert.equal(f.camera.layers.mask,1);assert.equal(f.scene.overrideMaterial,f.override);
  assert.equal(f.state.target,f.originalTarget);assert.equal(f.renderer.autoClear,true);
  assert.equal(f.state.scissorTest,true);assert.equal(f.state.alpha,.4);
  assert.equal(f.state.color.getHexString(),'123456');
  assert.deepEqual(f.state.viewport.toArray(),[12,13,320,214]);assert.deepEqual(f.state.scissor.toArray(),[10,11,300,200]);
  f.pass.dispose();geometry.dispose();material.dispose();
});
test('composite restores autoClear even when the WebGL draw fails',()=>{
  const pass=new ContrastPass();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  pass.setModel([{userData:{shell:true,meshes:[mesh]}}]);
  const renderer={autoClear:true,render:()=>{throw Error('composite failed');}};
  assert.throws(()=>pass.render(renderer,'light'),/composite failed/);
  assert.equal(renderer.autoClear,true);
  pass.dispose();mesh.geometry.dispose();mesh.material.dispose();
});
