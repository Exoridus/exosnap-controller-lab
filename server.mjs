import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8792);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.obj':'text/plain; charset=utf-8','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  let requestPath;
  try{requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  const full=path.resolve(root,'.'+requestPath);
  if(full!==root&&!full.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  let candidate=full===root?path.join(root,'index.html'):full;
  // Browser and GitHub Pages share the exact same vendored Three r180 modules.
  const vendorPrefix=path.join(root,'node_modules','three')+path.sep;
  if(candidate.startsWith(vendorPrefix) && existsSync(path.join(root,'vendor','three')))
    candidate=path.join(root,'vendor','three',path.relative(vendorPrefix,candidate));
  try{
    const s=await stat(candidate);
    if(!s.isFile())throw Error('not a file');
    const body=await readFile(candidate);
    res.writeHead(200,{'Content-Type':mime[path.extname(candidate)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':candidate.includes('assets'+path.sep)||candidate.includes('node_modules'+path.sep)?'public, max-age=86400':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.on('error',err=>{
  if(err.code==='EADDRINUSE')console.error('Port '+port+' is already in use. Close the OLD ExoSnap start.cmd window first (otherwise your browser may still show the old version).');
  else console.error('Unable to start local viewer:',err.message);
  process.exit(1);
});
server.listen(port,'127.0.0.1',()=>{
  const baseUrl=`http://127.0.0.1:${port}`;
  const url=baseUrl+(process.argv.includes('--reference')?'/reference-check.html':'/');
  console.log(`\nExoSnap Controller Lookvergleich V40\n${url}\n\nClose this window or press Ctrl+C to stop.\n`);
  if(process.argv.includes('--open')){
    if(process.platform==='win32')spawn('cmd',['/c','start','',url],{detached:true,stdio:'ignore',windowsHide:true}).unref();
    else if(process.platform==='darwin')spawn('open',[url],{detached:true,stdio:'ignore'}).unref();
    else spawn('xdg-open',[url],{detached:true,stdio:'ignore'}).unref();
  }
});
