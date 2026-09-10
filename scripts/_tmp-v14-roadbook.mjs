import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const base = 'http://localhost:4000';
const outDir = 'docs/h-captures';
const V14 = 'V14 ';

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const ADMIN_URL = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const admin = createClient(ADMIN_URL, readEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

let savedCookies = [];
const sb = createServerClient(ADMIN_URL, readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  cookies: { getAll: () => savedCookies, setAll: (cs) => { savedCookies = cs; } },
});
const { data: auth } = await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });
const userId = auth.user.id;
const { data: trip } = await sb
  .from('trips')
  .select('id,slug,title,start_date')
  .eq('slug', 'tour-mont-blanc-refuge')
  .maybeSingle();

const seeded = { steps: [], pois: [], items: [], expenses: [] };
const results = {};

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  const dayIso = trip.start_date;

  const { data: steps, error: stepErr } = await admin
    .from('trip_steps')
    .insert([
      {
        trip_id: trip.id,
        day_number: 1,
        order_index: 90,
        title: `${V14}Taxi gare → refuge`,
        location_name: 'Gare de Chamonix',
        latitude: 45.923,
        longitude: 6.869,
        transport_mode: 'car',
        start_time: '14:20:00',
      },
      {
        trip_id: trip.id,
        day_number: 1,
        order_index: 91,
        title: `${V14}Dîner au refuge`,
        accommodation_name: 'Refuge V14',
        transport_mode: 'other',
        start_time: '19:30:00',
      },
    ])
    .select('id,title');
  if (stepErr) throw new Error(`seed steps: ${stepErr.message}`);
  seeded.steps = steps.map((s) => s.id);

  const { data: pois, error: poiErr } = await admin
    .from('trip_pois')
    .insert([
      {
        trip_id: trip.id,
        step_id: steps[0].id,
        name: `${V14}Source du berger`,
        category: 'water',
        latitude: 45.925,
        longitude: 6.872,
        notes: 'Eau potable à la fontaine',
      },
    ])
    .select('id');
  if (poiErr) throw new Error(`seed pois: ${poiErr.message}`);
  seeded.pois = pois.map((p) => p.id);

  const { data: items, error: itemErr } = await admin
    .from('trip_items')
    .insert([
      {
        trip_id: trip.id,
        item_name: `${V14}Crampons`,
        category: 'misc',
        quantity: 1,
        day_number: 1,
        is_packed: false,
      },
    ])
    .select('id');
  if (itemErr) throw new Error(`seed items: ${itemErr.message}`);
  seeded.items = items.map((i) => i.id);

  const { data: expenses, error: expErr } = await admin
    .from('trip_expenses')
    .insert([
      {
        trip_id: trip.id,
        payer_id: userId,
        title: `${V14}Taxi`,
        amount: 37,
        currency: 'EUR',
        category: 'transport',
        expense_date: dayIso,
        is_planned: false,
      },
    ])
    .select('id');
  if (expErr) throw new Error(`seed expenses: ${expErr.message}`);
  seeded.expenses = expenses.map((e) => e.id);
}

async function cleanup() {
  await admin.from('trip_pois').delete().eq('trip_id', trip.id).like('name', `${V14}%`);
  for (const id of seeded.pois) await admin.from('trip_pois').delete().eq('id', id);
  for (const id of seeded.steps) await admin.from('trip_steps').delete().eq('id', id);
  await admin.from('trip_steps').delete().eq('trip_id', trip.id).like('title', `${V14}%`);
  for (const id of seeded.items) await admin.from('trip_items').delete().eq('id', id);
  for (const id of seeded.expenses) await admin.from('trip_expenses').delete().eq('id', id);
}

function blockingInfo(violations) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const browser = await chromium.launch();

async function open(width, height, url = '/hub/itineraire') {
  const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false }));
  const sortie = {
    name: 'lkv_active_adventure',
    value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }),
    domain: 'localhost',
    path: '/',
    httpOnly: false,
  };
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, sortie]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ analytics: false, marketing: false, version: '1' }));
  });
  await page.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(2800);
  return { context, page };
}

async function closeDialog(page) {
  const close = page.locator('[role="dialog"] button[aria-label="Fermer"]').first();
  if (await close.count()) {
    await close.click({ force: true });
    await page.waitForTimeout(500);
  }
}

