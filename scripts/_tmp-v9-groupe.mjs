import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const base = 'http://localhost:4000';
const outDir = 'docs/h-captures';
const GROUP = '00000000-0000-4000-8000-000000000001';
const GROUP_TITLE = 'Tour des Écrins — Équipée';
const M2 = 'aa000001-0000-0000-0000-000000000001';
const M3 = 'aa000001-0000-0000-0000-000000000002';
const V9 = 'V9M ';

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);
const DUE_OVERDUE = addDays(today, -2);
const DUE_TODAY = today;
const DUE_FUTURE = addDays(today, 5);

const ADMIN_URL = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const admin = createClient(ADMIN_URL, readEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

let savedCookies = [];
const sb = createServerClient(ADMIN_URL, readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  cookies: { getAll: () => savedCookies, setAll: (cs) => { savedCookies = cs; } },
});
const { data: auth } = await sb.auth.signInWithPassword({
  email: 'y-demo@lekitduvoyageur.fr',
  password: 'Ydemo!2026',
});
const userId = auth.user.id;

const seeded = { members: [], kit: [], tasks: [], expenses: [], polls: [], messages: [] };
const originalTasks = [];
const results = {};

async function seed() {
  const { data: before } = await admin
    .from('group_tasks')
    .select('id,due_date,status')
    .eq('group_id', GROUP);
  originalTasks.push(...(before ?? []));

  const { error: memberErr } = await admin.from('group_members').upsert(
    [
      { group_id: GROUP, user_id: M2, role: 'member', status: 'active' },
      { group_id: GROUP, user_id: M3, role: 'member', status: 'pending' },
    ],
    { onConflict: 'group_id,user_id' }
  );
  if (memberErr) throw new Error(`seed members: ${memberErr.message}`);
  seeded.members = [M2, M3];

  const { data: kit, error: kitErr } = await admin
    .from('group_kit_items')
    .insert([
      { group_id: GROUP, name: `${V9}Tente 2 places`, weight_grams: 2400, assigned_to: M2, is_shared: true, category: 'Bivouac' },
      { group_id: GROUP, name: `${V9}Réchaud titane`, weight_grams: 180, is_shared: true, category: 'Cuisine' },
      { group_id: GROUP, name: `${V9}Filtre à eau`, weight_grams: 90, assigned_to: userId, is_shared: true, category: 'Eau' },
    ])
    .select('id,name');
  if (kitErr) throw new Error(`seed kit: ${kitErr.message}`);
  seeded.kit = kit.map((row) => row.id);

  const { data: tasks, error: taskErr } = await admin
    .from('group_tasks')
    .insert([
      { group_id: GROUP, title: `${V9}Réserver les refuges (relance)`, status: 'todo', due_date: DUE_OVERDUE, assigned_to: userId, created_by: userId },
      { group_id: GROUP, title: `${V9}Acheter le fuel`, status: 'todo', due_date: DUE_TODAY, assigned_to: M2, created_by: userId },
      { group_id: GROUP, title: `${V9}Tracer l’itinéraire du jour 3`, status: 'todo', due_date: DUE_FUTURE, created_by: userId },
    ])
    .select('id');
  if (taskErr) throw new Error(`seed tasks: ${taskErr.message}`);
  seeded.tasks = tasks.map((row) => row.id);

  const { data: expenses, error: expErr } = await admin
    .from('group_expenses')
    .insert([
      { group_id: GROUP, title: `${V9}Courses du refuge`, amount: 80, paid_by: M2, split_between: [userId, M2], status: 'pending', category: 'Nourriture' },
      { group_id: GROUP, title: `${V9}Péage parking`, amount: 20, paid_by: userId, split_between: [userId, M2], status: 'settled', category: 'Transport' },
    ])
    .select('id');
  if (expErr) throw new Error(`seed expenses: ${expErr.message}`);
  seeded.expenses = expenses.map((row) => row.id);

  const { data: polls, error: pollErr } = await admin
    .from('group_polls')
    .insert([
      {
        group_id: GROUP,
        created_by: userId,
        question: `${V9}Refuge ou bivouac pour la nuit 2 ?`,
        options: ['Refuge', 'Bivouac', 'Décider sur place'],
        status: 'open',
      },
    ])
    .select('id');
  if (pollErr) throw new Error(`seed poll: ${pollErr.message}`);
  seeded.polls = polls.map((row) => row.id);

  const { data: msgs, error: msgErr } = await admin
    .from('group_messages')
    .insert([{ group_id: GROUP, user_id: userId, content: `${V9}Rendez-vous à 7h au parking du Prégentil.` }])
    .select('id');
  if (msgErr) throw new Error(`seed messages: ${msgErr.message}`);
  seeded.messages = msgs.map((row) => row.id);

  return { settleExpenseId: expenses[0].id, pollId: polls[0].id, kitUnassignedId: kit[1].id };
}

