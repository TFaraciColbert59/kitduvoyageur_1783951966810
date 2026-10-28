import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const paths = [
  'src/lib/storage/cacheDB.ts',
  'src/lib/routeCacheSignature.ts',
  'src/features/compas/server/sharedCache.ts',
  'src/features/materiel/hooks/useDepartOfflineCache.ts',
  'supabase/migrations/20261005182145_geo_cache.sql',
];

describe('cache source delivery', () => {
  it('keeps cache modules and migrations out of generated-file ignore rules', () => {
    for (const path of paths) {
      // --no-index also inspects tracked files, guarding future clean clones.
      let ignored = false;
      try {
        execFileSync('git', ['check-ignore', '--no-index', '-q', path]);
        ignored = true;
      } catch (error) {
        if ((error as { status?: number }).status !== 1) throw error;
      }
      expect(ignored, path).toBe(false);
    }
  });
});
