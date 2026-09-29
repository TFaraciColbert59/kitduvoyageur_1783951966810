/**
 * P4.6 / P4.4 — La cause du refus de l'IA, du moteur a l'ecran.
 *
 * La chaine etait deja tracee, jamais fermee : `validateDrafted` rendait un
 * `RejectionReason`, `runItineraryGeneration` le portait dans son
 * `GenerationOutcome`, et le store le LAISSAIT TOMBER. `GenerationState`
 * n'avait meme pas le champ. Consequence a l'ecran : le bandeau annoncait
 * « Parcours construit sur tes criteres » sans jamais dire ce qui avait ete
 * refuse — la panne etait invisible, donc ni comprise, ni rejouable.
 *
 * Ces tests verrouillent la chaine entiere, pas un maillon :
 *   1. le store DEPOSE la cause ;
 *   2. `retryPhase` la CONSERVE (le commentaire du reducer l exige) ;
 *   3. un nouveau run l EFFACE, parce qu'un refus n'a pas d'avenir ;
 *   4. chaque raison a une phrase lisible, et cette table est exhaustive ;
 *   5. l'ecran Affiche la cause ;
 *   6. le bouton de reprise est present, nomme, et relance la phase ;
 *   7. sans phase rejouable, il n'y a PAS de bouton — pas de CTA mort.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { draftActions } from '../store/reducer';
import { initialGeneration, startGeneration } from '../engine/generation';
import { rejectionMessage } from '../engine/itineraryPhases';
import { failedGenerationPhase } from '../types';
import type { RejectionReason } from '../engine/itineraryEngine';
import type { GenerationOutcome } from '../engine/itineraryPhases';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

// --- Le store est observe, jamais simule : on veut le VRAI draft reduit. ---
const state = vi.hoisted(() => ({
  current: null as { draft: AdventurePrepDraft; retryPhase: (id: string) => void } | null,
}));
vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (s: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

const { ItineraryStepScreen } = await import('../components/ItineraryStep');

const ALL_REASONS: readonly RejectionReason[] = [
  'chevauchement_horaire',
  'affirmation_non_sourcee',
  'aucune_etape',
  'journee_non_couverte',
  'brief_non_honore',
  'programme_absent',
];

function model(): ItineraryModel {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

function outcome(reason: RejectionReason | null): GenerationOutcome {
  return {
    model: model(),
    engineId: reason === null ? 'ai' : 'rules',
    degraded: reason !== null,
    message: reason === null ? null : 'Parcours construit sur tes criteres.',
    rejectedReason: reason,
    failure: null,
    suggestedStartDate: null,
    suggestedDurationDays: null,
    phases: [{ id: 'verification_etapes', status: 'echoue', reason: 'refus', retryable: true }],
    infeasible: [],
    toVerify: [],
  };
}

describe('P4.6 — la cause du refus est deposee, et elle survit a la reprise', () => {
  it('P4.6-01: applyGenerated conserve la raison portee par le moteur', () => {
    // Le trou historique : `applyGenerated` ne depositait que `notice` et
    // `failure`. La cause existait dans l'outcome et disparaissait ici.
    const next = draftActions.applyGenerated(fullDraft(), outcome('journee_non_couverte'));
    expect(next.generation.rejectedReason).toBe('journee_non_couverte');
  });

  it('P4.6-02: une generation sans refus ne laisse pas de cause derriere elle', () => {
    // Le symetrique obligatoire : un `undefined` laisse par defaut ne
    // vaudrait pas « pas de cause », et l'ecran afficherait un refus fantome.
    const next = draftActions.applyGenerated(fullDraft(), outcome(null));
    expect(next.generation.rejectedReason).toBeNull();
  });

  it('P4.6-03: retryPhase CONSERVE la cause — elle est encore vraie', () => {
    // Le commentaire du reducer (`reducer.ts`, l.170-173) l impose : effacer la
    // cause au clic la ferait disparaitre au moment precis ou la personne
    // cherche a comprendre. Ce que la reprise perime, c'est le VERDICT.
    const applied = draftActions.applyGenerated(fullDraft(), outcome('aucune_etape'));
    expect(failedGenerationPhase(applied.generation)?.id).toBe('verification_etapes');
    const retried = draftActions.retryPhase(applied, 'verification_etapes');
    expect(retried.generation.rejectedReason).toBe('aucune_etape');
    // ... et le verdict, lui, a bien peri : c'est ce qui rend la reprise utile.
    expect(failedGenerationPhase(retried.generation)).toBeNull();
  });

  it('P4.6-04: un NOUVEAU run efface la cause — un refus n a pas d avenir', () => {
    // Un refus est un fait passe. Le run suivant doit repartir de zero, sinon
    // l'ecran afficherait encore « le planning propose ne contenait aucune
    // etape » alors que le parcours affiche, lui, en contient.
    const applied = draftActions.applyGenerated(fullDraft(), outcome('aucune_etape'));
    const relaunched = draftActions.setGeneration(applied, startGeneration(applied.generation));
    expect(relaunched.generation.rejectedReason).toBeNull();
  });

  it('P4.6-04b: le store appelle BIEN cette remise a zero', () => {
    // Le test precedent teste le reducteur ; celui-ci prouve que le store
    // passe bien par lui. Un store qui construirait son propre etat — meme
    // correct en surface — laisserait la cause au sol.
    const store = readFileSync(
      join(__dirname, '..', 'store', 'useAdventurePrepStore.ts'),
      'utf8'
    );
    // L'ecriture du store tient sur deux lignes : on capture donc la
    // fenetre qui suit sa DERNIERE occurrence (la premiere est l'interface).
    const at = store.lastIndexOf('startGenerationRun: () =>');
    expect(at).toBeGreaterThan(-1);
    expect(store.slice(at, at + 200)).toContain(
      'startGeneration(draft.generation)'
    );
  });

  it('P4.6-05: les deux etats initiaux du moteur portent le champ', () => {
    // `generation.ts` a DEUX `GenerationState` completees. Oublier la seconde
    // (celle du run) laissait `undefined` au premier rendu d'un rejeu.
    expect(initialGeneration().rejectedReason).toBeNull();
    expect(startGeneration(initialGeneration()).rejectedReason).toBeNull();
  });
});

describe('P4.6 — la table de l ecran est exhaustive et lisible', () => {
  it('P4.6-06: chaque raison a une phrase, et toutes sont distinctes', () => {
    const phrases = ALL_REASONS.map((reason) => rejectionMessage(reason));
    for (const [index, phrase] of phrases.entries()) {
      expect(phrase.length, ALL_REASONS[index]).toBeGreaterThan(20);
      // Une phrase d'ecran n'est ni un identifiant technique, ni un dump :
      // « aucune_etape » sur l'ecran serait exactement le trou qu'on comble.
      expect(phrase, ALL_REASONS[index]).not.toBe(ALL_REASONS[index]);
      expect(phrase, ALL_REASONS[index]).not.toContain('_');
    }
    expect(new Set(phrases).size).toBe(ALL_REASONS.length);
  });

  it('P4.6-07: une raison hors table ne peut pas exister (exhaustivite du type)', () => {
    // Si une septieme raison est ajoutee a `RejectionReason` sans ligne ici, ce
    // fichier ne compile plus. C'est le but : le trou d'affichage devient une
    // erreur de compilation, pas un bandeau vide a l'execution.
    const table: Record<RejectionReason, string> = {
      chevauchement_horaire: rejectionMessage('chevauchement_horaire'),
      affirmation_non_sourcee: rejectionMessage('affirmation_non_sourcee'),
      aucune_etape: rejectionMessage('aucune_etape'),
      journee_non_couverte: rejectionMessage('journee_non_couverte'),
      brief_non_honore: rejectionMessage('brief_non_honore'),
      programme_absent: rejectionMessage('programme_absent'),
    };
    expect(Object.keys(table)).toHaveLength(ALL_REASONS.length);
  });
});

describe('P4.6 / P4.4 — l ecran dit la cause, et propose une reprise reelle', () => {
  function render(draft: AdventurePrepDraft): string {
    state.current = {
      draft,
      retryPhase: () => undefined,
    };
    return renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }));
  }

  it('P4.6-08: la cause du refus est affichee, en toutes lettres', () => {
    const draft = draftActions.applyGenerated(fullDraft(), outcome('journee_non_couverte'));
    const html = render(draft);
    // On n assert PAS le message du moteur : c'est un motif sans accents,
    // fait pour un lecteur de code. On assert que l'ecran, lui, parle.
    expect(html).toContain(rejectionMessage('journee_non_couverte'));
    expect(html).toContain('avait reçu aucune étape');
  });

  it('P4.4-01: la reprise nomme la phase tombee, et n existe que si elle est rejouable', () => {
    const draft = draftActions.applyGenerated(fullDraft(), outcome('aucune_etape'));
    const fallen = failedGenerationPhase(draft.generation);
    expect(fallen?.id).toBe('verification_etapes');
    const html = render(draft);
    // Un CTA mort est un bouton dont l'appel rend le brouillon intact. Le nom
    // de la phase est ce qui distingue « relance » de « recharge ».
    expect(html).toContain('Relancer');
    expect(html).toContain(fallen?.label ?? '');
  });

  it('P4.4-02: AUCUN bouton quand rien n a echoue — pas de CTA mort', () => {
    // Le cas le pluspiege : un parcours sain affiche quand meme « Relancer ».
    // Le clic armerait une phase qui n'est pas tombee, donc ne ferait RIEN.
    const sain = draftActions.applyGenerated(
      fullDraft(),
      { ...outcome(null), phases: [{ id: 'verification_etapes', status: 'reussie', reason: null, retryable: true }] }
    );
    expect(failedGenerationPhase(sain.generation)).toBeNull();
    expect(render(sain)).not.toContain('Relancer');
  });

  it('P4.6-09: sans refus ni notice, le bandeau n existe pas', () => {
    const sain = draftActions.applyGenerated(
      fullDraft(),
      { ...outcome(null), message: null, phases: [] }
    );
    expect(render(sain)).not.toContain('prep-notice');
  });
});
