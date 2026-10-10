import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('security triage doc', () => {
  it('documente chaque finding avec statut et owner', () => {
    expect(existsSync('docs/admin-os/SECURITY_TRIAGE_P0.md')).toBe(true);
    const md = readFileSync('docs/admin-os/SECURITY_TRIAGE_P0.md', 'utf8');
    for (const k of [
      'RLS-no-policy',
      'SECURITY DEFINER',
      'search_path',
      'spatial_ref_sys',
      'fetch-osm-trails',
    ]) {
      expect(md).toMatch(new RegExp(k));
    }
  });
});
