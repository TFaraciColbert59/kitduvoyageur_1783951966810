import { expect, type Page } from '@playwright/test';

const AUTHOR_ID = '00000000-0000-4000-8000-000000000101';
const profile = {
  id: AUTHOR_ID,
  full_name: 'Camille Martin',
  handle: 'camille',
  avatar_url: '/assets/images/portrait-3.jpg',
  location: 'Chamonix, France',
  trust_score: 80,
  loyalty_level: 'explorateur',
};

/** Replay the browser's real PostgREST boundary, without a seeded/live database. */
export async function installCommunityFeedFixture(page: Page) {
  let resolveOrigin!: (origin: string) => void;
  const supabaseOrigin = new Promise<string>((resolve) => { resolveOrigin = resolve; });
  await page.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
      necessary: true, analytics: false, marketing: false, version: '1',
    }));
  });
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    let data: unknown = [];
    if (table === 'community_posts') {
      resolveOrigin(url.origin);
      data = [{
        id: '00000000-0000-4000-8000-000000000201',
        author_id: AUTHOR_ID,
        content: 'Une matinée sur les sentiers du Mont-Blanc.',
        image_url: '/assets/images/community-morning.jpg',
        image_alt: 'Paysage de montagne au petit matin',
        created_at: '2026-06-01T08:00:00Z',
        likes_count: 12,
        comments_count: 0,
        shares_count: 2,
        audience: 'public',
      }];
    } else if (table === 'public_profiles') {
      data = [profile];
    } else if (table === 'user_profiles') {
      // AuthProvider uses maybeSingle(), which requests an object response.
      data = { ...profile, email: 'camille@example.invalid' };
    }
    await route.fulfill({ json: data });
  });
  // Authentication is opt-in below. A guest has no session or auth request.
  await page.route('**/auth/v1/**', (route) => route.fulfill({ json: { ...profile, aud: 'authenticated', role: 'authenticated', is_anonymous: false } }));
  await page.route('**/api/compte/compte/notifications', (route) =>
    route.fulfill({ json: { notifications: [], unread: 0 } }));

  return {
    async signIn() {
      // Discover the project from an intercepted request: builds may use either
      // a placeholder or a configured URL, neither may be contacted by this spec.
      const origin = await supabaseOrigin;
      const now = Math.floor(Date.now() / 1000);
      const user = {
        id: AUTHOR_ID, email: 'camille@example.invalid', aud: 'authenticated',
        role: 'authenticated', is_anonymous: false,
        app_metadata: {}, user_metadata: { full_name: profile.full_name },
      };
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
        sub: AUTHOR_ID, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600,
      })}.visual-fixture`;
      await page.context().addCookies([{
        name: `sb-${new URL(origin).hostname.split('.')[0]}-auth-token`,
        value: `base64-${encode({
          access_token: token, refresh_token: 'visual-fixture', token_type: 'bearer',
          expires_in: 3600, expires_at: now + 3600, user,
        })}`,
        url: new URL(page.url()).origin,
      }]);
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === '/rest/v1/user_profiles'),
        page.reload({ waitUntil: 'domcontentloaded' }),
      ]);
      await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
    },
  };
}
