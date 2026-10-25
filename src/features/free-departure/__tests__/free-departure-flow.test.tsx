import { describe, expect, it } from 'vitest';
import { buildSummaryView, resolveLiveView } from '../engine/freeFlow';
import { buildSummary, toTracePoints, type TracePoint } from '../engine/freeSession';
import { guessActivity } from '../engine/activityGuess';
import type { FreeSessionSummary } from '../engine/freeSession';
import type { FreeDepartureState } from '../store/useFreeDepartureStore';

/** Sortie complete, telle que le traceur la produit en fin de session. */
const FULL: FreeSessionSummary = buildSummary({
  distanceKm: 9.83,
  durationSeconds: 7450,
  averageSpeedKmH: 4.8,
  elevationGainM: 240,
  positions: [
    { lat: 48.1, lon: 2.1 },
    { lat: 48.2, lon: 2.2 },
  ],
  endedAt: 1750000000000,
});

function state(overrides: Partial<FreeDepartureState> = {}): FreeDepartureState {
  return {
    phase: 'apres',
    activityId: null,
    confirmed: false,
    permission: 'accordee',
    finishedAt: FULL.endedAt,
    summary: FULL,
    keepTrace: true,
    shareWithGroup: false,
    groupSize: 0,
    ...overrides,
  };
}

function live(overrides: Partial<Parameters<typeof resolveLiveView>[0]> = {}) {
  return resolveLiveView({
    distanceKm: 6.3,
    durationSeconds: 4368,
    averageSpeedKmH: 5.2,
    elevationGainM: 180,
    positions: [
      { lat: 48.1, lon: 2.1 },
      { lat: 48.2, lon: 2.2 },
    ],
    paused: false,
    activityId: null,
    canTrack: true,
    ...overrides,
  });
}

