import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3OiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log('=== AUDIT SCHEMA CARNETS & HIKE SESSIONS ===');

  const { data: carnets, error: cErr } = await supabase.from('carnets').select('*').limit(1);
  if (cErr) console.error('Erreur carnets:', cErr.message);
  else console.log('✅ Table carnets colonnes:', Object.keys(carnets[0] || {}));

  const { data: moments, error: mErr } = await supabase.from('carnet_moments').select('*').limit(1);
  if (mErr) console.error('Erreur carnet_moments:', mErr.message);
  else console.log('✅ Table carnet_moments colonnes:', Object.keys(moments[0] || {}));

  const { data: sessions, error: sErr } = await supabase.from('hike_sessions').select('*').limit(1);
  if (sErr) console.error('Erreur hike_sessions:', sErr.message);
  else console.log('✅ Table hike_sessions colonnes:', Object.keys(sessions[0] || {}));
}

checkSchema();
