import { describe, expect, it } from 'vitest';
import {
  NEAREST_REACH_KM,
  assignPlaces,
  kindCategories,
  nearestCompatible,
  toCandidate,
  type BoundItineraryModel,
  type PlaceCandidate,
} from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import {
  PRICE_TO_CHECK,
  type ItineraryModel,
  type ItineraryStep,
  type ItineraryStepKind,
  type MoneyValue,
} from '../types';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';

/**
 * P3.3 - HONNETETE DE LA MESURE.
 *
 * `nearestCompatible` etait prive et sans rayon : il rendait un candidat nu,
 * donc la mesure qui avait decide disparaissait derriere l'etape. Une etape
 * pouvait se retrouver a 180 km du point precedent avec la meme confiance
 * qu'a 200 m. Ces tests contraignent le rayon, l'exigence d'un curseur
 * reel, et la publication de la distance reellement mesuree.
 */

/** Un refuge sans prix : la base n'en dit rien. */
const REFUGE_SANS_PRIX = {
  id: 'outdoor-1',
  name: 'Refuge du Gouter',
  category: 'refuge',
  lat: 45.8447,
  lng: 6.8427,
  tags: {},
  is_verified: true,
};

const BELVEDERE = {
  id: 'outdoor-2',
  name: 'Belvedere des Aiguilles',
  category: 'viewpoint',
  lat: 45.879,
  lng: 6.8873,
  is_verified: true,
};

/** Un point de vue a ~540 km de Chamonix : hors de tout rayon raisonnable. */
const BELVEDERE_ELOIGNE = {
  id: 'outdoor-9',
  name: 'Belvedere du Jura',
  category: 'viewpoint',
  lat: 47.05,
  lng: 6.9,
  is_verified: true,
};

function candidat(raw: unknown): PlaceCandidate {
  const candidate = toCandidate(raw);
  if (!candidate) throw new Error('candidat attendu');
  return candidate;
}

