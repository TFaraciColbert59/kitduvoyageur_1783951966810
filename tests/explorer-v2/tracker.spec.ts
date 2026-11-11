import { describe, expect, it } from 'vitest';
import {
  ActivityTracker,
  AUTO_PAUSE_BY_SPORT,
  AUTO_PAUSE_DISABLED,
  autoPauseConfigForSport,
  averageSpeedKmh,
  resolveAutoPauseConfig,
  type AutoPauseEvent,
  type GpsFix,
} from '@/features/explorer-v2/activity/tracker';
import type { Sport } from '@/features/explorer-v2/state/types';

/**
 * Métriques d'activité (P7-16) : 9 profils de sport rejoués sur le même
 * tracker. Les traces sont synthétiques mais **physiquement cohérentes**
 * (vitesse par sport), ce qui permet de vérifier les métriques attendues.
 */

function track({
  points,
  stepS,
  speedMs,
  lat0 = 45.92,
  lng0 = 6.87,
  eleGainPerPoint = 0,
  acc = 8,
}: {
  points: number;
  stepS: number;
  speedMs: number;
  lat0?: number;
  lng0?: number;
  eleGainPerPoint?: number;
  acc?: number;
}): GpsFix[] {
  const metersPerDegLat = 111320;
  const deltaLat = (speedMs * stepS) / metersPerDegLat;
  return Array.from({ length: points }, (_, index) => ({
    t: index * stepS * 1000,
    lat: lat0 + index * deltaLat,
    lng: lng0,
    ele: 1200 + index * eleGainPerPoint,
    acc,
    speed: speedMs,
  }));
}

const SPORTS: Array<{
  sport: string;
  speedMs: number;
  stepS: number;
  points: number;
  ele: number;
  expectKm: number;
  expectGain: number;
}> = [
  { sport: 'course', speedMs: 3.0, stepS: 5, points: 60, ele: 2, expectKm: 0.9, expectGain: 118 },
  { sport: 'rando', speedMs: 1.1, stepS: 10, points: 60, ele: 4, expectKm: 0.66, expectGain: 236 },
  { sport: 'velo', speedMs: 6.5, stepS: 5, points: 60, ele: 1, expectKm: 1.95, expectGain: 59 },
  { sport: 'kayak', speedMs: 1.8, stepS: 10, points: 60, ele: 0, expectKm: 1.08, expectGain: 0 },
  { sport: 'trail', speedMs: 2.6, stepS: 5, points: 60, ele: 3, expectKm: 0.78, expectGain: 177 },
  { sport: 'ski', speedMs: 1.4, stepS: 10, points: 60, ele: 2, expectKm: 0.84, expectGain: 118 },
  {
    sport: 'escalade',
    speedMs: 0.4,
    stepS: 15,
    points: 60,
    ele: 5,
    expectKm: 0.36,
    expectGain: 295,
  },
  { sport: 'famille', speedMs: 0.8, stepS: 10, points: 60, ele: 1, expectKm: 0.48, expectGain: 59 },
  { sport: 'bivouac', speedMs: 1.0, stepS: 10, points: 60, ele: 2, expectKm: 0.6, expectGain: 118 },
];

describe('explorer-v2 · tracker d’activité', () => {
  for (const profile of SPORTS) {
    it(`${profile.sport} : distance et dénivelé cohérents`, () => {
      const tracker = new ActivityTracker();
      const fixes = track({
        points: profile.points,
        stepS: profile.stepS,
        speedMs: profile.speedMs,
        eleGainPerPoint: profile.ele,
      });
      let metrics = tracker.state;
      for (const fix of fixes) metrics = tracker.addFix(fix);

      expect(metrics.distanceM / 1000).toBeCloseTo(profile.expectKm, 1);
      if (profile.expectGain > 0) {
        // Le lissage exponentiel retient ~92 % d'un gain régulier.
        expect(metrics.elevGainM).toBeGreaterThan(profile.expectGain * 0.85);
        expect(metrics.elevGainM).toBeLessThanOrEqual(profile.expectGain);
      } else {
        // Kayak : pas de dénivelé, la valeur reste nulle (aucune invention).
        expect(metrics.elevGainM).toBe(0);
      }
      expect(metrics.movingS).toBeGreaterThan(0);
      expect(averageSpeedKmh(metrics)).toBeCloseTo(profile.speedMs * 3.6, 0);
    });
  }

  it('ignore une position imprécise (> 30 m)', () => {
    const tracker = new ActivityTracker();
    tracker.addFix({ t: 0, lat: 45.92, lng: 6.87, acc: 8 });
    const metrics = tracker.addFix({ t: 1000, lat: 45.93, lng: 6.87, acc: 120 });
    expect(metrics.distanceM).toBe(0);
    expect(metrics.rejected).toBe(1);
  });

  it('rejette un saut GPS impossible', () => {
    const tracker = new ActivityTracker();
    tracker.addFix({ t: 0, lat: 45.92, lng: 6.87, acc: 5 });
    const metrics = tracker.addFix({ t: 1000, lat: 45.95, lng: 6.87, acc: 5 });
    expect(metrics.distanceM).toBe(0);
    expect(metrics.rejected).toBe(1);
  });

  it('ne compte pas le temps à l’arrêt comme du mouvement', () => {
    const tracker = new ActivityTracker();
    tracker.addFix({ t: 0, lat: 45.92, lng: 6.87, acc: 5 });
    const metrics = tracker.addFix({ t: 60_000, lat: 45.92, lng: 6.87, acc: 5 });
    expect(metrics.movingS).toBe(0);
    expect(metrics.distanceM).toBe(0);
  });
});

