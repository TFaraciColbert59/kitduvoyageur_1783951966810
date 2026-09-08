import { describe, it, expect } from 'vitest';
import { hubBackTransition } from '@/features/hub/hooks/useAndroidHubBackNav';

/**
 * H6.1 — Transition retour Android du hub, ÉCRITE AVANT L'IMPLÉMENTATION.
 * Chaîne : section → aperçu (/hub) → sélecteur (ouvre) → sélecteur (ferme).
 * Ne quitte jamais l'app (miroir Y5.4).
 */

describe('H6 — hubBackTransition : retour matériel', () => {
  it('BACK-1: section → aperçu', () => {
    expect(hubBackTransition('kit', false)).toBe('to-overview');
    expect(hubBackTransition('alertes', true)).toBe('to-overview');
  });

  it('BACK-2: aperçu + sélecteur fermé → ouvre le sélecteur', () => {
    expect(hubBackTransition(null, false)).toBe('open-switcher');
  });

  it('BACK-3: aperçu + sélecteur ouvert → ferme le sélecteur', () => {
    expect(hubBackTransition(null, true)).toBe('close-switcher');
  });

  it('BACK-4: section + sélecteur ouvert → aperçu d’abord (le dialogue se ferme seul)', () => {
    expect(hubBackTransition('inventaire', true)).toBe('to-overview');
  });

  it('BACK-5: déterminisme total', () => {
    expect(hubBackTransition('kit', false)).toBe(hubBackTransition('kit', false));
    expect(hubBackTransition(null, true)).toBe(hubBackTransition(null, true));
  });
});
