import { describe, expect, it } from 'vitest';
import {
  ACCLIMATISATION_FROM_M,
  ACCLIMATISATION_SOURCE,
  MAX_SLEEP_GAIN_M,
  REST_AFTER_NIGHTS,
  acclimatisationNote,
  checkSleepingProfile,
  sleepNightsOf,
  sleepOvershootM,
} from '../engine/acclimatisation';
import { planItinerary, type AreaPlace } from '../engine/itinerary';

/**
 * Plan 4.5 : acclimatation en alpinisme (paliers d'altitude). Règle publique
 * lue dans le consensus de la commission médicale de l'UIAA (2012) : au-dessus
 * de 2 500 m, la nuit suivante n'est pas plus haute de plus de 300 à 500 m, et
 * deux nuits à la même altitude après 2 à 4 jours de montée. Sans réseau.
 */

/** Une file de lieux de 5 km en 5 km vers l'est, `ele(c)` donne l'altitude repère de la colonne c. */
function line(opts: { cols: number; rows?: number; lat0?: number; ele: (c: number) => number | null; kind?: AreaPlace['kind'] }): AreaPlace[] {
  const lat0 = opts.lat0 ?? 45.9;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const out: AreaPlace[] = [];
  for (let c = 0; c < opts.cols; c += 1)
    for (let r = 0; r < (opts.rows ?? 2); r += 1)
      out.push({
        id: `n${String(c).padStart(2, '0')}${r}`,
        name: `Lieu ${c}-${r}`,
        lat: lat0 + (r * 2) / 111,
        lon: 7 + (c * 5) / (111 * k),
        kind: opts.kind ?? 'hamlet',
        population: null,
        eleM: opts.ele(c),
      });
  return out;
}

describe('la source de la règle', () => {
  it('est lue, datée et donnée avec son lien', () => {
    expect(ACCLIMATISATION_SOURCE.url).toMatch(/^https:\/\/www\.theuiaa\.org\/.+\.pdf$/);
    expect(ACCLIMATISATION_SOURCE.readOn).toBe('2026-10-11');
    expect(ACCLIMATISATION_SOURCE.year).toBe(2012);
    expect(ACCLIMATISATION_SOURCE.quote).toContain('300-500m higher than the previous one');
    expect(ACCLIMATISATION_SOURCE.quote).toContain('after every 2-4 days of ascent');
  });

  it('les seuils sont ceux de la source', () => {
    expect(ACCLIMATISATION_FROM_M).toBe(2500);
    expect(MAX_SLEEP_GAIN_M).toBe(500);
    expect(REST_AFTER_NIGHTS).toBeGreaterThanOrEqual(2);
    expect(REST_AFTER_NIGHTS).toBeLessThanOrEqual(4);
  });
});

describe('sleepOvershootM — de combien la nuit dépasse les 500 m', () => {
  it('au-dessus de 2 500 m seulement, et jamais sur une altitude inconnue', () => {
    expect(sleepOvershootM(1200, 3500)).toBe(1800);
    expect(sleepOvershootM(2600, 3000)).toBe(0);
    expect(sleepOvershootM(2600, 3200)).toBe(100);
    expect(sleepOvershootM(1500, 2600)).toBe(600);
    // La nuit suivante reste sous 2 500 m : la règle ne s'applique pas.
    expect(sleepOvershootM(1000, 2400)).toBe(0);
    expect(sleepOvershootM(null, 3500)).toBe(0);
    expect(sleepOvershootM(1200, null)).toBe(0);
    // Une descente n'est jamais un dépassement.
    expect(sleepOvershootM(3600, 2800)).toBe(0);
  });
});