/* ------------------------------------------------------------------------- *
 * Auto-pause (S1.05) : séquences GPS synthétiques
 * ------------------------------------------------------------------------- */

const LAT0 = 45.92;
const LNG0 = 6.87;
const M_PER_DEG_LAT = 111320;

interface Segment {
  durationS: number;
  speedMs: number;
  stepS?: number;
  /** Coupure de fix après ce segment (aucun point pendant la durée). */
  gapAfterS?: number;
}

/**
 * Construit une séquence physiquement cohérente : la latitude avance de
 * `speed * step` à chaque point, donc distance et vitesse restent liées.
 */
function buildSequence(segments: Segment[]): GpsFix[] {
  const fixes: GpsFix[] = [
    { t: 0, lat: LAT0, lng: LNG0, ele: 1200, acc: 5, speed: segments[0]?.speedMs ?? 0 },
  ];
  let t = 0;
  let distanceM = 0;

  for (const segment of segments) {
    const stepS = segment.stepS ?? 5;
    const steps = Math.round(segment.durationS / stepS);
    for (let index = 0; index < steps; index += 1) {
      t += stepS * 1000;
      distanceM += segment.speedMs * stepS;
      fixes.push({
        t,
        lat: LAT0 + distanceM / M_PER_DEG_LAT,
        lng: LNG0,
        ele: 1200,
        acc: 5,
        speed: segment.speedMs,
      });
    }
    if (segment.gapAfterS) t += segment.gapAfterS * 1000;
  }

  return fixes;
}

function at(t: number, distanceM: number, speedMs: number, acc = 5): GpsFix {
  return {
    t,
    lat: LAT0 + distanceM / M_PER_DEG_LAT,
    lng: LNG0,
    ele: 1200,
    acc,
    speed: speedMs,
  };
}

function feed(tracker: ActivityTracker, fixes: GpsFix[]) {
  let state = tracker.state;
  for (const fix of fixes) state = tracker.addFix(fix);
  return state;
}

const SPORT_IDS: Sport[] = [
  'course',
  'rando',
  'velo',
  'kayak',
  'trail',
  'ski',
  'escalade',
  'famille',
  'bivouac',
];

