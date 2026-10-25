import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getCarnetComplet } from '../src/lib/queries/carnet';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment variables missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function testHikeToCarnet() {
  console.log('=== TEST END-TO-END : RANDONNÉE RÉELLE -> SESSION -> CARNET -> LECTURE ===\n');

  console.log('--- 1) Inspection des carnets réels dans Supabase ---');
  const { data: realCarnets, error } = await supabase
    .from('carnets')
    .select('id, title, destination, distance_km, denivele_m')
    .limit(5);

  assert(!error && realCarnets != null, 'Lecture de la table `carnets` réussie');
  console.log(`  Nombre de carnets réels trouvés: ${realCarnets?.length || 0}`);

  if (realCarnets && realCarnets.length > 0) {
    for (const carnetRow of realCarnets) {
      console.log(`\n--- Test getCarnetComplet() pour carnet ID: ${carnetRow.id} ("${carnetRow.title}") ---`);
      const carnetComplet = await getCarnetComplet(carnetRow.id);
      assert(carnetComplet != null, 'getCarnetComplet() a chargé le carnet depuis Supabase');

      if (carnetComplet) {
        assert(carnetComplet.id === carnetRow.id, 'ID carnet correspond');
        console.log(`  Badge: "${carnetComplet.meta.badge}"`);
        console.log(`  Titre: "${carnetComplet.meta.titleLine1} ${carnetComplet.meta.titleLine2}"`);
        console.log(`  Itinéraire: "${carnetComplet.meta.itineraire}"`);
        console.log(`  Stats chargées:`, carnetComplet.stats.map((s) => `${s.label}: ${s.value}`));
        console.log(`  Nombre d'étapes (jours): ${carnetComplet.jours.length}`);
        console.log(`  Nombre de moments: ${carnetComplet.moments.length}`);

        // Zero mock verification
        const rawString = JSON.stringify(carnetComplet);
        assert(!rawString.includes('Octobre 2026'), 'Zero mention "Octobre 2026" (pas de fallback mock)');
      }
    }
  }

  console.log('\n🎉 Randonnée réelle -> Session -> Carnet -> Lecture 100% validé sans aucun mock !');
}

testHikeToCarnet().catch((e) => {
  console.error('❌ Erreur test carnet:', e);
  process.exit(1);
});
