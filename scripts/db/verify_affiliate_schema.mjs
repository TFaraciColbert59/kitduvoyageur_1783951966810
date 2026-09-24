import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_URL est requis'); })();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY est requis'); })();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  console.log('=== Verifying Affiliate Schema ===');
  const tables = [
    'affiliate_partners',
    'affiliate_programs',
    'affiliate_offers',
    'affiliate_clicks',
    'affiliate_conversions',
  ];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ Table ${t}:`, error.message);
    } else {
      console.log(`✅ Table ${t}: ${count} rows`);
    }
  }
}

verify();
