import { beforeEach, describe, expect, it } from 'vitest';
import type { Sport } from '@/features/explorer-v2/state/types';
import { useExplorerStore } from '@/features/explorer-v2/state/store';
import {
  BASE_CATALOG_SLUG,
  KNOWN_CATALOG_SLUGS,
  SPORT_FAMILIES,
  SPORT_METRIC_LABEL,
  TRACKER_METRICS,
  availabilityLabel,
  defaultVariantForSport,
  familySummary,
  getSportFamily,
  getSportVariant,
  metricsLabel,
  missingOptionalMetrics,
  startAvailability,
  toSportSelection,
  type SportStartContext,
  type SportVariant,
} from '@/features/explorer-v2/sheet/sportSelection';

/** Contrat aval actuel : ces neuf identifiants ne doivent jamais changer. */
const BASE_SPORTS: Sport[] = [
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

const GRANTED: SportStartContext = { locationPermission: 'granted', gpsAvailable: true };
const PROMPT: SportStartContext = { locationPermission: 'prompt', gpsAvailable: true };
const DENIED: SportStartContext = { locationPermission: 'denied', gpsAvailable: true };
const NO_GPS: SportStartContext = { locationPermission: 'granted', gpsAvailable: false };

describe('explorer-v2 · taxonomie des sports (S1.02)', () => {
  it('conserve exactement les neuf identifiants Sport existants', () => {
    expect(SPORT_FAMILIES.map((family) => family.sport).sort()).toEqual([...BASE_SPORTS].sort());
  });

  it('donne à chaque famille des variantes uniques, rattachées à un Sport existant', () => {
    const ids = SPORT_FAMILIES.flatMap((family) => family.variants.map((variant) => variant.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const family of SPORT_FAMILIES) {
      expect(family.variants.length).toBeGreaterThan(0);
      for (const variant of family.variants) {
        expect(variant.sport).toBe(family.sport);
        expect(BASE_SPORTS).toContain(variant.sport);
        expect(BASE_SPORTS).not.toContain(variant.id);
      }
    }
  });

  it('conserve le mapping Explorer → activity_catalog de la révision de référence', () => {
    expect(BASE_CATALOG_SLUG).toEqual({
      course: 'course-5k',
      rando: 'rando-journee',
      velo: 'velo-route',
      kayak: 'canoe-journee',
      trail: 'trail-10k',
      ski: 'ski-randonnee',
      escalade: 'escalade-voie',
      famille: 'rando-famille',
      bivouac: 'bivouac-1n',
    });
    for (const family of SPORT_FAMILIES) {
      const primary = family.variants.find(
        (variant) => variant.catalogSlug === BASE_CATALOG_SLUG[family.sport],
      );
      expect(primary, family.sport).toBeTruthy();
    }
  });

  it('n’invente aucun slug absent du catalogue connu', () => {
    for (const family of SPORT_FAMILIES) {
      for (const variant of family.variants) {
        if (variant.catalogSlug === null) continue;
        expect(KNOWN_CATALOG_SLUGS.has(variant.catalogSlug), variant.catalogSlug).toBe(true);
      }
    }
  });

  it('n’expose comme démarrable que les variantes que le tracker sait réellement capturer', () => {
    for (const variant of SPORT_FAMILIES.flatMap((family) => family.variants)) {
      const availability = startAvailability(variant, GRANTED);
      if (!availability.startable) continue;
      expect(variant.catalogSlug, variant.id).not.toBeNull();
      expect(variant.environment, variant.id).toBe('outdoor');
      expect(variant.requiresGps, variant.id).toBe(true);
      for (const metric of variant.requiredMetrics) {
        expect(TRACKER_METRICS.has(metric), `${variant.id}:${metric}`).toBe(true);
      }
    }
  });

  it('démarre une variante GPS prête', () => {
    const variant = getSportVariant('rando-journee');
    expect(variant).not.toBeNull();
    expect(startAvailability(variant as SportVariant, GRANTED)).toEqual({
      status: 'ready',
      startable: true,
      reason: null,
      missingMetrics: [],
    });
  });

  it('laisse démarrer quand la permission sera demandée, en l’annonçant', () => {
    const availability = startAvailability(getSportVariant('rando-journee') as SportVariant, PROMPT);
    expect(availability.status).toBe('needs-permission');
    expect(availability.startable).toBe(true);
    expect(availability.reason).toContain('position');
    expect(availabilityLabel(availability)).toBe('GPS à autoriser');
  });

  it('bloque une permission refusée', () => {
    const availability = startAvailability(getSportVariant('rando-journee') as SportVariant, DENIED);
    expect(availability).toEqual({
      status: 'blocked',
      startable: false,
      reason: 'Position refusée : autorise la géolocalisation pour démarrer.',
      missingMetrics: [],
    });
    expect(availabilityLabel(availability)).toBe('Indisponible');
  });

  it('bloque quand la géolocalisation manque sur l’appareil', () => {
    const availability = startAvailability(getSportVariant('rando-journee') as SportVariant, NO_GPS);
    expect(availability.status).toBe('blocked');
    expect(availability.startable).toBe(false);
    expect(availability.reason).toContain('indisponible');
  });

  it('bloque les sports indoor même avec une position accordée', () => {
    for (const id of ['course-tapis', 'velo-home-trainer', 'escalade-salle']) {
      const variant = getSportVariant(id);
      expect(variant, id).not.toBeNull();
      const availability = startAvailability(variant as SportVariant, GRANTED);
      expect(variant?.environment, id).toBe('indoor');
      expect(availability.startable, id).toBe(false);
      expect(availability.reason, id).toContain('indoor');
    }
  });

  it('bloque les variantes sans type de séance au catalogue', () => {
    for (const id of ['ski-alpin', 'ski-fond', 'escalade-bloc']) {
      const variant = getSportVariant(id);
      expect(variant, id).not.toBeNull();
      expect(variant?.catalogSlug, id).toBeNull();
      expect(startAvailability(variant as SportVariant, GRANTED).startable, id).toBe(false);
    }
  });

  it('bloque une métrique requise non captée et la nomme', () => {
    const variant: SportVariant = {
      id: 'test-puissance',
      sport: 'velo',
      label: 'Test puissance',
      catalogSlug: 'velo-route',
      environment: 'outdoor',
      requiresGps: true,
      requiredMetrics: ['power'],
    };
    const availability = startAvailability(variant, GRANTED);
    expect(availability.startable).toBe(false);
    expect(availability.missingMetrics).toEqual(['power']);
    expect(availability.reason).toContain('puissance');
  });

  it('décrit les métriques propres à chaque variante', () => {
    expect(metricsLabel(['distance', 'elevation'])).toBe('distance, D+');
    expect(missingOptionalMetrics(getSportVariant('velo-route') as SportVariant)).toEqual([
      'cadence',
      'power',
      'heartRate',
    ]);
    expect(missingOptionalMetrics(getSportVariant('rando-journee') as SportVariant)).toEqual([
      'heartRate',
    ]);
    for (const variant of SPORT_FAMILIES.flatMap((family) => family.variants)) {
      expect(variant.requiredMetrics.length, variant.id).toBeGreaterThan(0);
      for (const metric of [...variant.requiredMetrics, ...(variant.optionalMetrics ?? [])]) {
        expect(SPORT_METRIC_LABEL[metric], `${variant.id}:${metric}`).toBeTruthy();
      }
    }
  });

  it('résume les variantes et signale l’indoor', () => {
    expect(familySummary(getSportFamily('course')!)).toBe('2 variantes · 1 indoor');
    expect(familySummary(getSportFamily('rando')!)).toBe('3 variantes');
    expect(familySummary(getSportFamily('escalade')!)).toBe('3 variantes · 1 indoor');
  });

  it('choisit une variante démarrable par sport, et aucune quand le GPS est refusé', () => {
    for (const sport of BASE_SPORTS) {
      const variant = defaultVariantForSport(sport, GRANTED);
      expect(variant, sport).not.toBeNull();
      expect(startAvailability(variant as SportVariant, GRANTED).startable, sport).toBe(true);
      expect(defaultVariantForSport(sport, DENIED), sport).toBeNull();
    }
  });

  it('transmet le contrat local sans changer l’identifiant Sport', () => {
    const family = getSportFamily('rando');
    const variant = getSportVariant('rando-refuge');
    expect(family).not.toBeNull();
    expect(variant).not.toBeNull();
    expect(toSportSelection(family!, variant!)).toEqual({
      sport: 'rando',
      variantId: 'rando-refuge',
      variantLabel: 'Randonnée avec nuit en refuge',
      catalogSlug: 'rando-refuge',
      environment: 'outdoor',
      metrics: ['distance', 'duration', 'elevation'],
    });
  });

  it('retourne null sur un identifiant inconnu', () => {
    expect(getSportVariant('inconnu')).toBeNull();
    expect(getSportFamily('inconnu' as Sport)).toBeNull();
  });
});

describe('explorer-v2 · départ : la variante survit au compte à rebours', () => {
  const selection = () =>
    toSportSelection(getSportFamily('rando')!, getSportVariant('rando-refuge')!);

  beforeEach(() => {
    useExplorerStore.setState({
      activity: undefined,
      summary: undefined,
      summarySaved: undefined,
      pendingStart: undefined,
      sheet: 'level',
      detent: 'peek',
      camera: { type: 'none' },
    });
  });

  it('conserve la variante de la demande jusqu’au bilan', () => {
    const chosen = selection();
    useExplorerStore.getState().requestStart('rando', chosen);

    // Ce que le compte à rebours affiche et ce qu’il doit rendre au démarrage.
    expect(useExplorerStore.getState().pendingStart).toEqual({
      sport: 'rando',
      selection: chosen,
    });

    useExplorerStore.getState().confirmStart();
    const started = useExplorerStore.getState();
    expect(started.pendingStart).toBeUndefined();
    expect(started.sheet).toBe('live');
    expect(started.activity?.sport).toBe('rando');
    expect(started.activity?.selection).toEqual(chosen);

    useExplorerStore.getState().stopActivity();
    expect(useExplorerStore.getState().summary?.sport).toBe('rando');
    expect(useExplorerStore.getState().summary?.selection?.variantId).toBe('rando-refuge');
  });

  it('conserve la variante lors d’un démarrage direct (scène, reprise)', () => {
    const chosen = selection();
    useExplorerStore.getState().startActivity('rando', null, chosen);
    expect(useExplorerStore.getState().activity?.selection).toEqual(chosen);
  });

  it('annule sans créer d’activité', () => {
    useExplorerStore.getState().requestStart('rando', selection());
    useExplorerStore.getState().cancelStart();
    expect(useExplorerStore.getState().pendingStart).toBeUndefined();
    expect(useExplorerStore.getState().activity).toBeUndefined();
  });

  it('ne démarre rien sans demande en attente', () => {
    useExplorerStore.getState().confirmStart();
    expect(useExplorerStore.getState().activity).toBeUndefined();
  });
});