try {
  await seed();

  const mobile = await open(390, 844);
  results.mobile = await mobile.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    const text = document.body.innerText;
    return {
      hero: visible('section[aria-label="Itinéraire du voyage"]').length === 1,
      mapSection: visible('section[aria-label="Carte et points d\'intérêt"]').length === 1,
      leafletPaths: visible('.leaflet-interactive').length,
      timeline: visible('section[aria-label="Déroulé du jour"]').length === 1,
      hasTimes: text.includes('14:20') && text.includes('19:30'),
      poiRail: visible('section[aria-label="Points d\'intérêt"] li').length,
      hasPoi: text.includes('Source du berger'),
      expensesRail: visible('section[aria-label="Dépenses du jour"] li').length,
      hasExpense: text.includes('V14 Taxi') && text.includes('37'),
      itemsRail: visible('section[aria-label="Matériel du jour"] li').length,
      hasItem: text.includes('V14 Crampons'),
    };
  });
  results.axeMobile = blockingInfo((await new AxeBuilder({ page: mobile.page }).analyze()).violations);
  await mobile.page.screenshot({ path: `${outDir}/v14-roadbook-390.png`, fullPage: true });

  /* ── POI : visite + rattachement (persistance) ──────────── */
  await mobile.page.locator('button[aria-label="Point d\'intérêt V14 Source du berger"]').first().click({ force: true });
  await mobile.page.waitForTimeout(800);
  results.poiDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Source du berger')
  );
  await mobile.page.locator('[role="dialog"] button', { hasText: 'Marquer comme visité' }).first().click({ force: true });
  await mobile.page.waitForTimeout(1500);
  const { data: poiCheck } = await admin.from('trip_pois').select('id,visited').eq('id', seeded.pois[0]).maybeSingle();
  results.persistedPoiVisited = poiCheck;
  await closeDialog(mobile.page);

  /* ── Dépense du jour → budget ?jour=N ───────────────────── */
  await mobile.page.locator('button[aria-label^="V14 Taxi"]').first().click({ force: true });
  await mobile.page.waitForTimeout(2600);
  results.budgetDeepLink = {
    url: mobile.page.url(),
    dayDrawer: await mobile.page.evaluate(() =>
      (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Jour 1')
    ),
  };
  await mobile.page.goBack({ waitUntil: 'networkidle' });
  await mobile.page.waitForTimeout(2200);

  /* ── Heure d'étape : édition persistée ──────────────────── */
  await mobile.page.locator('button[aria-label="14:20 · V14 Taxi gare → refuge"]').first().click({ force: true });
  await mobile.page.waitForTimeout(800);
  await mobile.page.locator('[role="dialog"] button', { hasText: "Modifier l'étape" }).click({ force: true });
  await mobile.page.waitForTimeout(800);
  await mobile.page.locator('[role="dialog"] input[type="time"]').fill('15:05');
  await mobile.page.locator('[role="dialog"] button', { hasText: 'Enregistrer les modifications' }).click({ force: true });
  await mobile.page.waitForTimeout(2000);
  const { data: stepCheck } = await admin
    .from('trip_steps')
    .select('id,start_time')
    .eq('id', seeded.steps[0])
    .maybeSingle();
  results.persistedStepTime = stepCheck;

  /* ── Matériel du jour : toggle assignation ──────────────── */
  await mobile.page.locator('section[aria-label="Matériel du jour"] button', { hasText: 'Gérer' }).first().click({ force: true });
  await mobile.page.waitForTimeout(900);
  const itemSwitch = mobile.page.locator('[role="dialog"] button[aria-label="V14 Crampons requis le jour 1"]').first();
  results.itemsDrawer = await itemSwitch.count() > 0;
  if (await itemSwitch.count()) {
    await itemSwitch.click({ force: true });
    await mobile.page.waitForTimeout(1500);
  }
  const { data: itemCheck } = await admin.from('trip_items').select('id,day_number').eq('id', seeded.items[0]).maybeSingle();
  results.persistedItemDay = itemCheck;
  await closeDialog(mobile.page);

  /* ── Carte : ajout rapide d'un POI ──────────────────────── */
  const mapBox = mobile.page.locator('.leaflet-container').first();
  if (await mapBox.count()) {
    await mapBox.click({ position: { x: 130, y: 90 }, force: true });
    await mobile.page.waitForTimeout(700);
    const addHere = mobile.page.locator('button', { hasText: 'Ajouter un point ici' }).first();
    results.mapPick = (await addHere.count()) > 0;
    if (results.mapPick) {
      await addHere.click({ force: true });
      await mobile.page.waitForTimeout(800);
      await mobile.page.locator('[role="dialog"] input[aria-label="Nom du point d\'intérêt"]').fill('V14 Belvédère');
      await mobile.page.locator('[role="dialog"] select[aria-label="Catégorie du point d\'intérêt"]').selectOption('viewpoint');
      await mobile.page.locator('[role="dialog"] button', { hasText: 'Ajouter le point' }).click({ force: true });
      await mobile.page.waitForTimeout(2000);
    }
  }
  const { data: newPoi } = await admin
    .from('trip_pois')
    .select('id,name,category,latitude,longitude')
    .eq('trip_id', trip.id)
    .eq('name', 'V14 Belvédère')
    .maybeSingle();
  results.persistedNewPoi = newPoi;

  await mobile.page.screenshot({ path: `${outDir}/v14-roadbook-after-actions-390.png`, fullPage: true });
  await mobile.context.close();

  /* ── TABLETTE + DESKTOP ─────────────────────────────────── */
  const tablet = await open(768, 1024);
  results.tablet = await tablet.page.evaluate(() => ({
    mobileExperience: document.querySelector('section[aria-label="Itinéraire du voyage"]') !== null,
  }));
  await tablet.context.close();

  const desktop = await open(1440, 900);
  results.desktop = await desktop.page.evaluate(() => {
    const text = document.body.innerText;
    const mobileHero = Array.from(document.querySelectorAll('section')).some(
      (el) => el.getAttribute('aria-label') === 'Itinéraire du voyage' && el.getBoundingClientRect().height > 0
    );
    return { legacy: text.includes('Ajouter jour'), mobileHeroVisible: mobileHero };
  });
  await desktop.page.screenshot({ path: `${outDir}/v14-roadbook-1440.png` });
  await desktop.context.close();
} catch (err) {
  results.fatal = err instanceof Error ? err.message : String(err);
} finally {
  await cleanup();
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(0);
}
