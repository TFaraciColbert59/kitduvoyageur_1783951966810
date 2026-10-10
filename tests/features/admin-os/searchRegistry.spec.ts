import { describe, expect, it } from 'vitest';

import { SEARCHABLE_ENTITIES, maskEmail } from '@/features/admin-os/search/registry';

describe('entity search registry', () => {
  it('chaque entité déclare permission + route + flag PII', () => {
    for (const [k, e] of Object.entries(SEARCHABLE_ENTITIES)) {
      expect(e.domain).toBe(k);
      expect(e.requiredPermission).toMatch(/^[a-z_.]+\.[a-z_.]+$/);
      expect(e.adminRoute('x')).toContain('/admin/');
    }
  });

  it('masque les emails par défaut', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
    expect(maskEmail('pas-un-email')).toBe('***');
  });
});