async function cleanup() {
  if (seeded.messages.length) await admin.from('group_messages').delete().in('id', seeded.messages);
  if (seeded.polls.length) await admin.from('group_poll_votes').delete().in('poll_id', seeded.polls);
  if (seeded.polls.length) await admin.from('group_polls').delete().in('id', seeded.polls);
  if (seeded.tasks.length) await admin.from('group_tasks').delete().in('id', seeded.tasks);
  if (seeded.expenses.length) await admin.from('group_expenses').delete().in('id', seeded.expenses);
  if (seeded.kit.length) await admin.from('group_kit_items').delete().in('id', seeded.kit);
  if (seeded.members.length) {
    await admin.from('group_members').delete().eq('group_id', GROUP).in('user_id', seeded.members);
  }
  for (const task of originalTasks) {
    await admin.from('group_tasks').update({ due_date: task.due_date, status: task.status }).eq('id', task.id);
  }
}

function blockingInfo(violations) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
}

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf-8').toString('base64url');

async function open(width, height, url = '/hub/groupe') {
  const authCookies = savedCookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false }));
  const collectif = {
    name: 'lkv_active_adventure',
    value: b64({ nature: 'collectif', id: GROUP, title: GROUP_TITLE }),
    domain: 'localhost',
    path: '/',
    httpOnly: false,
  };
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addCookies([...authCookies, collectif]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ analytics: false, marketing: false, version: '1' }));
  });
  const response = await page.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; }' });
  await page.waitForTimeout(2600);
  return { context, page, response };
}

async function closeDialog(page) {
  const close = page.locator('[role="dialog"] button[aria-label="Fermer"]').first();
  if (await close.count()) {
    await close.click({ force: true });
    await page.waitForTimeout(500);
  }
}

const browser = await chromium.launch();

