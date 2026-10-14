import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const load = (path: string) => readFileSync(path, 'utf8');
const post = load('src/components/communaute/CommunityPostCard.tsx');
const mobile = load('src/components/communaute/MobileCommunityHub.tsx');
const header = load('src/components/communaute/MobileCommunityHeader.tsx');
const stories = load('src/components/communaute/CommunityStoriesBar.tsx');
const profile = load('src/components/profile/PublicMobileProfileView.tsx');
const css = load('src/styles/community-social.css');
const page = load('src/app/communaute/page.tsx');

describe('Community Social-First — design contract without missing features', () => {
  it('keeps media, actions, caption and comments in correct order', () => {
    const card = post.slice(post.indexOf('lkdv-social-post relative'));
    const media = card.indexOf('lkdv-social-post-media');
    const actions = card.indexOf('lkdv-social-post-actions');
    const caption = card.indexOf('lkdv-social-post-caption');
    const comments = card.indexOf('Full Feature Threaded Comments Drawer');

    expect([media, actions, caption, comments].every((i) => i >= 0)).toBe(true);
    expect(media).toBeLessThan(actions);
    expect(actions).toBeLessThan(caption);
    expect(caption).toBeLessThan(comments);
  });

  it('preserves LKDV post actions and structured carnet snapshots', () => {
    for (const invariant of [
      'handleLike', 'handleToggleComments', 'handleShare',
      'handleToggleSave', 'handleReport', 'handleHidePost',
      'handleReplyTo', 'handleSaveEditComment', 'handleDeleteComment',
      'post.snapshot_payload', 'linked_carnet_id?:',
      '{...doubleTap}', '{...longPress}',
    ]) {
      expect(post, invariant).toContain(invariant);
    }
  });

  it('shows stories before category selectors and feed on mobile', () => {
    const shelf = mobile.indexOf('lkdv-social-story-shelf');
    const tabs = mobile.indexOf('lkdv-social-category-tabs');
    const stream = mobile.indexOf('lkdv-social-mobile-stream');
    expect(shelf).toBeGreaterThan(-1);
    expect(shelf).toBeLessThan(tabs);
    expect(tabs).toBeLessThan(stream);
    expect(stories).toContain('lkdv-social-stories-rail');
    expect(stories).toContain('StoriesViewer');
    expect(stories).toContain('StoriesArchiveSheet');
  });

  it('exposes real creation and messaging destinations', () => {
    for (const route of [
      '/communaute/publier', '/carnets/nouveau', '/messagerie',
    ]) expect(header).toContain(route);
    expect(header).toContain('aria-expanded={createOpen}');
    expect(header).toContain('onSearchClick || openSearch');
  });

  it('uses vertical profile tiles and scoped social CSS', () => {
    expect(profile).toContain('lkdv-social-profile-tile aspect-[3/4]');
    expect(profile).toContain('onReport');
    expect(page).toContain('lkdv-community-experience');
    expect(css).toContain('.lkdv-community-experience');
    expect(css).toContain('.lkdv-social-profile-screen');
    expect(css).not.toMatch(/^\s*(?:body|html)\s*\{/m);
  });
});
