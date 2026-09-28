/**
 * Reprise de phase — un echec n'eteint plus toute l'IA.
 *
 * Le defaut : le shell derivait un `isAiCut` de la seule presence d'une erreur,
 * et le passait a `offlineReadiness` comme un `aiEnabled: false`. Une meteo muette
 * suffisait donc a declarer l'assistant coupe pour TOUTE l'aventure, sans retour.
 * Pire : rien ne proposait de rejouer la phase tombee, puisque l'etat etait lu
 * comme une decision irrevocable de l'utilisateur.
 *
 * Ce que verifie ce fichier, dans l'ordre du defaut :
 * 1. l'IA n'est plus coupee globalement par l'echec d'une phase ;
 * 2. la phase a rejouer est DERIVEE de l'etat reel, jamais supposee ;
 * 3. seul CETTE phase peut etre rejouee, et rien n'est coche sans resultat ;
 * 4. le bandeau tient sur une ligne et reste detaillable.
 *
 * Regle absolue rappelee ici : zero resultat simule. Sans moteur branche, la
 * reprise arme la phase et s'arrete — elle ne fabrique aucun parcours.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AdventurePrepShell,
  PrepOfflineNotice,
  createPrepPhaseRetry,
  prepNoticeHeadline,
  noticeRetryHandler,
  useOfflinePrep,
  type AdventurePrepShellProps,
} from '../components/AdventurePrepShell';
import { draftActions } from '../store/reducer';
import {
  GENERATION_PHASES,
  failGeneration,
  initialGeneration,
} from '../engine/generation';
import { buildItinerary } from '../engine/itinerary';
import { offlineReadiness, OFFLINE_ACTION, type PhaseOutcome } from '../engine/resilience';
import type { PhaseRetry } from '../engine/itineraryPhases';
import { failedGenerationPhase } from '../types';
import { fullDraft } from './fixtures';
import type {
  AdventurePrepDraft,
  GenerationPhase,
  GenerationPhaseId,
  ItineraryModel,
  PrepStepId,
} from '../types';

/* --- Le store et la route sont neutres -------------------------------- */

const state = vi.hoisted(() => ({
  current: null as null | {
    draft: AdventurePrepDraft;
    goToStep: (id: PrepStepId) => void;
    retryPhase: (id: GenerationPhaseId) => void;
    applyPhaseRetry: (retry: unknown) => void;
  },
}));

