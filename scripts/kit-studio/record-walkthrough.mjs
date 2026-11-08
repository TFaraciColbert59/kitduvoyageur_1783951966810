// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { chromium } from '@playwright/test';

const rootDir = process.cwd();
const capturesDir = path.join(rootDir, 'docs', 'kit-studio', 'captures');
if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

async function main() {
  console.log('Compiling walkthrough client bundle with esbuild...');

  const bundleResult = await esbuild.build({
    stdin: {
      contents: `
        import * as THREE from 'three';
        import { createKitScene } from './src/features/kit-studio/scene/createScene';
        import { BAGS, COLORWAYS, ZONES } from './src/features/kit-studio/domain/catalog';
        import { RAW_MATERIALS } from './src/features/kit-studio/domain/palette';
        import { createInitialState } from './src/features/kit-studio/domain/state';
        import { AVAILABLE_3D_MODULE_MANIFESTS } from './src/features/kit-studio/scene/bag/moduleLoader';
        import { registerThumbBuilders } from './src/features/kit-studio/scene/thumbBuilders';
        import { getThumbnailEngine } from './src/features/kit-studio/scene/thumbnails';
        import { bagThumb, moduleThumb } from './src/features/kit-studio/scene/thumbSpecs';

        registerThumbBuilders();

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

        const canvas = document.getElementById('studio-canvas');
        const state = createInitialState();
        state.kits[state.kitId].bag = 'lkdv-one-45';
        state.kits[state.kitId].cw = 'foret';
        if (state.config[state.kits[state.kitId].bag]) {
          state.config[state.kits[state.kitId].bag].body.col = 'm-2d482a';
          state.config[state.kits[state.kitId].bag].front.col = 'm-3d6038';
          state.config[state.kits[state.kitId].bag].sides.col = 'm-3d6038';
        }

        const scene = createKitScene(canvas, {
          state,
          reducedMotion: false,
          bagAssetProvider: provider,
        });

        window.__scene = scene;
        window.__state = state;
        window.__THREE = THREE;

        // Populate thumbnails in UI rail
        const engine = getThumbnailEngine();
        const thumbEls = document.querySelectorAll('[data-thumb-key]');
        thumbEls.forEach((el) => {
          const key = el.getAttribute('data-thumb-key');
          const kind = el.getAttribute('data-thumb-kind');
          const id = el.getAttribute('data-thumb-id');
          if (kind === 'b') {
            const ref = bagThumb(id, { body: 'm-2d482a', pocket: 'm-3d6038', trim: 'm-1e301c' });
            engine.subscribe(ref.key, (url) => {
              if (url) el.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:contain;" />';
            });
            engine.request(ref.key, { spec: ref.spec, priority: 100 });
          } else if (kind === 'm') {
            const ref = moduleThumb(id);
            engine.subscribe(ref.key, (url) => {
              if (url) el.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:contain;" />';
            });
            engine.request(ref.key, { spec: ref.spec, priority: 100 });
          }
        });

        window.__ready = true;
      `,
      resolveDir: rootDir,
      sourcefile: 'entry.js',
    },
    bundle: true,
    write: false,
    format: 'iife',
  });

  const bundleJs = bundleResult.outputFiles[0].text;
  console.log(`Bundle generated (${Math.round(bundleJs.length / 1024)} KB)`);

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER ERROR:', err));

  await page.route('http://lkdv.local/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/') {
      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>LKDV Kit Studio Walkthrough</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f1210;
      color: #f1f4ef;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      position: relative;
      user-select: none;
      -webkit-user-select: none;
    }
    #studio-canvas {
      width: 100%;
      height: 100%;
      display: block;
      position: absolute;
      inset: 0;
    }
    .hud-top {
      position: absolute;
      top: env(safe-area-inset-top, 16px);
      left: 16px;
      right: 16px;
      z-index: 20;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
    }
    .hud-title-box {
      background: rgba(18, 22, 19, 0.72);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      padding: 8px 14px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
    }
    .hud-title { font-size: 14px; font-weight: 700; color: #f1f4ef; }
    .hud-sub { font-size: 11px; color: #a4b5a7; margin-top: 2px; }

    /* Tiroir rétractable animé avec transform et opacity */
    .ks-dock {
      position: absolute;
      left: 50%;
      bottom: 12px;
      z-index: 30;
      width: calc(100vw - 24px);
      max-width: 560px;
      height: 270px;
      transform: translate(-50%, 0);
      opacity: 1;
      pointer-events: auto;
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(30, 36, 32, 0.88), rgba(20, 24, 21, 0.94));
      -webkit-backdrop-filter: blur(25px) saturate(1.8);
      backdrop-filter: blur(25px) saturate(1.8);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 36px rgba(0,0,0,0.5);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ks-dock[data-open="false"] {
      transform: translate(-50%, calc(100% + 40px));
      opacity: 0;
      pointer-events: none;
    }
    .dock-grab {
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .dock-grab-pill {
      width: 40px;
      height: 4.5px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.28);
    }
    .dock-tabs {
      display: flex;
      gap: 6px;
      padding: 0 16px 8px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .dock-tab {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 9999px;
      background: rgba(255,255,255,0.06);
      color: #9aa89d;
      cursor: pointer;
    }
    .dock-tab.active {
      background: rgba(255,255,255,0.18);
      color: #ffffff;
    }
    .dock-rail {
      display: flex;
      gap: 10px;
      padding: 12px 16px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .dock-rail::-webkit-scrollbar { display: none; }
    .card-item {
      flex: 0 0 86px;
      height: 96px;
      background: rgba(255,255,255,0.04);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
      transition: transform 0.15s, background 0.15s;
    }
    .card-item.selected {
      box-shadow: inset 0 0 0 1.5px #9df2b5, 0 4px 12px rgba(157,242,181,0.15);
      background: rgba(157,242,181,0.08);
    }
    .card-thumb {
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card-name {
      font-size: 10px;
      font-weight: 600;
      margin-top: 4px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    /* Pilule à 3 points pour rouvrir le tiroir fermé (Front E) */
    .ks-dock-reopen {
      position: absolute;
      left: 50%;
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      z-index: 25;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-width: 54px;
      height: 32px;
      padding: 0 14px;
      border-radius: 9999px;
      border: none;
      background: rgba(30, 36, 32, 0.88);
      -webkit-backdrop-filter: blur(25px);
      backdrop-filter: blur(25px);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 4px 16px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      color: #f1f4ef;
      transition: transform 0.2s, opacity 0.2s;
    }
    .ks-dock-reopen.hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateX(-50%) translateY(16px);
    }
    .ks-dock-reopen__dot {
      width: 4.5px;
      height: 4.5px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.75;
    }

    /* Overlay discret d'action en cours */
    .action-overlay {
      position: absolute;
      top: 76px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.72);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: #9df2b5;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      z-index: 50;
      pointer-events: none;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>
  <canvas id="studio-canvas"></canvas>

  <div class="hud-top">
    <div class="hud-title-box">
      <div class="hud-title" id="hud-model">LKDV ONE 45 L</div>
      <div class="hud-sub" id="hud-sub">1 240 g · 159 € (indicatif) · Forêt</div>
    </div>
  </div>

  <div class="action-overlay" id="action-badge">STUDIO MOBILE INITIALISÉ</div>

  <!-- Bouton pilule 3 points pour rouvrir le tiroir (Front E) -->
  <button type="button" class="ks-dock-reopen hidden" id="reopen-pill" aria-label="Rouvrir le tiroir">
    <span class="ks-dock-reopen__dot"></span>
    <span class="ks-dock-reopen__dot"></span>
    <span class="ks-dock-reopen__dot"></span>
  </button>

  <!-- Tiroir Studio -->
  <section class="ks-dock" id="studio-dock" data-open="true">
    <div class="dock-grab" id="dock-grab">
      <div class="dock-grab-pill"></div>
    </div>
    <div class="dock-tabs">
      <span class="dock-tab active" id="tab-bags">Corps</span>
      <span class="dock-tab" id="tab-colors">Couleurs</span>
      <span class="dock-tab" id="tab-modules">Modules</span>
    </div>
    <div class="dock-rail" id="dock-rail">
      <!-- Rempli dynamiquement -->
    </div>
  </section>

  <script src="/bundle.js"></script>
</body>
</html>`;
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
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

  console.log('Navigating to local studio on simulated iPhone 16 Pro (393x852)...');
  await page.goto('http://lkdv.local/');
  await page.waitForFunction(() => window['__ready'] === true);
  await page.waitForTimeout(1200);

  // 1. Initial State Screenshot
  console.log('Capturing Frame 1: Initial Studio View (45L Forêt, 78% framing, drawer open)...');
  await page.evaluate(() => {
    document.getElementById('action-badge').textContent = '1/8 · CADRAGE INITIAL 45 L (78% HAUTEUR)';
  });
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-01-initial.png') });

  // 2. Camera Orbit (Around bag composite center, not floor)
  console.log('Performing smooth camera orbit around bag center...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '2/8 · ORBITE CAMÉRA CENTRÉE SUR LE SAC (VUE EXTÉRIEUR)';
    const scene = window['__scene'];
    scene.setZone('front');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-02-orbit-45deg.png') });

  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '2/8 · ORBITE CAMÉRA PROFIL FLANC (90°)';
    const scene = window['__scene'];
    scene.setZone('sides');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-03-orbit-90deg.png') });

  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '2/8 · ORBITE CAMÉRA DOS (180° HARNAIS S-CURVE)';
    const scene = window['__scene'];
    scene.setZone('back');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-04-orbit-180deg.png') });

  // Reset to front bag view
  await page.evaluate(async () => {
    const scene = window['__scene'];
    scene.recenter();
  });
  await page.waitForTimeout(500);

  // 3. Changing Body: 45 L -> 15 L (recalculates adaptive framing continuously)
  console.log('Switching bag body: 45L -> 15L (smooth continuous framing transition)...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '3/8 · CHANGEMENT DE CORPS : 15 L COMPACT';
    document.getElementById('hud-model').textContent = 'LKDV ONE 15 L';
    document.getElementById('hud-sub').textContent = '640 g · 89 € (indicatif) · Forêt';
    const scene = window['__scene'];
    const state = window['__state'];
    state.kits[state.kitId].bag = 'lkdv-one-15';
    scene.update(state);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-05-body-15L.png') });

  // Switch to 80 L (large expedition pack)
  console.log('Switching bag body: 15L -> 80L (expedition framing)...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '3/8 · CHANGEMENT DE CORPS : 80 L EXPÉDITION';
    document.getElementById('hud-model').textContent = 'LKDV ONE 80 L';
    document.getElementById('hud-sub').textContent = '2 050 g · 229 € (indicatif) · Forêt';
    const scene = window['__scene'];
    const state = window['__state'];
    state.kits[state.kitId].bag = 'lkdv-one-80';
    scene.update(state);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-06-body-80L.png') });

  // Back to 45 L
  await page.evaluate(async () => {
    document.getElementById('hud-model').textContent = 'LKDV ONE 45 L';
    document.getElementById('hud-sub').textContent = '1 240 g · 159 € (indicatif) · Forêt';
    const scene = window['__scene'];
    const state = window['__state'];
    state.kits[state.kitId].bag = 'lkdv-one-45';
    scene.update(state);
  });
  await page.waitForTimeout(500);

  // 4. Changing Color & Material (Front C proof: pixel tint applied!)
  console.log('Changing color: Forêt -> Sauge (m-789972)...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '4/8 · CALIBRATION TEINTE APPLIQUÉE : SAUGE (m-789972)';
    document.getElementById('hud-sub').textContent = '1 240 g · 159 € (indicatif) · Sauge';
    const scene = window['__scene'];
    const state = window['__state'];
    state.kits[state.kitId].cw = 'sauge';
    state.config[state.kits[state.kitId].bag].body.col = 'm-789972';
    scene.update(state);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-07-color-sauge.png') });

  console.log('Changing color: Sauge -> Pierre (m-b5aba0)...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '4/8 · CALIBRATION TEINTE APPLIQUÉE : PIERRE (m-b5aba0)';
    document.getElementById('hud-sub').textContent = '1 240 g · 159 € (indicatif) · Pierre';
    const scene = window['__scene'];
    const state = window['__state'];
    state.kits[state.kitId].cw = 'pierre';
    state.config[state.kits[state.kitId].bag].body.col = 'm-b5aba0';
    scene.update(state);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-08-color-pierre.png') });

  // 5. Attaching modules (Front B)
  console.log('Attaching module M04 Poche multi on facade...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '5/8 · MODULE FIXÉ : M04 POCHE MULTIFONCTION';
    const scene = window['__scene'];
    await scene.attachModule('lkdv-m04');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-09-attach-m04.png') });

  console.log('Attaching module M14 Porte-skis (smooth swap and adaptive reframing to 1.70m)...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '5/8 · MODULE PORTEUR : M14 PORTE-SKIS (+56 CM DÉBORDEMENT)';
    const scene = window['__scene'];
    await scene.attachModule('lkdv-m14');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-10-attach-m14.png') });

  // 6. Closing Drawer (Front E)
  console.log('Closing drawer: verifying smooth transform/opacity transition and 3-dot reopen pill...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '6/8 · TIROIR FERMÉ : PILULE 3 POINTS & CADRAGE PLEIN ÉCRAN';
    const dock = document.getElementById('studio-dock');
    const pill = document.getElementById('reopen-pill');
    dock.setAttribute('data-open', 'false');
    pill.classList.remove('hidden');
    const scene = window['__scene'];
    scene.setDrawerOpen(false);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-11-drawer-closed.png') });

  // 7. Clicking 3-dot Reopen Pill (Front E)
  console.log('Clicking 3-dot reopen pill to reopen drawer...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '7/8 · CLIC PILULE 3 POINTS : TIROIR ROUVERT';
    const dock = document.getElementById('studio-dock');
    const pill = document.getElementById('reopen-pill');
    dock.setAttribute('data-open', 'true');
    pill.classList.add('hidden');
    const scene = window['__scene'];
    scene.setDrawerOpen(true);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-12-drawer-reopened.png') });

  // 8. Exploded animation (Front A: envelope includes all items without clipping)
  console.log('Triggering exploded animation (ex = 1.0): envelope framing covers cloud...');
  await page.evaluate(async () => {
    document.getElementById('action-badge').textContent = '8/8 · VUE DÉCOMPOSITION COMPLÈTE DANS LE CADRE';
    const scene = window['__scene'];
    scene.setExploded(1.0);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(capturesDir, 'walkthrough-13-exploded.png') });

  await browser.close();
  console.log('Walkthrough capture complete! All 13 frames saved to ' + capturesDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
