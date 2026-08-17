import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testJoins() {
  console.log('Testing PostgREST Join syntaxes for club_topics:');

  const syntaxes = [
    '*, author:user_profiles(full_name)',
    '*, user_profiles(full_name)',
    '*, author:user_profiles!author_id(full_name)',
    '*, author:user_profiles!club_topics_author_id_fkey(full_name)',
    '*, user_profiles!author_id(full_name)',
    '*, user_profiles!club_topics_author_id_fkey(full_name)',
  ];

  for (const syn of syntaxes) {
    const { data, error } = await supabase.from('club_topics').select(syn).limit(1);
    if (error) {
      console.log(`❌ Syntax "${syn}": ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ Syntax "${syn}": SUCCESS! Sample author:`, data[0]?.author || data[0]?.user_profiles);
    }
  }

  console.log('\nTesting PostgREST Join syntaxes for club_members:');
  const memberSyntaxes = [
    '*, user:user_profiles(full_name, trust_score, avatar_url)',
    '*, user_profiles(full_name, trust_score, avatar_url)',
    '*, user_profiles!user_id(full_name, trust_score, avatar_url)',
    '*, user_profiles!club_members_user_id_fkey(full_name, trust_score, avatar_url)',
  ];

  for (const syn of memberSyntaxes) {
    const { data, error } = await supabase.from('club_members').select(syn).limit(1);
    if (error) {
      console.log(`❌ Syntax "${syn}": ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ Syntax "${syn}": SUCCESS! Sample user:`, data[0]?.user || data[0]?.user_profiles);
    }
  }
}

testJoins();
