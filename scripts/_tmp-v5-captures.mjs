// Captures V5 + vérifications programmatiques (overflow, clipped, activités,
// tuiles Esri, météo réelle) sur toutes les routes du hub.
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

const { data: mbRow } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();
const { data: tripRow } = mbRow ? { data: mbRow } : await sb.from('trips').select('id,slug,title').order('created_at', { ascending: false }).limit(1).maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortieCookie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: tripRow.id, slug: tripRow.slug, title: tripRow.title }), domain: 'localhost', path: '/', httpOnly: true };
const possCookie = { name: 'lkv_active_adventure', value: b64({ nature: 'possession' }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const results = [];

async function capture(name, { path, viewport, checkScroll = false, cookie = sortieCookie }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'light' });
  await context.addCookies([...authCookies, cookie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
    await page.waitForTimeout(900);
    let checks = null;
    if (checkScroll) {
      checks = await page.evaluate(() => {
        const main = document.querySelector('main#main-content') ?? document.querySelector('main');
        const mainR = main ? main.getBoundingClientRect() : null;
        let maxBottom = 0;
        let clipped = false;
        const inScrollable = (el) => {
          let node = el.parentElement;
          while (node) {
            const cs = getComputedStyle(node);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return true;
            node = node.parentElement;
          }
          return false;
        };
        if (main) {
          for (const c of main.querySelectorAll('a')) {
            const r = c.getBoundingClientRect();
            maxBottom = Math.max(maxBottom, r.bottom);
            if (r.bottom > (mainR ? mainR.bottom : window.innerHeight) + 1 && !inScrollable(c)) clipped = true;
          }
        }
        const bodyText = document.body.innerText;
        return {
          overflow: main ? main.scrollHeight > main.clientHeight : null,
          lastCardBottom: Math.round(maxBottom),
          mainBottom: mainR ? Math.round(mainR.bottom) : null,
          clipped,
          hasActivites: /ACTIVITÉS|Activités/i.test(bodyText),
          hasEsriTiles: document.querySelectorAll('img[src*="arcgisonline"]').length,
          meteoIndisponible: bodyText.includes('Météo indisponible'),
        };
      });
    }
    const shot = `${outDir}/${name}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    results.push({ name, status: 'ok', shot, checks });
  } catch (e) {
    results.push({ name, status: 'ERR', msg: String(e).slice(0, 140) });
  }
  await context.close();
}

await capture('v5-hub-sortie-1440', { path: '/hub', viewport: { width: 1440, height: 900 }, checkScroll: true });
await capture('v5-hub-sortie-1920', { path: '/hub', viewport: { width: 1920, height: 1080 }, checkScroll: true });
await capture('v5-hub-sortie-mobile', { path: '/hub', viewport: { width: 390, height: 844 }, checkScroll: true });
for (const seg of ['itineraire', 'kit-voyage', 'equipage', 'budget', 'documents', 'checklist', 'securite', 'journal', 'export']) {
  await capture(`v5-hub-${seg}`, { path: `/hub/${seg}`, viewport: { width: 1440, height: 900 }, checkScroll: true });
}
await capture('v5-hub-possession', { path: '/hub', viewport: { width: 1440, height: 900 }, checkScroll: true, cookie: possCookie });
await capture('v5-hub-inventaire', { path: '/hub/inventaire', viewport: { width: 1440, height: 900 }, checkScroll: true, cookie: possCookie });

fs.writeFileSync(`${outDir}/v5-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
