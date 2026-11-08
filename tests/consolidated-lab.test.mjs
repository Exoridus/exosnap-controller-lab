import test from 'node:test';
import assert from 'node:assert/strict';

const lab=await import('../controller-lab-style.js').catch(()=>({}));

test('the final comparison changes active feedback only, not neutral controller materials',()=>{
  assert.equal(typeof lab.resolveLabRecipe,'function','final lab recipe must exist');
  assert.deepEqual(lab.LAB_VARIANTS.map(x=>x.key),['white','cool']);
  for(const mix of [0,.5,1]){
    const white=lab.resolveLabRecipe('white',mix),cool=lab.resolveLabRecipe('cool',mix);
    assert.deepEqual(white.material,cool.material);
    assert.equal(white.activeContrast,'white');
    assert.equal(cool.activeContrast,'cool');
    assert.equal(white.material.shell.originalColorWeight,1);
    assert.equal(white.material.controls.idleTintWeight,0);
    assert.equal(white.ghostFresnel.strength,0,'portable base does not patch the PBR shader');
  }
});

test('mix has true opaque and ghost endpoints with structural support following shell',()=>{
  assert.equal(typeof lab.resolveLabRecipe,'function');
  const start=lab.resolveLabRecipe('white',0),end=lab.resolveLabRecipe('white',1);
  assert.equal(start.material.shell.opacity,1);
  assert.equal(start.material.controls.opacity,1);
  assert.ok(Math.abs(end.material.shell.opacity-.10)<1e-9);
  assert.ok(Math.abs(end.material.controls.opacity-.25)<1e-9);
  let previous=start;
  for(let i=0;i<=20;i++){
    const recipe=lab.resolveLabRecipe('white',i/20);
    assert.ok(recipe.material.shell.opacity<=previous.material.shell.opacity);
    assert.ok(recipe.material.controls.opacity<=previous.material.controls.opacity);
    assert.equal(recipe.material.supportOpacity,recipe.material.shell.opacity);
    assert.ok(recipe.material.controls.opacity>=recipe.material.shell.opacity);
    previous=recipe;
  }
});

test('2D paint invalidation responds to inputs and color but ignores 3D material settings',()=>{
  assert.equal(typeof lab.flatAppearanceKey,'function');
  const base={values:new Map([['l1',1]]),left:{x:.2,y:0,click:false},right:{x:0,y:0,click:false}};
  const key=lab.flatAppearanceKey(base,'#ffffff');
  assert.equal(lab.flatAppearanceKey({...base,mix:1,variant:'cool'},'#ffffff'),key);
  assert.notEqual(lab.flatAppearanceKey({...base,values:new Map([['r1',1]])},'#ffffff'),key);
  assert.notEqual(lab.flatAppearanceKey({...base,left:{x:.3,y:0,click:false}},'#ffffff'),key);
  assert.notEqual(lab.flatAppearanceKey(base,'#ff0000'),key);
  assert.equal(lab.flatAppearanceKey({...base,values:new Map([['r1',0],['l1',1]])},'#ffffff'),key);
});

test('Qt export describes one source rig, independent 2D and explicit hidden-control render work',()=>{
  assert.equal(typeof lab.qtLabDescriptor,'function');
  const descriptor=lab.qtLabDescriptor(lab.resolveLabRecipe('white',1));
  assert.equal(descriptor.flat2D.independentOf3DMix,true);
  assert.equal(descriptor.materialType,'PrincipledMaterial');
  assert.equal(descriptor.renderReuse.requiresCpuReadback,false);
  assert.equal(descriptor.hiddenControls.visibility,'physical-depth');
  assert.equal(descriptor.nativeValidated,false);
});
