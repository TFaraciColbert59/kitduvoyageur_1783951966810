#!/usr/bin/env node
/**
 * Phase 1 — preuve d'intégration locale des flux points/commandes.
 *
 * Exerce les routes Next réelles avec des sessions navigateur réelles
 * (cookies) contre la stack Supabase locale :
 *   spend concurrent (pas d'overdraft), idempotence spend/refund/earn,
 *   earn rapport vérifié (403 si source volée), commande virement `pending`,
 *   confirmation admin (crédit trigger unique, rejeu 409), annulation
 *   (isolation inter-utilisateurs), invariant solde = Σ journal, smoke mobile.
 *
 * Prérequis : Supabase local (127.0.0.1:54321, migration 20261010140000
 * appliquée) + `npm run dev` sur :4000 avec l'env local, et la clé service
 * locale exportée (aucun secret en dur — garde-fou audit CI) :
 *   . scratch/start-dev-local.ps1   (pose NEXT_PUBLIC_SUPABASE_URL et
 *                                    SUPABASE_SERVICE_ROLE_KEY)
 *
 * Sortie : log horodaté dans le dossier temp + exit 0 (PASS) / 1 (FAIL).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.PHASE1_APP_URL ?? 'http://localhost:4000';

// Aucun secret en dur (invariant audit CI) : la clé service locale doit être
// exportée par l'appelant (cf. scratch/start-dev-local.ps1).
if (!SERVICE_KEY) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY absente — sourcez scratch/start-dev-local.ps1 ou exportez les clés locales avant de lancer ce script.'
  );
  process.exit(1);
}

const EMAIL_A = 'integ-a@lkdv.test';
const EMAIL_B = 'integ-b@lkdv.test';
const PASSWORD = 'IntegPhase1!2026';
const PRODUCT_SLUG = 'sac-test-phase1';
const OPENING_POINTS = 1000;
const CONC_POINTS = 600;

const LOG_FILE = path.join(
  os.tmpdir(),
  `phase1-points-integration-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
);
fs.writeFileSync(LOG_FILE, '');

function log(line = '') {
  console.log(line);
  fs.appendFileSync(LOG_FILE, `${line}\n`);
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let checks = 0;
class AssertionError extends Error {}

function check(label, condition, detail = '') {
  if (condition) {
    checks += 1;
    log(`  OK  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    throw new AssertionError(`${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function step(title, fn) {
  log(`\n=== ${title} ===`);
  await fn();
}

// ── Helpers service_role ─────────────────────────────────────────────────────

async function ensureUser(email) {
  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  let user = list.users.find((u) => u.email === email) ?? null;
  if (!user) {
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: email.split('@')[0] },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    user = data.user;
  } else {
    const { error } = await svc.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUser ${email}: ${error.message}`);
  }
  const { data: prof, error: profErr } = await svc
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (profErr) throw new Error(`profil ${email}: ${profErr.message}`);
  if (!prof) {
    const ins = await svc
      .from('user_profiles')
      .insert({ id: user.id, email, full_name: email.split('@')[0] });
    if (ins.error) throw new Error(`insert profil ${email}: ${ins.error.message}`);
  }
  return user;
}

async function resetUserData(userId) {
  const tables = ['user_roles', 'loyalty_history', 'loyalty_redemptions', 'kit_reports', 'orders', 'stock_movements'];
  for (const table of tables) {
    const { error } = await svc.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`reset ${table}: ${error.message}`);
  }
  const { error } = await svc
    .from('user_profiles')
    .update({ loyalty_points: 0, loyalty_level: 'Explorateur' })
    .eq('id', userId);
  if (error) throw new Error(`reset profil: ${error.message}`);
}

async function ensureProduct() {
  const { data: existing, error: selErr } = await svc
    .from('shop_products')
    .select('id, slug, name, price_eur, stock, available')
    .eq('slug', PRODUCT_SLUG)
    .maybeSingle();
  if (selErr) throw new Error(`product select: ${selErr.message}`);
  if (existing) {
    const { error } = await svc
      .from('shop_products')
      .update({ available: true, stock: 10, price_eur: 30 })
      .eq('id', existing.id);
    if (error) throw new Error(`product reset: ${error.message}`);
    return { ...existing, price_eur: 30, stock: 10, available: true };
  }
  const { data, error } = await svc
    .from('shop_products')
    .insert({
      slug: PRODUCT_SLUG,
      name: 'Sac test Phase 1',
      brand: 'LKDV Test',
      category_main: 'test',
      price_eur: 30,
      stock: 10,
      available: true,
    })
    .select('id, slug, name, price_eur, stock, available')
    .single();
  if (error) throw new Error(`product insert: ${error.message}`);
  return data;
}

async function grantAdmin(userId) {
  const { data: role, error } = await svc.from('roles').select('id').eq('name', 'admin').single();
  if (error) throw new Error(`roles: ${error.message}`);
  const { error: insErr } = await svc
    .from('user_roles')
    .upsert({ user_id: userId, role_id: role.id }, { onConflict: 'user_id,role_id' });
  if (insErr) throw new Error(`user_roles: ${insErr.message}`);
}

async function sumHistory(userId) {
  const { data, error } = await svc.from('loyalty_history').select('points').eq('user_id', userId);
  if (error) throw new Error(`sumHistory: ${error.message}`);
  return data.reduce((acc, row) => acc + row.points, 0);
}

async function profileOf(userId) {
  const { data, error } = await svc
    .from('user_profiles')
    .select('loyalty_points, loyalty_level')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`profileOf: ${error.message}`);
  return data;
}

async function historyRows(userId, sourceId) {
  const { data, error } = await svc
    .from('loyalty_history')
    .select('id, points, type, source_id')
    .eq('user_id', userId)
    .eq('source_id', sourceId);
  if (error) throw new Error(`historyRows: ${error.message}`);
  return data;
}

async function assertInvariant(userId, label) {
  const [sum, prof] = await Promise.all([sumHistory(userId), profileOf(userId)]);
  check(
    `invariant ${label} : loyalty_points = Σ journal`,
    prof.loyalty_points === sum,
    `profil=${prof.loyalty_points} Σ=${sum}`
  );
}

// ── Helpers navigateur ───────────────────────────────────────────────────────

async function login(page, email) {
  await page.goto(`${APP_URL}/connexion`, { waitUntil: 'networkidle', timeout: 180000 });
  // La page expose des formulaires desktop ET mobile : ne cibler que le visible.
  const emailInput = page.locator('#email:visible').first();
  await emailInput.waitFor({ state: 'visible', timeout: 60000 });
  await emailInput.fill(email);
  await page.locator('#password:visible').first().fill(PASSWORD);
  await page.locator('button:visible', { hasText: /Se connecter/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'), { timeout: 90000 });
}

async function api(page, apiPath, body, headers = {}) {
  return page.evaluate(
    async ({ apiPath, body, headers }) => {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      return { status: res.status, json };
    },
    { apiPath, body, headers }
  );
}

const SHIPPING = {
  prenom: 'Ada',
  nom: 'Lovelace',
  email: 'ada@example.com',
  adresse: '1 rue du Test',
  codePostal: '75001',
  ville: 'Paris',
  pays: 'France',
};

async function createOrder(page, quantity) {
  return api(page, '/api/orders', {
    items: [{ slug: PRODUCT_SLUG, quantity }],
    shipping: SHIPPING,
    shippingOption: 'standard',
  });
}

/**
 * Miroir de `(total_eur*10)::integer` (Postgres arrondit au plus proche) :
 * passage par les centimes pour éviter les artefacts flottants (ex. 3.05).
 */
