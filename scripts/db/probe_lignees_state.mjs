#!/usr/bin/env node
/**
 * SONDAGE LECTURE SEULE de l'état réel de la base prod (chantier Lignées).
 * Vérifie quelle migration est réellement appliquée, quelle table de profil
 * existe, et produit le côté « base » de la réconciliation Stripe (couverture
 * orders) — jamais d'écriture.
 *
 * Usage : node scripts/db/probe_lignees_state.mjs
 * Clés : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Clés manquantes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — rien exécuté.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function col(table, cols) {
  const { data, error } = await sb.from(table).select(cols).limit(1).maybeSingle();
  return error ? `✗ ${error.code ?? ''} ${error.message.slice(0, 90)}` : (data ? 'ok (ligne trouvée)' : 'ok (table vide)');
}

async function countRows(table, extra = {}) {
  let q = sb.from(table).select('*', { count: 'exact', head: true });
  if (extra.notNull) q = q.not(extra.notNull, 'is', null);
  if (extra.like) q = q.like(extra.like, 'Stripe session: %');
  const { count, error } = await q;
  return error ? `✗ ${error.code ?? ''}` : (count ?? 0);
}

console.log('———————————————— SONDAGE ÉTAT BASE (lecture seule) ————————————————');
console.log(`Cible : ${url}`);

console.log('\n■ Table de profil (Lot A.1)');
console.log('  user_profiles :', await col('user_profiles', 'id'));
console.log('  profiles      :', await col('profiles', 'id'));

console.log('\n■ Migration 1 — kit_lineage');
console.log('  materiel_kits.forked_from      :', await col('materiel_kits', 'forked_from'));
console.log('  materiel_kits.lineage_root_id  :', await col('materiel_kits', 'lineage_root_id'));

console.log('\n■ Migration 2 — kit_field_proof');
console.log('  kit_field_reports              :', await col('kit_field_reports', 'id'));
console.log('  hike_sessions.kit_id           :', await col('hike_sessions', 'kit_id'));
console.log('  hiking_routes.region           :', await col('hiking_routes', 'region'));

console.log('\n■ Migration 3 — stripe_fix');
console.log('  orders.stripe_session_id       :', await col('orders', 'stripe_session_id'));
console.log('  checkout_intents               :', await col('checkout_intents', 'id'));

console.log('\n■ Migration 4 — kit_conservation');
console.log('  kit_trust_scores (matview)     :', await col('kit_trust_scores', 'user_id'));

console.log('\n■ Lot 6 (doit être ABSENT)');
console.log('  royalty_config                 :', await col('royalty_config', 'id'));
console.log('  kit_attributions               :', await col('kit_attributions', 'id'));
console.log('  kit_royalty_shares             :', await col('kit_royalty_shares', 'id'));

console.log('\n■ Volume (contexte)');
console.log('  materiel_kits                  :', await countRows('materiel_kits'));
console.log('  hike_sessions                  :', await countRows('hike_sessions'));
console.log('  orders (total)                 :', await countRows('orders'));

console.log('\n■ Couverture orders (réconciliation, côté base)');
console.log('  orders avec stripe_session_id  :', await countRows('orders', { notNull: 'stripe_session_id' }));
console.log('  orders notes legacy            :', await countRows('orders', { like: 'notes' }));

console.log('\n———————————————— FIN SONDAGE (aucune écriture) ————————————————');