vi.mock('../store/useAdventurePrepStore', () => {
  type Store = NonNullable<typeof state.current>;
  const use = ((selector: (store: Store) => unknown) =>
    selector(state.current as Store)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const noop = () => undefined;

/* --- Donnees de depart ------------------------------------------------ */

function model(): ItineraryModel {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

/** Un draft dont la generation a echoue sur la phase demandee. */
function draftEchoue(
  phase: GenerationPhaseId,
  reason = 'Le service n a pas repondu.',
): AdventurePrepDraft {
  const base = fullDraft({ itinerary: model() });
  const faites = GENERATION_PHASES.filter((p) => p.id !== phase).map((p) => p.id);
  const generation = failGeneration(initialGeneration(), reason);
  return {
    ...base,
    generation: {
      ...generation,
      phases: generation.phases.map((p) => ({ ...p, done: faites.includes(p.id) })),
    },
  };
}

function monter(
  props: Partial<AdventurePrepShellProps> = {},
  children: React.ReactNode = null,
  draft: AdventurePrepDraft = fullDraft({ itinerary: model() }),
): string {
  state.current = {
    draft,
    goToStep: noop,
    retryPhase: noop,
    applyPhaseRetry: noop,
  };
  const shellProps: AdventurePrepShellProps = { step: 'itinerary', onOpenSheet: noop, children, ...props };
  return renderToStaticMarkup(React.createElement(AdventurePrepShell, shellProps));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function onOutcome(phase: GenerationPhaseId, partial: Partial<PhaseOutcome>): PhaseOutcome {
  return { id: phase, status: 'echoue', reason: 'Raison reelle.', retryable: true, ...partial };
}

function reconnaissance(phase: GenerationPhaseId, retryModel?: ItineraryModel): PhaseRetry {
  return { phase, model: retryModel ?? model(), outcome: onOutcome(phase, { status: 'reussie', reason: null }) };
}
/* ================================================================== */
/* 1. Le kill-switch                                                   */
/* ================================================================== */

function SondeIA() {
  // Le contexte public du shell : c'est lui que les enfants interrogent.
  const coupe = useOfflinePrep().isUnavailable(OFFLINE_ACTION.itineraireIA);
  return React.createElement('p', { 'data-testid': 'sonde' }, String(coupe));
}

describe('Kill-switch — un echec de phase ne coupe plus toute l IA', () => {
  it('SH-GEN-01: une phase tombee ne rend pas l assistant indisponible pour tout le parcours', () => {
    const draft = draftEchoue('meteo');
    const html = monter({}, React.createElement(SondeIA), draft);
    // Avant : `isAiCut` transforms l echec en `aiEnabled: false`, donc true.
    expect(visible(html)).toContain('false');
  });

  it('SH-GEN-02: le bandeau reste affiche malgre tout, et propose de rejouer', () => {
    const draft = draftEchoue('meteo');
    const html = monter({}, null, draft);
    expect(html).toContain('role="status"');
    expect(visible(html)).toContain('Réessayer');
  });

  it('SH-GEN-03: le bandeau nomme la phase reellement tombee, pas une cause supposee', () => {
    const draft = draftEchoue('meteo');
    const html = monter({}, null, draft);
    const attendu = draft.generation.phases.find((p) => p.id === 'meteo');
    expect(attendu).toBeDefined();
    expect(visible(html)).toContain(attendu!.label);
  });
});

/* ================================================================== */
/* 2. La phase a rejouer est derivee, pas supposee                     */
/* ================================================================== */

describe('failedGenerationPhase — la phase derivee de l etat', () => {
  it('SH-GEN-04: un echec designe la PREMIERE phase qui n a rien livre', () => {
    const draft = draftEchoue('verification_etapes');
    const phase = failedGenerationPhase(draft.generation);
    expect(phase?.id).toBe('verification_etapes');
    expect(phase?.label).toBe(GENERATION_PHASES[1]!.label);
  });

  it('SH-GEN-05: sans echec, ou sans phase en attente, rien n est a rejouer', () => {
    const sain = fullDraft();
    expect(failedGenerationPhase(sain.generation)).toBeNull();

    const arretee = draftEchoue('meteo');
    const terminee = {
      ...arretee,
      generation: { ...arretee.generation, status: 'interrompu' as const },
    };
    // Une generation arretee VOLONTAIREMENT n'est pas une panne : c'est le
    // parcours « Reprendre » existant qui la traite, pas une reprise de phase.
    expect(failedGenerationPhase(terminee.generation)).toBeNull();
  });

  it('SH-GEN-06: un echec ou toutes les phases ont livre n invente aucune phase', () => {
    const toutFait = draftEchoue('synthese');
    const generation = {
      ...toutFait.generation,
      phases: toutFait.generation.phases.map((p) => ({ ...p, done: true })),
    };
    expect(failedGenerationPhase(generation)).toBeNull();
  });
});

/* ================================================================== */
/* 3. Seul CETTE phase se rejoue, rien sans resultat                   */
/* ================================================================== */

describe('draftActions.retryPhase — la machine de reprise', () => {
  it('SH-GEN-07: elle re-arme la phase tombee, et ELLE SEULE', () => {
    const draft = draftEchoue('meteo');
    const suivant = draftActions.retryPhase(draft, 'meteo');

    expect(suivant.generation.status).toBe('en_cours');
    expect(suivant.generation.error).toBeNull();
    const meteo = suivant.generation.phases.find((p) => p.id === 'meteo');
    expect(meteo?.done).toBe(false);
    // Les phases deja livrees le restent : une reprise ne rebrique rien.
    for (const phase of suivant.generation.phases) {
      if (phase.id === 'meteo') continue;
      expect(phase.done).toBe(draft.generation.phases.find((p) => p.id === phase.id)!.done);
    }
  });

  it('SH-GEN-08: la derniere cause REELLE reste lisible, et rien n est ajoute', () => {
    const draft = draftEchoue('meteo', 'delai du service');
    const suivant = draftActions.retryPhase(draft, 'meteo');
    expect(suivant.itinerary).toBe(draft.itinerary);
    expect(suivant.generation.steps).toEqual(draft.generation.steps);
    expect(suivant.generation.notice).toBe(draft.generation.notice);
  });

  it('SH-GEN-09: une phase qui n est pas celle qui a echoue est refusee, sans rien ecrire', () => {
    const draft = draftEchoue('meteo');
    const refuse = draftActions.retryPhase(draft, 'trace');
    expect(refuse).toBe(draft);
    expect(refuse.version).toBe(draft.version);
  });
});

/* ================================================================== */
/* 4. La reprise appelle le moteur, et rien d autre                      */
/* ================================================================== */

describe('createPrepPhaseRetry — la porte vers le moteur', () => {
  it('SH-GEN-10: elle ne delega QUE la phase demandee, et une seule fois', async () => {
    const draft = draftEchoue('meteo');
    const appels: GenerationPhaseId[] = [];
    const retryPhase = createPrepPhaseRetry({
      draft: () => draft,
      armPhase: noop,
      applyRetry: noop,
      runPhase: async (_d, _m, phase) => {
        appels.push(phase);
        return reconnaissance(phase);
      },
    });

    await retryPhase('meteo');

    expect(appels).toEqual(['meteo']);
  });

  it('SH-GEN-11: une reprise qui echoue ne coche RIEN et garde le parcours intact', async () => {
    const draft = draftEchoue('meteo');
    const applique: PhaseRetry[] = [];
    const retryPhase = createPrepPhaseRetry({
      draft: () => draft,
      armPhase: noop,
      applyRetry: (retry) => applique.push(retry),
      runPhase: async (_d, _m, phase) => ({
        phase,
        model: draft.itinerary!,
        outcome: onOutcome(phase, { reason: 'Le fournisseur est toujours muet.' }),
      }),
    });

    const resultat = await retryPhase('meteo');

    expect(resultat?.outcome.status).toBe('echoue');
    expect(resultat?.model).toBe(draft.itinerary);
    // Le reducer depose l echec : aucune phase cochee, `status` reste `echec`.
    const apres = draftActions.applyPhaseRetry(draft, resultat!);
    expect(apres.generation.status).toBe('echec');
    expect(apres.generation.error).toBe('Le fournisseur est toujours muet.');
    expect(apres.generation.phases.find((p) => p.id === 'meteo')?.done).toBe(false);
  });

  it('SH-GEN-12: SANS moteur branche, elle arme la phase et s arrete — aucun resultat simule', async () => {
    const draft = draftEchoue('meteo');
    let armee: GenerationPhaseId | null = null;
    let applique = 0;
    const retryPhase = createPrepPhaseRetry({
      draft: () => draft,
      armPhase: (id) => {
        armee = id;
      },
      applyRetry: () => {
        applique += 1;
      },
    });

    const resultat = await retryPhase('meteo');

    expect(armee).toBe('meteo');
    expect(resultat).toBeNull();
    // Aucun parcours fabrique, aucune phase cochee : le rail reste en attente.
    expect(applique).toBe(0);
    expect(draft.itinerary).not.toBeNull();
    const rearme = draftActions.retryPhase(draft, 'meteo');
    expect(rearme.generation.phases.find((p) => p.id === 'meteo')?.done).toBe(false);
    expect(rearme.itinerary).toBe(draft.itinerary);
  });

  it('SH-GEN-13: une phase qui n est pas en echec n appelle jamais le moteur', async () => {
    const draft = draftEchoue('meteo');
    let appels = 0;
    const retryPhase = createPrepPhaseRetry({
      draft: () => draft,
      armPhase: noop,
      applyRetry: noop,
      runPhase: async (_d, _m, phase) => {
        appels += 1;
        return reconnaissance(phase);
      },
    });

    expect(await retryPhase('trace')).toBeNull();
    expect(appels).toBe(0);
  });

  it('SH-GEN-14: une reprise reussie depose le modele REEL et coche cette phase', async () => {
    const draft = draftEchoue('meteo');
    const reel = { ...model(), days: draft.itinerary!.days };
    const retryPhase = createPrepPhaseRetry({
      draft: () => draft,
      armPhase: noop,
      applyRetry: noop,
      runPhase: async (_d, _m, phase) => reconnaissance(phase, reel),
    });

    const resultat = await retryPhase('meteo');
    const apres = draftActions.applyPhaseRetry(draft, resultat!);

    expect(apres.itinerary).toBe(reel);
    expect(apres.generation.phases.find((p) => p.id === 'meteo')?.done).toBe(true);
    expect(apres.generation.status).toBe('termine');
    expect(apres.generation.error).toBeNull();
  });
});
/* ================================================================== */
/* 5. Le bandeau tient sur UNE ligne, le detail reste accessible      */
/* ================================================================== */

function phaseMeteo(): GenerationPhase {
  return { id: 'meteo', label: 'Meteo des jours de ton aventure', done: false };
}

function readinessHORS_LIGNE() {
  return offlineReadiness({ model: model(), online: false, aiEnabled: true });
}

function rendreBandeau(
  props: Partial<React.ComponentProps<typeof PrepOfflineNotice>> = {},
): string {
  return renderToStaticMarkup(
    React.createElement(PrepOfflineNotice, {
      online: false,
      readiness: readinessHORS_LIGNE(),
      ...props,
    }),
  );
}

describe('Bandeau — une ligne, repliable, l info reste la', () => {
  it('SH-GEN-15: il tient sur une ligne repliable, pas sur quatre lignes a plat', () => {
    const html = rendreBandeau();

    // Un `<details>` replie par defaut : une seule ligne visible, le reste a la demande.
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    // Le detail n'est PLUS dans la ligne : la liste sort du resume.
    const resume = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(resume).not.toContain('<ul');
    expect(html.indexOf('</summary>')).toBeLessThan(html.indexOf('<ul'));
  });

  it('SH-GEN-16: le detail complet reste dans le HTML, donc dans les lecteurs d ecran', () => {
    const html = rendreBandeau();
    const attendu = readinessHORS_LIGNE();
    const texte = visible(html);
    expect(texte).toContain('Hors ligne');
    expect(texte).toContain(attendu.summary);
    expect(texte).toContain(attendu.unavailable[0]!.label);
    expect(texte).toContain(attendu.unavailable[0]!.reason);
  });

  it('SH-GEN-17: le titre de la ligne est court et ne contient aucune liste', () => {
    const headline = prepNoticeHeadline({
      online: false,
      unavailableCount: 1,
      failedPhase: null,
    });
    expect(headline).toContain('Hors ligne');
    expect(headline.length).toBeLessThanOrEqual(60);
  });

  it('SH-GEN-18: hors ligne, le titre le dit ; en ligne, il ne l invente pas', () => {
    expect(prepNoticeHeadline({ online: true, unavailableCount: 1, failedPhase: null })).not.toContain(
      'Hors ligne',
    );
  });

  it('SH-GEN-19: la phase tombee est nommee par son LIBELLE REEL, pas par un rang', () => {
    const headline = prepNoticeHeadline({
      online: true,
      unavailableCount: 0,
      failedPhase: phaseMeteo(),
    });
    expect(headline).toContain(phaseMeteo().label);
  });

  it('SH-GEN-20: « Réessayer » n ouvre pas le repli — il rejoue la phase', () => {
    const rejoues: GenerationPhaseId[] = [];
    const evenement = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const handler = noticeRetryHandler((id) => rejoues.push(id), phaseMeteo());

    handler(evenement as never);

    expect(rejoues).toEqual(['meteo']);
    // Sans ca, le clic ferait ouvrir le `<details>` ET tenter la reprise.
    expect(evenement.preventDefault).toHaveBeenCalled();
    expect(evenement.stopPropagation).toHaveBeenCalled();
  });

  it('SH-GEN-21: sans phase tombee, le bandeau ne propose AUCUN bouton inutile', () => {
    const html = rendreBandeau();
    expect(html).not.toContain('Réessayer');
  });

  it('SH-GEN-22: le bouton n existe que sur la phase reellement tombee', () => {
    const html = rendreBandeau({
      failedPhase: phaseMeteo(),
      onRetryPhase: noop,
      failureReason: 'Le fournisseur est muet.',
    });
    expect(visible(html)).toContain('Réessayer');
    expect(visible(html)).toContain('Le fournisseur est muet.');
  });

  it('SH-GEN-23: sans degradation ET sans echec, le bandeau ne rend rien', () => {
    const html = rendreBandeau({
      online: true,
      readiness: offlineReadiness({ model: model(), online: true, aiEnabled: true }),
    });
    expect(html).toBe('');
  });
});