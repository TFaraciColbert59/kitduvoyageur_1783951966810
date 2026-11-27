import { describe, expect, it } from 'vitest';
import {
  buildWeatherAdviceFr,
  computeRouteDifficulty,
  describeWmoWeatherCode,
  formatCompassDirectionFr,
  formatDurationFr,
  formatEmergencyServiceLabelFr,
  formatHazardSeverityFr,
  formatIconicTaxonFr,
  formatReportCategoryFr,
  formatRouteNetworkLabel,
  poiMatchesSpotsFilter,
  resolvePoiPresentation,
} from '../poiTaxonomy';

describe('poiTaxonomy — human-readable French labels, route badges, difficulty & weather', () => {
  it('replaces generic "Spot" with exact French subtype labels for all real POIs', () => {
    expect(resolvePoiPresentation('access', 'bus_stop').shortBadge).toBe('Bus');
    expect(resolvePoiPresentation('access', 'bus_stop').label).toBe('Arrêt de bus · Navette');
    expect(resolvePoiPresentation('access', 'train_station').shortBadge).toBe('Gare');
    expect(resolvePoiPresentation('access', 'parking').shortBadge).toBe('Parking');
    expect(resolvePoiPresentation('access', 'trailhead').shortBadge).toBe('Départ');
    expect(resolvePoiPresentation('access', 'village').shortBadge).toBe('Village');
    expect(resolvePoiPresentation('access', 'city').shortBadge).toBe('Ville');
    expect(resolvePoiPresentation('summit', 'saddle').shortBadge).toBe('Col');
    expect(resolvePoiPresentation('water', 'spring').shortBadge).toBe('Source');
    expect(resolvePoiPresentation('water', 'drinking_water').shortBadge).toBe('Eau potable');
    expect(resolvePoiPresentation('refuge', 'wilderness_hut').shortBadge).toBe('Cabane');
    expect(resolvePoiPresentation('refuge', 'shelter').shortBadge).toBe('Abri');
    expect(resolvePoiPresentation('refuge', 'alpine_hut').shortBadge).toBe('Refuge');
    expect(resolvePoiPresentation('bivouac', 'camp_site').shortBadge).toBe('Bivouac');
    expect(resolvePoiPresentation('bike_shop', 'ebike_charging').shortBadge).toBe('Borne VAE');
    expect(resolvePoiPresentation('unknown', null).shortBadge).not.toBe('Spot');
  });

  it('converts cryptic OSM route networks & raw numeric refs into clear French labels', () => {
    expect(formatRouteNetworkLabel('iwn', '18')).toEqual({
      label: 'Grande Randonnée · n° 18',
      shortBadge: 'GR Int.',
    });
    expect(formatRouteNetworkLabel('nwn', 'GR 5')).toEqual({
      label: 'Grande Randonnée · GR 5',
      shortBadge: 'GR 5',
    });
    expect(formatRouteNetworkLabel('lwn', null)).toEqual({
      label: 'Petite Randonnée (PR)',
      shortBadge: 'PR',
    });
    expect(formatRouteNetworkLabel('mtb', '4')).toEqual({
      label: 'Parcours VTT · n° 4',
      shortBadge: 'VTT',
    });
  });

  it('computes realistic hiking difficulty, weather descriptions, advice & durations', () => {
    expect(computeRouteDifficulty(3.2, 80, 900).level).toBe('Facile');
    expect(computeRouteDifficulty(7.5, 320, 1400).level).toBe('Modéré');
    expect(computeRouteDifficulty(12, 720, 2200).level).toBe('Difficile');
    expect(computeRouteDifficulty(18, 1350, 2900).level).toBe('Exigeant');

    expect(describeWmoWeatherCode(71)).toEqual({ label: 'Chutes de neige', symbol: 'snow' });
    expect(describeWmoWeatherCode(0)).toEqual({ label: 'Ciel dégagé', symbol: 'sun' });
    expect(buildWeatherAdviceFr(-7, 8, 0, 'snow')).toContain('Grand froid');
    expect(formatDurationFr(200)).toBe('3 h 20');
    expect(formatDurationFr(45)).toBe('45 min');
  });

  it('translates Pokédex taxons, CAP severities, emergency services, report categories, and compass directions into plain French', () => {
    expect(formatIconicTaxonFr('Aves')).toBe('Oiseaux');
    expect(formatIconicTaxonFr('Mammalia')).toBe('Mammifères');
    expect(formatIconicTaxonFr('Plantae')).toBe('Plantes');
    expect(formatIconicTaxonFr('Actinopterygii')).toBe('Poissons');

    expect(formatHazardSeverityFr('Extreme')).toBe('Extrême');
    expect(formatHazardSeverityFr('Moderate')).toBe('Modéré');
    expect(formatHazardSeverityFr('Unknown')).toBeUndefined();

    expect(formatEmergencyServiceLabelFr('general', '112')).toBe('Urgences');
    expect(formatEmergencyServiceLabelFr('ambulance', '15')).toBe('SAMU');
    expect(formatEmergencyServiceLabelFr('fire', '18')).toBe('Pompiers');
    expect(formatEmergencyServiceLabelFr('police', '17')).toBe('Police');

    expect(formatReportCategoryFr('snow_ice')).toBe('Neige / verglas');
    expect(formatReportCategoryFr('water')).toBe('Point d’eau');

    expect(formatCompassDirectionFr('0-360')).toBe('Panorama 360°');
    expect(formatCompassDirectionFr('NW')).toBe('Nord-Ouest');
    expect(formatCompassDirectionFr('180')).toBe('Sud (180°)');
  });

  it('filters POIs cleanly across the new granular outdoor & access filter buckets', () => {
    const summit = { kind: 'summit', subtype: 'peak' };
    const water = { kind: 'water', subtype: 'drinking_water' };
    const hut = { kind: 'refuge', subtype: 'alpine_hut' };
    const camp = { kind: 'bivouac', subtype: 'camp_site' };
    const bus = { kind: 'access', subtype: 'bus_stop' };

    expect(poiMatchesSpotsFilter(summit, 'relief')).toBe(true);
    expect(poiMatchesSpotsFilter(bus, 'relief')).toBe(false);
    expect(poiMatchesSpotsFilter(water, 'water_refuge')).toBe(true);
    expect(poiMatchesSpotsFilter(hut, 'water_refuge')).toBe(true);
    expect(poiMatchesSpotsFilter(camp, 'bivouac')).toBe(true);
    expect(poiMatchesSpotsFilter(bus, 'access')).toBe(true);
    expect(poiMatchesSpotsFilter(summit, 'routes')).toBe(false);
  });
});
