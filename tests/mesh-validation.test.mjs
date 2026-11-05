import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectObjText} from '../mesh-validation.js';

test('rejects empty, HTML and LFS pointers even when HTTP 200',()=>{
  for(const content of ['', '<html>GitHub error 200</html>', 'version https://git-lfs.github.com/spec/v1\noid sha256:asdf\nsize 1200']){
    assert.equal(inspectObjText(content).valid,false);
  }
});
test('requires real vertices and faces',()=>{
  assert.equal(inspectObjText('o foo\nv 0 0 0\nv 1 0 0\nv 0 1 0\n').valid,false);
  const valid='o DPadLeft\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
  assert.deepEqual(inspectObjText(valid),{valid:true,vertices:3,faces:1,reason:''});
});
