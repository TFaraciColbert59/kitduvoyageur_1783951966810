/**
 * LKDV — Script d'Idempotence de Seed des Destinations (Chantier 2)
 * Injecte les étapes réelles pour les 5 pays phares (FR, NP, PE, IS, MA).
 * Exécution : npx tsx scripts/seed-destinations.ts
 */

import { createClient } from '@supabase/supabase-js';
import { SEED_DESTINATION_STEPS } from '../src/features/trips/data/destinationsSeed';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charge les variables d'environnement (.env.local puis .env)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SEED] Erreur : URL Supabase ou Clé manquante dans l’environnement.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDestinations() {
  console.log(`[SEED] Début du seed pour ${SEED_DESTINATION_STEPS.length} étapes réelles...`);

  const payload = SEED_DESTINATION_STEPS.map((step) => ({
    natural_key: step.natural_key,
    country_code: step.country_code,
    title: step.title,
    location_name: step.location_name,
    latitude: step.latitude,
    longitude: step.longitude,
    description: step.description,
    distance_km: step.distance_km,
    elevation_gain_m: step.elevation_gain_m,
    elevation_loss_m: step.elevation_loss_m,
    difficulty: step.difficulty || 'moderate',
    activity_type: step.activity_type || 'trekking',
    order_hint: step.order_hint || 0,
    is_demanding: step.is_demanding || false,
    source: 'import',
    provenance: step.provenance,
  }));

  // Upsert idempotent sur la clé naturelle
  const { data, error } = await supabase
    .from('destination_steps')
    .upsert(payload, { onConflict: 'natural_key' })
    .select('country_code, natural_key');

  if (error) {
    console.error('[SEED] Échec de l’insertion Supabase :', error);
    process.exit(1);
  }

  console.log(`[SEED] Succès ! ${data?.length || 0} lignes synchronisées.`);

  // Comptage de vérification par pays
  const counts: Record<string, number> = {};
  for (const step of SEED_DESTINATION_STEPS) {
    counts[step.country_code] = (counts[step.country_code] || 0) + 1;
  }

  console.log('\n[RÉPARTITION RÉELLE PAR PAYS]');
  for (const [code, count] of Object.entries(counts)) {
    console.log(`- ${code} : ${count} étapes réelles sourcées`);
  }
}

seedDestinations().catch((err) => {
  console.error('[SEED] Erreur inattendue :', err);
  process.exit(1);
});
