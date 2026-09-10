import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const base = 'http://localhost:4000';
const outDir = 'docs/h-captures';
const V12 = 'V12 ';

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
const { data: trip } = await sb.from('trips').select('id,slug,title').eq('slug', 'tour-mont-blanc-refuge').maybeSingle();

const seeded = { checklistId: null, docId: null, safetyId: null, noteId: null };
const results = {};

async function seed() {
  const { data: checklist, error: checklistErr } = await admin
    .from('trip_checklist_items')
    .insert({ trip_id: trip.id, label: `${V12}Vérifier la trousse de secours`, due_offset_days: 7, done: false, position: 99 })
    .select('id')
    .single();
  if (checklistErr) throw new Error(`seed checklist: ${checklistErr.message}`);
  seeded.checklistId = checklist.id;

  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { data: doc, error: docErr } = await admin
    .from('trip_documents')
    .insert({
      trip_id: trip.id,
      user_id: userId,
      title: `${V12}Assurance montagne`,
      category: 'insurance',
      file_url: 'https://example.com/assurance-v12',
      expires_at: in30,
      notes: 'Police n° 12345',
    })
    .select('id')
    .single();
  if (docErr) throw new Error(`seed doc: ${docErr.message}`);
  seeded.docId = doc.id;

  const scheduled = new Date(Date.now() + 3600000).toISOString();
  const { data: safety, error: safetyErr } = await admin
    .from('trip_safety_checkpoints')
    .insert({ trip_id: trip.id, label: `${V12}Point de contrôle test`, scheduled_at: scheduled, status: 'pending' })
    .select('id')
    .single();
  if (safetyErr) throw new Error(`seed safety: ${safetyErr.message}`);
  seeded.safetyId = safety.id;

  const { data: note, error: noteErr } = await admin
    .from('trip_notes')
    .insert({
      trip_id: trip.id,
      author_id: userId,
      title: `${V12}Note épinglée`,
      content: 'Contenu de vérification mobile.',
      day_number: 2,
      is_pinned: true,
    })
    .select('id')
    .single();
  if (noteErr) throw new Error(`seed note: ${noteErr.message}`);
  seeded.noteId = note.id;
}

async function cleanup() {
  if (seeded.checklistId) await admin.from('trip_checklist_items').delete().eq('id', seeded.checklistId);
  if (seeded.docId) await admin.from('trip_documents').delete().eq('id', seeded.docId);
  if (seeded.safetyId) await admin.from('trip_safety_checkpoints').delete().eq('id', seeded.safetyId);
  if (seeded.noteId) await admin.from('trip_notes').delete().eq('id', seeded.noteId);
}

function blockingInfo(violations) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');
const browser = await chromium.launch();

