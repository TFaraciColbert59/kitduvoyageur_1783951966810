import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DestinationStep } from '../components/DestinationStep';
import {
  canCreateStepOne,
  stepOneMissing,
  stepOneMissingSummary,
  stepOneProfile,
  stepOneProfileIdFor,
} from '../components/stepOneProfile';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * Meme harnais que destination-screen.test.tsx : sous `renderToStaticMarkup`,
 * zustand v5 sert l etat INITIAL. Le module du store est donc remplace par un
 * selecteur pur - le composant est reellement execute, seule la source de
 * donnees change.
 */
const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

const noop = () => undefined;

function render(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DestinationStep, { onOpenSheet: noop }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const RANDO = { primary: 'rando-journee', extra: [], nights: [] };
const ROADTRIP = { primary: 'roadtrip', extra: [], nights: [] };
const SEJOUR = { primary: 'city-break', extra: [], nights: [] };
const LOCAL = { primary: 'kayak', extra: [], nights: [] };

const CAL_EMPTY = {
  startDate: null,
  durationDays: null,
  durationIsSuggested: false,
  startDateIsSuggested: false,
  returnDate: null,
};

describe('S11 — le bon ecran pour la bonne aventure', () => {
  it('S11-01: une randonnee garde l ecran trajet (10)', () => {
    expect(stepOneProfileIdFor(RANDO)).toBe('trajet');
  });

  it('S11-02: un road trip bascule sur l ecran voyage (11)', () => {
    expect(stepOneProfileIdFor(ROADTRIP)).toBe('voyage');
  });

  it('S11-03: un sejour autour d un lieu bascule sur l ecran sejour (12)', () => {
    expect(stepOneProfileIdFor(SEJOUR)).toBe('sejour');
  });

  it('S11-04: une activite locale bascule sur l ecran local (13)', () => {
    expect(stepOneProfileIdFor(LOCAL)).toBe('local');
  });

  it('S11-05: sans activite retenue, l ecran par defaut reste le trajet', () => {
    expect(stepOneProfileIdFor({ primary: null, extra: [], nights: [] })).toBe('trajet');
  });

  it('S11-06: le profil se lit sur la principale seule, jamais sur les complements', () => {
    expect(stepOneProfileIdFor({ primary: 'rando-journee', extra: ['roadtrip'], nights: [] })).toBe(
      'trajet'
    );
  });
});

describe('S11 — les questions posees', () => {
  it('S11-07: le trajet pose depart, arrivee et duree, sans demander la forme', () => {
    const profile = stepOneProfile('trajet');
    expect(profile.rows.map((row) => row.label)).toEqual(['Départ', 'Arrivée']);
    expect(profile.cells.map((cell) => cell.label)).toEqual(['Date', 'Durée estimée']);
    expect('showRouteShape' in profile).toBe(false);
  });

  it('S11-08: le voyage pose une destination et un retour', () => {
    const profile = stepOneProfile('voyage');
    expect(profile.rows.map((row) => row.label)).toEqual(['Départ', 'Destination']);
    expect(profile.cells.map((cell) => cell.label)).toEqual(['Départ', 'Retour ou durée']);
  });

  it('S11-09: le sejour pose le depart, le lieu de base et les deux dates', () => {
    // Un seul lieu suffisait a l affichage, pas a la generation :
    // `requestDraftedItinerary` rend une proposition vide sans `route.origin`.
    // Le sejour n affichant pas de depart, « Creer mon parcours » pouvait
    // s activer et ne rien faire. La consigne demande de toute facon un point
    // de depart OU d arrivee sur chaque ecran.
    const profile = stepOneProfile('sejour');
    expect(profile.rows.map((row) => row.label)).toEqual([
      'Lieu de départ',
      'Destination ou hébergement de base',
    ]);
    // « Lieu de depart » et non « Depart » : la cellule de retour porte deja
    // ce mot, et deux « Depart » sur un meme ecran sont ambigus.
    expect(profile.cells.map((cell) => cell.label)).toEqual(['Arrivée', 'Départ']);
    expect(profile.singlePlace).toBeNull();
  });

  it('S11-10: l activite locale pose un lieu de pratique et une duree indicative', () => {
    const profile = stepOneProfile('local');
    expect(profile.rows).toHaveLength(1);
    expect(profile.rows[0].label).toBe('Lieu de pratique');
    expect(profile.cells.map((cell) => cell.label)).toEqual(['Date', 'Durée indicative']);
    expect(profile.cta).toBe('Préparer ma sortie');
  });
});

describe('S11 — ce qui manque, sans question inutile', () => {
  it('S11-11: le sejour sans depart est ACCEPTE, le moteur part sans origine', () => {
    // AVANT : le sejour n affichait meme pas la question du depart, donc rien
    // n expliquait l arret. Le garde-fou `origin` de `hasEngineMinimum` a ete
    // retire (B4) : le squelette se construit, les etapes sans point reel
    // deviennent des notes, et AUCUNE origine n est fabriquee.
    const draft = fullDraft({
      activities: SEJOUR,
      route: { origin: null, destination: ARGENTIERE, shape: 'boucle' },
    });
    expect(draft.route.origin).toBeNull();
    expect(canCreateStepOne(draft)).toBe(true);
  });

  it('S11-11bis: RACCORD UI — le sejour sans depart n annonce aucun bloqueur', () => {
    // ROUGE VOLONTAIRE. `ENGINE_BLOCKING = ['activity', 'origin']`
    // (components/stepOneProfile.ts:269, HORS PERIMETRE) nomme encore
    // « lieu de depart » comme arret, alors que le CTA est actif.
    // RACCORD : retirer 'origin' de ENGINE_BLOCKING, ligne 269.
    const draft = fullDraft({
      activities: SEJOUR,
      route: { origin: null, destination: ARGENTIERE, shape: 'boucle' },
    });
    expect(canCreateStepOne(draft)).toBe(true);
    // CIBLE : `blocking` ne nomme que ce qui arrete vraiment. Le resume
    // historique (`stepOneMissingSummary`) peut, lui, continuer de lister
    // l absence — c est AN7-7, et c est honnete tant qu il ne pretend pas
    // etre un arret.
    expect(stepOneMissing(draft, 'sejour').blocking).toEqual([]);
  });

  it('S11-11b: le sejour avec depart n affiche plus aucune arret', () => {
    const draft = fullDraft({
      activities: SEJOUR,
      route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'boucle' },
    });
    expect(canCreateStepOne(draft)).toBe(true);
    expect(stepOneMissing(draft, 'sejour').blocking).toEqual([]);
  });

  it('S11-28: partir librement permet de creer sans activite du catalogue', () => {
    // « Partir librement » laisse le catalogue sans exiger d activity. Si le
    // bouton de creation continuait de la reclamer, le parcours promettait un
    // choix libre et se terminait sur un « Il manque : activité ».
    const draft = fullDraft({
      activities: { primary: null, extra: [], nights: [] },
      pickerDismissed: true,
      route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
    });
    // Seule l arrivee reste signalee, comme pour n'importe quel parcours sans
    // arrivee : l activity n est plus une question posee.
    expect(stepOneMissingSummary(draft, 'trajet')).toBe('Il manque : lieu d’arrivée');
    expect(canCreateStepOne(draft)).toBe(true);
  });

  it('S11-12: l activite locale ne demande pas d arrivee', () => {
    const draft = fullDraft({
      activities: LOCAL,
      route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
    });
    expect(stepOneMissingSummary(draft, 'local')).toBeNull();
    expect(canCreateStepOne(draft)).toBe(true);
  });

  it('S11-13: l arrivee est signalee mais n exige pas d arrivee distincte', () => {
    const draft = fullDraft({
      activities: RANDO,
      route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
    });
    // Elle est nommee pour que l utilisateur sache ce que l IA choisira, mais
    // elle ne bloque jamais : le parcours devient une boucle.
    expect(stepOneMissingSummary(draft, 'trajet')).toBe('Il manque : lieu d’arrivée');
    expect(canCreateStepOne(draft)).toBe(true);
  });

  it('S11-14: le voyage regroupe les deux dates sous un seul libelle', () => {
    const draft = fullDraft({
      activities: ROADTRIP,
      route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
      calendar: CAL_EMPTY,
    });
    expect(stepOneMissingSummary(draft, 'voyage')).toBe('Il manque : destination, dates');
  });

  it('S11-15: le sejour resume ses deux dates en une seule ligne', () => {
    const draft = fullDraft({
      activities: SEJOUR,
      route: { origin: null, destination: ARGENTIERE, shape: 'boucle' },
      calendar: CAL_EMPTY,
    });
    // Le depart vient en tete parce qu il BLOQUE ; les deux dates sont
    // regroupees et facultatives — l IA les propose si personne ne les pose.
    expect(stepOneMissingSummary(draft, 'sejour')).toBe(
      'Il manque : lieu de départ, dates du séjour',
    );
  });

  it('S11-16: l activite locale nomme la date et la duree', () => {
    const draft = fullDraft({
      activities: LOCAL,
      route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
      calendar: CAL_EMPTY,
    });
    expect(stepOneMissingSummary(draft, 'local')).toBe('Il manque : date, durée');
  });

  it('S11-17: la date seule ne bloque jamais la generation', () => {
    const draft = fullDraft({
      activities: RANDO,
      calendar: { startDate: null, durationDays: 2, durationIsSuggested: false, startDateIsSuggested: false, returnDate: null },
    });
    expect(canCreateStepOne(draft)).toBe(true);
  });
});

