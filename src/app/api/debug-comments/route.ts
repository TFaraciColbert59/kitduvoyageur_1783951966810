import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fetch a post
  const { data: posts, error: postErr } = await supabase.from('community_posts').select('*').limit(1);
  if (postErr || !posts || posts.length === 0) return NextResponse.json({ error: 'No posts', details: postErr });

  // 2. Fetch a user
  const { data: users, error: userErr } = await supabase.from('user_profiles').select('*').limit(1);
  if (userErr || !users || users.length === 0) return NextResponse.json({ error: 'No users', details: userErr });

  // 3. Try inserting a comment
  const { data: insertData, error: insertErr } = await supabase.from('post_comments').insert({
    post_id: posts[0].id,
    author_id: users[0].id,
    content: 'Test comment from debug script'
  }).select();

  // 4. Try fetching comments with relation
  const { data: fetchComments, error: fetchErr } = await supabase.from('post_comments').select(`
    *,
    author:user_profiles(full_name, avatar_url)
  `).limit(5);

  return NextResponse.json({
    insert: { data: insertData, error: insertErr },
    fetch: { data: fetchComments, error: fetchErr }
  });
}
