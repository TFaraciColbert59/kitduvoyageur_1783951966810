/**
 * L2 — Les quatre lignes de l etape 1 « Creations », une par item de section.
 *
 * POURQUOI CE FICHIER SEPARE DE `l2-etape1-perimetre.test.tsx`
 *
 * L autre fichier prouve des ABSENCES (le scroller de jours, la carte, les
 * controles de carte ne doivent pas etre sur l etape 1). Celui-ci prouve des
 * PROPRES : ce que chaque ligne doit exactement afficher. Les deux ensemble
 * ferment l etape 1.
 *
 * PERIMETRE
 *
 *   L2.3  la ligne Depart est une boussole, sans texte
 *   L2.4  l arrivee est optionnelle et jamais pre-remplie
 *   L2.5  un seul picker de date, departure OU arrivee
 *   L2.6  la ligne Temps est une duree estimee, pas une duree totale
 *
 * L2.7 (le scroller de jours appartient a l etape 2) est deja prouve par
 * `l2-etape1-perimetre.test.tsx`, avec son contre-exemple. On ne le double pas.
 *
 * AUCUNE DONNEE INVENTEE
 *
 * Tous les rendus viennent de `fullDraft()` : Chamonix -> Argentiere, depart
 * le 11 juillet 2026, 3 jours. Aucun lieu, aucune date, aucune duree n est
 * fabriquee ici. Quand une valeur manque, le test attend `A_VERIFIER` — il
 * n attend jamais un nombre plausible.
 *
 * Harnais : `renderToStaticMarkup`, comme le reste du dossier. Le store est
 * pilote par `getState()`, ce n est pas une doublure.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DestinationStep } from '../components/DestinationStep';
import { CalendarSheet } from '../components/PrepSetupSheets';
import { canCreateStepOne, stepOneMissing, stepOneProfile } from '../components/stepOneProfile';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';

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

/** Le store n est jamais appele sous `renderToStaticMarkup` : un stub suffit. */
const actions = {
  setRoute: () => undefined,
  setCalendar: () => undefined,
  setGroup: () => undefined,
} as unknown as AdventurePrepStore;

const css = (): string => readFileSync(path.resolve(__dirname, '../adventure-prep.css'), 'utf8');

function rendre(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DestinationStep, { onOpenSheet: noop }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ce que l OEIL voit, une fois les fragments reserves aux lecteurs retires.
 *
 * `visible()` ne fait que retirer les balises : le texte qu elles enveloppaient
 * reste. Sans cette fonction, « Depart » disparaitrait de l assertion alors
 * qu il est present, et le test ne prouverait rien. On retire donc explicitement
 * les spans `prep-visually-hidden` — dont on a verifie plus bas que la CSS les
 * cache reellement — et ce qui reste est ce qui s affiche.
 */
function pourLesYeux(html: string): string {
  return visible(html.replace(/<span class="prep-visually-hidden">[^<]*<\/span>/g, ' '));
}

function count(html: string, motif: RegExp): number {
  return html.match(motif)?.length ?? 0;
}

/**
 * Le HTML d UNE ligne du bloc parcours, bouton compris.
 *
 * Les lignes se suivent dans l ordre du profil : la premiere est le depart.
 * On isole le bouton entier pour que l assertion porte sur la ligne Depart et
 * pas sur le depart mentionne ailleurs dans l ecran.
 */
function ligne(html: string, index: number): string {
  const marqueur = 'class="prep-block__row"';
  let position = -1;
  for (let i = 0; i <= index; i += 1) {
    position = html.indexOf(marqueur, position + 1);
    if (position === -1) throw new Error(`ligne ${index} absente du rendu`);
  }
  const debut = html.lastIndexOf('<button', position);
  const fin = html.indexOf('</button>', position);
  return html.slice(debut, fin + '</button>'.length);
}

/** Le bouton de creation, isole : c est lui qui dit si l ecran peut partir. */
function cta(html: string): string {
  const debut = html.indexOf('prep-footer');
  if (debut === -1) throw new Error('pied de page absent du rendu');
  return html.slice(debut, html.indexOf('</button>', debut) + '</button>'.length);
}

/** Un brouillon sans arrivee : le cas que L2.4 doit rendre supportable. */
function sansArrivee(): AdventurePrepDraft {
  return fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'aller_simple' } });
}

/* ------------------------------------------------------------------ */
/* L2.3 — la ligne Depart : une boussole, sans texte                   */
/* ------------------------------------------------------------------ */

