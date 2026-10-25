/**
 * P0.22 - Le profil de routage ne peut plus etre fige sur `driving`.
 *
 * Le constat mesure : `routingService.ts` figeait le profil OSRM sur
 * `driving`, donc l'etape 2 affichait « 12 min » pour un trajet que la
 * randonnee reelle mesure a 2 h 07. Memes points, deux profils :
 *
 *   driving    (OSRM)     10,30 km /  11,8 min  -> 52 km/h
 *   pedestrian (Valhalla)  8,28 km / 127,1 min  ->  3,9 km/h
 *
 * Ces tests verrouillent les trois proprietes qui rendent le chiffre vrai :
 *   1. le mode de deplacement existe et voyage jusqu'a la route ;
 *   2. la reponse du fournisseur est lue sans invention ;
 *   3. un trace qui n'arrive pas au lieu demande vaut `null`, jamais une
 *      distance qui ne va nulle part.
 *
 * Les deux `shape` ci-dessous sont des REPONSES REELLES relevees en direct sur
 * `valhalla1.openstreetmap.de` le 28-09 (Chamonix, `costing: pedestrian`).
 * Elles ne sont ni tronquees ni arrondies : une forme trop courte donne un
 * dernier point a 9 km de l'arrivee, et le garde-fou la rejetterait a raison.
 *
 * Elles sont ecrites en litteral echappe : la polyligne contient des
 * antislashs, qu'un litteral brut convertirait en echappements et corromprait
 * la geometrie.
 */
import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_TOLERANCE_M,
  decodeValhallaShape,
  isTravelMode,
  normalizeValhallaRoute,
  normalizeValhallaRouteDetailed,
  VALHALLA_COSTING,
} from '../routingService';
import type { RoutePoint } from '../routingService';

const CHAMONIX: RoutePoint = { lat: 45.92375, lon: 6.86933 };
const LES_HOUCHES: RoutePoint = { lat: 45.89056, lon: 6.79745 };
/** Le refuge du Gouter est a 3 817 m : inatteignable a pied. */
const GOUTER: RoutePoint = { lat: 45.8447, lon: 6.8427 };

/** Chamonix -> Les Houches. Ecart d'arrivee mesure : 12 m. */
const SHAPE_SI_JOIGNABLE = "s~}qvAqwgbLaAlEY|Bu@nEkAlEa@vBCnBLbAf@b@|LjFRiA|EuVd@_Cv@{DvDmSPaAvAg@nCo@~AMlADlAf@xG|GrClDd@j@Vt@|@lCj@x@xJpMn@z@|HhKtExGnFdHzFvHtFrGnBtBjMbL`fA|aAtG_Q`BiDpAiCjCsFvGwLtEgI|EwIn@kA\\m@fEkH^m@Zc@rAtBpOdUjBpCfEjGvF~IfJ`Nn@z@~AxB^f@xCnE|IhNxF|IhEvG~ArC|AnClAbC|IxObHdN`ApB|EhJl@fATf@~A~B|@tD`CrG`JlVpAzDdHfWl@xBx@vCfApFn@nDrC~RxCtP`GrV|G|W`DfLt@rCxIxXnKx\\bB~EJ`@`AjDhI`ZlEhRbHh[vCrO|FbZ\\hCfApIr@hFn@`GpAfULhEFxA~D~`@pM|~AhBhPpBbI|DbLm@xASjBDvB`@bBv@lAdAn@l@HhBnZL|Cb@fHzCrf@XrN@dQi@fl@?hJPvI^rIx@hJbBlMhA~El@jCl@hCxBtG`C|GjCjGvFhK`KtPpKzS`DdH|B~EpC~GrCdIjEjLrKdZbE|L|DzIlBrDrAxBne@xn@~E`IjAlB`ApAw@xAg@~@{GvK}@|A\\h@^h@V`@b}@dtAtB`ErLrRhZnu@rBnHhM|NrBfDbJ`PnB|C`BjBrBxAlAp@~ATvBIlNqEbAUpAO`AdEjCOxA@bBL|AVdF`BhBfAvBbC~ApBfCzDdD~FpCdFzp@`nA~AlCr@nA`IbO~JfRjCzE~E|IdBdDpW|f@|GpMxCbGh@fAtDrHvBhEdC`FrAhCz@`BvFxKbCvExFrNxDnJtO~b@|CpI`@fApEdMt[r|@pDrJXv@fFfN|@dCpCrHjCdHjC`HhBpDn@bBxDzHpCjJrC`HgA`AHf@BZ@j@@b@Ch@@l@C`@Dh@Ht@Fj@Lh@T^Z\\^\\^Td@b@T^R^Pj@LQbA_AvBtJtBhHxDtMdHdUxOrg@~L|`@rCrJ~k@ziBjN~b@lDrHzDpGbC~CnCnCtCfCdExChTdLdZdObIxE~ElDpI`IdFnGfHjKbAjBf@`AlCzEbFdLtGtPf@pAvZv_AzBdHpOd_@t[zm@nFvNjDrKdSnx@rBzHlBxG\\tARz@lSzx@`Ozc@c@v@[~@SfAGhA@jAJhARdA\\|@l@z@r@j@x@Xz@FVrI`@|DfBbOv@tHl@`KTnJFhKQhHUpIOjF]rG{@zNqA~N}CtXcApNQxAuHzo@QbBKdBIbBEfBAdB?xBBxBFxBJvBJnBNlB~AfPxFfW^bBZfBVhBTjBPjBd@nH~AtUfB|Wd@nIVzEb@nHnAxTV~FJpCFrCBrC?pCCrCIpCcBnaACzA?`O^dL~@nM|BzTv@~DxD~RbHpP~M`VtAdDjA|C|ChI~CvL~BzIzAfHjCzOLxAVtC`@jEr@hQ|A`q@VnLTrKjBjk@f@~c@TpNZ~MHxGlAhRbB~Pl@rJVpFbAE`A^t@hAR~@DxAMnArA`BdAtCtD~PnBfJvCdKbSzn@~@vCxCdKtIbWhKfVbJfQlE`H`FpGlP`Q~PpQrNlOrBpBxGfFnH~Fz[xWzGjG~B~DvClFhA~BdAxB|CnGpAjCpA~A`BtB|BpBC`G|@lIfA|BvMjSnAr@pNvHdP|Gt@Z~ClAdWvJxF_GjBaBn@YxAx@t@zB`@pER`FcA|AuHhLsK|Nq@`ASt@gB_Ce@kBSwBU{B";

