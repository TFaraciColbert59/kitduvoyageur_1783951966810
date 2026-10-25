import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyGeodataError,
  fetchAllCountrySlugs,
  fetchCountryByIso,
  fetchCountries,
  isBuildPhase,
} from '@/lib/geodata';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('A/Étape 0 — robustesse geodata (build vs runtime)', () => {
  it('TEST-GEO-01: build sans configuration ⇒ produit vide, silencieux, jamais une erreur', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    expect(isBuildPhase()).toBe(true);
    await expect(fetchCountries()).resolves.toEqual([]);
    await expect(fetchAllCountrySlugs()).resolves.toEqual([]);
    await expect(fetchCountryByIso('fr')).resolves.toBeNull();
  });

  it('TEST-GEO-02: runtime sans configuration ⇒ erreur explicite (aucun succès silencieux)', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    expect(isBuildPhase()).toBe(false);
    await expect(fetchCountries()).rejects.toThrow(/Configuration Supabase manquante/);
  });

  it('TEST-GEO-03: classification — contrat/dataset ⇒ observable, transitoire ⇒ fallback', () => {
    expect(classifyGeodataError({ code: 'PGRST205', message: 'table not found' })).toBe('contract');
    expect(classifyGeodataError({ code: '42501', message: 'permission denied' })).toBe('contract');
    expect(classifyGeodataError({ message: 'TypeError: fetch failed' })).toBe('transient');
    expect(classifyGeodataError({ code: 'PGRST301', message: 'JWT expired' })).toBe('transient');
    expect(classifyGeodataError(null)).toBe('transient');
  });
});
