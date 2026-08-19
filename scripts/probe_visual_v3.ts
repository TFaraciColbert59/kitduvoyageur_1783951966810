/**
 * LKDV — Mon Matériel v3 : sonde visuelle (styles calculés).
 * Vérifie : fond papier LKDV, liquid glass (blur + blanc translucide), palette
 * sans orange #E4501C, aucun emoji dans les en-têtes de cartes.
 * Lancement : serveur :4028 puis `npx tsx scripts/probe_visual_v3.ts`
 */

import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4028';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'fr-FR' })).newPage();
  await p.goto(`${BASE}/mon-materiel`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);

  const out = await p.evaluate(() => {
    const results: Record<string, string> = {};
    const root = document.querySelector('.fixed.inset-0.w-full') as HTMLElement | null;
    if (root) {
      results.rootBg = getComputedStyle(root).backgroundColor;
    }
    // Fond vidéo animé (object-cover autoplay muted loop playsInline)
    const video = document.querySelector('video[class*="object-cover"]') as HTMLVideoElement | null;
    results.videoPresent = video ? 'oui' : 'non';
    if (video) {
      results.videoAutoplay = String(video.autoplay);
      results.videoMuted = String(video.muted);
      results.videoLoop = String(video.loop);
      results.videoPlaysInline = String(video.playsInline);
      results.videoObjectCover = getComputedStyle(video).objectFit;
      results.videoPoster = video.getAttribute('poster') || '';
    }
    // Overlay forest-soft à 30% (demande mission)
    const overlay = document.querySelector('[data-overlay="forest"]') as HTMLElement | null;
    results.overlayForest = overlay ? getComputedStyle(overlay).backgroundColor : 'absent';
    // Première carte (glass)
    const card = document.querySelector('[class*="lg:grid-cols-3"] > div > div.relative.overflow-hidden') as HTMLElement | null;
    if (card) {
      const cs = getComputedStyle(card);
      results.glassBg = cs.backgroundColor;
      results.glassBlur = cs.backdropFilter || cs.webkitBackdropFilter || '';
    }
    // Aucun orange #E4501C dans les styles en ligne/computés des éléments de la page cockpit
    results.hasOrange = Array.from(document.querySelectorAll('[style*="E4501C"], [class*="E4501C"]')).length > 0 ? 'oui' : 'non';
    // Emojis dans les h2 de cartes
    const h2s = Array.from(document.querySelectorAll('h2'));
    results.emojisInTitles = h2s.some((h) => /[\u{1F300}-\u{1FAFF}]/u.test(h.textContent || '')) ? 'oui' : 'non';
    results.cardTitles = h2s.map((h) => h.textContent?.trim()).filter(Boolean).slice(0, 6).join(' | ');
    return results;
  });

  console.log('VISUAL:', JSON.stringify(out, null, 2));
  await b.close();
})().catch((e) => {
  console.error('VISUAL-ERR', e?.message || e);
  process.exit(1);
});