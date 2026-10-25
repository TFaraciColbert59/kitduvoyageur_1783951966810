import { describe, it, expect } from 'vitest';
import {
  isValidAffiliateTargetUrl,
  buildAffiliateUrl,
  hashSessionForRgpd,
  verifyAffiliatePostbackSignature,
} from '@/features/affiliation/engine/affiliateEngine';
import { createAffiliateLinkSchema } from '@/features/affiliation/schemas/affiliate.schema';
import crypto from 'crypto';

describe('Affiliate Engine (Security, RGPD & Deeplinks)', () => {
  describe('isValidAffiliateTargetUrl', () => {
    it('accepts secure HTTPS URLs', () => {
      expect(isValidAffiliateTargetUrl('https://www.booking.com/hotel/fr/chamonix.html')).toBe(true);
      expect(isValidAffiliateTargetUrl('https://tp.media/r?marker=12345')).toBe(true);
    });

    it('rejects HTTP and dangerous protocols (Open Redirect Protection)', () => {
      expect(isValidAffiliateTargetUrl('http://insecure.com')).toBe(false);
      expect(isValidAffiliateTargetUrl('javascript:alert(1)')).toBe(false);
      expect(isValidAffiliateTargetUrl('data:text/html,<html>')).toBe(false);
      expect(isValidAffiliateTargetUrl('not-a-url')).toBe(false);
    });
  });

  describe('buildAffiliateUrl', () => {
    it('merges tracking parameters without duplicating query string', () => {
      const base = 'https://www.booking.com/searchresults.html?city=-1418388';
      const result = buildAffiliateUrl(
        base,
        { checkin: '2026-08-01', checkout: '2026-08-05' },
        { marker: '584920', subId: 'trip-123' }
      );

      const parsed = new URL(result);
      expect(parsed.origin).toBe('https://www.booking.com');
      expect(parsed.searchParams.get('city')).toBe('-1418388');
      expect(parsed.searchParams.get('checkin')).toBe('2026-08-01');
      expect(parsed.searchParams.get('marker')).toBe('584920');
      expect(parsed.searchParams.get('sub_id')).toBe('trip-123');
    });

    it('throws when base URL is not HTTPS', () => {
      expect(() => buildAffiliateUrl('http://bad.com')).toThrow();
    });
  });

  describe('hashSessionForRgpd (Minimisation RGPD §5.3)', () => {
    it('returns a salted SHA-256 hash and never reveals the raw IP', () => {
      const rawIp = '192.168.1.42';
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
      const hash = hashSessionForRgpd(rawIp, ua, 'salt_test_123');

      expect(hash).toHaveLength(64);
      expect(hash).not.toContain(rawIp);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      // Deterministic
      expect(hashSessionForRgpd(rawIp, ua, 'salt_test_123')).toBe(hash);

      // Distinct for another IP
      const anotherHash = hashSessionForRgpd('10.0.0.1', ua, 'salt_test_123');
      expect(anotherHash).not.toBe(hash);
    });
  });

  describe('verifyAffiliatePostbackSignature (HMAC-SHA256)', () => {
    const secret = 'super_secret_travelpayouts_key_2026';
    const payload = JSON.stringify({ sub_id: 'click-99', amount_cents: 1450 });

    it('validates a correct HMAC signature', () => {
      const validSig = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(verifyAffiliatePostbackSignature(payload, validSig, secret)).toBe(true);
    });

    it('rejects tampered signatures or altered payloads', () => {
      const validSig = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(verifyAffiliatePostbackSignature('tampered payload', validSig, secret)).toBe(false);
      expect(verifyAffiliatePostbackSignature(payload, 'bad_signature', secret)).toBe(false);
      expect(verifyAffiliatePostbackSignature(payload, validSig, 'wrong_secret')).toBe(false);
    });
  });

  describe('Affiliation Zod Schemas', () => {
    it('validates a correct affiliate link payload', () => {
      const valid = createAffiliateLinkSchema.safeParse({
        slug: 'booking-chamonix-hotel',
        partner_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        category: 'hotel',
        country_code: 'FR',
        title: 'Hôtels & Lodges à Chamonix-Mont-Blanc',
        target_url: 'https://www.booking.com/city/fr/chamonix.html',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects non-https URLs in link schema', () => {
      const invalid = createAffiliateLinkSchema.safeParse({
        slug: 'bad-link',
        partner_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        category: 'hotel',
        title: 'Bad Link',
        target_url: 'http://insecure-hotel.com',
      });
      expect(invalid.success).toBe(false);
    });
  });
});
