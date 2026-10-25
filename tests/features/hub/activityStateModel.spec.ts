import { describe, expect, it } from 'vitest';
import {
  deriveActivityState,
  type ActivityStateInput,
} from '../../../src/features/hub/components/mobile/activityStateModel';

const readyInput: ActivityStateInput = {
  phase: 'prepare',
  daysUntil: 3,
  checklist: { done: 4, total: 4 },
  equipment: { ready: 9, total: 9 },
  safety: { pending: 0 },
  documents: { expired: 0, expiring: 1 },
  route: {
    ready: true,
    href: '/randonnee-active?routeId=route-demo',
    name: 'Boucle du Test',
    reason: null,
  },
  nextAction: {
    kind: 'navigation',
    href: '/randonnee-active?routeId=route-demo',
    title: 'Démarrer la randonnée',
    description: 'Parcours vérifié',
  },
  hrefs: {
    route: '/hub/itinerary',
    checklist: '/hub/checklist',
    equipment: '/hub/kit-voyage',
    safety: '/hub/safety',
    documents: '/hub/docs',
    live: '/hub?phase=live',
    journal: '/hub/journal',
  },
};

describe('ActivityState — centre de décision du tiroir État', () => {
  it('autorise un lancement en avance quand tous les contrôles bloquants sont validés', () => {
    const state = deriveActivityState(readyInput);

    expect(state.ready).toBe(true);
    expect(state.blockerCount).toBe(0);
    expect(state.cta).toEqual({
      kind: 'launch',
      label: 'Démarrer en avance',
      href: '/randonnee-active?routeId=route-demo',
    });
    expect(state.validatedChecks).toBe(4);
    expect(state.totalChecks).toBe(5);
  });

  it('bloque le lancement et renvoie vers le premier contrôle réellement incomplet', () => {
    const state = deriveActivityState({
      ...readyInput,
      daysUntil: 1,
      checklist: { done: 2, total: 4 },
    });

    expect(state.ready).toBe(false);
    expect(state.blockerCount).toBe(1);
    expect(state.cta).toEqual({
      kind: 'prepare',
      label: 'Finaliser la préparation',
      href: '/hub/checklist',
    });
  });

  it('ne propose jamais un lancement secondaire tant que la preparation est bloquee', () => {
    const state = deriveActivityState({
      ...readyInput,
      daysUntil: 1,
      checklist: { done: 2, total: 4 },
    });

    expect(state.nextAction).toBeNull();
  });

  it('conserve une action de preparation non liee au lancement', () => {
    const state = deriveActivityState({
      ...readyInput,
      daysUntil: 1,
      checklist: { done: 2, total: 4 },
      nextAction: {
        kind: 'safety',
        href: '/hub/safety',
        title: 'Confirmer le point de controle',
        description: 'Prevu avant le depart.',
      },
    });

    expect(state.nextAction).toMatchObject({
      kind: 'safety',
      href: '/hub/safety',
    });
  });

  it('refuse un départ sans parcours GPS vérifié et expose la raison réelle', () => {
    const state = deriveActivityState({
      ...readyInput,
      daysUntil: 0,
      route: {
        ready: false,
        href: '/preparer-randonnee',
        name: null,
        reason: 'Le parcours lié n’a pas de tracé GPS vérifié.',
      },
    });

    expect(state.ready).toBe(false);
    expect(state.cta.kind).toBe('prepare');
    expect(state.checks.find((check) => check.id === 'route')).toMatchObject({
      status: 'blocked',
      value: 'Le parcours lié n’a pas de tracé GPS vérifié.',
    });
  });

  it('passe en ouverture du cockpit quand l’activité est déjà en cours', () => {
    const state = deriveActivityState({ ...readyInput, phase: 'live', daysUntil: 0 });

    expect(state.cta).toEqual({
      kind: 'continue',
      label: 'Ouvrir le cockpit',
      href: '/hub?phase=live',
    });
  });

  it('traite un document expiré comme un blocage et une expiration proche comme une vigilance', () => {
    const expired = deriveActivityState({
      ...readyInput,
      documents: { expired: 1, expiring: 0 },
    });
    const warning = deriveActivityState({
      ...readyInput,
      documents: { expired: 0, expiring: 1 },
    });

    expect(expired.ready).toBe(false);
    expect(expired.checks.find((check) => check.id === 'documents')?.status).toBe('blocked');
    expect(warning.ready).toBe(true);
    expect(warning.checks.find((check) => check.id === 'documents')?.status).toBe('attention');
  });
});
