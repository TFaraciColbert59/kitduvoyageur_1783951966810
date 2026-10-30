import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfig(nodeEnv?: string, devServer?: string, url = 'https://mobile.example') {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.stubEnv('CAPACITOR_DEV_SERVER', devServer);
  vi.stubEnv('CAPACITOR_SERVER_URL', url);
  return (await import('../capacitor.config')).default;
}

afterEach(() => vi.unstubAllEnvs());

describe('Capacitor release defaults (OPS-RELEASE-02)', () => {
  it.each([undefined, 'production', 'development', 'test'])('disables insecure flags with NODE_ENV=%s unless dev is explicit', async (mode) => {
    const config = await loadConfig(mode);
    expect(config.server?.cleartext).toBe(false);
    expect(config.android?.allowMixedContent).toBe(false);
    expect(config.android?.webContentsDebuggingEnabled).toBe(false);
  });

  it.each([undefined, 'production'])('rejects HTTP in release mode %s', async (mode) => {
    await expect(loadConfig(mode, undefined, 'http://localhost:4000')).rejects.toThrow('HTTPS');
  });

  it('requires an explicit development opt-in to allow local HTTP and debugging', async () => {
    const config = await loadConfig('development', '1', 'http://localhost:4000');
    expect(config.server?.cleartext).toBe(true);
    expect(config.android?.allowMixedContent).toBe(true);
    expect(config.android?.webContentsDebuggingEnabled).toBe(true);
  });

  it('rejects the development override in production', async () => {
    await expect(loadConfig('production', '1')).rejects.toThrow('CAPACITOR_DEV_SERVER');
  });
});
