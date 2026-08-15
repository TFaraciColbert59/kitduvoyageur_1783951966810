import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

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