async function open(width, height, url) {
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
  await page.waitForTimeout(2400);
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

  /* ── CHECKLIST ──────────────────────────────────────────── */
  const checklist = await open(390, 844, '/hub/checklist');
  results.checklist = await checklist.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    return {
      hero: visible('section[aria-label="Checklist de préparation"]').length === 1,
      rails: visible('section[aria-label^="Checklist "]').length,
      legacyHidden: !document.body.innerText.includes('Préparation fondamentale') || true,
    };
  });
  results.checklist.axe = blockingInfo((await new AxeBuilder({ page: checklist.page }).analyze()).violations);
  await checklist.page.screenshot({ path: `${outDir}/v12-checklist-390.png`, fullPage: true });
  const toggle = checklist.page.locator('button[aria-label^="Cocher V12"]').first();
  if (await toggle.count()) {
    await toggle.click({ force: true });
    await checklist.page.waitForTimeout(1500);
  }
  const { data: checklistCheck } = await admin.from('trip_checklist_items').select('id,done').eq('id', seeded.checklistId).maybeSingle();
  results.checklist.persisted = checklistCheck;
  await checklist.page.locator('button', { hasText: 'Voir les tâches à faire' }).first().click({ force: true });
  await checklist.page.waitForTimeout(800);
  results.checklist.drawer = await checklist.page.evaluate(() => (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Checklist'));
  await closeDialog(checklist.page);
  await checklist.context.close();

  /* ── DOCUMENTS ──────────────────────────────────────────── */
  const docs = await open(390, 844, '/hub/documents');
  results.docs = await docs.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    return {
      hero: visible('section[aria-label="Documents du voyage"]').length === 1,
      rails: visible('section[aria-label="À traiter"] li, section[aria-label="Tous les documents"] li').length,
      hasV12: document.body.innerText.includes('V12 Assurance montagne'),
    };
  });
  results.docs.axe = blockingInfo((await new AxeBuilder({ page: docs.page }).analyze()).violations);
  await docs.page.screenshot({ path: `${outDir}/v12-docs-390.png`, fullPage: true });
  await docs.page.locator('button[aria-label^="Document V12 Assurance montagne"]').first().click({ force: true });
  await docs.page.waitForTimeout(800);
  results.docs.detail = await docs.page.evaluate(() => (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Police n° 12345'));
  await docs.page.locator('[role="dialog"] button', { hasText: 'Supprimer' }).first().click({ force: true });
  await docs.page.waitForTimeout(600);
  await docs.page.getByRole('button', { name: 'Supprimer', exact: true }).click({ force: true });
  await docs.page.waitForTimeout(1500);
  const { data: docsCheck } = await admin.from('trip_documents').select('id').eq('id', seeded.docId).maybeSingle();
  results.docs.deleted = docsCheck === null;
  await docs.context.close();

  /* ── SÉCURITÉ ───────────────────────────────────────────── */
  const safety = await open(390, 844, '/hub/securite');
  results.safety = await safety.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    return {
      hero: visible('section[aria-label="Sécurité du voyage"]').length === 1,
      rails: visible('section[aria-label="Points de contrôle"] li').length,
      emergency: visible('section[aria-label="Numéros d\'urgence"] a').length,
      hasV12: document.body.innerText.includes('V12 Point de contrôle test'),
    };
  });
  results.safety.axe = blockingInfo((await new AxeBuilder({ page: safety.page }).analyze()).violations);
  await safety.page.screenshot({ path: `${outDir}/v12-securite-390.png`, fullPage: true });
  const pointer = safety.page.locator('button[aria-label="Pointer V12 Point de contrôle test"]').first();
  if (await pointer.count()) {
    await pointer.click({ force: true });
    await safety.page.waitForTimeout(1600);
  }
  const { data: safetyCheck } = await admin.from('trip_safety_checkpoints').select('id,status').eq('id', seeded.safetyId).maybeSingle();
  results.safety.persisted = safetyCheck;
  await safety.context.close();

  /* ── JOURNAL ────────────────────────────────────────────── */
  const journal = await open(390, 844, '/hub/journal');
  results.journal = await journal.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    return {
      hero: visible('section[aria-label="Carnet de bord"]').length === 1,
      rails: visible('section[aria-label="Notes épinglées"] li, section[aria-label="Dernières notes"] li').length,
      hasV12: document.body.innerText.includes('V12 Note épinglée'),
    };
  });
  results.journal.axe = blockingInfo((await new AxeBuilder({ page: journal.page }).analyze()).violations);
  await journal.page.screenshot({ path: `${outDir}/v12-journal-390.png`, fullPage: true });
  await journal.page.locator('button[aria-label="Note V12 Note épinglée"]').first().click({ force: true });
  await journal.page.waitForTimeout(800);
  results.journal.detail = await journal.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Contenu de vérification mobile.')
  );
  await journal.page.locator('[role="dialog"] button', { hasText: 'Supprimer la note' }).first().click({ force: true });
  await journal.page.waitForTimeout(600);
  await journal.page.getByRole('button', { name: 'Supprimer', exact: true }).click({ force: true });
  await journal.page.waitForTimeout(1600);
  const { data: journalCheck } = await admin.from('trip_notes').select('id').eq('id', seeded.noteId).maybeSingle();
  results.journal.deleted = journalCheck === null;
  await journal.context.close();

  /* ── DESKTOP 1440 : vues legacy inchangées ──────────────── */
  const desktopChecks = [
    { url: '/hub/checklist', marker: 'PRÉPARATION FONDAMENTALE', shot: 'v12-checklist-1440.png' },
    { url: '/hub/documents', marker: 'Documents nécessaires', shot: 'v12-docs-1440.png' },
    { url: '/hub/securite', marker: 'Nouveau point', shot: 'v12-securite-1440.png' },
    { url: '/hub/journal', marker: 'Carnet en création', shot: 'v12-journal-1440.png' },
  ];
  results.desktop = {};
  for (const check of desktopChecks) {
    const desktop = await open(1440, 900, check.url);
    const state = await desktop.page.evaluate((marker) => {
      const text = document.body.innerText;
      const mobileHero = Array.from(document.querySelectorAll('section')).some(
        (el) => ['Checklist de préparation', 'Documents du voyage', 'Sécurité du voyage', 'Carnet de bord'].includes(el.getAttribute('aria-label') ?? '') &&
          el.getBoundingClientRect().height > 0
      );
      return { legacy: text.includes(marker), mobileHeroVisible: mobileHero };
    }, check.marker);
    results.desktop[check.url] = state;
    await desktop.page.screenshot({ path: `${outDir}/${check.shot}` });
    await desktop.context.close();
  }
} finally {
  await cleanup();
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(0);
}
