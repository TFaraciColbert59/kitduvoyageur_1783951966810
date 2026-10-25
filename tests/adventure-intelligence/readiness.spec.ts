import { describe, it, expect } from 'vitest';
import { NoopReadinessProvider } from '@/features/adventure-intelligence/providers/noopReadinessProvider';
import type {
  ExternalReadinessProvider,
  ReadinessDataCategory,
} from '@/features/adventure-intelligence/domain/health';
import * as adventureIntelligence from '@/features/adventure-intelligence';

describe('Contrat santé futur — ExternalReadinessProvider (TEST-A1-HEALTH)', () => {
  it('TEST-A1-HEALTH-01: le NoopReadinessProvider n’est jamais disponible', async () => {
    const provider: ExternalReadinessProvider = new NoopReadinessProvider();

    expect(provider.providerId).toBe('noop');
    await expect(provider.isAvailable()).resolves.toBe(false);

    expect(adventureIntelligence.PROVENANCE_SOURCES).toContain('measured');
    expect('listConsents' in adventureIntelligence).toBe(false);
    expect('setConsent' in adventureIntelligence).toBe(false);
  });

  it('TEST-A1-HEALTH-02: requestAuthorization ne donne accès à aucune catégorie', async () => {
    const provider = new NoopReadinessProvider();
    const categories: ReadinessDataCategory[] = ['sleep', 'hrv', 'resting_heart_rate'];
    const result = await provider.requestAuthorization(categories);

    expect(result.granted).toBe(false);
    expect(result.categories).toEqual([]);
    expect(result.reason).toBe('not_implemented_phase1');
  });

  it('TEST-A1-HEALTH-03: getDailyReadiness ne renvoie aucun snapshot de santé', async () => {
    const provider = new NoopReadinessProvider();

    await expect(provider.getDailyReadiness('2026-09-11')).resolves.toBeNull();

    const fromBarrel: ExternalReadinessProvider = new adventureIntelligence.NoopReadinessProvider();
    expect(fromBarrel.providerId).toBe('noop');
    expect(adventureIntelligence.ADVENTURE_DOMAIN_EVENT_TYPES.length).toBeGreaterThan(0);
  });
});
