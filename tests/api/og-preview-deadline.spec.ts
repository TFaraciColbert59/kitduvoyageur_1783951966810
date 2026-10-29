import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), limit: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.limit }));
import { POST } from '@/app/api/og-preview/route';

const request = () =>
  new NextRequest('http://localhost/api/og-preview', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://example.com' }),
  });
const never = () => new Promise<never>(() => {});

describe('OG preview end-to-end deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34' }]);
    mocks.limit.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('expires while DNS is hanging without starting fetch', async () => {
    mocks.lookup.mockImplementation(never);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = POST(request());
    await vi.advanceTimersByTimeAsync(3000);
    expect((await result).status).toBe(540);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('expires after headers when body read and cancellation both hang', async () => {
    const cancel = vi.fn(never);
    const body = new ReadableStream<Uint8Array>({ pull: never, cancel });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }))
    );
    const result = POST(request());
    await vi.advanceTimersByTimeAsync(3000);
    expect((await result).status).toBe(540);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('shares the deadline across redirects and cancels every redirect body', async () => {
    const cancels = [vi.fn(), vi.fn()];
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            const index = calls++;
            setTimeout(
              () =>
                resolve(
                  new Response(new ReadableStream({ cancel: cancels[index] }), {
                    status: 302,
                    headers: { location: '/next' },
                  })
                ),
              2000
            );
          })
      )
    );
    const result = POST(request());
    await vi.advanceTimersByTimeAsync(3000);
    expect((await result).status).toBe(540);
    expect(cancels[0]).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cancels[1]).toHaveBeenCalledOnce();
  });

  it('does not renew the deadline for trickled body chunks', async () => {
    let cancelled = false;
    const cancel = vi.fn(() => {
      cancelled = true;
    });
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            if (!cancelled) c.enqueue(new TextEncoder().encode(' '));
            resolve();
          }, 1000)
        );
      },
      cancel,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }))
    );
    const result = POST(request());
    await vi.advanceTimersByTimeAsync(3000);
    expect((await result).status).toBe(540);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('truncates an oversized chunk at exactly 100 KiB and cancels it', async () => {
    const cancel = vi.fn();
    const prefix = '<title>Inside budget</title>';
    const bytes = new TextEncoder().encode(
      prefix + ' '.repeat(102400 - prefix.length) + '<meta property="og:image" content="outside">'
    );
    const body = new ReadableStream({
      start(c) {
        c.enqueue(bytes);
      },
      cancel,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }))
    );
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ title: 'Inside budget', image: null });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels rejected content types', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new ReadableStream({ cancel }), {
          headers: { 'content-type': 'image/png' },
        })
      )
    );
    expect((await POST(request())).status).toBe(400);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
