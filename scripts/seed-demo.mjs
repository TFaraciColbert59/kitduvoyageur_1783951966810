// =============================================================================
// scripts/seed-demo.mjs — Seed de démonstration massif, persistant & idempotent
// =============================================================================
// Usage : node scripts/seed-demo.mjs
//
// - Compte démo : y-demo@lekitduvoyageur.fr / Ydemo!2026
// - Idempotence : voyages upsert par slug déterministe ; tables filles
//   "delete-then-insert" RESTRICTÉ aux libellés déterministes du seed
//   (aucune donnée utilisateur hors du périmètre du seed n'est touchée).
// - Chaque section est isolée (try/catch) : un échec n'interrompt pas le reste.
// - Ne modifie JAMAIS les voyages existants (fdgb, y-exped-group, y-*-solo…).
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

// --- Env & clients -----------------------------------------------------------
const env = fs.readFileSync('.env', 'utf8');
const grab = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};
const SUPABASE_URL = grab('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON = grab('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SUPABASE_SERVICE = grab('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absents du .env');
  process.exit(1);
}

let sc = [];
const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
  cookies: { getAll: () => sc, setAll: (c) => { sc = c; } },
});

const admin = SUPABASE_SERVICE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// --- Compte démo -------------------------------------------------------------
const DEMO_EMAIL = 'y-demo@lekitduvoyageur.fr';
const DEMO_PASSWORD = 'Ydemo!2026';

const { data: session, error: signInErr } = await sb.auth.signInWithPassword({
  email: DEMO_EMAIL, password: DEMO_PASSWORD,
});
if (signInErr || !session?.user) {
  console.error('FATAL: connexion démo impossible:', signInErr?.message);
  process.exit(1);
}
const UID = session.user.id;

const warn = (msg) => console.warn(`  [WARN] ${msg}`);
const ok = (msg) => console.log(`  [OK] ${msg}`);

async function section(name, fn) {
  try {
    await fn();
  } catch (e) {
    warn(`section "${name}" ignorée/échouée : ${e.message ?? e}`);
  }
}

const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const offsetDate = (days) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return iso(d);
};
// Timestamp "jour du voyage à HH:00Z"
const tripTs = (dateStr, hour) => `${dateStr}T${String(hour).padStart(2, '0')}:00:00Z`;

// =============================================================================
// DONNÉES DU SEED (slugs déterministes = clé d'idempotence)
// =============================================================================

const SEED_SLUGS = [
  'tour-mont-blanc-refuge',
  'queyras-etoile',
  'cevennes-rando',
  'bivouac-vercors',
  'roadtrip-ardeche',
];

const ITALY_ISO = 'IT'; // vérifié dynamiquement contre countries_geo ci-dessous
const COVER = '/materiel/background.jpg'; // asset générique existant sous public/

