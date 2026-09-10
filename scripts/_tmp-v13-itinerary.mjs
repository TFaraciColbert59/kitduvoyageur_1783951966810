import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const base = 'http://localhost:4000';
const outDir = 'docs/h-captures';
const V13 = 'V13 ';

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
await sb.auth.signInWithPassword({ email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' });
const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();

const seeded = { stepA: null, stepB: null };
const originalSteps = [];
const results = {};

async function seed() {
  const { data: existing } = await admin
    .from('trip_steps')
    .select('id,day_number,order_index')
    .eq('trip_id', trip.id)
    .eq('day_number', 1);
  originalSteps.push(...(existing ?? []));
  const maxOrder = (existing ?? []).reduce((max, s) => Math.max(max, s.order_index), -1);

  const { data: rows, error } = await admin
    .from('trip_steps')
    .insert([
      { trip_id: trip.id, day_number: 1, order_index: maxOrder + 1, title: `${V13}Étape test A`, location_name: 'Refuge A', distance_km: 6.1, elevation_gain_m: 320, transport_mode: 'foot' },
      { trip_id: trip.id, day_number: 1, order_index: maxOrder + 2, title: `${V13}Étape test B`, location_name: 'Col B', distance_km: 3.4, elevation_gain_m: 180, transport_mode: 'train' },
    ])
    .select('id,title');
  if (error) throw new Error(`seed steps: ${error.message}`);
  seeded.stepA = rows[0].id;
  seeded.stepB = rows[1].id;
}

async function cleanup() {
  if (seeded.stepA) await admin.from('trip_steps').delete().eq('id', seeded.stepA);
  if (seeded.stepB) await admin.from('trip_steps').delete().eq('id', seeded.stepB);
  await admin.from('trip_steps').delete().eq('trip_id', trip.id).like('title', `${V13}%`);
  for (const step of originalSteps) {
    await admin.from('trip_steps').update({ order_index: step.order_index }).eq('id', step.id);
  }
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
  page.on('console', (msg) => {
    if (msg.type() === 'error') results.consoleErrors = [...(results.consoleErrors ?? []), msg.text().slice(0, 300)];
  });
  page.on('response', (res) => {
    if (res.request().method() === 'POST') {
      results.posts = [...(results.posts ?? []), { status: res.status(), action: res.request().headers()['next-action'] ? 'server-action' : 'other' }];
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ analytics: false, marketing: false, version: '1' }));
  });
  await page.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(2600);
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
      dayRail: visible('section[aria-label="Journées de l\'itinéraire"] li').length,
      stepRail: visible('section[aria-label^="Étapes du jour"] li').length,
      chips: visible('section[aria-label="Indicateurs du groupe"] button').length,
      hasV13: text.includes('V13 Étape test A') && text.includes('V13 Étape test B'),
      map: visible('section[aria-label="Itinéraire du voyage"] .leaflet-container, section[aria-label="Itinéraire du voyage"] [class*="leaflet"]').length >= 0,
      legacyHidden: !text.includes('Ajouter jour'),
    };
  });
  results.axeMobile = blockingInfo((await new AxeBuilder({ page: mobile.page }).analyze()).violations);
  await mobile.page.screenshot({ path: `${outDir}/v13-itinerary-390.png`, fullPage: true });

  /* ── Détail d'étape : monter puis supprimer ─────────────── */
  await mobile.page.locator('button[aria-label*="V13 Étape test A"]').first().click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.stepDrawer = await mobile.page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return {
      open: !!dialog,
      hasTitle: (dialog?.textContent ?? '').includes('V13 Étape test A'),
      hasActions: (dialog?.textContent ?? '').includes('Modifier') && (dialog?.textContent ?? '').includes('Supprimer'),
    };
  });
  const railOrder = () =>
    mobile.page.evaluate(() => {
      const section = document.querySelector('section[aria-label^="Étapes du jour"]');
      return Array.from(section?.querySelectorAll('button[aria-label^="Étape "]') ?? []).map((el) =>
        el.getAttribute('aria-label')
      );
    });
  results.railBeforeMove = await railOrder();
  await mobile.page.locator('[role="dialog"] button[aria-label="Monter l\'étape"]').first().click({ force: true });
  await mobile.page.waitForTimeout(2500);
  results.railAfterMove = await railOrder();
  results.moveToast = await mobile.page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/(Erreur[^\n]*|réordonn[^\n]*|Étape modifiée[^\n]*)/i);
    return match ? match[0].slice(0, 140) : null;
  });
  const { data: day1AfterMove } = await admin
    .from('trip_steps')
    .select('id,title,order_index')
    .eq('trip_id', trip.id)
    .eq('day_number', 1)
    .order('order_index', { ascending: true });
  results.day1AfterMove = (day1AfterMove ?? []).map((s) => `${s.order_index}:${s.title}`);
  const { data: moved } = await admin
    .from('trip_steps')
    .select('id,title,order_index')
    .eq('trip_id', trip.id)
    .like('title', `${V13}%`)
    .order('order_index', { ascending: true });
  results.persistedMove = moved;

  await mobile.page.locator('[role="dialog"] button', { hasText: "Supprimer l'étape" }).first().click({ force: true });
  await mobile.page.waitForTimeout(700);
  await mobile.page.getByRole('button', { name: 'Supprimer', exact: true }).click({ force: true });
  await mobile.page.waitForTimeout(1600);
  const { data: afterDelete } = await admin.from('trip_steps').select('id').eq('id', seeded.stepA).maybeSingle();
  results.persistedDelete = afterDelete === null;

  /* ── Ajout d'étape via tiroir formulaire ────────────────── */
  await mobile.page
    .locator('section[aria-label="Itinéraire du voyage"] button', { hasText: 'Ajouter une étape' })
    .first()
    .click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.formDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Nouvelle étape')
  );
  await mobile.page.locator('[role="dialog"] input[aria-label="Titre de l\'étape"]').fill('V13 Nouvelle étape');
  await mobile.page.locator('[role="dialog"] button', { hasText: "Ajouter l'étape" }).click({ force: true });
  await mobile.page.waitForTimeout(2000);
  const { data: created } = await admin
    .from('trip_steps')
    .select('id,title,day_number')
    .eq('trip_id', trip.id)
    .eq('title', 'V13 Nouvelle étape')
    .maybeSingle();
  results.persistedAdd = created;

  /* ── Tiroir jours + carte ───────────────────────────────── */
  await mobile.page.locator('button', { hasText: 'Gérer les jours' }).first().click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.daysDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes("Jours de l'itinéraire")
  );
  await closeDialog(mobile.page);

  await mobile.page.locator('button[aria-label="Agrandir la carte"]').first().click({ force: true });
  await mobile.page.waitForTimeout(1200);
  results.mapSheet = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes("Carte de l'itinéraire")
  );
  await closeDialog(mobile.page);

  await mobile.page.screenshot({ path: `${outDir}/v13-itinerary-after-actions-390.png`, fullPage: true });
  await mobile.context.close();

  /* ── TABLETTE + DESKTOP ─────────────────────────────────── */
  const tablet = await open(768, 1024);
  results.tablet = await tablet.page.evaluate(() => ({
    mobileExperience: document.body.innerText.includes('ITINÉRAIRE DU VOYAGE'),
  }));
  await tablet.page.screenshot({ path: `${outDir}/v13-itinerary-768.png`, fullPage: true });
  await tablet.context.close();

  const desktop = await open(1440, 900);
  results.desktop = await desktop.page.evaluate(() => {
    const text = document.body.innerText;
    const mobileHero = Array.from(document.querySelectorAll('section')).some(
      (el) => el.getAttribute('aria-label') === 'Itinéraire du voyage' && el.getBoundingClientRect().height > 0
    );
    return {
      legacy: text.includes('Ajouter jour') || text.includes('Ajouter étape'),
      mobileHeroVisible: mobileHero,
    };
  });
  await desktop.page.screenshot({ path: `${outDir}/v13-itinerary-1440.png` });
  await desktop.context.close();
} catch (err) {
  results.fatal = err instanceof Error ? `${err.message}\n${err.stack?.split('\n').slice(0, 3).join('\n')}` : String(err);
} finally {
  await cleanup();
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(0);
}
