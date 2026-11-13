import { describe, expect, it } from 'vitest';
import { base32Decode, totpCode, totpCodes } from '../../tests/support/totp';

/**
 * Ces tests verrouillent l'outillage de test lui-même : si le générateur TOTP est faux,
 * tous les scénarios de connexion échoueraient pour une mauvaise raison. Vecteurs
 * officiels RFC 6238, annexe B (HMAC-SHA1, secret ASCII « 12345678901234567890 »),
 * tronqués à 6 chiffres.
 */

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP des tests (RFC 6238)', () => {
  it('retrouve les vecteurs officiels à 6 chiffres', () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe('287082');
    expect(totpCode(RFC_SECRET, 1_111_111_109_000)).toBe('081804');
    expect(totpCode(RFC_SECRET, 1_111_111_111_000)).toBe('050471');
    expect(totpCode(RFC_SECRET, 1_234_567_890_000)).toBe('005924');
    expect(totpCode(RFC_SECRET, 2_000_000_000_000)).toBe('279037');
  });

  it('décode le base32 sans padding, casse et espaces tolérés', () => {
    expect(base32Decode('gezd gnbv gy3t qojq gezd gnbv gy3t qojq').toString('ascii')).toBe('12345678901234567890');
    expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ=').toString('ascii')).toBe('12345678901234567890');
  });

  it('refuse un secret qui n’est pas en base32', () => {
    expect(() => base32Decode('!!!')).toThrow(/base32/i);
  });

  it('change de code à chaque pas de 30 secondes et garde 6 chiffres', () => {
    const at = 1_700_000_000_000;
    const current = totpCode('JBSWY3DPEHPK3PXP', at);
    expect(current).toMatch(/^\d{6}$/);
    expect(totpCode('JBSWY3DPEHPK3PXP', at + 30_000)).not.toBe(current);
    expect(totpCodes('JBSWY3DPEHPK3PXP', at)).toEqual([current, totpCode('JBSWY3DPEHPK3PXP', at - 30_000)]);
  });
});
