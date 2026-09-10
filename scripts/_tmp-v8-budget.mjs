import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
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
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const results = {};

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
  await page.goto(base + '/hub/budget', { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(1500);
  return { context, page };
}

function blockingInfo(violations) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
}

const mobile = await open(390, 844);
results.mobile = await mobile.page.evaluate(() => {
  const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
  const text = document.body.innerText;
  return {
    hero: visible('section').some((el) => (el.textContent ?? '').includes('Budget du voyage')),
    chips: visible('section[aria-label="Indicateurs budget"] button').length,
    daySlides: visible('section[aria-label="Jour par jour"] li button').length,
    categories: visible('section[aria-label="Répartition par catégorie"] li button').length,
    balances: visible('section[aria-label="Équilibre entre participants"] li').length,
    gauge: visible('button[aria-label^="Budget —"]').length,
    desktopLegacyVisible: text.includes('Prévu (prévisionnel)') && visible('div.hidden.lg\\:block').length > 0,
  };
});
await mobile.page.screenshot({ path: `${outDir}/v8-budget-390.png`, fullPage: true });

results.axeMobile = blockingInfo((await new AxeBuilder({ page: mobile.page }).analyze()).violations);

// Drawer "Toutes les dépenses"
await mobile.page.locator('button[aria-label^="Budget —"]:visible').first().click({ force: true });
await mobile.page.waitForTimeout(800);
results.drawer = await mobile.page.evaluate(() => ({
  open: document.querySelectorAll('[role="dialog"]').length,
  rows: document.querySelectorAll('[role="dialog"] li').length,
  segments: Array.from(document.querySelectorAll('[role="dialog"] [role="tab"]')).map((el) => el.textContent?.trim()),
}));
await mobile.page.screenshot({ path: `${outDir}/v8-budget-drawer-390.png` });
results.axeDrawer = blockingInfo((await new AxeBuilder({ page: mobile.page }).analyze()).violations);

// Ajout d'une dépense réelle (persistance) via le drawer
const addBtn = mobile.page.locator('[role="dialog"] button', { hasText: 'Ajouter une dépense' }).first();
if (await addBtn.count()) {
  await addBtn.click();
  await mobile.page.waitForTimeout(700);
  await mobile.page.locator('input[name="title"]').fill('Vérif budget mobile');
  await mobile.page.locator('input[name="amount"]').fill('12.34');
  await mobile.page
    .locator('button[type="submit"]', { hasText: 'Valider la dépense' })
    .first()
    .click({ force: true });
  await mobile.page.waitForTimeout(1800);
  results.afterAdd = await mobile.page.evaluate(() =>
    document.body.innerText.includes('Vérif budget mobile')
  );
}
await mobile.page.screenshot({ path: `${outDir}/v8-budget-after-add-390.png` });
await mobile.context.close();

// Persistance DB + cleanup
const { data: created } = await sb
  .from('trip_expenses')
  .select('id,title,amount')
  .eq('trip_id', trip.id)
  .eq('title', 'Vérif budget mobile')
  .maybeSingle();
results.persisted = created ?? null;
if (created) {
  await sb.from('trip_expenses').delete().eq('id', created.id);
}

const desktop = await open(1440, 900);
results.desktop = await desktop.page.evaluate(() => ({
  showsKpis: document.body.innerText.includes('Prévu (prévisionnel)'),
  mobileVisible: Array.from(document.querySelectorAll('section')).some((el) =>
    (el.textContent ?? '').includes('Budget du voyage') && el.getBoundingClientRect().height > 0
  ),
}));
await desktop.page.screenshot({ path: `${outDir}/v8-budget-1440.png` });
await desktop.context.close();

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
