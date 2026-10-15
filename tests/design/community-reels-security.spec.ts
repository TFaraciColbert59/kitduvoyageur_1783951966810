import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isCommunityVideoUrl, usableCommunityMedia, canShowCommunityReproduction } from '../../src/lib/community/media';

const source = (p: string) => readFileSync(p, 'utf8');
const reels = source('src/app/communaute/reels/page.tsx');
const fork = source('src/app/api/materiel/fork/route.ts');
const sql = source('supabase/migrations/20261014231000_public_shared_kit_items_rls.sql');
const harden = source('supabase/migrations/20261014230000_moderation_trigger_grants_fix.sql');

describe('Community release invariants — media, permissions and responsiveness', () => {
  it('recognizes actual video URLs without treating query parameters as extensions', () => {
    expect(isCommunityVideoUrl('https://cdn.example/trip.mp4?token=abc')).toBe(true);
    expect(isCommunityVideoUrl('/video/Mountains.WEBM')).toBe(true);
    expect(isCommunityVideoUrl('https://cdn.example/photo.jpg?dl=trip.mp4')).toBe(false);
    expect(isCommunityVideoUrl('javascript:alert(1).mp4')).toBe(false);
    expect(isCommunityVideoUrl('//untrusted.example/video.mp4')).toBe(false);
  });

  it('deduplicates the media carousel and caps it to ten items', () => {
    const items = Array.from({ length: 13 }, (_, i) => '/media/' + i + '.jpg');
    const result = usableCommunityMedia([items[0], ...items, null, 'javascript:bad'], items[0]);
    expect(result).toHaveLength(10);
    expect(new Set(result).size).toBe(10);
    expect(result[0]).toBe(items[0]);
  });

  it('offers reproduction only for identifiers and a verified source', () => {
    expect(canShowCommunityReproduction('abffffff-0000-4000-8000-000000000001')).toBe(true);
    expect(canShowCommunityReproduction('a-public-kit-name')).toBe(false);
    expect(canShowCommunityReproduction(null)).toBe(false);
  });

  it('keeps swipe video playback bounded, optimistic and rollback-safe', () => {
    expect(reels).toContain('lkdv-community-reels-track');
    expect(reels).toContain('IntersectionObserver');
    expect(reels).toContain('autoLoadsRef.current >= 2');
    expect(reels).toContain("startAction(key)");
    expect(reels).toContain("finishAction(key)");
    expect(reels).toContain("previous.liked");
    expect(reels).toContain("previous.saved");
    expect(reels).toContain("aria-pressed={reel.liked}");
  });

  it('never attaches the original owner inventory records during public kit import', () => {
    expect(fork).toContain('source.user_id === user.id');
    expect(fork).toContain('product_ownership_id:');
    expect(fork).toContain('.delete().eq(\'id\', newKit.id).eq(\'user_id\', user.id)');
    expect(fork).toContain("if (itemsError) throw itemsError");
    expect(sql).toContain('FOR SELECT TO authenticated');
    expect(sql).toContain('k.is_public IS TRUE');
    expect(sql).toContain('k.user_id = materiel_kit_items.user_id');
    expect(harden).toContain('FROM PUBLIC, anon');
  });
});
