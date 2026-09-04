#!/usr/bin/env node
/**
 * RÉCONCILIATION STRIPE — paiements orphelins (LECTURE SEULE)
 * ===========================================================
 * Chantier « Lignées de kits » — docs/reports/RECONCILIATION_STRIPE.md
 *
 * Croise la vérité des encaissements (API Stripe) avec les commandes en base
 * (Supabase, service role) et sort la liste des ORPHELINS : sessions checkout
 * payées, non remboursées, sans commande correspondante.
 *
 * Le script NE TOUCHE À RIEN — aucune écriture Stripe ni Supabase.
 * La décision (honorer / rembourser / enquêter) reste à Tony, une fois la
 * livraison confirmée ou exclue.
 *
 * Usage :
 *   node scripts/db/reconcile_stripe.mjs [--limit 300]
 *
 * Exige dans .env.local (ne jamais commiter) :
 *   STRIPE_RESTRICTED_KEY    — Clé restreinte rk_live_... (lecture seule)
 *                              PERMISSIONS MINIMALES REQUISES DANS LE DASHBOARD STRIPE :
 *                                - Checkout Sessions : Read
 *                                - Charges : Read
 *                                - PaymentIntents : Read
 *                                - Refunds : Read
 *                              INTERDICTION : Les clés complètes sk_ sont refusées au démarrage.
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_URL  ou  NEXT_PUBLIC_SUPABASE_URL
 *
 * Confidentialité RGPD / PII :
 *   Les emails clients ne sont JAMAIS exportés en clair dans les rapports :
 *   ils sont hachés en SHA-256 tronqué à 10 caractères (ex: email_hash: 7a8f3b9c1d).
 *
 * Sorties (dans docs/reconciliation/) :
 *   orphans_<AAAA-MM-JJ>.csv   → tableau de décision prêt à coller dans
 *                                RECONCILIATION_STRIPE.md
 *   orphans_<AAAA-MM-JJ>.json  → données complètes (line_items inclus) pour
 *                                requêtes de suivi / template honorer
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../docs/reconciliation');

// ─── Config ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const MAX_SESSIONS = limitArg !== -1 ? Number(args[limitArg + 1]) : 300;

// VÉRIFICATION STRICTE DE SÉCURITÉ DE LA CLÉ STRIPE
const rawStripeKey = process.env.STRIPE_RESTRICTED_KEY;
const forbiddenSkKey = process.env.STRIPE_SECRET_KEY;

if (forbiddenSkKey && forbiddenSkKey.startsWith('sk_')) {
  console.error('❌ SÉCURITÉ (Zone Orange) : Détection de STRIPE_SECRET_KEY (sk_...).');
  console.error('   L\'utilisation de clés maîtresses sk_ est strictement interdite pour la réconciliation.');
  console.error('   Définissez uniquement STRIPE_RESTRICTED_KEY avec une clé restreinte rk_live_... (Read-only).');
  process.exit(1);
}

if (!rawStripeKey) {
  console.error('❌ Clé manquante : STRIPE_RESTRICTED_KEY doit être définie dans .env.local (rk_live_...).');
  console.error('   Permissions Stripe minimales requises en lecture seule :');
  console.error('     - Checkout Sessions : Read');
  console.error('     - PaymentIntents : Read');
  console.error('     - Charges : Read');
  console.error('     - Refunds : Read');
  process.exit(1);
}

if (rawStripeKey.startsWith('sk_')) {
  console.error('❌ SÉCURITÉ : La clé fournie commence par sk_.');
  console.error('   Seules les clés restreintes (rk_live_ ou rk_test_) sont autorisées.');
  process.exit(1);
}

if (!rawStripeKey.startsWith('rk_live_') && !rawStripeKey.startsWith('rk_test_')) {
  console.error('❌ Format invalide : STRIPE_RESTRICTED_KEY doit commencer par rk_live_ ou rk_test_.');
  process.exit(1);
}

const stripeKey = rawStripeKey;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [];
if (!supabaseUrl) missing.push('SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)');
if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (missing.length) {
  console.error(`❌ Clés Supabase manquantes dans .env.local : ${missing.join(', ')}`);
  console.error('   Rien exécuté — lecture seule, aucune donnée touchée.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: '2025-06-16.basil' });
const supabase = createClient(supabaseUrl, serviceKey);

// ─── Helpers ────────────────────────────────────────────────────────────────
const centsToEur = (c, currency) =>
  currency === 'eur' ? Number(c) / 100 : `${currency.toUpperCase()} ${(Number(c) / 100).toFixed(2)}`;

/** Hachage SHA-256 tronqué à 10 caractères pour respecter la vie privée (RGPD). */
const hashEmail = (email) =>
  email
    ? crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 10)
    : null;