const TRIPS = [
  {
    slug: 'tour-mont-blanc-refuge',
    title: 'Tour du Mont-Blanc — version refuges',
    description: "Le classique alpin en 7 jours, nuitées en refuge. De Chamonix à Courmayeur par les cols.",
    destination_country_code: 'FR',
    destination_name: 'Massif du Mont-Blanc, France',
    start_offset: -2, end_offset: 5,
    status: 'active', difficulty: 'hard', primary_activity: 'hiking',
    estimated_budget: 890.0, budget_currency: 'EUR',
    steps: [
      { day: 1, order: 0, title: 'Chamonix — accueil et briefing', location: 'Chamonix-Mont-Blanc', lat: 45.9237, lng: 6.8694, km: 0, gain: 0, loss: 0, transport: 'train' },
      { day: 2, order: 0, title: 'Les Houches → Col de Voza', location: 'Col de Voza', lat: 45.9977, lng: 6.7906, km: 12.4, gain: 820, loss: 350, transport: 'foot' },
      { day: 3, order: 0, title: 'Bionnassay — Refuge de Miage', location: 'Bionnassay', lat: 45.9319, lng: 6.7920, km: 14.1, gain: 960, loss: 610, transport: 'foot' },
      { day: 4, order: 0, title: 'Les Contamines-Montjoie', location: 'Les Contamines-Montjoie', lat: 45.8247, lng: 6.7820, km: 11.8, gain: 540, loss: 780, transport: 'foot' },
      { day: 5, order: 0, title: 'Col du Bonhomme — Croix du Bonhomme', location: 'Col du Bonhomme', lat: 45.7250, lng: 6.8000, km: 13.6, gain: 1180, loss: 420, transport: 'foot' },
      { day: 6, order: 0, title: 'Refuge des Mottets — Col de la Seigne', location: 'Refuge des Mottets', lat: 45.7420, lng: 6.8130, km: 10.2, gain: 730, loss: 290, transport: 'foot' },
      { day: 7, order: 0, title: 'Courmayeur — descente italienne', location: 'Courmayeur', lat: 45.7950, lng: 6.9710, km: 15.3, gain: 480, loss: 1240, transport: 'foot' },
    ],
    items: [
      ['Sac à dos 45L', 'sac', 1, 1350, true, 'vital', true, false, false],
      ['Chaussures de randonnée', 'chaussures', 1, 1420, true, 'vital', true, true, false],
      ['Doudoune compacte', 'vêtements', 1, 380, true, 'recommended', false, true, false],
      ['Coupe-vent Gore-Tex', 'vêtements', 1, 320, true, 'vital', true, false, false],
      ['Drap de sac polaire (refuges)', 'nuit', 1, 290, true, 'vital', true, false, false],
      ['Lampe frontale rechargeable', 'sécurité', 1, 95, true, 'vital', true, false, false],
      ['Bâtons de randonnée', 'marche', 2, 460, true, 'recommended', false, false, false],
      ['Gourde isotherme 750ml', 'hydratation', 1, 180, true, 'vital', true, false, false],
      ['Barres de céréales x6', 'nourriture', 6, 510, true, 'recommended', false, false, true],
      ['Trousse de secours alpine', 'sécurité', 1, 240, true, 'vital', true, false, false],
      ['Crème solaire SPF50', 'protection', 1, 60, false, 'recommended', false, false, true],
      ['Carte IGN + boussole', 'navigation', 1, 110, false, 'recommended', false, false, false],
      ['Power bank 10 000 mAh', 'électronique', 1, 210, false, 'recommended', false, false, false],
      ['Lunettes de soleil cat.4', 'protection', 1, 45, true, 'recommended', false, true, false],
    ],
    expenses: [
      ['Train aller Paris → Chamonix', 89.0, 'transport', -3],
      ['Refuge de Miage — demi-pension', 62.0, 'lodging', 1],
      ['Refuge Croix du Bonhomme — nuit', 55.0, 'lodging', 3],
      ['Refuge des Mottets — demi-pension', 68.0, 'lodging', 4],
      ['Hôtel Courmayeur — dernière nuit', 95.0, 'lodging', 5],
      ['Épicerie Chamonix (ravito J2)', 34.5, 'food', 0],
      ['Dîner Courmayeur — pizzeria', 28.0, 'food', 5],
      ['Navette Les Houches → Bellevue', 12.0, 'transport', 0],
      ['Souvenir carte alpine gravée', 19.0, 'other', 5],
    ],
    documents: [
      ['Carte d\'identité', 'passport', 'ci-demo-alpes.pdf'],
      ['Assurance montagne GMF', 'insurance', 'assurance-montagne-demo.pdf'],
      ['Réservation refuge Miage', 'booking', 'resa-refuge-miage.pdf'],
    ],
    checkpoints: [
      ['Checkpoint soirée J2 — refuge', 1, 20, 'pending'],
      ['Checkpoint col du Bonhomme J5', 4, 12, 'pending'],
      ['Retour Courmayeur J7 confirmé', 6, 19, 'pending'],
    ],
    notes: [
      ['Briefing départ', 'Briefing à la gare de Chamonix avec Marie : points eau, refuges réservés, météo du col de Voza impeccable. Départ demain 7h30.', 1, true],
      ['J3 — Miage', 'Traversée de Bionnassay superbe, glacier impressionnant. Refuge de Miage : omelette légendaire confirmée. Genoux OK.', 3, false],
      ['J5 — Bonhomme', 'Grosse montée au col du Bonhomme, vent glacial à la Croix. Météo surprise : grésil 10 min puis grand beau.', 5, false],
      ['J7 — Courmayeur', 'Descente sur Courmayeur par le Mont de la Saxe, vue sur les Drus toute la matinée. Bière de fin de trek méritée.', 7, false],
      ['Budget à jour', 'Refuges moins chers que prévu, train plus cher. Enveloppe "lodging" quasi consommée, vigilance sur Courmayeur.', null, false],
    ],
    pois: [
      ['Point d\'eau — Refuge de Miage', 'water', 45.9325, 6.7928, true],
      ['Point d\'eau — Col du Bonhomme', 'water', 45.7258, 6.8012, false],
      ['Belvédère Mont de la Saxe', 'viewpoint', 45.8095, 6.9950, false],
      ['Source des Contamines', 'water', 45.8255, 6.7842, true],
      ['Panorama Col de la Seigne', 'viewpoint', 45.7510, 6.8300, false],
      ['Boulangerie Courmayeur', 'shop', 45.7960, 6.9725, false],
    ],
    checklist: [
      ['Réserver les refuges', 30, true],
      ['Vérifier la météo de montagne', 7, true],
      ['Charger la lampe frontale', 1, true],
      ['Télécharger cartes IGN offline', 3, true],
      ['Imprimer les billets de train', 2, true],
      ['Prévenir le contact d\'urgence', 1, false],
    ],
  },

  {
    slug: 'queyras-etoile',
    title: 'Queyras en étoile depuis Ceillac',
    description: "Une semaine de randonnées en étoile autour de Ceillac : lac Sainte-Anne, col Fromage, Molines.",
    destination_country_code: 'FR',
    destination_name: 'Queyras, Hautes-Alpes',
    start_offset: 12, end_offset: 18,
    status: 'planned', difficulty: 'moderate', primary_activity: 'hiking',
    estimated_budget: 640.0, budget_currency: 'EUR',
    steps: [
      { day: 1, order: 0, title: 'Installation au gîte de Ceillac', location: 'Ceillac', lat: 44.8220, lng: 6.8850, km: 0, gain: 0, loss: 0, transport: 'car' },
      { day: 2, order: 0, title: 'Lac Sainte-Anne', location: 'Lac Sainte-Anne', lat: 44.7828, lng: 6.9801, km: 16.2, gain: 890, loss: 890, transport: 'foot' },
      { day: 3, order: 0, title: 'Col Fromage', location: 'Col Fromage', lat: 44.8010, lng: 6.9350, km: 14.8, gain: 920, loss: 920, transport: 'foot' },
      { day: 4, order: 0, title: 'Château-Ville-Vieille — Fort Queyras', location: 'Château-Ville-Vieille', lat: 44.7780, lng: 6.8330, km: 12.0, gain: 410, loss: 410, transport: 'foot' },
      { day: 5, order: 0, title: 'Molines-en-Queyras', location: 'Molines-en-Queyras', lat: 44.7410, lng: 6.9150, km: 13.4, gain: 620, loss: 620, transport: 'foot' },
      { day: 6, order: 0, title: 'Boucle Ristolas — Mont Viso', location: 'Ristolas', lat: 44.7180, lng: 6.9380, km: 15.0, gain: 740, loss: 740, transport: 'foot' },
    ],
    items: [
      ['Sac à dos 35L', 'sac', 1, 1150, true, 'vital', true, false, false],
      ['Chaussures de randonnée', 'chaussures', 1, 1420, true, 'vital', true, true, false],
      ['Polaire micropolaire', 'vêtements', 1, 290, true, 'recommended', false, false, false],
      ['Pantalon convertible', 'vêtements', 1, 410, true, 'recommended', false, true, false],
      ['Chapeau + casquette', 'protection', 2, 120, true, 'recommended', false, true, false],
      ['Bâtons de randonnée', 'marche', 2, 460, true, 'recommended', false, false, false],
      ['Gourde 1L', 'hydratation', 1, 160, true, 'vital', true, false, false],
      ['Pastilles Micropur', 'hydratation', 1, 40, false, 'recommended', false, false, true],
      ['Kit pique-nique (boîte + couverts)', 'nourriture', 1, 180, true, 'recommended', false, false, false],
      ['Trousse de secours', 'sécurité', 1, 220, true, 'vital', true, false, false],
      ['Jumelles 8x25', 'observation', 1, 310, false, 'optional', false, false, false],
      ['Crème solaire SPF50', 'protection', 1, 60, false, 'recommended', false, false, true],
    ],
    expenses: [
      ['Essence aller-retour', 78.0, 'transport', 10],
      ['Gîte de Ceillac — semaine', 490.0, 'lodging', 10],
      ['Supermarché Guillestre', 52.3, 'food', 11],
      ['Ferme du Col Fromage — fromages', 24.0, 'food', 12],
      ['Bar de Ceillac — café + tartes', 18.5, 'food', 13],
    ],
    documents: [
      ['Carte d\'identité', 'passport', 'ci-demo-alpes.pdf'],
      ['Attestation gîte Ceillac', 'booking', 'resa-gite-ceillac.pdf'],
      ['Carte vitale européenne', 'medical', 'carte-vitale-ce.pdf'],
      ['Assurance randonnée', 'insurance', 'assurance-montagne-demo.pdf'],
    ],
    checkpoints: [
      ['Checkpoint soir J2 — retour gîte', 1, 20, 'pending'],
      ['Checkpoint col Fromage J3 midi', 2, 12, 'pending'],
      ['Checkpoint retour Ristolas J6', 5, 18, 'pending'],
    ],
    notes: [
      ['Plan en étoile', "Base fixe au gîte de Ceillac : pas de portage lourd, on boucle chaque jour. Objectif : lac Sainte-Anne le premier matin.", 1, true],
      ['Météo Queyras', 'Séries d\'orages l\'après-midi en montagne : départs à 7h, retour avant 15h. Marmottes innombrables côté Molines.', 2, false],
      ['Budget semaine', 'Gîte payé d\'avance : 490 € couverts. Reste ~150 € d\'épicerie et extras. Pas de péage imprévu.', null, false],
    ],
    pois: [
      ['Source du Cristillan', 'water', 44.8020, 6.9400, false],
      ['Point d\'eau lac Sainte-Anne', 'water', 44.7830, 6.9805, false],
      ['Belvédère col Fromage', 'viewpoint', 44.8015, 6.9360, false],
      ['Ferme-fromagerie Molines', 'shop', 44.7415, 6.9160, false],
      ['Fontaine Château-Ville-Vieille', 'water', 44.7782, 6.8335, false],
    ],
    checklist: [
      ['Confirmer le gîte de Ceillac', 30, true],
      ['Réviser la voiture (pneus, freins)', 14, true],
      ['Acheter les cartes IGN 3637OT', 7, true],
      ['Préparer les pique-niques', 1, false],
      ['Vérifier la trousse de secours', 7, false],
    ],
  },

  {
    slug: 'cevennes-rando',
    title: 'Cévennes — GR de pays du Vigan au Mont Lozère',
    description: "Trek itinérant de 8 jours sur les drailles cévenoles : Vigan, Florac, Pont-de-Montvert, châtaigneraies.",
    destination_country_code: 'FR',
    destination_name: 'Cévennes, France',
    start_offset: 30, end_offset: 38,
    status: 'planned', difficulty: 'hard', primary_activity: 'trekking',
    estimated_budget: 720.0, budget_currency: 'EUR',
    steps: [
      { day: 1, order: 0, title: 'Le Vigan — départ', location: 'Le Vigan', lat: 43.9760, lng: 3.6090, km: 0, gain: 0, loss: 0, transport: 'bus' },
      { day: 3, order: 0, title: 'Florac — ravin des Vignes', location: 'Florac', lat: 44.2910, lng: 3.7940, km: 21.5, gain: 980, loss: 760, transport: 'foot' },
      { day: 5, order: 0, title: 'Le Pont-de-Montvert', location: 'Le Pont-de-Montvert', lat: 44.2350, lng: 3.7890, km: 18.9, gain: 1120, loss: 1040, transport: 'foot' },
      { day: 7, order: 0, title: 'Saint-Germain-de-Calberte', location: 'Saint-Germain-de-Calberte', lat: 44.2020, lng: 3.8890, km: 17.4, gain: 850, loss: 920, transport: 'foot' },
    ],
    items: [
      ['Sac à dos 55L + housse pluie', 'sac', 1, 1780, true, 'vital', true, false, false],
      ['Tente 2 places légère', 'nuit', 1, 1950, true, 'vital', true, false, false],
      ['Sac de couchage confort 5°C', 'nuit', 1, 980, true, 'vital', true, false, false],
      ['Matelas autogonflant', 'nuit', 1, 520, true, 'recommended', false, false, false],
      ['Réchaud gaz + cartouche', 'cuisine', 1, 380, true, 'recommended', false, false, true],
      ['Filtre à eau squeez', 'hydratation', 1, 90, true, 'vital', true, false, false],
      ['Chaussures mid waterproof', 'chaussures', 1, 1580, true, 'vital', true, true, false],
      ['Poncho pluie', 'vêtements', 1, 320, true, 'vital', true, false, false],
      ['Lampe frontale rechargeable', 'sécurité', 1, 95, true, 'vital', true, false, false],
      ['Nourriture lyophilisée x8', 'nourriture', 8, 1280, false, 'recommended', false, false, true],
      ['Trousse de secours complète', 'sécurité', 1, 260, true, 'vital', true, false, false],
      ['Carte TOP25 + boussole', 'navigation', 1, 120, true, 'recommended', false, false, false],
      ['Power bank 20 000 mAh', 'électronique', 1, 380, false, 'recommended', false, false, false],
    ],
    expenses: [
      ['Bus Nîmes → Le Vigan', 22.0, 'transport', 29],
      ['Dépôt ravitaillement Le Vigan', 68.4, 'food', 30],
      ['Camping Florac — nuit', 18.0, 'lodging', 32],
      ['Chambres d\'hôtes Pont-de-Montvert', 65.0, 'lodging', 34],
      ['Dîner auberge du Tarn', 32.0, 'food', 34],
      ['Gîte d\'étape Saint-Germain', 48.0, 'lodging', 36],
      ['Navette retour Florac → Vigan', 25.0, 'transport', 37],
    ],
    documents: [
      ['Carte d\'identité', 'passport', 'ci-demo-alpes.pdf'],
      ['Réservation gîte d\'étape', 'booking', 'resa-gite-cevennes.pdf'],
      ['Assurance randonnée', 'insurance', 'assurance-montagne-demo.pdf'],
    ],
    checkpoints: [
      ['Checkpoint soir J1 — bivouac Vigan', 0, 20, 'pending'],
      ['Checkpoint J3 — Florac', 2, 19, 'pending'],
      ['Checkpoint J7 — Saint-Germain', 6, 18, 'pending'],
    ],
    notes: [
      ['Itinéraire validé', 'Tracé sur les drailles entre Vigan et Saint-Germain-de-Calberte. Eau : ruisseaux permanents sauf août — filtre obligatoire.', 1, true],
      ['Bivouac au Mont Lozère', 'Bivouac toléré sous 2000m dans le parc national entre 19h et 9h : on installe le camp tard pour respecter la règle.', 3, false],
      ['Châtaigneraies', 'Étape la plus belle : forêts de châtaigniers centenaires entre Pont-de-Montvert et Saint-Germain. Photo au sommet du Rougour.', 5, false],
      ['Budget trek', 'Estimation 720 € : gîtes 2 nuits + camping 1 nuit + nourriture lyophilisée. Bus retour à réserver.', null, false],
    ],
    pois: [
      ['Ruisseau du Ravin des Vignes', 'water', 44.2850, 3.7980, false],
      ['Source du Tarnon', 'water', 44.2380, 3.7920, false],
      ['Point de vue — Signal de Rougour', 'viewpoint', 44.2120, 3.8760, false],
      ['Épicerie Le Pont-de-Montvert', 'shop', 44.2345, 3.7898, false],
    ],
    checklist: [
      ['Tester la tente au jardin', 30, true],
      ['Réserver gîte Pont-de-Montvert', 21, true],
      ['Acheter la nourriture lyophilisée', 14, false],
      ['Filtrer l\'eau : tester le squeez', 14, false],
      ['Prévoir les bus Nîmes ↔ Vigan', 7, false],
      ['Itinéraire GPX téléchargé', 7, false],
    ],
  },

  {
    slug: 'bivouac-vercors',
    title: 'Bivouac dans le Hauts-Plateaux du Vercors',
    description: "Week-end bivouac autonome : traversée des hauts plateaux, Grande Moucherolle, gîte à Autrans.",
    destination_country_code: 'FR',
    destination_name: 'Vercors, France',
    start_offset: 7, end_offset: 10,
    status: 'planned', difficulty: 'moderate', primary_activity: 'bivouac',
    estimated_budget: 280.0, budget_currency: 'EUR',
    steps: [
      { day: 1, order: 0, title: 'Villard-de-Lans — montée au refuges', location: 'Villard-de-Lans', lat: 45.0730, lng: 5.5530, km: 8.2, gain: 740, loss: 120, transport: 'foot' },
      { day: 2, order: 0, title: 'Corrençon-en-Vercors — bivouac', location: 'Corrençon-en-Vercors', lat: 45.0930, lng: 5.5400, km: 14.6, gain: 620, loss: 480, transport: 'foot' },
      { day: 3, order: 0, title: 'Grande Moucherolle', location: 'Grande Moucherolle', lat: 44.9770, lng: 5.5320, km: 16.1, gain: 1050, loss: 980, transport: 'foot' },
      { day: 4, order: 0, title: 'Autrans — retour', location: 'Autrans', lat: 45.1450, lng: 5.5540, km: 11.9, gain: 380, loss: 820, transport: 'foot' },
    ],
    items: [
      ['Sac à dos 40L', 'sac', 1, 1290, true, 'vital', true, false, false],
      ['Tente ultralight bivouac', 'nuit', 1, 1150, true, 'vital', true, false, false],
      ['Sac de couchage 0°C', 'nuit', 1, 1080, true, 'vital', true, false, false],
      ['Matelas fin mousse', 'nuit', 1, 380, true, 'vital', true, false, false],
      ['Réchaud à gaz + popote', 'cuisine', 1, 440, true, 'recommended', false, false, true],
      ['Doudoune synthétique', 'vêtements', 1, 410, true, 'recommended', false, false, false],
      ['Chaussures de randonnée', 'chaussures', 1, 1420, true, 'vital', true, true, false],
      ['Frontale + pile de rechange', 'sécurité', 1, 130, true, 'vital', true, false, false],
      ['Ravitaillement bivouac (2 dîners)', 'nourriture', 2, 640, false, 'recommended', false, false, true],
      ['Trousse de secours', 'sécurité', 1, 200, true, 'vital', true, false, false],
      ['Sifflet + miroir signal', 'sécurité', 1, 40, false, 'optional', false, false, false],
      ['Carte IGN 3336 OT', 'navigation', 1, 95, true, 'recommended', false, false, false],
    ],
    expenses: [
      ['Covoiturage Grenoble → Villard', 14.0, 'transport', 6],
      ['Épicerie Villard-de-Lans', 41.2, 'food', 6],
      ['Gîte Autrans — dernière nuit', 52.0, 'lodging', 9],
      ['Taxi Autrans → Grenoble', 38.0, 'transport', 9],
      ['Boisson chaude Corrençon', 9.5, 'food', 7],
    ],
    documents: [
      ['Carte d\'identité', 'passport', 'ci-demo-alpes.pdf'],
      ['Autorisation bivouac PNR Vercors', 'other', 'reglement-bivouac-vercors.pdf'],
      ['Assurance montagne', 'insurance', 'assurance-montagne-demo.pdf'],
    ],
    checkpoints: [
      ['Checkpoint veillée bivouac J2', 1, 21, 'pending'],
      ['Checkpoint sommet Moucherolle J3', 2, 11, 'pending'],
      ['Checkpoint arrivée Autrans J4', 3, 17, 'pending'],
    ],
    notes: [
      ['Règles bivouac Vercors', 'Bivouac autorisé aux hauts plateaux entre 19h et 9h, sous tente, un seul camp. Zone de protection stricte au nord : pas de camp.', 1, true],
      ['Météo de montagne', 'Moucherolle peut être ventée : prévoir coupe-vent même en été. Froid nocturne annoncé : 4°C prévus, doudoune indispensable.', 2, false],
      ['Eau sur plateau', 'Pas d\'eau courante sur les hauts plateaux : prévoir 2,5L/personne pour la traversée, sources au pied des falaises au retour.', 3, false],
    ],
    pois: [
      ['Fontaine du Pas de la Balme', 'water', 45.0810, 5.5470, false],
      ['Source des Pleiades', 'water', 45.0620, 5.5380, false],
      ['Belvédère Rochers de Combeau', 'viewpoint', 45.0945, 5.5435, false],
      ['Refuge / gîte Autrans', 'shelter', 45.1455, 5.5548, false],
    ],
    checklist: [
      ['Vérifier la réglementation bivouac', 30, true],
      ['Tester le réchaud', 7, true],
      ['Prévoir 2,5L d\'eau par personne', 2, false],
      ['Charger le GPS + cartes offline', 2, false],
      ['Prévenir le contact d\'urgence', 1, false],
    ],
  },

  {
    slug: 'roadtrip-ardeche',
    title: 'Roadtrip Ardèche — de Vallon aux gorges',
    description: "Semaine roadtrip en van : pont d'Arc, gorges de l'Ardèche, villages de caractère, canoe et marchés.",
    destination_country_code: 'FR',
    destination_name: 'Ardèche, France',
    start_offset: 45, end_offset: 52,
    status: 'draft', difficulty: 'easy', primary_activity: 'roadtrip',
    estimated_budget: 950.0, budget_currency: 'EUR',
    steps: [
      { day: 1, order: 0, title: 'Vallon-Pont-d\'Arc — arrivée van', location: 'Vallon-Pont-d\'Arc', lat: 44.3880, lng: 4.3920, km: 0, gain: 0, loss: 0, transport: 'car' },
      { day: 2, order: 0, title: 'Descente des gorges en canoë', location: 'Gorges de l\'Ardèche', lat: 44.3660, lng: 4.4530, km: 24.0, gain: 0, loss: 0, transport: 'boat' },
      { day: 3, order: 0, title: 'Ruoms — marché et baignade', location: 'Ruoms', lat: 44.3830, lng: 4.3350, km: 18.0, gain: 0, loss: 0, transport: 'car' },
      { day: 5, order: 0, title: 'Les Vans — villages perchés', location: 'Les Vans', lat: 44.3940, lng: 4.1410, km: 34.0, gain: 0, loss: 0, transport: 'car' },
      { day: 7, order: 0, title: 'Saint-Martin-d\'Ardèche — sortie sud', location: 'Saint-Martin-d\'Ardèche', lat: 44.3070, lng: 4.6650, km: 42.0, gain: 0, loss: 0, transport: 'car' },
    ],
    items: [
      ['Van aménagé (check complet)', 'transport', 1, 0, true, 'vital', true, false, false],
      ['Tente de toit optionnelle', 'nuit', 1, 6200, false, 'optional', false, false, false],
      ['Chaises de camping x2', 'camping', 2, 1900, true, 'recommended', false, false, false],
      ['Glacière souple 25L', 'camping', 1, 1100, true, 'recommended', false, false, false],
      ['Maillots de bain', 'vêtements', 2, 320, true, 'recommended', false, true, false],
      ['Chaussures d\'eau', 'chaussures', 2, 640, true, 'recommended', false, true, false],
      ['Crème solaire SPF50', 'protection', 2, 120, true, 'vital', false, false, true],
      ['Gourdes x2', 'hydratation', 2, 320, true, 'vital', false, false, false],
      ['Répulsif moustiques', 'protection', 1, 90, false, 'recommended', false, false, true],
      ['Jauge d\'eau du van (contrôle)', 'transport', 1, 0, false, 'vital', false, false, false],
      ['Enceinte portable', 'loisirs', 1, 560, false, 'optional', false, false, false],
      ['Carte routière Ardèche', 'navigation', 1, 85, true, 'recommended', false, false, false],
      ['Kit van (câbles, corde, lampe)', 'outillage', 1, 1400, false, 'recommended', false, false, false],
      ['Gilets de sauvetage x2', 'sécurité', 2, 900, false, 'vital', false, false, false],
      ['Casquettes + chapeaux', 'protection', 2, 140, true, 'recommended', false, true, false],
    ],
    expenses: [
      ['Location van — semaine', 620.0, 'transport', 44],
      ['Campsite Vallon — 3 nuits', 96.0, 'lodging', 45],
      ['Location canoë gorges', 62.0, 'other', 46],
      ['Épicerie Ruoms', 74.3, 'food', 47],
      ['Resto Les Vans — bouchon ardéchois', 44.0, 'food', 49],
      ['Essence — demi-plein', 55.0, 'transport', 50],
      ['Campsite Saint-Martin — 2 nuits', 58.0, 'lodging', 51],
      ['Marché de Vallon — tapenades et chèvre', 23.6, 'food', 45],
    ],
    documents: [
      ['Permis de conduire', 'other', 'permis-conduire-demo.pdf'],
      ['Assurance van location', 'insurance', 'assurance-van-demo.pdf'],
      ['Réservation campsites', 'booking', 'resa-campsites-ardeche.pdf'],
    ],
    checkpoints: [
      ['Checkpoint arrivée Vallon J1', 0, 18, 'pending'],
      ['Checkpoint base nautique J2', 1, 9, 'pending'],
      ['Checkpoint retour van J7', 6, 19, 'pending'],
    ],
    notes: [
      ['Idées roadtrip', 'Ne pas manquer : grotte Chauvet 2, belvédère du Ranc Pointu, marchés de Ruoms et Les Vans le samedi.', 1, true],
      ['Canoë gorges', 'Descente 24 km Vallon → Sauze en 1 jour : réserver tôt en été, navette retour incluse. Étanches pour les téléphones.', 2, false],
      ['Budget van', 'Location 620 € + essence ~110 € + campsites ~150 €. Reste 250 € de nourriture et activités : ça passe.', null, false],
      ['Temps de pluie', 'Plan B pluie : grotte Chauvet 2 (réserver en ligne) et musée de la châtaigneraie à Joyeuse.', null, false],
    ],
    pois: [
      ['Pont d\'Arc', 'viewpoint', 44.3830, 4.4020, false],
      ['Baignade plage Casteljau', 'water', 44.3720, 4.3580, false],
      ['Base nautique gorges', 'water', 44.3670, 4.4010, false],
      ['Marché de Ruoms', 'shop', 44.3835, 4.3358, false],
      ['Belvédère Ranc Pointu', 'viewpoint', 44.3290, 4.5320, false],
      ['Camping Saint-Martin', 'campsite', 44.3078, 4.6658, false],
    ],
    checklist: [
      ['Réserver le van', 30, true],
      ['Réserver la descente canoë', 14, true],
      ['Réserver les campsites', 14, false],
      ['Billets grotte Chauvet 2', 7, false],
      ['Vérifier les documents du véhicule', 7, false],
    ],
  },
];

