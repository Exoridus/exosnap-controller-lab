import test from 'node:test';
import assert from 'node:assert/strict';
import * as capture from '../tools/capture-consolidated.mjs';
const light={scene:'light',housing:'rgb(133, 133, 133)',button:'rgb(133, 133, 133)',
  glyph:'rgb(37, 40, 43)',surface:'rgb(133, 133, 133)',alpha:.3,glyphOpacity:1,
  filter:'',glyphFilter:'',outerFilter:'',leftMargin:42,rightMargin:42};
test('browser gate accepts independent face ink but rejects low contrast, faded legends and damaged contours',()=>{
  assert.equal(typeof capture.verifyFlatAudit,'function');
  assert.doesNotThrow(()=>capture.verifyFlatAudit(light));
  assert.doesNotThrow(()=>capture.verifyFlatAudit({...light,scene:'dark',housing:'#ffffff',button:'#ffffff',surface:'#9ca3aa',alpha:1}));
  assert.throws(()=>capture.verifyFlatAudit({...light,glyph:light.surface,alpha:1}),/contrast/);
  assert.throws(()=>capture.verifyFlatAudit({...light,glyphOpacity:.3}),/coverage/);
  assert.throws(()=>capture.verifyFlatAudit({...light,button:'#000000'}),/contour/);
  assert.throws(()=>capture.verifyFlatAudit({...light,glyphFilter:'url(#shadow)'}),/plate/);
  assert.throws(()=>capture.verifyFlatAudit({...light,leftMargin:0}),/clipped/);
});
