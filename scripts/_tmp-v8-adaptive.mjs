import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}
let savedCookies = [];
const sb = createServerClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  cookies: { getAll: () => savedCookies, setAll: (cs) => { savedCookies = cs; } },
});
await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });
const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const results = {};
for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  await page.goto('http://localhost:4000/hub/kit-voyage', { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(1600);

  const counts = async () =>
    page.evaluate(() => ({
      shopBox: document.querySelectorAll('button[aria-label^="Ajouter"][aria-label$="à mon matériel"]').length,
      inventoryPlus: document.querySelectorAll('button[aria-label^="Ajouter"][aria-label$="au sac"]').length,
      bagCross: document.querySelectorAll('button[aria-label="Retirer du sac"]').length,
      stockBadges: Array.from(document.querySelectorAll('span')).filter((el) => el.textContent === '×3 en stock' || (el.textContent ?? '').includes('en stock')).length,
    }));

  results[`gear${width}Before`] = await counts();
  await page.screenshot({ path: `docs/h-captures/v8-gear-${width}.png`, fullPage: width === 390 });

  if (width === 390) {
    const shop = page.locator('button[aria-label^="Ajouter"][aria-label$="à mon matériel"]:visible').first();
    if (await shop.count()) {
      const label = await shop.getAttribute('aria-label');
      await shop.click();
      await page.waitForTimeout(2200);
      results.shopClicked = label;
      results.gear390After = await counts();
      await page.screenshot({ path: 'docs/h-captures/v8-gear-after-material.png', fullPage: true });

      const plus = page.locator('button[aria-label^="Ajouter"][aria-label$="au sac"]:visible').first();
      if (await plus.count()) {
        results.plusClicked = await plus.getAttribute('aria-label');
        await plus.click();
        await page.waitForTimeout(1800);
        results.afterAddToBag = await counts();
      }
    }
  }
  await context.close();
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
