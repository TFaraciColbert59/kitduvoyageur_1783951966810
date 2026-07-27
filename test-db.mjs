import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://icxyvwzfjbflcbqukpfz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA'
);

async function test() {
  const { data: posts } = await supabase.from('community_posts').select('*').limit(1);
  console.log("Posts:", posts);
}
test();
