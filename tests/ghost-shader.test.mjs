import test from 'node:test';
import assert from 'node:assert/strict';
import { ShaderLib } from 'three';
import { ghostShellFragmentShader } from '../ghost-appearance.js';

test('ghost rim modifies the installed Three physical shader before alpha output',()=>{
  const source=ShaderLib.physical.fragmentShader;
  const patched=ghostShellFragmentShader(source,.24);
  assert.notEqual(patched,source);
  assert.equal(patched.split('float ghostRim').length,2);
  assert.ok(patched.indexOf('diffuseColor.a = min')<patched.indexOf('#include <opaque_fragment>'));
  assert.throws(()=>ghostShellFragmentShader('#include <output_fragment>',.24));
});
