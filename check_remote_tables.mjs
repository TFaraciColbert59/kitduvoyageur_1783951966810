import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTables() {
  const tables = [
    'clubs',
    'club_topics',
    'club_members',
    'club_events',
    'club_topic_replies',
    'groupes',
    'groupe_membres',
    'group_members',
    'group_messages',
    'group_events',
    'group_expenses',
    'group_tasks',
    'group_equipment',
    'user_profiles'
  ];

  console.log('Testing existence of tables in remote Supabase:');
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${table}: ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ ${table}: exists`);
    }
  }
}

checkTables();
