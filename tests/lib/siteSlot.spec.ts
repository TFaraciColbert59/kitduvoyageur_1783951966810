import { describe, expect, it, vi } from 'vitest';
import { siteSlot } from '@/lib/siteSlot';

describe('créneau du site auprès d’un service public (plan 1.3)', () => {
  it('libre : passe tout de suite', async () => {
    const sleep = vi.fn(async () => {});
    await expect(siteSlot('photon', 3, { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }), sleep })).resolves.toBe(true);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('seconde pleine : attend la suivante, au plus quatre fois', async () => {
    let n = 0;
    const sleep = vi.fn(async () => {});
    const consume = async () => ({ allowed: ++n >= 3, retryAfterSeconds: 1 });
    await expect(siteSlot('photon', 3, { consume, sleep })).resolves.toBe(true);
    expect(sleep).toHaveBeenCalledTimes(2);

    const toujoursPlein = async () => ({ allowed: false, retryAfterSeconds: 1 });
    sleep.mockClear();
    await expect(siteSlot('photon', 3, { consume: toujoursPlein, sleep })).resolves.toBe(false);
    expect(sleep).toHaveBeenCalledTimes(4);
  });
});
