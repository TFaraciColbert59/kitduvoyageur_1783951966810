import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const file = (path: string) => readFileSync(path, 'utf8');
const publisher = file('src/app/communaute/publier/page.tsx');
const clubPanel = file('src/components/clubs/ClubPrivatePostsPanel.tsx');
const clubDesktop = file('src/app/clubs/[id]/page.tsx');
const clubMobile = file('src/components/clubs/MobileClubDetailView.tsx');
const guard = file('supabase/migrations/20261015231000_community_restricted_media_club_hardening.sql');
const policies = file('supabase/migrations/20261015220000_community_post_audience_rls.sql');

describe('P0 social privacy: club and follower-only posts', () => {
  it('never routes a private club post into public-read legacy club_topics', () => {
    expect(publisher).not.toContain(".from('club_topics').insert(clubPayload)");
    expect(publisher).toContain(".from('community_posts').insert(payload)");
    expect(publisher).toContain("club_id: audience === 'club' ? selectedClub : null");
  });

  it('retains a strict text-only fallback until signed media is available', () => {
    expect(publisher).toContain("if (audience !== 'public' &&");
    expect(publisher).toContain("photos.length > 0");
    expect(publisher).toContain('const confirmedMediaUrls: string[] = [];');
    expect(publisher).toContain('await uploadPublicationPhoto(photo)');
    expect(publisher).not.toContain('void uploadPublicationPhoto(photo)');
    expect(guard).toContain("NEW.audience <> 'public'");
    expect(guard).toContain("NEW.media_urls");
    expect(guard).toContain("NEW.linked_carnet_id IS NOT NULL");
    expect(guard).toContain("NEW.snapshot_payload IS NOT NULL");
    expect(guard).toContain("UPDATE OF audience, image_url, media_urls");
  });

  it('keeps the club member feed behind user Supabase RLS on mobile and desktop', () => {
    expect(clubPanel).toContain(".from('community_posts')");
    expect(clubPanel).toContain(".eq('audience', 'club')");
    expect(clubPanel).toContain("if (!user?.id || !isMember) return null");
    expect(clubPanel).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(clubDesktop).toContain('<ClubPrivatePostsPanel');
    expect(clubMobile).toContain('<ClubPrivatePostsPanel');
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