/** Chamonix -> refuge du Gouter. Ecart d'arrivee mesure : 4 321 m. */
const SHAPE_HORS_RESEAU = "s~}qvAqwgbLaAlEY|Bu@nEkAlEa@vBCnBLbAf@b@|LjFRiA|EuVd@_Cv@{DvDmSfJkAtAHtOtPxAdD~IxJv@x@n@z@|HhKtExGnFdHzFvHtFrGnBtBjMbL`fA|aAtG_Q`BiDpAiCjCsFvGwLtEgI|EwIn@kA\\m@fEkH^m@Zc@rAtBpOdUjBpCfEjGvF~IfJ`Nn@z@~AxB^f@xCnE|IhNxF|IhEvG~ArC|AnClAbC|IxObHdN`ApB|EhJl@fATf@~A~B|@tD`CrG`JlVpAzDdHfWl@xBx@vCfApFn@nDrC~RxCtP`GrV|G|W`DfLt@rCxIxXnKx\\bB~EJ`@`AjDhI`ZlEhRbHh[vCrO|FbZ\\hCfApIr@hFn@`GpAfULhEFxA~D~`@pM|~AhBhPpBbI|DbLm@xASjBDvB`@bBv@lAdAn@l@HhBnZL|Cb@fHzCrf@XrN@dQi@fl@?hJPvI^rIx@hJbBlMhA~El@jCl@hCxBtG`C|GjCjGvFhK`KtPpKzS`DdH|B~EpC~GrCdIjEjLrKdZbE|L|DzIlBrDrAxBne@xn@~E`IjAlB`ApAw@xAg@~@{GvK}@|A\\h@^h@V`@b}@dtAtB`ErLrRhZnu@rBnHhM|NrBfDbJ`PnB|C`BjBrBxAlAp@~ATvBIlNqEbAUpAO`AdEjCOxA@bBL|AVdF`BhBfAvBbC~ApBfCzDdD~FpCdFzp@`nA~AlCr@nA`IbO~JfRjCzE~E|IdBdDpW|f@|GpMxCbGh@fAtDrHvBhEdC`FrAhCz@`BvFxKbCvExFrNxDnJtO~b@|CpI`@fApEdMt[r|@pDrJXv@fFfN|@dCpCrHjCdHjC`HhBpDn@bBxDzHpCjJrC`HgA`AHf@BZ@j@@b@Ch@@l@C`@Dh@Ht@Fj@Lh@T^Z\\^\\^Td@b@T^R^Pj@LQbA_AvBtJtBhHxDtMdHdUxOrg@~L|`@rCrJ~k@ziBjN~b@lDrHzDpGbC~CnCnCtCfCdExChTdLdZdObIxE~ElDpI`IdFnGfHjKbAjBf@`AlCzEbFdLtGtPf@pAvZv_AzBdHpOd_@t[zm@nFvNjDrKdSnx@rBzHlBxG\\tARz@lSzx@`Ozc@c@v@[~@SfAGhA@jAJhARdA\\|@l@z@r@j@x@Xz@FVrI`@|DfBbOv@tHl@`KTnJFhKQhHUpIOjF]rG{@zNqA~N}CtXcApNQxAuHzo@QbBKdBIbBEfBAdB?xBBxBFxBJvBJnBNlB~AfPxFfW^bBZfBVhBTjBPjBd@nH~AtUfB|Wd@nIVzEb@nH`A[\\KnU{GpWwHrJ}ChJeBzCkBnG{DhEaHtAcDdF}HdH{GbIqAzHuBzCsArDy@fQztAdB|B`Ol`AlFYpUMzHeD`f@mSvRuKtj@g`@~m@wb@br@qe@`]uYdc@{d@`Wa[jOqQ~A}E|A_JXmNUuJgD}`@kGyfAmBqd@W{Mz@cNdDgO|KwTtToWzC{D`CqA~EN~G`DhFbIjAvCbAAbAuAXmCm@iKE}Dt@yAbA[bEIjXhAbj@eF|h@wBpQxYd@i@~N{K|MeE`CKlAsAJsClQkNlX_YrRoZxWgPl\\gKp[oC`|@eB";

