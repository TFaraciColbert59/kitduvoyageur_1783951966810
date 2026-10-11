/**
 * T07 — route worker des intentions : secret obligatoire, GET=POST, résumé réel.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/features/progression/server/intentConsumer', () => ({
  consumeProgressionAwardIntents: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { consumeProgressionAwardIntents } from '@/features/progression/server/intentConsumer';
import { GET, POST } from '@/app/api/cron/progression-awards/route';

const mockedConsume = vi.mocked(consumeProgressionAwardIntents);
const ORIGINAL_ENV = { ...process.env };

function makeRequest(method: string, secret?: string) {
  return new NextRequest('http://localhost/api/cron/progression-awards', {
    method,
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe('cron progression-awards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('refuse un secret absent ou incorrect sans consommer', async () => {
    expect((await POST(makeRequest('POST'))).status).toBe(401);
    expect((await GET(makeRequest('GET', 'mauvais'))).status).toBe(401);
    expect(mockedConsume).not.toHaveBeenCalled();
  });

  it('POST nominal : lot borné et résumé renvoyé', async () => {
    mockedConsume.mockResolvedValue({ claimed: 2, processed: 1, refused: 0, failed: 1 });
    const response = await POST(makeRequest('POST', 'test-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 2, processed: 1, refused: 0, failed: 1 });
    expect(mockedConsume).toHaveBeenCalledWith({ limit: 50 });
  });

  it('GET : même contrôle, même lot', async () => {
    mockedConsume.mockResolvedValue({ claimed: 0, processed: 0, refused: 0, failed: 0 });
    const response = await GET(makeRequest('GET', 'test-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 0, processed: 0, refused: 0, failed: 0 });
  });
});
