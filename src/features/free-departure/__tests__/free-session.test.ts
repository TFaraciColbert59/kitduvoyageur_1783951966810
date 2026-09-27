import { describe, expect, it } from 'vitest';
import {
  MAX_TRACE_POINTS,
  buildSummary,
  buildTrace,
  formatClock,
  formatDistanceKm,
  formatElevation,
  formatPace,
  guessHeadline,
  guessJustification,
  paceFromSpeed,
  unknownGuessReason,
} from '../engine/freeSession';
import { activityById } from '@/features/adventure-prep/catalog';
import type { ActivityGuess, FreeSessionSignals } from '../engine/activityGuess';
import type { TracePoint } from '../engine/freeSession';

/** Trace synthetique de N points aligns, tous exploitables. */
function trace(count: number): TracePoint[] {
  return Array.from({ length: count }, (_, index) => ({ lat: 48 + index / 1000, lon: 2 + index / 1000 }));
}

function guess(overrides: Partial<ActivityGuess> = {}): ActivityGuess {
  return {
    activityId: 'rando-journee',
    label: activityById('rando-journee')?.label ?? 'Randonnee',
    icon: 'footprints',
    because: 'vitesse moyenne 4,8 km/h, sur 2 h, 9,8 km',
    confidence: 'proposee',
    ...overrides,
  };
}

function signals(overrides: Partial<FreeSessionSignals> = {}): FreeSessionSignals {
  return {
    distanceKm: 9.8,
    durationSeconds: 2 * 3600 + 4 * 60 + 10,
    averageSpeedKmH: 4.8,
    elevationGainM: 240,
    ...overrides,
  };
}

