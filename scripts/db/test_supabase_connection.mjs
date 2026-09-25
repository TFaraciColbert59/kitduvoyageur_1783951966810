import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_URL est requis'); })();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY est requis'); })();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  console.log('=== VERIFICATION SUPABASE BDD ===');
  console.log('URL:', supabaseUrl);

  const tables = ['hiking_routes', 'explore_trails', 'trail_metadata', 'trail_scores', 'hike_sessions'];

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ Table "${table}": Erreur:`, error.message);
    } else {
      console.log(`✅ Table "${table}": ${count} lignes réelles enregistrées.`);
    }
  }

  const { data: sampleRoutes, error: sampleError } = await supabase
    .from('hiking_routes')
    .select('id, name, distance_km')
    .limit(3);

  if (sampleError) {
    console.error('❌ Erreur lecture routes sample:', sampleError);
  } else {
    console.log('\n--- Sample Routes ---');
    console.log(sampleRoutes);
  }
}

checkDatabase();
