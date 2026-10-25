#!/usr/bin/env node
/**
 * Banc SQL du chantier Récompenses (migration 20261025120000_rewards_points_v1).
 *
 * Usage : REWARDS_TEST_DB_URL=postgres://user:pass@127.0.0.1:5432/postgres \
 *         node scripts/rewards/db-verify.mjs [rapport.json]
 *
 * Crée une base JETABLE `rewards_verify_<horodatage>` sur le serveur indiqué
 * (jamais la production : le script refuse un hôte qui n'est pas local),
 * charge la copie des objets de production (supabase/tests/rewards/
 * fixture_prod_subset.sql), prouve l'écart legacy AVANT migration, applique
 * la migration deux fois, puis vérifie idempotence, quotas, concurrence réelle
 * (connexions simultanées), double dépense, compensations, permissions et RLS.
 * Sortie : une ligne par contrôle + rapport JSON ; code 1 si un contrôle échoue.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATION = path.join(ROOT, 'supabase/migrations/20261025120000_rewards_points_v1.sql');
const FIXTURE = path.join(ROOT, 'supabase/tests/rewards/fixture_prod_subset.sql');

const baseUrl = process.env.REWARDS_TEST_DB_URL;
if (!baseUrl) {
  console.error('REWARDS_TEST_DB_URL manquant');
  process.exit(2);
}
const parsed = new URL(baseUrl);
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname)) {
  console.error(`Refus : ${parsed.hostname} n'est pas un hôte local. Ce banc ne tourne que sur une base jetable.`);
  process.exit(2);
}

const dbName = `rewards_verify_${Date.now()}`;
const results = [];
let failures = 0;

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail ?? null });
  if (!ok) failures += 1;
  console.info(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}

function dbUrl(name) {
  const u = new URL(baseUrl);
  u.pathname = `/${name}`;
  return u.toString();
}

async function connect() {
  const client = new pg.Client({ connectionString: dbUrl(dbName) });
  await client.connect();
  return client;
}

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const R_FUNDED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const R_UNFUNDED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const R_LAST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function rpc(client, fn, args) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await client.query(`SELECT public.${fn}(${placeholders}) AS r`, args);
  return rows[0].r;
}

async function balanceOf(client, userId) {
  const { rows } = await client.query(
    `SELECT COALESCE((SELECT SUM(points) FROM public.loyalty_history WHERE user_id = $1), 0)::int AS ledger,
            (SELECT loyalty_points FROM public.user_profiles WHERE id = $1) AS profile`,
    [userId]
  );
  return rows[0];
}

async function main() {
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const c = await connect();
  try {
    await c.query(readFileSync(FIXTURE, 'utf8'));

    // Données de départ : membres, un admin, soldes ouverts par le journal.
    await c.query(`INSERT INTO auth.users (id) VALUES ($1), ($2), ($3)`, [U1, U2, ADMIN]);
    await c.query(
      `INSERT INTO public.user_profiles (id, email, role) VALUES ($1, 'u1@test.invalid', 'user'), ($2, 'u2@test.invalid', 'user'), ($3, 'admin@test.invalid', 'admin')`,
      [U1, U2, ADMIN]
    );
    await c.query(
      `INSERT INTO public.loyalty_history (user_id, action, points, type, source_id) VALUES
        ($1, 'Solde d''ouverture', 1000, 'opening_balance', 'opening:u1'),
        ($2, 'Solde d''ouverture', 300, 'opening_balance', 'opening:u2')`,
      [U1, U2]
    );
    await c.query(
      `INSERT INTO public.loyalty_rewards (id, title, points_cost) VALUES
        ($1, 'Gourde financée', 400), ($2, 'Lampe non financée', 500), ($3, 'Dernière pièce', 100)`,
      [R_FUNDED, R_UNFUNDED, R_LAST]
    );
    await c.query(`INSERT INTO public.reward_accounts (user_id) VALUES ($1), ($2)`, [U1, U2]);
    await c.query(
      `INSERT INTO public.reward_withdrawals (user_id, amount, status, payment_provider, metadata, risk_score)
       VALUES ($1, 25, 'pending', 'bank_transfer', '{"iban": "FR7630006000011234567890189"}', 12)`,
      [U1]
    );

    // ── Écart legacy AVANT migration : un message de groupe crédite sans preuve.
    const before = await c.query(
      `SELECT public.claim_reward_points($1, 'group_message', gen_random_uuid(), 'group', '{}'::jsonb) AS id`,
      [U1]
    );
    const tx = await c.query(`SELECT count(*)::int AS n FROM public.reward_transactions WHERE user_id = $1`, [U1]);
    check('legacy avant migration : group_message auto-approuvé sans fait vérifié', before.rows[0].id && tx.rows[0].n === 1, { transactions: tx.rows[0].n });

    // ── Migration appliquée deux fois (idempotence du fichier).
    const migrationSql = readFileSync(MIGRATION, 'utf8');
    await c.query(migrationSql);
    await c.query(migrationSql);
    check('migration rejouée deux fois sans erreur', true);

    const ks = await c.query(`SELECT value FROM public.reward_config WHERE key = 'kill_switches'`);
    check('kill_switches : rewards_active=false, cashout_active conservé', ks.rows[0].value.rewards_active === false && ks.rows[0].value.cashout_active === true, ks.rows[0].value);

    let closedError = null;
    try {
      await c.query(`SELECT public.claim_reward_points($1, 'group_message', gen_random_uuid(), 'group', '{}'::jsonb)`, [U1]);
    } catch (err) {
      closedError = err.message;
    }
    check('legacy après migration : claim_reward_points refuse', /temporairement désactivées/.test(closedError ?? ''), closedError);

    const prog = await c.query(`SELECT value FROM public.reward_config WHERE key = 'points_program'`);
    check('points_program créé fermé, plafond 250', prog.rows[0].value.emission_open === false && prog.rows[0].value.weekly_cap === 250, prog.rows[0].value.version);

    const funding = await c.query(`SELECT count(*)::int AS n, count(*) FILTER (WHERE funding_status = 'unfunded')::int AS unfunded FROM public.reward_catalog_funding`);
    check('catalogue existant : une ligne de financement par objet, toutes non financées', funding.rows[0].n === 3 && funding.rows[0].unfunded === 3, funding.rows[0]);

    // Configuration « financé » incomplète refusée par contrainte.
    let incompleteRefused = false;
    try {
      await c.query(`UPDATE public.reward_catalog_funding SET funding_status = 'funded' WHERE reward_id = $1`, [R_FUNDED]);
    } catch {
      incompleteRefused = true;
    }
    check('financement : « funded » sans coût/financeur/budget/stock refusé', incompleteRefused);

    // ── Émission fermée : aucune écriture.
    const closed = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-1']);
    const awardsAfterClosed = await c.query(`SELECT count(*)::int AS n FROM public.reward_awards`);
    check('attribution refusée tant que l’émission est fermée, rien écrit', closed.error === 'emission_closed' && awardsAfterClosed.rows[0].n === 0, closed);

    // Ouverture programme mais producteur fermé.
    await c.query(`UPDATE public.reward_config SET value = jsonb_set(value, '{emission_open}', 'true') WHERE key = 'points_program'`);
    const producerClosed = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-1']);
    check('producteur fermé : refus sans écriture', producerClosed.error === 'producer_closed', producerClosed);

    // Ouverture de tous les producteurs POUR LE TEST UNIQUEMENT.
    await c.query(`
      UPDATE public.reward_config
         SET value = jsonb_set(jsonb_set(jsonb_set(jsonb_set(value,
           '{rules,activity_validated,producer_open}', 'true'),
           '{rules,useful_story,producer_open}', 'true'),
           '{rules,help_accepted,producer_open}', 'true'),
           '{rules,preparation_done,producer_open}', 'true')
       WHERE key = 'points_program'`);

    const unknown = await rpc(c, 'rewards_award_points', [U1, 'like_given', 'post', 'p-1']);
    check('règle inconnue refusée (pas de gain par like)', unknown.error === 'unknown_rule', unknown);

    const invalid = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'Hike Session!', 's-1']);
    check('entrée invalide refusée', invalid.error === 'invalid_input', invalid);

    const first = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-1']);
    const b1 = await balanceOf(c, U1);
    check('sortie validée : +50 confirmés, journal = profil', first.status === 'confirmed' && first.points === 50 && b1.ledger === 1050 && b1.profile === 1050, { first, b1 });

    const dup = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-1']);
    const b1b = await balanceOf(c, U1);
    check('même fait rejoué : doublon, aucun nouveau crédit', dup.status === 'duplicate' && b1b.ledger === 1050, dup);

    // Changement de version du barème : le même fait reste dédupliqué.
    await c.query(`UPDATE public.reward_config SET value = jsonb_set(value, '{version}', '"pilote-c-2026-11"') WHERE key = 'points_program'`);
    const dupVersion = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-1']);
    check('nouvelle version du barème : même fait non réclamable', dupVersion.status === 'duplicate', dupVersion);

    // Sous-plafond par règle (3 sorties/semaine).
    await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-2']);
    await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-3']);
    const fourth = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-4']);
    check('4e sortie de la semaine : refus « rule_limit », décision durable', fourth.status === 'refused' && fourth.reason === 'rule_limit', fourth);
    const fourthAgain = await rpc(c, 'rewards_award_points', [U1, 'activity_validated', 'hike_session', 's-4']);
    check('fait refusé rejoué : reste refusé (doublon)', fourthAgain.status === 'duplicate' && fourthAgain.award_status === 'refused', fourthAgain);

    // Attente de vérification : comptée dans le plafond, pas dans le solde.
    const story = await rpc(c, 'rewards_award_points', [U1, 'useful_story', 'carnet', 'c-1']);
    const b1c = await balanceOf(c, U1);
    check('récit utile : en vérification, solde inchangé', story.status === 'pending' && b1c.ledger === 1150, { story, b1c });

    const snapshotPending = await rpc(c, 'rewards_wallet_snapshot', [U1]);
    check('portefeuille : attente séparée du solde', snapshotPending.balance === 1150 && snapshotPending.pending_points === 25 && snapshotPending.week.used === 175, {
      balance: snapshotPending.balance, pending: snapshotPending.pending_points, used: snapshotPending.week.used,
    });
    check('portefeuille : droits legacy séparés, seuil de retrait lu en configuration',
      snapshotPending.legacy.cashout_active === true && Number(snapshotPending.legacy.cashout_min_threshold) === 20
        && snapshotPending.legacy.economic_points === 0,
      snapshotPending.legacy);
    const wd = snapshotPending.legacy.withdrawals ?? [];
    check('portefeuille : retraits listés sans coordonnées bancaires ni score de risque',
      wd.length === 1 && Number(wd[0].amount) === 25 && !JSON.stringify(wd).includes('FR76') && !('risk_score' in wd[0]) && !('metadata' in wd[0]),
      wd);
    check('portefeuille : coût et financeur jamais exposés',
      snapshotPending.catalog.every((entry) => !('cost_cents' in entry) && !('funder' in entry) && !('budget_reference' in entry)),
      Object.keys(snapshotPending.catalog[0] ?? {}));

    const approve = await rpc(c, 'rewards_decide_award', [story.award_id, true, null]);
    const approveAgain = await rpc(c, 'rewards_decide_award', [story.award_id, true, null]);
    const b1d = await balanceOf(c, U1);
    check('validation du récit : +25 une seule fois', approve.status === 'confirmed' && approveAgain.idempotent === true && b1d.ledger === 1175, { approve, approveAgain, b1d });

    // Plafond hebdomadaire 250 : gain entier ou rien (used = 175).
    await rpc(c, 'rewards_award_points', [U1, 'help_accepted', 'answer', 'a-1']); // pending 25 → used 200
    await rpc(c, 'rewards_award_points', [U1, 'preparation_done', 'trip', 't-1']); // +10 → used 210
    await rpc(c, 'rewards_award_points', [U1, 'help_accepted', 'answer', 'a-2']); // pending 25 → used 235
    const story2 = await rpc(c, 'rewards_award_points', [U1, 'useful_story', 'carnet', 'c-2']); // 235+25 > 250
    check('plafond 250 : un gain qui dépasserait est refusé entier', story2.status === 'refused' && story2.reason === 'weekly_cap' && story2.week_remaining === 15, story2);
    const snapCap = await rpc(c, 'rewards_wallet_snapshot', [U1]);
    check('plafond jamais dépassé (confirmé + attente ≤ 250)', snapCap.week.used <= 250, snapCap.week);

    // ── Quotas concurrents : 6 attributions simultanées sur 6 connexions.
    // U2 : 3 sorties max/semaine ; 6 faits distincts lancés en même temps.
    const pool = await Promise.all(Array.from({ length: 6 }, () => connect()));
    try {
      const concurrent = await Promise.all(pool.map((client, i) =>
        rpc(client, 'rewards_award_points', [U2, 'activity_validated', 'hike_session', `cc-${i}`])
      ));
      const confirmed = concurrent.filter((r) => r.status === 'confirmed').length;
      const refused = concurrent.filter((r) => r.status === 'refused').length;
      const b2 = await balanceOf(c, U2);
      check('concurrence : 6 attributions simultanées → 3 confirmées, 3 refusées', confirmed === 3 && refused === 3 && b2.ledger === 450, { confirmed, refused, ledger: b2.ledger });

      // Même fait envoyé 6 fois en même temps : une seule décision.
      const sameFact = await Promise.all(pool.map((client) =>
        rpc(client, 'rewards_award_points', [U2, 'preparation_done', 'trip', 'same-trip']).catch((err) => ({ error: err.message }))
      ));
      const created = sameFact.filter((r) => r.status === 'confirmed').length;
      const rows = await c.query(`SELECT count(*)::int AS n FROM public.reward_awards WHERE user_id = $1 AND source_id = 'same-trip'`, [U2]);
      check('concurrence : même fait ×6 simultané → une seule attribution', created === 1 && rows.rows[0].n === 1, { created, rows: rows.rows[0].n, other: sameFact.map((r) => r.status ?? r.error) });

      // ── Échanges.
      const unfunded = await rpc(c, 'rewards_redeem', [U1, R_UNFUNDED, 'key-unfunded-01']);
      check('échange d’un objet non financé refusé, aucun débit', unfunded.error === 'reward_unfunded' && (await balanceOf(c, U1)).ledger === 1185, unfunded);

      await c.query(
        `UPDATE public.reward_catalog_funding SET funding_status = 'funded', cost_cents = 1200, funder = 'Marge boutique (test)', budget_reference = 'TEST-ONLY', stock_remaining = 2 WHERE reward_id = $1`,
        [R_FUNDED]
      );
      await c.query(
        `UPDATE public.reward_catalog_funding SET funding_status = 'funded', cost_cents = 300, funder = 'Marge boutique (test)', budget_reference = 'TEST-ONLY', stock_remaining = 1 WHERE reward_id = $1`,
        [R_LAST]
      );

      const badKey = await rpc(c, 'rewards_redeem', [U1, R_FUNDED, 'x']);
      check('clé d’idempotence invalide refusée', badKey.error === 'invalid_input', badKey);

      const red1 = await rpc(c, 'rewards_redeem', [U1, R_FUNDED, 'key-redeem-0001']);
      const b1e = await balanceOf(c, U1);
      const stock1 = await c.query(`SELECT stock_remaining FROM public.reward_catalog_funding WHERE reward_id = $1`, [R_FUNDED]);
      check('échange financé : réservé, débit 400, stock 2→1', red1.status === 'reserved' && b1e.ledger === 785 && b1e.profile === 785 && stock1.rows[0].stock_remaining === 1, { red1, b1e, stock: stock1.rows[0] });

      const red1Replay = await rpc(c, 'rewards_redeem', [U1, R_FUNDED, 'key-redeem-0001']);
      check('échange rejoué (même clé) : idempotent, aucun second débit', red1Replay.idempotent === true && red1Replay.reference === red1.reference && (await balanceOf(c, U1)).ledger === 785, red1Replay);

      const conflict = await rpc(c, 'rewards_redeem', [U1, R_LAST, 'key-redeem-0001']);
      check('même clé pour un autre objet : conflit', conflict.error === 'idempotency_conflict', conflict);

      // Double dépense concurrente : U2 (450 points) tente 2 × 400 en même temps.
      await c.query(`UPDATE public.reward_catalog_funding SET stock_remaining = 5 WHERE reward_id = $1`, [R_FUNDED]);
      const doubleSpend = await Promise.all([
        rpc(pool[0], 'rewards_redeem', [U2, R_FUNDED, 'key-double-0001']),
        rpc(pool[1], 'rewards_redeem', [U2, R_FUNDED, 'key-double-0002']),
      ]);
      const ok = doubleSpend.filter((r) => r.status === 'reserved').length;
      const insufficient = doubleSpend.filter((r) => r.error === 'insufficient_balance').length;
      const b2b = await balanceOf(c, U2);
      check('double dépense simultanée : une réservée, une refusée, solde ≥ 0', ok === 1 && insufficient === 1 && b2b.ledger === 60, { results: doubleSpend.map((r) => r.status ?? r.error), ledger: b2b.ledger });

      // Dernière pièce : deux membres en même temps.
      await c.query(`INSERT INTO public.loyalty_history (user_id, action, points, type, source_id) VALUES ($1, 'Test', 100, 'opening_balance', 'opening:u2-bis')`, [U2]);
      const lastPiece = await Promise.all([
        rpc(pool[2], 'rewards_redeem', [U1, R_LAST, 'key-last-u1-01']),
        rpc(pool[3], 'rewards_redeem', [U2, R_LAST, 'key-last-u2-01']),
      ]);
      const reserved = lastPiece.filter((r) => r.status === 'reserved').length;
      const outOfStock = lastPiece.filter((r) => r.error === 'out_of_stock').length;
      const stockLast = await c.query(`SELECT stock_remaining FROM public.reward_catalog_funding WHERE reward_id = $1`, [R_LAST]);
      check('dernière pièce disputée : une réservation, une rupture, stock 0', reserved === 1 && outOfStock === 1 && stockLast.rows[0].stock_remaining === 0, { results: lastPiece.map((r) => r.status ?? r.error) });

      // ── Compensations.
      const cancel = await rpc(c, 'rewards_cancel_redemption', [red1.redemption_id, 'Annulation demandée par le membre']);
      const cancelAgain = await rpc(c, 'rewards_cancel_redemption', [red1.redemption_id, 'Annulation demandée par le membre']);
      const b1f = await balanceOf(c, U1);
      check('annulation : +400 rendus une seule fois, stock remis', cancel.status === 'cancelled' && cancelAgain.idempotent === true && b1f.ledger === b1e.ledger + 400 - (lastPiece[0].status === 'reserved' ? 100 : 0), { cancel, cancelAgain, ledger: b1f.ledger });

      const legacyRow = await c.query(
        `INSERT INTO public.loyalty_redemptions (user_id, reward_id, points_spent, status) VALUES ($1, $2, 120, 'fulfilled') RETURNING id`,
        [U1, R_UNFUNDED]
      );
      const legacyCancel = await rpc(c, 'rewards_cancel_redemption', [legacyRow.rows[0].id, 'test']);
      check('échange historique « fulfilled » : non annulable par ce chemin', legacyCancel.error === 'not_cancellable', legacyCancel);

      // Contre-écriture plafonnée au solde, sans toucher aux XP.
      const xpBefore = await c.query(`SELECT xp FROM public.user_profiles WHERE id = $1`, [U2]);
      const u2Award = await c.query(`SELECT id FROM public.reward_awards WHERE user_id = $1 AND status = 'confirmed' AND rule_key = 'activity_validated' LIMIT 1`, [U2]);
      const b2c = await balanceOf(c, U2);
      const reverse = await rpc(c, 'rewards_reverse_award', [u2Award.rows[0].id, 'Sortie non plausible après contrôle']);
      const reverseAgain = await rpc(c, 'rewards_reverse_award', [u2Award.rows[0].id, 'Sortie non plausible après contrôle']);
      const b2d = await balanceOf(c, U2);
      const xpAfter = await c.query(`SELECT xp FROM public.user_profiles WHERE id = $1`, [U2]);
      check('contre-écriture : idempotente, débit ≤ solde, reliquat tracé, XP intacts',
        reverse.status === 'reversed' && reverseAgain.idempotent === true && b2d.ledger >= 0
          && reverse.debited + reverse.shortfall === 50 && b2d.ledger === b2c.ledger - reverse.debited
          && xpBefore.rows[0].xp === xpAfter.rows[0].xp,
        { reverse, before: b2c.ledger, after: b2d.ledger });

      const reverseMissingReason = await rpc(c, 'rewards_reverse_award', [u2Award.rows[0].id, '  ']);
      check('contre-écriture sans motif refusée', reverseMissingReason.error === 'invalid_input', reverseMissingReason);

      // ── Objectif.
      const goal = await rpc(c, 'rewards_set_goal', [U1, R_UNFUNDED]);
      const b1g = await balanceOf(c, U1);
      check('choisir un objectif ne dépense rien', goal.success === true && b1g.ledger === b1f.ledger, goal);
      await c.query(`UPDATE public.loyalty_rewards SET available = false WHERE id = $1`, [R_LAST]);
      const goalUnavailable = await rpc(c, 'rewards_set_goal', [U1, R_LAST]);
      check('objectif indisponible refusé', goalUnavailable.error === 'reward_unavailable', goalUnavailable);
      const clearGoal = await rpc(c, 'rewards_set_goal', [U1, null]);
      check('objectif retiré', clearGoal.success === true && clearGoal.goal === null, clearGoal);

      // ── Journal : idempotence garantie par l'index unique.
      let dupHistory = false;
      try {
        await c.query(`INSERT INTO public.loyalty_history (user_id, action, points, type, source_id) VALUES ($1, 'x', 1, 'earned', 'opening:u1')`, [U1]);
      } catch {
        dupHistory = true;
      }
      check('journal : (membre, source) unique en base', dupHistory);

      const legacySpend = await rpc(c, 'legacy_loyalty_spend', [U1, 10, 'Article offert', 'cart_free_apply:item-1']);
      const legacySpendReplay = await rpc(c, 'legacy_loyalty_spend', [U1, 10, 'Article offert', 'cart_free_apply:item-1']);
      check('non-régression panier : dépense legacy idempotente', legacySpend.success === true && legacySpendReplay.idempotent === true, { legacySpend, legacySpendReplay });

      // ── Réconciliation globale.
      const drift = await c.query(`
        SELECT count(*)::int AS n FROM public.user_profiles p
        WHERE COALESCE(p.loyalty_points, 0) <> COALESCE((SELECT SUM(points) FROM public.loyalty_history h WHERE h.user_id = p.id), 0)`);
      check('réconciliation : aucun écart journal ↔ profil', drift.rows[0].n === 0, drift.rows[0]);
      const negative = await c.query(`SELECT count(*)::int AS n FROM (SELECT user_id, SUM(points) s FROM public.loyalty_history GROUP BY 1) t WHERE s < 0`);
      check('aucun solde négatif', negative.rows[0].n === 0, negative.rows[0]);
    } finally {
      await Promise.all(pool.map((client) => client.end()));
    }

    // ── Permissions.
    const fns = [
      'rewards_program_config()', 'rewards_award_points(uuid,text,text,text)', 'rewards_decide_award(uuid,boolean,text)',
      'rewards_reverse_award(uuid,text)', 'rewards_redeem(uuid,uuid,text)', 'rewards_cancel_redemption(uuid,text)',
      'rewards_set_goal(uuid,uuid)', 'rewards_wallet_snapshot(uuid)',
    ];
    const perms = await c.query(`
      SELECT f,
        has_function_privilege('anon', 'public.' || f, 'EXECUTE') AS anon,
        has_function_privilege('authenticated', 'public.' || f, 'EXECUTE') AS auth,
        has_function_privilege('service_role', 'public.' || f, 'EXECUTE') AS service,
        (SELECT prosecdef FROM pg_proc WHERE oid = ('public.' || f)::regprocedure) AS definer,
        (SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = ('public.' || f)::regprocedure) AS config
      FROM unnest($1::text[]) AS f`, [fns]);
    const badPerm = perms.rows.filter((r) => r.anon || r.auth || !r.service || !r.definer || !/search_path=public, pg_temp/.test(r.config ?? ''));
    check('fonctions rewards_* : SECURITY DEFINER, search_path verrouillé, service_role seul', badPerm.length === 0, badPerm);

    // ── RLS : un membre ne lit que ses propres données ; financement invisible.
    // U1 garde un objectif : U2 ne doit pas le voir, U1 si.
    await rpc(c, 'rewards_set_goal', [U1, R_FUNDED]);
    await c.query(`BEGIN`);
    await c.query(`SET LOCAL ROLE authenticated`);
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [U1]);
    const ownerGoal = await c.query(`SELECT count(*)::int AS n FROM public.reward_goals`);
    await c.query(`ROLLBACK`);
    check('RLS : le propriétaire lit son objectif', ownerGoal.rows[0].n === 1, ownerGoal.rows[0]);
    await c.query(`BEGIN`);
    await c.query(`SET LOCAL ROLE authenticated`);
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [U2]);
    const ownAwards = await c.query(`SELECT DISTINCT user_id FROM public.reward_awards`);
    const ownGoals = await c.query(`SELECT count(*)::int AS n FROM public.reward_goals`);
    let fundingDenied = false;
    try {
      const f = await c.query(`SELECT count(*)::int AS n FROM public.reward_catalog_funding`);
      fundingDenied = f.rows[0].n === 0;
    } catch {
      fundingDenied = true;
    }
    let directWriteDenied = false;
    try {
      await c.query(`INSERT INTO public.reward_awards (user_id, rule_key, source_type, source_id, points, status, rules_version, period_start) VALUES ($1, 'activity_validated', 'hike_session', 'forged', 50, 'confirmed', 'x', current_date)`, [U2]);
    } catch {
      directWriteDenied = true;
    }
    await c.query(`ROLLBACK`);
    check('RLS : attributions limitées au propriétaire', ownAwards.rows.every((r) => r.user_id === U2), ownAwards.rows);
    check('RLS : objectifs d’autrui invisibles', ownGoals.rows[0].n === 0, ownGoals.rows[0]);
    check('financement interne invisible pour un membre', fundingDenied);
    check('écriture directe d’une attribution refusée à un membre', directWriteDenied);

    await c.query(`BEGIN`);
    await c.query(`SET LOCAL ROLE anon`);
    let anonDenied = false;
    try {
      await c.query(`SELECT public.rewards_wallet_snapshot($1)`, [U1]);
    } catch {
      anonDenied = true;
    }
    await c.query(`ROLLBACK`);
    check('anon ne peut pas lire un portefeuille', anonDenied);
  } finally {
    await c.end();
    const cleanup = new pg.Client({ connectionString: baseUrl });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await cleanup.end();
  }

  const report = {
    date: new Date().toISOString(),
    server: (await (async () => {
      const v = new pg.Client({ connectionString: baseUrl });
      await v.connect();
      const { rows } = await v.query('SHOW server_version');
      await v.end();
      return rows[0].server_version;
    })()),
    migration: path.relative(ROOT, MIGRATION),
    passed: results.filter((r) => r.ok).length,
    failed: failures,
    results,
  };
  const out = process.argv[2];
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));
  console.info(`\n${report.passed}/${results.length} contrôles réussis (Postgres ${report.server}).`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
