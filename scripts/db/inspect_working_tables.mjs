import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectColumns() {
  console.log('--- Inspecting community_posts row keys ---');
  const { data: posts, error: postsErr } = await supabase.from('community_posts').select('*').limit(1);
  if (posts && posts.length > 0) {
    console.log('community_posts keys:', Object.keys(posts[0]));
    console.log('community_posts sample:', posts[0]);
  } else {
    console.log('community_posts error or empty:', postsErr);
  }

  console.log('\n--- Inspecting groupe_membres row keys ---');
  const { data: gm, error: gmErr } = await supabase.from('groupe_membres').select('*').limit(1);
  if (gm && gm.length > 0) {
    console.log('groupe_membres keys:', Object.keys(gm[0]));
    console.log('groupe_membres sample:', gm[0]);
  } else {
    console.log('groupe_membres error or empty:', gmErr);
  }

  console.log('\n--- Inspecting groupes row keys ---');
  const { data: grp, error: grpErr } = await supabase.from('groupes').select('*').limit(1);
  if (grp && grp.length > 0) {
    console.log('groupes keys:', Object.keys(grp[0]));
    console.log('groupes sample:', grp[0]);
  } else {
    console.log('groupes error or empty:', grpErr);
  }
}

inspectColumns();
