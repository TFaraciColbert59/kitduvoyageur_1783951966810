import { describe, expect, it } from 'vitest';
import {
  ActivityTracker,
  AUTO_PAUSE_BY_SPORT,
  AUTO_PAUSE_DISABLED,
  autoPauseConfigForSport,
  averageSpeedKmh,
  MIN_MOVING_SPEED_MS,
  type AutoPauseConfig,
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

  it('ignore un fix plus ancien ou dupliqué sans faire reculer la borne', () => {
    const tracker = new ActivityTracker();
    tracker.addFix(at(10_000, 0, 1));
    let state = tracker.addFix(at(15_000, 10, 1));
    const distance = state.distanceM;

    // Fix mis en cache (maximumAge: 2000) livré après un point plus récent.
    state = tracker.addFix(at(12_000, 60, 1));
    expect(state.distanceM).toBeCloseTo(distance, 5);
    expect(state.lastFix?.t).toBe(15_000);
    expect(state.rejected).toBe(1);

    // Même horodatage : aucun intervalle de temps, donc aucune distance.
    state = tracker.addFix(at(15_000, 30, 1));
    expect(state.distanceM).toBeCloseTo(distance, 5);
    expect(state.lastFix?.t).toBe(15_000);
    expect(state.rejected).toBe(2);

    // Le fix suivant repart de la dernière borne valide, sans trou inventé.
    state = tracker.addFix(at(16_000, 15, 1));
    expect(state.distanceM).toBeCloseTo(distance + 5, 1);
  });
});

/* ------------------------------------------------------------------------- *
 * Auto-pause (S1.05) : séquences GPS synthétiques
 * ------------------------------------------------------------------------- */

const LAT0 = 45.92;
const LNG0 = 6.87;
const M_PER_DEG_LAT = 111320;

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

const MOTION_AUTO_PAUSE: AutoPauseConfig = {
  enabled: true,
  speedThresholdMs: 0.2,
  durationS: 20,
  resumeSpeedThresholdMs: 0.5,
  resumeDurationS: 5,
  maxFixGapS: 120,
};

function autoPause(overrides: Partial<AutoPauseConfig> = {}): AutoPauseConfig {
  return { ...MOTION_AUTO_PAUSE, ...overrides };
}

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

function at(t: number, distanceM: number, speedMs: number, acc = 5, ele = 1200): GpsFix {
  return {
    t,
    lat: LAT0 + distanceM / M_PER_DEG_LAT,
    lng: LNG0,
    ele,
    acc,
    speed: speedMs,
  };
}

interface FeedResult {
  state: ReturnType<ActivityTracker['addFix']>;
  pauses: number;
  resumes: number;
}

function feed(tracker: ActivityTracker, fixes: GpsFix[]): FeedResult {
  let state = tracker.state;
  let pauses = 0;
  let resumes = 0;
  for (const fix of fixes) {
    const wasPaused = state.autoPaused;
    state = tracker.addFix(fix);
    if (!wasPaused && state.autoPaused) pauses += 1;
    if (wasPaused && !state.autoPaused) resumes += 1;
  }
  return { state, pauses, resumes };
}