// =============================================================================
// POSSESSION (MON MATÉRIEL) — inventaire, kits, prêts, alertes
// Idempotence : delete-then-insert restreint aux noms/messages déterministes.
// Catégories = liste canonique UI (InventoryWorkspace.CATEGORIES).
// Condition ∈ {neuf,bon,use,a_remplacer,pour_pieces} ; season ∈ {printemps,ete,
// automne,hiver,toute_saison} ; alert.type ∈ {entretien,peremption,pret,etat,
// conflit,meteo,reglementation} ; loan.status ∈ {en_cours,rendu,en_retard,litige}.
// =============================================================================

const SEED_ITEMS = [
  { name: 'Sac à dos alpinisme 55L', brand: 'Deuter', category: 'Sacs & Portage', weight_g: 1450, price_cents: 24990, bought: -420, condition: 'bon', lent: false, tags: ['alpinisme', 'portage'] },
  { name: 'Sac à dos GR 30L', brand: 'Osprey', category: 'Sacs & Portage', weight_g: 890, price_cents: 12900, bought: -300, condition: 'bon', lent: false, tags: ['rando'] },
  { name: 'Tente bivouac 2P ultralight', brand: 'MSR', category: 'Couchage & Tentes', weight_g: 1720, price_cents: 59900, bought: -380, condition: 'bon', lent: false, tags: ['bivouac'] },
  { name: 'Duvet plume confort -5°C', brand: 'Valandré', category: 'Couchage & Tentes', weight_g: 850, price_cents: 32900, bought: -260, condition: 'bon', lent: false, tags: ['bivouac'] },
  { name: 'Matelas autogonflant R4', brand: 'Therm-a-Rest', category: 'Couchage & Tentes', weight_g: 520, price_cents: 12900, bought: -500, condition: 'use', lent: false, tags: ['bivouac'] },
  { name: 'Réchaud à gaz compact', brand: 'Jetboil', category: 'Cuisine & Réchauds', weight_g: 220, price_cents: 6900, bought: -340, condition: 'bon', lent: false, tags: ['cuisine'] },
  { name: 'Popote titane 900ml', brand: 'BRS', category: 'Cuisine & Réchauds', weight_g: 120, price_cents: 5900, bought: -90, condition: 'neuf', lent: false, tags: ['cuisine'] },
  { name: 'Filtre à eau squeez', brand: 'Sawyer', category: 'Eau & Filtres', weight_g: 85, price_cents: 4900, bought: -210, condition: 'bon', lent: false, tags: ['hydratation'] },
  { name: 'Gourde isotherme 750ml', brand: 'Hydro Flask', category: 'Eau & Filtres', weight_g: 180, price_cents: 3500, bought: -150, condition: 'use', lent: false, tags: ['hydratation'] },
  { name: 'Lampe frontale rechargeable 700lm', brand: 'Petzl', category: 'Lampes & Éclairage', weight_g: 100, price_cents: 11900, bought: -180, condition: 'bon', lent: false, maintenance: -20, tags: ['sécurité'] },
  { name: 'Carte IGN + boussole', brand: 'IGN', category: 'Navigation & GPS', weight_g: 110, price_cents: 2500, bought: -330, condition: 'bon', lent: false, tags: ['navigation'] },
  { name: 'GPS randonnée multi-bandes', brand: 'Garmin', category: 'Navigation & GPS', weight_g: 230, price_cents: 24900, bought: -120, condition: 'bon', lent: false, maintenance: 30, tags: ['navigation'] },
  { name: 'Chaussures d\'alpinisme B3', brand: 'La Sportiva', category: 'Vêtements & Vestes', weight_g: 1580, price_cents: 34900, bought: -620, condition: 'a_remplacer', lent: false, tags: ['alpinisme'] },
  { name: 'Veste hardshell Gore-Tex', brand: 'Arc\'teryx', category: 'Vêtements & Vestes', weight_g: 395, price_cents: 49900, bought: -60, condition: 'neuf', lent: false, tags: ['vêtements'] },
  { name: 'Doudoune synthétique compacte', brand: 'Rab', category: 'Vêtements & Vestes', weight_g: 410, price_cents: 19900, bought: -240, condition: 'bon', lent: false, tags: ['vêtements'] },
  { name: 'Crampons semi-automatiques', brand: 'Grivel', category: 'Accessoires & Outils', weight_g: 890, price_cents: 15900, bought: -450, condition: 'use', lent: false, maintenance: 12, tags: ['alpinisme'] },
  { name: 'Piolet technique 60cm', brand: 'Petzl', category: 'Accessoires & Outils', weight_g: 480, price_cents: 9900, bought: -280, condition: 'bon', lent: true, tags: ['alpinisme'] },
  { name: 'Jumelles 8x25', brand: 'Celestron', category: 'Accessoires & Outils', weight_g: 310, price_cents: 12900, bought: -400, condition: 'bon', lent: true, tags: ['observation'] },
  { name: 'Bâtons de randonnée carbone', brand: 'Leki', category: 'Accessoires & Outils', weight_g: 460, price_cents: 12900, bought: -200, condition: 'bon', lent: false, tags: ['rando'] },
  { name: 'Casque alpinisme', brand: 'Petzl', category: 'Sécurité & Soins', weight_g: 380, price_cents: 10900, bought: -350, condition: 'bon', lent: false, tags: ['alpinisme'] },
  { name: 'Trousse de secours alpine', brand: 'Ortlieb', category: 'Sécurité & Soins', weight_g: 240, price_cents: 4500, bought: -160, condition: 'bon', lent: false, expiry: 180, tags: ['sécurité'] },
  { name: 'DVA + pelle + sonde avalanche', brand: 'Arva', category: 'Sécurité & Soins', weight_g: 920, price_cents: 35900, bought: -310, condition: 'bon', lent: false, maintenance: 90, tags: ['sécurité', 'hiver'] },
];