describe('freeSession — trace et mesures (ecrans 61 et 62)', () => {
  describe('buildTrace', () => {
    it('FREE-F01: ecarte le point (0, 0), qui signifie « pas de position »', () => {
      const source: TracePoint[] = [
        { lat: 48.1, lon: 2.1 },
        { lat: 0, lon: 0 },
        { lat: 48.2, lon: 2.2 },
      ];
      expect(buildTrace(source)).toEqual([
        { lat: 48.1, lon: 2.1 },
        { lat: 48.2, lon: 2.2 },
      ]);
    });

    it('FREE-F02: ecarte les coordonnees non finies sans jetter la trace entiere', () => {
      const source: TracePoint[] = [
        { lat: Number.NaN, lon: 2.1 },
        { lat: 48.1, lon: Number.POSITIVE_INFINITY },
        { lat: 48.2, lon: 2.2 },
      ];
      expect(buildTrace(source)).toEqual([{ lat: 48.2, lon: 2.2 }]);
    });

    it('FREE-F03: borne la trace en conservant le premier ET le dernier point', () => {
      const source = trace(1000);
      const kept = buildTrace(source);
      expect(kept).toHaveLength(MAX_TRACE_POINTS);
      expect(kept[0]).toEqual(source[0]);
      expect(kept[kept.length - 1]).toEqual(source[source.length - 1]);
    });

    it('FREE-F04: ne mute JAMAIS la liste recue', () => {
      const source = trace(10);
      const before = source.map((point) => ({ ...point }));
      buildTrace(source, 3);
      expect(source).toEqual(before);
    });

    it('FREE-F05: une liste plus courte que la limite est renvoyee en copie', () => {
      const source = trace(4);
      const kept = buildTrace(source);
      expect(kept).toEqual(source);
      expect(kept).not.toBe(source);
    });

    it('FREE-F06: refuse une limite absurde et retombe sur la borne du module', () => {
      // Il faut partir d'une trace PLUS LONGUE que la borne : c'est elle qui
      // doit etre ramenee a MAX_TRACE_POINTS. Une limite invalide ne donne
      // jamais le droit d'agrandir une trace qui tient deja.
      expect(buildTrace(trace(1000), 0)).toHaveLength(MAX_TRACE_POINTS);
      expect(buildTrace(trace(1000), -8)).toHaveLength(MAX_TRACE_POINTS);
      expect(buildTrace(trace(50), 0)).toHaveLength(50);
    });
  });

  describe('buildSummary', () => {
    it('FREE-F07: fige les mesures, borne la trace, convertit les absences en 0', () => {
      const summary = buildSummary({
        distanceKm: 9.83,
        durationSeconds: 7450,
        averageSpeedKmH: 4.8,
        elevationGainM: null,
        positions: trace(900),
        endedAt: 1750000000000,
      });
      expect(summary.distanceKm).toBe(9.83);
      expect(summary.durationSeconds).toBe(7450);
      // Pas de capteur : on fige 0, on n'invente pas de denivele.
      expect(summary.elevationGainM).toBe(0);
      expect(summary.averageSpeedKmH).toBe(4.8);
      expect(summary.trace.length).toBeLessThanOrEqual(MAX_TRACE_POINTS);
      expect(summary.endedAt).toBe(1750000000000);
    });

    it('FREE-F08: refuse les mesures negatives ou non finies', () => {
      const summary = buildSummary({
        distanceKm: -12,
        durationSeconds: Number.NaN,
        averageSpeedKmH: Number.POSITIVE_INFINITY,
        elevationGainM: -80,
        positions: [],
        endedAt: null,
      });
      expect(summary.distanceKm).toBe(0);
      expect(summary.durationSeconds).toBe(0);
      expect(summary.averageSpeedKmH).toBe(0);
      expect(summary.elevationGainM).toBe(0);
      expect(summary.trace).toEqual([]);
    });
  });

  describe('mise en forme des mesures', () => {
    it('FREE-F09: l’horloge passe en HH:MM:SS au-dela d’une heure', () => {
      expect(formatClock(3768)).toBe('1:02:48');
      expect(formatClock(7450)).toBe('2:04:10');
    });

    it('FREE-F10: sous une heure, l’horloge reste MM:SS', () => {
      expect(formatClock(0)).toBe('0:00');
      expect(formatClock(48)).toBe('0:48');
      expect(formatClock(754)).toBe('12:34');
    });

    it('FREE-F11: une absence de mesure s’affiche « — », jamais un zéro forgé', () => {
      expect(formatClock(null)).toBe('—');
      expect(formatElevation(null)).toBe('—');
      expect(formatPace(null)).toBe('—');
    });

    it('FREE-F12: une horloge invalide retombe a zéro sans planter', () => {
      expect(formatClock(-40)).toBe('0:00');
      expect(formatClock(Number.NaN)).toBe('0:00');
    });

    it('FREE-F13: distance et denivele au format francais', () => {
      expect(formatDistanceKm(6.34)).toBe('6,3 km');
      expect(formatDistanceKm(0)).toBe('0 km');
      expect(formatElevation(180.4)).toBe('180 m');
    });

    it('FREE-F14: l’allure se deduit de la vitesse, jamais l’inverse', () => {
      expect(paceFromSpeed(4.8)).toBeCloseTo(12.5, 2);
      expect(formatPace(paceFromSpeed(4.8))).toBe('12:30');
      expect(formatPace(11.5666)).toBe('11:34');
    });

    it('FREE-F15: une allure non calculable ne devient pas une allure infinie', () => {
      expect(paceFromSpeed(null)).toBeNull();
      expect(paceFromSpeed(0)).toBeNull();
      expect(paceFromSpeed(Number.NaN)).toBeNull();
      expect(formatPace(0)).toBe('—');
      expect(formatPace(-5)).toBe('—');
    });
  });

  describe('unknownGuessReason — jamais d’echec silencieux', () => {
    it('FREE-F16: dit pourquoi la session est trop courte', () => {
      expect(unknownGuessReason(signals({ durationSeconds: 300 }))).toContain('trop courte');
    });

    it('FREE-F17: dit quand aucune position exploitable n’a été reçue', () => {
      expect(unknownGuessReason(signals({ distanceKm: null }))).toContain('Aucune distance');
    });

    it('FREE-F18: dit quand la trace est trop courte pour distinguer', () => {
      expect(unknownGuessReason(signals({ distanceKm: 0.1 }))).toContain('Trop peu de distance');
    });

    it('FREE-F19: ne présente jamais une panne de vitesse comme une activité', () => {
      const reason = unknownGuessReason(signals({ averageSpeedKmH: null }));
      expect(reason).toContain('vitesse moyenne');
      expect(reason).toContain('calculée');
    });

    it('FREE-F20: refuse une allure dérive ou aberrante en l’expliquant', () => {
      expect(unknownGuessReason(signals({ averageSpeedKmH: 1 }))).toContain('trop basse');
      expect(unknownGuessReason(signals({ averageSpeedKmH: 200 }))).toContain('incohérente');
    });

    it('FREE-F21: n’est jamais vide, même sur une entrée inconnue', () => {
      for (const input of [
        signals({ durationSeconds: 0, distanceKm: 0, averageSpeedKmH: 0 }),
        signals({ durationSeconds: 5000, distanceKm: 50, averageSpeedKmH: 4.8 }),
      ]) {
        const reason = unknownGuessReason(input);
        expect(reason).toBeTypeOf('string');
        expect((reason ?? '').length).toBeGreaterThan(10);
      }
    });
  });

  describe('mise en forme de la proposition', () => {
    it('FREE-F22: le titre interroge l’utilisateur quand l’activité est une proposition', () => {
      expect(guessHeadline('Randonnee', true)).toBe('C’était une randonnee ?');
      expect(guessHeadline('Randonnée', true)).toBe('C’était une randonnée ?');
    });

    it('FREE-F23: élision en « un » devant une consonne, en « une » devant une voyelle', () => {
      expect(guessHeadline('Voyage', true)).toBe('C’était un voyage ?');
      expect(guessHeadline('Kayak', true)).toBe('C’était un kayak ?');
      expect(guessHeadline('Randonnée', true)).toBe('C’était une randonnée ?');
    });

    it('FREE-F24: un choix affirmatif n’est jamais présenté comme une question', () => {
      const headline = guessHeadline('Randonnée', false);
      expect(headline).not.toContain('?');
      expect(headline).toContain('Randonnée');
    });

    it('FREE-F25: la justification nomme l’allure en min/km, comme la maquette', () => {
      expect(guessJustification(signals(), guess())).toBe('Proposé par LKDV · allure 12:30 min/km');
    });

    it('FREE-F26: sans allure mesurable, la justification retombe sur les mesures brutes', () => {
      const text = guessJustification(signals({ averageSpeedKmH: null }), guess());
      expect(text).toContain('Proposé par LKDV');
      expect(text).toContain('vitesse moyenne');
      expect(text).not.toContain('min/km');
    });
  });
});

