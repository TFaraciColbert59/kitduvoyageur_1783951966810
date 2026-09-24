import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_URL est requis'); })();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY est requis'); })();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBasicSelect() {
  console.log('--- Testing basic select without joins ---');

  const { data: topics, error: topicsErr } = await supabase.from('club_topics').select('*');
  console.log('club_topics select(*):', { count: topics?.length, error: topicsErr });

  const { data: members, error: membersErr } = await supabase.from('club_members').select('*');
  console.log('club_members select(*):', { count: members?.length, error: membersErr });

  const { data: events, error: eventsErr } = await supabase.from('club_events').select('*');
  console.log('club_events select(*):', { count: events?.length, error: eventsErr });

  const { data: profiles, error: profErr } = await supabase.from('user_profiles').select('*');
  console.log('user_profiles select(*):', { count: profiles?.length, error: profErr });
}

testBasicSelect();
