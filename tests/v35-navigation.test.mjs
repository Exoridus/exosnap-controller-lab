import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const read=(name)=>readFile(path.join(root,name),'utf8');
test('the one comparison is the default; technical diagnostic links bypass the redirect',async()=>{
  for(const page of ['labs.html','pbr-lab.html','comparison.html','gallery-2d.html','qt-material-lab.html','qt-material-standalone.html','reference-check.html']){
    const html=await read(page);
    assert.ok(!html.includes('href="./index.html"'),`${page} has bare index href that redirects to Labs`);
  }
  const home=await read('index.html');
  assert.match(home,/location\.replace\('\.\/pbr-lab\.html'\)/);
  assert.match(await read('labs.html'),/location\.replace\('\.\/pbr-lab\.html'\)/);
});
