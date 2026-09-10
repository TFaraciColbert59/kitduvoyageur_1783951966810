import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

const base = 'http://localhost:4000';
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
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await context.addCookies([...authCookies, sortie]);
const page = await context.newPage();
await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
await page.goto(base + '/hub/kit-voyage', { waitUntil: 'networkidle', timeout: 60000 });
await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
await page.waitForTimeout(1000);

const results = {};

const firstCard = page.locator('section[aria-label="Équipement du sac"] li button:visible').first();
results.cardName = (await firstCard.innerText()).split('\n')[0];
await firstCard.click();
await page.waitForTimeout(700);
const toggle = page.locator('[role="dialog"] button', { hasText: 'Marquer comme prêt' }).first();
results.toggleVisible = (await toggle.count()) > 0;
if (results.toggleVisible) {
  await toggle.click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'docs/h-captures/v7-gear-item-panel-390.png' });
}
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
results.memberRows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('section[aria-label="Ressources par sac"] li')).map((el) =>
    el.innerText.replace(/\n/g, ' | ').slice(0, 100),
  ),
);

await page.locator('button[aria-label^="Ce qui manque"]:visible').first().click({ force: true });
await page.waitForTimeout(900);
const cartRow = page.locator('[role="dialog"] li', { hasText: 'Crampons' }).first();
results.cartRowFound = (await cartRow.count()) > 0;
if (results.cartRowFound) {
  const advance = cartRow.locator('button').first();
  results.cartAction = (await advance.innerText()).trim();
  await advance.click();
  await page.waitForTimeout(1600);
}
results.cart = await page.evaluate(() => {
  const raw = localStorage.getItem('kdv_cart');
  return raw ? JSON.parse(raw).map((i) => ({ name: i.name, qty: i.quantity })) : [];
});
await page.screenshot({ path: 'docs/h-captures/v7-gear-cart-390.png' });

console.log(JSON.stringify(results, null, 2));
await context.close();
await browser.close();
process.exit(0);