describe('S11 — rendu des ecrans 10, 11, 12 et 13', () => {
  it('S11-18: ecran 10 — l invite IA puis l appel, sans bascule de forme', () => {
    const html = render(fullDraft({ activities: RANDO }));
    const text = visible(html);
    expect(text).toContain('Créer mon parcours');
    expect(text).not.toContain('Boucle');
    expect(text).not.toContain('Aller simple');
    expect(html).toContain('Qu’est-ce que tu as en tête ?');
  });

  it('S11-19: ecran 11 — un voyage propose une destination, sans choisir de forme', () => {
    const draft = fullDraft({
      activities: ROADTRIP,
      route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'aller_simple' },
    });
    const text = visible(render(draft));
    expect(text).toContain('Destination');
    expect(text).toContain('Retour ou durée');
    expect(text).not.toContain('Aller simple');
    // Tant que l'IA n'a rien fige, le sens du trajet reste inversable.
    expect(text).toContain('Inverser départ et arrivée');
  });

  it('S11-20: ecran 12 — un sejour ne demande qu un lieu de base', () => {
    const draft = fullDraft({
      activities: SEJOUR,
      route: { origin: null, destination: ARGENTIERE, shape: 'aller_simple' },
    });
    const text = visible(render(draft));
    expect(text).toContain('Destination ou hébergement de base');
    expect(text).toContain('Arrivée');
    expect(text).not.toContain('Boucle');
  });

  it('S11-21: ecran 13 — une activite locale se prepare avec son propre appel', () => {
    const draft = fullDraft({
      activities: LOCAL,
      route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
    });
    const text = visible(render(draft));
    expect(text).toContain('Lieu de pratique');
    expect(text).toContain('Durée indicative');
    expect(text).toContain('Préparer ma sortie');
    expect(text).not.toContain('Créer mon parcours');
  });

  it('S11-22: aucun ecran ne fabrique de date, de prix ou de distance', () => {
    for (const activities of [RANDO, ROADTRIP, SEJOUR, LOCAL]) {
      const text = visible(render(fullDraft({ activities })));
      expect(text).not.toMatch(/\d+\s*€/);
      expect(text).not.toMatch(/\d+\s*km\b/i);
      expect(text).not.toMatch(/\d+\s*%/);
    }
  });
  it('S11-26: une arrivee manquante ne bloque pas — l’IA choisit la boucle', () => {
    // L'arrivee est une aide, pas une condition : sans elle le parcours reboucle
    // depuis le depart. Le CTA reste actif. AN7 : l arrivee ne s annonce plus
    // comme un MANQUE — ce mot ne nomme plus que les seuls bloqueurs — mais
    // comme ce que l IA propose. C est vrai, et ca se lit d un coup d oeil.
    const base = fullDraft({ activities: RANDO });
    const partial = { ...base, route: { ...base.route, destination: null } };
    const text = visible(render(partial));
    expect(stepOneProfileIdFor(RANDO)).toBe('trajet');
    expect(canCreateStepOne(partial)).toBe(true);
    expect(text).toContain('Créer mon parcours');
    expect(text).not.toContain('Compléter');
    expect(text).not.toContain('Il manque');
    expect(text).toContain('L’IA proposera : lieu d’arrivée');
  });
  it('S11-27: l ecran local ne parle jamais de depart', () => {
    // L'ecran 13 affiche « Lieu de pratique » et dit « Pas de trajet » :
    // annoncer « Il manque : lieu de départ » serait une contradiction. Le
    // resume nomme le champ tel que l'ecran l'affiche.
    const base = fullDraft({ activities: LOCAL });
    const sansLieu = { ...base, route: { ...base.route, origin: null } };
    const sansRien = {
      ...base,
      route: { ...base.route, origin: null },
      calendar: { ...base.calendar, startDate: null },
    };
    expect(stepOneMissingSummary(sansLieu, 'local')).toBe('Il manque : lieu de pratique');
    expect(stepOneMissingSummary(sansRien, 'local')).toBe('Il manque : lieu de pratique, date');
    expect(stepOneMissingSummary(sansRien, 'local')).not.toContain('depart');
  });
});
