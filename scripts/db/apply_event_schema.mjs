import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const sql = `
    -- Table for event participants
    CREATE TABLE IF NOT EXISTS public.club_event_participants (
      event_id UUID REFERENCES public.club_events(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id)
    );

    ALTER TABLE public.club_event_participants ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "event_participants_read" ON public.club_event_participants;
    CREATE POLICY "event_participants_read" ON public.club_event_participants FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "event_participants_insert" ON public.club_event_participants;
    CREATE POLICY "event_participants_insert" ON public.club_event_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "event_participants_delete" ON public.club_event_participants;
    CREATE POLICY "event_participants_delete" ON public.club_event_participants FOR DELETE TO authenticated USING (user_id = auth.uid());

    -- Table for topic likes
    CREATE TABLE IF NOT EXISTS public.club_topic_likes (
      topic_id UUID REFERENCES public.club_topics(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (topic_id, user_id)
    );

    ALTER TABLE public.club_topic_likes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "topic_likes_read" ON public.club_topic_likes;
    CREATE POLICY "topic_likes_read" ON public.club_topic_likes FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "topic_likes_insert" ON public.club_topic_likes;
    CREATE POLICY "topic_likes_insert" ON public.club_topic_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "topic_likes_delete" ON public.club_topic_likes;
    CREATE POLICY "topic_likes_delete" ON public.club_topic_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

    -- Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
  `;

  // Note: RPC exec_sql needs to exist. Since we used psql before, we can just use the standard API or if we don't have exec_sql, we might need a workaround. 
  // Oh, wait, in a previous step I remember the user didn't have exec_sql, but we CAN use the MCP supabase tool.
  console.log("SQL to run:", sql);
}

main().catch(console.error);
