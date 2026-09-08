#!/usr/bin/env node
/**
 * Y0.4 — Données de démonstration déterministes du chantier Y.
 * 8 voyages à slugs fixes couvrant la matrice profil × party (§4.4),
 * dates ancrées autour du 01/06/2026 (horloge figée des captures).
 * Idempotent : purge des slugs y-* puis réinsertion.
 *
 * Usage : npm run seed:y   (requiert SUPABASE_SERVICE_ROLE_KEY dans .env.local)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// ── Env ─────────────────────────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env.local absent : on s'appuie sur l'environnement */
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Utilitaires dates (ancrage horloge captures : 2026-06-01) ───────────────
const d = (iso) => iso; // lisibilité
const OWNER = { email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026', name: 'Voyageur Y' };
const PEERS = [
  { email: 'y-peer1@lekitduvoyageur.fr', password: 'Ydemo!2026', name: 'Coéquipier Y 1' },
  { email: 'y-peer2@lekitduvoyageur.fr', password: 'Ydemo!2026', name: 'Coéquipier Y 2' },
  { email: 'y-peer3@lekitduvoyageur.fr', password: 'Ydemo!2026', name: 'Coéquipier Y 3' },
];

async function getOrCreateUser({ email, password, name }) {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}

// ── Définition des 8 profils ────────────────────────────────────────────────
// scale : day ≤1j · short 2-4j · long 5-14j · expedition >14j
function profiles(ownerId) {
  return [
    {
      slug: 'y-day-solo', title: 'Y — Journée Lac Blanc (solo)',
      description: 'Randonnée à la journée en solo — profil minimal (3 sections attendues).',
      country: 'FR', dest: 'Chamonix', start: d('2026-06-10'), end: d('2026-06-10'),
      status: 'planned', activity: 'hiking', difficulty: 'moderate', budget: null,
      steps: 1, items: 6, expenses: 0, docs: 0, checkpoints: 2, notes: 0, peers: 0,
    },
    {
      slug: 'y-day-group', title: 'Y — Journée Vercors (groupe)',
      description: 'Sortie journée entre amis — team et export visibles.',
      country: 'FR', dest: 'Vercors', start: d('2026-06-14'), end: d('2026-06-14'),
      status: 'planned', activity: 'hiking', difficulty: 'easy', budget: 120,
      steps: 1, items: 8, expenses: 2, docs: 0, checkpoints: 2, notes: 0, peers: 2,
    },
    {
      slug: 'y-short-solo', title: 'Y — Week-end Queyras (solo)',
      description: '3 jours en autonomie partielle, refuge.',
      country: 'FR', dest: 'Queyras', start: d('2026-06-20'), end: d('2026-06-22'),
      status: 'planned', activity: 'trekking', difficulty: 'moderate', budget: 250,
      steps: 3, items: 14, expenses: 0, docs: 1, checkpoints: 3, notes: 1, peers: 0,
    },
    {
      slug: 'y-short-group', title: 'Y — Week-end Bretagne (groupe)',
      description: '3 jours côtiers à quatre, budget partagé.',
      country: 'FR', dest: 'Finistère', start: d('2026-06-26'), end: d('2026-06-28'),
      status: 'planned', activity: 'roadtrip', difficulty: 'easy', budget: 480,
      steps: 3, items: 12, expenses: 4, docs: 1, checkpoints: 2, notes: 1, peers: 3,
    },
    {
      slug: 'y-long-solo', title: 'Y — GR20 Nord (solo)',
      description: '9 jours de traversée corse en autonomie.',
      country: 'FR', dest: 'Corse', start: d('2026-07-06'), end: d('2026-07-14'),
      status: 'planned', activity: 'trekking', difficulty: 'hard', budget: 900,
      steps: 9, items: 22, expenses: 0, docs: 3, checkpoints: 5, notes: 4, peers: 0,
    },
    {
      slug: 'y-long-group', title: 'Y — Tour du Mont-Blanc (groupe)',
      description: 'TMB à trois, refuges et budget partagé — profil de référence hub.',
      country: 'FR', dest: 'Mont-Blanc', start: d('2026-07-18'), end: d('2026-07-26'),
      status: 'planned', activity: 'trekking', difficulty: 'moderate', budget: 1500,
      steps: 9, items: 24, expenses: 8, docs: 3, checkpoints: 5, notes: 4, peers: 2,
    },
    {
      slug: 'y-exped-solo', title: 'Y — Annapurna Circuit (solo)',
      description: '18 jours d\'expédition himalayenne en solo.',
      country: 'NP', dest: 'Annapurna', start: d('2026-08-03'), end: d('2026-08-20'),
      status: 'planned', activity: 'trekking', difficulty: 'expert', budget: 2400,
      steps: 18, items: 34, expenses: 0, docs: 5, checkpoints: 8, notes: 6, peers: 0,
    },
    {
      slug: 'y-exped-group', title: 'Y — Expédition Huayhuash (groupe)',
      description: 'Expédition péruvienne à quatre — voyage EN COURS à l\'horloge figée (live).',
      country: 'PE', dest: 'Huayhuash', start: d('2026-05-28'), end: d('2026-06-15'),
      status: 'active', activity: 'bivouac', difficulty: 'expert', budget: 3200,
      steps: 18, items: 36, expenses: 12, docs: 5, checkpoints: 8, notes: 7, peers: 3,
    },
  ];
}

const STEP_TITLES = ['Départ & approche', 'Montée au col', 'Traversée', 'Bivouac', 'Sommet',
  'Descente', 'Repos acclimatation', 'Reprise', 'Étape refuge', 'Journée clef',
  'Transition vallée', 'Point d\'eau', 'Ramassage', 'Repos', 'Dernier col', 'Retour vallée',
  'Journée tampon', 'Clôture'];
const ITEM_NAMES = ['Doudoune duvet 650', 'Tente 2 places', 'Réchaud gaz', 'Popote titane',
  'Lampe frontale', 'Batterie externe 10k', 'Carte IGN', 'Boussole', 'Trousse secours',
  'Désinfectant', 'Filtre à eau', 'Gourde 1L', 'Crampons', 'Bâtons', 'Casque', 'Polaire',
  'Surpantalon', 'Guêtres', 'Chaussettes x3', 'Lunettes cat.4', 'Crème solaire', 'Cordes 30m',
  'Dégaines x2', 'Sac imperméable', 'Sifflet', 'Miroir signal', 'Carte bancaire', 'Passeport',
  'Assurance rapatriement', 'Carnet + crayon', 'Boîte à feu', 'Réserve calorique',
  'Thermos', 'Tapis de sol', 'Réparation autos', 'Drapeau signal'];

async function checked(promise, label) {
  const { error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function purgeAndSeed() {
  const ownerId = await getOrCreateUser(OWNER);
  const peerIds = [];
  for (const peer of PEERS) peerIds.push(await getOrCreateUser(peer));

  // Purge idempotente des slugs y-*
  const { data: olds } = await supabase.from('trips').select('id').like('slug', 'y-%');
  if (olds?.length) {
    const { error } = await supabase.from('trips').delete().in('id', olds.map((t) => t.id));
    if (error) throw new Error(`purge: ${error.message}`);
  }

  let created = 0;
  for (const p of profiles(ownerId)) {
    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        slug: p.slug,
        title: p.title,
        description: p.description,
        destination_country_code: p.country,
        destination_name: p.dest,
        start_date: p.start,
        end_date: p.end,
        status: p.status,
        visibility: 'private',
        difficulty: p.difficulty,
        primary_activity: p.activity,
        estimated_budget: p.budget,
        budget_currency: 'EUR',
        user_id: ownerId,
        metadata: {
          itinerary_source: 'seed_y',
          seeded_at: '2026-06-01T09:00:00Z',
        },
      })
      .select('id')
      .single();
    if (error) throw new Error(`${p.slug}: ${error.message}`);

    // Étapes
    const steps = Array.from({ length: p.steps }, (_, i) => ({
      trip_id: trip.id,
      day_number: i + 1,
      order_index: 0,
      title: `${i + 1}. ${STEP_TITLES[i % STEP_TITLES.length]}`,
      description: 'Étape de démonstration déterministe (chantier Y).',
      location_name: `${p.dest} — point ${i + 1}`,
      transport_mode: i === 0 ? 'foot' : 'foot',
      accommodation_name: i < p.steps - 1 ? 'Bivouac' : 'Retour',
      distance_km: 8 + ((i * 3) % 12),
      elevation_gain_m: 300 + ((i * 137) % 700),
      elevation_loss_m: 200 + ((i * 91) % 500),
    }));
    await checked(supabase.from('trip_steps').insert(steps), p.slug + ' steps');

    // Objets
    const items = Array.from({ length: p.items }, (_, i) => ({
      trip_id: trip.id,
      item_name: ITEM_NAMES[i % ITEM_NAMES.length],
      category: ['shelter', 'cook', 'safety', 'clothing', 'tech', 'misc'][i % 6],
      quantity: 1,
      weight_grams: 150 + ((i * 251) % 1400),
      is_packed: i % 3 === 0,
      status: i % 3 === 0 ? 'packed' : 'needed',
    }));
    await checked(supabase.from('trip_items').insert(items), p.slug + ' items');

    // Dépenses (payer = owner ; groupes : alterner avec le pair)
    if (p.expenses > 0) {
      const expenses = Array.from({ length: p.expenses }, (_, i) => ({
        trip_id: trip.id,
        payer_id: i % 2 === 0 || p.peers === 0 ? ownerId : peerIds[(i - 1) % peerIds.length],
        title: `Dépense ${i + 1} — ${['refuge', 'ravitaillement', 'transport', 'billets'][i % 4]}`,
        amount: 12 + ((i * 17) % 60),
        currency: 'EUR',
        category: ['hébergement', 'nourriture', 'transport', 'activités'][i % 4],
        expense_date: p.start,
        split_type: 'equal',
      }));
      await checked(supabase.from('trip_expenses').insert(expenses), p.slug + ' trip_expenses');
    }

    // Documents (jamais de vraies pièces : URLs factices de démo)
    if (p.docs > 0) {
      const docs = Array.from({ length: p.docs }, (_, i) => ({
        trip_id: trip.id,
        user_id: ownerId,
        title: ['Réservation refuge', 'Billet de train', 'Attestation assurance', 'Assurance expedition', 'Permis de trek'][i % 5],
        category: ['booking', 'ticket', 'insurance', 'insurance', 'other'][i % 5],
        file_url: 'https://example.com/demo/y-seed.pdf',
        file_name: `y-demo-${i + 1}.pdf`,
        expires_at: i === 0 ? '2026-12-31' : null,
        notes: 'Document de démonstration (seed Y) — aucune donnée réelle.',
      }));
      await checked(supabase.from('trip_documents').insert(docs), p.slug + ' trip_documents');
    }

    // Points de contrôle sécurité
    const checkpoints = Array.from({ length: p.checkpoints }, (_, i) => ({
      trip_id: trip.id,
      label: `Point de contrôle ${i + 1} — ${['départ', 'col', 'bivouac', 'retour vallée', 'milieu', 'crête', 'pont', 'arrivée'][i % 8]}`,
      scheduled_at: new Date(new Date(p.start).getTime() + (i + 1) * 86400000).toISOString(),
      checked_at: p.status === 'active' && i < 2 ? new Date(new Date(p.start).getTime() + (i + 1) * 86400000).toISOString() : null,
      contact_name: 'Secours démo',
      contact_phone: '+33123456789',
      status: p.status === 'active' && i < 2 ? 'checked' : 'pending',
      notes: null,
    }));
    await checked(supabase.from('trip_safety_checkpoints').insert(checkpoints), p.slug + ' trip_safety_checkpoints');

    // Notes
    if (p.notes > 0) {
      const notes = Array.from({ length: p.notes }, (_, i) => ({
        trip_id: trip.id,
        author_id: ownerId,
        title: i === 0 ? 'Carnet — avant départ' : `Journal — jour ${i + 1}`,
        content: 'Note de démonstration déterministe du chantier Y (capture figée au 01/06/2026).',
        day_number: p.status === 'active' ? i + 1 : null,
        is_pinned: i === 0,
      }));
      await checked(supabase.from('trip_notes').insert(notes), p.slug + ' trip_notes');
    }

    // Collaborateurs (party = group) — un user DISTINCT par pair.
    // NB : un trigger DB ajoute déjà la ligne 'owner' (compteur solo = 1).
    if (p.peers > 0) {
      const collabs = Array.from({ length: p.peers }, (_, i) => ({
        trip_id: trip.id,
        user_id: peerIds[i % peerIds.length],
        role: i === 0 ? 'editor' : 'viewer',
        invited_by: ownerId,
      }));
      const { error: collabErr } = await supabase.from('trip_collaborators').insert(collabs);
      if (collabErr) throw new Error(`${p.slug} collabs: ${collabErr.message}`);
    }

    created++;
    console.log(`✓ ${p.slug} (${p.steps} étapes, ${p.items} objets, ${p.expenses} dépenses, ${p.docs} docs, ${p.checkpoints} checkpoints, ${p.notes} notes, ${p.peers} pairs)`);
  }
  console.log(`\n✓ ${created} voyages y-* seedés (owner ${OWNER.email}).`);
}

purgeAndSeed().catch((e) => {
  console.error('✗ Seed échoué :', e.message);
  process.exit(1);
});
