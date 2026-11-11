import { describe, expect, it } from 'vitest';
import { PACE_MIN_SESSIONS, PACE_WINDOW, paceToBrief, realPace, type PaceSession } from '../engine/brief/pace';
import { briefForStorage, briefSchema, emptyBrief, isStorable } from '../engine/brief/schema';

/** Sortie à vitesse brute `kmh` sur `km` km, terminée `day` jours après le 1er janvier. */
function s(kmh: number, day: number, gain: number | null = 0, km = 10): PaceSession {
  return {
    distanceKm: km,
    durationMin: (km / kmh) * 60,
    elevationGainM: gain,
    endedAt: new Date(Date.UTC(2026, 0, 1 + day)).toISOString(),
  };
}

describe('realPace', () => {
  it('plancher : 2 sorties donnent null, 3 donnent une allure', () => {
    expect(PACE_MIN_SESSIONS).toBe(3);
    expect(realPace([s(4, 1), s(4, 2)])).toBeNull();
    expect(realPace([s(4, 1), s(4, 2), s(4, 3)])?.allureKmH).toBe(4);
  });

  it('liste vide : null', () => {
    expect(realPace([])).toBeNull();
  });

  it('médiane insensible à une valeur aberrante', () => {
    const r = realPace([s(4, 1), s(4.2, 2), s(3.8, 3), s(19, 4), s(4.1, 5)]);
    expect(r?.allureKmH).toBe(4.1);
  });

  it('ne garde que les 10 plus récentes', () => {
    const old = Array.from({ length: 5 }, (_, i) => s(10, i));
    const recent = Array.from({ length: PACE_WINDOW }, (_, i) => s(4, 100 + i));
    const r = realPace([...old, ...recent]);
    expect(r?.sessions).toBe(10);
    expect(r?.allureKmH).toBe(4);
  });

  it('les sorties sans date passent en dernier', () => {
    const undated = Array.from({ length: 10 }, () => ({ ...s(12, 0), endedAt: null }));
    const dated = [s(4, 1), s(4, 2), s(4, 3)];
    const r = realPace([...undated, ...dated]);
    expect(r?.sessions).toBe(10);
    // 3 datées à 4 + 7 sans date à 12 : médiane des 10 = 12
    expect(r?.allureKmH).toBe(12);
    const few = realPace([...undated.slice(0, 2), ...dated]);
    expect(few?.allureKmH).toBe(4);
  });

  it('écarte un enregistrement en véhicule (> 20 km/h)', () => {
    expect(realPace([s(4, 1), s(4, 2), s(60, 3)])).toBeNull();
    expect(realPace([s(4, 1), s(4, 2), s(4, 3), s(60, 4)])?.sessions).toBe(3);
  });

  it('écarte les sorties trop lentes, trop courtes ou trop brèves', () => {
    const slow = s(0.5, 1);
    const shortKm: PaceSession = { ...s(4, 2), distanceKm: 0.5, durationMin: 7.5 };
    const brief: PaceSession = { ...s(4, 3), distanceKm: 1, durationMin: 9 };
    expect(realPace([slow, shortKm, brief, s(4, 4), s(4, 5)])).toBeNull();
  });

  it('écarte null et NaN', () => {
    const bad: PaceSession[] = [
      { distanceKm: null, durationMin: 60, elevationGainM: 0, endedAt: null },
      { distanceKm: 5, durationMin: null, elevationGainM: 0, endedAt: null },
      { distanceKm: NaN, durationMin: 60, elevationGainM: 0, endedAt: null },
      { distanceKm: 5, durationMin: Infinity, elevationGainM: 0, endedAt: null },
    ];
    expect(realPace([...bad, s(4, 1), s(4, 2)])).toBeNull();
    expect(realPace([...bad, s(4, 1), s(4, 2), s(4, 3)])?.sessions).toBe(3);
  });

  it('un D+ NaN ou null compte comme absent, sans écarter la sortie', () => {
    const r = realPace([s(4, 1, NaN), s(4, 2, null), s(4, 3, 0)]);
    expect(r?.allureKmH).toBe(4);
  });

  it('la montée ralentit la vitesse brute mais pas le plat équivalent', () => {
    // 12 km en 4 h dont 600 m de D+ : brut 3 km/h, plat équivalent 12 / 3 = 4 km/h
    const climb = (d: number): PaceSession => ({
      distanceKm: 12,
      durationMin: 240,
      elevationGainM: 600,
      endedAt: new Date(Date.UTC(2026, 0, d)).toISOString(),
    });
    const r = realPace([climb(1), climb(2), climb(3)]);
    expect(r?.allureKmH).toBe(4);
    expect(12 / 4).toBe(3);
  });

  it('temps restant <= 0 : vitesse brute', () => {
    // 5 km en 1 h avec 1200 m de D+ : montée = 2 h > 1 h
    const x = (d: number): PaceSession => ({
      distanceKm: 5,
      durationMin: 60,
      elevationGainM: 1200,
      endedAt: new Date(Date.UTC(2026, 0, d)).toISOString(),
    });
    expect(realPace([x(1), x(2), x(3)])?.allureKmH).toBe(5);
  });

  it('arrondit l’allure à 0,1', () => {
    const r = realPace([s(4.07, 1), s(4.07, 2), s(4.07, 3)]);
    expect(r?.allureKmH).toBe(4.1);
  });

  it('deniveleParHeure null sans assez de sorties pentues', () => {
    // pente 600 m / 10 km = 6 % : trop douce
    expect(realPace([s(4, 1, 600), s(4, 2, 600), s(4, 3, 600)])?.deniveleParHeure).toBeNull();
    // 2 sorties pentues seulement
    const steep = (d: number) => s(3, d, 500, 5);
    expect(realPace([steep(1), steep(2), s(4, 3, 0)])?.deniveleParHeure).toBeNull();
    // D+ < 300 m
    const low = (d: number) => s(3, d, 250, 2);
    expect(realPace([low(1), low(2), low(3)])?.deniveleParHeure).toBeNull();
  });

  it('deniveleParHeure : médiane D+/heure arrondie à 10 m', () => {
    // 5 km à 2,5 km/h = 2 h, 500 m : 250 m/h (pente 10 %)
    const steep = (d: number, gain: number) => s(2.5, d, gain, 5);
    const r = realPace([steep(1, 500), steep(2, 507), steep(3, 520)]);
    expect(r?.deniveleParHeure).toBe(250);
  });

  it('bornes : allure et dénivelé restent dans le domaine du schéma', () => {
    const fast = realPace([s(19.9, 1), s(19.9, 2), s(19.9, 3)]);
    expect(fast!.allureKmH).toBeLessThanOrEqual(20);
    const climber = (d: number) => s(1.1, d, 8000, 2);
    const r = realPace([climber(1), climber(2), climber(3)]);
    expect(r!.deniveleParHeure).toBeLessThanOrEqual(2000);
    expect(r!.allureKmH).toBeGreaterThanOrEqual(1);
    expect(r!.allureKmH).toBeLessThanOrEqual(20);
  });
});

