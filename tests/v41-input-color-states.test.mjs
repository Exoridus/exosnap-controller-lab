import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONTROLLERS} from '../models.js';
import {loadNativeRig,disposeNativeRig} from '../pbr-model.js';
import {applyPbrRecipeToRig} from '../pbr-appearance.js';
import {resolveHeroRecipe} from '../pbr-recipes.js';
import {resolve2DPaint} from '../material-paint.js';
import {ActiveColorState} from '../active-color-state.js';
import {EXO_PALETTE,blendHexColor,stickSurfaceColor,triggerSurfaceColor} from '../palette.js';
import {normalizeStickInput} from '../stick-activity.js';

const read=async url=>readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8');
const neutral=()=>normalizeStickInput();
const state=(l=neutral(),r=neutral(),left=0,right=0)=>({allPressed:false,left:l,right:r,triggers:{left,right}});

test('visual input states: neutral is unringed, white stick/trigger; blue only means input',()=>{
 assert.equal(EXO_PALETTE.pressedSurface,'#4f9eeb');
 assert.equal(stickSurfaceColor(0),'#e6eff6');
 assert.equal(triggerSurfaceColor(0),'#e6eff6');
 assert.equal(stickSurfaceColor(.5),blendHexColor('#e6eff6',EXO_PALETTE.movingControl,.5));
 assert.equal(stickSurfaceColor(0,true),EXO_PALETTE.pressedSurface);
 assert.equal(triggerSurfaceColor(1),EXO_PALETTE.pressedSurface);
 assert.equal(triggerSurfaceColor(.5),blendHexColor('#e6eff6','#4f9eeb',.5));
 assert.notEqual(triggerSurfaceColor(.5),triggerSurfaceColor(1));
 const active=new ActiveColorState();
 assert.equal(active.sync,true);
 assert.equal(active.color2D,active.color3D);
 const recipe=active.overrideRecipe(resolveHeroRecipe('ghost',.7),'2d');
 const twoD=resolve2DPaint(recipe,'light');
 assert.equal(twoD.neutralStick,EXO_PALETTE.neutralStick);
 assert.equal(twoD.neutralTrigger,EXO_PALETTE.neutralTrigger);
 assert.equal(twoD.pressedBlue,EXO_PALETTE.pressedSurface);
});

test('real 3D rig neutral cap has NO lit ring; stick motion and L3 click are distinct',async()=>{
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 const recipe=new ActiveColorState().overrideRecipe(resolveHeroRecipe('ghost',.7),'3d');
 try{
  const cap=rig.meshes.find(m=>m.userData.sourceFile==='left_cap.obj');
  const ring=rig.meshes.find(m=>m.userData.sourceFile==='left_ring.obj');
  const trigger=rig.meshes.find(m=>m.userData.sourceFile==='left_trigger.obj');
  assert.ok(cap&&ring&&trigger);
  applyPbrRecipeToRig(rig,recipe,state());
  assert.equal(cap.material.color.getHexString(),EXO_PALETTE.neutralStick.slice(1));
  assert.equal(ring.material.color.getHexString(),EXO_PALETTE.neutralStickSocket.slice(1));
  assert.equal(ring.material.emissiveIntensity,0);
  assert.equal(trigger.material.color.getHexString(),EXO_PALETTE.neutralTrigger.slice(1));
  applyPbrRecipeToRig(rig,recipe,state(normalizeStickInput({x:.6,y:.3})));
  assert.notEqual(cap.material.color.getHexString(),EXO_PALETTE.neutralStick.slice(1));
  assert.equal(cap.material.emissiveIntensity,0);
  assert.equal(ring.material.emissiveIntensity,0);
  applyPbrRecipeToRig(rig,recipe,state(normalizeStickInput({x:.6,y:.3,click:true})));
  assert.equal(cap.material.color.getHexString(),EXO_PALETTE.pressedSurface.slice(1));
  assert.equal(cap.material.opacity,1);
  assert.ok(cap.material.emissiveIntensity>=.8);
  applyPbrRecipeToRig(rig,recipe,state());
  assert.equal(cap.material.color.getHexString(),EXO_PALETTE.neutralStick.slice(1));
  assert.equal(ring.material.emissiveIntensity,0);
 }finally{disposeNativeRig(rig)}
});

test('left/right analog trigger independently interpolates idle white to pressed blue',async()=>{
 const rig=await loadNativeRig(CONTROLLERS.find(x=>x.id==='DualSenseCompact'),read);
 const recipe=new ActiveColorState().overrideRecipe(resolveHeroRecipe('identity',.65),'3d');
 try{
  const left=rig.meshes.find(m=>m.userData.sourceFile==='left_trigger.obj');
  const right=rig.meshes.find(m=>m.userData.sourceFile==='right_trigger.obj');
  assert.ok(left&&right);
  applyPbrRecipeToRig(rig,recipe,state(neutral(),neutral(),.5,0));
  assert.notEqual(left.material.color.getHexString(),EXO_PALETTE.neutralTrigger.slice(1));
  assert.notEqual(left.material.color.getHexString(),EXO_PALETTE.pressedSurface.slice(1));
  assert.equal(right.material.color.getHexString(),EXO_PALETTE.neutralTrigger.slice(1));
  assert.equal(right.material.emissiveIntensity,0);
  applyPbrRecipeToRig(rig,recipe,state(neutral(),neutral(),1,1));
  assert.equal(left.material.color.getHexString(),EXO_PALETTE.pressedSurface.slice(1));
  assert.equal(right.material.color.getHexString(),EXO_PALETTE.pressedSurface.slice(1));
 }finally{disposeNativeRig(rig)}
});

test('browser lab has no invented focus input state and one explicit trigger slider',async()=>{
 const html=await readFile(new URL('../pbr-lab.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../pbr-lab.js',import.meta.url),'utf8');
 assert.ok(html.includes('id="triggerPressure"'));
 assert.ok(html.includes('id="colorSync" checked'));
 assert.ok(js.includes('state.triggerPressure=Number(e.target.value)/100'));
 assert.ok(js.includes('pad.buttons?.[6]?.value'));
 assert.ok(js.includes('pad.buttons?.[7]?.value'));
 assert.ok(!html.includes('Focused')&&!html.includes('Fokussiert'));
});