describe('checkSleepingProfile — contrôle d’un itinéraire posé', () => {
  it('signale le saut de couchage, avec le jour et les altitudes repères', () => {
    const f = checkSleepingProfile(
      [
        { day: 1, eleM: 1900 },
        { day: 2, eleM: 2300 },
        { day: 3, eleM: 3300 },
        { day: 4, eleM: 3500 },
      ],
      1100
    );
    expect(f).toEqual([{ kind: 'gain', day: 3, fromM: 2300, toM: 3300, gainM: 1000 }]);
  });

  it('un profil en paliers ne signale rien ; sans altitude connue, rien n’est déduit', () => {
    expect(
      checkSleepingProfile([
        { day: 1, eleM: 2100 },
        { day: 2, eleM: 2550 },
        { day: 3, eleM: 3000 },
        { day: 4, eleM: 3000, stay: true },
        { day: 5, eleM: 3400 },
      ])
    ).toEqual([]);
    expect(checkSleepingProfile([{ day: 1, eleM: null }, { day: 2, eleM: 4200 }])).toEqual([]);
  });

  it('cinq nuits de montée au-dessus de 2 500 m sans nuit au même niveau : signalé une fois', () => {
    const nights = [2600, 2900, 3200, 3500, 3800].map((eleM, i) => ({ day: i + 1, eleM }));
    expect(checkSleepingProfile(nights)).toEqual([{ kind: 'rest', day: 5, nights: 5 }]);
    // Une nuit au même niveau remet le compte à zéro.
    nights[2] = { day: 3, eleM: 3200, stay: true } as (typeof nights)[number];
    expect(checkSleepingProfile(nights)).toEqual([]);
  });
});

describe('checkSleepingProfile — seules les nuits de MONTÉE font la série', () => {
  const nightsAt = (elevations: number[]) => elevations.map((eleM, i) => ({ day: i + 1, eleM }));

  it('des nuits qui redescendent ne sont pas des jours de montée : 2700, 2600, 2800, 2650, 2900 ne signale rien', () => {
    // Avant : « Pas de nuit au même niveau depuis 5 jours de montée (jour 5) » alors que deux nuits sont plus basses que la veille.
    expect(checkSleepingProfile(nightsAt([2700, 2600, 2800, 2650, 2900]))).toEqual([]);
  });

  it('une nuit plus basse remet la série à zéro, comme une nuit au même niveau', () => {
    // 5 nuits de montée d'affilée, la 3e plus basse que la 2e : la série repart de 1 (3 nuits en tout après), rien à dire.
    expect(checkSleepingProfile(nightsAt([2600, 2900, 2800, 3000, 3300, 3600]))).toEqual([]);
    // Même niveau sans le drapeau « stay » (deux lieux à la même altitude) : palier.
    expect(checkSleepingProfile(nightsAt([2600, 2900, 2900, 3200, 3500, 3800]))).toEqual([]);
  });

  it('CONTRE-EXEMPLE — cinq nuits qui montent d’affilée restent signalées, une fois, après une descente plus ancienne', () => {
    expect(checkSleepingProfile(nightsAt([2600, 2900, 3200, 3500, 3800]))).toEqual([{ kind: 'rest', day: 5, nights: 5 }]);
    // Une descente au début (la nuit à 2 600 m), puis cinq nuits de montée : la série compte depuis la descente, signalée au jour 7.
    expect(checkSleepingProfile(nightsAt([3000, 2600, 2900, 3200, 3500, 3800, 4100]))).toEqual([{ kind: 'rest', day: 7, nights: 5 }]);
  });

  it('la première nuit compte quand la nuit d’avant est inconnue (on ne déduit pas qu’elle redescend), pas quand on la sait plus haute', () => {
    expect(checkSleepingProfile(nightsAt([2600, 2900, 3200, 3500, 3800]))).toHaveLength(1);
    expect(checkSleepingProfile(nightsAt([2600, 2900, 3200, 3500, 3800]), 3000)).toEqual([]);
  });
});

describe('sleepNightsOf — les nuits d’un itinéraire (le dernier jour est l’arrivée, on n’y dort pas)', () => {
  // Un trek de 6 jours : 5 nuits (jours 1 à 5), le jour 6 est l'arrivée.
  const steps = [1, 2, 3, 4, 5, 6].map((day) => ({ day, lat: 45.9, lon: 7 + day * 0.1 }));

  it('ne garde que les jours 1 à nightsCount', () => {
    const nights = sleepNightsOf(steps, [2600, 2800, 3000, 3200, 3400, 3600], 5);
    expect(nights.map((n) => n.day)).toEqual([1, 2, 3, 4, 5]);
    expect(nights.map((n) => n.eleM)).toEqual([2600, 2800, 3000, 3200, 3400]);
  });

  it('l’arrivée au sommet le dernier jour ne fait pas une 6e nuit de montée', () => {
    // 5 nuits qui montent puis l'arrivée plus haut : signalé à la 5e nuit seulement (jour 5), jamais au jour 6.
    const f = checkSleepingProfile(sleepNightsOf(steps, [2600, 2900, 3200, 3500, 3800, 4100], 5));
    expect(f).toEqual([{ kind: 'rest', day: 5, nights: 5 }]);
    // Quatre nuits de montée + l'arrivée : rien (l'arrivée n'est pas une nuit).
    expect(checkSleepingProfile(sleepNightsOf(steps.slice(0, 5), [2600, 2900, 3200, 3500, 3800], 4))).toEqual([]);
  });

  it('même lieu que l’étape d’avant : une nuit au même niveau', () => {
    const same = [1, 2, 3, 4, 5].map((day) => ({ day, lat: 45.9, lon: day === 3 ? 7.2 : 7 + day * 0.1 }));
    const nights = sleepNightsOf(same, [2600, 2900, 2900, 3200, 3500], 5);
    expect(nights.map((n) => n.stay)).toEqual([false, false, true, false, false]);
  });

  it('les altitudes inconnues restent inconnues', () => {
    expect(sleepNightsOf(steps, null, 5).map((n) => n.eleM)).toEqual([null, null, null, null, null]);
    expect(sleepNightsOf(steps, [2600, null, 3000, 3200, 3400, 3600], 5)[1].eleM).toBeNull();
  });
});