const SEED_KITS = [
  {
    name: 'Kit alpinisme',
    description: 'Course d\'alpinisme classique : arêtes et neige, approche bivouac léger.',
    season: 'hiver',
    items: [
      ['Sac à dos alpinisme 55L', 1, true],
      ['Chaussures d\'alpinisme B3', 1, true],
      ['Crampons semi-automatiques', 1, true],
      ['Piolet technique 60cm', 1, true],
      ['Casque alpinisme', 1, true],
      ['DVA + pelle + sonde avalanche', 1, true],
      ['Veste hardshell Gore-Tex', 1, true],
      ['Duvet plume confort -5°C', 1, false],
    ],
  },
  {
    name: 'Kit bivouac',
    description: 'Nuit en autonomie complète en moyenne montagne, 3 saisons.',
    season: 'toute_saison',
    items: [
      ['Tente bivouac 2P ultralight', 1, true],
      ['Duvet plume confort -5°C', 1, true],
      ['Matelas autogonflant R4', 1, false],
      ['Réchaud à gaz compact', 1, true],
      ['Popote titane 900ml', 1, false],
      ['Filtre à eau squeez', 1, true],
      ['Lampe frontale rechargeable 700lm', 1, true],
      ['Sac à dos alpinisme 55L', 1, true],
    ],
  },
  {
    name: 'Kit GR',
    description: 'Trek itinérant GR : portage raisonnable, navigation et sécurité.',
    season: 'ete',
    items: [
      ['Sac à dos GR 30L', 1, true],
      ['Bâtons de randonnée carbone', 1, true],
      ['Gourde isotherme 750ml', 1, false],
      ['Carte IGN + boussole', 1, true],
      ['Lampe frontale rechargeable 700lm', 1, false],
      ['Trousse de secours alpine', 1, true],
      ['GPS randonnée multi-bandes', 1, false],
      ['Doudoune synthétique compacte', 1, true],
    ],
  },
];

