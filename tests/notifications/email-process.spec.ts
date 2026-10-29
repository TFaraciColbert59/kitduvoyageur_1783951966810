import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  createClient: vi.fn(),
  fetch: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/lib/cron/auth', () => ({ isCronAuthorized: mocks.authorized }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn() } }));

describe('notification email dispatch (mocked provider)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('RESEND_API_KEY', 'test-only');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://lkdv.test');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.authorized.mockReturnValue(true);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'provider-id' }) });
    mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'notification_deliveries')
          return {
            update: mocks.update,
            select: () => ({
              eq: () => ({
                or: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: 'delivery',
                        channel: 'email',
                        notifications: {
                          user_id: 'recipient-id',
                          type: 'comment',
                          title: '<img src=x>',
                          message: '<a href="https://evil.test">Fake</a>',
                          link: '/compte?x=1&y=2',
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        if (table === 'notification_preferences')
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
            }),
          };
        if (table === 'user_profiles')
          return {
            select: () => ({
              eq: () => ({ single: async () => ({ data: { email: 'recipient@example.test' } }) }),
            }),
          };
        throw new Error(`Unexpected table ${table}`);
      }),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('uses escaped HTML at provider boundary while retaining the recipient and subject', async () => {
    const { POST } = await import('@/app/api/notifications/process/route');
    const response = await POST(
      new NextRequest('https://lkdv.test/api/notifications/process', { method: 'POST' })
    );
    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    const payload = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(payload.to).toBe('recipient@example.test');
    expect(payload.subject).toBe('<img src=x>');
    expect(payload.html).not.toContain('<img');
    expect(payload.html).toContain('&lt;img src=x&gt;');
    expect(payload.html).toContain('&lt;a href=&quot;https://evil.test&quot;&gt;Fake&lt;/a&gt;');
    expect(payload.html).toContain('href="https://lkdv.test/compte?x=1&amp;y=2"');
    expect(mocks.update).toHaveBeenCalledWith({
      status: 'sent',
      provider_response: { id: 'provider-id' },
    });
  });
  it('does not fetch deliveries or send without cron authorization', async () => {
    mocks.authorized.mockReturnValue(false);
    const { POST } = await import('@/app/api/notifications/process/route');
    expect(
      (
        await POST(
          new NextRequest('https://lkdv.test/api/notifications/process', { method: 'POST' })
        )
      ).status
    ).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
