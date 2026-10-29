import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  createClient: vi.fn(),
  remove: vi.fn(),
  deleted: vi.fn(),
  selected: vi.fn(),
}));
vi.mock('@/lib/cron/auth', () => ({ isCronAuthorized: mocks.authorized }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
import { GET } from '@/app/api/cron/purge-stories/route';

const row = {
  id: 'row-id',
  author_id: 'author',
  storage_bucket: 'stories-private',
  storage_path: 'author/upload-id/file.jpg',
};
describe('purge stories route (mocked storage and database)', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
    mocks.authorized.mockReturnValue(true);
    mocks.selected.mockResolvedValue({ data: [row], error: null });
    mocks.deleted.mockResolvedValue({ data: [{ id: row.id }], error: null });
    mocks.remove.mockResolvedValue({ data: [{ name: row.storage_path }], error: null });
    const selectChain = {
      lt: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mocks.selected,
    };
    mocks.createClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => selectChain),
        delete: vi.fn(() => ({ in: vi.fn(() => ({ select: mocks.deleted })) })),
      })),
      storage: { from: vi.fn(() => ({ remove: mocks.remove })) },
    });
  });
  it('purges owned media independently of the story id and reports actual deletions', async () => {
    mocks.deleted.mockResolvedValue({ data: [], error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    const response = await GET(new NextRequest('https://lkdv.test/api/cron/purge-stories'));
    expect(response.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith([row.storage_path]);
    expect(await response.json()).toMatchObject({ purged: 0, objects: 0, skippedMedia: 0 });
  });
  it('skips hostile media while allowing expired poison rows to be removed', async () => {
    mocks.selected.mockResolvedValue({
      data: [{ ...row, storage_path: 'victim/upload/file.jpg' }],
      error: null,
    });
    const response = await GET(new NextRequest('https://lkdv.test/api/cron/purge-stories'));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ purged: 1, objects: 0, skippedMedia: 1 });
  });
  it('preserves rows when storage fails', async () => {
    mocks.remove.mockResolvedValue({ data: null, error: new Error('Storage unavailable') });
    expect((await GET(new NextRequest('https://lkdv.test/api/cron/purge-stories'))).status).toBe(
      500
    );
    expect(mocks.deleted).not.toHaveBeenCalled();
  });
  it('never initializes the privileged client without cron authorization', async () => {
    mocks.authorized.mockReturnValue(false);
    expect((await GET(new NextRequest('https://lkdv.test/api/cron/purge-stories'))).status).toBe(
      401
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
