import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
// Ensure to replace with the actual anon key from .env.local if not loaded
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Seeding demo data for clubs...');

  // 1. Fetch all clubs
  const { data: clubs, error: clubsError } = await supabase.from('clubs').select('*');
  if (clubsError || !clubs || clubs.length === 0) {
    console.error('No clubs found or error:', clubsError);
    return;
  }
  
  console.log(`Found ${clubs.length} clubs. Seeding them all...`);

  // 2. We need a "Bot" user to insert things. Let's create one or find one.
  const botEmail = 'demo.bot@example.com';
  const botPassword = 'password123';
  
  let { data: authData, error: authError } = await supabase.auth.signUp({
    email: botEmail,
    password: botPassword,
    options: {
      data: {
        full_name: 'Alexandre (Guide Local)',
      }
    }
  });

  if (authError && authError.message.includes('already registered')) {
    const res = await supabase.auth.signInWithPassword({
      email: botEmail,
      password: botPassword,
    });
    authData = res.data;
  }
  
  const botUser = authData?.user;
  if (!botUser) {
    console.error('Failed to get bot user:', authError);
    return;
  }
  console.log('Bot user ready:', botUser.id);

  // Ensure bot profile has avatar
  await supabase.from('user_profiles').update({
    full_name: 'Alexandre (Guide Local)',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexandre',
    bio: 'Passionné de montagne et guide local.',
    trust_score: 95
  }).eq('id', botUser.id);

  for (const club of clubs) {
    console.log(`\nSeeding club: ${club.name}`);
    
    // 3. Add bot to club members if not already
    const { data: existingMember } = await supabase.from('club_members').select('*').eq('club_id', club.id).eq('user_id', botUser.id);
    if (!existingMember || existingMember.length === 0) {
      await supabase.from('club_members').insert({
        club_id: club.id,
        user_id: botUser.id,
        role: 'moderator',
        status: 'active'
      });
      console.log('Bot added as member.');
    }

    // 4. Create some demo events
    const { data: existingEvents } = await supabase.from('club_events').select('*').eq('club_id', club.id);
    if (!existingEvents || existingEvents.length === 0) {
      const now = new Date();
      const eventDate1 = new Date(now); eventDate1.setDate(eventDate1.getDate() + 14);
      const eventDate2 = new Date(now); eventDate2.setDate(eventDate2.getDate() + 30);
      
      await supabase.from('club_events').insert([
        {
          club_id: club.id,
          organizer_id: botUser.id,
          title: `Bivouac Initiation - ${club.name}`,
          description: 'Une première nuit en extérieur pour se familiariser avec le matériel.',
          event_date: eventDate1.toISOString(),
          location: 'Point de rassemblement',
          max_participants: 10,
          participants_count: 3
        },
        {
          club_id: club.id,
          organizer_id: botUser.id,
          title: `Expédition avancée - ${club.name}`,
          description: 'Sortie technique nécessitant un bon niveau.',
          event_date: eventDate2.toISOString(),
          location: 'Sommet local',
          max_participants: 6,
          participants_count: 6
        }
      ]);
      console.log('Demo events inserted.');
    }

    // 5. Create some Guides/Astuces (is_pinned = true)
    const { data: existingTopics } = await supabase.from('club_topics').select('*').eq('club_id', club.id);
    if (!existingTopics || existingTopics.filter(t => t.is_pinned).length === 0) {
      await supabase.from('club_topics').insert([
        {
          club_id: club.id,
          author_id: botUser.id,
          title: '[GUIDE] Le matériel indispensable',
          content: 'Voici la liste du matériel recommandé pour nos sorties : sac à dos, eau, etc.',
          is_pinned: true,
          likes_count: 12
        }
      ]);
      console.log('Demo guides inserted.');
    }
  }

  console.log('Seeding complete.');
}

main().catch(console.error);
