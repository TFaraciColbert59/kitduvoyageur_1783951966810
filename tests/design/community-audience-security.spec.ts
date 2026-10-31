import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const file = (path: string) => readFileSync(path, 'utf8');
const clubPanel = file('src/components/clubs/ClubPrivatePostsPanel.tsx');
const clubDesktop = file('src/app/clubs/[id]/page.tsx');
const guard = file('supabase/migrations/20261015231000_community_restricted_media_club_hardening.sql');
const policies = file('supabase/migrations/20261015220000_community_post_audience_rls.sql');

describe('P0 social privacy: club and follower-only posts', () => {
  it('keeps the club member feed behind user Supabase RLS on mobile and desktop', () => {
    expect(clubPanel).toContain(".from('community_posts')");
    expect(clubPanel).toContain(".eq('audience', 'club')");
    expect(clubPanel).toContain("if (!user?.id || !isMember) return null");
    expect(clubPanel).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(clubDesktop).toContain('<ClubPrivatePostsPanel');
  });

  it('enforces child-row visibility even when old owner FOR ALL policies persist', () => {
    for (const table of ['post_comments', 'post_likes', 'post_comment_likes', 'club_topics', 'club_topic_replies', 'club_topic_likes']) {
      const name = table === 'club_topics' ? 'club_topics_parent_privacy_guard' : table + '_parent_visibility_guard';
      expect(guard).toContain('CREATE POLICY ' + name);
    }
    expect(guard.match(/AS RESTRICTIVE/g)?.length).toBe(11);
    expect(policies).toContain('DROP POLICY IF EXISTS public_read_community_posts');
  });
});
