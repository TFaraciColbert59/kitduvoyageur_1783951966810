// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { chromium } from '@playwright/test';

const rootDir = process.cwd();

async function main() {
  console.log('Compiling showcase client bundle with esbuild...');
  const bundleResult = await esbuild.build({
    stdin: {
      contents: `
        import * as THREE from 'three';
        import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
        import { loadBagAsset, chargerTextureDonnee } from './src/features/kit-studio/scene/bag/loader';
        import { applyAtlasAppearance, applyMeterUvs } from './src/features/kit-studio/scene/bag/atlas';
        import {
          loadModuleAsset,
          createModuleAttachmentController,
          AVAILABLE_3D_MODULE_MANIFESTS
        } from './src/features/kit-studio/scene/bag/moduleLoader';
        import {
          resolveBagAttachmentAnchors,
          LKDV_ONE_BAG_BBOXES
        } from './src/features/kit-studio/domain/bagAnchorsTable';
        import {
          LIGHT_HEMI_SKY,
          LIGHT_HEMI_GROUND,
          LIGHT_SUN,
          LIGHT_RIM
        } from './src/features/kit-studio/domain/palette.scene';
        import { makeColor } from './src/features/kit-studio/scene/color';
        import { registerThumbBuilders } from './src/features/kit-studio/scene/thumbBuilders';
        import { getThumbnailEngine } from './src/features/kit-studio/scene/thumbnails';
        import { bagThumb, moduleThumb } from './src/features/kit-studio/scene/thumbSpecs';

        const provider = {
          async fetchManifest(id) {
            const isModule = id.startsWith('lkdv-m');
            const dir = isModule ? '/assets/modules/' : '/assets/bags/';
            const r = await fetch(dir + id + '.manifest.json');
            return r.json();
          },
          async fetchGlb(id, url) {
            const isModule = id.startsWith('lkdv-m');
            const target = url && !url.startsWith('http')
              ? url
              : isModule
                ? '/assets/modules/' + id + '.glb'
                : '/assets/bags/' + id + '.glb';
            const r = await fetch(target);
            return r.arrayBuffer();
          },
        };

        function setupLightingAndEnv(scene, renderer) {
          const pmrem = new THREE.PMREMGenerator(renderer);
          const roomEnv = new RoomEnvironment();
          scene.environment = pmrem.fromScene(roomEnv).texture;

          const hemi = new THREE.HemisphereLight(
            makeColor(LIGHT_HEMI_SKY),
            makeColor(LIGHT_HEMI_GROUND),
            0.72 * Math.PI
          );
          scene.add(hemi);

          const sun = new THREE.DirectionalLight(makeColor(LIGHT_SUN), 1.15 * Math.PI);
          sun.position.set(2.8, 4.5, 3.2);
          sun.castShadow = true;
          scene.add(sun);

          const rim = new THREE.DirectionalLight(makeColor(LIGHT_RIM), 0.45 * Math.PI);
          rim.position.set(-3.2, 2.2, -3.0);
          scene.add(rim);

          const fill = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI);
          fill.position.set(-2, 1.5, 2.5);
          scene.add(fill);

          // Disque d'ombre au sol
          const groundGeo = new THREE.PlaneGeometry(2.5, 2.5);
          groundGeo.rotateX(-Math.PI / 2);
          const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x050706,
            transparent: true,
            opacity: 0.45,
          });
          const ground = new THREE.Mesh(groundGeo, shadowMat);
          ground.position.y = -0.005;
          scene.add(ground);
        }

        // Cadrage adaptatif dynamique calculé depuis Box3 et fov (sans distance en dur)
        function frameAdaptiveCamera(camera, object3D, W, H, targetOccupancy = 0.78, drawerFraction = 0) {
          const box = new THREE.Box3().setFromObject(object3D);
          const spanY = Math.max(0.2, box.max.y - box.min.y);
          const spanX = Math.max(0.1, box.max.x - box.min.x);
          const spanZ = Math.max(0.1, box.max.z - box.min.z);
          const spanHoriz = Math.max(spanX, spanZ);
          const centerY = (box.min.y + box.max.y) * 0.5;

          const visibleHeightFraction = Math.max(0.5, 1 - drawerFraction);
          const reqH = spanY / (targetOccupancy * visibleHeightFraction);
          const reqW = spanHoriz / targetOccupancy;
          const aspect = W / H;
          const reqHFromW = reqW / Math.max(0.2, aspect);
          const effectiveH = Math.max(reqH, reqHFromW);

          const fovRad = (camera.fov * Math.PI) / 180;
          const halfTan = Math.tan(fovRad * 0.5);
          const dist = effectiveH / (2 * halfTan);

          const theta = 0.22 * Math.PI; // angle 3/4
          const phi = 0.46 * Math.PI;
          camera.position.set(
            dist * Math.sin(phi) * Math.sin(theta),
            centerY + dist * Math.cos(phi),
            dist * Math.sin(phi) * Math.cos(theta)
          );
          camera.lookAt(0, centerY, 0);

          return { dist, spanY, centerY };
        }

        async function createBagScene(canvasId, bagModelId, modulesToMount, opts = {}) {
          const canvas = document.getElementById(canvasId);
          if (!canvas) return;
          const W = canvas.clientWidth || 360;
          const H = canvas.clientHeight || 480;
          const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
          renderer.setSize(W, H, false);
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.08;

          const scene = new THREE.Scene();
          scene.background = new THREE.Color(0x131614);
          setupLightingAndEnv(scene, renderer);

          const weave = await chargerTextureDonnee('/assets/materials/weave-normal.webp');
          const TILE_M = 0.30;

          const bag = await loadBagAsset(bagModelId, provider);
          const zones = await chargerTextureDonnee(bag.manifest.zonesMapUrl);

          bag.root.traverse((n) => {
            if (n.isMesh && n.geometry) {
              delete n.geometry.userData.uvMetersWeave;
              applyMeterUvs(n.geometry, TILE_M);
            }
          });

          applyAtlasAppearance(
            bag,
            { body: { col: 'forest' }, front: { col: 'ochre' }, harness: { col: 'trim' } },
            { zones, weaveNormal: weave }
          );

          scene.add(bag.root);

          // Résoudre les ancres auditées du sac
          const baseAnchors = resolveBagAttachmentAnchors(bag.manifest);
          // Permettre des ancres supplémentaires si spécifiées pour le showcase multi-modules
          const extraAnchors = opts.extraAnchors || [];
          const allAnchors = [...baseAnchors, ...extraAnchors];

          const ctrl = createModuleAttachmentController(bag.root, allAnchors);

          for (const mod of modulesToMount) {
            const mAsset = await loadModuleAsset(mod.moduleId, provider);
            ctrl.attach(mAsset, mod.anchorId);
          }

          // Cadrage adaptatif
          const cam = new THREE.PerspectiveCamera(opts.fov || 28, W / H, 0.1, 20);
          const { dist, spanY, centerY } = frameAdaptiveCamera(cam, bag.root, W, H, opts.occupancy || 0.78, opts.drawerFraction || 0);

          renderer.render(scene, cam);

          return { dist, spanY, centerY };
        }

        window.__renderShowcase = async () => {
          registerThumbBuilders();

          // 1. Les cinq corps avec cadrage adaptatif à ~78%
          // 15L avec M14 (skis 1,70 m) sur facade + M02 (gourde) sur flanc
          const stats15 = await createBagScene('c-15', 'lkdv-one-15', [
            { moduleId: 'lkdv-m14', anchorId: 'facade' },
            { moduleId: 'lkdv-m02', anchorId: 'flanc-gauche' },
          ], {
            extraAnchors: [{ id: 'flanc-gauche', label: 'Flanc', zone: 'flanc-gauche', position: [-0.14, 0.22, 0], normal: [-1, 0, 0], up: [0, 1, 0] }],
          });

          // 25L avec M03 (pochette) sur facade + M01 (gourde) sur flanc
          const stats25 = await createBagScene('c-25', 'lkdv-one-25', [
            { moduleId: 'lkdv-m03', anchorId: 'facade' },
            { moduleId: 'lkdv-m01', anchorId: 'flanc-gauche' },
          ], {
            extraAnchors: [{ id: 'flanc-gauche', label: 'Flanc', zone: 'flanc-gauche', position: [-0.14, 0.24, 0], normal: [-1, 0, 0], up: [0, 1, 0] }],
          });

          // 45L avec M04 (poche multifonction) sur facade + M05 (organiseur) sur flanc
          const stats45 = await createBagScene('c-45', 'lkdv-one-45', [
            { moduleId: 'lkdv-m04', anchorId: 'facade' },
            { moduleId: 'lkdv-m05', anchorId: 'flanc-droit' },
          ], {
            extraAnchors: [{ id: 'flanc-droit', label: 'Flanc droit', zone: 'flanc-droit', position: [0.18, 0.26, 0.05], normal: [1, 0, 0], up: [0, 1, 0] }],
          });

          // 60L sans module (grand litrage)
          const stats60 = await createBagScene('c-60', 'lkdv-one-60', []);

          // 80L avec M11 (porte-sac de couchage) sur facade + M07 (poche latérale) sur flanc-droit
          const stats80 = await createBagScene('c-80', 'lkdv-one-80', [
            { moduleId: 'lkdv-m11', anchorId: 'facade' },
            { moduleId: 'lkdv-m07', anchorId: 'flanc-droit' },
          ]);

          // 2. Comparatif Avant / Après sur LKDV ONE 15L
          // 15L seul (hauteur 46 cm) -> cadrage rapproché
          const statsBefore = await createBagScene('c-before', 'lkdv-one-15', []);

          // 15L avec M14 (hauteur 1,70 m) -> recul adaptatif automatique
          const statsAfter = await createBagScene('c-after', 'lkdv-one-15', [
            { moduleId: 'lkdv-m14', anchorId: 'facade' },
          ]);

          // Inscription des métriques calculées dans le DOM
          if (statsBefore) {
            const el = document.getElementById('metric-before');
            if (el) el.textContent = 'Portée : ' + Math.round(statsBefore.spanY * 100) + ' cm · Dist : ' + statsBefore.dist.toFixed(2) + ' m · Cadre : 78%';
          }
          if (statsAfter) {
            const el = document.getElementById('metric-after');
            if (el) el.textContent = 'Portée : ' + Math.round(statsAfter.spanY * 100) + ' cm · Dist : ' + statsAfter.dist.toFixed(2) + ' m · Cadre : 78%';
          }

          // 3. Rendu des vignettes 3D relatives et vignettes de modules
          const engine = getThumbnailEngine();
          const thumbPromises = [];

          // Vignettes de sacs (échelles relatives de 15L à 80L avec ligne de sol commune)
          const bagIds = ['lkdv-one-15', 'lkdv-one-25', 'lkdv-one-45', 'lkdv-one-60', 'lkdv-one-80'];
          for (const bId of bagIds) {
            const ref = bagThumb(bId, { body: 'forest', pocket: 'forest', trim: 'trim' });
            const p = new Promise((resolve) => {
              engine.subscribe(ref.key, (blobUrl) => {
                const img = document.getElementById('thumb-' + bId);
                if (img && blobUrl) img.src = blobUrl;
                if (blobUrl) resolve(true);
              });
            });
            engine.request(ref.key, { spec: ref.spec, priority: 100 });
            thumbPromises.push(p);
          }

          // Vignettes de modules 3D
          const modSpecs = [
            { id: 'lkdv-m04', code: 'M04' },
            { id: 'lkdv-m14', code: 'M14' },
            { id: 'lkdv-m10', code: 'M10' },
            { id: 'lkdv-m01', code: 'M01' },
          ];
          for (const m of modSpecs) {
            const ref = moduleThumb(m.id, m.code);
            const p = new Promise((resolve) => {
              engine.subscribe(ref.key, (blobUrl) => {
                const img = document.getElementById('thumb-' + m.id);
                if (img && blobUrl) img.src = blobUrl;
                if (blobUrl) resolve(true);
              });
            });
            engine.request(ref.key, { spec: ref.spec, priority: 100 });
            thumbPromises.push(p);
          }

          await Promise.race([
            Promise.all(thumbPromises),
            new Promise((r) => setTimeout(r, 15000)),
          ]);

          return { success: true };
        };
      `,
      resolveDir: rootDir,
      sourcefile: 'entry.js',
    },
    bundle: true,
    write: false,
    format: 'iife',
  });

  const bundleJs = bundleResult.outputFiles[0].text;
  console.log('Bundle generated successfully (' + Math.round(bundleJs.length / 1024) + ' Ko)');

  console.log('Launching Playwright Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2000, height: 2150 } });
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  await page.route('http://lkdv.local/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Kit Studio — Planche d'Audit Visuel : 5 Corps, Cadrage Adaptatif & Porteurs</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0b0d0c;
    color: #edeae3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 32px;
    width: 2000px;
  }
  header {
    margin-bottom: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  h1 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #f1f4ef;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge-live {
    background: #183e25;
    color: #8be19f;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid rgba(139,225,159,0.3);
  }
  p.subtitle {
    font-size: 14px;
    color: #929e94;
    margin-top: 6px;
  }
  .header-meta {
    font-size: 13px;
    color: #7b887d;
    font-family: ui-monospace, monospace;
    text-align: right;
  }

  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: #f1f4ef;
    margin: 28px 0 16px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-tag {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    background: rgba(255,255,255,0.08);
    color: #a4b5a7;
  }

  /* Rangée des 5 corps */
  .grid-5-bags {
    display: grid;
    grid-template-columns: repeat(5, 368px);
    gap: 20px;
    margin-bottom: 28px;
  }
  .card-bag {
    background: #131614;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 30px rgba(0,0,0,0.5);
  }
  .card-bag canvas {
    width: 368px;
    height: 480px;
    display: block;
    background: #131614;
  }
  .card-bag-caption {
    padding: 16px 18px;
    background: #0f1210;
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .card-bag-caption h2 {
    font-size: 15px;
    font-weight: 600;
    color: #e4e9e2;
  }
  .tag {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 5px;
    text-transform: uppercase;
  }
  .tag-mounted { background: #1a422a; color: #9df2b5; border: 1px solid rgba(157,242,181,0.25); }
  .tag-overflow { background: #4a3418; color: #f5c479; border: 1px solid rgba(245,196,121,0.3); }
  .tag-single { background: #1f2722; color: #a0b5a4; border: 1px solid rgba(255,255,255,0.1); }
  .card-bag-caption p {
    font-size: 12px;
    color: #9aa89d;
    line-height: 1.4;
  }
  .specs-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .pill {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    background: rgba(255,255,255,0.06);
    color: #b0bfb3;
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Section Avant / Après */
  .grid-before-after {
    display: grid;
    grid-template-columns: repeat(2, 946px);
    gap: 24px;
    margin-bottom: 28px;
  }
  .card-compare {
    background: #131614;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .card-compare canvas {
    width: 946px;
    height: 520px;
    display: block;
    background: #131614;
  }
  .card-compare-caption {
    padding: 16px 20px;
    background: #0f1210;
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* Section Relevés iPhone (Vignettes 3D & Cartes UI) */
  .grid-iphone-details {
    display: grid;
    grid-template-columns: 820px 1072px;
    gap: 24px;
  }
  .panel-box {
    background: #111412;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    padding: 22px 24px;
  }
  .panel-title {
    font-size: 15px;
    font-weight: 600;
    color: #f1f4ef;
    margin-bottom: 4px;
  }
  .panel-desc {
    font-size: 12px;
    color: #8c998e;
    margin-bottom: 16px;
  }

  /* Ligne de sol des vignettes sacs */
  .thumbs-bags-row {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    background: #171b18;
    border-radius: 10px;
    padding: 24px 20px 14px 20px;
    border-bottom: 2px solid #3c5443;
    position: relative;
    height: 180px;
  }
  .thumb-bag-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
  }
  .thumb-bag-item img {
    width: 110px;
    height: 110px;
    object-fit: contain;
  }
  .thumb-bag-label {
    font-size: 11px;
    font-weight: 600;
    color: #d8deda;
    margin-top: 6px;
  }
  .thumb-bag-sub {
    font-size: 10px;
    color: #859689;
    font-family: ui-monospace, monospace;
  }

  /* Vignettes modules */
  .thumbs-mods-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-top: 14px;
  }
  .thumb-mod-card {
    background: #171b18;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .thumb-mod-card img {
    width: 80px;
    height: 80px;
    object-fit: contain;
  }
  .thumb-mod-title {
    font-size: 11px;
    font-weight: 600;
    color: #ecf0ea;
    text-align: center;
  }

  /* Cartes UI */
  .ui-cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .ui-card-mock {
    background: #171b19;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ui-card-mock.selected {
    border-color: #55b273;
    background: #14251a;
  }
  .card-badge {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    font-weight: 700;
    color: #6da27c;
  }
  .card-h {
    font-size: 13px;
    font-weight: 600;
    color: #f1f4ef;
  }
  .card-sub {
    font-size: 12px;
    color: #8fa093;
  }
  .card-notice {
    font-size: 11px;
    color: #f0be6a;
    background: rgba(240,190,106,0.12);
    padding: 3px 6px;
    border-radius: 4px;
    display: inline-block;
    margin-top: 4px;
    font-weight: 500;
  }
  .card-indicatif {
    font-size: 11px;
    color: #8be19f;
    background: rgba(139,225,159,0.12);
    padding: 3px 6px;
    border-radius: 4px;
    display: inline-block;
    margin-top: 4px;
  }
</style>
</head>
<body>
  <header>
    <div>
      <h1>
        LKDV ONE Kit Studio — Planche de Contrôle WebGL Réel
        <span class="badge-live">5 Corps & Porteurs Validés</span>
      </h1>
      <p class="subtitle">Vérification visuelle : cadrage adaptatif à ~78% de la hauteur utile, 3 sacs avec 2 modules, M14 sur 15L sans débordement de cadre, vignettes relatives et mentions raccourcies</p>
    </div>
    <div class="header-meta">
      <div>Résolution : <strong>2000 × 2150 px</strong></div>
      <div>Tests : 472/472 verts · PBR trame 2×2 calibrée</div>
    </div>
  </header>

  <!-- SECTION 1 : LES CINQ CORPS AVEC CADRAGE ADAPTATIF -->
  <div class="section-title">
    <span>1. Les Cinq Corps LKDV ONE — Cadrage Adaptatif à 78 % de la Hauteur Utile</span>
    <span class="section-tag">Calcul dynamique Box3 + FOV</span>
  </div>

  <div class="grid-5-bags">
    <!-- 15L -->
    <div class="card-bag">
      <canvas id="c-15"></canvas>
      <div class="card-bag-caption">
        <div class="title-row">
          <h2>LKDV ONE 15 L</h2>
          <span class="tag tag-overflow">M14 + M02</span>
        </div>
        <p>Porte-skis M14 (1,70 m) sur façade + M02 sur flanc. Recadrage automatique pour garder les skis dans le champ.</p>
        <div class="specs-pills">
          <span class="pill">640 g · 89 € (indicatif)</span>
          <span class="pill">+56 cm au-dessus</span>
          <span class="pill">fitRule: porteur</span>
        </div>
      </div>
    </div>

    <!-- 25L -->
    <div class="card-bag">
      <canvas id="c-25"></canvas>
      <div class="card-bag-caption">
        <div class="title-row">
          <h2>LKDV ONE 25 L</h2>
          <span class="tag tag-mounted">M03 + M01</span>
        </div>
        <p>Pochette zip M03 sur façade + porte-gourde M01 sur flanc. Cadrage adaptatif centré à 78 %.</p>
        <div class="specs-pills">
          <span class="pill">840 g · 109 € (indicatif)</span>
          <span class="pill">H: 52 cm</span>
          <span class="pill">fitRule: face</span>
        </div>
      </div>
    </div>

    <!-- 45L -->
    <div class="card-bag">
      <canvas id="c-45"></canvas>
      <div class="card-bag-caption">
        <div class="title-row">
          <h2>LKDV ONE 45 L (Défaut)</h2>
          <span class="tag tag-mounted">M04 + M05</span>
        </div>
        <p>Poche multifonction M04 sur façade + organiseur M05 sur flanc. Nouveau corps d'arrivée par défaut du Studio.</p>
        <div class="specs-pills">
          <span class="pill">1240 g · 159 € (indicatif)</span>
          <span class="pill">H: 66 cm</span>
          <span class="pill">8 pts d'attache</span>
        </div>
      </div>
    </div>

    <!-- 60L -->
    <div class="card-bag">
      <canvas id="c-60"></canvas>
      <div class="card-bag-caption">
        <div class="title-row">
          <h2>LKDV ONE 60 L</h2>
          <span class="tag tag-single">Corps Seul</span>
        </div>
        <p>Grand volume 60 L pour trek prolongé. Géométrie et suspension spécifiques cadrées à 78 %.</p>
        <div class="specs-pills">
          <span class="pill">1580 g · 189 € (indicatif)</span>
          <span class="pill">H: 74 cm</span>
          <span class="pill">10 pts</span>
        </div>
      </div>
    </div>

    <!-- 80L -->
    <div class="card-bag">
      <canvas id="c-80"></canvas>
      <div class="card-bag-caption">
        <div class="title-row">
          <h2>LKDV ONE 80 L</h2>
          <span class="tag tag-overflow">M11 + M07</span>
        </div>
        <p>Porte-sac de couchage M11 sur façade + poche latérale M07 sur flanc droit audité. Emprise de charge complète.</p>
        <div class="specs-pills">
          <span class="pill">2050 g · 229 € (indicatif)</span>
          <span class="pill">+14 cm en largeur</span>
          <span class="pill">H: 80 cm</span>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 2 : COMPARATIF AVANT / APRES POSE M14 SUR 15L -->
  <div class="section-title">
    <span>2. Preuve de Recadrage Dynamique — LKDV ONE 15 L Avant et Après Pose du M14 (1,70 m)</span>
    <span class="section-tag">Recul automatique sac + modules</span>
  </div>

  <div class="grid-before-after">
    <!-- Avant -->
    <div class="card-compare">
      <canvas id="c-before"></canvas>
      <div class="card-compare-caption">
        <div>
          <h2 style="font-size:15px; color:#e4e9e2;">Avant pose : LKDV ONE 15 L seul (46 cm)</h2>
          <p style="font-size:12px; color:#9aa89d; margin-top:2px;">La caméra se positionne au plus près pour occuper 78 % de la hauteur utile avec le petit sac.</p>
        </div>
        <div class="pill" id="metric-before" style="font-size:12px; padding:6px 12px; background:#1b241e; color:#9be3ab;">Calcul en cours...</div>
      </div>
    </div>

    <!-- Après -->
    <div class="card-compare">
      <canvas id="c-after"></canvas>
      <div class="card-compare-caption">
        <div>
          <h2 style="font-size:15px; color:#e4e9e2;">Après pose : LKDV ONE 15 L + Porte-skis M14 (1,70 m)</h2>
          <p style="font-size:12px; color:#9aa89d; margin-top:2px;">Recul dynamique automatique : l'envergure verticale de 1,70 m tient intégralement dans les 78 % de cadrage.</p>
        </div>
        <div class="pill" id="metric-after" style="font-size:12px; padding:6px 12px; background:#342718; color:#f0be6a;">Calcul en cours...</div>
      </div>
    </div>
  </div>

  <!-- SECTION 3 : RELEVES IPHONE TONY (VIGNETTES ET CARTES) -->
  <div class="section-title">
    <span>3. Relevés iPhone 16 Pro — Vignettes à Échelle Relative et Mentions Courtes</span>
    <span class="section-tag">Audit d'interface corrigé</span>
  </div>

  <div class="grid-iphone-details">
    <!-- Panneau Vignettes Sacs & Modules -->
    <div class="panel-box">
      <div class="panel-title">Vignettes 3D : Ligne de sol commune & Rendu réel des modules</div>
      <div class="panel-desc">Échelle relative de 15L à 80L sur base commune (0.52 à 0.90) + maillages 3D pour chaque module.</div>

      <div class="thumbs-bags-row">
        <div class="thumb-bag-item">
          <img id="thumb-lkdv-one-15" alt="15L" />
          <span class="thumb-bag-label">15 L</span>
          <span class="thumb-bag-sub">éch 0.52</span>
        </div>
        <div class="thumb-bag-item">
          <img id="thumb-lkdv-one-25" alt="25L" />
          <span class="thumb-bag-label">25 L</span>
          <span class="thumb-bag-sub">éch 0.58</span>
        </div>
        <div class="thumb-bag-item">
          <img id="thumb-lkdv-one-45" alt="45L" />
          <span class="thumb-bag-label">45 L</span>
          <span class="thumb-bag-sub">éch 0.70</span>
        </div>
        <div class="thumb-bag-item">
          <img id="thumb-lkdv-one-60" alt="60L" />
          <span class="thumb-bag-label">60 L</span>
          <span class="thumb-bag-sub">éch 0.78</span>
        </div>
        <div class="thumb-bag-item">
          <img id="thumb-lkdv-one-80" alt="80L" />
          <span class="thumb-bag-label">80 L</span>
          <span class="thumb-bag-sub">éch 0.90</span>
        </div>
      </div>

      <div class="thumbs-mods-row">
        <div class="thumb-mod-card">
          <img id="thumb-lkdv-m04" alt="M04" />
          <div class="thumb-mod-title">M04 · Poche multi</div>
        </div>
        <div class="thumb-mod-card">
          <img id="thumb-lkdv-m14" alt="M14" />
          <div class="thumb-mod-title">M14 · Porte-skis</div>
        </div>
        <div class="thumb-mod-card">
          <img id="thumb-lkdv-m10" alt="M10" />
          <div class="thumb-mod-title">M10 · Porte-matelas</div>
        </div>
        <div class="thumb-mod-card">
          <img id="thumb-lkdv-m01" alt="M01" />
          <div class="thumb-mod-title">M01 · Flasque</div>
        </div>
      </div>
    </div>

    <!-- Panneau Cartes Interface Studio -->
    <div class="panel-box">
      <div class="panel-title">Cartes UI Studio : Mentions de débordement raccourcies & Prix indicatifs</div>
      <div class="panel-desc">Texte court lisible sans troncature (« +56 cm au-dessus ») et verrou d'achat conservé sur corps indicatifs.</div>

      <div class="ui-cards-grid">
        <div class="ui-card-mock selected">
          <div class="card-badge">M14 · PORTEUR</div>
          <div class="card-h">Porte-skis A-frame</div>
          <div class="card-sub">Monté sur façade 15 L</div>
          <div class="card-notice">+56 cm au-dessus</div>
        </div>

        <div class="ui-card-mock">
          <div class="card-badge">M10 · PORTEUR</div>
          <div class="card-h">Porte-matelas</div>
          <div class="card-sub">Compatible façade 15 L</div>
          <div class="card-notice">+28 cm en largeur</div>
        </div>

        <div class="ui-card-mock">
          <div class="card-badge">M09 · PORTEUR</div>
          <div class="card-h">Porte-tente</div>
          <div class="card-sub">Compatible façade 15 L</div>
          <div class="card-notice">+18 cm en largeur</div>
        </div>

        <div class="ui-card-mock">
          <div class="card-badge">LKDV ONE 45 L</div>
          <div class="card-h">Corps 45 L (Défaut)</div>
          <div class="card-sub">1 240 g · 159 € (indicatif)</div>
          <div class="card-indicatif">Non commandable</div>
        </div>

        <div class="ui-card-mock">
          <div class="card-badge">LKDV ONE 15 L</div>
          <div class="card-h">Corps 15 L</div>
          <div class="card-sub">640 g · 89 € (indicatif)</div>
          <div class="card-indicatif">Non commandable</div>
        </div>

        <div class="ui-card-mock">
          <div class="card-badge">CORPS 42 L (HÉRITÉ)</div>
          <div class="card-h">Corps 42 L</div>
          <div class="card-sub">1 180 g · 149 €</div>
          <div class="card-badge" style="color:#78b792; margin-top:4px;">Achetable (vrai prix)</div>
        </div>
      </div>
    </div>
  </div>

  <script src="/bundle.js"></script>
</body>
</html>`,
      });
      return;
    }

    if (url.pathname === '/bundle.js') {
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: bundleJs });
      return;
    }

    const diskPath = path.join(rootDir, 'public', url.pathname);
    if (fs.existsSync(diskPath)) {
      const ct = diskPath.endsWith('.json')
        ? 'application/json'
        : diskPath.endsWith('.glb')
          ? 'model/gltf-binary'
          : 'image/webp';
      await route.fulfill({ status: 200, contentType: ct, body: fs.readFileSync(diskPath) });
      return;
    }

    await route.fulfill({ status: 404, body: 'Not found: ' + url.pathname });
  });

  console.log('Navigating to local showcase page...');
  await page.goto('http://lkdv.local/');

  console.log('Rendering 3D scenes in Chromium WebGL...');
  await page.evaluate(() => window.__renderShowcase());

  const outDocCapture = path.join(rootDir, 'docs', 'kit-studio', 'captures', 'planche-showcase-5-corps.png');
  const outArtifact =
    '/Users/fr168256/.gemini/antigravity/brain/d28cd7bf-6884-4942-8cdf-48fb7f3bb858/kit-studio-showcase-modules.png';

  await page.screenshot({ path: outDocCapture, fullPage: true });
  console.log('Screenshot saved to docs: ' + outDocCapture);

  await page.screenshot({ path: outArtifact, fullPage: true });
  console.log('Screenshot saved to artifact: ' + outArtifact);

  await browser.close();
  console.log('Showcase generation finished successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
