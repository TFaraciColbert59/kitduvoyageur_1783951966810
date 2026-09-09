// Captures V3 + vérification programmatique du no-scroll plein écran.
import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

const base = process.env.LKDV_BASE || 'http://localhost:4000';
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
const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
let savedCookies = [];
const sb = createServerClient(url, anonKey, {
  cookies: { getAll: () => savedCookies, setAll: (cs) => { savedCookies = cs; } },
});
await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });
const { data: tripRow } = await sb.from('trips').select('id,slug,title').order('created_at', { ascending: false }).limit(1).maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const adventureCookie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: tripRow.id, slug: tripRow.slug, title: tripRow.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const results = [];

async function capture(name, { path, viewport, checkScroll = false, cookie = adventureCookie }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'light' });
  await context.addCookies([...authCookies, cookie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
    await page.waitForTimeout(600);
    let scroll = null;
    if (checkScroll) {
      scroll = await page.evaluate(() => {
        const main = document.querySelector('main#main-content') ?? document.querySelector('main');
        if (!main) return null;
        const mainR = main.getBoundingClientRect();
        const cards = [...main.querySelectorAll('a')];
        let maxBottom = 0;
        for (const c of cards) maxBottom = Math.max(maxBottom, c.getBoundingClientRect().bottom);
        return {
          scrollH: main.scrollHeight,
          clientH: main.clientHeight,
          overflow: main.scrollHeight > main.clientHeight,
          lastCardBottom: Math.round(maxBottom),
          mainBottom: Math.round(mainR.bottom),
          clipped: maxBottom > mainR.bottom + 1,
        };
      });
    }
    const shot = `${outDir}/${name}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    results.push({ name, status: 'ok', shot, scroll });
  } catch (e) {
    results.push({ name, status: 'ERR', msg: String(e).slice(0, 140) });
  }
  await context.close();
}

await capture('v3-hub-1440x900', { path: '/hub', viewport: { width: 1440, height: 900 }, checkScroll: true });
await capture('v3-hub-1920x1080', { path: '/hub', viewport: { width: 1920, height: 1080 }, checkScroll: true });
await capture('v3-hub-mobile', { path: '/hub', viewport: { width: 390, height: 844 }, checkScroll: true });
const possCookie = { name: 'lkv_active_adventure', value: b64({ nature: 'possession' }), domain: 'localhost', path: '/', httpOnly: true };
await capture('v3-hub-possession', { path: '/hub', viewport: { width: 1440, height: 900 }, checkScroll: true, cookie: possCookie });

fs.writeFileSync(`${outDir}/v3-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
