import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAllTables() {
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
    'community_posts',
    'post_comments',
    'user_profiles'
  ];

  console.log('--- Testing select(*) on all community tables ---');
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ ${table}: SELECT * SUCCESS! Returned ${data.length} row(s)`);
    }
  }
}

testAllTables();