describe('explorer-v2 · auto-pause', () => {
  it('est désactivée par défaut et compatible avec l’historique', () => {
    const fixes = buildSequence([
      { durationS: 60, speedMs: 1.2, stepS: 5 },
      { durationS: 600, speedMs: 0, stepS: 10 },
      { durationS: 60, speedMs: 1.2, stepS: 5 },
    ]);

    const historical = feed(new ActivityTracker(), fixes);
    const disabled = feed(new ActivityTracker(AUTO_PAUSE_DISABLED), fixes);

    expect(disabled.state.distanceM).toBe(historical.state.distanceM);
    expect(disabled.state.movingS).toBe(historical.state.movingS);
    expect(disabled.state.elevGainM).toBe(historical.state.elevGainM);
    expect(disabled.state.rejected).toBe(historical.state.rejected);
    expect(disabled.state.autoPaused).toBe(false);
    expect(disabled.pauses).toBe(0);
    expect(AUTO_PAUSE_DISABLED.enabled).toBe(false);
  });

  it('active le profil par défaut et le coupe sur demande explicite', () => {
    // S1.05 : « laisser la fonction désactivable » ⇒ active tant que
    // l'utilisateur ne l'a pas coupée.
    expect(autoPauseConfigForSport('course').enabled).toBe(true);
    expect(autoPauseConfigForSport('course', false).enabled).toBe(false);
    expect(autoPauseConfigForSport('course', true).enabled).toBe(true);
    expect(autoPauseConfigForSport(null, true).enabled).toBe(false);
  });

  it('expose un profil cohérent pour chaque sport', () => {
    for (const sport of SPORT_IDS) {
      const profile = AUTO_PAUSE_BY_SPORT[sport];
      expect(profile.enabled, sport).toBe(true);
      expect(profile.durationS, sport).toBeGreaterThan(0);
      expect(profile.resumeSpeedThresholdMs, sport).toBeGreaterThanOrEqual(
        profile.speedThresholdMs
      );
      expect(profile.maxPlausibleSpeedMs, sport).toBeGreaterThan(
        profile.resumeSpeedThresholdMs
      );
    }

    // Les seuils historiques des sports lents ne sont pas remontés à 0,3 m/s :
    // le temps en mouvement est compté à leur seuil de reprise effectif.
    expect(AUTO_PAUSE_BY_SPORT.kayak.resumeSpeedThresholdMs).toBe(0.25);
    expect(AUTO_PAUSE_BY_SPORT.escalade.resumeSpeedThresholdMs).toBe(0.2);

    expect(AUTO_PAUSE_BY_SPORT.velo.durationS).toBeLessThan(AUTO_PAUSE_BY_SPORT.rando.durationS);
    expect(AUTO_PAUSE_BY_SPORT.velo.speedThresholdMs).toBeGreaterThan(
      AUTO_PAUSE_BY_SPORT.rando.speedThresholdMs
    );
  });

  it('garde les seuils du sport quand la détection est désactivée', () => {
    const off = autoPauseConfigForSport('course', false);
    expect(off.enabled).toBe(false);
    expect(off.maxFixGapS).toBe(AUTO_PAUSE_BY_SPORT.course.maxFixGapS);
    expect(off.maxPlausibleSpeedMs).toBe(AUTO_PAUSE_BY_SPORT.course.maxPlausibleSpeedMs);
  });

  it('applique le seuil et la temporisation propres à chaque sport', () => {
    for (const sport of SPORT_IDS) {
      const profile = AUTO_PAUSE_BY_SPORT[sport];
      const movingSpeed = Math.max(profile.resumeSpeedThresholdMs * 2, 0.8);
      const tracker = new ActivityTracker(profile);
      const result = feed(
        tracker,
        buildSequence([
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
        ])
      );

      expect(result.pauses, sport).toBe(1);
      expect(result.resumes, sport).toBe(1);
      expect(result.state.autoPaused, sport).toBe(false);
    }
  });

  it('détecte l’arrêt après la temporisation, pas avant', () => {
    const tracker = new ActivityTracker(autoPause({ durationS: 60 }));
    const fixes = buildSequence([
      { durationS: 10, speedMs: 1, stepS: 5 },
      { durationS: 70, speedMs: 0, stepS: 10 },
    ]);

    let state = tracker.state;
    for (const fix of fixes) {
      state = tracker.addFix(fix);
      if (fix.t === 60_000) expect(state.autoPaused).toBe(false);
    }

    expect(state.autoPaused).toBe(true);
  });

  it('ne reprend qu’après un mouvement continu au-dessus du seuil', () => {
    const tracker = new ActivityTracker(autoPause({ durationS: 20, resumeDurationS: 5 }));
    const fixes = buildSequence([
      { durationS: 10, speedMs: 1, stepS: 1 },
      { durationS: 30, speedMs: 0, stepS: 1 },
      { durationS: 7, speedMs: 1, stepS: 1 },
    ]);

    let state = tracker.state;
    for (const fix of fixes) {
      state = tracker.addFix(fix);
      if (fix.t === 44_000) expect(state.autoPaused).toBe(true);
      if (fix.t === 45_000) expect(state.autoPaused).toBe(false);
    }

    expect(state.autoPaused).toBe(false);
  });

  it('ne clignote pas quand la vitesse oscille autour des seuils', () => {
    const config = autoPause({ durationS: 30, resumeDurationS: 10 });
    const oscillation: Segment[] = [];
    for (let index = 0; index < 5; index += 1) {
      oscillation.push({ durationS: 20, speedMs: 0.1, stepS: 5 });
      oscillation.push({ durationS: 5, speedMs: 1, stepS: 1 });
    }

    const beforePause = feed(
      new ActivityTracker(config),
      buildSequence([{ durationS: 10, speedMs: 1, stepS: 1 }, ...oscillation])
    );
    expect(beforePause.pauses).toBe(0);

    const pausedOscillation: Segment[] = [];
    for (let index = 0; index < 3; index += 1) {
      pausedOscillation.push({ durationS: 5, speedMs: 1, stepS: 1 });
      pausedOscillation.push({ durationS: 10, speedMs: 0.1, stepS: 5 });
    }
    const afterPause = feed(
      new ActivityTracker(config),
      buildSequence([
        { durationS: 35, speedMs: 0, stepS: 5 },
        ...pausedOscillation,
        { durationS: 12, speedMs: 1, stepS: 1 },
      ])
    );

    expect(afterPause.pauses).toBe(1);
    expect(afterPause.resumes).toBe(1);
    expect(afterPause.state.autoPaused).toBe(false);
  });

  it('ignore les fixes rejetés sans avancer ni reculer la détection', () => {
    const tracker = new ActivityTracker(autoPause({ durationS: 20, resumeDurationS: 3 }));
    const moving = buildSequence([{ durationS: 10, speedMs: 1, stepS: 1 }]);
    let state = feed(tracker, moving).state;
    const distanceBeforeRejections = state.distanceM;

    // Saut impossible (dt <= 2 s) puis précision insuffisante : les deux sont rejetés.
    state = tracker.addFix(at(11_500, 500, 10));
    expect(state.accepted).toBe(false);
    state = tracker.addFix(at(12_000, distanceBeforeRejections, 10, 120));
    expect(state.accepted).toBe(false);
    expect(state.rejected).toBe(2);
    expect(state.distanceM).toBe(distanceBeforeRejections);
    expect(state.autoPaused).toBe(false);

    // Un arrêt réel, postérieur aux rejets, finit par déclencher la pause.
    state = tracker.addFix(at(22_000, 10, 0));
    expect(state.accepted).toBe(true);
    // Le premier fix valide après un rejet ouvre une nouvelle borne : le tracé
    // ne doit pas relier l'avant et l'après à travers le point rejeté.
    expect(state.discontinuity).toBe(true);
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

    // Le fix valide suivant le rejet ne compte pas le trou : la reprise exige
    // à nouveau toute la temporisation.
    state = tracker.addFix(at(44_000, 11, 1));
    expect(state.autoPaused).toBe(true);
    state = tracker.addFix(at(45_000, 12, 1));
    expect(state.autoPaused).toBe(true);
    state = tracker.addFix(at(46_000, 13, 1));
    expect(state.autoPaused).toBe(true);
    state = tracker.addFix(at(47_000, 14, 1));
    expect(state.autoPaused).toBe(false);
  });

  it('refuse un fix non monotone sans l’accepter ni reculer la borne', () => {
    const tracker = new ActivityTracker(autoPause({ durationS: 20 }));
    tracker.addFix(at(10_000, 0, 1));
    let state = tracker.addFix(at(15_000, 10, 1));
    const distance = state.distanceM;
    const lastFix = state.lastFix?.t;

    // Fix mis en cache livré après un point plus récent (`maximumAge`).
    state = tracker.addFix(at(12_000, 60, 1));
    expect(state.accepted).toBe(false);
    expect(state.rejected).toBe(1);
    expect(state.lastFix?.t).toBe(lastFix);
    expect(state.distanceM).toBe(distance);

    // Le fix valide suivant repart de la dernière borne, sans le point périmé.
    // Un simple retard de livraison ne coupe pas la continuité des métriques.
    state = tracker.addFix(at(16_000, 15, 1));
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(false);
    expect(state.distanceM).toBeCloseTo(distance + 5, 1);
  });

  it('utilise le temps mesuré et ne corrige que le saut d’horloge mural', () => {
    const tracker = new ActivityTracker(autoPause({ durationS: 20, maxFixGapS: 60 }));
    const fix = (t: number, distanceM: number, speedMs: number, receivedAt: number): GpsFix => ({
      ...at(t, distanceM, speedMs),
      receivedAt,
    });

    let state = tracker.addFix(fix(0, 0, 1, 0));
    state = tracker.addFix(fix(5_000, 5, 1, 1_000));
    // L'horloge murale saute de 30 s, mais la distance (5 m à 1 m/s) prouve
    // que l'intervalle mesuré est faux : on le ramène à 1 s.
    state = tracker.addFix(fix(35_000, 10, 1, 2_000));

    expect(state.autoPaused).toBe(false);
    // 5 s réellement mesurées + 1 s après correction du saut.
    expect(state.movingS).toBeCloseTo(6, 5);
    expect(state.distanceM).toBeCloseTo(10, 1);
  });

  it('n’invente pas une pause sur un saut d’horloge mural', () => {
    const tracker = new ActivityTracker(autoPause({ durationS: 20, maxFixGapS: 60 }));
    const fix = (t: number, distanceM: number, receivedAt: number): GpsFix => ({
      ...at(t, distanceM, 1),
      receivedAt,
    });

    tracker.addFix(fix(0, 0, 0));
    let state = tracker.addFix(fix(5_000, 5, 1_000));
    state = tracker.addFix(fix(35_000, 10, 2_000));

    // 5 m parcourus alors que l'horloge murale annonce 30 s : saut corrigé,
    // aucune temporisation d'arrêt ne doit être inventée.
    expect(state.autoPaused).toBe(false);
  });

  it('n’invente pas une pause sur un saut d’horloge mural à l’arrêt', () => {
    const tracker = new ActivityTracker(autoPause({ durationS: 20, maxFixGapS: 60 }));
    const fix = (t: number, receivedAt: number): GpsFix => ({
      ...at(t, 0, 0),
      receivedAt,
    });

    tracker.addFix(fix(0, 0));
    let state = tracker.addFix(fix(5_000, 1_000));
    // 30 s annoncées par l'horloge murale, 1 s réellement reçue, aucune
    // distance : c'est un saut d'horloge, pas 30 s d'arrêt.
    state = tracker.addFix(fix(35_000, 2_000));
    expect(state.autoPaused).toBe(false);
  });

  it('corrige un saut d’horloge avant en mouvement sans vitesse rapportée', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_BY_SPORT.rando);
    let state = tracker.addFix({ ...at(0, 0, 1), speed: null, receivedAt: 0 });
    // 20 m annoncés par l'horloge murale sur 30 s, mais reçus en 5 s : le
    // rapport est massif et la réception a réellement duré, donc c'est un saut.
    state = tracker.addFix({
      ...at(30_000, 20, 1),
      speed: null,
      receivedAt: 5_000,
    });
    expect(state.rejected).toBe(0);
    expect(state.distanceM).toBeCloseTo(20, 1);
    expect(state.movingS).toBeCloseTo(5, 5);
  });

  it('ne transforme pas une rafale de livraison en saut GPS', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_BY_SPORT.course);
    const fix = (t: number, distanceM: number, receivedAt: number): GpsFix => ({
      ...at(t, distanceM, 7.5),
      receivedAt,
    });

    tracker.addFix(fix(0, 0, 0));
    // Trois fixes mesurés à 20 s d'intervalle, livrés à 1 ms d'écart.
    let state = tracker.addFix(fix(20_000, 150, 1));
    expect(state.accepted).toBe(true);
    expect(state.movingS).toBeCloseTo(20, 5);
    expect(state.distanceM).toBeCloseTo(150, 0);

    state = tracker.addFix(fix(40_000, 300, 2));
    expect(state.accepted).toBe(true);
    expect(state.movingS).toBeCloseTo(40, 5);
    expect(state.distanceM).toBeCloseTo(300, 0);
  });

  it('déclenche la pause sur une station immobile livrée en rafale', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_BY_SPORT.rando);
    let state = tracker.state;
    // 160 s d'arrêt réel, mais les neuf callbacks arrivent dans la même
    // milliseconde : le temps mesuré doit rester la référence.
    for (let index = 0; index <= 8; index += 1) {
      state = tracker.addFix({
        ...at(index * 20_000, 0, 0),
        receivedAt: index,
      });
    }
    expect(state.rejected).toBe(0);
    expect(state.autoPaused).toBe(true);
  });

  it('ne gèle pas un déplacement lent livré en rafale', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_BY_SPORT.rando);
    let state = tracker.state;
    for (let index = 0; index <= 5; index += 1) {
      state = tracker.addFix({
        ...at(index * 20_000, index * 9, 0.45),
        receivedAt: index,
      });
    }
    // 45 m en 100 s : aucune raison de rejeter ni de perdre la durée.
    expect(state.rejected).toBe(0);
    expect(state.distanceM).toBeCloseTo(45, 0);
    expect(state.movingS).toBeCloseTo(100, 5);
    expect(state.autoPaused).toBe(false);
  });

  it('compte la durée mesurée quand receivedAt ne bouge pas', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_BY_SPORT.kayak);
    // Kayak : 5 m en 20 s, deux callbacks dans la même milliseconde. Le
    // seuil de reprise du sport (0,25 m/s) doit alimenter movingS.
    let state = tracker.addFix({ ...at(0, 0, 0.25), receivedAt: 1_000 });
    state = tracker.addFix({ ...at(20_000, 5, 0.25), receivedAt: 1_000 });
    expect(state.distanceM).toBeCloseTo(5, 1);
    expect(state.movingS).toBeCloseTo(20, 5);
    expect(averageSpeedKmh(state)).not.toBeNull();
  });

  it('n’utilise pas receivedAt quand il n’est présent que d’un côté', () => {    const tracker = new ActivityTracker(AUTO_PAUSE_DISABLED);
    tracker.addFix({ ...at(0, 0, 1), receivedAt: 0 });
    let state = tracker.addFix(at(5_000, 5, 1));
    expect(state.movingS).toBeCloseTo(5, 5);

    state = tracker.addFix({ ...at(10_000, 10, 1), receivedAt: 1_000 });
    // L'intervalle mesuré (5 s) reste la référence : on ne mélange pas une
    // horloge de réception avec un fix qui n'en a pas.
    expect(state.movingS).toBeCloseTo(10, 5);
  });

  it('reprend après un saut d’horloge murale vers l’arrière', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_DISABLED);
    tracker.addFix(at(3_600_000, 0, 1));
    let state = tracker.addFix(at(3_601_000, 10, 1));
    const distance = state.distanceM;

    // Premier fix dans l'époque basse : point périmé probable, rejeté.
    state = tracker.addFix(at(1_000, 20, 1));
    expect(state.accepted).toBe(false);
    expect(state.distanceM).toBe(distance);

    // Deuxième fix consécutif dans l'époque basse : l'horloge a reculé d'une
    // heure. Il devient la nouvelle borne, sans compter le trou.
    state = tracker.addFix(at(6_000, 30, 1));
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(true);
    expect(state.distanceM).toBe(distance);

    // Le fix suivant repart de la nouvelle époque : l'activité n'est plus gelée.
    state = tracker.addFix(at(11_000, 35, 1));
    expect(state.accepted).toBe(true);
    expect(state.distanceM).toBeCloseTo(distance + 5, 1);
    expect(state.movingS).toBeGreaterThan(0);
  });

  it('ne fait pas traverser le D+ par un trou sans altitude', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_BY_SPORT.course);
    tracker.addFix({ ...at(0, 0, 1), ele: 1000 });
    let state = tracker.addFix({ ...at(5_000, 5, 1), ele: 1010 });
    const gainBeforeGap = state.elevGainM;
    expect(gainBeforeGap).toBeGreaterThan(0);

    // Trou > maxFixGapS, sans altitude : nouvelle borne, D+ inchangé.
    state = tracker.addFix({ ...at(70_000, 100, 1), ele: null });
    expect(state.discontinuity).toBe(true);
    expect(state.elevGainM).toBe(gainBeforeGap);

    // L'altitude élevée qui arrive ensuite devient la nouvelle référence,
    // elle n'ajoute pas les 490 m du trou.
    state = tracker.addFix({ ...at(75_000, 105, 1), ele: 1500 });
    expect(state.elevGainM).toBeCloseTo(gainBeforeGap, 5);
  });

  it('garde la discontinuité du dernier fix accepté après un rejet', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_BY_SPORT.course);
    tracker.addFix(at(0, 0, 1));
    // Trou > maxFixGapS du sport : la borne est acceptée et coupe le tracé.
    let state = tracker.addFix(at(65_000, 100, 1));
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(true);

    // Un fix plus ancien est rejeté ; `discontinuity` décrit toujours le
    // dernier fix accepté, pas le rejet.
    state = tracker.addFix(at(60_000, 90, 1));
    expect(state.accepted).toBe(false);
    expect(state.discontinuity).toBe(true);
  });

  it('rejette un saut invraisemblable même quand la pause automatique est désactivée', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_DISABLED);
    tracker.addFix(at(0, 0, 1));
    const state = tracker.addFix(at(30_000, 500, 1));
    expect(state.accepted).toBe(false);
    expect(state.rejected).toBe(1);
    expect(state.distanceM).toBe(0);
  });

  it('rejette les valeurs non finies sans empoisonner les métriques', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_DISABLED);
    tracker.addFix(at(0, 0, 1));

    let state = tracker.addFix({ ...at(5_000, 5, 1), acc: Number.NaN });
    expect(state.accepted).toBe(false);
    expect(state.rejected).toBe(1);
    expect(state.distanceM).toBe(0);

    // Une altitude non finie est ignorée comme une altitude absente. Ce
    // premier fix après le rejet ouvre une nouvelle borne : pas de distance.
    state = tracker.addFix({ ...at(10_000, 10, 1), ele: Number.NaN });
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(true);
    expect(Number.isFinite(state.elevGainM)).toBe(true);

    state = tracker.addFix(at(15_000, 15, 1));
    expect(state.accepted).toBe(true);
    expect(state.distanceM).toBeCloseTo(5, 1);

    state = tracker.addFix({ ...at(20_000, 20, 1), lat: 91 });
    expect(state.accepted).toBe(false);
    state = tracker.addFix({ ...at(25_000, 25, 1), lng: -181 });
    expect(state.accepted).toBe(false);

    state = tracker.addFix({ ...at(30_000, 30, 1), speed: Number.NaN });
    expect(state.accepted).toBe(true);
    expect(Number.isFinite(state.movingS)).toBe(true);
    expect(Number.isFinite(state.distanceM)).toBe(true);
    state = tracker.addFix(at(35_000, 35, 1));
    expect(Number.isFinite(state.distanceM)).toBe(true);
  });

  it('accepte une configuration partielle sans produire NaN', () => {
    const tracker = new ActivityTracker({ enabled: true, durationS: 5, resumeDurationS: 1 });
    tracker.addFix(at(0, 0, 1));
    let state = tracker.addFix(at(5_000, 5, 1));
    expect(state.distanceM).toBeCloseTo(5, 1);
    expect(state.movingS).toBeCloseTo(5, 5);

    for (let t = 10; t <= 20; t += 5) {
      state = tracker.addFix(at(t * 1000, 5, 0));
    }
    expect(state.autoPaused).toBe(true);

    // L'ancien normalizeConfig produisait Math.max(undefined, 0.3) = NaN et
    // la pause ne reprenait jamais.
    state = tracker.addFix(at(21_000, 6, 1));
    expect(state.autoPaused).toBe(false);
    state = tracker.addFix(at(22_000, 7, 1));
    expect(state.distanceM).toBeGreaterThan(5);
  });

  it('rejette un saut de 120 m en 3 s et de 500 m en 30 s', () => {
    const course = new ActivityTracker(AUTO_PAUSE_BY_SPORT.course);
    course.addFix(at(0, 0, 1));
    let state = course.addFix(at(3_000, 120, 1));
    expect(state.accepted).toBe(false);
    expect(state.distanceM).toBe(0);

    const rando = new ActivityTracker(AUTO_PAUSE_BY_SPORT.rando);
    rando.addFix(at(0, 0, 1));
    state = rando.addFix(at(30_000, 500, 1));
    expect(state.accepted).toBe(false);
    expect(state.distanceM).toBe(0);
    // Le fix suivant ouvre une nouvelle borne : le saut n'est jamais dessiné
    // ni compté, et l'activité continue.
    state = rando.addFix(at(31_000, 505, 1));
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(true);
    expect(state.distanceM).toBe(0);
    state = rando.addFix(at(32_000, 510, 1));
    expect(state.distanceM).toBeCloseTo(5, 1);
  });

  it('préserve les seuils de reprise lents du kayak et de l’escalade', () => {
    const cases: Array<{ sport: 'kayak' | 'escalade'; speed: number }> = [
      { sport: 'kayak', speed: 0.26 },
      { sport: 'escalade', speed: 0.21 },
    ];

    for (const { sport, speed } of cases) {
      const config = AUTO_PAUSE_BY_SPORT[sport];
      expect(config.resumeSpeedThresholdMs).toBeLessThan(MIN_MOVING_SPEED_MS);
      const tracker = new ActivityTracker(config);

      let state = tracker.addFix(at(0, 0, 1));
      for (let t = 5; t <= config.durationS + 10; t += 5) {
        state = tracker.addFix(at(t * 1000, 0, 0));
      }
      expect(state.autoPaused, sport).toBe(true);
      const frozenDistance = state.distanceM;
      const frozenMoving = state.movingS;

      // Reprise sous 0,3 m/s : le seuil historique du sport s'applique, et le
      // temps en mouvement est compté à ce même seuil (pas d'allure nulle).
      let distance = 0;
      let t = config.durationS + 15;
      for (let index = 0; index <= config.resumeDurationS; index += 1) {
        distance += speed * 1;
        state = tracker.addFix(at(t * 1000, distance, speed));
        t += 1;
      }
      expect(state.autoPaused, sport).toBe(false);
      expect(state.distanceM, sport).toBeGreaterThan(frozenDistance);
      expect(state.movingS, sport).toBeGreaterThan(frozenMoving);
      expect(averageSpeedKmh(state), sport).not.toBeNull();
    }
  });

  it('compte le temps en mouvement au seuil exact de 0,3 m/s', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_DISABLED);
    tracker.addFix(at(0, 0, 1));
    const state = tracker.addFix(at(5_000, 1.5, MIN_MOVING_SPEED_MS));
    expect(state.movingS).toBeCloseTo(5, 5);
  });

  it('traite une longue interruption comme une inconnue, jamais comme un arrêt', () => {
    const config = autoPause({ durationS: 20, maxFixGapS: 30 });

    const active = feed(
      new ActivityTracker(config),
      buildSequence([
        { durationS: 10, speedMs: 1, stepS: 1, gapAfterS: 600 },
        { durationS: 5, speedMs: 1, stepS: 1 },
      ])
    );
    expect(active.pauses).toBe(0);

    const paused = feed(
      new ActivityTracker(config),
      buildSequence([
        { durationS: 30, speedMs: 0, stepS: 1, gapAfterS: 600 },
        { durationS: 2, speedMs: 1, stepS: 1 },
      ])
    );
    expect(paused.pauses).toBe(1);
    expect(paused.resumes).toBe(1);
    expect(paused.state.autoPaused).toBe(false);

    // Actif puis coupure puis arrêt : le trou ne déclenche pas la pause à lui seul.
    const gapThenStop = feed(
      new ActivityTracker(config),
      buildSequence([
        { durationS: 10, speedMs: 1, stepS: 1, gapAfterS: 600 },
        { durationS: 25, speedMs: 0, stepS: 5 },
      ])
    );
    expect(gapThenStop.pauses).toBe(1);
  });

  it('repart d’une nouvelle borne après une pause manuelle plus courte que maxFixGapS', () => {
    // 1. Métriques : le premier fix après la pause ne compte ni distance,
    // ni temps de mouvement, ni dénivelé du trou.
    const metricsTracker = new ActivityTracker(autoPause({ durationS: 20, maxFixGapS: 120 }));
    const before = feed(
      metricsTracker,
      buildSequence([{ durationS: 10, speedMs: 1, stepS: 1 }])
    ).state;
    const distance = before.distanceM;
    const movingS = before.movingS;
    const elevGain = before.elevGainM;

    metricsTracker.breakContinuity();
    let state = metricsTracker.addFix(at(18_000, distance + 50, 1, 5, 1300));
    expect(state.distanceM).toBe(distance);
    expect(state.movingS).toBe(movingS);
    expect(state.elevGainM).toBe(elevGain);
    expect(state.lastFix?.t).toBe(18_000);
    expect(state.autoPaused).toBe(false);

    // 2. Temporisation : la pause manuelle de 8 s (< 120 s) n'est pas comptée.
    const timerTracker = new ActivityTracker(autoPause({ durationS: 20, maxFixGapS: 120 }));
    feed(timerTracker, buildSequence([{ durationS: 10, speedMs: 1, stepS: 1 }]));
    timerTracker.breakContinuity();
    state = timerTracker.addFix(at(18_000, 60, 0, 5, 1300));

    for (let t = 19; t <= 33; t += 1) {
      state = timerTracker.addFix(at(t * 1000, 60, 0, 5, 1300));
    }
    expect(state.autoPaused).toBe(false);

    for (let t = 34; t <= 39; t += 1) {
      state = timerTracker.addFix(at(t * 1000, 60, 0, 5, 1300));
    }
    expect(state.autoPaused).toBe(true);

    // La pause manuelle prend le relais et efface l'état automatique.
    timerTracker.breakContinuity();
    expect(timerTracker.state.autoPaused).toBe(false);
  });

  it('ignore un fix périmé à la reprise manuelle', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_DISABLED);
    tracker.addFix(at(10_000, 0, 1));
    let state = tracker.addFix(at(15_000, 10, 1));
    const distance = state.distanceM;

    tracker.breakContinuity();
    // Point mis en cache avant la pause, livré après la reprise : il ne doit
    // pas devenir la nouvelle borne.
    state = tracker.addFix(at(14_000, 100, 1));
    expect(state.accepted).toBe(false);
    expect(state.distanceM).toBe(distance);

    // Le premier fix réellement plus récent ouvre la nouvelle borne.
    state = tracker.addFix(at(16_000, 105, 1));
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(true);
    expect(state.distanceM).toBe(distance);

    state = tracker.addFix(at(17_000, 110, 1));
    expect(state.distanceM).toBeCloseTo(distance + 5, 1);
  });

  it('gèle les métriques pendant la pause automatique puis repart de la dernière position', () => {
    const tracker = new ActivityTracker(
      autoPause({ durationS: 20, resumeSpeedThresholdMs: 0.5, resumeDurationS: 3, maxFixGapS: 60 })
    );

    let state = tracker.addFix(at(0, 0, 1));
    state = tracker.addFix(at(5_000, 5, 1));
    state = tracker.addFix(at(10_000, 10, 1));

    // 20 s d'arrêt : la pause se déclenche à 30 s.
    for (let t = 15; t <= 40; t += 5) {
      state = tracker.addFix(at(t * 1000, 10, 0, 5, 1200));
    }
    expect(state.autoPaused).toBe(true);

    // Pendant la pause, les fixes continuent d'arriver et dérivent : aucune
    // métrique ne doit bouger.
    const frozen = tracker.state;
    state = tracker.addFix(at(45_000, 50, 0, 5, 1300));
    state = tracker.addFix(at(50_000, 70, 0, 5, 1300));
    expect(state.distanceM).toBe(frozen.distanceM);
    expect(state.movingS).toBe(frozen.movingS);
    expect(state.elevGainM).toBe(frozen.elevGainM);
    expect(state.lastFix?.t).toBe(50_000);

    // Reprise : 3 s de mouvement au-dessus du seuil, puis une nouvelle borne.
    state = tracker.addFix(at(55_000, 71, 1, 5, 1300));
    expect(state.autoPaused).toBe(false);
    expect(state.distanceM).toBe(frozen.distanceM);
    state = tracker.addFix(at(60_000, 76, 1, 5, 1300));
    expect(state.distanceM).toBeCloseTo(frozen.distanceM + 5, 1);
    expect(state.movingS).toBeCloseTo(frozen.movingS + 5, 1);
  });

  it('ne déduit pas une reprise d’une interruption GPS sans vitesse rapportée', () => {
    const tracker = new ActivityTracker(
      autoPause({ durationS: 5, resumeDurationS: 3, maxFixGapS: 30 })
    );
    tracker.addFix(at(0, 0, 1));
    let state = tracker.addFix(at(5_000, 0, 0));
    expect(state.autoPaused).toBe(true);

    // Le trou est long et la position a beaucoup bougé, mais aucune vitesse
    // n'est rapportée : la pause ne doit pas se lever sur cette seule preuve.
    state = tracker.addFix({ ...at(60_000, 500, 1), speed: null });
    expect(state.autoPaused).toBe(true);
    expect(state.distanceM).toBe(0);

    // La reprise exige à nouveau un mouvement continu rapporté.
    state = tracker.addFix(at(61_000, 501, 1));
    expect(state.autoPaused).toBe(true);
    state = tracker.addFix(at(62_000, 502, 1));
    state = tracker.addFix(at(63_000, 503, 1));
    state = tracker.addFix(at(64_000, 504, 1));
    expect(state.autoPaused).toBe(false);
  });

  it('ne compte pas un trou après un rejet quand la pause automatique est désactivée', () => {
    const tracker = new ActivityTracker(AUTO_PAUSE_DISABLED);
    tracker.addFix(at(0, 0, 1));
    let state = tracker.addFix({ ...at(1_000, 50, 1), acc: 120 });
    expect(state.accepted).toBe(false);
    expect(state.rejected).toBe(1);

    // Le premier fix valide après le rejet est une nouvelle borne, même si le
    // trou dépasse maxFixGapS et que la détection est coupée.
    state = tracker.addFix(at(200_000, 1_000, 1));
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(true);
    expect(state.distanceM).toBe(0);
    expect(state.movingS).toBe(0);
    expect(state.lastFix?.t).toBe(200_000);

    state = tracker.addFix(at(201_000, 1_005, 1));
    expect(state.distanceM).toBeCloseTo(5, 1);
    expect(state.movingS).toBeCloseTo(1, 5);
  });

  it('ne compte pas une interruption GPS comme du mouvement, mais la garde historique désactivée', () => {
    const enabled = new ActivityTracker(autoPause({ maxFixGapS: 30 }));
    let state = enabled.addFix(at(0, 0, 1));
    state = enabled.addFix(at(5_000, 5, 1));
    const beforeGap = state;

    state = enabled.addFix(at(70_000, 1_005, 1));
    expect(state.accepted).toBe(true);
    expect(state.discontinuity).toBe(true);
    expect(state.distanceM).toBe(beforeGap.distanceM);
    expect(state.movingS).toBe(beforeGap.movingS);
    expect(state.elevGainM).toBe(beforeGap.elevGainM);
    expect(state.lastFix?.t).toBe(70_000);

    // Le fix suivant repart de la nouvelle borne.
    state = enabled.addFix(at(71_000, 1_010, 1));
    expect(state.discontinuity).toBe(false);
    expect(state.distanceM).toBeCloseTo(beforeGap.distanceM + 5, 1);

    // Option désactivée : le comportement historique compte le trou tel quel,
    // mais un saut physiquement impossible reste rejeté (voir test dédié).
    const historical = new ActivityTracker(AUTO_PAUSE_DISABLED);
    historical.addFix(at(0, 0, 1));
    historical.addFix(at(5_000, 5, 1));
    state = historical.addFix(at(70_000, 105, 1));
    expect(state.distanceM).toBeGreaterThan(95);
    expect(state.distanceM).toBeLessThan(110);
    expect(state.autoPaused).toBe(false);
  });
});
