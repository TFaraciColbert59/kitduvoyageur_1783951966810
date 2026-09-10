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
let savedCookies = [];
const sb = createServerClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  cookies: { getAll: () => savedCookies, setAll: (cs) => { savedCookies = cs; } },
});
await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });
const { data: trip } = await sb
  .from('trips')
  .select('id,slug,title')
  .eq('slug', 'tour-mont-blanc-refuge')
  .maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const results = {};

async function open(width, height, path) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: 'light' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(1000);
  return { context, page };
}

const hub = await open(390, 844, '/hub');
results.hub = await hub.page.evaluate(() => {
  const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
  const visibleText = document.body.innerText;
  const tiles = visible('section[aria-label="Sections de l’aventure"] li a');
  const chips = visible('section[aria-label="Informations clés"] li a');
  const moment = document.querySelector('section[aria-label^="Étape"]') ?? document.querySelector('section[aria-label^="Bilan"]') ?? document.querySelector('section[aria-label^="Départ"]');
  return {
    hasEnLigne: visibleText.includes('EN LIGNE'),
    hasH1: visible('h1').length,
    tiles: tiles.length,
    tileTextSample: tiles.slice(0, 3).map((t) => t.innerText.trim()),
    chipLinks: chips.length,
    momentGlass: moment ? moment.querySelectorAll('.glass').length : -1,
    roundButtons: moment ? moment.querySelectorAll('button[aria-label="Agrandir la carte"], a[aria-label], button').length : -1,
  };
});
await hub.page.screenshot({ path: `${outDir}/v7-hub-390.png`, fullPage: true });
const expand = hub.page.locator('button[aria-label="Agrandir la carte"]:visible').first();
if (await expand.count()) {
  await expand.click();
  await hub.page.waitForTimeout(900);
  results.mapSheet = await hub.page.evaluate(() => ({
    dialog: document.querySelectorAll('[role="dialog"]').length,
    title: document.querySelector('[role="dialog"]')?.textContent?.slice(0, 60) ?? null,
    mapTiles: document.querySelectorAll('[role="dialog"] img[src*="arcgisonline"]').length,
  }));
  await hub.page.screenshot({ path: `${outDir}/v7-map-sheet-390.png` });
}
await hub.context.close();

const gear = await open(390, 844, '/hub/kit-voyage');
results.gear = await gear.page.evaluate(() => {
  const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
  return {
    cards: visible('section[aria-label="Équipement du sac"] li button').length,
    cardImg: visible('section[aria-label="Équipement du sac"] img').length,
    infoCards: visible('section[aria-label="Infos du sac"] li button').length,
    members: visible('section[aria-label="Ressources par sac"] li').length,
    trigger: visible('button[aria-label^="Ce qui manque"]').length,
    fullList: visible('#gear-full-list').length,
  };
});
await gear.page.screenshot({ path: `${outDir}/v7-gear-390.png`, fullPage: true });

if (results.gear.trigger > 0) {
  await gear.page.locator('button[aria-label^="Ce qui manque"]:visible').first().click();
  await gear.page.waitForTimeout(900);
  results.missingBefore = await gear.page.evaluate(() => {
    const row = document.querySelector('[role="dialog"] ul li');
    return row ? row.innerText.replace(/\n/g, ' | ').slice(0, 140) : null;
  });
  await gear.page.screenshot({ path: `${outDir}/v7-gear-missing-390.png` });
  const action = gear.page.locator('[role="dialog"] ul li button').first();
  if (await action.count()) {
    await action.click();
    await gear.page.waitForTimeout(1600);
    results.missingAfterClick = await gear.page.evaluate(() => {
      const row = document.querySelector('[role="dialog"] ul li');
      return row ? row.innerText.replace(/\n/g, ' | ').slice(0, 140) : null;
    });
    await gear.page.reload({ waitUntil: 'networkidle' });
    await gear.page.waitForTimeout(1200);
    results.missingAfterReload = await gear.page.evaluate(() => {
      const trigger = document.querySelector('button[aria-label^="Ce qui manque"]');
      if (trigger) trigger.click();
      return null;
    });
    await gear.page.waitForTimeout(900);
    results.missingPersisted = await gear.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[role="dialog"] ul li')).slice(0, 3);
      return rows.map((r) => r.innerText.replace(/\n/g, ' | ').slice(0, 120));
    });
    await gear.page.screenshot({ path: `${outDir}/v7-gear-missing-persisted-390.png` });
  }
}
await gear.context.close();

const desktop = await open(1440, 900, '/hub/kit-voyage');
results.gearDesktop = await desktop.page.evaluate(() => ({
  mobileExperienceVisible: Array.from(document.querySelectorAll('section[aria-label="Équipement du sac"]')).some((el) => el.getBoundingClientRect().height > 0),
  topGlass: document.querySelectorAll('main .glass').length,
}));
await desktop.page.screenshot({ path: `${outDir}/v7-gear-1440.png` });
await desktop.context.close();

const hubDesktop = await open(1440, 900, '/hub');
await hubDesktop.page.screenshot({ path: `${outDir}/v7-hub-1440.png` });
await hubDesktop.context.close();

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