describe('paceToBrief', () => {
  it('null donne emptyBrief()', () => {
    expect(paceToBrief(null)).toEqual(emptyBrief());
  });

  it('est conforme à briefSchema, de source historique, sans citation ni verrou', () => {
    const b = paceToBrief({ allureKmH: 4.2, deniveleParHeure: 350, sessions: 4 });
    expect(briefSchema.safeParse(b).success).toBe(true);
    for (const v of [b.qui.allureKmH, b.qui.deniveleParHeure]) {
      expect(v.source).toBe('historique');
      expect(v.evidence).toBeNull();
      expect(v.locked).toBe(false);
    }
    expect(b.qui.allureKmH.value).toBe(4.2);
    expect(b.qui.deniveleParHeure.value).toBe(350);
  });

  it('marque les valeurs privées et rien n’est rangeable', () => {
    const pace = { allureKmH: 4.2, deniveleParHeure: 350, sessions: 4 };
    const b = paceToBrief(pace);
    expect(b.qui.allureKmH.prive).toBe(true);
    expect(b.qui.deniveleParHeure.prive).toBe(true);
    expect(briefForStorage(b)).toEqual(emptyBrief());
    expect(isStorable(b)).toBe(false);
  });

  it('confiance : 0,6 pour 3 à 5 sorties, 0,8 dès 6', () => {
    expect(paceToBrief({ allureKmH: 4, deniveleParHeure: null, sessions: 3 }).qui.allureKmH.confidence).toBe(0.6);
    expect(paceToBrief({ allureKmH: 4, deniveleParHeure: null, sessions: 5 }).qui.allureKmH.confidence).toBe(0.6);
    expect(paceToBrief({ allureKmH: 4, deniveleParHeure: null, sessions: 6 }).qui.allureKmH.confidence).toBe(0.8);
  });

  it('sans dénivelé horaire, cette variable reste absente', () => {
    const b = paceToBrief({ allureKmH: 4, deniveleParHeure: null, sessions: 4 });
    expect(b.qui.deniveleParHeure).toEqual(emptyBrief().qui.deniveleParHeure);
    expect(briefSchema.safeParse(b).success).toBe(true);
  });
});
