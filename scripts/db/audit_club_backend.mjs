import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAudit() {
  console.log('=== AUDITING CLUB BACKEND & QUERIES ===\n');

  // 1. Fetch clubs
  const { data: clubs, error: clubsErr } = await supabase.from('clubs').select('*');
  console.log('Clubs query result:', { count: clubs?.length, error: clubsErr });
  if (!clubs || clubs.length === 0) return;

  const testClub = clubs[0];
  console.log(`\nTesting with Club: ${testClub.name} (id: ${testClub.id}, slug: ${testClub.slug})`);

  // 2. Test topics query as done in page.tsx
  const topicsQuery = await supabase
    .from('club_topics')
    .select('*, author:user_profiles(full_name)')
    .eq('club_id', testClub.id)
    .eq('is_approved', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  console.log('\n1. club_topics query:', {
    dataCount: topicsQuery.data?.length,
    error: topicsQuery.error,
    sample: topicsQuery.data?.[0]
  });

  // 3. Test members query as done in page.tsx
  const membersQuery = await supabase
    .from('club_members')
    .select('*, user:user_profiles(full_name, trust_score, avatar_url)')
    .eq('club_id', testClub.id)
    .eq('status', 'active');

  console.log('\n2. club_members query:', {
    dataCount: membersQuery.data?.length,
    error: membersQuery.error,
    sample: membersQuery.data?.[0]
  });

  // 4. Test events query as done in page.tsx
  const eventsQuery = await supabase
    .from('club_events')
    .select('*')
    .eq('club_id', testClub.id)
    .order('event_date', { ascending: true });

  console.log('\n3. club_events query:', {
    dataCount: eventsQuery.data?.length,
    error: eventsQuery.error,
    sample: eventsQuery.data?.[0]
  });

  // 5. Test bot user auth & post creation
  console.log('\n4. Testing Post Insertion with Bot user auth...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'demo.bot@example.com',
    password: 'password123'
  });

  if (authErr) {
    console.error('Bot sign in error:', authErr);
  } else {
    console.log('Bot signed in successfully. User ID:', authData.user.id);
    
    // Check if user_profiles row exists for bot
    const { data: profile, error: profErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    console.log('Bot user_profile:', { profile, profErr });

    // Test insert topic
    const insertRes = await supabase.from('club_topics').insert({
      club_id: testClub.id,
      author_id: authData.user.id,
      title: 'Test Topic Audit',
      content: 'Contenu du test d audit',
      is_pinned: false,
    }).select().single();

    console.log('Insert topic result:', {
      data: insertRes.data,
      error: insertRes.error
    });
  }
}

runAudit().catch(console.error);
