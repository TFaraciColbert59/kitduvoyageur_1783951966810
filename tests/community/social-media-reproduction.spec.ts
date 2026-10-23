import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canShowCommunityReproduction, isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';

describe('Community v2: video, gallery and reproduction', () => {
  it('classifies playable video by safe extension', () => {
    expect(isCommunityVideoUrl('https://cdn.example.org/clip.mp4?key=abc')).toBe(true);
    expect(isCommunityVideoUrl('/uploads/clip.MOV')).toBe(true);
    expect(isCommunityVideoUrl('https://cdn.example.org/clip.webm#t=0')).toBe(true);
    expect(isCommunityVideoUrl('https://cdn.example.org/photo.jpg')).toBe(false);
    expect(isCommunityVideoUrl('blob:http://host/hello.mp4')).toBe(false);
    expect(isCommunityVideoUrl('javascript:alert(1).mp4')).toBe(false);
    expect(isCommunityVideoUrl('//unknown.com/video.mp4')).toBe(false);
  });
  it('deduplicates gallery and limits it to 10', () => {
    const ten = Array.from({ length: 13 }, (_, i) => '/media/' + i + '.jpg');
    expect(usableCommunityMedia(ten, null)).toHaveLength(10);
    expect(usableCommunityMedia(['/x.jpg', '/x.jpg', 'blob:http://abc/x.jpg', '/v.mp4'], '/x.jpg'))
      .toEqual(['/x.jpg', '/v.mp4']);
    expect(usableCommunityMedia(null, '/cover.jpg')).toEqual(['/cover.jpg']);
  });
  it('never offers a fake kit link', () => {
    expect(canShowCommunityReproduction(null)).toBe(false);
    expect(canShowCommunityReproduction('comm-1')).toBe(false);
    expect(canShowCommunityReproduction('7b26072b-8f7c-4880-a90d-22fe61bf66c2')).toBe(true);
  });
  it('imports only RLS-visible, public kits via authorized server endpoint', () => {
    const post = readFileSync('src/components/communaute/CommunityPostCard.tsx', 'utf8');
    const fork = readFileSync('src/app/api/materiel/fork/route.ts', 'utf8');
    expect(post).toContain("from('materiel_kits')");
    expect(post).toContain(".eq('is_public', true)");
    expect(post).toContain("fetch('/api/materiel/fork'");
    expect(post).toContain('if (!response.ok)');
    expect(fork).toContain('is_public.eq.true');
    expect(fork).toContain('if (!user)');
    expect(post).toContain('lkdv-social-reproduce');
  });
  it('persists gallery and kit ID via privacy-protected migration', () => {
    const migration = readFileSync('supabase/migrations/20261014221000_community_post_media_and_reproduction.sql', 'utf8');
    expect(migration).toContain('jsonb_array_length(media_urls) <= 10');
    expect(migration).toContain('NEW.author_id AND is_public = true');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.validate_community_post_shared_kit() FROM PUBLIC, anon;');
  });
  it('keeps the feed on RLS, never a service key', () => {
    const feed = readFileSync('src/features/community/feed/useCommunityFeed.ts', 'utf8');
    expect(feed).toContain("from('community_posts')");
    expect(feed).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
