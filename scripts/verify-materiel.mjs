// scripts/verify-materiel.mjs
// Harness de vérification : connecte le compte démo et vérifie que chaque
// table "Mon Matériel" contient des données (anti-page-vide).
// Usage : node scripts/verify-materiel.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Identifiants Supabase manquants.'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });

const CHECKS = [
  ['product_ownership', 'inventaire', 'user_id'],
  ['materiel_kits', 'kits', 'user_id'],
  ['materiel_kit_items', 'articles de kit', 'user_id'],
  ['alerts', 'alertes', 'user_id'],
  ['materiel_loans', 'prêts', 'lender_id'],
  ['depart_participants', 'participants', 'user_id'],
  ['materiel_kit_history', 'historique', 'user_id'],
];

async function main() {
  const { data: signIn } = await supabase.auth.signInWithPassword({ email: 'demo@lkdv.app', password: 'DemoPass!2026' });
  if (!signIn.user) { console.error('Login démo échoué — exécutez scripts/seed/seed-materiel.mjs'); process.exit(1); }
  const uid = signIn.user.id;
  const authed = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: 'Bearer ' + signIn.session.access_token } } });

  let failures = 0;
  for (const [table, label, col] of CHECKS) {
    const { count, error } = await authed.from(table).select('*', { count: 'exact', head: true }).eq(col, uid);
    const ok = !error && (count ?? 0) > 0;
    console.log(`${ok ? '✓' : '✗'} ${label} (${table}) : ${count ?? 0}`);
    if (!ok) failures++;
  }
  console.log(failures === 0 ? '\n✅ Toutes les tables sont peuplées.' : `\n⚠️ ${failures} table(s) vides.`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });