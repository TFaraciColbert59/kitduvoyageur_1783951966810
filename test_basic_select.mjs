import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

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
