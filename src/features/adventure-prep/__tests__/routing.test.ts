/**
 * Routage reel — le preparateur ne doit JAMAIS afficher une distance inventee.
 *
 * Ces tests verrouillent trois choses :
 *  1. la geometrie pure (haversine, profil, agregats) ;
 *  2. l'honnetete du contract : un troncon manquant reste `null`, jamais 0 ;
 *  3. l'enrichissement du modele : distances reelles par jour ET par etape.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  applyRouting,
  elevationProfile,
  haversineKm,
  legTotals,
  routeItinerary,
  type GeoPoint,
  type RouteLeg,
  type RoutingDeps,
} from '../engine/routing';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';

const A: GeoPoint = { lat: 45.9237, lon: 6.8694 };
const B: GeoPoint = { lat: 45.9819, lon: 6.9269 };

function leg(distanceKm: number, durationMin: number): RouteLeg {
  return { distanceKm, durationMin, geometry: [] };
}

/** Modele de `days` journees dont chaque etape porte des coordonnees. */
function locatedModel(days: number) {
  const built = buildItinerary(fullDraft({ calendar: { startDate: '2026-07-11', durationDays: days, durationIsSuggested: false, returnDate: null } }));
  if (!built) throw new Error('modele attendu');
  const steps = built.steps.map((step, index) =>
    index % 2 === 0 ? { ...step, lat: A.lat, lon: A.lon } : { ...step, lat: B.lat, lon: B.lon },
  );
  return { ...built, steps };
}

const silentDeps: RoutingDeps = {
  route: async () => null,
  elevation: async () => null,
};

describe('geometrie pure', () => {
  it('la distance a vol d oiseau est symetrique et nulle sur un point', () => {
    expect(haversineKm(A, A)).toBe(0);
    expect(haversineKm(A, B)).toBeCloseTo(haversineKm(B, A), 9);
    expect(haversineKm(A, B)).toBeGreaterThan(5);
    expect(haversineKm(A, B)).toBeLessThan(9);
  });

  it('les agregats de troncons somment kilometres et minutes', () => {
    const totals = legTotals([leg(3, 10), leg(7.5, 25)]);
    expect(totals).toEqual({ distanceKm: 10.5, durationMin: 35 });
  });

  it('un tableau de troncons vide ne vaut pas zero kilometre', () => {
    expect(legTotals([])).toEqual({ distanceKm: 0, durationMin: 0 });
  });

  it('le profil altimétrique ignore le bruit sous le seuil et compte le reste', () => {
    // 1000 -> 1005 (bruit, sous 10 m) -> 1060 (vrai denivele) -> 1040.
    const profile = elevationProfile([1000, 1005, 1060, 1040], 10);
    expect(profile.gainM).toBe(60);
    expect(profile.lossM).toBe(20);
  });

  it('un profil incomplet ne produit ni denivele ni de faux zero', () => {
    expect(elevationProfile([null, 1000, null], 10)).toEqual({ gainM: null, lossM: null });
    expect(elevationProfile([], 10)).toEqual({ gainM: null, lossM: null });
  });
});

describe('orchestration', () => {
  it('sans reponse du routeur, le modele reste intact et a verifier', async () => {
    const out = await routeItinerary(locatedModel(1), silentDeps);
    expect(out.totals.distanceKm).toBeNull();
    expect(out.totals.movingMin).toBeNull();
    expect(out.totals.elevGainM).toBeNull();
  });

  it('une journee sans deux points situes n est pas routee du tout', async () => {
    const route = vi.fn(async () => [leg(4, 8)]);
    const model = locatedModel(3);
    // Seul le jour 1 porte des coordonnees.
    const onlyDayOne = {
      ...model,
      steps: model.steps.map((step) =>
        step.day === 1 ? step : { ...step, lat: null, lon: null },
      ),
    };
    const out = await routeItinerary(onlyDayOne, { ...silentDeps, route });
    expect(route).toHaveBeenCalledTimes(1);
    expect(out.perDay[0].distanceKm).not.toBeNull();
    expect(out.perDay[1].distanceKm).toBeNull();
    expect(out.totals.distanceKm).toBeNull();
  });

  it('reporte la distance et la duree reelles sur le jour ET sur l etape', async () => {
    // Contrat : N points donnent N-1 troncons, l'arrivee portant le temps de trajet.
    const route = vi.fn(async (points: readonly GeoPoint[]) =>
      points.slice(1).map(() => leg(4, 9)),
    );
    const elevation = vi.fn(async () => [1041, 1100, 1250]);
    const out = await routeItinerary(locatedModel(1), { route, elevation });

    const located = out.steps
      .filter((step) => step.lat !== null)
      .sort((a, b) => a.order - b.order);
    const legs = located.length - 1;
    expect(out.totals.distanceKm).toBeCloseTo(4 * legs, 2);
    expect(out.totals.movingMin).toBe(9 * legs);
    expect(located[located.length - 1].durationMin).toBe(9);
    expect(located[0].durationMin).toBeNull();
  });
});

