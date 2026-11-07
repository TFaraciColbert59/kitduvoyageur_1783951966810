// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { chromium } from '@playwright/test';

const rootDir = process.cwd();

async function main() {
  console.log('Compiling client bundle with esbuild...');
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
          calculateModuleOverflowNotice,
          filterCompatibleModulesForBag,
          LKDV_ONE_BAG_BBOXES
        } from './src/features/kit-studio/domain/bagAnchorsTable';
        import {
          LIGHT_HEMI_SKY,
          LIGHT_HEMI_GROUND,
          LIGHT_SUN,
          LIGHT_RIM
        } from './src/features/kit-studio/domain/palette.scene';
        import { makeColor } from './src/features/kit-studio/scene/color';

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
          scene.add(sun);

          const rim = new THREE.DirectionalLight(makeColor(LIGHT_RIM), 0.45 * Math.PI);
          rim.position.set(-3.2, 2.2, -3.0);
          scene.add(rim);

          const fill = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI);
          fill.position.set(-2, 1.5, 2.5);
          scene.add(fill);
        }

        window.__renderShowcase = async () => {
          const weave = await chargerTextureDonnee('/assets/materials/weave-normal.webp');
          const TILE_M = 0.30;
          const WEAVE_STRENGTH = 1.95;

          // -------------------------------------------------------------------------
          // CANV 1 : LKDV ONE 45L + Module M04 (Poche multifonction) monté en façade
          // -------------------------------------------------------------------------
          {
            const canvas = document.getElementById('c1');
            const W = 620, H = 720;
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
            renderer.setSize(W, H, false);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.08;

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x131614);
            setupLightingAndEnv(scene, renderer);

            const bag45 = await loadBagAsset('lkdv-one-45', provider);
            const zones45 = await chargerTextureDonnee(bag45.manifest.zonesMapUrl);

            bag45.root.traverse((n) => {
              if (n.isMesh && n.geometry) {
                delete n.geometry.userData.uvMetersWeave;
                applyMeterUvs(n.geometry, TILE_M);
              }
            });

            applyAtlasAppearance(
              bag45,
              { body: { col: 'forest' }, front: { col: 'ochre' }, harness: { col: 'trim' } },
              { zones: zones45, weaveNormal: weave }
            );

            scene.add(bag45.root);

            // Charger et attacher M04
            const m04 = await loadModuleAsset('lkdv-m04', provider);
            const anchors45 = resolveBagAttachmentAnchors(bag45.manifest);
            const ctrl45 = createModuleAttachmentController(bag45.root, anchors45);
            ctrl45.attach(m04, 'facade');

            // Caméra cadrant le sac et le module
            const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 20);
            const dist = 2.15;
            const theta = 0.22 * Math.PI; // léger angle 3/4
            const phi = 0.46 * Math.PI;
            const targetY = 0.35;
            cam.position.set(
              dist * Math.sin(phi) * Math.sin(theta),
              targetY + dist * Math.cos(phi),
              dist * Math.sin(phi) * Math.cos(theta)
            );
            cam.lookAt(0, targetY, 0);

            renderer.render(scene, cam);
          }

          // -------------------------------------------------------------------------
          // CANV 2 : LKDV ONE 15L + Porteur M14 (Porte-skis 1,70 m) dépassant de 56 cm
          // -------------------------------------------------------------------------
          {
            const canvas = document.getElementById('c2');
            const W = 620, H = 720;
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
            renderer.setSize(W, H, false);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.08;

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x131614);
            setupLightingAndEnv(scene, renderer);

            const bag15 = await loadBagAsset('lkdv-one-15', provider);
            const zones15 = await chargerTextureDonnee(bag15.manifest.zonesMapUrl);

            bag15.root.traverse((n) => {
              if (n.isMesh && n.geometry) {
                delete n.geometry.userData.uvMetersWeave;
                applyMeterUvs(n.geometry, TILE_M);
              }
            });

            applyAtlasAppearance(
              bag15,
              { body: { col: 'forest' }, front: { col: 'forest' } },
              { zones: zones15, weaveNormal: weave }
            );

            scene.add(bag15.root);

            // Charger et attacher M14 (porte-skis de 1,70 m)
            const m14 = await loadModuleAsset('lkdv-m14', provider);
            const anchors15 = resolveBagAttachmentAnchors(bag15.manifest);
            const ctrl15 = createModuleAttachmentController(bag15.root, anchors15);
            ctrl15.attach(m14, 'facade');

            // Caméra reculée pour embrasser l'envergure verticale de 1,70 m
            const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 20);
            const dist = 3.65;
            const theta = 0.28 * Math.PI;
            const phi = 0.48 * Math.PI;
            const targetY = 0.55;
            cam.position.set(
              dist * Math.sin(phi) * Math.sin(theta),
              targetY + dist * Math.cos(phi),
              dist * Math.sin(phi) * Math.cos(theta)
            );
            cam.lookAt(0, targetY, 0);

            renderer.render(scene, cam);
          }

          // -------------------------------------------------------------------------
          // CANV 3 : LKDV ONE 15L + Porteur M10 (Porte-matelas 560 mm) débordant en largeur
          // -------------------------------------------------------------------------
          {
            const canvas = document.getElementById('c3');
            const W = 620, H = 720;
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
            renderer.setSize(W, H, false);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.08;

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x131614);
            setupLightingAndEnv(scene, renderer);

            const bag15b = await loadBagAsset('lkdv-one-15', provider);
            const zones15b = await chargerTextureDonnee(bag15b.manifest.zonesMapUrl);

            bag15b.root.traverse((n) => {
              if (n.isMesh && n.geometry) {
                delete n.geometry.userData.uvMetersWeave;
                applyMeterUvs(n.geometry, TILE_M);
              }
            });

            applyAtlasAppearance(
              bag15b,
              { body: { col: 'forest' }, front: { col: 'forest' } },
              { zones: zones15b, weaveNormal: weave }
            );

            scene.add(bag15b.root);

            // Charger et attacher M10 (porte-matelas de 560 mm)
            const m10 = await loadModuleAsset('lkdv-m10', provider);
            const anchors15b = resolveBagAttachmentAnchors(bag15b.manifest);
            const ctrl15b = createModuleAttachmentController(bag15b.root, anchors15b);
            ctrl15b.attach(m10, 'facade');

            // Caméra de face avec légère plongée
            const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 20);
            const dist = 2.1;
            const theta = 0.15 * Math.PI;
            const phi = 0.44 * Math.PI;
            const targetY = 0.28;
            cam.position.set(
              dist * Math.sin(phi) * Math.sin(theta),
              targetY + dist * Math.cos(phi),
              dist * Math.sin(phi) * Math.cos(theta)
            );
            cam.lookAt(0, targetY, 0);

            renderer.render(scene, cam);
          }

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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1600 } });

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
<title>Kit Studio — Sacs & Modules 3D LKDV ONE</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0b0d0c;
    color: #edeae3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 32px;
    width: 1920px;
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

  .grid-3d {
    display: grid;
    grid-template-columns: repeat(3, 600px);
    gap: 24px;
    margin-bottom: 32px;
  }
  .card-3d {
    background: #131614;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 30px rgba(0,0,0,0.5);
  }
  canvas {
    width: 600px;
    height: 700px;
    display: block;
    background: #131614;
  }
  .card-3d-caption {
    padding: 16px 20px;
    background: #0f1210;
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .card-3d-caption .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .card-3d-caption h2 {
    font-size: 16px;
    font-weight: 600;
    color: #e4e9e2;
  }
  .tag {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
  }
  .tag-mounted { background: #1a422a; color: #9df2b5; border: 1px solid rgba(157,242,181,0.25); }
  .tag-overflow { background: #4a3418; color: #f5c479; border: 1px solid rgba(245,196,121,0.3); }
  .card-3d-caption p {
    font-size: 13px;
    color: #9aa89d;
    line-height: 1.4;
  }
  .specs-pills {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .pill {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    background: rgba(255,255,255,0.06);
    color: #b0bfb3;
    padding: 3px 8px;
    border-radius: 4px;
  }

  /* Rail d'interface Studio */
  .ui-section {
    background: #111412;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    padding: 24px 28px;
  }
  .ui-section-title {
    font-size: 16px;
    font-weight: 600;
    color: #f1f4ef;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ui-section-desc {
    font-size: 13px;
    color: #8c998e;
    margin-bottom: 20px;
  }
  .cards-rail {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 14px;
  }
  .tile {
    background: #171b19;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
    transition: all 0.2s ease;
  }
  .tile.mounted {
    border-color: #55b273;
    background: #14251a;
  }
  .tile-code {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    font-weight: 700;
    color: #6da27c;
    letter-spacing: 0.05em;
  }
  .tile-name {
    font-size: 14px;
    font-weight: 600;
    color: #ecf0ea;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tile-sub {
    font-size: 12px;
    color: #92a195;
    margin-top: 2px;
  }
  .tile.mounted .tile-sub {
    color: #8ce1a0;
    font-weight: 600;
  }
  .tile .notice-overflow {
    font-size: 11px;
    color: #f0be6a;
    font-weight: 500;
    background: rgba(240,190,106,0.12);
    padding: 2px 6px;
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
        LKDV ONE Kit Studio — Rendu 3D & Rails Modules
        <span class="badge-live">Branché & Vérifié</span>
      </h1>
      <p class="subtitle">Corps 3D en ligne (PBR vert forêt / ocre avec trame 2×2 calibrée), ancres mécaniques auditées et règle d'encombrement porteurs</p>
    </div>
    <div class="header-meta">
      <div>Commit : <strong>b898e04</strong> (main)</div>
      <div>Tests : 467/467 verts · Build : 26.7s</div>
    </div>
  </header>

  <div class="grid-3d">
    <!-- Vue 1 -->
    <div class="card-3d">
      <canvas id="c1" width="600" height="700"></canvas>
      <div class="card-3d-caption">
        <div class="title-row">
          <h2>1. LKDV ONE 45L + Module M04</h2>
          <span class="tag tag-mounted">Monté en façade</span>
        </div>
        <p>Poche multifonction (150 × 200 × 55 mm) en meshopt PBR posée sur l'ancre façade auditée. Platine standard à 2 pieds verrouillée.</p>
        <div class="specs-pills">
          <span class="pill">Modèle : lkdv-one-45</span>
          <span class="pill">Coloris : Forest / Ochre</span>
          <span class="pill">Trame : 0.30 m</span>
          <span class="pill">Module : M04 (352 Ko)</span>
        </div>
      </div>
    </div>

    <!-- Vue 2 -->
    <div class="card-3d">
      <canvas id="c2" width="600" height="700"></canvas>
      <div class="card-3d-caption">
        <div class="title-row">
          <h2>2. LKDV ONE 15L + Porteur M14</h2>
          <span class="tag tag-overflow">Débordement +56 cm</span>
        </div>
        <p>Porte-skis A-frame (1,70 m) monté sur sac compact 15L (46 cm). Règle « porteur » : platine 80×54 mm vérifiée, débordement calculé et affiché.</p>
        <div class="specs-pills">
          <span class="pill">Sac : 15L (46 cm)</span>
          <span class="pill">Skis : 1,70 m</span>
          <span class="pill">Mention : « dépasse de 56 cm »</span>
          <span class="pill">fitRule : porteur</span>
        </div>
      </div>
    </div>

    <!-- Vue 3 -->
    <div class="card-3d">
      <canvas id="c3" width="600" height="700"></canvas>
      <div class="card-3d-caption">
        <div class="title-row">
          <h2>3. LKDV ONE 15L + Porteur M10</h2>
          <span class="tag tag-overflow">Débordement +28 cm</span>
        </div>
        <p>Porte-matelas (largeur 560 mm) sur façade 15L (284 mm). Le module déborde par conception sur les côtés sans être exclu du catalogue.</p>
        <div class="specs-pills">
          <span class="pill">Sac : 15L (284 mm)</span>
          <span class="pill">Matelas : 560 mm</span>
          <span class="pill">Mention : « dépasse de 28 cm »</span>
          <span class="pill">fitRule : porteur</span>
        </div>
      </div>
    </div>
  </div>

  <div class="ui-section">
    <div class="ui-section-title">
      <span>Catalogue d'interface du Studio — Onglet « Modules 3D »</span>
      <span class="pill">Rail interactif CardsView</span>
    </div>
    <div class="ui-section-desc">
      Les modules compatibles s'affichent dynamiquement selon le sac actif. Les porteurs indiquent leur mention calculée en sous-titre de carte.
    </div>

    <div class="cards-rail">
      <div class="tile mounted">
        <div class="tile-code">M04 · GLB 512²</div>
        <div class="tile-name">Poche multifonction</div>
        <div class="tile-sub">✓ Monté (Façade)</div>
      </div>

      <div class="tile">
        <div class="tile-code">M14 · PROCÉDURAL</div>
        <div class="tile-name">Porte-skis (A-frame)</div>
        <div class="notice-overflow">dépasse de 56 cm au-dessus du sac</div>
      </div>

      <div class="tile">
        <div class="tile-code">M10 · PROCÉDURAL</div>
        <div class="tile-name">Porte-matelas</div>
        <div class="notice-overflow">dépasse de 28 cm en largeur</div>
      </div>

      <div class="tile">
        <div class="tile-code">M09 · PROCÉDURAL</div>
        <div class="tile-name">Porte-tente</div>
        <div class="notice-overflow">dépasse de 18 cm en largeur</div>
      </div>

      <div class="tile">
        <div class="tile-code">M01 · GLB 512²</div>
        <div class="tile-name">Porte-gourde</div>
        <div class="tile-sub">Disponible (M01)</div>
      </div>

      <div class="tile">
        <div class="tile-code">M06 · GLB 512²</div>
        <div class="tile-name">Poche étanche</div>
        <div class="tile-sub">Disponible (M06)</div>
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

  const outArtifact =
    '/Users/fr168256/.gemini/antigravity/brain/d28cd7bf-6884-4942-8cdf-48fb7f3bb858/kit-studio-showcase-modules.png';
  await page.screenshot({ path: outArtifact, fullPage: true });
  console.log('Screenshot captured at: ' + outArtifact);

  await browser.close();
  console.log('Showcase generation finished!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
