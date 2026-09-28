import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  activityById,
  activitiesByCategory,
  activityTemplate,
  activityTemplateLabel,
  metricsContextFor,
  nightCandidates,
  primaryCandidates,
  rankActivitiesByBrief,
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



/* ------------------------------------------------------------------ */
/* Aucune duree affichee : le catalogue propose une FORME, pas un chiffre */
/* ------------------------------------------------------------------ */

/**
 * Une duree ecrite en dur dans le catalogue (« 6 h environ ») n'appartient a
 * aucune aventure reelle : personne ne l'a mesuree. L'afficher comme une
 * information revient a inventer une donnee. Le catalogue garde donc son
 * role legitime — proposer des TYPES d'aventure — et ne publie plus qu'une
 * forme de sejour, sans chiffre, que l'utilisateur lit comme un point de
 * depart.
 */
describe('le catalogue ne publie aucune duree affichee', () => {
  it('CAT-D01: chaque activite a un gabarit de depart', () => {
    for (const activity of ACTIVITIES) {
      expect(activityTemplate(activity.id)).toBeTruthy();
    }
  });

  it('CAT-D02: aucun gabarit ne contient de chiffre, donc aucune duree', () => {
    for (const activity of ACTIVITIES) {
      const label = activityTemplateLabel(activity.id);
      expect(label).not.toMatch(/[0-9]/);
    }
  });

  it('CAT-D03: le libelle annonce un gabarit, pas une mesure', () => {
    for (const activity of ACTIVITIES) {
      expect(activityTemplateLabel(activity.id)).toMatch(/^Gabarit : /);
    }
  });

  it('CAT-D04: une activite inconnue ne recoit pas un gabarit invente', () => {
    // Pas de repli « journee » par defaut : on ne connait pas l aventure
    // retenue, on le dit.
    expect(activityTemplate(null)).toBe('libre');
    expect(activityTemplateLabel(null)).toBe(activityTemplateLabel('inexistant'));
    expect(activityTemplateLabel('inexistant')).not.toMatch(/jour|soir|nuit/);
  });

  it('CAT-D05: le gabarit se deduit du type, il ne depend pas du nombre d\'heures', () => {
    // Deux activites de duree technique differente partagent le meme
    // gabarit : ce qui est affiche est la FORME, pas la mesure.
    expect(activityTemplateLabel('rando-journee')).toBe(activityTemplateLabel('course'));
    expect(activityTemplateLabel('rando-refuge')).toBe(activityTemplateLabel('ski-randonnee'));
  });

  it('CAT-D06: le module lui-meme ne fabrique plus de libelle de duree', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/adventure-prep/catalog.ts'),
      'utf8',
    );
    // « environ » est la formule du chiffre invente. Elle ne doit plus
    // apparaitre dans le CODE du catalogue — les commentaires, eux, citent
    // volontairement la formule retiree pour expliquer pourquoi.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('environ');
  });
});

describe('le brief classe le vrai catalogue', () => {
  it('une phrase ramene les activites qui repondent a ses mots', () => {
    const ranked = rankActivitiesByBrief('je veux dormir en refuge avec un lever de soleil');
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].id).toBe('rando-refuge');
  });

  it('la meilleure correspondance vient en tete', () => {
    const ranked = rankActivitiesByBrief('velo en montagne');
    const labels = ranked.map((a) =>
      a.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    );
    expect(labels[0]).toContain('velo');
  });

  it('un brief vide rend tout le catalogue, dans son ordre habituel', () => {
    expect(rankActivitiesByBrief('   ').map((a) => a.id)).toEqual(ACTIVITIES.map((a) => a.id));
  });

  it('un brief qui ne parle d aucune activite ne fait pas disparaitre le catalogue', () => {
    const ranked = rankActivitiesByBrief('zzzzqqq');
    expect(ranked).toHaveLength(0);
  });

  it('les mots vides du brief ne comptent pas', () => {
    // Un brief fait uniquement de mots outils ne trie rien : c'est l'absence
    // de signal, pas une correspondance.
    expect(rankActivitiesByBrief('de la le et en un une').map((a) => a.id)).toEqual(
      ACTIVITIES.map((a) => a.id),
    );
  });
});