const SEED_LOANS = [
  { item: 'Piolet technique 60cm', borrower: 'Marie Dupont — +33612345678', status: 'en_cours', loaned: -12, due: 9, returned: null },
  { item: 'Jumelles 8x25', borrower: 'Julien Martin — +33765432109', status: 'en_retard', loaned: -30, due: -6, returned: null },
  { item: 'Réchaud à gaz compact', borrower: 'Marie Dupont — +33612345678', status: 'rendu', loaned: -60, due: -46, returned: -45 },
];

const SEED_ALERTS = [
  { type: 'entretien', severity: 'warning', message: 'Contrôler les crampons avant départ (pointes, molettes, antineige)', item: 'Crampons semi-automatiques', due: 10, resolved: false },
  { type: 'etat', severity: 'critical', message: 'Chaussures d\'alpinisme B3 en fin de vie — semelles décollées, à remplacer', item: 'Chaussures d\'alpinisme B3', due: 21, resolved: false },
  { type: 'peremption', severity: 'info', message: 'Contenu de la trousse de secours : vérifier les dates de péremption avant la prochaine sortie', item: null, due: 45, resolved: false },
  { type: 'pret', severity: 'info', message: 'Prêt du réchaud clôturé — objet rendu et rangé dans l\'inventaire', item: null, due: null, resolved: true },
];

