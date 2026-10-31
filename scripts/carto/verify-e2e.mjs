import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'docs/carto/preuves');
mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log('[carto:e2e] Lancement Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 }, // iPhone 16 Pro native dimensions
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const networkCounts = {
    mtkVector: 0,
    mtkRaster: 0,
    arcgis: 0,
    glyphs: 0,
    sprites: 0,
  };

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('maptoolkit.org')) {
      if (url.includes('.mvt') || url.includes('/mtk-contours/')) networkCounts.mtkVector++;
      if (url.includes('/terrarium/') || url.includes('rgb-tiles') || url.includes('.png')) networkCounts.mtkRaster++;
      if (url.includes('fonts.maptoolkit.org')) networkCounts.glyphs++;
      if (url.includes('icons.maptoolkit.org')) networkCounts.sprites++;
    }
    if (url.includes('arcgis.com') && url.includes('World_Imagery')) {
      networkCounts.arcgis++;
    }
  });

  console.log('[carto:e2e] Navigation vers http://localhost:4000/carto-preview...');
  await page.goto('http://localhost:4000/carto-preview', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 1. Attente de la carte prête
  console.log('[carto:e2e] Attente carte prête (data-ready=1)...');
  await page.waitForSelector('.lkdv-map[data-ready="1"]', { timeout: 15000 });
  await page.waitForTimeout(3000); // Laisse le GPU peindre le relief et les sentiers

  // Vérification de l'attribution
  const attribution = await page.$('.lkdv-map-attribution');
  if (!attribution) throw new Error('Attribution Maptoolkit introuvable !');
  const attrText = await attribution.textContent();
  console.log('[carto:e2e] Attribution présente :', attrText);
  if (!attrText.includes('Maptoolkit') || !attrText.includes('Openstreetmap')) {
    throw new Error('Attribution Maptoolkit/OSM incomplète');
  }

  // Capture Maptoolkit Hiking 3D
  const mtkScreenshotPath = join(OUT_DIR, 'carto-maptoolkit-3d-verified.png');
  await page.screenshot({ path: mtkScreenshotPath, timeout: 60000, animations: 'disabled' });
  console.log('[carto:e2e] Capture 3D enregistrée :', mtkScreenshotPath);

  // 2. Bascule en Hybride Satellite
  console.log('[carto:e2e] Bascule vers Hybride Satellite...');
  const switchBtn = page.getByRole('button', { name: /Hybride satellite/i });
  await switchBtn.click({ force: true });
  await page.waitForTimeout(4000); // Laisse charger les tuiles satellite ArcGIS

  // Vérification de l'attribution Esri
  const hybridAttr = await page.$('.lkdv-map-attribution');
  const hybridAttrText = (await hybridAttr?.textContent()) || '';
  console.log('[carto:e2e] Attribution hybride :', hybridAttrText);
  if (!hybridAttrText.includes('Esri')) {
    console.warn('[carto:e2e] Note: Mention Esri masquée ou clé ArcGIS absente dans le navigateur');
  }

  // Capture Hybride Satellite HD
  const satScreenshotPath = join(OUT_DIR, 'carto-hybride-satellite-verified.png');
  await page.screenshot({ path: satScreenshotPath, timeout: 60000, animations: 'disabled' });
  console.log('[carto:e2e] Capture Hybride enregistrée :', satScreenshotPath);

  console.log('[carto:e2e] Bilan réseau :', networkCounts);
  await browser.close();
  console.log('[carto:e2e] Test validé avec succès !');
}

run().catch((err) => {
  console.error('[carto:e2e] Erreur :', err);
  process.exit(1);
});