describe('L2-3 — la ligne Depart est une boussole seule', () => {
  it('L2-03 : la ligne Depart porte l icone boussole', () => {
    const depart = ligne(rendre(fullDraft()), 0);
    expect(depart).toContain('aria-label="compass"');
    expect(depart).not.toContain('aria-label="map-pin"');
  });

  it('L2-03b : la ligne Depart n affiche aucun texte', () => {
    // `prep-block__label` est la classe que le CSS rend visible. Son absence
    // est ce qui distingue « pas de texte » de « du texte cache » — et c est
    // la seule assertion qui ne peut pas passer par hasard.
    const depart = ligne(rendre(fullDraft()), 0);
    expect(depart).not.toContain('prep-block__label');
    expect(pourLesYeux(depart)).not.toContain('Départ');
    // Contre-exemple : le mot disparait, le LIEU reste. Une ligne Depart sans
    // Boussole ET sans valeur ne serait plus une ligne, ce serait un trou.
    expect(pourLesYeux(depart)).toContain('Chamonix');
  });

  it('L2-03c : la ligne Depart garde un nom accessible', () => {
    // Un bouton sans nom n existe pas pour un lecteur d ecran. Le mot reste
    // dans le DOM, mais dans la classe reservee aux lecteurs — et cette classe
    // est verifiee reellement cachee par le CSS, pas par convention.
    const depart = ligne(rendre(fullDraft()), 0);
    expect(depart).toContain('prep-visually-hidden');
    expect(depart).toContain('Départ');
    expect(css()).toMatch(/\.prep-visually-hidden\s*\{[^}]*clip-path:\s*inset\(50%\)/);
  });

  it('L2-03d : contre-exemple — la ligne Arrivee, elle, garde son libelle', () => {
    // Sans ce contre-exemple, L2-03b passerait aussi si les deux lignes
    // avaient perdu leur texte : on ne prouve alors plus rien sur le Depart.
    const arrivee = ligne(rendre(fullDraft()), 1);
    expect(arrivee).toContain('prep-block__label');
    expect(arrivee).not.toContain('prep-visually-hidden');
    expect(pourLesYeux(arrivee)).toContain('Arrivée');
  });

  it('L2-03e : la boussole vaut sur les quatre profils', () => {
    // Le Depart est le meme element d un ecran a l autre : le changer sur un
    // seul profil laisserait la ligne revertee a une epingle sur un sejour.
    for (const id of ['trajet', 'voyage', 'sejour', 'local'] as const) {
      const depart = stepOneProfile(id).rows.find((row) => row.field === 'origin');
      expect(depart?.icon).toBe('compass');
    }
  });
});

/* ------------------------------------------------------------------ */
/* L2.4 — l arrivee : optionnelle, jamais pre-remplie                   */
/* ------------------------------------------------------------------ */

describe('L2-4 — l arrivee est facultative et jamais inventee', () => {
  it('L2-04 : sans arrivee, le CTA reste actif', () => {
    // C est la regle qui rend l arrivee OPTIONNELLE : si elle bloquait, la
    // ligne « Il manque » mentirait sur ce que l ecran peut faire.
    expect(canCreateStepOne(sansArrivee())).toBe(true);
    // Et sur l ecran : le bouton de creation n est pas inactif. C est lui que
    // la personne touche, pas la fonction qui le decide.
    expect(cta(rendre(sansArrivee()))).not.toContain('disabled=""');
  });

  it('L2-04b : l arrivee est annoncee comme facultative, jamais comme bloquant', () => {
    const manque = stepOneMissing(sansArrivee(), 'trajet');
    expect(manque.blocking).toEqual([]);
    expect(manque.optional.length).toBeGreaterThan(0);
  });

  it('L2-04c : l arrivee reste offerte et modifiable a l ecran', () => {
    const html = rendre(sansArrivee());
    const arrivee = ligne(html, 1);
    expect(pourLesYeux(arrivee)).toContain('Arrivée');
    // Une absence se dit telle qu elle est : aucune ville, aucun pays invente.
    expect(pourLesYeux(arrivee)).toContain('À vérifier');
  });

  it('L2-04d : le rendu ne pre-remplit jamais l arrivee', () => {
    // On garde la reference AVANT le rendu et on la relit APRES. Un
    // `useEffect` qui ecrirait un lieu par defaut se verrait ici.
    const draft = sansArrivee();
    expect(draft.route.destination).toBeNull();
    rendre(draft);
    expect(draft.route.destination).toBeNull();
  });

  it('L2-04f : contre-exemple — un depart manquant, lui, ne bloque PLUS', () => {
    // Sans ce contre-exemple, L2-04 prouverait que la sonde ne voit jamais
    // `disabled`, pas que l arrivee ne bloque pas. B4 a aligne le depart sur
    // l arrivee : les deux sont facultatifs, et le bouton reste ouvert.
    // Le CONTRE-EXEMPLE qui redeeme la sonde est redeplace en L2-04g.
    const d = fullDraft();
    const sansDepart: AdventurePrepDraft = { ...d, route: { ...d.route, origin: null } };
    expect(cta(rendre(sansDepart))).not.toContain('disabled=""');
  });

  it('L2-04g : contre-exemple — sans INTENTION, le bouton se referme bien', () => {
    // C est lui qui prouve que la sonde voit `disabled` : sans lui, L2-04f
    // pourrait passer pour une sonde aveugle.
    const d = fullDraft();
    const sansIntention: AdventurePrepDraft = {
      ...d,
      activities: { primary: null, extra: [], nights: [] },
      pickerDismissed: false,
    };
    expect(cta(rendre(sansIntention))).toContain('disabled=""');
  });

  it('L2-04e : contre-exemple — une arrivee reelle s affiche', () => {
    expect(visible(ligne(rendre(fullDraft()), 1))).toContain('Argentière');
  });
});

