import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment variables missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectSchema() {
  console.log('=== INSPECTION DES TABLES SUPABASE ===');

  const tables = ['carnets', 'hike_sessions', 'carnet_moments', 'groupes', 'groupe_etapes', 'groupe_hebergements', 'carnet_kit_items'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table ${table}:`, error.message);
    } else {
      console.log(`✅ Table ${table}: OK (cols: ${data && data[0] ? Object.keys(data[0]).join(', ') : '0 ligne / disponible'})`);
    }
  }
}

inspectSchema();
