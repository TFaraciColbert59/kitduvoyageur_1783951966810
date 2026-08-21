// scripts/seed/seed-materiel.mjs
// Peuple la base "Mon Matériel" avec des données de démo sous un compte démo.
// Usage : node scripts/seed/seed-materiel.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Identifiants Supabase manquants (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const DEMO_EMAIL = 'demo@lkdv.app';
const DEMO_PASSWORD = 'DemoPass!2026';

async function ensureDemoUser() {
  // Tente une connexion ; sinon crée le compte.
  const { data: signIn } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (signIn.user) return signIn.user.id;

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
    user_metadata: { full_name: 'Utilisateur Démo' },
  });
  if (error || !created?.user) {
    console.error('Impossible de créer le compte démo :', error?.message ?? 'aucun utilisateur');
    process.exit(1);
  }
  return created.user.id;
}

async function main() {
  const demoUserId = await ensureDemoUser();
  console.log('Compte démo :', DEMO_EMAIL, '/', DEMO_PASSWORD);

  // Nettoie les données démo précédentes (idempotent)
  const kids = await supabase.from('materiel_kits').select('id').eq('user_id', demoUserId);
  const kitIds = (kids.data ?? []).map((k) => k.id);
  if (kitIds.length) await supabase.from('materiel_kit_history').delete().in('kit_id', kitIds);
  await supabase.from('depart_participants').delete().eq('user_id', demoUserId);
  await supabase.from('materiel_kit_items').delete().eq('user_id', demoUserId);
  await supabase.from('materiel_kits').delete().eq('user_id', demoUserId);
  await supabase.from('product_ownership').delete().eq('user_id', demoUserId);
  await supabase.from('alerts').delete().eq('user_id', demoUserId);
  await supabase.from('materiel_loans').delete().or(`lender_id.eq.${demoUserId},borrower_id.eq.${demoUserId}`);

  // 1. Inventaire (product_ownership)
  const items = [
    { name: 'Tente MSR Hubba 2P', brand: 'MSR', category: 'Couchage & Tentes', weight_g: 1780, price_cents: 54900, condition: 'bon', tags: ['tente', '2p'] },
    { name: 'Sac à dos Osprey 55L', brand: 'Osprey', category: 'Sacs & Portage', weight_g: 1650, price_cents: 19900, condition: 'bon', tags: ['sac', '55l'] },
    { name: 'Réchaud MSR PocketRocket', brand: 'MSR', category: 'Cuisine & Réchauds', weight_g: 73, price_cents: 6990, condition: 'neuf', tags: ['réchaud', 'gaz'] },
    { name: 'Trousse de secours', brand: 'Decathlon', category: 'Sécurité & Soins', weight_g: 340, price_cents: 2490, condition: 'bon', maintenance_due_at: '2026-09-15', tags: ['secours'] },
    { name: 'Lampe frontale Petzl Actik', brand: 'Petzl', category: 'Lampes & Éclairage', weight_g: 82, price_cents: 4490, condition: 'bon', tags: ['frontale'] },
    { name: 'Filtre à eau Sawyer Mini', brand: 'Sawyer', category: 'Eau & Filtres', weight_g: 57, price_cents: 3490, condition: 'bon', tags: ['filtre', 'eau'] },
    { name: 'Veste imperméable Gore-Tex', brand: 'Arc’teryx', category: 'Vêtements & Vestes', weight_g: 410, price_cents: 34900, condition: 'use', tags: ['veste', 'pluie'] },
    { name: 'Matelas Therm-a-Rest NeoAir', brand: 'Therm-a-Rest', category: 'Couchage & Tentes', weight_g: 410, price_cents: 15990, condition: 'bon', tags: ['matelas'] },
    { name: 'GPS Garmin eTrex 32x', brand: 'Garmin', category: 'Navigation & GPS', weight_g: 141, price_cents: 24990, condition: 'neuf', expiry_date: '2027-01-01', tags: ['gps'] },
    { name: 'Réserve eau 2L Platypus', brand: 'Platypus', category: 'Eau & Filtres', weight_g: 40, price_cents: 1490, condition: 'a_remplacer', tags: ['eau'] },
  ];
  const { data: insertedItems, error: itemsErr } = await supabase
    .from('product_ownership').insert(items.map((i) => ({ user_id: demoUserId, ...i }))).select('id, name');
  if (itemsErr) { console.error('items :', itemsErr.message); process.exit(1); }
  const itemIds = (insertedItems ?? []).map((i) => i.id);
  const idByName = new Map((insertedItems ?? []).map((i) => [i.name, i.id]));
  console.log('Inventaire :', itemIds.length, 'objets');

  // 2. Kits + articles
  const kits = [
    { name: 'Trek Jura 2 jours', description: 'Rando légère 2j/1n dans le Jura', season: 'ete', total_weight_g: 9800, is_public: true, items: ['Tente MSR Hubba 2P', 'Sac à dos Osprey 55L', 'Réchaud MSR PocketRocket', 'Trousse de secours', 'Filtre à eau Sawyer Mini', 'Veste imperméable Gore-Tex'] },
    { name: 'GR20 léger', description: 'Kit ultralight pour le GR20', season: 'ete', total_weight_g: 8400, is_public: true, items: ['Tente MSR Hubba 2P', 'Lampe frontale Petzl Actik', 'Matelas Therm-a-Rest NeoAir', 'Réchaud MSR PocketRocket', 'GPS Garmin eTrex 32x'] },
    { name: 'Vanlife été', description: 'Matériel camion aménagé pour l’été', season: 'ete', total_weight_g: 12000, is_public: false, items: ['Réserve eau 2L Platypus', 'Trousse de secours', 'Lampe frontale Petzl Actik', 'Veste imperméable Gore-Tex'] },
  ];
  const kitRowIds = [];
  for (const k of kits) {
    const { data: kit, error: kErr } = await supabase
      .from('materiel_kits').insert({ user_id: demoUserId, name: k.name, description: k.description, season: k.season, total_weight_g: k.total_weight_g, is_public: k.is_public }).select('id').single();
    if (kErr) { console.error('kit :', kErr.message); continue; }
    kitRowIds.push(kit.id);
    const rows = k.items.map((name, idx) => ({
      kit_id: kit.id, user_id: demoUserId, product_ownership_id: idByName.get(name) ?? null, name,
      category: 'Autre', weight_g: 0, quantity: 1, is_checked: idx % 2 === 0,
    }));
    const { error: kiErr } = await supabase.from('materiel_kit_items').insert(rows);
    if (kiErr) console.error('kit_items :', kiErr.message);
    await supabase.from('materiel_kit_history').insert([
      { kit_id: kit.id, user_id: demoUserId, action: 'created', payload: { item_count: k.items.length } },
      { kit_id: kit.id, user_id: demoUserId, action: 'updated', payload: { note: 'seed' } },
    ]);
  }
  console.log('Kits :', kitRowIds.length);

  // 3. Alertes
  const alertRefs = [
    { type: 'entretien', severity: 'warning', message: 'Trousse de secours : révision du contenu', due_at: '2026-09-15T08:00:00Z' },
    { type: 'peremption', severity: 'critical', message: 'Réserve eau : remplacement recommandé', due_at: '2026-08-30T08:00:00Z' },
    { type: 'etat', severity: 'info', message: 'Veste : traitement déperlant à refaire' },
  ];
  const { error: alErr } = await supabase.from('alerts').insert(alertRefs.map((a) => ({ user_id: demoUserId, ...a })));
  if (alErr) console.error('alerts :', alErr.message);
  console.log('Alertes :', alertRefs.length);

  // 4. Prêts
  const lentItem = itemIds[itemIds.length - 1];
  const { error: lErr } = await supabase.from('materiel_loans').insert([
    { product_ownership_id: lentItem, lender_id: demoUserId, borrower_contact: 'Marie Dupont', status: 'en_cours', loaned_at: '2026-08-10', due_date: '2026-09-05' },
    { product_ownership_id: itemIds[6], lender_id: demoUserId, borrower_contact: 'Lucas Martin', status: 'en_retard', loaned_at: '2026-07-20', due_date: '2026-08-18' },
  ]);
  if (lErr) console.error('loans :', lErr.message);
  console.log('Prêts : 2');

  // 5. Participants
  if (kitRowIds[0]) {
    const { error: pErr } = await supabase.from('depart_participants').insert([
      { kit_id: kitRowIds[0], user_id: demoUserId, name: 'Marie Dupont', is_emergency_contact: false, contact: null },
      { kit_id: kitRowIds[0], user_id: demoUserId, name: 'Lucas Martin', is_emergency_contact: false, contact: null },
      { kit_id: kitRowIds[0], user_id: demoUserId, name: 'Secours Montagne', is_emergency_contact: true, contact: '06 12 34 56 78' },
    ]);
    if (pErr) console.error('participants :', pErr.message);
  }
  console.log('Participants : 3');

  console.log('Seed terminé. Connectez-vous avec demo@lkdv.app');
}

main().catch((e) => { console.error(e); process.exit(1); });
