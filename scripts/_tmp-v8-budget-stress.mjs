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
const slug = process.env.TRIP_SLUG || 'tour-mont-blanc-refuge';
const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', slug).maybeSingle();
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: true }));
const sortie = { name: 'lkv_active_adventure', value: b64({ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }), domain: 'localhost', path: '/', httpOnly: true };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addCookies([...authCookies, sortie]);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack ?? e.message).slice(0, 2500)));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('hydrated but some attributes')) errors.push('CONSOLE ' + t.slice(0, 2500));
});
await page.addInitScript(([k]) => { localStorage.setItem(k, JSON.stringify({ analytics: false, marketing: false, version: '1' })); }, ['lkdv_cookie_consent']);
await page.goto('http://localhost:4000/hub/budget', { waitUntil: 'networkidle', timeout: 60000 });
await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
await page.waitForTimeout(1500);

async function step(name, fn) {
  const before = errors.length;
  try {
    await fn();
  } catch (e) {
    errors.push(`${name} STEP ERROR ${String(e).slice(0, 220)}`);
  }
  await page.waitForTimeout(600);
  const fresh = errors.slice(before);
  console.log(`--- ${name}: ${fresh.length ? 'ERROR' : 'ok'}`);
  if (fresh.length) console.log(fresh.join('\n').slice(0, 2200));
}

const TEST_TITLE = `Stress planned ${Date.now()}`;

await step('create-planned-expense', async () => {
  await page.locator('button', { hasText: 'Ajouter une dépense' }).first().click({ force: true });
  await page.waitForTimeout(600);
  await page.locator('input[name="title"]').fill(TEST_TITLE);
  await page.locator('input[name="amount"]').fill('9.99');
  await page.locator('input[name="isPlanned"]').check({ force: true });
  await page.locator('button[type="submit"]', { hasText: 'Valider la dépense' }).first().click({ force: true });
  await page.waitForTimeout(1800);
});

await step('open-drawer', async () => {
  await page.locator('button[aria-label^="Budget —"]:visible').first().click({ force: true });
  await page.waitForTimeout(700);
});

await step('settle-planned-via-payer-modal', async () => {
  const row = page.locator('[role="dialog"] li', { hasText: TEST_TITLE }).first();
  if (await row.count()) {
    const settle = row.locator('button[title="Régler cette dépense prévue"]').first();
    if (await settle.count()) {
      await settle.click({ force: true });
      await page.waitForTimeout(700);
      const payer = page.locator('[role="dialog"] button', { hasText: 'Voyageur Y' }).first();
      if (await payer.count()) await payer.click({ force: true });
      await page.waitForTimeout(1500);
    }
  }
});

await step('edit-expense', async () => {
  const row = page.locator('[role="dialog"] li', { hasText: TEST_TITLE }).first();
  if (await row.count()) {
    await row.locator('button[title="Modifier la dépense"]').first().click({ force: true });
    await page.waitForTimeout(700);
    await page.locator('input[name="amount"]').fill('19.99');
    await page.locator('button[type="submit"]', { hasText: 'Enregistrer les modifications' }).first().click({ force: true });
    await page.waitForTimeout(1500);
  }
});

await step('delete-expense', async () => {
  const row = page.locator('[role="dialog"] li', { hasText: TEST_TITLE }).first();
  if (await row.count()) {
    await row.locator('button[title="Supprimer la dépense"]').first().click({ force: true });
    await page.waitForTimeout(700);
    const confirm = page.locator('[role="dialog"] button', { hasText: 'Supprimer' }).last();
    if (await confirm.count()) await confirm.click({ force: true });
    await page.waitForTimeout(1500);
  }
});

await step('resize-tablet', async () => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(900);
});

const { data: leftover } = await sb
  .from('trip_expenses')
  .select('id,title')
  .eq('trip_id', trip.id)
  .eq('title', TEST_TITLE)
  .maybeSingle();
if (leftover) {
  await sb.from('trip_expenses').delete().eq('id', leftover.id);
  console.log('cleanup: leftover removed');
}

console.log('===== TOTAL ERRORS: ' + errors.length + ' =====');
await page.screenshot({ path: 'docs/h-captures/v8-budget-stress.png' });
await context.close();
await browser.close();
process.exit(0);
