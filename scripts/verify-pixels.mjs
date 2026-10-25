/* Vérification pixel : échantillonne le fond réel autour de textes ciblés (sans scroll). */
import { chromium } from 'playwright';

const CASES = [
  { route: '/communaute', vp: 'mobile', texts: ['Votre communauté', 'Carnets de voyage', 'Le voyage se partage.'] },
  { route: '/hub', vp: 'mobile', texts: ['Mon matériel', 'Prochain départ'] },
  { route: '/carnets', vp: 'mobile', texts: ['août 2026'] },
  { route: '/hub/inventaire', vp: 'desktop', texts: ['Poids total', 'Objets'] },
  { route: '/clubs', vp: 'desktop', texts: ['Par Destination'] },
];

const VIEWPORTS = {
  mobile: { width: 430, height: 932 },
  desktop: { width: 1440, height: 900 },
};

const browser = await chromium.launch();

for (const c of CASES) {
  const page = await browser.newPage({ viewport: VIEWPORTS[c.vp] });
  try {
    await page.goto('http://localhost:4000' + c.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('main', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const shot = (await page.screenshot()).toString('base64');
    const results = await page.evaluate(async ({ b64, targets, vw, vh }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const scaleX = img.naturalWidth / vw;
      const scaleY = img.naturalHeight / vh;
      const lum = (rgb) => {
        const f = (v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
      };
      const out = [];
      for (const target of targets) {
        const all = Array.from(document.querySelectorAll('*')).filter((el) => (el.textContent || '').includes(target));
        const el = all.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
        if (!el) { out.push({ target, note: 'absent' }); continue; }
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) { out.push({ target, note: 'hors viewport' }); continue; }
        const x0 = Math.max(0, Math.round((r.left - 4) * scaleX));
        const y0 = Math.max(0, Math.round((r.top - 4) * scaleY));
        const x1 = Math.min(img.naturalWidth, Math.round((r.right + 4) * scaleX));
        const y1 = Math.min(img.naturalHeight, Math.round((r.bottom + 4) * scaleY));
        const w = x1 - x0;
        const h = y1 - y0;
        if (w < 3 || h < 3) { out.push({ target, note: 'trop petit' }); continue; }
        const { data } = ctx.getImageData(x0, y0, w, h);
        let ringSum = [0, 0, 0];
        let ringN = 0;
        let min = 255;
        let max = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const px = [data[i], data[i + 1], data[i + 2]];
            const l = lum(px);
            if (l < min) min = l;
            if (l > max) max = l;
            if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) {
              ringSum = [ringSum[0] + px[0], ringSum[1] + px[1], ringSum[2] + px[2]];
              ringN++;
            }
          }
        }
        const avg = ringSum.map((v) => Math.round(v / ringN));
        out.push({
          target,
          bg: `rgb(${avg})`,
          bgLum: Math.round(lum(avg) * 1000) / 1000,
          lumMin: Math.round(min * 1000) / 1000,
          lumMax: Math.round(max * 1000) / 1000,
          color: getComputedStyle(el).color,
        });
      }
      return out;
    }, { b64: shot, targets: c.texts, vw: VIEWPORTS[c.vp].width, vh: VIEWPORTS[c.vp].height });
    console.log(`\n=== ${c.vp} ${c.route} ===`);
    for (const r of results) {
      if (r.note) { console.log(`  "${r.target}" — ${r.note}`); continue; }
      console.log(`  "${r.target}" textColor=${r.color} bg=${r.bg} lumBg=${r.bgLum} lumMin=${r.lumMin} lumMax=${r.lumMax}`);
    }
  } catch (e) {
    console.log(`\n=== ${c.vp} ${c.route} — erreur ${String(e).slice(0, 120)} ===`);
  }
  await page.close();
}
await browser.close();
