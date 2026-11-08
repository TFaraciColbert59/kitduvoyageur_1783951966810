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
      loaded.root.position.set(0.43,-0.8,0.10);
      loaded.root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(loaded.root);
      loaded.root.position.y+=-0.8-bounds.min.y;
    } else {
      const result = await handle.attachModule(module,anchor);
      if(!result.ok) throw Error(JSON.stringify(result));
    }
  }
  handle.resize(); // Réveille le cycle après le chargement GLB asynchrone.
  if(zone) handle.setZone(zone);
  // L'adaptation de distance utilise un amortissement, même en mouvement réduit.
  // Faire converger sa pose sans rasteriser 180 fois le même décor logiciel.
  const draw = renderer.render;
  renderer.render = (s,c) => { world=s; camera=c; };
  for(let i=0;i<180;i++) {
    loop?.(t+=16.667);
    if(i%20===0) await new Promise(r=>setTimeout(r,0));
  }
  renderer.render = draw;
  await new Promise(r=>setTimeout(r,400));
  loop?.(t+=16.667);
  const bodyMeshes=[];
  world.traverse(n=>{if(n.isMesh && n.material && (Array.isArray(n.material)?n.material:[n.material]).some(m=>m[Symbol.for('lkdv.atlas.greffe')])) bodyMeshes.push(n);});
  const composite=new THREE.Box3();
  for(const n of bodyMeshes) composite.expandByObject(n);
  const mounted=handle.getAttachments()?.getMountedModule('facade');
  if(mounted) composite.expandByObject(mounted.root);
  const originalCamera={position:camera.position.toArray(),fov:camera.fov,zoom:camera.zoom,view:camera.view?{...camera.view}:null};
  if(!close && !zone) {
    // Caméra de preuve seulement : le cadrage de production c9104bf coupe encore le bas.
    // Même orientation et même FOV, recentrage sur le GLB, occupation projetée de 78 %.
    renderer.render(world,camera);
    window.productionShot=canvas.toDataURL('image/png');
    camera.clearViewOffset();
    const center=composite.getCenter(new THREE.Vector3());
    const theta=handle.info().view.angle,phi=1.2;
    const direction=new THREE.Vector3(Math.sin(phi)*Math.sin(theta),Math.cos(phi),Math.sin(phi)*Math.cos(theta));
    const corners=[];
    for(const x of [composite.min.x,composite.max.x]) for(const y of [composite.min.y,composite.max.y]) for(const z of [composite.min.z,composite.max.z]) corners.push(new THREE.Vector3(x,y,z));
    let lo=0.5,hi=8;
    for(let i=0;i<30;i++) {
      const dist=(lo+hi)/2;
      camera.position.copy(center).addScaledVector(direction,dist);
      camera.lookAt(center);camera.updateMatrixWorld();camera.updateProjectionMatrix();
      const ys=corners.map(p=>p.clone().project(camera).y);
      if((Math.max(...ys)-Math.min(...ys))/2>0.78) lo=dist;else hi=dist;
    }
  }
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
  const bounds=new THREE.Box3();
  for(const n of bodyMeshes) bounds.expandByObject(n);
  const projected=[];
  for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]) projected.push(new THREE.Vector3(x,y,z).project(camera));
  const framing={kind:close?'macro':zone?'production':'comparative-78-percent',originalCamera,camera:camera.position.toArray(),fov:camera.fov,zoom:camera.zoom,projectedBoundsHeight:(Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y)))/2};
  const result={contrast,framing,info:handle.info(),webgl:ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
  window.release=()=>handle.dispose();
  return result;
};`;
const { execFileSync } = await import('node:child_process');
const baselineFiles = ['scene/createScene.ts','scene/textures.ts','domain/palette.scene.ts','scene/layout.ts','scene/objects.ts'];
const baselinePlugin = {name:'baseline',setup(build){build.onLoad({filter:/src\/features\/kit-studio\/.*\.ts$/},args=>{const rel=path.relative(root,args.path); if(baselineFiles.some(f=>rel.endsWith(f))) return {contents:execFileSync('git',['show','08993b8:'+rel],{cwd:root,encoding:'utf8'}),loader:'ts'};});}};
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
for(const [name,id,mods,zone,close] of cases.filter(c=>(!process.argv.includes('--views-only') || !['objets','tissu'].includes(c[0])) && (!process.argv.includes('--objects-only') || c[0]==='objets') && (!process.argv.includes('--single') || c[0]===process.argv[process.argv.indexOf('--single')+1]))){
 await page.goto('http://atelier.local/');
 records[name]=await page.evaluate(async ({id,mods,zone,close})=>window.capture(id,mods,null,close,zone),{id,mods,zone,close});
 await page.screenshot({path:path.join(out,tag+'-'+name+'.png')});
 if(!zone && !close) {const data=await page.evaluate(()=>window.productionShot);fs.writeFileSync(path.join(out,tag+'-'+name+'-camera-production.png'),Buffer.from(data.split(',')[1],'base64'));}
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
const previous = (process.argv.includes('--objects-only') || process.argv.includes('--single') || process.argv.includes('--views-only')) && fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath)) : {};
fs.writeFileSync(recordPath,JSON.stringify({...previous,...records},null,2));
console.log('Captured',tag,Object.keys(records));
} finally {await browser.close();}
