import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('static Pages build exports a deployable offline-look viewer without source-only files', async()=>{
  const {buildPages}=await import('../tools/build-pages.mjs');
  const dir=await mkdtemp(path.join(tmpdir(),'exosnap-pages-test-'));
  try{
    await buildPages(root,dir);
    for(const p of ['index.html','pbr-lab.html','pbr-lab.js','assets/DualSenseCompact/top_shell.obj','assets/studio-neutral.hdr','references/controllers/dualsense/source.svg','node_modules/three/build/three.module.js','.nojekyll','screenshots.html'])await stat(path.join(dir,p));
    await assert.rejects(stat(path.join(dir,'tests/pages-release.test.mjs')));
    await assert.rejects(stat(path.join(dir,'server.mjs')));
    const html=await readFile(path.join(dir,'pbr-lab.html'),'utf8');
    assert.match(html,/screenshots\.html/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('screenshot proof rejects missing WebGL or missing 3D draw budgets',async()=>{
  const {verifyRenderedState}=await import('../tools/visual-capture-contract.mjs');
  const source={status:'three-rendered',sampleCount:12,activeLooks:4,drawStats:Object.fromEntries(['solid','ghost','outline','identity'].map(x=>[x,{sourceCalls:20,calls:23}]))};
  assert.equal(verifyRenderedState({...source,nontransparentPixels:900}),true);
  assert.throws(()=>verifyRenderedState({...source,nontransparentPixels:0}),/nontransparent/);
  assert.throws(()=>verifyRenderedState({...source,status:'webgl-unavailable'}),/WebGL/);
  assert.throws(()=>verifyRenderedState({...source,drawStats:{}}),/draw/);
});
test('visual history creates immutable commit-addressed references and rejects corrupted captures',async()=>{
  const {archiveSnapshots}=await import('../tools/archive-snapshots.mjs');
  const {writeFile,readFile,mkdir}=await import('node:fs/promises');
  const {createHash}=await import('node:crypto');
  const workspace=await mkdtemp(path.join(tmpdir(),'exosnap-history-test-'));
  const capture=path.join(workspace,'capture'),archive=path.join(workspace,'archive'),sha='a'.repeat(40);
  try{
    await mkdir(capture,{recursive:true});
    const images=[];
    for(const [name,seed] of [['overview-neutral.png',3],['overview-pressed.png',7]]){
      const bytes=Buffer.alloc(50000,seed);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);
      await writeFile(path.join(capture,name),bytes);
      images.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
    await writeFile(path.join(capture,'capture-manifest.json'),JSON.stringify({revision:sha,capturedAt:'2026-11-05T00:00:00Z',images}));
    const entry=await archiveSnapshots(capture,archive,'Exoridus/exosnap-controller-lab',sha);
    assert.equal(entry.sha,sha);
    assert.match(entry.neutralUrl,/visual-history\/snapshots\/a{40}\/overview-neutral\.png/);
    const saved=JSON.parse(await readFile(path.join(archive,'index.json'),'utf8'));
    assert.equal(saved.length,1);
    await archiveSnapshots(capture,archive,'Exoridus/exosnap-controller-lab',sha);
    assert.equal(JSON.parse(await readFile(path.join(archive,'index.json'),'utf8')).length,1);
    await writeFile(path.join(capture,'overview-pressed.png'),Buffer.alloc(50000,0));
    await assert.rejects(archiveSnapshots(capture,archive,'Exoridus/exosnap-controller-lab',sha),/integrity/);
  }finally{await rm(workspace,{recursive:true,force:true});}
});
