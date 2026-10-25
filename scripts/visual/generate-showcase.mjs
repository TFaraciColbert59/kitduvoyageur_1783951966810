import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');
const liquidGlassCss = readFileSync('src/styles/liquid-glass.css', 'utf8');
const mountainBase64 = readFileSync('public/assets/images/mountain-1.jpg').toString('base64');
const mountainDataUrl = 'data:image/jpeg;base64,' + mountainBase64;

const outDir = 'C:/Users/Tony/.gemini/antigravity/brain/8ca85c15-8161-4d6e-87ea-869dc091f120';

const browser = await chromium.launch({ headless: true });

// ── Showcase 1: iPhone 15 Mobile (390 x 844) sur fond photo de montagne ──
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    ${tokensCss}
    ${liquidGlassCss}
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--font-sans); }
    body {
      width: 390px;
      height: 844px;
      background: url('${mountainDataUrl}') center/cover no-repeat;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px;
      position: relative;
      overflow: hidden;
    }
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      padding: 4px 12px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .main-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="status-bar">
    <span>09:41</span>
    <div style="display:flex;gap:6px;align-items:center;">
      <span>5G</span>
      <div style="width:22px;height:11px;border:1px solid #fff;border-radius:3px;padding:1px;">
        <div style="width:80%;height:100%;background:#fff;border-radius:1px;"></div>
      </div>
    </div>
  </div>

  <div class="main-content">
    <!-- Top Pill Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="chip" style="font-weight:600;background:rgba(255,255,255,0.75);">
        <span class="dot"></span> Massif des Écrins · 2 450 m
      </span>
      <button class="glass-circle-btn" style="width:36px;height:36px;background:rgba(255,255,255,0.75);">
        ⚙️
      </button>
    </div>

    <!-- Hero GlassCard (Elevated) -->
    <article class="glass" data-glass-variant="elevated" style="padding:18px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <span class="glass-eyebrow" style="color:var(--lkv-primary-soft);">Étape 3 du Pèlerinage</span>
        <span class="glass-pill">Prêt au départ</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;color:var(--lkv-primary);line-height:1.2;margin-bottom:4px;">
        Traversée des Glaciers Blancs
      </h1>
      <p style="font-size:13px;color:var(--lkv-text-muted);line-height:1.45;margin-bottom:12px;">
        Passage au col matinal recommandé. Sentier balisé, météo clémente prévue jusqu'à 15h.
      </p>

      <!-- Sub card métrique -->
      <div class="glass-sub-card" style="padding:10px 14px;display:flex;justify-content:space-around;text-align:center;margin-bottom:14px;">
        <div>
          <div class="glass-metric" style="font-size:17px;color:var(--lkv-primary);">14.2 km</div>
          <div style="font-size:10px;color:var(--lkv-text-muted);text-transform:uppercase;">Distance</div>
        </div>
        <div style="border-left:1px solid rgba(23,64,44,0.1);"></div>
        <div>
          <div class="glass-metric" style="font-size:17px;color:var(--lkv-primary);">+820 m</div>
          <div style="font-size:10px;color:var(--lkv-text-muted);text-transform:uppercase;">Dénivelé</div>
        </div>
        <div style="border-left:1px solid rgba(23,64,44,0.1);"></div>
        <div>
          <div class="glass-metric" style="font-size:17px;color:var(--lkv-primary);">4 h 30</div>
          <div style="font-size:10px;color:var(--lkv-text-muted);text-transform:uppercase;">Durée</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;">
        <button class="glass-capsule-btn primary" style="flex:2;font-size:13px;height:44px;">
          Lancer le cockpit
        </button>
        <button class="glass-capsule-btn secondary" style="flex:1;font-size:13px;height:44px;">
          Détails
        </button>
      </div>
    </article>

    <!-- Secondary GlassCard (Interactive) -->
    <article class="glass interactive" data-glass-variant="interactive" style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;border-radius:12px;background:rgba(23,64,44,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;">
          🎒
        </div>
        <div>
          <h2 style="font-size:14px;font-weight:700;color:var(--lkv-primary);">Kit Fond de Sac</h2>
          <p style="font-size:11px;color:var(--lkv-text-muted);">8/8 vérifiés · 2.4 kg</p>
        </div>
      </div>
      <span class="glass-pill pill-info" style="font-size:11px;">Complet</span>
    </article>
  </div>

  <!-- Bottom Floating Capsule Dock -->
  <nav class="glass" data-glass-shape="pill" style="padding:6px 14px;display:flex;justify-content:space-around;align-items:center;height:54px;margin-bottom:8px;">
    <button style="background:none;border:none;color:var(--lkv-primary);font-weight:700;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
      <span style="font-size:16px;">🧭</span> Explorer
    </button>
    <button style="background:none;border:none;color:var(--lkv-text-muted);font-weight:500;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
      <span style="font-size:16px;">🗺️</span> Carte
    </button>
    <button style="background:none;border:none;color:var(--lkv-text-muted);font-weight:500;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
      <span style="font-size:16px;">📦</span> Matériel
    </button>
    <button style="background:none;border:none;color:var(--lkv-text-muted);font-weight:500;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
      <span style="font-size:16px;">👤</span> Profil
    </button>
  </nav>
</body>
</html>`;
  await page.setContent(html);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'glass-mobile-showcase.png'), fullPage: true });
  await page.close();
}

// ── Showcase 2: Matrice des 6 Variantes Canoniques ──
{
  const page = await browser.newPage({ viewport: { width: 920, height: 600 }, deviceScaleFactor: 2 });
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    ${tokensCss}
    ${liquidGlassCss}
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--font-sans); }
    body {
      background: linear-gradient(135deg, #DFE8DD 0%, #C4D6C1 50%, #B2C7AF 100%);
      padding: 24px 30px;
      color: var(--lkv-primary);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .header {
      margin-bottom: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="chip" style="margin-bottom:8px;"><span class="dot"></span> Design System Canonique LKDV</span>
    <h1 style="font-size:24px;font-weight:700;">Les 6 Variantes Liquid Glass Apple-Like</h1>
    <p style="font-size:12.5px;color:var(--lkv-primary-soft);margin-top:4px;">Backdrop-filter dynamique · Spéculaire supérieur · Zéro style local par route</p>
  </div>

  <div class="grid">
    <!-- 1. Base -->
    <article class="glass" data-glass-variant="base" style="padding:16px;">
      <span class="glass-eyebrow">Variante 01</span>
      <h2 style="font-size:15px;font-weight:700;margin:4px 0 2px;">Base Standard</h2>
      <p style="font-size:11.5px;color:var(--lkv-text-muted);line-height:1.4;">Surface translucide équilibrée. Fond stone teinté sage, bordure subtile 18% opacité.</p>
      <div style="margin-top:12px;font-size:10.5px;font-family:var(--font-mono);color:var(--lkv-primary-soft);">blur(6px) · sat(115%)</div>
    </article>

    <!-- 2. Elevated -->
    <article class="glass" data-glass-variant="elevated" style="padding:16px;">
      <span class="glass-eyebrow">Variante 02</span>
      <h2 style="font-size:15px;font-weight:700;margin:4px 0 2px;">Elevated</h2>
      <p style="font-size:11.5px;color:var(--lkv-text-muted);line-height:1.4;">Fond plus dense (94%) avec ombre portée profonde. Idéal pour cards héroïques.</p>
      <div style="margin-top:12px;font-size:10.5px;font-family:var(--font-mono);color:var(--lkv-primary-soft);">elevation-3 · rim highlight</div>
    </article>

    <!-- 3. Interactive -->
    <article class="glass interactive" data-glass-variant="interactive" style="padding:16px;">
      <span class="glass-eyebrow">Variante 03</span>
      <h2 style="font-size:15px;font-weight:700;margin:4px 0 2px;">Interactive</h2>
      <p style="font-size:11.5px;color:var(--lkv-text-muted);line-height:1.4;">Microinteraction Apple HIG. Hover -1px, press scale 0.985, outline focus visible.</p>
      <div style="margin-top:12px;"><button class="glass-capsule-btn primary" style="font-size:11px;min-height:36px;">Toucher / Activer</button></div>
    </article>

    <!-- 4. Selected -->
    <article class="glass" data-glass-variant="selected" style="padding:16px;">
      <span class="glass-eyebrow">Variante 04</span>
      <h2 style="font-size:15px;font-weight:700;margin:4px 0 2px;">Selected</h2>
      <p style="font-size:11.5px;color:var(--lkv-text-muted);line-height:1.4;">Double cerclage forêt : border + inset box-shadow 1px. Clarté sans altérer les textes.</p>
      <span class="glass-pill" style="margin-top:10px;">Actif</span>
    </article>

    <!-- 5. Overlay -->
    <article class="glass" data-glass-variant="overlay" style="padding:16px;">
      <span class="glass-eyebrow">Variante 05</span>
      <h2 style="font-size:15px;font-weight:700;margin:4px 0 2px;">Overlay / Modal</h2>
      <p style="font-size:11.5px;color:var(--lkv-text-muted);line-height:1.4;">Flou large 14px pour tiroirs et modales. Protection totale de lecture sur tout arrière-plan.</p>
      <div style="margin-top:12px;font-size:10.5px;font-family:var(--font-mono);color:var(--lkv-primary-soft);">blur(14px) · shadow-overlay</div>
    </article>

    <!-- 6. Critical -->
    <article class="glass" data-glass-variant="critical" style="padding:16px;">
      <span class="glass-eyebrow">Variante 06</span>
      <h2 style="font-size:15px;font-weight:700;margin:4px 0 2px;color:var(--lkv-danger);">Critical / Alerte</h2>
      <p style="font-size:11.5px;color:var(--lkv-text-muted);line-height:1.4;">Bordure d'avertissement terra-cotta conforme charte LKDV. Texte préservé.</p>
      <span class="glass-pill pill-danger" style="margin-top:10px;">Alerte météo col</span>
    </article>
  </div>
</body>
</html>`;
  await page.setContent(html);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'glass-variants-matrix.png'), fullPage: true });
  await page.close();
}