describe('explorer-v2 · auto-pause', () => {
  it('est désactivée par défaut et reste strictement compatible avec l’historique', () => {
    const fixes = buildSequence([
      { durationS: 60, speedMs: 1.2, stepS: 5 },
      { durationS: 600, speedMs: 0, stepS: 10 },
      { durationS: 60, speedMs: 1.2, stepS: 5 },
    ]);

    const historicalTracker = new ActivityTracker();
    const historical = feed(historicalTracker, fixes);
    const explicitOff = feed(new ActivityTracker({ autoPause: false }), fixes);
    const sportOff = feed(
      new ActivityTracker({ sport: 'rando', autoPause: { enabled: false } }),
      fixes
    );

    for (const metrics of [explicitOff, sportOff]) {
      expect(metrics.distanceM).toBe(historical.distanceM);
      expect(metrics.movingS).toBe(historical.movingS);
      expect(metrics.elevGainM).toBe(historical.elevGainM);
      expect(metrics.rejected).toBe(historical.rejected);
      expect(metrics.autoPause.enabled).toBe(false);
      expect(metrics.autoPaused).toBe(false);
      expect(metrics.autoPause.pauseCount).toBe(0);
    }

    // Même une longue immobilité ne crée aucun événement quand c'est désactivé.
    expect(historicalTracker.autoPauseEvents).toHaveLength(0);
    expect(AUTO_PAUSE_DISABLED.enabled).toBe(false);
  });

  it('expose un profil par sport, avec surcharge et désactivation réversibles', () => {
    for (const sport of SPORT_IDS) {
      const profile = AUTO_PAUSE_BY_SPORT[sport];
      expect(profile.enabled).toBe(true);
      expect(profile.durationS).toBeGreaterThan(0);
      expect(profile.resumeSpeedThresholdMs).toBeGreaterThanOrEqual(profile.speedThresholdMs);
      expect(autoPauseConfigForSport(sport)).toEqual(profile);
    }

    expect(AUTO_PAUSE_BY_SPORT.velo.durationS).toBeLessThan(AUTO_PAUSE_BY_SPORT.rando.durationS);
    expect(AUTO_PAUSE_BY_SPORT.velo.speedThresholdMs).toBeGreaterThan(
      AUTO_PAUSE_BY_SPORT.rando.speedThresholdMs
    );

    expect(resolveAutoPauseConfig('rando', false).enabled).toBe(false);
    const overridden = resolveAutoPauseConfig('rando', { durationS: 10, enabled: false });
    expect(overridden.enabled).toBe(false);
    expect(overridden.durationS).toBe(10);
  });

  it('applique le seuil et la temporisation propres à chaque sport', () => {
    for (const sport of SPORT_IDS) {
      const profile = AUTO_PAUSE_BY_SPORT[sport];
      const movingSpeed = Math.max(profile.resumeSpeedThresholdMs * 2, 0.8);
      const tracker = new ActivityTracker({ sport, autoPause: true });
      const fixes = buildSequence([
        { durationS: 5, speedMs: movingSpeed, stepS: 1 },
        // Laisse largement dépasser le délai du sport.
        { durationS: profile.durationS + 10, speedMs: 0, stepS: 5 },
        // Mouvement sous le seuil de reprise : la pause tient.
        { durationS: 15, speedMs: profile.resumeSpeedThresholdMs * 0.5, stepS: 1 },
        // Mouvement continu au-dessus du seuil : la reprise se fait.
        {
          durationS: profile.resumeDurationS + 2,
          speedMs: profile.resumeSpeedThresholdMs * 1.5,
          stepS: 1,
        },
      ]);

      const state = feed(tracker, fixes);
      expect(state.autoPause.pauseCount, sport).toBe(1);
      expect(state.autoPause.resumeCount, sport).toBe(1);
      expect(state.autoPaused, sport).toBe(false);
      expect(
        tracker.autoPauseEvents.map((event) => event.type),
        sport
      ).toEqual(['pause', 'resume']);
    }
  });

  it('détecte l’arrêt après la temporisation du sport, pas avant', () => {
    const tracker = new ActivityTracker({
      sport: 'rando',
      autoPause: {
        enabled: true,
        speedThresholdMs: 0.2,
        durationS: 60,
        resumeSpeedThresholdMs: 0.5,
        resumeDurationS: 5,
        maxFixGapS: 120,
      },
    });
    const fixes = buildSequence([
      { durationS: 10, speedMs: 1, stepS: 5 },
      { durationS: 70, speedMs: 0, stepS: 10 },
    ]);

    let state = tracker.state;
    for (const fix of fixes) {
      state = tracker.addFix(fix);
      if (fix.t === 60_000) {
        expect(state.autoPaused).toBe(false);
        expect(state.autoPause.stoppedS).toBe(50);
      }
    }

    expect(state.autoPaused).toBe(true);
    expect(state.isAutoPaused).toBe(true);
    expect(state.autoPause.pauseCount).toBe(1);
    expect(state.autoPause.stoppedS).toBe(60);
    expect(tracker.autoPauseEvents).toEqual([
      { type: 'pause', t: 70_000, sport: 'rando', afterS: 60, reason: 'stop-delay' },
    ]);
  });

  it('ne reprend qu’après un mouvement continu au-dessus du seuil', () => {
    const events: AutoPauseEvent[] = [];
    const tracker = new ActivityTracker({
      sport: 'rando',
      autoPause: {
        enabled: true,
        speedThresholdMs: 0.2,
        durationS: 20,
        resumeSpeedThresholdMs: 0.5,
        resumeDurationS: 5,
        maxFixGapS: 120,
      },
      onAutoPause: (event) => events.push(event),
    });
    const fixes = buildSequence([
      { durationS: 10, speedMs: 1, stepS: 1 },
      { durationS: 30, speedMs: 0, stepS: 1 },
      { durationS: 7, speedMs: 1, stepS: 1 },
    ]);

    let state = tracker.state;
    for (const fix of fixes) {
      state = tracker.addFix(fix);
      if (fix.t === 44_000) {
        expect(state.autoPaused).toBe(true);
        expect(state.autoPause.resumingS).toBe(4);
      }
      if (fix.t === 45_000) {
        expect(state.autoPaused).toBe(false);
        expect(state.autoPause.resumeCount).toBe(1);
      }
    }

    expect(state.autoPause.pauseCount).toBe(1);
    expect(events.map((event) => event.type)).toEqual(['pause', 'resume']);
    expect(events[1]).toMatchObject({ t: 45_000, afterS: 5, reason: 'resume-delay' });
  });

  it('ne clignote pas quand la vitesse oscille autour des seuils', () => {
    const tracker = new ActivityTracker({
      sport: 'trail',
      autoPause: {
        enabled: true,
        speedThresholdMs: 0.2,
        durationS: 30,
        resumeSpeedThresholdMs: 0.5,
        resumeDurationS: 10,
        maxFixGapS: 120,
      },
    });
    const oscillation: Segment[] = [];
    for (let index = 0; index < 5; index += 1) {
      oscillation.push({ durationS: 20, speedMs: 0.1, stepS: 5 });
      oscillation.push({ durationS: 5, speedMs: 1, stepS: 1 });
    }

    const beforePause = buildSequence([{ durationS: 10, speedMs: 1, stepS: 1 }, ...oscillation]);
    let state = feed(tracker, beforePause);
    expect(state.autoPaused).toBe(false);
    expect(state.autoPause.pauseCount).toBe(0);

    // Pause franche, puis micro-mouvements trop courts pour reprendre.
    const pausedOscillation: Segment[] = [];
    for (let index = 0; index < 3; index += 1) {
      pausedOscillation.push({ durationS: 5, speedMs: 1, stepS: 1 });
      pausedOscillation.push({ durationS: 10, speedMs: 0.1, stepS: 5 });
    }
    const afterPause = buildSequence([
      { durationS: 35, speedMs: 0, stepS: 5 },
      ...pausedOscillation,
      { durationS: 12, speedMs: 1, stepS: 1 },
    ]);
    const pausedTracker = new ActivityTracker({
      sport: 'trail',
      autoPause: {
        enabled: true,
        speedThresholdMs: 0.2,
        durationS: 30,
        resumeSpeedThresholdMs: 0.5,
        resumeDurationS: 10,
        maxFixGapS: 120,
      },
    });
    state = feed(pausedTracker, afterPause);

    expect(state.autoPause.pauseCount).toBe(1);
    expect(state.autoPause.resumeCount).toBe(1);
    expect(state.autoPaused).toBe(false);
    expect(pausedTracker.autoPauseEvents).toHaveLength(2);
  });

  it('ignore les fixes rejetés sans avancer ni reculer la détection', () => {
    const tracker = new ActivityTracker({
      sport: 'rando',
      autoPause: {
        enabled: true,
        speedThresholdMs: 0.2,
        durationS: 20,
        resumeSpeedThresholdMs: 0.5,
        resumeDurationS: 3,
        maxFixGapS: 120,
      },
    });

    const moving = buildSequence([{ durationS: 10, speedMs: 1, stepS: 1 }]);
    let state = feed(tracker, moving);
    const distanceBeforeRejections = state.distanceM;

    // Saut impossible (dt <= 2 s) puis précision insuffisante : les deux sont rejetés.
    state = tracker.addFix(at(11_500, 500, 10));
    state = tracker.addFix(at(12_000, distanceBeforeRejections, 10, 120));
    expect(state.rejected).toBe(2);
    expect(state.distanceM).toBe(distanceBeforeRejections);
    expect(state.autoPaused).toBe(false);
    expect(state.autoPause.stoppedS).toBe(0);

    // Un arrêt réel, postérieur aux rejets, finit par déclencher la pause.
    state = tracker.addFix(at(22_000, 10, 0));
    expect(state.autoPaused).toBe(false);
    // Le premier fix valide après les rejets a remis la temporisation à zéro.
    state = tracker.addFix(at(32_000, 10, 0));
    expect(state.autoPaused).toBe(false);
    state = tracker.addFix(at(42_000, 10, 0));
    expect(state.autoPaused).toBe(true);

    // Un fix rejeté « en mouvement » ne doit pas compter comme une reprise.
    state = tracker.addFix(at(43_000, 10, 10, 120));
    expect(state.rejected).toBe(3);
    expect(state.autoPaused).toBe(true);
    expect(state.autoPause.resumingS).toBe(0);

    // Le fix valide suivant le rejet ne compte pas le trou : la reprise exige
    // à nouveau toute la temporisation.
    state = tracker.addFix(at(44_000, 11, 1));
    expect(state.autoPaused).toBe(true);
    expect(state.autoPause.resumingS).toBe(0);
    state = tracker.addFix(at(45_000, 12, 1));
    expect(state.autoPaused).toBe(true);
    state = tracker.addFix(at(46_000, 13, 1));
    expect(state.autoPaused).toBe(true);
    state = tracker.addFix(at(47_000, 14, 1));
    expect(state.autoPaused).toBe(false);
    expect(state.autoPause.resumeCount).toBe(1);
  });

  it('traite une longue interruption comme une inconnue, jamais comme un arrêt', () => {
    const config = {
      enabled: true,
      speedThresholdMs: 0.2,
      durationS: 20,
      resumeSpeedThresholdMs: 0.5,
      resumeDurationS: 5,
      maxFixGapS: 30,
    };

    // Actif avant la coupure : rester actif, sans temporisation géante.
    const active = new ActivityTracker({ sport: 'rando', autoPause: config });
    let state = feed(
      active,
      buildSequence([
        { durationS: 10, speedMs: 1, stepS: 1, gapAfterS: 600 },
        { durationS: 5, speedMs: 1, stepS: 1 },
      ])
    );
    expect(state.autoPaused).toBe(false);
    expect(state.autoPause.pauseCount).toBe(0);
    expect(state.autoPause.stoppedS).toBe(0);

    // En pause avant la coupure : un premier fix en mouvement reprend.
    const paused = new ActivityTracker({ sport: 'rando', autoPause: config });
    state = feed(
      paused,
      buildSequence([
        { durationS: 30, speedMs: 0, stepS: 1, gapAfterS: 600 },
        { durationS: 2, speedMs: 1, stepS: 1 },
      ])
    );
    expect(state.autoPaused).toBe(false);
    expect(state.autoPause.resumeCount).toBe(1);
    expect(paused.autoPauseEvents.at(-1)).toMatchObject({
      type: 'resume',
      reason: 'gps-gap',
      afterS: 0,
    });

    // Actif puis coupure puis arrêt : le trou ne déclenche pas la pause à lui seul.
    const gapThenStop = new ActivityTracker({ sport: 'rando', autoPause: config });
    state = feed(
      gapThenStop,
      buildSequence([
        { durationS: 10, speedMs: 1, stepS: 1, gapAfterS: 600 },
        { durationS: 25, speedMs: 0, stepS: 5 },
      ])
    );
    expect(state.autoPause.pauseCount).toBe(1);
    expect(state.autoPause.stoppedS).toBe(20);
  });

  it('reconfigure le sport ou coupe la détection sans toucher aux métriques', () => {
    const tracker = new ActivityTracker({ sport: 'rando', autoPause: true });
    expect(tracker.autoPauseConfig.durationS).toBe(AUTO_PAUSE_BY_SPORT.rando.durationS);

    const before = feed(tracker, buildSequence([{ durationS: 10, speedMs: 1, stepS: 1 }]));
    const distance = before.distanceM;
    const movingS = before.movingS;

    tracker.setSport('velo');
    expect(tracker.autoPauseConfig.durationS).toBe(AUTO_PAUSE_BY_SPORT.velo.durationS);
    expect(tracker.autoPauseConfig.speedThresholdMs).toBe(
      AUTO_PAUSE_BY_SPORT.velo.speedThresholdMs
    );
    expect(tracker.state.distanceM).toBe(distance);
    expect(tracker.state.movingS).toBe(movingS);

    tracker.setAutoPause(false);
    expect(tracker.state.autoPause.enabled).toBe(false);
    expect(tracker.state.autoPaused).toBe(false);
    expect(tracker.state.distanceM).toBe(distance);
    expect(tracker.state.movingS).toBe(movingS);

    // Réarmement après une pause manuelle : l'état retombe, la configuration reste.
    const pausable = new ActivityTracker({
      sport: 'rando',
      autoPause: {
        enabled: true,
        speedThresholdMs: 0.2,
        durationS: 5,
        resumeSpeedThresholdMs: 0.5,
        resumeDurationS: 3,
        maxFixGapS: 120,
      },
    });
    expect(
      feed(pausable, buildSequence([{ durationS: 10, speedMs: 0, stepS: 1 }])).autoPaused
    ).toBe(true);
    pausable.resetAutoPause();
    expect(pausable.state.autoPaused).toBe(false);
    expect(pausable.autoPauseConfig.durationS).toBe(5);
  });
});