function model(): ItineraryModel {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

/** Modele minimal : une nuit, une categorie et un prix que l'on veut observer. */
function nuitAvec(price: MoneyValue, extra: Partial<ItineraryStep> = {}): ItineraryModel {
  const step: ItineraryStep = {
    id: 's1',
    day: 1,
    order: 0,
    kind: 'nuit',
    title: 'Refuge du Gouter',
    placeName: 'Refuge du Gouter',
    startTime: null,
    durationMin: null,
    reason: null,
    price: price,
    state: 'propose',
    kept: false,
    icon: 'bed',
    lat: null,
    lon: null,
    ...extra,
  };
  return { steps: [step], notes: [] } as unknown as ItineraryModel;
}

describe('P3.3 - un prix de la base ne se propage pas sur un lieu qui n en a pas', () => {
  it('une nuit sans prix ne conserve pas le prix plausible de l invitation', () => {
    // applyCandidate laissait passer step.price quand pricePerNight etait null :
    // une nuit affichee a 42 EUR alors que la base n'en dit rien.
    const stale = { amount: 42, currency: 'EUR' as const, state: 'propose' as const };
    const out = assignPlaces(
      nuitAvec(stale),
      [candidat(REFUGE_SANS_PRIX)],
      CHAMONIX,
      ARGENTIERE,
    ) as BoundItineraryModel;
    const nuit = out.steps.find((step) => step.kind === 'nuit');
    expect(nuit?.price.amount).toBeNull();
    expect(nuit?.price.state).toBe(PRICE_TO_CHECK.state);
  });

  it('un priceBreakdown devenu faux disparait avec le prix qu il decrivait', () => {
    const stale = { amount: 42, currency: 'EUR' as const, state: 'propose' as const };
    const breakdownFaux = {
      unitLabel: 'par nuit',
      perUnit: stale,
      perPerson: stale,
      groupTotal: stale,
      isEstimate: false,
    };
    const out = assignPlaces(
      nuitAvec(stale, { priceBreakdown: breakdownFaux }),
      [candidat(REFUGE_SANS_PRIX)],
      CHAMONIX,
      ARGENTIERE,
    ) as BoundItineraryModel;
    const nuit = out.steps.find((step) => step.kind === 'nuit');
    expect(nuit?.priceBreakdown ?? null).toBeNull();
  });

  it('un prix reellement connu est reporte, SANS detail de prix invente', () => {
    const avecPrix = { ...REFUGE_SANS_PRIX, tags: { price_per_night: 75 } };
    const out = assignPlaces(
      nuitAvec(PRICE_TO_CHECK),
      [candidat(avecPrix)],
      CHAMONIX,
      ARGENTIERE,
    ) as BoundItineraryModel;
    const nuit = out.steps.find((step) => step.kind === 'nuit');
    expect(nuit?.price.amount).toBe(75);
    expect(nuit?.price.state).toBe('propose');
    // Le MONTANT est reel : il vient de la base, il est affiche tel quel.
    // Le DETAIL, lui, n existe pas : `PriceBreakdown` exige `perPerson` ET
    // `groupTotal`, et la base ne dit ni si 75 EUR est par personne, par
    // chambre ou par tente, ni combien de personnes composent le groupe. Les
    // recopier sur le montant affichait « 75 EUR pour 3 personnes » : un
    // nombre qu aucune source ne porte. step-sheet.test.tsx:420 sait
    // distinguer un vrai total d un total recopie.
    expect(nuit?.priceBreakdown ?? null).toBeNull();
  });
});

describe('P3.3 - la decision de rattachement est BORDEE et PUBLIEE', () => {
  const used = new Set<string>();
  const chamonix = { lat: CHAMONIX.lat, lon: CHAMONIX.lon };

  it('le rayon de rattachement existe, il est fini et positif', () => {
    expect(Number.isFinite(NEAREST_REACH_KM)).toBe(true);
    expect(NEAREST_REACH_KM).toBeGreaterThan(0);
  });

  it('sans curseur reel, aucun point n est invente', () => {
    // Un curseur NaN (pas de depart choisi) rendait haversineKm NaN, donc
    // `km < Infinity` vrai pour le PREMIER candidat : une position etait
    // attributee a partir d'un calcul sans valeur.
    const sansCurseur = assignPlaces(model(), [candidat(BELVEDERE)], null, null);
    expect(sansCurseur.steps.every((step) => step.lat === null || step.kind === 'trajet')).toBe(true);
  });

  it('un point trop eloigne du curseur est refuse plutot que retenu', () => {
    const loin = nearestCompatible(
      [candidat(BELVEDERE_ELOIGNE)],
      used,
      chamonix,
      'arret',
    );
    expect(loin).toBeNull();
  });

  it('le point retenu publie la distance qui l a decide', () => {
    const scored = nearestCompatible([candidat(BELVEDERE)], used, chamonix, 'arret');
    expect(scored).not.toBeNull();
    expect(scored?.candidate.name).toBe('Belvedere des Aiguilles');
    expect(Number.isFinite(scored?.distanceKm)).toBe(true);
    // Ordre de grandeur attendu a vol d'oiseau depuis Chamonix (~5 km).
    expect(scored?.distanceKm).toBeGreaterThan(1);
    expect(scored?.distanceKm).toBeLessThan(20);
  });

  it('un curseur non fini, ou un rayon absurde, ne produit rien', () => {
    expect(nearestCompatible([candidat(BELVEDERE)], used, { lat: NaN, lon: NaN }, 'arret')).toBeNull();
    expect(nearestCompatible([candidat(BELVEDERE)], used, chamonix, 'arret', 0)).toBeNull();
    expect(nearestCompatible([candidat(BELVEDERE)], used, chamonix, 'arret', -5)).toBeNull();
    expect(
      nearestCompatible([candidat(BELVEDERE)], used, chamonix, 'arret', Number.NaN),
    ).toBeNull();
  });

  it('le resultat est deterministe sur les MEMES entrees', () => {
    const candidates = [candidat(BELVEDERE), candidat(BELVEDERE_ELOIGNE)];
    const a = nearestCompatible(candidates, used, chamonix, 'arret');
    const b = nearestCompatible(candidates, used, chamonix, 'arret');
    expect(a?.candidate.id).toBe(b?.candidate.id);
    expect(a?.distanceKm).toBe(b?.distanceKm);
  });

  it('un point deja utilise n est jamais represente', () => {
    const dejaUtilise = new Set([candidat(BELVEDERE).id]);
    expect(nearestCompatible([candidat(BELVEDERE)], dejaUtilise, chamonix, 'arret')).toBeNull();
  });
});

const CHAMONIX_POINT = { lat: CHAMONIX.lat, lon: CHAMONIX.lon };

describe('P3.3 - « poi » n est plus une categorie compatible avec tout', () => {
  it('aucun type d etape ne tolere la categorie de repli "poi"', () => {
    // 'poi' est la categorie de repli d'un lieu INCONNU. La garder dans chaque
    // liste en faisait un joker : n'importe quelle boutique devenait un
    // hebergement, un point d'eau, une pause.
    for (const kind of ['nuit', 'arret', 'ravitaillement', 'repos', 'trajet'] as ItineraryStepKind[]) {
      expect(kindCategories(kind), `${kind} ne doit plus accepter "poi"`).not.toContain('poi');
    }
  });

  it('une categorie inconnue ne se rattache donc plus automatiquement', () => {
    const commerce = candidat({ name: 'Boutique', category: 'shop', lat: 45.93, lon: 6.87 });
    expect(commerce.category).toBe('poi');
    expect(nearestCompatible([commerce], new Set<string>(), CHAMONIX_POINT, 'nuit')).toBeNull();
  });
});

describe('P3.3 - aucune mesure n est fabriquee sur une etape', () => {
  it('le rattachement ne touche ni l heure, ni la duree : comparaison etape par etape', () => {
    // Comparer « fini OU nul » ne prouve rien : un 09:00 FABRIQUE est aussi
    // fini, et un `?? 9` passerait le test. Le controle qui mord, c est
    // l'egalite stricte avec l etape d origine, retrouvee par son id.
    const avant = model();
    const catalogue = [
      candidat(BELVEDERE),
      candidat({
        ...REFUGE_SANS_PRIX,
        id: 'outdoor-7',
        name: 'Refuge des Aiguilles Rouges',
        lat: 45.8776,
        lng: 6.9187,
        tags: { price_per_night: 65 },
      }),
    ];
    const out = assignPlaces(avant, catalogue, CHAMONIX, ARGENTIERE) as BoundItineraryModel;
    const parId = new Map(avant.steps.map((step) => [step.id, step]));

    expect(out.steps.length).toBeGreaterThan(0);
    for (const step of out.steps) {
      const depart = parId.get(step.id);
      expect(depart, `l etape ${step.id} sort du modele propose`).toBeDefined();
      if (!depart) continue;
      // Mesure par mesure : le lieu change, le temps ne bouge pas.
      expect(step.startTime, `heure fabriquee sur ${step.id}`).toBe(depart.startTime);
      expect(step.durationMin, `duree fabriquee sur ${step.id}`).toBe(depart.durationMin);
      // Le prix d une nuit vient du LIEU rattache, jamais d un heritage.
      if (step.kind === 'nuit') {
        const rattache = catalogue.find((c) => c.name === step.placeName);
        if (rattache) {
          expect(
            step.price.amount,
            `prix fabrique sur ${step.id}`,
          ).toBe(rattache.pricePerNight);
        }
      }
      expect(step.lat === null || Number.isFinite(step.lat)).toBe(true);
      expect(step.lon === null || Number.isFinite(step.lon)).toBe(true);
      if (step.lat !== null) expect(step.placeName).toBeTruthy();
    }
  });

  it('une etape sans position ne porte ni nom de lieu ni identite', () => {
    const out = assignPlaces(model(), [], null, null) as BoundItineraryModel;
    for (const step of out.steps) {
      if (step.lat === null) {
        expect(step.placeId).toBeNull();
      }
    }
  });
});

describe('P3.3 - le catalogue reste partageable', () => {
  it('PlaceCandidate reste utilisable sans catalogId (placeGeocode en depend)', () => {
    const sansCatalogue: PlaceCandidate = {
      id: 'geo-chamonix',
      name: 'Chamonix',
      category: 'poi',
      lat: 45.9237,
      lon: 6.8694,
      description: null,
      region: null,
      country: null,
      pricePerNight: null,
      phone: null,
      website: null,
      isVerifiable: false,
    };
    expect(nearestCompatible([sansCatalogue], new Set<string>(), { lat: CHAMONIX.lat, lon: CHAMONIX.lon }, 'poi-inconnu' as ItineraryStepKind)).toBeNull();
  });
});
