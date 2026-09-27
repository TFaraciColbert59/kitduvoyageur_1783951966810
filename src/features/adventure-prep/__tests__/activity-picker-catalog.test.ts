import { describe, it, expect } from 'vitest';
import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  activityById,
  metricsContextFor,
  nightCandidates,
  primaryCandidates,
  searchActivities,
  selectedActivities,
} from '../catalog';

/**
 * Le catalogue est une donnee pure : ces tests verrouillent les familles
 * exigees par le produit et les regles de combinaison, sans passer par l UI.
 */
describe('CAT — les familles demandees sont couvertes', () => {
  const REQUIRED: ReadonlyArray<readonly [string, string]> = [
    ['randonnée', 'rando-journee'],
    ['randonnée avec nuit', 'rando-refuge'],
    ['course', 'course'],
    ['trail', 'trail'],
    ['vélo', 'velo-route'],
    ['montagne', 'ski-randonnee'],
    ['nautisme', 'canoe-journee'],
    ['bivouac', 'bivouac'],
    ['road trip', 'roadtrip'],
    ['voyage', 'avion-long'],
  ];

  for (const [family, id] of REQUIRED) {
    it(`CAT-${id}: la famille « ${family} » est au catalogue`, () => {
      expect(activityById(id)).not.toBeNull();
    });
  }

  it('CAT-01: chaque activite porte un libelle lisible et non vide', () => {
    for (const activity of ACTIVITIES) {
      expect(activity.label.trim().length).toBeGreaterThan(0);
      expect(activity.label).not.toMatch(/\s{2,}/);
    }
  });

  it('CAT-02: chaque activite declare une duree strictement positive', () => {
    for (const activity of ACTIVITIES) {
      expect(activity.suggestedDurationHours).toBeGreaterThan(0);
    }
  });
});

describe('CAT — unicite des identifiants et des libelles', () => {
  it('CAT-03: deux activites ne partagent jamais le meme identifiant', () => {
    const ids = ACTIVITIES.map((activity) => activity.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Doublon CONNU, signale et non masque.
   *
   * `catalog.ts` (ligne 257) declare `ski-alpin` avec le libelle de
   * `ski-randonnee` : les deux cartes s'affichent mot pour mot identiques sur
   * l'ecran 02, et l'une des deux ne peut pas etre designee. Le catalogue
   * appartient a un autre agent — la correction sort de mon perimetre, elle est
   * donc reportee plutot que silencieuse.
   *
   * Cette epingle est un piege : toute NOUVELLE collision fait echouer le
   * test, et la resolution de celle-ci le fait aussi. Dans les deux cas il faut
   * revenir ici — c'est le but.
   */

  it('CAT-04: deux activites ne partagent jamais le meme libelle', () => {
    // Deux libelles identiques dans le meme ecran seraient invisibles pour
    // l'utilisateur : l'un des deux ne pourrait jamais etre designe.
    const labels = ACTIVITIES.map((activity) => activity.label);
    const doublons = new Set(
      labels.filter((label, index) => labels.indexOf(label) !== index)
    );
    expect([...doublons]).toEqual([]);
  });
});

describe('CAT — la recherche est insensible a la casse et aux accents', () => {
  it('CAT-05: une requete vide sur une famille renvoie toute la famille', () => {
    const all = searchActivities('', 'a_pied');
    expect(all.length).toBeGreaterThan(0);
    for (const activity of all) {
      expect(activity.category).toBe('a_pied');
    }
  });

  it('CAT-06: « canoë » se trouve sans l accent, et « canoe » aussi', () => {
    expect(searchActivities('canoe').map((a) => a.id)).toContain('canoe-journee');
    expect(searchActivities('canoë').map((a) => a.id)).toContain('canoe-journee');
  });

  it('CAT-07: une recherche inconnue ne renvoie rien', () => {
    expect(searchActivities('zzzzz-inexistant')).toEqual([]);
  });

  it('CAT-08: la recherche reste bornee a la famille demandee', () => {
    const results = searchActivities('nuit', 'a_velo');
    for (const activity of results) {
      expect(activity.category).toBe('a_velo');
    }
  });
});

describe('CAT — une aventure combine plusieurs activites', () => {
  it('CAT-09: une selection multi-activites garde toutes les activites', () => {
    const ids = selectedActivities({ primary: 'rando-journee', extra: ['kayak'], nights: ['bivouac'] });
    expect(ids.map((a) => a.id)).toEqual(['rando-journee', 'kayak', 'bivouac']);
  });

  it('CAT-10: une activite repetee n est pas comptee deux fois', () => {
    const ids = selectedActivities({ primary: 'kayak', extra: ['kayak', 'rando-journee'], nights: ['kayak'] });
    expect(ids.map((a) => a.id)).toEqual(['kayak', 'rando-journee']);
  });

  it('CAT-11: le contexte de metrique suit la principale et ses complements', () => {
    expect(metricsContextFor({ primary: 'rando-journee', extra: [], nights: [] })).toBe('terrain');
    expect(metricsContextFor({ primary: 'rando-journee', extra: ['roadtrip'], nights: [] })).toBe('voyage');
    expect(metricsContextFor({ primary: 'rando-journee', extra: ['city-break'], nights: [] })).toBe('sejour');
  });
});

describe('CAT — activites principales et nuits ajoutees', () => {
  it('CAT-12: le bivouac n est jamais propose comme activite principale', () => {
    expect(primaryCandidates().map((a) => a.id)).not.toContain('bivouac');
  });

  it('CAT-13: le bivouac reste proposable comme nuit ajoutee', () => {
    expect(nightCandidates().map((a) => a.id)).toContain('bivouac');
  });

  it('CAT-14: la plupart des activites se combinent', () => {
    const combinable = ACTIVITIES.filter((a) => a.combinable);
    expect(combinable.length).toBeGreaterThanOrEqual(ACTIVITIES.length - 1);
  });

  it('CAT-15: chaque famille expose au moins une activite principale', () => {
    const primaries = new Set(primaryCandidates().map((a) => a.category));
    for (const category of ACTIVITY_CATEGORIES) {
      expect(primaries.has(category.id)).toBe(true);
    }
  });
});