import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright';
const root=process.cwd();const types={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'};
const srv=http.createServer((q,s)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){s.writeHead(404);return s.end();}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen(8765);
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage({viewport:{width:1536,height:1024}});
for(const m of process.argv.slice(2)){for(const a of [0,40,90,180]){await pg.goto(`http://localhost:8765/tools/render-bag.html?m=/assets/3d/${m}.hd.glb&a=${a}`);await pg.waitForFunction(()=>window.DONE||window.ERR,null,{timeout:240000});const e=await pg.evaluate(()=>window.ERR);if(e){console.log(m,a,e);continue;}await pg.screenshot({path:`assets/ref/${m}-${a}.png`});console.log('ok',m,a);}}
await b.close();srv.close();