// --- Collaborateurs (utilisateurs pairs EXISTANTS — aucune création d'auth user)
const COLLAB_TRIPS = new Map([
  ['tour-mont-blanc-refuge', [{ email: 'y-coequipier@lekitduvoyageur.fr', role: 'editor' }, { email: 'y-peer1@lekitduvoyageur.fr', role: 'viewer' }]],
  ['queyras-etoile', [{ email: 'y-coequipier@lekitduvoyageur.fr', role: 'editor' }]],
  ['roadtrip-ardeche', [{ email: 'y-peer1@lekitduvoyageur.fr', role: 'viewer' }]],
]);

// =============================================================================
// EXÉCUTION
// =============================================================================

console.log(`Seed démo LKDV — utilisateur ${DEMO_EMAIL} (${UID})`);
console.log(`Aujourd'hui : ${iso(today)}`);

// --- 0. Vérification countries_geo (seuls les iso_a2 retournés sont utilisables)
let allowedCountries = new Set();
{
  const { data, error } = await sb.from('countries_geo').select('iso_a2').in('iso_a2', ['FR', ITALY_ISO]);
  if (error) warn(`countries_geo illisible : ${error.message}`);
  allowedCountries = new Set((data ?? []).map((c) => c.iso_a2));
  console.log(`Pays autorisés (countries_geo) : ${[...allowedCountries].join(', ') || 'aucun'}`);
}

// --- 1. Collaborateurs : résolution des ids pairs (via admin API si dispo)
const peerIds = new Map(); // email -> uuid
{
  let resolved = false;
  if (admin) {
    try {
      // Par page de 50 (même pagination que la sonde) puis filtre par email
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 50 });
      if (!error && data?.users) {
        for (const u of data.users) peerIds.set((u.email ?? '').toLowerCase(), u.id);
        resolved = true;
      }
    } catch { /* ignore */ }
  }
  if (!resolved) warn('API admin indisponible : collaborateurs seront ignorés');
}

// --- 2. Upsert des voyages (slug déterministe => idempotent)
await section('trips (upsert par slug)', async () => {
  const rows = TRIPS.map((t) => ({
    slug: t.slug,
    title: t.title,
    description: t.description,
    destination_country_code: allowedCountries.has(t.destination_country_code) ? t.destination_country_code : 'FR',
    destination_name: t.destination_name,
    start_date: offsetDate(t.start_offset),
    end_date: offsetDate(t.end_offset),
    status: t.status,
    visibility: 'private',
    difficulty: t.difficulty,
    primary_activity: t.primary_activity,
    estimated_budget: t.estimated_budget,
    budget_currency: t.budget_currency,
    cover_image_url: COVER,
    user_id: UID,
  }));
  const { error } = await sb.from('trips').upsert(rows, { onConflict: 'slug' });
  if (error) throw error;
  ok(`${rows.length} voyages upsertés (slugs : ${SEED_SLUGS.join(', ')})`);
});

// --- 3. Récupération des voyages seedés (id + dates réelles)
const seeded = new Map(); // slug -> { id, start, end }
{
  const { data, error } = await sb.from('trips').select('id,slug,start_date,end_date').in('slug', SEED_SLUGS);
  if (error) { console.error('FATAL: impossible de relire les voyages seedés:', error.message); process.exit(1); }
  for (const t of data ?? []) seeded.set(t.slug, t);
}

// Trips non seedés (protégés, jamais touchés) pour la preuve d'intégrité
const { data: preserved } = await sb.from('trips').select('id,slug').not('slug', 'in', `(${SEED_SLUGS.join(',')})`).eq('user_id', UID);
const preservedSlugs = (preserved ?? []).map((t) => t.slug);
console.log(`Voyages préservés (non seed) : ${preservedSlugs.join(', ')}`);

const seedTripIds = [...seeded.values()].map((t) => t.id);

// Helper delete-then-insert, restreint aux libellés déterministes du seed
async function refreshRows(table, keyCol, names, mapper) {
  const { error: delErr } = await sb.from(table).delete().in('trip_id', seedTripIds).in(keyCol, names);
  if (delErr) throw delErr;
  const rows = [];
  for (const trip of TRIPS) {
    const rec = seeded.get(trip.slug);
    if (!rec) continue;
    rows.push(...mapper(trip, rec));
  }
  if (!rows.length) return 0;
  const { error: insErr } = await sb.from(table).insert(rows);
  if (insErr) throw insErr;
  return rows.length;
}

// --- 4. Étapes (upsert sur clé unique trip_id,day_number,order_index)
await section('trip_steps', async () => {
  const rows = [];
  for (const trip of TRIPS) {
    const rec = seeded.get(trip.slug);
    if (!rec) continue;
    for (const s of trip.steps) {
      rows.push({
        trip_id: rec.id,
        day_number: s.day,
        order_index: s.order,
        title: s.title,
        description: `Étape ${s.day} : ${s.location}`,
        location_name: s.location,
        latitude: s.lat,
        longitude: s.lng,
        transport_mode: s.transport,
        distance_km: s.km > 0 ? s.km : null,
        elevation_gain_m: s.gain || null,
        elevation_loss_m: s.loss || null,
      });
    }
  }
  const { error } = await sb.from('trip_steps').upsert(rows, { onConflict: 'trip_id,day_number,order_index' });
  if (error) throw error;
  ok(`${rows.length} étapes (coordonnées réelles Alpes/Auvergne/Cévennes/Ardèche)`);
});

// --- 5. Matériel
await section('trip_items', async () => {
  const names = [...new Set(TRIPS.flatMap((t) => t.items.map((i) => i[0])))];
  const n = await refreshRows('trip_items', 'item_name', names, (trip, rec) =>
    trip.items.map(([name, cat, qty, grams, packed, priority, vital, worn, consumable]) => ({
      trip_id: rec.id,
      item_name: name,
      category: cat,
      quantity: qty,
      weight_grams: grams > 0 ? grams : null,
      is_packed: packed,
      status: packed ? 'packed' : 'needed',
      priority,
      is_vital: vital,
      is_worn: worn,
      is_consumable: consumable,
      notes: null,
    }))
  );
  ok(`${n} articles de matériel (mix packed/priority/worn/consumable)`);
});

// --- 6. Dépenses (dates calées sur les dates réelles du voyage)
await section('trip_expenses', async () => {
  const titles = [...new Set(TRIPS.flatMap((t) => t.expenses.map((e) => e[0])))];
  const n = await refreshRows('trip_expenses', 'title', titles, (trip, rec) =>
    trip.expenses.map(([title, amount, category, dayOffset]) => ({
      trip_id: rec.id,
      payer_id: UID,
      title,
      amount,
      currency: 'EUR',
      category,
      expense_date: offsetDate(trip.start_offset + dayOffset),
      split_type: 'equal',
    }))
  );
  ok(`${n} dépenses (transport/lodging/food)`);
});

