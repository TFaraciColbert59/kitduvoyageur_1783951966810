import { describe, it, expect } from 'vitest';
import {
  isValidAffiliateTargetUrl,
  buildAffiliateUrl,
  hashSessionForRgpd,
  verifyAffiliatePostbackSignature,
  maskSensitiveIdentityNumber,
  generateSignedDocumentUrl,
  verifySignedDocumentUrl,
} from '@/features/affiliation/engine/affiliateEngine';

describe('Phase 9.1 & 9.2 — Monétisation Éthique & Conformité Loi Influence 2023', () => {
  it('TEST-P9-01: isValidAffiliateTargetUrl bloque les attaques Open Redirect et schémas non sécurisés', () => {
    expect(isValidAffiliateTargetUrl('https://partner.booking.com/hotel/123')).toBe(true);
    expect(isValidAffiliateTargetUrl('http://insecure.com')).toBe(false); // Pas de HTTP
    expect(isValidAffiliateTargetUrl('javascript:alert(1)')).toBe(false);
    expect(isValidAffiliateTargetUrl('//malicious.com')).toBe(false);
    expect(isValidAffiliateTargetUrl('data:text/html,...')).toBe(false);
  });

  it('TEST-P9-02: hashSessionForRgpd hache de manière irréversible IP et UserAgent (Minimisation RGPD)', () => {
    const ip = '192.168.1.50';
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
    const hash1 = hashSessionForRgpd(ip, ua);
    const hash2 = hashSessionForRgpd(ip, ua);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toContain(ip);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('TEST-P9-03: verifyAffiliatePostbackSignature valide les signatures webhook Travelpayouts en temps constant', () => {
    const payload = JSON.stringify({ conversion_id: 'conv-123', amount: 45.5 });
    const secret = 'super-secret-key-2026';

    const crypto = require('crypto');
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(verifyAffiliatePostbackSignature(payload, validSignature, secret)).toBe(true);
    expect(verifyAffiliatePostbackSignature(payload, 'tampered_signature', secret)).toBe(false);
    expect(verifyAffiliatePostbackSignature(payload, '', secret)).toBe(false);
  });
});

describe('Phase 9.3 — Sécurité des Documents d’Identité & URLs Signées', () => {
  it('TEST-P9-04: maskSensitiveIdentityNumber masque les numéros sensibles (passeport, CNI) pour les logs et UI', () => {
    expect(maskSensitiveIdentityNumber('21AA12345')).toBe('•••••2345');
    expect(maskSensitiveIdentityNumber('123456789012')).toBe('••••••••9012');
    expect(maskSensitiveIdentityNumber('123')).toBe('•••');
    expect(maskSensitiveIdentityNumber('')).toBe('');
  });

  it('TEST-P9-05: generateSignedDocumentUrl crée une URL signée HMAC avec expiration paramétrée', () => {
    const secret = 'doc-secret-2026';
    const filePath = 'passports/user-123/passport.pdf';
    const signed = generateSignedDocumentUrl(filePath, 900, secret); // 15 min

    expect(decodeURIComponent(signed)).toContain(filePath);
    expect(signed).toContain('expires=');
    expect(signed).toContain('sig=');
  });

  it('TEST-P9-06: verifySignedDocumentUrl valide une URL active et rejette une URL expirée ou altérée', () => {
    const secret = 'doc-secret-2026';
    const filePath = 'visas/nepal-visa.pdf';

    // URL valide 10 secondes
    const validUrl = generateSignedDocumentUrl(filePath, 10, secret);
    const verification = verifySignedDocumentUrl(validUrl, secret);
    expect(verification.isValid).toBe(true);
    expect(verification.filePath).toBe(filePath);

    // URL expirée (-10 secondes)
    const expiredUrl = generateSignedDocumentUrl(filePath, -10, secret);
    const expiredVerification = verifySignedDocumentUrl(expiredUrl, secret);
    expect(expiredVerification.isValid).toBe(false);
    expect(expiredVerification.error).toBe('EXPIRED');

    // URL altérée
    const tamperedUrl = validUrl.replace('nepal-visa.pdf', 'hacked-file.pdf');
    const tamperedVerification = verifySignedDocumentUrl(tamperedUrl, secret);
    expect(tamperedVerification.isValid).toBe(false);
    expect(tamperedVerification.error).toBe('INVALID_SIGNATURE');
  });
});
