import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
import {normalizeStickInput} from '../stick-activity.js';
import {ActiveColorState} from '../active-color-state.js';
const read=async url=>readFile(new URL('../'+url.slice(2),import.meta.url),'utf8');
const neutral=()=>({allPressed:false,left:normalizeStickInput(),right:normalizeStickInput(),
  triggers:{left:0,right:0}});
for(const id of ['JoyconLeft','JoyconRight','JoyconGrip','SwitchPro']){
  test(id+' neutral stick caps, rings, bumpers and triggers keep the authored dark materials',async()=>{
    const model=CONTROLLERS.find(m=>m.id===id),rig=await loadNativeRig(model,read);
    try{
      const filenames=['left_cap.obj','right_cap.obj','left_ring.obj','right_ring.obj',
        'left_stick.obj','right_stick.obj','left_trigger.obj','right_trigger.obj',
        'left_bumper.obj','right_bumper.obj'];
      const parts=rig.meshes.filter(m=>filenames.includes(m.userData.sourceFile));
      assert.ok(parts.length>=3,'expected real authored stick/shoulder geometry');
      const colors=new ActiveColorState();
      for(const key of ['solid','ghost','identity']){
        const recipe=colors.overrideRecipe(resolveHeroRecipe(key,.7),'3d');
        applyPbrRecipeToRig(rig,recipe,neutral());
        for(const mesh of parts){
          assert.ok(mesh.material.color.equals(mesh.userData.sourceColor),
            key+' idle '+mesh.userData.sourceFile+' must retain its source color');
          assert.equal(mesh.material.emissiveIntensity,0);
          assert.notEqual(mesh.material.color.getHexString(),'e6eff6');
        }
      }
      const ghost=colors.overrideRecipe(resolveHeroRecipe('ghost',.7),'3d');
      const cap=parts.find(m=>m.userData.sourceFile==='left_cap.obj');
      const rightCap=parts.find(m=>m.userData.sourceFile==='right_cap.obj');
      const leftTrigger=parts.find(m=>m.userData.sourceFile==='left_trigger.obj');
      const rightTrigger=parts.find(m=>m.userData.sourceFile==='right_trigger.obj');
      const active={...neutral(),left:normalizeStickInput({x:.7,y:0,click:true}),
        triggers:{left:1,right:0}};
      applyPbrRecipeToRig(rig,ghost,active);
      if(cap){
        assert.equal(cap.material.color.getHexString(),'ffffff');
        assert.ok(cap.material.opacity<1);
      }
      if(rightCap)assert.ok(rightCap.material.color.equals(rightCap.userData.sourceColor));
      if(leftTrigger)assert.equal(leftTrigger.material.color.getHexString(),'ffffff');
      if(rightTrigger)assert.ok(rightTrigger.material.color.equals(rightTrigger.userData.sourceColor));
      applyPbrRecipeToRig(rig,ghost,neutral());
      for(const part of parts)assert.ok(part.material.color.equals(part.userData.sourceColor),
        'released '+part.userData.sourceFile+' must restore source material');
    }finally{disposeNativeRig(rig)}
  });
}
