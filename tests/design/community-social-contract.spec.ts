import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const load = (path: string) => readFileSync(path, 'utf8');
const post = load('src/components/communaute/CommunityPostCard.tsx');
const mobile = load('src/components/communaute/MobileCommunityHub.tsx');
const hero = load('src/components/communaute/shell/CommunityHeroCard.tsx');
const header = load('src/components/communaute/MobileCommunityHeader.tsx');
const stories = load('src/components/communaute/CommunityStoriesBar.tsx');
const profile = load('src/components/profile/PublicMobileProfileView.tsx');
const authorPosts = load('src/components/profile/PublicProfilePostsGrid.tsx');
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

  it('shows stories above the category selector and the content grid on mobile', () => {
    // Depuis la v2, les stories sont la rangée « à la une » du héro (44 px),
    // au-dessus de la capsule des six espaces. L'ordre est celui de la page.
    const hero = load('src/components/communaute/shell/CommunityHeroCard.tsx');
    const heroInPage = page.indexOf('<CommunityHeroCard');
    const hubInPage = page.indexOf('<MobileCommunityHub');
    expect(hero).toContain('CommunityStoriesBar');
    expect(hero).toContain('variant="highlights"');
    expect(heroInPage).toBeGreaterThan(-1);
    expect(hubInPage).toBeGreaterThan(heroInPage);

    const tabs = mobile.indexOf('lkdv-social-category-tabs');
    const gridCard = mobile.indexOf('lkdv-community-grid-card');
    expect(tabs).toBeGreaterThan(-1);
    expect(gridCard).toBeGreaterThan(tabs);

    expect(stories).toContain('lkdv-hero-hl');
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

  it('renders actual authored posts from Supabase in the profile, never fake images', () => {
    expect(profile).toContain("tab === 'posts'");
    expect(profile).toContain('PublicProfilePostsGrid profileId={profile.id}');
    expect(authorPosts).toContain(".from('community_posts')");
    expect(authorPosts).toContain(".eq('author_id', profileId)");
    expect(authorPosts).toContain("'/communaute/post/' + post.id");
    expect(authorPosts).toContain("loading=\"lazy\"");
    expect(authorPosts).toContain('isCommunityVideoUrl');
    expect(authorPosts).not.toContain('unsplash.com');
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