const VALHALLA_SI_JOIGNABLE = {
  trip: {
    legs: [
      { summary: { time: 5535.534, length: 7.612 }, shape: SHAPE_SI_JOIGNABLE },
    ],
    status: 0,
  },
};

const VALHALLA_HORS_RESEAU = {
  trip: {
    legs: [
      { summary: { time: 7628.135, length: 8.275 }, shape: SHAPE_HORS_RESEAU },
    ],
    status: 0,
  },
};

describe('P0.22 - le mode de deplacement existe', () => {
  it('reconnait exactement les trois modes du produit', () => {
    expect(isTravelMode('pieton')).toBe(true);
    expect(isTravelMode('velo')).toBe(true);
    expect(isTravelMode('voiture')).toBe(true);
  });

  it('refuse tout ce qui n est pas un mode connu', () => {
    // Une faute de frappe dans l'URL ne doit jamais retomber sur un profil par
    // defaut : ce serait exactement le mensonge qu on cherche a supprimer.
    for (const value of ['driving', 'PIETON', 'camion', '', null, undefined, 3, {}]) {
      expect(isTravelMode(value)).toBe(false);
    }
  });

  it('associe chaque mode a un costing de fournisseur qui existe', () => {
    expect(VALHALLA_COSTING).toEqual({
      pieton: 'pedestrian',
      velo: 'bicycle',
      voiture: 'auto',
    });
  });
});