// --- 7. Documents (file_url placeholder non-null, conforme au schéma)
await section('trip_documents', async () => {
  const titles = [...new Set(TRIPS.flatMap((t) => t.documents.map((d) => d[0])))];
  const n = await refreshRows('trip_documents', 'title', titles, (trip, rec) =>
    trip.documents.map(([title, category, fileName]) => ({
      trip_id: rec.id,
      user_id: UID,
      title,
      category,
      file_url: `${SUPABASE_URL.replace('https://', 'https://')}/storage/v1/object/public/demo-seed/${encodeURIComponent(fileName)}`,
      file_name: fileName,
      mime_type: 'application/pdf',
      notes: 'Document de démonstration (fichier placeholder — non téléchargeable)',
    }))
  );
  ok(`${n} documents (URLs placeholder, category conforme)`);
});

// --- 8. Checkpoints sécurité (status restreint au CHECK : pending|checked)
await section('trip_safety_checkpoints', async () => {
  const labels = [...new Set(TRIPS.flatMap((t) => t.checkpoints.map((c) => c[0])))];
  const n = await refreshRows('trip_safety_checkpoints', 'label', labels, (trip, rec) =>
    trip.checkpoints.map(([label, dayOffset, hour, status]) => ({
      trip_id: rec.id,
      label,
      scheduled_at: tripTs(offsetDate(trip.start_offset + dayOffset), hour),
      status: trip.status === 'active' && dayOffset < 2 ? 'checked' : status,
      contact_name: 'Marie Dupont (contact urgence)',
      contact_phone: '+33612345678',
      notes: 'Checkpoint auto-généré par le seed démo',
    }))
  );
  ok(`${n} checkpoints de sécurité`);
});

// --- 9. Notes / carnet de bord
await section('trip_notes', async () => {
  const titles = [...new Set(TRIPS.flatMap((t) => t.notes.map((n) => n[0])))];
  const n = await refreshRows('trip_notes', 'title', titles, (trip, rec) =>
    trip.notes.map(([title, content, dayNumber, pinned]) => ({
      trip_id: rec.id,
      author_id: UID,
      title,
      content,
      day_number: dayNumber,
      is_pinned: pinned,
    }))
  );
  ok(`${n} notes de journal (FR)`);
});

// --- 10. POIs (points d'eau et panoramas, trips géolocalisés)
await section('trip_pois', async () => {
  const names = [...new Set(TRIPS.flatMap((t) => t.pois.map((p) => p[0])))];
  const n = await refreshRows('trip_pois', 'name', names, (trip, rec) =>
    trip.pois.map(([name, category, lat, lng, visited]) => ({
      trip_id: rec.id,
      name,
      category,
      latitude: lat,
      longitude: lng,
      visited,
      notes: 'POI du seed démo',
    }))
  );
  ok(`${n} POIs (points d'eau / viewpoints / boutiques)`);
});

// --- 11. Collaborateurs (upsert UNIQUE trip_id,user_id) — skip si pas d'admin
await section('trip_collaborators', async () => {
  if (!peerIds.size) throw new Error('aucun utilisateur pair résolu (API admin absente) — skip');
  const rows = [];
  for (const [slug, collabs] of COLLAB_TRIPS) {
    const rec = seeded.get(slug);
    if (!rec) continue;
    for (const c of collabs) {
      const peerId = peerIds.get(c.email.toLowerCase());
      if (!peerId) throw new Error(`pair introuvable : ${c.email}`);
      rows.push({ trip_id: rec.id, user_id: peerId, role: c.role, invited_by: UID });
    }
  }
  if (!rows.length) throw new Error('aucun collaborateur à insérer');
  const { error } = await sb.from('trip_collaborators').upsert(rows, { onConflict: 'trip_id,user_id' });
  if (error) throw error;
  ok(`${rows.length} collaborateurs (pairs existants, aucune création de compte)`);
});

// --- 12. Checklist de préparation (table potentiellement pas encore migrée)
await section('trip_checklist_items', async () => {
  const probe = await sb.from('trip_checklist_items').select('id').limit(1);
  if (probe.error) {
    warn(`table trip_checklist_items absente du schéma distant — SKIP (migration 20260909100000_trip_checklist_items.sql non appliquée)`);
    return;
  }
  const labels = [...new Set(TRIPS.flatMap((t) => t.checklist.map((c) => c[0])))];
  const rows = [];
  for (const trip of TRIPS) {
    const rec = seeded.get(trip.slug);
    if (!rec) continue;
    trip.checklist.forEach(([label, dueOffset, done], idx) => {
      rows.push({
        trip_id: rec.id,
        label,
        due_offset_days: dueOffset,
        done,
        done_at: done ? new Date().toISOString() : null,
        position: idx,
      });
    });
  }
  const { error: delErr } = await sb.from('trip_checklist_items').delete().in('trip_id', seedTripIds).in('label', labels);
  if (delErr) throw delErr;
  const { error: insErr } = await sb.from('trip_checklist_items').insert(rows);
  if (insErr) throw insErr;
  ok(`${rows.length} items de checklist`);
});

// =============================================================================
// 13. POSSESSION — inventaire, kits, prêts, alertes (delete-then-insert scoped)
// =============================================================================

const seedItemNames = SEED_ITEMS.map((i) => i.name);
const seedKitNames = SEED_KITS.map((k) => k.name);
const seedAlertMessages = SEED_ALERTS.map((a) => a.message);

// Scope: ids des objets d'inventaire du seed (pour cibler les enfants FK)
const { data: scopeOwned } = await sb.from('product_ownership')
  .select('id').eq('user_id', UID).in('name', seedItemNames);
const possessionScopeIds = (scopeOwned ?? []).map((r) => r.id);

await section('possession: purge scoped', async () => {
  if (possessionScopeIds.length) {
    const { error: e1 } = await sb.from('materiel_loans').delete()
      .eq('lender_id', UID).in('product_ownership_id', possessionScopeIds);
    if (e1) throw e1;
    const { error: e2 } = await sb.from('alerts').delete()
      .in('product_ownership_id', possessionScopeIds);
    if (e2) throw e2;
  }
  const { error: e3 } = await sb.from('alerts').delete()
    .eq('user_id', UID).in('message', seedAlertMessages);
  if (e3) throw e3;
  const { error: e4 } = await sb.from('materiel_kits').delete()
    .eq('user_id', UID).in('name', seedKitNames);
  if (e4) throw e4; // materiel_kit_items cascade sur les kits
  const { error: e5 } = await sb.from('product_ownership').delete()
    .eq('user_id', UID).in('name', seedItemNames);
  if (e5) throw e5;
});

await section('product_ownership (inventaire)', async () => {
  const rows = SEED_ITEMS.map((i) => ({
    user_id: UID,
    name: i.name,
    brand: i.brand,
    category: i.category,
    weight_g: i.weight_g,
    price_cents: i.price_cents,
    purchase_date: offsetDate(i.bought),
    condition: i.condition,
    is_lent: i.lent,
    maintenance_due_at: i.maintenance ? offsetDate(i.maintenance) : null,
    expiry_date: i.expiry ? offsetDate(i.expiry) : null,
    tags: i.tags,
  }));
  const { error } = await sb.from('product_ownership').insert(rows);
  if (error) throw error;
  ok(`${rows.length} objets d'inventaire (rando/alpinisme, prix + condition + prêts)`);
});

// Relire les ids d'inventaire fraîchement insérés
const ownershipIdByName = new Map();
{
  const { data, error } = await sb.from('product_ownership')
    .select('id,name').eq('user_id', UID).in('name', seedItemNames);
  if (error) { console.error('FATAL: relecture inventaire impossible:', error.message); process.exit(1); }
  for (const r of data ?? []) ownershipIdByName.set(r.name, r.id);
}

