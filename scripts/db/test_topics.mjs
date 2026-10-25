import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('club_topic_replies')
    .select('*, author:user_profiles(full_name, avatar_url)');

  if (error) {
    console.error("Error fetching replies:", error);
  } else {
    console.log(`Fetched ${data?.length} replies.`);
  }
}

main().catch(console.error);