async function listAll(fn, params, max) {
  const out = [];
  let cursor;
  do {
    const page = await fn({ ...params, limit: 100, starting_after: cursor ?? undefined });
    out.push(...page.data);
    cursor = page.data.length ? page.data[page.data.length - 1].id : undefined;
    if (out.length >= max) break;
  } while (cursor);
  return out.slice(0, max);
}

// ─── 1. Vérité des encaissements : sessions checkout PAYÉES ────────────────
console.log(`\n📡 Stripe : sessions checkout (status=complete) — max ${MAX_SESSIONS}…`);
const sessions = await listAll(
  (p) => stripe.checkout.sessions.list(p),
  { status: 'complete' },
  MAX_SESSIONS
);
const paid = sessions.filter((s) => s.payment_status === 'paid');
console.log(`   ${sessions.length} sessions complètes · ${paid.length} payées`);

// ─── 2. Remboursements connus ───────────────────────────────────────────────
console.log('📡 Stripe : refunds…');
const refunds = await listAll((p) => stripe.refunds.list(p), {}, 1000);
const refundedPIs = new Set(
  refunds.filter((r) => r.status === 'succeeded').map((r) => r.payment_intent)
);
console.log(`   ${refunds.length} refunds listés`);

// ─── 3. Couverture en base : orders (stripe_session_id + notes legacy) ─────
console.log('🛢️  Supabase : orders…');
const covered = new Set();
const coveredLegacy = new Set();
{
  // notes peut manquer selon la forme réelle de la table → re-tenter sans.
  let { data: orders, error } = await supabase
    .from('orders')
    .select('stripe_session_id, order_number, notes');

  if (error || !orders) {
    const retry = await supabase
      .from('orders')
      .select('stripe_session_id, order_number');
    if (retry.error || !retry.data) {
      console.error(`❌ Lecture orders impossible : ${retry.error?.message ?? error?.message}`);
      process.exit(1);
    }
    orders = retry.data;
  }

  for (const o of orders) {
    if (o.stripe_session_id) covered.add(o.stripe_session_id);
    if (o.notes) {
      for (const m of o.notes.matchAll(/Stripe session:\s*(cs_[A-Za-z0-9_]+)/g)) {
        if (m[1]) coveredLegacy.add(m[1]);
      }
    }
  }
}
console.log(`   ${covered.size} commandes au format actuel + ${coveredLegacy.size} legacy (notes)`);

// ─── 4. Orphelins : payées & non remboursées & non couvertes ───────────────
const orphansBase = paid
  .filter((s) => !refundedPIs.has(s.payment_intent))
  .filter((s) => !covered.has(s.id) && !coveredLegacy.has(s.id))
  .sort((a, b) => b.created - a.created || (b.amount_total ?? 0) - (a.amount_total ?? 0));

console.log(`\n🔎 ${orphansBase.length} orphelin(s) candidats → line items (identité produit)…`);
const orphans = [];
for (const s of orphansBase) {
  let lineItems = [];
  try {
    const li = await stripe.checkout.sessions.listLineItems(s.id, { limit: 25 });
    lineItems = li.data.map((i) => ({
      name: i.description ?? i.name ?? null,
      product_id: typeof i.price?.product === 'string' ? i.price.product : null,
      quantity: i.quantity,
      amount_cents: i.amount_total,
    }));
  } catch (e) {
    lineItems = [{ note: `line items indisponibles : ${e.message}` }];
  }
  orphans.push({
    date: new Date(s.created * 1000).toISOString().slice(0, 10),
    session_id: s.id,
    customer_email_hash: hashEmail(s.customer_email),
    amount_total_cents: s.amount_total ?? 0,
    currency: s.currency ?? 'eur',
    amount_eur: centsToEur(s.amount_total ?? 0, s.currency ?? 'eur'),
    payment_intent: s.payment_intent ?? null,
    line_items: lineItems,
    decision: '', // ← à remplir : honorer / rembourser / enquête
    order_number_or_refund: '',
  });
}

