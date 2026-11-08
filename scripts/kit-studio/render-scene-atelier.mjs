// Real production scene, bundled locally and rendered by Chromium WebGL. No image synthesis.
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { chromium } from '@playwright/test';
const root = process.cwd();
const out = path.join(root, 'docs/kit-studio/preuves/scene-atelier');
fs.mkdirSync(out, { recursive: true });
const tag = process.argv[2] || 'apres';
const matrix = process.argv.includes('--matrix');
const baseline = tag === 'avant';
const source = `
import * as THREE from 'three';
import { createKitScene } from './src/features/kit-studio/scene/createScene';
import { createInitialState } from './src/features/kit-studio/domain/state';
import { loadModuleAsset } from './src/features/kit-studio/scene/bag/moduleLoader';
window.capture = async (id, modules = [], light = null, close = false, zone = null) => {
  const canvas = document.querySelector('canvas');
  let renderer, loop, world, camera;
  const state = createInitialState('tmb');
  state.kits[state.kitId].bag = id;
  const handle = createKitScene(canvas, {state, bagModelId: id, reducedMotion: true, gestures: false,
    rendererFactory: (c,o) => {
      renderer = new THREE.WebGLRenderer({canvas:c, antialias:true, preserveDrawingBuffer:true});
      const render = renderer.render.bind(renderer);
      renderer.render = (s,c) => { world=s; camera=c; render(s,c); };
      renderer.setAnimationLoop = cb => {loop=cb;};
      return renderer;
    }
  });
  let t = 0;
  for(let i=0;i<300 && handle.info().bagModel.status !== 'glb';i++) {
    if(i===0) loop?.(t+=16.667); await new Promise(r=>setTimeout(r,30));
  }
  if(handle.info().bagModel.status !== 'glb') throw Error(JSON.stringify(handle.info().bagModel));
  for (const [module,anchor] of modules) {
    if(anchor==='etabli') {
      const loaded = await loadModuleAsset(module);
      world.add(loaded.root);
      loaded.root.position.set(0.43,-0.8,0.16);
      loaded.root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(loaded.root);
      loaded.root.position.y+=-0.8-bounds.min.y;
    } else {
      const result = await handle.attachModule(module,anchor);
      if(!result.ok) throw Error(JSON.stringify(result));
    }
  }
  if(zone) handle.setZone(zone);
  for(let i=0;i<12;i++) loop?.(t+=16.667);
  await new Promise(r=>setTimeout(r,400));
  loop?.(t+=16.667);
  if(light) {
    const sun = world.children.find(n=>n.isDirectionalLight && n.castShadow);
    const az = light.az * Math.PI/180, el = light.el*Math.PI/180;
    sun.position.copy(sun.target.position).add(new THREE.Vector3(5*Math.cos(el)*Math.cos(az),5*Math.sin(el),5*Math.cos(el)*Math.sin(az)));
    sun.intensity=light.power*Math.PI;
  }
  if(close) {
    // Only the evidence camera: production camera code is unchanged.
    camera.clearViewOffset(); camera.zoom=1;
    camera.position.set(-0.07,-0.36,0.52); camera.lookAt(-0.07,-0.36,0.13); camera.fov=12; camera.updateProjectionMatrix();
  }
  renderer.render(world,camera);
  const gl=renderer.getContext(); const ext=gl.getExtension('WEBGL_debug_renderer_info');
  const withWeave = new Uint8Array(640*760*4);
  gl.readPixels(0,0,640,760,gl.RGBA,gl.UNSIGNED_BYTE,withWeave);
  const hp = pixels => {
    let sum=0,n=0; const lum=i=>0.2126*pixels[i]+0.7152*pixels[i+1]+0.0722*pixels[i+2];
    // Textile patch to the right of the webbing, far from the badge and silhouette.
    for(let y=180;y<580;y++) for(let x=370;x<580;x++) {
      const i=(y*640+x)*4;
      const h=lum(i)-(lum(i-4)+lum(i+4)+lum(i-2560)+lum(i+2560))/4;
      sum+=h*h;n++;
    } return Math.sqrt(sum/n);
  };
  let contrast=null;
  if(close) {
    const saved=[];world.traverse(n=>{ for(const m of (Array.isArray(n.material)?n.material:[n.material])) {
      const graft=m?.[Symbol.for('lkdv.atlas.greffe')];
      if(graft) {saved.push([graft.uniforms.weaveStrength,graft.uniforms.weaveStrength.value]);graft.uniforms.weaveStrength.value=0;}
    }});
    renderer.render(world,camera); const flat=new Uint8Array(withWeave.length);
    gl.readPixels(0,0,640,760,gl.RGBA,gl.UNSIGNED_BYTE,flat);
    contrast={withWeave:hp(withWeave),withoutWeave:hp(flat)};
    contrast.ratio=contrast.withWeave/contrast.withoutWeave;
    for(const [u,v] of saved) u.value=v;
    renderer.render(world,camera);
  }
  const result={contrast,info:handle.info(),webgl:ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
  window.release=()=>handle.dispose();
  return result;
};`;
const { execFileSync } = await import('node:child_process');
const baselineFiles = ['scene/createScene.ts','scene/textures.ts','domain/palette.scene.ts','scene/layout.ts','scene/objects.ts'];
const baselinePlugin = {name:'baseline',setup(build){build.onLoad({filter:/src\/features\/kit-studio\/.*\.ts$/},args=>{const rel=path.relative(root,args.path); if(baselineFiles.some(f=>rel.endsWith(f))) return {contents:execFileSync('git',['show','2a97ca6:'+rel],{cwd:root,encoding:'utf8'}),loader:'ts'};});}};
const bundle=(await esbuild.build({plugins:baseline?[baselinePlugin]:[],stdin:{contents:source,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
try {
const page=await browser.newPage({viewport:{width:640,height:760},deviceScaleFactor:1});
page.on('pageerror',e=>{throw e});
page.on('console',m=>{if(m.type()==='error') console.error(m.text())});
await page.route('http://atelier.local/**',async route=>{
 const u=new URL(route.request().url());
 if(u.pathname==='/') return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{width:640px;height:760px;display:block}</style><canvas></canvas><script src="/bundle.js"></script>'});
 if(u.pathname==='/bundle.js') return route.fulfill({contentType:'text/javascript',body:bundle});
 const f=path.join(root,'public',u.pathname);
 return route.fulfill(fs.existsSync(f)?{body:fs.readFileSync(f),contentType:f.endsWith('.json')?'application/json':f.endsWith('.glb')?'model/gltf-binary':f.endsWith('.png')?'image/png':'image/webp'}:{status:404,body:u.pathname});
});
const cases=[['45-seul','lkdv-one-45',[]],['45-modules','lkdv-one-45',[['lkdv-m04','facade'],['lkdv-m01','etabli']]],['15-seul','lkdv-one-15',[]],['objets','lkdv-one-45',[],'worn'],['tissu','lkdv-one-45',[],null,true]];
const records={};
for(const [name,id,mods,zone,close] of cases.filter(c=>!process.argv.includes('--objects-only') || c[0]==='objets')){
 await page.goto('http://atelier.local/');
 records[name]=await page.evaluate(async ({id,mods,zone,close})=>window.capture(id,mods,null,close,zone),{id,mods,zone,close});
 await page.screenshot({path:path.join(out,tag+'-'+name+'.png')});
 await page.evaluate(()=>window.release());
}
if(matrix) {
 for(const el of [25,30,35]) for(const az of [10,35]) {
  await page.goto('http://atelier.local/');
  records['light-'+el+'-'+az]=await page.evaluate(async light=>window.capture('lkdv-one-45',[],light,true),{el,az,power:0.8});
  await page.screenshot({path:path.join(out,'lumiere-'+el+'-'+az+'.png')});
  await page.evaluate(()=>window.release());
 }
}
const recordPath = path.join(out,tag+'-webgl.json');
const previous = process.argv.includes('--objects-only') && fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath)) : {};
fs.writeFileSync(recordPath,JSON.stringify({...previous,...records},null,2));
console.log('Captured',tag,Object.keys(records));
} finally {await browser.close();}