describe('P0.22 - polyligne Valhalla', () => {
  it('decode la forme encodee en points [lon, lat] exploitables', () => {
    const points = decodeValhallaShape(SHAPE_SI_JOIGNABLE);
    expect(points.length).toBeGreaterThanOrEqual(2);
    // Le premier point vaut la position demandee, a l'accrochage pres (12 m).
    expect(points[0][0]).toBeCloseTo(6.869385, 5);
    expect(points[0][1]).toBeCloseTo(45.923834, 5);
    for (const [lon, lat] of points) {
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('une forme vide ou absente ne rend aucun point plutot qu un trace faux', () => {
    expect(decodeValhallaShape('')).toEqual([]);
    expect(decodeValhallaShape(null)).toEqual([]);
    expect(decodeValhallaShape(undefined)).toEqual([]);
  });
});

describe('P0.22 - reponse Valhalla lue sans invention', () => {
  it('convertit les mesures du fournisseur sans les recalculer', () => {
    const legs = normalizeValhallaRoute(VALHALLA_SI_JOIGNABLE, [CHAMONIX, LES_HOUCHES]);
    expect(legs).toHaveLength(1);
    expect(legs?.[0].distanceKm).toBeCloseTo(7.612, 3);
    expect(legs?.[0].durationMin).toBeCloseTo(5535.534 / 60, 3);
    expect(legs?.[0].geometry.length).toBeGreaterThanOrEqual(2);
  });

  it('un nombre de troncons incoherent avec les points est refuse', () => {
    expect(normalizeValhallaRoute(VALHALLA_SI_JOIGNABLE, [CHAMONIX, LES_HOUCHES, CHAMONIX])).toBeNull();
    expect(normalizeValhallaRoute(VALHALLA_SI_JOIGNABLE, [CHAMONIX])).toBeNull();
  });

  it('un status en erreur vaut absence, pas un zero', () => {
    const failed = { trip: { ...VALHALLA_SI_JOIGNABLE.trip, status: 1 } };
    expect(normalizeValhallaRoute(failed, [CHAMONIX, LES_HOUCHES])).toBeNull();
    expect(normalizeValhallaRoute({}, [CHAMONIX, LES_HOUCHES])).toBeNull();
    expect(normalizeValhallaRoute(null, [CHAMONIX, LES_HOUCHES])).toBeNull();
  });

  it('une duree ou une distance non finie est refusee', () => {
    const broken = {
      trip: {
        ...VALHALLA_SI_JOIGNABLE.trip,
        legs: [{ summary: { time: null, length: 7.612 }, shape: SHAPE_SI_JOIGNABLE }],
      },
    };
    expect(normalizeValhallaRoute(broken, [CHAMONIX, LES_HOUCHES])).toBeNull();
  });
});

describe('P0.22 - un trace qui n arrive pas au lieu vaut « a verifier »', () => {
  it('refuse une reponse REELLE dont le trace s arrete 4,3 km avant le refuge', () => {
    // La reponse est parfaitement valide : status 0, 8,275 km, 2 h 07. Ce
    // sont de vrais chiffres... pour un trajet qui s'arrete en foret.
    expect(normalizeValhallaRoute(VALHALLA_HORS_RESEAU, [CHAMONIX, GOUTER])).toBeNull();
  });

  it('accepte la meme reponse quand le lieu est reellement atteignable', () => {
    // Le garde-fou discrimine des cas reels, il ne refuse pas tout par defaut.
    expect(normalizeValhallaRoute(VALHALLA_SI_JOIGNABLE, [CHAMONIX, LES_HOUCHES])).not.toBeNull();
  });

  it('refuse aussi un trace qui ne DEMARRE pas au lieu demande', () => {
    // Depart impose au refuge, trace issu de Chamonix : 8,8 km de decalage.
    expect(normalizeValhallaRoute(VALHALLA_SI_JOIGNABLE, [GOUTER, LES_HOUCHES])).toBeNull();
  });

  it('la tolerance separe les ecarts mesures, elle ne les ignore pas', () => {
    // 12 m : accepte. 4 321 m : refuse. Le seuil vit entre les deux.
    expect(ARRIVAL_TOLERANCE_M).toBeGreaterThan(12);
    expect(ARRIVAL_TOLERANCE_M).toBeLessThan(4321);
  });
});


describe(`P0.23 - un refus se dit, il ne se devine pas`, () => {
  it(`off_network : le fournisseur a repondu, sa trace n arrive pas`, () => {
    const attempt = normalizeValhallaRouteDetailed(VALHALLA_HORS_RESEAU, [CHAMONIX, GOUTER]);
    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe(`off_network`);
  });

  it(`provider_unavailable : le fournisseur n a rien dit d exploitable`, () => {
    // Sans cette distinction, une panne de Valhalla autoriserait a ecarter un
    // sommet - donc a vider l inventaire d une region entiere sur un incident.
    expect(normalizeValhallaRouteDetailed(null, [CHAMONIX, GOUTER]).reason).toBe(`provider_unavailable`);
    expect(normalizeValhallaRouteDetailed({}, [CHAMONIX, GOUTER]).reason).toBe(`provider_unavailable`);
    const statusEnErreur = { trip: { status: 1, legs: [] } };
    expect(normalizeValhallaRouteDetailed(statusEnErreur, [CHAMONIX, GOUTER]).reason).toBe(`provider_unavailable`);
  });

  it(`une trace qui marche ne porte aucune raison de refus`, () => {
    const attempt = normalizeValhallaRouteDetailed(VALHALLA_SI_JOIGNABLE, [CHAMONIX, LES_HOUCHES]);
    expect(attempt.reason).toBeNull();
    expect(attempt.legs).not.toBeNull();
  });

  it(`la forme historique reste le wrapper, et perd la raison`, () => {
    // Les tests existants comptent sur ce contrat : ils doivent passer sans
    // changement. La raison ne fuite que par la variante detaillee.
    expect(normalizeValhallaRoute(VALHALLA_HORS_RESEAU, [CHAMONIX, GOUTER])).toBeNull();
    expect(normalizeValhallaRoute(VALHALLA_SI_JOIGNABLE, [CHAMONIX, LES_HOUCHES])).not.toBeNull();
  });
});