describe('freeFlow — machine a trois etats (60 → 61 → 62)', () => {
  describe('resolveLiveView — ecran 61', () => {
    it('FREE-FL01: mesure les trois quantites utiles, sans score', () => {
      const view = live();
      expect(view.clock).toBe('1:12:48');
      expect(view.distance).toBe('6,3 km');
      expect(view.pace).toBe('11:32');
      expect(view.elevation).toBe('180 m');
      expect(view.trace).toHaveLength(2);
    });

    it('FREE-FL02: sans activite choisie, l’en-tete dit « Suivi libre »', () => {
      expect(live().activityLabel).toBe('Suivi libre');
    });

    it('FREE-FL03: une activite choisie s’affiche telle quelle', () => {
      const view = live({ activityId: 'rando-journee' });
      expect(view.activityLabel).toBe('Randonnée');
      expect(view.activityIcon).toBe('footprints');
    });

    it('FREE-FL04: une identite d’activite inconnue ne fait pas planter l’ecran', () => {
      const view = live({ activityId: '@@inconnue@@' });
      expect(view.activityLabel).toBe('Suivi libre');
    });

    it('FREE-FL05: sans position, l’ecran DIT que la trace est interrompue', () => {
      expect(live({ canTrack: false }).trackingNote).toContain('trace est interrompue');
    });

    it('FREE-FL06: une session sans point conserve une trace vide, pas un pointOffsetsque', () => {
      expect(live({ positions: [] }).trace).toEqual([]);
    });

    it('FREE-FL07: la pause n’efface aucune mesure', () => {
      const running = live();
      const paused = live({ paused: true });
      expect(paused.paused).toBe(true);
      expect(paused.distance).toBe(running.distance);
      expect(paused.trace).toHaveLength(running.trace.length);
    });

    it('FREE-FL08: une allure non mesurable s’affiche « — » au lieu de « 0:00 »', () => {
      expect(live({ averageSpeedKmH: 0 }).pace).toBe('—');
    });
  });

  describe('toTracePoints — le traceur parle \'latitude\', le moteur attend \'lat\'', () => {
    it('FREE-FL19: convertit les points du traceur en trace dessinable', () => {
      const trace = toTracePoints([
        { latitude: 48.1, longitude: 2.1 },
        { latitude: 48.2, longitude: 2.2 },
      ]);
      expect(trace).toEqual([
        { lat: 48.1, lon: 2.1 },
        { lat: 48.2, lon: 2.2 },
      ]);
    });

    it('FREE-FL20: un couple neutre (0,0) ne dessine rien au milieu de l\'Atlantique', () => {
      expect(toTracePoints([{ latitude: 0, longitude: 0 }])).toEqual([]);
    });

    it('FREE-FL21: une source absente ou non tabulaire ne leve pas', () => {
      expect(toTracePoints(undefined as never)).toEqual([]);
      expect(toTracePoints([{ latitude: Number.NaN, longitude: 2.2 }])).toEqual([]);
    });

    it('FREE-FL22: la trace reste bornee, comme partout ailleurs', () => {
      const long = Array.from({ length: 900 }, (_, index) => ({
        latitude: 48 + index / 10000,
        longitude: 2 + index / 10000,
      }));
      expect(toTracePoints(long).length).toBeLessThanOrEqual(400);
    });
  });

  describe('le message de suivi dit la panne reelle', () => {
    it('FREE-FL23: perte de GPS — le message propose de reessayer', () => {
      expect(live({ canTrack: false }).trackingNote).toContain('GPS ne répond plus');
    });

    it('FREE-FL24: localisation refusee — le message ne parle pas de panne materielle', () => {
      const note = live({ canTrack: false, trackingNote: 'Tu as refusé la localisation.' }).trackingNote;
      expect(note).toBe('Tu as refusé la localisation.');
      expect(note).not.toContain('GPS');
    });
  });

  describe('buildSummaryView — ecran 62', () => {
    it('FREE-FL09: sans choix manuel, la proposition du moteur est une QUESTION', () => {
      const view = buildSummaryView(state());
      expect(view.isGuess).toBe(true);
      expect(view.label).toBe('Randonnée');
      expect(view.justification).toBe('Proposé par LKDV · allure 12:30 min/km');
    });

    it('FREE-FL10: un choix manuel prime sur la proposition et n’est jamais hesite', () => {
      const view = buildSummaryView(state({ activityId: 'velo-route', confirmed: true }));
      expect(view.isGuess).toBe(false);
      expect(view.label).toBe('Vélo route');
      expect(view.justification).toBeNull();
    });

    it('FREE-FL11: la correction finale fige l’activite et supprime l’interrogation', () => {
      const corrected = buildSummaryView(state({ activityId: 'course', confirmed: true }));
      expect(corrected.label).toBe('Course');
      expect(corrected.isGuess).toBe(false);
    });

    it('FREE-FL12: sans proposition, l’ecran porte la raison de l’impossibilite', () => {
      const court = buildSummary(
        buildSummaryInput({ durationSeconds: 300, distanceKm: 0.1, averageSpeedKmH: 4.9 })
      );
      const view = buildSummaryView(state({ summary: court }));
      expect(view.label).toBeNull();
      expect(view.isGuess).toBe(false);
      expect(view.unknownReason).toContain('trop courte');
    });

    it('FREE-FL13: la confiance « incertaine » est transmise a l’ecran', () => {
      const view = buildSummaryView(
        state({
          summary: buildSummary(buildSummaryInput({ averageSpeedKmH: 3.8, durationSeconds: 7450 })),
        })
      );
      expect(view.guessConfidence).toBe('incertaine');
    });

    it('FREE-FL14: les trois mesures de fin proviennent de la session figee', () => {
      const view = buildSummaryView(state());
      expect(view.duration).toBe('2:04:10');
      expect(view.distance).toBe('9,8 km');
      expect(view.elevation).toBe('240 m');
    });

    it('FREE-FL15: une session sans resume reste affichable, mesure par mesure', () => {
      const view = buildSummaryView(state({ summary: null }));
      expect(view.duration).toBe('—');
      expect(view.distance).toBe('—');
      expect(view.elevation).toBe('—');
      expect(view.trace).toEqual([]);
      // Aucun resume n_display ne dispense d’expliquer l’absence d’activite.
      expect(view.unknownReason).not.toBeNull();
    });

    it('FREE-FL16: les lignes de vie privee sortent du store, jamais d’un etat local', () => {
      const view = buildSummaryView(state({ keepTrace: false, shareWithGroup: true, groupSize: 3 }));
      expect(view.privacy.map((row) => row.id)).toEqual(['trace', 'partage']);
      expect(view.privacy[0].checked).toBe(false);
      expect(view.privacy[1].checked).toBe(false);
    });

    it('FREE-FL17: un partage bloque par absence de trace n’est jamais laisse actif', () => {
      const view = buildSummaryView(state({ keepTrace: false, shareWithGroup: true, groupSize: 3 }));
      expect(view.privacy[1].disabled).toBe(true);
      expect(view.privacy[1].checked).toBe(false);
    });
  });

  describe('le moteur de proposition reste le seul auteur de l’activite', () => {
    it('FREE-FL18: la proposition de l’ecran 62 est bien celle de guessActivity', () => {
      const signals = {
        distanceKm: FULL.distanceKm,
        durationSeconds: FULL.durationSeconds,
        averageSpeedKmH: FULL.averageSpeedKmH,
        elevationGainM: FULL.elevationGainM,
      };
      const guess = guessActivity(signals);
      const view = buildSummaryView(state());
      expect(view.label).toBe(guess?.label ?? null);
    });
  });
});

/** Regroupe les mesures du traceur en une entree de `buildSummary`. */
function buildSummaryInput(overrides: {
  distanceKm?: number;
  durationSeconds?: number;
  averageSpeedKmH?: number;
  elevationGainM?: number | null;
  positions?: TracePoint[];
}) {
  return {
    // Valeurs par defaut = une sortie credibile. Un appel qui ne precise
    // qu'une seule mesure teste CETTE mesure, pas les trois.
    distanceKm: overrides.distanceKm ?? 8,
    durationSeconds: overrides.durationSeconds ?? 2 * 3600,
    averageSpeedKmH: overrides.averageSpeedKmH ?? 5,
    elevationGainM: overrides.elevationGainM ?? 0,
    positions: overrides.positions ?? [],
    endedAt: 1750000000000,
  };
}
