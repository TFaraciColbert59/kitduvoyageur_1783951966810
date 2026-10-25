import { describe, it, expect } from 'vitest';
import { normalizeGtin } from '@/features/materiel/domain/gtin';
describe('GTIN checksum boundary', () => {
  it.each(['96385074', '036000291452', '4006381333931', '10012345000017'])(
    'accepts valid GS1 length and check digit: %s',
    (code) => expect(normalizeGtin(code)).toBe(code)
  );
  it.each(['SER-42', '4006381333932', '123', '123456789012345', '4006381333931;drop', '١٢٣٤٥٦٧٨'])(
    'rejects invalid syntax/checksum: %s',
    (code) => expect(normalizeGtin(code)).toBeNull()
  );
  it('normalizes scanner whitespace only', () =>
    expect(normalizeGtin('400 6381333931\n')).toBe('4006381333931'));
});
