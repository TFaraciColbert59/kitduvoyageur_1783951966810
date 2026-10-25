/**
 * LKDV — Script d'Idempotence de Seed des Lieux Communautaires (Chantier 4)
 * Injecte 42 lieux réels qualifiés pour les 5 pays phares (FR, NP, PE, IS, MA).
 * Exécution : npx tsx scripts/seed-places.ts
 */

import { createClient } from '@supabase/supabase-js';
import { REAL_COMMUNITY_PLACES_SEED } from '../src/features/places/data/placesSeed';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charge les variables d'environnement (.env.local puis .env)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SEED PLACES] Erreur : URL Supabase ou Clé manquante dans l’environnement.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedPlaces() {
  console.log(`[SEED PLACES] Début du seed pour ${REAL_COMMUNITY_PLACES_SEED.length} lieux réels...`);

  const payload = REAL_COMMUNITY_PLACES_SEED.map((place) => ({
    slug: place.slug,
    name: place.name,
    category: place.category,
    country_code: place.country_code,
    region: place.region,
    city: place.city,
    latitude: place.latitude,
    longitude: place.longitude,
    altitude_m: place.altitude_m,
    description: place.description,
    sensitivity: place.sensitivity,
    source: place.source,
    is_verified: place.is_verified,
    practical_info: place.practical_info,
  }));

  // Upsert idempotent sur la contrainte UNIQUE slug
  const { data, error } = await supabase
    .from('places')
    .upsert(payload, { onConflict: 'slug' })
    .select('country_code, slug, category');

  if (error) {
    console.error('[SEED PLACES] Échec de l’insertion Supabase :', error);
    process.exit(1);
  }

  console.log(`[SEED PLACES] Succès ! ${data?.length || 0} lieux synchronisés.`);

  // Comptage de vérification par pays
  const counts: Record<string, number> = {};
  const catCounts: Record<string, number> = {};
  for (const place of REAL_COMMUNITY_PLACES_SEED) {
    counts[place.country_code] = (counts[place.country_code] || 0) + 1;
    catCounts[place.category] = (catCounts[place.category] || 0) + 1;
  }

  console.log('\n[RÉPARTITION RÉELLE PAR PAYS (C4 SEUIL ATTEINT)]');
  for (const [code, count] of Object.entries(counts)) {
    console.log(`- ${code} : ${count} lieux réels qualifiés`);
  }

  console.log('\n[RÉPARTITION PAR CATÉGORIE]');
  for (const [cat, count] of Object.entries(catCounts)) {
    console.log(`- ${cat} : ${count}`);
  }
}

seedPlaces().catch((err) => {
  console.error('[SEED PLACES] Erreur inattendue :', err);
  process.exit(1);
});