describe('acclimatisationNote — le texte de l’écran', () => {
  it('rien sous 2 500 m ni sans altitude', () => {
    expect(acclimatisationNote({ maxAltitudeM: 2400, findings: [] })).toBeNull();
    expect(acclimatisationNote({ maxAltitudeM: null, findings: [] })).toBeNull();
  });

  it('dit la règle, sa source et sa date, et que l’altitude est un repère', () => {
    const t = acclimatisationNote({ maxAltitudeM: 3187, findings: [] })!;
    expect(t).toContain('3 190 m environ');
    expect(t).toContain('300 à 500 m');
    expect(t).toContain('UIAA');
    expect(t).toContain('11 octobre 2026');
    expect(t).toMatch(/repère/);
    expect(t).toMatch(/médecin/);
    // Prudent : jamais un diagnostic ni une promesse.
    expect(t).not.toMatch(/tu as le mal|diagnostic|garanti|sans risque/i);
  });

  it('nomme les étapes à revoir (trois au plus)', () => {
    const t = acclimatisationNote({
      maxAltitudeM: 3800,
      findings: [
        { kind: 'gain', day: 2, fromM: 1200, toM: 2900, gainM: 1700 },
        { kind: 'gain', day: 4, fromM: 2900, toM: 3800, gainM: 900 },
      ],
    })!;
    expect(t).toContain('jour 2 (environ +1 700 m de couchage)');
    expect(t).toContain('jour 4 (environ +900 m de couchage)');
  });

  it('l’IA ne redit pas la règle : la note contient « 2 500 m » et « altitude » (TOPICS de advice.ts)', async () => {
    const { repeatsRule } = await import('../engine/advice');
    const t = acclimatisationNote({ maxAltitudeM: 3000, findings: [] })!;
    expect(repeatsRule('Pense à l’altitude : monte doucement.', [t])).toBe(true);
  });
});

