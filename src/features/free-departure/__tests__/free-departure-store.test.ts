/**
 * Le store porte les invariants NON NEGOCIABLES du mode libre. Ils ne sont pas
 * dans l'ecran : ils sont dans les actions, et un ecran ne peut pas les
 * rattraper apres coup.
 *
 * Le fichier est donc teste comme un contrat de comportement, pas comme une
 * couverture de lignes.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  FREE_DEPARTURE_VERSION,
  migrateToV2,
  useFreeDepartureStore,
  type FreeDepartureActions,
  type FreeDepartureState,
} from '../store/useFreeDepartureStore';
import { buildSummary, type FreeSessionSummary } from '../engine/freeSession';

const state = (): FreeDepartureState & FreeDepartureActions =>
  useFreeDepartureStore.getState() as FreeDepartureState & FreeDepartureActions;

function summaryWith(traceLength: number): FreeSessionSummary {
  return buildSummary({
    distanceKm: 8.2,
    durationSeconds: 7200,
    averageSpeedKmH: 4.9,
    elevationGainM: 210,
    positions: Array.from({ length: traceLength }, (_, index) => ({
      lat: 48.1 + index / 1000,
      lon: 2.1 + index / 1000,
    })),
    endedAt: 1750000000000,
  });
}

beforeEach(() => {
  state().reset();
});

describe('store — machine a trois etats', () => {
  it('FREE-ST01: on commence par l’ecran d’AVANT, jamais en suivi', () => {
    expect(state().phase).toBe('avant');
    expect(state().summary).toBeNull();
  });

  it('FREE-ST02: une seule phase a la fois — jamais un chrono et un resume ensemble', () => {
    const phases: string[] = [];
    state().setPhase('pendant');
    phases.push(state().phase);
    state().markFinished(summaryWith(3));
    phases.push(state().phase);
    expect(phases).toEqual(['pendant', 'apres']);
  });

  it('FREE-ST03: finir fige les mesures ET bascule vers l’apres dans le meme geste', () => {
    state().markFinished(summaryWith(3));
    expect(state().phase).toBe('apres');
    expect(state().finishedAt).toBe(1750000000000);
    expect(state().summary?.distanceKm).toBeCloseTo(8.2);
  });

  it('FREE-ST04: la trace est un CHOIX de l’utilisateur, pas un heritage', () => {
    state().setKeepTrace(false);
    expect(state().keepTrace).toBe(false);
    expect(state().summary).toBeNull();
  });
});

describe('store — vie privee (invariants)', () => {
  it('FREE-ST05: par defaut, rien ne sort', () => {
    expect(state().shareWithGroup).toBe(false);
    expect(state().permission).toBe('inconnue');
  });

  it('FREE-ST06: effacer la trace coupe le partage dans le MEME geste', () => {
    state().setKeepTrace(true);
    state().setShareWithGroup(true);
    expect(state().shareWithGroup).toBe(true);

    state().setKeepTrace(false);
    expect(state().shareWithGroup).toBe(false);
  });

  it('FREE-ST07: finir une session sans point laisse le partage a zero', () => {
    state().setShareWithGroup(true);
    state().markFinished(summaryWith(0));
    expect(state().shareWithGroup).toBe(false);
    // Et la conservation n'est pas non plus promise sur du vide.
    expect(state().keepTrace).toBe(false);
  });

  it('FREE-ST08: finir une session avec des points ne reactive pas le partage', () => {
    state().setShareWithGroup(true);
    state().markFinished(summaryWith(12));
    expect(state().keepTrace).toBe(true);
    expect(state().shareWithGroup).toBe(false);
  });

  it('FREE-ST09: un groupe inexploitable redevient une sortie individuelle', () => {
    state().setGroupSize(4);
    expect(state().groupSize).toBe(4);
    state().setGroupSize(-2);
    expect(state().groupSize).toBe(0);
    state().setGroupSize(Number.NaN);
    expect(state().groupSize).toBe(0);
  });
});

describe('store — activite retenue', () => {
  it('FREE-ST10: revenir a la detection efface aussi la confirmation', () => {
    state().confirmActivity('rando-journee');
    expect(state().confirmed).toBe(true);
    state().setActivity(null);
    expect(state().confirmed).toBe(false);
  });

  it('FREE-ST11: corriger apres la sortie fige le nouveau choix', () => {
    state().markFinished(summaryWith(3));
    state().confirmActivity('velo-route');
    expect(state().activityId).toBe('velo-route');
    expect(state().confirmed).toBe(true);
  });
});

describe('store — format et migration', () => {
  it('FREE-ST12: la cle de stockage versionne, donc une migration reste possible', () => {
    expect(FREE_DEPARTURE_VERSION).toBe(2);
  });

  it('FREE-ST13: une session v1 survit SANS inventer de mesures', () => {
    // v1 ne conservait que l'horodatage : il n'y a rien a reconstruire, et
    // surtout aucune distance a fabriquer. L'ecran 62 doit pouvoir dire
    // « rien n'a ete conserve » plutot que d'afficher des zeros.
    // `api.persist` n'existe pas hors navigateur (pas de localStorage), donc
    // la migration est appelée directement : c'est elle qu'on veut tester.
    const migrated = migrateToV2({ activityId: 'rando-journee', finishedAt: 1749999999999 });

    expect(migrated.phase).toBe('avant');
    expect(migrated.activityId).toBe('rando-journee');
    expect(migrated.finishedAt).toBe(1749999999999);
    expect(migrated.summary).toBeNull();
    // Le partage repart toujours a zero : une session terminee ne doit pas
    // laisser un partage actif que l'utilisateur aurait oublie.
    expect(migrated.shareWithGroup).toBe(false);
  });
});
