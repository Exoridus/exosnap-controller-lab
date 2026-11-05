import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('v4 missing element regression: all required v5 ids are in HTML',()=>{
  const list=app.match(/const REQUIRED_UI_IDS=\[([\s\S]*?)\];/)[1];
  const ids=[...list.matchAll(/'([A-Za-z0-9]+)'/g)].map(x=>x[1]);
  for(const id of ids)assert.match(html,new RegExp('id="'+id+'"'),'missing '+id);
});
test('Three.js imports are local instead of jsdelivr or remote CDNs',()=>{
  assert.match(html,/"three": "\.\/node_modules\/three\/build\/three\.module\.js"/);
  assert.doesNotMatch(html,/cdn\.jsdelivr\.net/);
  assert.match(readFileSync(new URL('../package.json',import.meta.url),'utf8'),/"three": "0\.180\.0"/);
});
test('all three background scenes and custom chooser exist',()=>{
  for(const id of ['arena','racing','fantasy'])assert(existsSync(new URL('../backgrounds/'+id+'.svg',import.meta.url)));
  assert.match(html,/id="screenshotFile"/);
});