describe('planItinerary — paliers d’altitude à pied (UIAA)', () => {
  const base = { activity: 'trekking', center: { lat: 45.9, lon: 7.35 }, radiusKm: 45, shape: 'traverse' as const };

  it('une nuit de plus au même lieu après trois nuits au-dessus de 2 500 m (pas seulement au-dessus de 3 000 m)', () => {
    // Montée régulière de 300 m par nuit : 2 600, 2 900, 3 200, 3 500…
    const places = line({ cols: 18, ele: (c) => 2300 + c * 150 });
    const plan = planItinerary({ ...base, days: 7, places })!;
    expect(plan).not.toBeNull();
    const idx = plan.stages.findIndex((s, i) => i > 0 && s.move === 'aucun' && s.placeId === plan.stages[i - 1].placeId);
    expect(idx).toBeGreaterThan(0);
    expect(idx).toBeLessThanOrEqual(REST_AFTER_NIGHTS + 1);
    expect(plan.stages[idx].note).toMatch(/acclimatation/);
    expect(plan.stages[idx].note).toMatch(/2 500 m/);
  });

  it('jamais plus de 500 m de couchage d’une nuit à l’autre au-dessus de 2 500 m quand un lieu plus bas existe', () => {
    // Deux rangées par colonne : une rangée « haute » (+1 000 m de saut) et une rangée « douce ».
    const places = line({ cols: 18, rows: 2, ele: () => null }).map((p) => {
      const c = Number(p.id.slice(1, 3));
      const row = Number(p.id.slice(3));
      return { ...p, eleM: row === 0 ? 1900 + c * 160 : 1900 + c * 160 + 700 };
    });
    const plan = planItinerary({ ...base, days: 7, places, nights: 'refuge' })!;
    const ele = new Map(places.map((p) => [p.id, p.eleM]));
    const nights = plan.stages.map((s) => ({ eleM: ele.get(s.placeId ?? '') ?? null }));
    for (let i = 1; i < nights.length; i += 1) {
      const a = nights[i - 1].eleM;
      const b = nights[i].eleM;
      if (a != null && b != null && b >= ACCLIMATISATION_FROM_M) expect(b - a).toBeLessThanOrEqual(MAX_SLEEP_GAIN_M);
    }
  });

  it('le premier soir non plus : pas de refuge à 3 500 m depuis un village à 1 200 m quand un village à 1 500 m est à portée', () => {
    const places: AreaPlace[] = [
      { id: 'a-depart', name: 'Départ', lat: 45.9, lon: 7.0, kind: 'village', population: 900, eleM: 1200 },
      { id: 'b-refuge', name: 'Refuge haut', lat: 45.9, lon: 7.13, kind: 'hut', population: null, eleM: 3500 },
      { id: 'c-village', name: 'Village doux', lat: 45.91, lon: 7.125, kind: 'village', population: 300, eleM: 1500 },
      { id: 'd-suite', name: 'Suite', lat: 45.9, lon: 7.27, kind: 'village', population: 300, eleM: 1700 },
    ];
    const plan = planItinerary({
      days: 2,
      activity: 'trekking',
      center: { lat: 45.9, lon: 7.13 },
      radiusKm: 30,
      shape: 'traverse',
      nights: 'refuge',
      places,
      startAt: { name: 'Départ', lat: 45.9, lon: 7.0 },
    })!;
    expect(plan.stages[0].name).toBe('Village doux');
  });

  it('seul un saut trop grand existe : une nuit de plus ici d’abord, puis l’étape, dite', () => {
    // 1 560 m → 3 400 m : aucun palier entre les deux.
    const places = line({ cols: 12, rows: 1, ele: (c) => (c < 4 ? 1500 + c * 20 : 3300 + c * 20) });
    const plan = planItinerary({ ...base, days: 6, places })!;
    expect(plan).not.toBeNull();
    const rest = plan.stages.findIndex((s, i) => i > 0 && s.move === 'aucun' && s.placeId === plan.stages[i - 1].placeId);
    expect(rest).toBeGreaterThan(0);
    expect(plan.stages[rest].note).toMatch(/acclimatation/);
    expect(plan.stages[rest].note).toMatch(/plus de 500 m plus haut/);
    // Après la nuit de plus, l'étape se fait (le plan n'est pas bloqué) et le saut est dit, en chiffres.
    const after = plan.stages[rest + 1];
    expect(after.move).toBe('marche');
    expect(after.note).toMatch(/plus que les 300 à 500 m conseillés/);
    expect(after.note).toMatch(/\b1[89]\d0 m plus haut/);
    // Une seule nuit de plus pour cette raison : pas de blocage, les jours restants avancent.
    expect(plan.stages.slice(rest + 1).every((s) => s.move === 'marche' || /acclimatation/.test(s.note ?? ''))).toBe(true);
  });

  it('CONTRE-EXEMPLE — sous 2 500 m rien ne change : pas de nuit de plus, aucune note d’altitude', () => {
    const places = line({ cols: 18, ele: (c) => 600 + c * 80 });
    const plan = planItinerary({ ...base, days: 7, places })!;
    expect(plan.stages.every((s) => s.move === 'marche')).toBe(true);
    expect(plan.stages.some((s) => /acclimatation|UIAA/.test(s.note ?? ''))).toBe(false);
  });

  it('CONTRE-EXEMPLE — altitudes inconnues : aucune règle d’altitude appliquée', () => {
    const places = line({ cols: 18, ele: () => null });
    const plan = planItinerary({ ...base, days: 7, places })!;
    expect(plan.stages.every((s) => s.move === 'marche')).toBe(true);
  });

  it('même entrée → même itinéraire', () => {
    const places = line({ cols: 18, ele: (c) => 2300 + c * 150 });
    const a = planItinerary({ ...base, days: 7, places })!;
    const b = planItinerary({ ...base, days: 7, places: [...places].reverse() })!;
    expect(b.stages).toEqual(a.stages);
  });
});
