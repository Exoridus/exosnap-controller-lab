import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('const backgroundNames='),end=app.indexOf('// Gamepad API:',start);
assert.ok(start>=0&&end>start,'the production background initialization section must exist');
const backgroundStartup=app.slice(start,end);

test('production background startup and diagnostic reset work without a legacy floor-shadow object',()=>{
  for(const diagnostic of [false,true]){
    const elements=new Map(['gameBackdrop','gameBackdropDim','backgroundSelect','screenshotFile','backgroundDim']
      .map(id=>[id,{style:{},value:'arena',addEventListener(){}}]));
    const options=new Set(['arena','racing','fantasy','none','custom']);
    elements.get('backgroundSelect').querySelector=selector=>options.has(selector.match(/^option\[value="([^"]+)"\]$/)?.[1])?{}:null;
    const document={body:{dataset:{}}};
    const activeHolders=[];
    let materialUpdates=0;
    const context=vm.createContext({
      $:id=>{assert.ok(elements.has(id),`unexpected DOM dependency: ${id}`);return elements.get(id);},
      document,activeHolders,localScreenshotUrl:null,diagnostic,referenceView:false,
      syncStyleMaterials:()=>materialUpdates++,
      // Deliberately no `shadow`: the removed floor mesh is not a startup dependency.
    });

    // Execute the exact production function, listener registration, and initial
    // applyBackground('arena') call rather than a copied implementation.
    vm.runInContext(backgroundStartup,context,{filename:'app-background-startup.js'});
    assert.equal(document.body.dataset.scene,'arena');
    assert.equal(elements.get('gameBackdrop').style.backgroundImage,'url("./backgrounds/arena.svg")');
    assert.equal(elements.get('gameBackdropDim').style.opacity,'0.12');
    assert.equal(materialUpdates,0,'startup must not update materials before a model exists');

    activeHolders.push({});
    context.applyBackground(diagnostic?'none':'dark');
    assert.equal(document.body.dataset.scene,diagnostic?'none':'dark');
    assert.equal(elements.get('gameBackdrop').style.backgroundImage,'none');
    assert.equal(elements.get('gameBackdropDim').style.opacity,diagnostic?'0.12':'0.05');
    assert.equal(elements.get('backgroundSelect').value,diagnostic?'none':'arena');
    assert.equal(materialUpdates,1,'background changes still update an existing model');
  }
});
