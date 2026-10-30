import { afterEach, describe, expect, it, vi } from 'vitest';

const runner = vi.hoisted(() => vi.fn(() => ({ status: 0, error: undefined as Error | undefined })));
vi.mock('node:child_process', () => ({ spawnSync: runner }));

afterEach(() => { vi.unstubAllEnvs(); runner.mockClear(); });

describe('portable release sync entry point', () => {
  it('runs the installed Capacitor CLI with production mode and forwards the platform', async () => {
    vi.stubEnv('NODE_ENV', undefined);
    vi.stubEnv('CAPACITOR_DEV_SERVER', undefined);
    const { syncRelease } = await import('../scripts/mobile/sync-release.mjs');
    expect(syncRelease(['ios'])).toBe(0);
    const [executable, args, options] = runner.mock.calls[0] as unknown as [string, string[], { env: NodeJS.ProcessEnv }];
    expect(executable).toBe(process.execPath);
    expect(args[0]).toMatch(/@capacitor[/\\]cli[/\\]bin[/\\]capacitor$/);
    expect(args.slice(1)).toEqual(['sync', 'ios']);
    expect(options.env.NODE_ENV).toBe('production');
  });

  it('blocks an inherited dev override before running any CLI', async () => {
    vi.stubEnv('NODE_ENV', undefined);
    vi.stubEnv('CAPACITOR_DEV_SERVER', '1');
    const { syncRelease } = await import('../scripts/mobile/sync-release.mjs');
    expect(() => syncRelease()).toThrow('CAPACITOR_DEV_SERVER');
    expect(runner).not.toHaveBeenCalled();
  });
});
