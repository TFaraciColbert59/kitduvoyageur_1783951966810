import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

const base = 'http://localhost:4000';
const outDir = 'docs/h-captures';

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
const { data: group } = await sb.from('travel_groups').select('id,name').limit(1).maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const cookieFor = (payload) => ({ name: 'lkv_active_adventure', value: b64(payload), domain: 'localhost', path: '/', httpOnly: true });
const sortie = cookieFor({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title });
const possession = cookieFor({ nature: 'possession' });
const collectif = group ? cookieFor({ nature: 'collectif', kind: 'groupe', id: group.id, title: group.name }) : null;

const browser = await chromium.launch();
const results = [];

async function shot(name, { path, width, height, cookie = sortie, fullPage = false, actions = null }) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, cookie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
    await page.waitForTimeout(1400);
    if (actions) await actions(page);
    const checks = await page.evaluate(() => ({
      hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      shimmers: document.querySelectorAll('[class*="shimmer"]').length,
    }));
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage });
    results.push({ name, checks });
  } catch (e) {
    results.push({ name, error: String(e).slice(0, 160) });
  }
  await context.close();
}

await shot('v7-final-hub-320', { path: '/hub', width: 320, height: 720 });
await shot('v7-final-hub-390', { path: '/hub', width: 390, height: 844, fullPage: true });
await shot('v7-final-hub-768', { path: '/hub', width: 768, height: 1024 });
await shot('v7-final-hub-1024', { path: '/hub', width: 1024, height: 768 });
await shot('v7-final-hub-1440', { path: '/hub', width: 1440, height: 900 });
await shot('v7-final-map-sheet', {
  path: '/hub',
  width: 390,
  height: 844,
  actions: async (page) => {
    const btn = page.locator('button[aria-label="Agrandir la carte"]:visible').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(900);
    }
  },
});
await shot('v7-final-possession-390', { path: '/hub', width: 390, height: 844, cookie: possession, fullPage: true });
await shot('v7-final-possession-1440', { path: '/hub', width: 1440, height: 900, cookie: possession });
if (collectif) {
  await shot('v7-final-collectif-390', { path: '/hub', width: 390, height: 844, cookie: collectif, fullPage: true });
}
await shot('v7-final-gear-390', { path: '/hub/kit-voyage', width: 390, height: 844, fullPage: true });
await shot('v7-final-gear-768', { path: '/hub/kit-voyage', width: 768, height: 1024 });
await shot('v7-final-gear-1440', { path: '/hub/kit-voyage', width: 1440, height: 900 });
await shot('v7-final-gear-missing', {
  path: '/hub/kit-voyage',
  width: 390,
  height: 844,
  actions: async (page) => {
    const trigger = page.locator('button[aria-label^="Ce qui manque"]:visible').first();
    if (await trigger.count()) {
      await trigger.click({ force: true });
      await page.waitForTimeout(900);
    }
  },
});
await shot('v7-final-gear-item', {
  path: '/hub/kit-voyage',
  width: 390,
  height: 844,
  actions: async (page) => {
    const card = page.locator('section[aria-label="Équipement du sac"] li button:visible').first();
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(800);
    }
  },
});

fs.writeFileSync(`${outDir}/v7-final-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
