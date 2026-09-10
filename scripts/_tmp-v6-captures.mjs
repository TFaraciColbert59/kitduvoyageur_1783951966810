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

const { data: tripRow } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();
const { data: groupRow } = await sb.from('travel_groups').select('id,name').limit(1).maybeSingle();
const { data: crewRow } = await sb.from('crews').select('id,name').limit(1).maybeSingle();

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const cookieFor = (payload) => ({ name: 'lkv_active_adventure', value: b64(payload), domain: 'localhost', path: '/', httpOnly: true });
const sortieCookie = cookieFor({ nature: 'sortie', id: tripRow.id, slug: tripRow.slug, title: tripRow.title });
const possCookie = cookieFor({ nature: 'possession' });
const groupCookie = groupRow ? cookieFor({ nature: 'collectif', kind: 'groupe', id: groupRow.id, title: groupRow.name }) : null;
const crewCookie = crewRow ? cookieFor({ nature: 'collectif', kind: 'equipage', id: crewRow.id, title: crewRow.name }) : null;

const browser = await chromium.launch();
const results = [];

async function capture(name, { path, viewport, cookie = sortieCookie, fullPage = false, expandMap = false }) {
  if (!cookie) {
    results.push({ name, status: 'SKIP', msg: 'aucune donnée demo' });
    return;
  }
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'light' });
  await context.addCookies([...authCookies, cookie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
    await page.waitForTimeout(1100);

    if (expandMap) {
      const btn = page.locator('button', { hasText: 'Carte' }).first();
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(900);
      }
    }

    const checks = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        tiles: document.querySelectorAll('section[aria-label] a[href^="/hub"], aside a[href^="/hub"]').length,
        chips: document.querySelectorAll('section[aria-label="Informations clés"] li').length,
        carouselCards: document.querySelectorAll('section[aria-label="Sections de l’aventure"] li').length,
        esriTiles: document.querySelectorAll('img[src*="arcgisonline"]').length,
        hasMoment: /AUJOURD|DÉPART|Prochain départ|Vie du groupe|Équipage|Départ|Bilan/i.test(text),
        hasNextAction: text.includes('PROCHAINE ACTION') || text.includes('À JOUR'),
        hasNoRoute: text.includes('Trace non géolocalisée'),
      };
    });
    const shot = `${outDir}/${name}.png`;
    await page.screenshot({ path: shot, fullPage });
    results.push({ name, status: 'ok', shot, checks });
  } catch (e) {
    results.push({ name, status: 'ERR', msg: String(e).slice(0, 160) });
  }
  await context.close();
}

await capture('v6-hub-sortie-320', { path: '/hub', viewport: { width: 320, height: 720 } });
await capture('v6-hub-sortie-390', { path: '/hub', viewport: { width: 390, height: 844 } });
await capture('v6-hub-sortie-390-full', { path: '/hub', viewport: { width: 390, height: 844 }, fullPage: true });
await capture('v6-hub-sortie-428', { path: '/hub', viewport: { width: 428, height: 926 } });
await capture('v6-hub-sortie-768', { path: '/hub', viewport: { width: 768, height: 1024 } });
await capture('v6-hub-sortie-1024', { path: '/hub', viewport: { width: 1024, height: 768 } });
await capture('v6-hub-sortie-1440', { path: '/hub', viewport: { width: 1440, height: 900 } });
await capture('v6-hub-sortie-map-sheet', { path: '/hub', viewport: { width: 390, height: 844 }, expandMap: true });
await capture('v6-hub-possession-390', { path: '/hub', viewport: { width: 390, height: 844 }, cookie: possCookie, fullPage: true });
await capture('v6-hub-possession-1440', { path: '/hub', viewport: { width: 1440, height: 900 }, cookie: possCookie });
await capture('v6-hub-collectif-390', { path: '/hub', viewport: { width: 390, height: 844 }, cookie: groupCookie, fullPage: true });
await capture('v6-hub-collectif-1440', { path: '/hub', viewport: { width: 1440, height: 900 }, cookie: groupCookie });
await capture('v6-hub-equipage-390', { path: '/hub', viewport: { width: 390, height: 844 }, cookie: crewCookie });
for (const seg of ['itineraire', 'checklist', 'budget']) {
  await capture(`v6-hub-${seg}-390`, { path: `/hub/${seg}`, viewport: { width: 390, height: 844 } });
}

fs.writeFileSync(`${outDir}/v6-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
