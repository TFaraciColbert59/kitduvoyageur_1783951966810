import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  activityById,
  activitiesByCategory,
  metricsContextFor,
  nightCandidates,
  primaryCandidates,
  searchActivities,
  selectedActivities,
} from '../catalog';

describe('catalogue d\'activites', () => {
  it('expose 6 categories et au moins 20 activites, d\'identifiants uniques', () => {
    expect(ACTIVITY_CATEGORIES).toHaveLength(6);
    expect(ACTIVITIES.length).toBeGreaterThanOrEqual(20);
    const ids = ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('donne un libelle lisible et une icone du sprite a chaque activite', () => {
    for (const activity of ACTIVITIES) {
      expect(activity.label.length).toBeGreaterThan(2);
      expect(activity.icon).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('retrouve une activite par identifiant et par categorie', () => {
    expect(activityById('rando-refuge')?.label).toBe('Randonnée avec nuit de refuge');
    expect(activitiesByCategory('eau').every((a) => a.category === 'eau')).toBe(true);
    expect(activityById('inexistant')).toBeNull();
  });

  it('cherche sans tenir compte de la casse ni des accents', () => {
    expect(searchActivities('REFUGE').map((a) => a.id)).toContain('rando-refuge');
    expect(searchActivities('velo').map((a) => a.id)).toContain('velo-route');
    expect(searchActivities('bivouac').map((a) => a.id)).toContain('bivouac');
    expect(searchActivities('').length).toBe(ACTIVITIES.length);
    expect(searchActivities('zzzz')).toHaveLength(0);
  });

  it('filtre la recherche par categorie', () => {
    const results = searchActivities('', 'neige_montagne');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((a) => a.category === 'neige_montagne')).toBe(true);
  });

  it('separe activites principales et nuits possibles', () => {
    expect(primaryCandidates().some((a) => a.id === 'bivouac')).toBe(false);
    expect(nightCandidates().map((a) => a.id)).toContain('bivouac');
    expect(nightCandidates().every((a) => a.canBeAddedNight)).toBe(true);
  });

  it('choisit le contexte de metrique le plus englobant', () => {
    expect(metricsContextFor({ primary: 'rando-refuge', extra: [], nights: [] })).toBe('terrain');
    expect(metricsContextFor({ primary: 'ski_randonnee', extra: [], nights: [] })).toBe('terrain');
    expect(metricsContextFor({ primary: 'roadtrip', extra: [], nights: [] })).toBe('voyage');
    expect(
      metricsContextFor({ primary: 'rando-refuge', extra: ['bivouac'], nights: [] }),
    ).toBe('terrain');
    expect(
      metricsContextFor({ primary: 'rando-refuge', extra: ['avion-long'], nights: [] }),
    ).toBe('voyage');
    expect(metricsContextFor({ primary: null, extra: [], nights: [] })).toBe('terrain');
  });

  it('liste les activites choisies sans doublon', () => {
    const list = selectedActivities({
      primary: 'rando-refuge',
      extra: ['rando-refuge', 'bivouac'],
      nights: [],
    });
    expect(list.map((a) => a.id)).toEqual(['rando-refuge', 'bivouac']);
  });
});


