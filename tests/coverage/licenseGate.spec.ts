import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  checkImportAuthorization,
  checkLicense,
  runImportGate,
} from '../../scripts/coverage/licenseGate';
import type { ImportManifest, LicenseRecord } from '../../scripts/coverage/types';

const FIXTURES = path.join(__dirname, 'fixtures');
const NOW = new Date('2026-09-12T00:00:00.000Z');

function loadLicenses(): LicenseRecord[] {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, 'licenses.json'), 'utf8')) as {
    licenses: LicenseRecord[];
  };
  return raw.licenses;
}

function loadManifest(): ImportManifest {
  return JSON.parse(readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf8')) as ImportManifest;
}

describe('Phase 4 — portail licence (étapes 1-2)', () => {
  it('accepte une autorisation référencée et une licence active redistribuable', () => {
    const result = runImportGate(loadManifest(), loadLicenses(), NOW);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('refuse un téléchargement non autorisé', () => {
    const result = checkImportAuthorization(
      { downloadAuthorized: false, reference: 'x' },
      'https://example.invalid'
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('non autorisé');
  });

  it('refuse une autorisation sans référence humaine', () => {
    const result = checkImportAuthorization(
      { downloadAuthorized: true, reference: '  ' },
      'https://example.invalid'
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('référence');
  });

  it('refuse une source sans URL traçable', () => {
    const result = checkImportAuthorization(
      { downloadAuthorized: true, reference: 'courriel' },
      ''
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('URL source');
  });

  it('refuse une licence non enregistrée', () => {
    const result = checkLicense('INCONNUE', loadLicenses(), NOW);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('introuvable');
  });

  it('refuse une licence révoquée', () => {
    const result = checkLicense('FIXTURE-REVOKED-1.0', loadLicenses(), NOW);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('non active');
  });

  it('refuse une licence expirée', () => {
    const result = checkLicense('FIXTURE-EXPIRED-1.0', loadLicenses(), NOW);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('expirée');
  });

  it('refuse une licence sans redistribution', () => {
    const result = checkLicense('FIXTURE-NOREDIST-1.0', loadLicenses(), NOW);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('redistribution');
  });

  it('refuse une licence sans preuve enregistrée', () => {
    const result = checkLicense('FIXTURE-NO-EVIDENCE-1.0', loadLicenses(), NOW);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('preuve');
  });

  it('avertit quand l’usage commercial n’est pas confirmé', () => {
    const licenses: LicenseRecord[] = [
      {
        code: 'NO-COMMERCIAL',
        name: 'Test',
        status: 'active',
        allowsRedistribution: true,
        allowsCommercialUse: false,
        shareAlike: false,
        evidenceUrl: 'https://example.invalid',
        evidenceNote: null,
        validUntil: null,
      },
    ];
    const result = checkLicense('NO-COMMERCIAL', licenses, NOW);
    expect(result.allowed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