// ─── 5. Sorties ─────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const csvPath = path.join(OUT_DIR, `orphans_${today}.csv`);
const jsonPath = path.join(OUT_DIR, `orphans_${today}.json`);

// CSV au format tableau de décision de RECONCILIATION_STRIPE.md (séparateur ;)
const csvEsc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const csvRows = [
  ['Date paiement', 'Session ID', 'Hash email client (SHA-256:10)', 'Montant (€)', 'Décision (honorer/rembourser)', 'N° commande créé / refund ID'],
  ...orphans.map((o) => [
    o.date,
    o.session_id,
    o.customer_email_hash ? `hash_${o.customer_email_hash}` : '',
    o.amount_eur,
    o.decision,
    o.order_number_or_refund,
  ]),
];
fs.writeFileSync(csvPath, csvRows.map((r) => r.map(csvEsc).join(';')).join('\n'), 'utf8');
fs.writeFileSync(jsonPath, JSON.stringify(orphans, null, 2), 'utf8');

// ─── 6. Rendu console ───────────────────────────────────────────────────────
if (!orphans.length) {
  console.log('\n✅ AUCUN orphelin : tous les paiements payés non remboursés ont une commande en base.');
  console.log('   (Vérifier quand même la cohérence income : sum(orders.total_eur) ≈ sum(Stripe) − refunds)');
} else {
  const w1 = Math.max(...orphans.map((o) => o.session_id.length), 'SESSION ID'.length);
  const w2 = Math.max(...orphans.map((o) => (o.customer_email_hash ? `hash_${o.customer_email_hash}` : '').length), 'EMAIL HASH'.length);
  const line = (cols) => '  ' + cols.map((c, i) => String(c).padEnd([w1, w2, 12, 24][i] ?? 12)).join(' | ');
  console.log('\n' + line(['SESSION ID', 'EMAIL HASH', 'MONTANT', 'PRODUITS (line items)']));
  console.log('  ' + '-'.repeat(w1 + w2 + 42));
  for (const o of orphans) {
    const prods = o.line_items
      .filter((l) => l.name)
      .map((l) => `${l.name}×${l.quantity}`)
      .join(', ') || (o.line_items[0]?.note ?? '');
    const emailDisplay = o.customer_email_hash ? `hash_${o.customer_email_hash}` : '';
    console.log(line([o.session_id, emailDisplay, `${o.amount_eur}`, prods.slice(0, 24)]));
  }
  console.log(`\n📄 CSV prêt à décider : ${path.relative(process.cwd(), csvPath)}`);
  console.log(`📄 JSON complet (line items) : ${path.relative(process.cwd(), jsonPath)}`);
  console.log('\n⚠️  Rappel (règle d\'engagement) : ne JAMAIS créer une commande « honorée » sans');
  console.log('    confirmer la livraison ; ne JAMAIS rembourser sans vérifier qu\'aucun colis n\'est parti.');
}

// ─── 7. Cohérence (indicateur) ──────────────────────────────────────────────
const { data: totals, error: totalsErr } = await supabase
  .from('orders')
  .select('total_eur');
if (!totalsErr && totals) {
  const sumOrders = totals.reduce((a, o) => a + Number(o.total_eur || 0), 0);
  const sumStripe = paid.reduce((a, s) => a + (s.currency === 'eur' ? (s.amount_total ?? 0) / 100 : 0), 0);
  const sumRefunds = refunds
    .filter((r) => r.status === 'succeeded' && r.currency === 'eur')
    .reduce((a, r) => a + (r.amount || 0) / 100, 0);
  const deltaEur = (sumStripe - sumRefunds - sumOrders).toFixed(2);
  console.log(`\n🧮 Cohérence indicative : Σ Stripe payé ${sumStripe.toFixed(2)} € − refunds ${sumRefunds.toFixed(2)} € − Σ orders ${sumOrders.toFixed(2)} € = ${deltaEur} €`);
  console.log('   (l\'écart ≈ orphelins + commandes antérieures à stripe_session_id ; à interpréter, pas à égaliser d\'office)');
}