const kitIds = new Map(); // nom -> uuid

await section('materiel_kits + materiel_kit_items', async () => {
  for (const kit of SEED_KITS) {    const totalWeight = kit.items.reduce((s, [name, qty]) => {
      const item = SEED_ITEMS.find((i) => i.name === name);
      return s + (item ? item.weight_g * qty : 0);
    }, 0);
    const { data, error } = await sb.from('materiel_kits').insert({
      user_id: UID,
      name: kit.name,
      description: kit.description,
      season: kit.season,
      total_weight_g: totalWeight,
      is_favorite: kit.name === 'Kit bivouac',
    }).select('id');
    if (error) throw error;
    const kitId = data?.[0]?.id;
    const items = kit.items.map(([name, qty, checked]) => {
      const inv = SEED_ITEMS.find((i) => i.name === name);
      return {
        kit_id: kitId,
        product_ownership_id: ownershipIdByName.get(name) ?? null,
        user_id: UID,
        name,
        quantity: qty,
        category: inv?.category ?? null,
        weight_g: inv?.weight_g ?? 0,
        is_checked: checked,
      };
    });
    const { error: itemErr } = await sb.from('materiel_kit_items').insert(items);
    if (itemErr) throw itemErr;
    kitIds.set(kit.name, kitId);
  }
  ok(`${SEED_KITS.length} kits (alpinisme / bivouac / GR) + ${SEED_KITS.reduce((s, k) => s + k.items.length, 0)} articles de kit`);
});

await section('trips.kit_id (kit sélectionné par voyage)', async () => {
  const kitByTrip = {
    'tour-mont-blanc-refuge': 'Kit alpinisme',
    'queyras-etoile': 'Kit GR',
    'cevennes-rando': 'Kit GR',
    'bivouac-vercors': 'Kit bivouac',
  };
  let linked = 0;
  for (const [slug, kitName] of Object.entries(kitByTrip)) {
    const kitId = kitIds.get(kitName);
    const tripId = seeded.get(slug)?.id;
    if (!kitId || !tripId) continue;
    const { error } = await sb.from('trips').update({ kit_id: kitId }).eq('id', tripId);
    if (error) throw error;
    linked += 1;
  }
  ok(`${linked} voyages liés à leur kit sélectionné`);
});

await section('materiel_loans (prêts)', async () => {
  const rows = SEED_LOANS.map((l) => ({
    product_ownership_id: ownershipIdByName.get(l.item),
    lender_id: UID,
    borrower_contact: l.borrower,
    status: l.status,
    loaned_at: offsetDate(l.loaned),
    due_date: l.due != null ? offsetDate(l.due) : null,
    returned_at: l.returned != null ? offsetDate(l.returned) : null,
  }));
  const { error } = await sb.from('materiel_loans').insert(rows);
  if (error) throw error;
  ok(`${rows.length} prêts (1 en cours, 1 en retard, 1 rendu)`);
});

await section('alerts (contrôle / entretien)', async () => {
  const rows = SEED_ALERTS.map((a) => ({
    user_id: UID,
    product_ownership_id: a.item ? (ownershipIdByName.get(a.item) ?? null) : null,
    type: a.type,
    severity: a.severity,
    message: a.message,
    is_resolved: a.resolved,
    due_at: a.due != null ? `${offsetDate(a.due)}T09:00:00Z` : null,
  }));
  const { error } = await sb.from('alerts').insert(rows);
  if (error) throw error;
  ok(`${rows.length} alertes (3 actives : entretien, état, péremption)`);
});

// =============================================================================
// VÉRIFICATION — comptages par table, périmètre = voyages seedés uniquement
// =============================================================================

console.log('\n=== VÉRIFICATION (comptages sur les voyages seedés) ===');
const counts = {};
const targets = [
  ['trips', null], ['trip_steps', null], ['trip_items', null], ['trip_expenses', null],
  ['trip_documents', null], ['trip_safety_checkpoints', null], ['trip_notes', null],
  ['trip_pois', null], ['trip_checklist_items', null],
];
for (const [table] of targets) {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  if (table === 'trips') q = q.in('slug', SEED_SLUGS);
  else q = q.in('trip_id', seedTripIds);
  const { count, error } = await q;
  counts[table] = error ? `ERR: ${error.message}` : count;
}

const w = Math.max(...targets.map(([t]) => t.length));
for (const [table] of targets) {
  console.log(`  ${table.padEnd(w)} : ${counts[table]}`);
}

// --- Comptages POSSESSION (périmètre = libellés déterministes du seed) ---
let seedKitIds = [];
{
  const { data, error } = await sb.from('materiel_kits').select('id')
    .eq('user_id', UID).in('name', seedKitNames);
  if (!error) seedKitIds = (data ?? []).map((k) => k.id);
}
let freshScopeIds = [];
{
  const { data, error } = await sb.from('product_ownership').select('id')
    .eq('user_id', UID).in('name', seedItemNames);
  if (!error) freshScopeIds = (data ?? []).map((r) => r.id);
}
const possessionTargets = [
  ['product_ownership', sb.from('product_ownership').select('id', { count: 'exact', head: true }).eq('user_id', UID).in('name', seedItemNames)],
  ['materiel_kits', sb.from('materiel_kits').select('id', { count: 'exact', head: true }).eq('user_id', UID).in('name', seedKitNames)],
  ['materiel_kit_items', seedKitIds.length
    ? sb.from('materiel_kit_items').select('id', { count: 'exact', head: true }).in('kit_id', seedKitIds)
    : null],
  ['materiel_loans', freshScopeIds.length
    ? sb.from('materiel_loans').select('id', { count: 'exact', head: true }).eq('lender_id', UID).in('product_ownership_id', freshScopeIds)
    : null],
  ['alerts', sb.from('alerts').select('id', { count: 'exact', head: true }).eq('user_id', UID).in('message', seedAlertMessages)],
];
const wp = Math.max(...possessionTargets.map(([t]) => t.length));
console.log(`\n=== VÉRIFICATION (comptages possession — périmètre seed) ===`);
for (const [table, q] of possessionTargets) {
  if (!q) { console.log(`  ${table.padEnd(wp)} : 0 (aucune cible)`); continue; }
  const { count, error } = await q;
  console.log(`  ${table.padEnd(wp)} : ${error ? `ERR: ${error.message}` : count}`);
}

// --- Preuve hub : le compteur POSSESSION du hub doit être non nul ---
const { count: hubItems } = await sb.from('product_ownership')
  .select('*', { count: 'exact', head: true }).eq('user_id', UID);
const { count: hubAlerts } = await sb.from('alerts')
  .select('*', { count: 'exact', head: true }).eq('user_id', UID).eq('is_resolved', false);
const { count: hubLoans } = await sb.from('materiel_loans')
  .select('*', { count: 'exact', head: true }).eq('lender_id', UID).in('status', ['en_cours', 'en_retard']);
console.log(`\nCompteur hub POSSESSION (tout l'inventaire utilisateur) : ${hubItems ?? 'ERR'} objets, ${hubAlerts ?? 'ERR'} alertes actives, ${hubLoans ?? 'ERR'} prêts en cours/retard`);

// Intégrité : les voyages préservés existent toujours, intacts
const { data: checkPreserved, error: chkErr } = await sb.from('trips').select('id,slug').like('slug', 'fdgb%');
const { data: checkExped } = await sb.from('trips').select('id,slug').like('slug', 'y-exped-group%');
if (!chkErr && checkExped) (checkPreserved ?? []).push(...checkExped);
console.log(`\nVoyages préservés intacts (fdgb, y-exped-group) : ${chkErr ? 'ERREUR ' + chkErr.message : (checkPreserved ?? []).map((t) => t.slug).join(', ')}`);
console.log('\nSeed terminé. Relancez le script : les comptages ci-dessus doivent être IDENTIQUES (idempotence).');