/* ------------------------------------------------------------------ */
/* L2.5 — un seul picker de date                                       */
/* ------------------------------------------------------------------ */

describe('L2-5 — un seul picker, departure OU arrivee', () => {
  it('L2-05 : le bloc date n expose qu UNE date et UNE duree', () => {
    // Deux cellules, mais une seule est une date. La duree n est pas un second
    // picker : c est ce qui faisait croire a deux calendriers.
    expect(stepOneProfile('trajet').cells.map((cell) => cell.field)).toEqual([
      'startDate',
      'duration',
    ]);
    const html = rendre(fullDraft());
    expect(count(html, /aria-label="calendar"/g)).toBe(1);
    expect(count(html, /class="prep-cell"/g)).toBe(2);
  });

  it('L2-05b : le tiroir Quand ne rend qu un seul calendrier', () => {
    const html = renderToStaticMarkup(
      React.createElement(CalendarSheet, { draft: fullDraft(), actions, onClose: noop }),
    );
    expect(count(html, /aria-label="Calendrier"/g)).toBe(1);
  });

  it('L2-05c : aucune date de retour a saisir, ni dans l ecran ni dans le tiroir', () => {
    const tiroir = renderToStaticMarkup(
      React.createElement(CalendarSheet, { draft: fullDraft(), actions, onClose: noop }),
    );
    expect(visible(tiroir)).not.toContain('date de retour');
    // Un calendrier unique ne peut pas exposer deux entrees de date.
    expect(count(rendre(fullDraft()), /class="prep-cell"/g)).toBe(2);
  });

  it('L2-05d : contre-exemple — la date reelle du brouillon est bien affichee', () => {
    // Sans ce contre-exemple, L2-05 prouverait seulement que la sonde ne
    // trouve rien. Le depart du fixture doit apparaitre tel quel.
    expect(visible(rendre(fullDraft()))).toContain('Sam. 11 juil.');
  });
});

/* ------------------------------------------------------------------ */
/* L2.6 — la ligne Temps : une duree estimee                           */
/* ------------------------------------------------------------------ */

describe('L2-6 — la ligne Temps est une duree estimee', () => {
  it('L2-06 : la cellule s appelle Duree estimee', () => {
    expect(stepOneProfile('trajet').cells[1].label).toBe('Durée estimée');
    expect(visible(rendre(fullDraft()))).toContain('Durée estimée');
  });

  it('L2-06b : elle ne se presente plus comme un temps disponible', () => {
    // « Temps disponible » est une enveloppe de temps a remplir, pas une
    // duree : l item demande une ESTIMATION, pas un budget.
    expect(visible(rendre(fullDraft()))).not.toContain('Temps disponible');
  });

  it('L2-06c : la valeur reste la duree REELLE du brouillon', () => {
    // 3 jours vient de `fullDraft().calendar.durationDays = 3`. Rien n est
    // arrondi, rien n est estime par l affichage.
    expect(visible(rendre(fullDraft()))).toContain('3 jours');
  });

  it('L2-06d : sans duree, la cellule dit qu elle ne sait pas', () => {
    const draft = fullDraft({
      calendar: {
        startDate: '2026-07-11',
        startDateIsSuggested: false,
        durationDays: null,
        durationIsSuggested: false,
        returnDate: null,
      },
    });
    expect(visible(rendre(draft))).toContain('À vérifier');
  });
});