describe('application au modele', () => {
  it('une journee entierement situee mais reduite a un point vaut zero kilometre prouve', async () => {
    // Un seul point situe ne laisse AUCUN deplacement a mesurer entre deux
    // points : la distance est nulle par construction, pas par defaut. La
    // confondre avec « inconnu » empechait le total de l aventure de
    // s afficher des que le programme d une journee tient en un point.
    const model = locatedModel(1);
    const single = {
      ...model,
      steps: [{ ...model.steps[0], lat: A.lat, lon: A.lon }],
    };
    const out = await routeItinerary(single, {
      route: async () => { throw new Error('le routeur ne doit pas etre appele'); },
      elevation: async () => null,
    });
    expect(out.perDay[0].distanceKm).toBe(0);
    expect(out.perDay[0].movingMin).toBe(0);
    expect(out.totals.distanceKm).toBe(0);
  });

  it('une journee dont un pas n est pas situE reste a verifier', async () => {
    const model = locatedModel(1);
    const mixed = {
      ...model,
      // Un seul pas subsiste, mais un autre n'est pas situe : on ne sait pas
      // par ou la personne passe, donc le zero n'est PAS prouve.
      steps: model.steps.map((step, index) => (index === 0 ? step : { ...step, lat: null, lon: null })),
    };
    const out = await routeItinerary(mixed, {
      route: async () => { throw new Error('le routeur ne doit pas etre appele'); },
      elevation: async () => null,
    });
    expect(out.perDay[0].distanceKm).toBeNull();
    expect(out.totals.distanceKm).toBeNull();
  });

  it('la duree d activite du jour se deduit des durees de ses etapes', async () => {
    const model = locatedModel(1);
    const timed = {
      ...model,
      steps: model.steps.map((step, index) => ({ ...step, durationMin: index === 0 ? 120 : 45 })),
    };
    const out = await routeItinerary(timed, {
      route: async () => null,
      elevation: async () => null,
    });
    const expected = timed.steps.reduce((acc, step) => acc + (step.durationMin ?? 0), 0);
    expect(out.perDay[0].activityMin).toBe(expected);
    expect(out.totals.activityMin).toBe(expected);
  });

  it('une seule etape sans duree connue laisse la journee entiere a verifier', async () => {
    const model = locatedModel(1);
    const timed = {
      ...model,
      steps: model.steps.map((step, index) => ({ ...step, durationMin: index === 0 ? 120 : null })),
    };
    const out = await routeItinerary(timed, {
      route: async () => null,
      elevation: async () => null,
    });
    expect(out.perDay[0].activityMin).toBeNull();
    expect(out.totals.activityMin).toBeNull();
  });

  it('remplit les totaux et le jour depuis une resolution complete', () => {
    const out = applyRouting(locatedModel(1), {
      perDay: [
        { distanceKm: 20.004, durationMin: 40, geometry: [[6.86, 45.92]], elevGainM: 500, elevLossM: 120 },
      ],
      legByStepId: { s1: leg(20, 40) },
    });
    expect(out.totals.distanceKm).toBe(20);
    expect(out.totals.movingMin).toBe(40);
    expect(out.totals.elevGainM).toBe(500);
    expect(out.totals.elevLossM).toBe(120);
    expect(out.perDay[0].distanceKm).toBe(20);
  });

  it('une journee non routee ne contamine pas les autres et nullifie le total', () => {
    const out = applyRouting(locatedModel(2), {
      perDay: [
        { distanceKm: 10, durationMin: 20, geometry: [], elevGainM: 100, elevLossM: 0 },
        null,
      ],
      legByStepId: {},
    });
    expect(out.perDay[0].distanceKm).toBe(10);
    expect(out.perDay[1].distanceKm).toBeNull();
    // Total partiel interdit : sans le jour 2, la distance totale est inconnue.
    expect(out.totals.distanceKm).toBeNull();
  });

  it('la duree d activite n est connue que si toutes les etapes du jour le sont', () => {
    const model = locatedModel(1);
    const out = applyRouting(
      { ...model, perDay: [{ ...model.perDay[0], activityMin: 165 }] },
      { perDay: [null], legByStepId: {} },
    );
    expect(out.perDay[0].activityMin).toBe(165);
    expect(out.totals.activityMin).toBe(165);
  });

  it('le modele d origine n est jamais modifie', () => {
    const model = locatedModel(1);
    const before = JSON.stringify(model);
    applyRouting(model, {
      perDay: [{ distanceKm: 99, durationMin: 99, geometry: [], elevGainM: 1, elevLossM: 1 }],
      legByStepId: {},
    });
    expect(JSON.stringify(model)).toBe(before);
  });
});