try {
  const { settleExpenseId, pollId, kitUnassignedId } = await seed();

  /* ── MOBILE 390 ─────────────────────────────────────────── */
  const mobile = await open(390, 844);
  results.mobile = await mobile.page.evaluate(() => {
    const visible = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().height > 0);
    const text = document.body.innerText;
    return {
      hero: visible('section[aria-label="Préparation du groupe"]').length === 1,
      readinessPct: document.querySelector('section[aria-label="Préparation du groupe"]')?.textContent?.match(/(\d+)%/)?.[1] ?? null,
      chips: visible('section[aria-label="Indicateurs du groupe"] button').length,
      criticalCards: visible('section[aria-label="Chemin critique"] li').length,
      overdueBadge: text.includes('j de retard'),
      caisseRail: visible('section[aria-label="Caisse commune"] li').length,
      equipmentRail: visible('section[aria-label="Équipement partagé"] li').length,
      decisionsRail: visible('section[aria-label="Décisions en cours"] li').length,
      membersRail: visible('section[aria-label="Membres du groupe"] li').length,
      discussionRail: visible('section[aria-label="Discussion du groupe"] li').length,
      inlineVote: visible('section[aria-label="Décisions en cours"] button[aria-pressed]').length,
      pendingInvite: text.includes('Thomas Martin') && text.toLowerCase().includes('en attente'),
      legacyAccordionGone: !text.includes('Cockpit collaboratif'),
    };
  });
  await mobile.page.screenshot({ path: `${outDir}/v10-groupe-390.png`, fullPage: true });
  results.axeMobile = blockingInfo((await new AxeBuilder({ page: mobile.page }).analyze()).violations);

  /* ── Vote inline ────────────────────────────────────────── */
  const voteBtn = mobile.page
    .locator('section[aria-label="Décisions en cours"] button[aria-pressed]')
    .first();
  if (await voteBtn.count()) {
    await voteBtn.click({ force: true });
    await mobile.page.waitForTimeout(1600);
    results.voteAction = true;
  }
  const { data: voteRows } = await admin.from('group_poll_votes').select('poll_id,user_id,option_index').eq('poll_id', pollId);
  results.persistedVote = voteRows ?? [];

  /* ── Assignation équipement (Je l'apporte) ──────────────── */
  const kitCard = mobile.page.locator('section[aria-label="Équipement partagé"] li', { hasText: 'Réchaud titane' }).first();
  if (await kitCard.count()) {
    await kitCard.locator('button', { hasText: 'Je l’apporte' }).click({ force: true });
    await mobile.page.waitForTimeout(1600);
    results.kitAction = true;
  }
  const { data: kitCheck } = await admin.from('group_kit_items').select('id,assigned_to').eq('id', kitUnassignedId).maybeSingle();
  results.persistedKit = kitCheck;

  /* ── Tâche : complétion + échéance ──────────────────────── */
  const completeBtn = mobile.page
    .locator('section[aria-label="Chemin critique"] button[aria-label^="Marquer"]')
    .first();
  if (await completeBtn.count()) {
    await completeBtn.click({ force: true });
    await mobile.page.waitForTimeout(1600);
    results.completeAction = true;
  }
  const dateCard = mobile.page.locator('section[aria-label="Chemin critique"] li', { hasText: 'Tracer' }).first();
  if (await dateCard.count()) {
    await dateCard.locator('input[type="date"]').fill(addDays(today, 9), { force: true });
    await mobile.page.waitForTimeout(1600);
    results.dueDateAction = addDays(today, 9);
  }

  /* ── Tiroirs via chips ──────────────────────────────────── */
  const chips = mobile.page.locator('section[aria-label="Indicateurs du groupe"] button');
  await chips.nth(0).click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.tasksDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Tâches du groupe')
  );
  await closeDialog(mobile.page);

  const caisseChip = mobile.page.locator('section[aria-label="Indicateurs du groupe"] button').nth(1);
  await caisseChip.click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.caisseDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Caisse commune')
  );
  const settleRow = mobile.page.locator('[role="dialog"] li', { hasText: 'Courses du refuge' }).first();
  if (await settleRow.count()) {
    await settleRow.locator('button', { hasText: 'Marquer remboursé' }).click({ force: true });
    await mobile.page.waitForTimeout(1600);
    results.settleAction = true;
  }
  await closeDialog(mobile.page);

  const equipmentChip = mobile.page.locator('section[aria-label="Indicateurs du groupe"] button').nth(3);
  await equipmentChip.click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.equipmentDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Équipement partagé')
  );
  await closeDialog(mobile.page);

  const membersChip = mobile.page.locator('section[aria-label="Indicateurs du groupe"] button').nth(2);
  await membersChip.click({ force: true });
  await mobile.page.waitForTimeout(900);
  results.membersDrawer = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Membres & invitations')
  );
  await closeDialog(mobile.page);

  /* ── Tiroir Préparation (anneau hero) ───────────────────── */
  const ringBtn = mobile.page.locator('button[aria-label^="Détail de la préparation"]').first();
  if (await ringBtn.count()) {
    await ringBtn.click({ force: true });
    await mobile.page.waitForTimeout(900);
    results.readinessDrawer = await mobile.page.evaluate(() =>
      (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Préparation du groupe')
    );
    await closeDialog(mobile.page);
  }

  const { data: taskCheck } = await admin.from('group_tasks').select('id,title,status,due_date').in('id', seeded.tasks);
  const { data: expCheck } = await admin.from('group_expenses').select('id,title,status').eq('id', settleExpenseId).maybeSingle();
  results.persisted = { tasks: taskCheck, settledExpense: expCheck };

  await mobile.page.screenshot({ path: `${outDir}/v10-groupe-after-actions-390.png`, fullPage: true });

  /* ── Deep link ?onglet=tasks → tiroir ───────────────────── */
  await mobile.page.goto(base + '/hub/groupe?onglet=tasks', { waitUntil: 'networkidle', timeout: 60000 });
  await mobile.page.waitForTimeout(2000);
  results.deepLink = await mobile.page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.textContent ?? '').includes('Tâches du groupe')
  );
  await mobile.context.close();

  /* ── Route équipage supprimée + redirection /equipages ──── */
  const equipage = await open(390, 844, '/hub/equipage');
  results.equipageRoute = await equipage.page.evaluate(() => ({
    notFound: /404|introuvable|not found/i.test(document.body.innerText),
  }));
  await equipage.context.close();

  const legacy = await open(390, 844, '/equipages');
  results.legacyRedirect = { url: legacy.page.url() };
  await legacy.context.close();

  /* ── TABLETTE 768 ───────────────────────────────────────── */
  const tablet = await open(768, 1024);
  results.tablet = await tablet.page.evaluate(() => {
    const text = document.body.innerText;
    return {
      mobileExperience: /préparation du groupe/i.test(text),
      desktopTabs: /vue d['’]ensemble/i.test(text),
    };
  });
  await tablet.page.screenshot({ path: `${outDir}/v10-groupe-768.png`, fullPage: true });
  await tablet.context.close();

  /* ── DESKTOP 1440 : cockpit inchangé ────────────────────── */
  const desktop = await open(1440, 900);
  results.desktop = await desktop.page.evaluate(() => {
    const text = document.body.innerText;
    const mobileHero = Array.from(document.querySelectorAll('section')).some(
      (el) => (el.textContent ?? '').includes('Préparation du groupe') && el.getBoundingClientRect().height > 0
    );
    return {
      cockpitTabs: /vue d['’]ensemble/i.test(text),
      mobileHeroVisible: mobileHero,
    };
  });
  await desktop.page.screenshot({ path: `${outDir}/v10-groupe-1440.png` });
  await desktop.context.close();
} finally {
  await cleanup();
  const { data: leftovers } = await admin.from('group_tasks').select('id').like('title', `${V9}%`);
  results.cleanup = { taskLeftovers: leftovers?.length ?? 0 };
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(0);
}
