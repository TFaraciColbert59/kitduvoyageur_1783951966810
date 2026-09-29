/**
 * Chrome du preparateur — le rail, le bloqueur du CTA, et l absence de chrome.
 *
 * Chaque test de ce fichier MORD : il echoue si le defaut qu il decrit est
 * retabli. Aucun ne verifie une propriete deja vraie avant la correction.
 *
 * Le defaut du rail, mesure le 2026-09-29 sur `/prepare?nouvelle=1` en
 * 393x852 : `ActivityPickerScreen` est monte, et le rail affiche
 * `aria-current="step"` sur « Creations ». `step` vaut pourtant bien
 * « destination » — c est `PrepFlow` qui le calcule — donc passer `step` au
 * rail affirmait une etape affichee qui ne l etait pas. `progressOf(draft)`,
 * derive de `draft.currentStep`, repetait le meme mensonge dans la region
 * `aria-live`.
 *
 * Le defaut du bloqueur, mesure le meme jour : « Il manque : lieu de depart »
 * existait dans le DOM, a `top 611`, dans un scroller de `clientHeight 467` et
 * `scrollTop 0`. Le pli, pas le pied : `.prep-footer` est `position: relative`
 * (mesure : `top 523 / bottom 593`) et ne recouvre rien. Le message doit donc
 * etre RESERVE hors du scroller, pas seulement rendu.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AdventurePrepShell,
  prepRailState,
  prepRailAnnouncement,
  prepBlockerSummary,
  PREP_ACTIVITE_SCREEN,
  type AdventurePrepShellProps,
} from '../components/AdventurePrepShell';
import { stepOneMissing, stepOneProfileIdFor } from '../components/stepOneProfile';
import { initialGeneration } from '../engine/generation';
import { buildItinerary } from '../engine/itinerary';
import {
  PREP_STEPS,
  PREP_STEP_LABELS,
  type AdventurePrepDraft,
  type GenerationState,
  type PrepStepId,
} from '../types';
import { fullDraft, ARGENTIERE } from './fixtures';

/* ------------------------------------------------------------------ */
/* Store et routeur neutres                                            */
/* ------------------------------------------------------------------ */

interface StoreFaux {
  draft: AdventurePrepDraft;
  goToStep: (id: PrepStepId) => void;
  retryPhase: (id: string) => void;
  applyPhaseRetry: (result: unknown) => void;
}

