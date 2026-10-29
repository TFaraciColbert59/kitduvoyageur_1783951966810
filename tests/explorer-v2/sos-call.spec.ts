import { describe, expect, it, vi } from 'vitest';
import {
  FALLBACK_EMERGENCY,
  normalizeEmergencyNumber,
  performSosCall,
  planSosCall,
  sosSimulated,
} from '@/features/explorer-v2/activity/sosCall';

/**
 * SOS : la composition du numéro (P7-19 / 04_CARTE §6).
 * Preuve des deux comportements : en production un `tel:` est ouvert, en
 * recette rien n'est composé et l'interface affiche le numéro.
 */

describe('explorer-v2 · appel d’urgence SOS', () => {
  it('normalise les numéros réels', () => {
    expect(normalizeEmergencyNumber('118')).toBe('118');
    expect(normalizeEmergencyNumber('911')).toBe('911');
    expect(normalizeEmergencyNumber('112 (police)')).toBe('112');
    expect(normalizeEmergencyNumber(null)).toBe(FALLBACK_EMERGENCY);
    expect(normalizeEmergencyNumber('')).toBe(FALLBACK_EMERGENCY);
    expect(normalizeEmergencyNumber('?')).toBe(FALLBACK_EMERGENCY);
  });

  it('compose en production', () => {
    const navigate = vi.fn();
    const plan = planSosCall('118', { simulated: false });
    expect(plan).toEqual({ action: 'dial', number: '118' });
    expect(performSosCall(plan, navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('tel:118');
  });

  it('compose le 112 quand le pays n’a pas de donnée', () => {
    const navigate = vi.fn();
    performSosCall(planSosCall(null, { simulated: false }), navigate);
    expect(navigate).toHaveBeenCalledWith('tel:112');
  });

  it('ne compose rien en recette', () => {
    const navigate = vi.fn();
    const plan = planSosCall('118', { simulated: true });
    expect(plan.action).toBe('simulate');
    expect(performSosCall(plan, navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('simule par défaut hors production, compose en production', () => {
    const previous = process.env.NODE_ENV;
    // @ts-expect-error NODE_ENV est en lecture seule dans les types Node
    process.env.NODE_ENV = 'development';
    expect(sosSimulated()).toBe(true);
    // @ts-expect-error idem
    process.env.NODE_ENV = 'production';
    expect(sosSimulated()).toBe(false);
    // @ts-expect-error idem
    process.env.NODE_ENV = previous;
  });

  it('un build de recette (scènes) simule toujours', () => {
    const previousScenes = process.env.NEXT_PUBLIC_EXPLORER_SCENES;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_EXPLORER_SCENES = '1';
    // @ts-expect-error NODE_ENV est en lecture seule dans les types Node
    process.env.NODE_ENV = 'production';
    expect(sosSimulated()).toBe(true);
    process.env.NEXT_PUBLIC_EXPLORER_SCENES = previousScenes ?? '';
    // @ts-expect-error idem
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('le drapeau explicite prime sur NODE_ENV', () => {
    const previous = process.env.NEXT_PUBLIC_EXPLORER_SOS_SIMULATE;
    process.env.NEXT_PUBLIC_EXPLORER_SOS_SIMULATE = '0';
    expect(sosSimulated()).toBe(false);
    process.env.NEXT_PUBLIC_EXPLORER_SOS_SIMULATE = '1';
    expect(sosSimulated()).toBe(true);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_EXPLORER_SOS_SIMULATE;
    else process.env.NEXT_PUBLIC_EXPLORER_SOS_SIMULATE = previous;
  });
});
