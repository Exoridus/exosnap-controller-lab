import test from 'node:test';
import assert from 'node:assert/strict';
import { pressedControlStyle } from '../ghost-appearance.js';

test('glass-mode fade helper interpolates opacity with press while Ghost remains opaque',()=>{
 const idle=pressedControlStyle(.20,0), down=pressedControlStyle(.20,1);
 assert.equal(idle.opacity,.20);
 assert.equal(idle.glow,0);
 assert.equal(down.opacity,1);
 assert.ok(down.glow>=.8 && down.glow<=1.5);
 assert.match(down.color,/^#(?:[0-9a-f]{6})$/i);
});
test('analog trigger highlights scale smoothly with pressure',()=>{
 const values=[0,.2,.6,1].map(v=>pressedControlStyle(.2,v));
 for(let i=1;i<values.length;i++){
   assert.ok(values[i].opacity>=values[i-1].opacity);
   assert.ok(values[i].glow>values[i-1].glow);
 }
});
