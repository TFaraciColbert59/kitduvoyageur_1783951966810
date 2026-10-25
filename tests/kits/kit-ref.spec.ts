import { describe, it, expect } from 'vitest';
import { signKitRef, verifyKitRef, KIT_REF_TTL_MS, KIT_REF_COOKIE } from '@/features/kits/kitRef';

const SECRET = 'test-secret-kit-ref-123';

describe('cookie d’attribution signé lkdv_kit_ref (Lot 6.3)', () => {
  it('sign et vérifie un jetons valide', async () => {
    const token = await signKitRef('kit-123', SECRET);
    expect(token).toContain('.');
    expect(token.split('.')[1]).toBeTruthy();
    const payload = await verifyKitRef(token, SECRET);
    expect(payload).toEqual({ kit_id: 'kit-123' });
  });

  it('un jeton signé avec un autre secret est rejeté', async () => {
    const token = await signKitRef('kit-123', SECRET);
    await expect(verifyKitRef(token, 'autre-secret')).resolves.toBeNull();
  });

  it('un jeton altéré (payload modifié) est rejeté', async () => {
    const token = await signKitRef('kit-123', SECRET);
    const [payload, sig] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ kit_id: 'kit-forge' })).toString('base64url')}.${sig}`;
    await expect(verifyKitRef(forged, SECRET)).resolves.toBeNull();
  });

  it('un jeton expiré est ignoré (silencieusement)', async () => {
    const token = await signKitRef('kit-123', SECRET, Date.now() - KIT_REF_TTL_MS - 1000);
    await expect(verifyKitRef(token, SECRET)).resolves.toBeNull();
  });

  it('payload incohérent → null (pas de crash)', async () => {
    await expect(verifyKitRef('not-a-token', SECRET)).resolves.toBeNull();
    await expect(verifyKitRef('e30.abc', SECRET)).resolves.toBeNull();
  });

  it('le nom du cookie est lkdv_kit_ref', () => {
    expect(KIT_REF_COOKIE).toBe('lkdv_kit_ref');
  });
});