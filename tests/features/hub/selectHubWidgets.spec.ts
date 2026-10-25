import { describe, it, expect } from 'vitest';
import { selectHubWidgets } from '@/features/hub/engine/selectHubWidgets';
import type { AdventureProfile } from '@/features/hub/engine/hubProfileEngine';

/**
 * H4.1 — selectHubWidgets (extraction pure de HubSidebarRight),
 * ÉCRIT AVANT L'IMPLÉMENTATION. Ordre priorité + repli 1800.
 */

function profile(nature: AdventureProfile['nature'], widgets: AdventureProfile['widgets']): AdventureProfile {
  return {
    nature,
    scale: null,
    party: 'solo',
    density: 'comfortable',
    sections: [],
    widgets,
    reason: {} as never,
  };
}

describe('H4 — selectHubWidgets : ordre et repli', () => {
  it('SEL-1: possession ordonnée par priorité (alertes > depart > stock > dispo)', () => {
    const { shown, folded } = selectHubWidgets(
      profile('possession', ['stock-apercu', 'dispo-apercu', 'prochain-depart', 'alertes-materiel']),
    );
    expect(shown.map((w) => w.id)).toEqual(['alertes-materiel', 'prochain-depart', 'stock-apercu', 'dispo-apercu']);
    expect(folded).toBe(0);
  });

  it('SEL-2: filtre strict par nature + profil', () => {
    const { shown } = selectHubWidgets(profile('collectif', ['presence-groupe', 'stock-apercu']));
    expect(shown.map((w) => w.id)).toEqual(['presence-groupe']);
  });

  it('SEL-3: sortie = déroulé du jour seul, sans repli (rail sortie réduit)', () => {
    const sortie = profile('sortie', ['steps-timeline']);
    const { shown, folded } = selectHubWidgets(sortie);
    expect(shown).toHaveLength(1);
    expect(folded).toBe(0);
    expect(shown[0].id).toBe('steps-timeline');
  });

  it('SEL-4: vide = rien, jamais de throw', () => {
    expect(selectHubWidgets(profile('possession', []))).toEqual({ shown: [], folded: 0 });
  });
});