function pointsForTotalEur(totalEur) {
  const cents = Math.round(Number(totalEur) * 100);
  return Math.round(cents / 10);
}

// ── Flux principal ───────────────────────────────────────────────────────────

let browser;
try {
  log(`Phase 1 — intégration locale points/commandes`);
  log(`APP=${APP_URL}  SUPABASE=${SUPABASE_URL}  LOG=${LOG_FILE}`);

  let userA;
  let userB;

  await step('0. Préflight (RPC phase1, produit vendable, utilisateurs, reset)', async () => {
    const rpc = await svc.rpc('legacy_loyalty_level_for', { p_points: 500 });
    check('migration phase1 appliquée (legacy_loyalty_level_for)', !rpc.error, rpc.error?.message ?? 'Aventurier');

    const product = await ensureProduct();
    check('produit vendable disponible (stock=10)', product.available === true && product.stock === 10, product.slug);

    userA = await ensureUser(EMAIL_A);
    userB = await ensureUser(EMAIL_B);
    check('2 utilisateurs de test prêts', Boolean(userA.id && userB.id));

    await resetUserData(userA.id);
    await resetUserData(userB.id);
    check('reset données A/B (journal, commandes, rôles)', true);

    // Solde d'ouverture de A : ligne de journal (service_role), le trigger
    // live `sync_loyalty_points` propage le solde au profil.
    const opening = await svc.from('loyalty_history').insert({
      user_id: userA.id,
      action: 'Solde test intégration',
      points: OPENING_POINTS,
      type: 'opening_balance',
      source_id: `opening:${userA.id}:integ`,
    });
    if (opening.error) throw new Error(`opening: ${opening.error.message}`);
    const prof = await profileOf(userA.id);
    check(`solde d'ouverture crédité (${OPENING_POINTS})`, prof.loyalty_points === OPENING_POINTS, `profil=${prof.loyalty_points}`);
  });

  browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageA = await ctxA.newPage();
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageB = await ctxB.newPage();

  await step('1. Authentification navigateur A et B (cookies réels)', async () => {
    await login(pageA, EMAIL_A);
    check('login A hors /connexion', !new URL(pageA.url()).pathname.startsWith('/connexion'), pageA.url());
    await login(pageB, EMAIL_B);
    check('login B hors /connexion', !new URL(pageB.url()).pathname.startsWith('/connexion'), pageB.url());
  });

  let winnerSourceId = null;
  let winnerItemId = null;

  await step('2. Spend concurrent (600 + 600 sur solde 1000 ⇒ 1 seul succès)', async () => {
    const results = await pageA.evaluate(async () => {
      const send = async (sourceId) => {
        const res = await fetch('/api/loyalty/spend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: 600, reason: 'Concurrence intégration', sourceId }),
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      };
      return Promise.all([send('cart_free_apply:conc-1'), send('cart_free_apply:conc-2')]);
    });
    const okResults = results.filter((r) => r.status === 200 && r.body?.success === true);
    const koResults = results.filter((r) => r.status === 409 && r.body?.error === 'insufficient_balance');
    check('exactement 1 spend sur 2 réussit', okResults.length === 1, JSON.stringify(results.map((r) => [r.status, r.body?.error ?? 'ok'])));
    check('l’autre est refusé 409 insufficient_balance', koResults.length === 1);

    const winnerIndex = results.findIndex((r) => r.status === 200 && r.body?.success === true);
    winnerSourceId = winnerIndex === 0 ? 'cart_free_apply:conc-1' : 'cart_free_apply:conc-2';
    winnerItemId = winnerIndex === 0 ? 'conc-1' : 'conc-2';

    const sum = await sumHistory(userA.id);
    const prof = await profileOf(userA.id);
    check('Σ journal = 400', sum === 400, `Σ=${sum}`);
    check('profil = 400', prof.loyalty_points === 400, `profil=${prof.loyalty_points}`);
  });

  await step('3. Idempotence spend (rejeu même sourceId)', async () => {
    const replay = await api(pageA, '/api/loyalty/spend', {
      points: 600,
      reason: 'Concurrence intégration',
      sourceId: winnerSourceId,
    });
    check('rejeu 200 success + idempotent', replay.status === 200 && replay.json?.success === true && replay.json?.idempotent === true, `status=${replay.status} idem=${replay.json?.idempotent}`);
    check('solde inchangé (400)', replay.json?.balance === 400, `balance=${replay.json?.balance}`);
    const rows = await historyRows(userA.id, winnerSourceId);
    check('1 seule ligne de journal pour ce sourceId', rows.length === 1, `rows=${rows.length}`);
    await assertInvariant(userA.id, 'A après idempotence spend');
  });

  await step('4. Refund panier (montant repris du journal) + idempotence + no_apply', async () => {
    const refund = await api(pageA, '/api/loyalty/refund', { cartItemId: winnerItemId });
    check('refund 200 success', refund.status === 200 && refund.json?.success === true, `status=${refund.status}`);
    check('solde restauré à 1000', refund.json?.balance === 1000, `balance=${refund.json?.balance}`);

    const refundRow = await historyRows(userA.id, `cart_free_remove:${winnerItemId}`);
    check('crédit EXACT de 600 (repris du journal)', refundRow.length === 1 && refundRow[0].points === 600, JSON.stringify(refundRow));

    const replay = await api(pageA, '/api/loyalty/refund', { cartItemId: winnerItemId });
    check('rejeu refund idempotent', replay.status === 200 && replay.json?.idempotent === true && replay.json?.balance === 1000);

    const noApply = await api(pageA, '/api/loyalty/refund', { cartItemId: 'item-sans-apply' });
    check('refund sans apply ⇒ 409 no_apply', noApply.status === 409 && noApply.json?.error === 'no_apply', JSON.stringify(noApply));
    await assertInvariant(userA.id, 'A après refund');
  });

  let reportId = null;

  await step('5. Earn rapport vérifié (+75, idempotence, source volée ⇒ 403)', async () => {
    const report = await svc
      .from('kit_reports')
      .insert({ user_id: userA.id, destination: 'Intégration Phase 1', status: 'draft' })
      .select('id')
      .single();
    if (report.error) throw new Error(`kit_reports insert: ${report.error.message}`);
    reportId = report.data.id;

    const earn = await api(pageA, '/api/loyalty/earn', { action: 'rapport_expedition', sourceId: reportId });
    check('earn 200 (+75)', earn.status === 200 && earn.json?.success === true && earn.json?.balance === 1075, `status=${earn.status} balance=${earn.json?.balance}`);

    const rows = await historyRows(userA.id, `rapport:${reportId}`);
    check('1 ligne rapport = 75 points', rows.length === 1 && rows[0].points === 75, JSON.stringify(rows));

    const replay = await api(pageA, '/api/loyalty/earn', { action: 'rapport_expedition', sourceId: reportId });
    check('rejeu earn idempotent, 1 seule ligne', replay.status === 200 && replay.json?.idempotent === true && (await historyRows(userA.id, `rapport:${reportId}`)).length === 1);

    const bogus = await api(pageA, '/api/loyalty/earn', { action: 'rapport_expedition', sourceId: crypto.randomUUID() });
    check('rapport inconnu ⇒ 403 action_not_verified', bogus.status === 403 && bogus.json?.error === 'action_not_verified', JSON.stringify(bogus));
    await assertInvariant(userA.id, 'A après earn');
  });

  let order1 = null;
  let order2 = null;

  await step('6. Commande virement ⇒ pending, aucun point crédité, stock décrémenté', async () => {
    const res = await createOrder(pageA, 2);
    check('POST /api/orders 200 + orderNumber', res.status === 200 && res.json?.success === true && Boolean(res.json?.orderNumber), JSON.stringify({ status: res.status, orderNumber: res.json?.orderNumber, totalEur: res.json?.totalEur }));

    const { data: row, error } = await svc
      .from('orders')
      .select('id, order_number, status, payment_method, subtotal_eur, shipping_eur, total_eur')
      .eq('id', res.json.orderId)
      .single();
    if (error) throw new Error(`orders select: ${error.message}`);
    order1 = row;
    check('commande status=pending (virement)', row.status === 'pending', `status=${row.status}`);
    check('payment_method=virement', row.payment_method === 'virement');
    check('sous-total serveur 60 + livraison 5.9', Number(row.subtotal_eur) === 60 && Number(row.shipping_eur) === 5.9, `subtotal=${row.subtotal_eur} shipping=${row.shipping_eur}`);

    const ghost = await historyRows(userA.id, `order_${row.id}`);
    check('AUCUNE ligne loyalty order_<id> à la création', ghost.length === 0, `rows=${ghost.length}`);

    const prof = await profileOf(userA.id);
    check('solde inchangé (1075)', prof.loyalty_points === 1075, `profil=${prof.loyalty_points}`);

    const { data: product } = await svc.from('shop_products').select('stock').eq('slug', PRODUCT_SLUG).single();
    check('stock décrémenté 10 → 8', product.stock === 8, `stock=${product.stock}`);

    const { data: movements } = await svc
      .from('stock_movements')
      .select('quantity_change, movement_type, reference_type, reference_id')
      .eq('reference_id', row.id);
    check('1 mouvement de stock sale -2', movements.length === 1 && movements[0].quantity_change === -2 && movements[0].movement_type === 'sale' && movements[0].reference_type === 'order', JSON.stringify(movements));
    await assertInvariant(userA.id, 'A après commande pending');
  });

  await step('7. Confirmation admin ⇒ crédit unique (total×10), rejeu 409', async () => {
    await grantAdmin(userA.id);
    const csrf = await pageA.evaluate(async () => {
      const res = await fetch('/api/admin/csrf');
      const json = await res.json().catch(() => null);
      return { status: res.status, token: json?.data?.csrfToken ?? null };
    });
    check('jeton CSRF admin émis', csrf.status === 200 && Boolean(csrf.token), `status=${csrf.status}`);

    const confirm = await api(pageA, '/api/admin/orders/confirm', { orderId: order1.id }, { 'x-admin-csrf': csrf.token });
    check('confirm 200 success', confirm.status === 200 && confirm.json?.ok === true && confirm.json?.data?.success === true, JSON.stringify(confirm));

    const { data: row } = await svc.from('orders').select('status').eq('id', order1.id).single();
    check('commande status=confirmed', row.status === 'confirmed', `status=${row.status}`);

    const expectedPoints = pointsForTotalEur(order1.total_eur);
    const purchases = await historyRows(userA.id, `order_${order1.id}`);
    check('EXACTEMENT 1 ligne purchase order_<id>', purchases.length === 1 && purchases[0].type === 'purchase', JSON.stringify(purchases));
    check(`points achat = (total×10) = ${expectedPoints}`, purchases[0]?.points === expectedPoints, `points=${purchases[0]?.points}`);

    const prof = await profileOf(userA.id);
    check(`profil synchronisé (${1075 + expectedPoints})`, prof.loyalty_points === 1075 + expectedPoints, `profil=${prof.loyalty_points} level=${prof.loyalty_level}`);

    const replay = await api(pageA, '/api/admin/orders/confirm', { orderId: order1.id }, { 'x-admin-csrf': csrf.token });
    check('rejeu confirm ⇒ 409 not_confirmable', replay.status === 409 && replay.json?.error?.code === 'not_confirmable', JSON.stringify(replay));
    await assertInvariant(userA.id, 'A après confirmation');
  });

  await step('8. Annulation pending + isolation inter-utilisateurs', async () => {
    const res = await createOrder(pageA, 1);
    check('2e commande virement créée (pending)', res.status === 200 && res.json?.success === true, JSON.stringify({ status: res.status, orderNumber: res.json?.orderNumber }));
    order2 = { id: res.json.orderId };

    // B vise la commande PENDING de A tant qu'elle l'est : sans filtre user_id,
    // B l'annulerait (elle est annulable) — c'est le vrai test d'isolation.
    const cross = await api(pageB, '/api/orders/cancel', { orderId: order2.id });
    check('B ne peut pas annuler la commande pending de A ⇒ 409 not_cancellable', cross.status === 409 && cross.json?.error === 'not_cancellable', JSON.stringify(cross));
    const { data: stillPending } = await svc.from('orders').select('status').eq('id', order2.id).single();
    check('commande 2 toujours pending après la tentative de B', stillPending.status === 'pending', `status=${stillPending.status}`);

    const before = await profileOf(userA.id);

    const cancel = await api(pageA, '/api/orders/cancel', { orderId: order2.id });
    check('annulation 200 success', cancel.status === 200 && cancel.json?.success === true, JSON.stringify(cancel));

    const { data: row } = await svc.from('orders').select('status').eq('id', order2.id).single();
    check('commande 2 status=cancelled', row.status === 'cancelled', `status=${row.status}`);

    const ghost = await historyRows(userA.id, `order_${order2.id}`);
    const after = await profileOf(userA.id);
    check('aucune écriture points fantôme (journal + solde inchangés)', ghost.length === 0 && after.loyalty_points === before.loyalty_points, `ghost=${ghost.length} profil=${after.loyalty_points}`);

    await assertInvariant(userA.id, 'A après annulation');
  });

  await step('9. Invariant final A et B : loyalty_points = Σ journal', async () => {
    await assertInvariant(userA.id, 'A final');
    await assertInvariant(userB.id, 'B final');
  });

  await step('10. Smoke mobile (/fidelite + /panier, viewport 390×844)', async () => {
    const ctxM = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const pageM = await ctxM.newPage();
    await login(pageM, EMAIL_A);

    // Écouteurs attachés APRÈS login et bornés aux documents/ressources des
    // pages sous test : les rapports CSP navigateur postés sur
    // /api/telemetry/hub (bruit local préexistant) ne polluent plus la mesure.
    const consoleErrors = [];
    const failedResponses = [];
    pageM.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    pageM.on('response', (res) => {
      if (res.status() < 400) return;
      const { pathname } = new URL(res.url());
      if (!pathname.startsWith('/fidelite') && !pathname.startsWith('/panier')) return;
      failedResponses.push({ status: res.status(), url: res.url() });
    });

    const fid = await pageM.goto(`${APP_URL}/fidelite`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await pageM.waitForTimeout(4000);
    check('mobile /fidelite HTTP < 400', fid.status() < 400, `status=${fid.status()}`);
    const bodyText = (await pageM.textContent('body')) ?? '';
    const expectedBalance = (await profileOf(userA.id)).loyalty_points;
    const formatted = expectedBalance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
    check(
      `la page fidélité affiche le solde (${formatted})`,
      bodyText.includes(formatted) || bodyText.includes(String(expectedBalance)),
      `solde=${expectedBalance}`
    );

    const pan = await pageM.goto(`${APP_URL}/panier`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await pageM.waitForTimeout(3000);
    check('mobile /panier HTTP < 400', pan.status() < 400, `status=${pan.status()}`);

    const blocking = consoleErrors.filter(
      (msg) => !/favicon|net::ERR|Failed to load resource|websocket/i.test(msg)
    );
    check('aucun console.error bloquant mobile', blocking.length === 0, `errors=${JSON.stringify(consoleErrors)}`);
    check(
      'aucune réponse ≥400 sur /fidelite et /panier',
      failedResponses.length === 0,
      `count=${failedResponses.length} ${JSON.stringify(failedResponses)}`
    );
    await ctxM.close();
  });

  log(`\nALL ${checks} CHECKS PASSED`);
  log(`LOG_FILE=${LOG_FILE}`);
  await browser.close();
  browser = null;
  process.exit(0);
} catch (err) {
  if (browser) await browser.close().catch(() => {});
  log(`\nFAILED after ${checks} checks: ${err instanceof Error ? err.message : String(err)}`);
  log(`LOG_FILE=${LOG_FILE}`);
  process.exit(1);
}
