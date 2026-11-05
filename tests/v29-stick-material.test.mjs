import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {modelPartSemantics,isHousingRole} from '../model-semantics.js';
import {MODEL_MECHANICS} from '../model-mechanics.js';
import {styleAt} from '../style-mix.js';
import {EXO_PALETTE} from '../palette.js';

test('all three authored moving stick surfaces share cap opacity, roughness and press-ready material',()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const start=source.indexOf('function mappedColor(meta)'),end=source.indexOf('function disposeContourGroup(',start);
  const look=styleAt(1);
  const make=vm.runInNewContext(source.slice(start,end)+'\nmaterialFor',{THREE,modelPartSemantics,isHousingRole,MODEL_MECHANICS,EXO_PALETTE,
    style:'ghost',controlsOpacity:look.control,shellOpacity:look.shell,look,selectedContrast:'D'});
  const info=JSON.parse(readFileSync(new URL('../assets/DualSenseCompact/info.json',import.meta.url)));
  const model={id:'DualSenseCompact',source:'co',family:'playstation',color:'#ffffff'};
  for(const side of ['left','right']){
    const mats=['ring','stick','cap'].map(name=>{
      const file=`${side}_${name}.obj`;return make(file,model,info.parts.find(p=>p.filename===file));
    });
    assert.ok(mats.every(m=>m.userData.isCap),`${side} ring, shaft and inset share cap appearance`);
    assert.ok(mats.every(m=>m.roughness===mats[0].roughness));
    assert.ok(mats.every(m=>m.opacity===mats[0].opacity));
    assert.ok(mats.every(m=>m.color.equals(mats[0].color)));
    mats.forEach(m=>m.dispose());
  }
});