// ── Showcase 3: Panneau sur Carte Topographique SVG ──
{
  const page = await browser.newPage({ viewport: { width: 500, height: 600 }, deviceScaleFactor: 2 });
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    ${tokensCss}
    ${liquidGlassCss}
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--font-sans); }
    body {
      width: 500px;
      height: 600px;
      position: relative;
      overflow: hidden;
    }
    .map {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .overlay-container {
      position: relative;
      z-index: 10;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px;
    }
  </style>
</head>
<body>
  <!-- Topo Map SVG -->
  <svg class="map" viewBox="0 0 500 600" preserveAspectRatio="xMidYMid slice">
    <rect width="500" height="600" fill="#E2EBE0"/>
    <path d="M-50,150 Q120,80 250,160 T550,130" fill="none" stroke="#C2D6BF" stroke-width="24"/>
    <path d="M-50,260 Q180,180 320,290 T550,240" fill="none" stroke="#C2D6BF" stroke-width="20"/>
    <path d="M-50,380 Q150,300 280,410 T550,360" fill="none" stroke="#C2D6BF" stroke-width="28"/>
    <path d="M120,-20 Q240,150 180,320 T260,620" fill="none" stroke="#A8C8D4" stroke-width="16"/>
    <path d="M80,520 Q140,360 250,310 T420,120" fill="none" stroke="#17402C" stroke-width="4" stroke-dasharray="8 6"/>
    <circle cx="250" cy="310" r="12" fill="#17402C" stroke="#fff" stroke-width="4"/>
  </svg>

  <div class="overlay-container">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="chip" style="background:rgba(255,255,255,0.85);font-weight:600;">
        <span class="dot"></span> Échelle 1 : 25 000
      </span>
      <div class="glass-capsule-bar">
        <button class="glass-capsule-segment active">Topo</button>
        <button class="glass-capsule-segment">Satellite</button>
      </div>
    </div>

    <!-- Floating Card Refuge des Mélèzes -->
    <article class="glass" data-glass-variant="overlay" style="padding:20px;box-shadow:var(--glass-shadow-overlay);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <span class="glass-eyebrow">Refuge gardé · 2 180 m</span>
          <h2 style="font-size:18px;font-weight:700;color:var(--lkv-primary);margin:4px 0;">
            Refuge des Mélèzes
          </h2>
        </div>
        <span class="glass-pill">Ouvert</span>
      </div>

      <p style="font-size:12.5px;color:var(--lkv-text-muted);line-height:1.45;margin:8px 0 14px;">
        Étape 2 · Dortoir disponible ce soir (4 places). Point d'eau potable et restauration sur place.
      </p>

      <div style="display:flex;gap:8px;">
        <button class="glass-capsule-btn primary" style="flex:1;height:44px;font-size:13px;">
          Y aller (1.8 km)
        </button>
        <button class="glass-capsule-btn secondary" style="height:44px;font-size:13px;padding:0 14px;">
          📞
        </button>
      </div>
    </article>
  </div>
</body>
</html>`;
  await page.setContent(html);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'glass-map-overlay.png'), fullPage: true });
  await page.close();
}

// ── Showcase 4: Live Glass Lab (/dev/glass) ──
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:4000/dev/glass', { waitUntil: 'networkidle', timeout: 8000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'glass-dev-lab.png'), fullPage: true });
  console.log('Capture live /dev/glass standard réussie.');

  // Activer le mode rdev (LiquidGlass tier="premium")
  const rdevRadio = page.locator('input[name="engine"][value="rdev"]');
  if (await rdevRadio.count() > 0) {
    await rdevRadio.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'glass-dev-lab-rdev.png'), fullPage: true });
    console.log('Capture live /dev/glass rdev réussie.');

    // Zoom sur la carte centrale "Au bord du lac" avec hover pour liseré spéculaire
    const photoCard = page.locator('[data-fixture="voyage"] [data-lab-surface]');
    if (await photoCard.count() > 0) {
      const box = await photoCard.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.25);
        await page.waitForTimeout(400);
        await photoCard.screenshot({ path: path.join(outDir, 'glass-rdev-closeup.png') });
        console.log('Capture closeup rdev réussie.');
      }
    }
  }
  await page.close();
} catch (err) {
  console.warn('Live dev/glass capture skipped or failed:', err.message);
}

await browser.close();
console.log('Toutes les captures ont ete generees dans :', outDir);
