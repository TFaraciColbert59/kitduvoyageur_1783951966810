import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_URL est requis'); })();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY est requis'); })();

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