const state = vi.hoisted(() => ({ current: null as StoreFaux | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: StoreFaux) => unknown) =>
    selector(state.current as StoreFaux)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const noop = () => undefined;

/* ------------------------------------------------------------------ */
/* Montee                                                             */
/* ------------------------------------------------------------------ */

/** L'ecran enfant, identifiable dans le HTML par un marqueur unique. */
const ENFANT = React.createElement(
  'section',
  { className: 'prep-screen', 'data-child': 'ecran' },
  'ECRAN ENFANT'
);

function monter(
  step: PrepStepId,
  draft: AdventurePrepDraft,
  extras: Partial<AdventurePrepShellProps> = {}
): string {
  state.current = { draft, goToStep: noop, retryPhase: noop, applyPhaseRetry: noop };
  const props: AdventurePrepShellProps = { step, onOpenSheet: noop, children: ENFANT, ...extras };
  return renderToStaticMarkup(React.createElement(AdventurePrepShell, props));
}

function generation(status: GenerationState['status']): GenerationState {
  return { ...initialGeneration(), status };
}

function avecParcours(base: AdventurePrepDraft = fullDraft()): AdventurePrepDraft {
  const model = buildItinerary(base);
  if (!model) throw new Error('parcours attendu');
  return { ...base, itinerary: model };
}

/** Brouillon ou il manque exactement le depart, et rien d'autre de bloquant. */
function sansDepart(): AdventurePrepDraft {
  return fullDraft({
    route: { origin: null, destination: ARGENTIERE, shape: 'aller_simple' },
  });
}

/** Brouillon ou il manque l'intention ET le depart : deux bloqueurs. */
function sansIntentionNiDepart(): AdventurePrepDraft {
  return fullDraft({
    activities: { primary: null, extra: [], nights: [] },
    pickerDismissed: false,
    route: { origin: null, destination: ARGENTIERE, shape: 'aller_simple' },
  });
}

/* ------------------------------------------------------------------ */
/* Lectures du HTML rendu                                             */
/* ------------------------------------------------------------------ */

/** Les libelles de segment, dans l'ordre du DOM, segments ET pilules. */
function segments(html: string): string[] {
  return [...html.matchAll(/class="prep-crumb__(?:label|link)"[^>]*>([^<]*)</g)].map((m) => m[1]);
}

/** L'element qui porte exactement un attribut, ouvert puis referme. */
function elementPortant(html: string, avant: string, apres: string): string {
  const debut = html.lastIndexOf('<', html.indexOf(avant));
  const fin = html.indexOf(apres, html.indexOf(avant));
  expect(debut, `aucun element avant ${avant}`).toBeGreaterThan(-1);
  return html.slice(debut, fin + apres.length);
}

/**
 * Le source du composant, commentaires retires.
 *
 * Un test de code mort qui lit les commentaires verifierait des phrases
 * expliquant le correctif, pas le code. On les efface donc d abord.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Le contenu de la region annoncee, et rien d'autre. */
function annonce(html: string): string {
  const ouvert = html.indexOf('aria-live="polite">');
  expect(ouvert, 'region annoncee absente').toBeGreaterThan(-1);
  return html.slice(ouvert + 'aria-live="polite">'.length, html.indexOf('</span>', ouvert));
}

/* ------------------------------------------------------------------ */
/* 1 — Le rail dit l etape REELLEMENT affichee                        */
/* ------------------------------------------------------------------ */

describe('CH-RAIL — le rail ne ment pas sur l ecran courant', () => {
  it('CH-RAIL-01: l ecran de selection d activite n affiche AUCUNE etape comme courante', () => {
    const rail = prepRailState({
      picking: true,
      step: 'destination',
      generation: generation('idle'),
    });
    // `step` vaut bien « destination » : le rail ne doit pas le reprendre.
    expect(rail.step).toBeNull();
    expect(rail.screen).toBe('activite');
    expect(rail.label).toBe(PREP_ACTIVITE_SCREEN);
    expect(PREP_STEPS).not.toContain(rail.label);
  });

  it('CH-RAIL-02: le HTML rendu sur l ecran de selection ne porte aucun aria-current', () => {
    const html = monter('destination', fullDraft(), { picking: true });
    // Un seul `aria-current` suffirait a faire mentir le rail.
    expect(html).not.toContain('aria-current');
    expect(segments(html)).toEqual([
      PREP_STEP_LABELS.destination,
      PREP_STEP_LABELS.itinerary,
      PREP_STEP_LABELS.departure,
    ]);
  });

  it('CH-RAIL-03: la region annoncee dit l etape affichee, pas l etape nominale', () => {
    // Le brouillon pense a l etape 3 ; l ecran affiche l etape 2.
    const draft: AdventurePrepDraft = { ...avecParcours(), currentStep: 'departure' };
    const html = monter('itinerary', draft);
    expect(annonce(html)).toBe('Préparation, étape 2 sur 3');
    // L ancienne lecture derivait de `currentStep` : elle annoncait 3 sur 3.
    expect(annonce(html)).not.toContain('Étape 3 sur 3');
  });

  it('CH-RAIL-04: aria-current est present SI ET SEULEMENT si une etape est affichee', () => {
    for (const step of PREP_STEPS) {
      const etape = monter(step, avecParcours());
      const marques = etape.match(/aria-current="step"/g) ?? [];
      expect(marques.length, `etape ${step} affichee`).toBe(1);
      const porteur = elementPortant(etape, 'aria-current="step"', '</span>');
      expect(porteur).toContain(PREP_STEP_LABELS[step]);

      const choix = monter(step, fullDraft(), { picking: true });
      expect(choix.match(/aria-current="step"/g) ?? [], `choix / etape ${step}`).toHaveLength(0);
    }
  });

  it('CH-RAIL-05: la generation a son etat de rail sans deplacer l etape courante', () => {
    const base = avecParcours();
    const enCours = monter('itinerary', { ...base, generation: generation('en_cours') });
    expect(enCours).toContain('data-rail-state="generation"');
    // L ecran de generation est rendu DANS l etape 2 : « Preparation » reste
    // donc le segment courant. Le rail ne doit ni avancer, ni s effacer.
    expect(elementPortant(enCours, 'aria-current="step"', '</span>')).toContain(
      PREP_STEP_LABELS.itinerary
    );

    expect(monter('itinerary', base)).toContain('data-rail-state="step"');
    expect(monter('destination', base, { picking: true })).toContain('data-rail-state="gate"');
  });

  it('CH-RAIL-06: le rail de porte nomme l ecran pour les lecteurs d ecran', () => {
    const html = monter('destination', fullDraft(), { picking: true });
    const cache = html.slice(html.indexOf('class="prep-visually-hidden"'));
    expect(cache).toContain(PREP_ACTIVITE_SCREEN);
    // Chaine annoncee aux lecteurs d ecran : elle porte ses accents. Un retour
    // a « activite » nu se lirait a voix haute sur un mot casse.
    expect(PREP_ACTIVITE_SCREEN).toContain('activité');
    // Les trois noms exacts restent, dans l ordre : pas de rail vide.
    expect(segments(html)).toEqual([
      PREP_STEP_LABELS.destination,
      PREP_STEP_LABELS.itinerary,
      PREP_STEP_LABELS.departure,
    ]);
  });

  it('CH-RAIL-07: le rail couvre exactement les deux ecrans que ce shell rend', () => {
    const base = avecParcours();
    const ecrans = new Set<string>();
    for (const picking of [true, false]) {
      for (const step of PREP_STEPS) {
        ecrans.add(
          prepRailState({ picking, step, generation: generation('idle') }).screen
        );
      }
    }
    // L ecran de reprise est rendu par PrepFlow AVANT le shell : ecrire un
    // etat pour lui ici serait un etat que rien ne peut produire.
    expect([...ecrans].sort()).toEqual(['activite', 'etape']);
    expect(prepRailAnnouncement(prepRailState({ picking: true, step: 'itinerary', generation: generation('en_cours') })))
      .toBe(PREP_ACTIVITE_SCREEN);
  });
});

/* ------------------------------------------------------------------ */
/* 2 — « Il manque : … » reserve dans le flux                          */
/* ------------------------------------------------------------------ */

describe('CH-BLOCK — le message du CTA est visible sans defiler', () => {
  it('CH-BLOCK-01: le message vient du moteur, aucune liste reecrite dans le cadre', () => {
    const draft = sansDepart();
    const attendu = `Il manque : ${stepOneMissing(draft, stepOneProfileIdFor(draft.activities)).blocking.join(', ')}`;
    expect(prepBlockerSummary(draft, 'destination')).toBe(attendu);
    expect(attendu).toMatch(/^Il manque : /);
    // Reintroduire une liste ecrite au dur dans le cadre echouerait ici des la
    // premiere divergence entre le cadre et l ecran.
    expect(prepBlockerSummary(sansIntentionNiDepart(), 'destination')).toBe(
      `Il manque : ${stepOneMissing(sansIntentionNiDepart(), stepOneProfileIdFor(sansIntentionNiDepart().activities)).blocking.join(', ')}`
    );
  });

  it('CH-BLOCK-02: le message est dans le cadre, hors du scroller de l ecran enfant', () => {
    const html = monter('destination', sansDepart());
    const atMessage = html.indexOf('class="prep-blocker"');
    const atEnfant = html.indexOf('data-child="ecran"');
    expect(atMessage).toBeGreaterThan(-1);
    // Avant l ecran enfant, donc hors de son scroller et de son pied de page.
    expect(atMessage).toBeLessThan(atEnfant);
    expect(html.slice(atEnfant)).not.toContain('prep-blocker');
    // Et apres le rail : c est une bande du cadre, pas un habillage du rail.
    expect(atMessage).toBeGreaterThan(html.indexOf('</nav>'));
  });

  it('CH-BLOCK-03: la bande est reservee dans le flux — elle ne peut pas etre comprimee', () => {
    const html = monter('destination', sansDepart());
    const boite = elementPortant(html, 'class="prep-blocker"', '</p>');
    // `flex: 0 0 auto` : elle ne se comprime pas, elle ne defile pas.
    expect(boite).toContain('flex:0 0 auto');
    expect(boite).toContain('Il manque :');
  });

  it('CH-BLOCK-04: rien n est annonce quand rien ne bloque, ni sur les autres ecrans', () => {
    expect(prepBlockerSummary(avecParcours(), 'destination')).toBeNull();
    // L etape 1 est la seule qui porte ce CTA.
    expect(prepBlockerSummary(sansDepart(), 'itinerary')).toBeNull();
    expect(prepBlockerSummary(sansDepart(), 'departure')).toBeNull();
    // L ecran de selection d activite a son propre message, dans son fichier.
    expect(prepBlockerSummary(sansDepart(), null)).toBeNull();
    expect(monter('destination', avecParcours())).not.toContain('prep-blocker');
  });

  it('CH-BLOCK-05: deux champs manquants sont nommes, tous les deux, dans l ordre du moteur', () => {
    const draft = sansIntentionNiDepart();
    const { blocking } = stepOneMissing(draft, stepOneProfileIdFor(draft.activities));
    expect(blocking).toHaveLength(2);
    const resume = prepBlockerSummary(draft, 'destination');
    expect(resume).toBe(`Il manque : ${blocking.join(', ')}`);
    for (const champ of blocking) expect(resume).toContain(champ);
  });
});

/* ------------------------------------------------------------------ */
/* 3 — Pilules de verre : structure et etats dans le TSX               */
/* ------------------------------------------------------------------ */

describe('CH-PILL — les trois noms exacts, actifs, jamais tronques', () => {
  it('CH-PILL-01: les trois noms sont exacts, dans l ordre, et jamais coupes', () => {
    const attendus = ['Créations', 'Préparation', 'En avant !'];
    expect([...PREP_STEPS.map((id) => PREP_STEP_LABELS[id])]).toEqual(attendus);
    for (const html of [monter('itinerary', avecParcours()), monter('destination', fullDraft(), { picking: true })]) {
      expect(segments(html)).toEqual(attendus);
      expect(html).not.toMatch(/…|&hellip;|&#8230;/);
      expect(html).not.toMatch(/text-overflow|data-truncated/);
    }
  });

  it('CH-PILL-02: le rail de porte reutilise le balisage du rail des etapes', () => {
    const porte = monter('destination', fullDraft(), { picking: true });
    // Une seule recette de verre : les memes classes des deux cotes.
    for (const classe of ['class="prep-crumb', 'prep-crumb__item', 'prep-crumb__sep', 'class="prep-crumb__label"']) {
      expect(porte).toContain(classe);
    }
    // Pas de recette parallele, pas de style en ligne qui l interdirait.
    expect(porte).not.toContain('prep-crumb__label--');
    const rail = porte.slice(porte.indexOf('class="prep-nav"'), porte.indexOf('</nav>'));
    expect(rail).not.toMatch(/style="[^"]*(color|font-weight|background)/);
  });

  it('CH-PILL-03: l actif est porte par l etat ET par aria-current, jamais par la couleur', () => {
    const html = monter('itinerary', avecParcours());
    const actif = elementPortant(html, 'aria-current="step"', '</span>');
    expect(actif).toContain('data-state="active"');
    expect(actif).toContain('data-current="true"');
    // Les deux autres segments ne se pretent pas l etat courant.
    expect(html.match(/data-state="active"/g) ?? []).toHaveLength(1);

    // Sur l ecran de selection : aucun segment actif, et pas de couleur qui
    // pretendrait le contraire.
    const porte = monter('destination', fullDraft(), { picking: true });
    expect(porte).not.toContain('data-state="active"');
    expect((porte.match(/data-state="locked"/g) ?? [])).toHaveLength(3);
  });

  it('CH-PILL-04: tout ce qui repond au doigt dans le rail porte un nom accessible', () => {
    const html = monter('departure', avecParcours());
    const rail = html.slice(html.indexOf('class="prep-nav"'), html.indexOf('</nav>'));
    const boutons = [...rail.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(boutons.length).toBeGreaterThan(0);
    for (const bouton of boutons) {
      expect(bouton).toContain('type="button"');
      const nom = /aria-label="([^"]+)"/.exec(bouton);
      expect(nom, `bouton sans nom accessible : ${bouton}`).not.toBeNull();
      expect(nom?.[1]?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 4 — Plus de bouton retour, ni croix, ni filtres en haut             */
/* ------------------------------------------------------------------ */

describe('CH-CHROME — le bandeau haut ne porte plus de chrome', () => {
  it('CH-CHROME-01: aucun bandeau, sur aucun ecran, ne rend icone ni jauge', () => {
    // Les DEUX bandesaux : celui des etapes et celui du choix d activite.
    for (const html of [
      monter('itinerary', avecParcours()),
      monter('destination', fullDraft(), { picking: true }),
    ]) {
      const bandeau = html.slice(html.indexOf('class="prep-nav"'), html.indexOf('</nav>'));
      expect(bandeau).not.toContain('<svg');
      expect(bandeau).not.toContain('prep-nav__icon');
      expect(bandeau).not.toContain('prep-nav__progress');
    }
  });

  it('CH-CHROME-02: les capacites retirees restent atteignables, hors du flux visible', () => {
    const html = monter('itinerary', avecParcours());
    const groupe = elementPortant(html, 'aria-label="Actions de la préparation"', '</div>');
    expect(groupe).toContain('class="prep-visually-hidden"');
    expect(groupe).toContain('role="group"');
    expect(groupe).toContain('Revenir au hub');
    expect(groupe).toContain('Ouvrir les préférences du trajet');
    expect((groupe.match(/type="button"/g) ?? [])).toHaveLength(2);
    // Elles ne sont pas dans le bandeau : le bandeau est un rail, rien d autre.
    const bandeau = html.slice(html.indexOf('class="prep-nav"'), html.indexOf('</nav>'));
    expect(bandeau).not.toContain('Revenir au hub');
  });

  it('CH-CHROME-03: le retrait n a laisse aucun orphelin aria ni tabinord', () => {
    for (const html of [
      monter('itinerary', avecParcours()),
      monter('destination', sansDepart()),
      monter('departure', fullDraft(), { picking: true }),
    ]) {
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      for (const attribut of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
        for (const m of html.matchAll(new RegExp(`${attribut}="([^"]+)"`, 'g'))) {
          for (const cible of m[1].split(/\s+/)) {
            expect(ids.has(cible), `${attribut} -> ${cible} absent du HTML`).toBe(true);
          }
        }
      }
      // Aucun tabindex pose a la main : le seul focus possible est natif.
      expect(html).not.toContain('tabindex');
      // Aucun role sans nom accessible.
      for (const m of html.matchAll(/role="([^"]+)"([^>]*)>/g)) {
        const [, role, suite] = m;
        if (role === 'group' || role === 'list' || role === 'status' || role === 'navigation') {
          expect(suite, `role ${role} sans nom`).toMatch(/aria-label=|aria-labelledby=/);
        }
      }
    }
  });

  it('CH-CHROME-04: le retrait n a pas laisse de code mort dans le cadre', () => {
    const source = sansCommentaires(
      readFileSync(
        join(process.cwd(), 'src/features/adventure-prep/components/AdventurePrepShell.tsx'),
        'utf8'
      )
    );
    expect(source).not.toMatch(/import\s*\{[^}]*\bButton\b[^}]*\}\s*from/);
    // Les classes CSS du chrome retire ne sont plus posees nulle part.
    expect(source).not.toContain('prep-nav__icon');
    expect(source).not.toContain('prep-nav__progress');
    // L annonce ne repasse pas par l etape nominale.
    expect(source).not.toContain('progressOf');
    // Et aucun etat de rail que rien ne peut produire.
    expect(source).not.toContain('chargement');
  });
});
