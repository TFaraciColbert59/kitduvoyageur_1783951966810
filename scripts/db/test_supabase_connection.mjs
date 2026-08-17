import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

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
