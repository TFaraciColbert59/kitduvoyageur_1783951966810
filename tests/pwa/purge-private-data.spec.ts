import { describe, it, expect, vi } from 'vitest';
import { purgePrivateCaches } from '@/lib/pwa/purgePrivateData';

describe('purgePrivateCaches — purge SW robuste (H-017)', () => {
  it('contrôleur présent : message immédiat', () => {
    const postMessage = vi.fn();
    purgePrivateCaches({ controller: { postMessage } });
    expect(postMessage).toHaveBeenCalledWith({ type: 'LKDV_PURGE_PRIVATE' });
  });

  it('contrôleur absent : attend ready puis poste au worker activé', async () => {
    const postMessage = vi.fn();
    const container = {
      controller: null,
      ready: Promise.resolve({ active: { postMessage } }),
    };
    purgePrivateCaches(container);
    expect(postMessage).not.toHaveBeenCalled();
    await container.ready;
    await Promise.resolve();
    expect(postMessage).toHaveBeenCalledWith({ type: 'LKDV_PURGE_PRIVATE' });
  });

  it('ready rejeté : aucun throw', async () => {
    const container = {
      controller: null,
      ready: Promise.reject(new Error('sw indisponible')),
    };
    expect(() => purgePrivateCaches(container)).not.toThrow();
    await Promise.resolve().catch(() => {});
  });

  it('environnement sans service worker : no-op sans throw', () => {
    expect(() => purgePrivateCaches(null)).not.toThrow();
    expect(() => purgePrivateCaches(undefined)).not.toThrow();
  });
});
