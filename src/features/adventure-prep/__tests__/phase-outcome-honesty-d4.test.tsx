import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  finishGeneration,
  initialGeneration,
  setPhaseOutcomes,
  startGeneration,
} from '../engine/generation';
import { draftActions } from '../store/reducer';
import { failedGenerationPhase, failedGenerationReason, type GenerationState } from '../types';
import type { PhaseOutcome } from '../engine/resilience';
import { PrepOfflineNotice } from '../components/AdventurePrepShell';
import { offlineReadiness } from '../engine/resilience';
import { fullDraft } from './fixtures';
import type { ItineraryModel } from '../types';
import { buildItinerary } from '../engine/itinerary';

/**
 * D4 — un echec partiel doit etre ANNONCE, avec une action pour le reparer.
 *
 * Le moteur rend deja un verdict honnete par phase (`PhaseOutcome`), et
 * `phaseHealth` sait deja le resume. Aucun des deux n etait branche : le
 * parcours degenere arrivait a l ecran avec des « A verifier » partout, sans
 * bandeau, sans raison et sans reessai. Ces tests echouent sur cette version.
 */

function verdict(
  id: PhaseOutcome['id'],
  status: PhaseOutcome['status'],
  reason: string | null = null
): PhaseOutcome {
  return { id, status, reason, retryable: true };
}

/** Les six verdicts d un run reussi, tels que le moteur les rend. */
const REUSSI: readonly PhaseOutcome[] = [
  verdict('recherche_parcours', 'reussie'),
  verdict('verification_etapes', 'reussie'),
  verdict('disponibilites', 'reussie'),
  verdict('lieux', 'reussie'),
  verdict('trace', 'reussie'),
  verdict('meteo', 'reussie'),
  verdict('synthese', 'reussie'),
];

/** Le traceur muet, le meteo muet : le parcours existe, deux mesures manquent. */
const DEGRADE: readonly PhaseOutcome[] = REUSSI.map((phase) =>
  phase.id === 'trace'
    ? verdict('trace', 'echoue', 'Le calcul des distances na pas abouti.')
    : phase.id === 'meteo'
      ? verdict('meteo', 'inverifiable', 'Aucune meteo mesuree pour ces dates.')
      : phase
);

function terminee(verdicts: readonly PhaseOutcome[]): GenerationState {
  return setPhaseOutcomes(finishGeneration(startGeneration(initialGeneration())), verdicts);
}

/** Un etat sans verdicts : le cas d un brouillon enregistre avant ce correctif. */
function sansVerdicts(): GenerationState {
  const { outcomes: _absent, ...ancien } = initialGeneration();
  return ancien as GenerationState;
}

function bandeau(generation: GenerationState): string {
  const readiness = offlineReadiness({
    model: null,
    online: true,
    aiEnabled: true,
    aiFailure: generation.failure,
  });
  const fallen = failedGenerationPhase(generation);
  return renderToStaticMarkup(
    React.createElement(PrepOfflineNotice, {
      online: true,
      readiness,
      failedPhase: fallen,
      failureReason: failedGenerationReason(generation),
      onRetryPhase: fallen ? () => undefined : null,
    })
  );
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('D4 — echec partiel annonce et reparable', () => {
  it('D4-1: un verdict moteur échoué désigne une phase rejouable', () => {
    const fallen = failedGenerationPhase(terminee(DEGRADE));
    expect(fallen?.id).toBe('trace');
  });

  it('D4-2: un run entièrement reussi ne fabrique aucune phase à rejouer', () => {
    expect(failedGenerationPhase(terminee(REUSSI))).toBeNull();
  });

  it('D4-3: une mesure absente compte comme un echec — meme action', () => {
    const onlyWeather = terminee(REUSSI.filter((phase) => phase.id !== 'meteo'));
    const meteo = verdict('meteo', 'inverifiable', 'Aucune meteo mesuree.');
    const fallen = failedGenerationPhase(setPhaseOutcomes(onlyWeather, [...REUSSI, meteo]));
    expect(fallen?.id).toBe('meteo');
  });

  it('D4-4: un brouillon sans verdicts ne fabrique rien', () => {
    // Les brouillons enregistres avant ce correctif n ont pas le champ. Le
    // deriveur doit lire l absence comme une absence, jamais comme un echec.
    expect(() => failedGenerationPhase(sansVerdicts())).not.toThrow();
    expect(failedGenerationPhase(sansVerdicts())).toBeNull();
  });

  it('D4-5: la generation terminee reste terminée, meme degradee', () => {
    // Un parcours affiche n autorise pas a rebasculer l ecran en « echec » :
    // la reprise se joue phase par phase, pas en relancant tout.
    expect(terminee(DEGRADE).status).toBe('termine');
  });

  it('D4-6: le bandeau nomme la phase tombee et propose de reessayer', () => {
    const html = bandeau(terminee(DEGRADE));
    const text = visible(html);
    expect(text).toContain('Échec');
    expect(text).toContain('Calcul des distances sur le réseau');
    expect(html).toContain('Réessayer');
  });

  it('D4-7: rien ne s affiche quand tout a reussi', () => {
    // Pas de bandeau de papier peint : un « tout va bien » permanent ferait
    // oublier le seul bandeau qui compte.
    expect(bandeau(terminee(REUSSI))).toBe('');
  });

  it('D4-8: la reprise arme la phase tombee et efface son verdict perime', () => {
    const draft = fullDraft({ itinerary: null, generation: terminee(DEGRADE) });
    expect(failedGenerationPhase(draft.generation)?.id).toBe('trace');
    const replay = draftActions.retryPhase(draft, 'trace');
    expect(replay.generation.status).toBe('en_cours');
    // La phase rejouee cesse d’etre accusee d’echec pendant qu’elle travaille.
    expect(failedGenerationPhase(replay.generation)?.id).not.toBe('trace');
  });

  it('D4-8b: la meteo absente reste nommee apres la reprise du trace', () => {
    // Un bandeau qui disparaitrait des la premiere reprise rejouee cacherait un
    // manque toujours reel. Ce qui a ete rejoue cesse d’etre accuse ; ce qui
    // reste absent reste dit.
    const draft = fullDraft({ itinerary: null, generation: terminee(DEGRADE) });
    const replay = draftActions.retryPhase(draft, 'trace');
    expect(failedGenerationPhase(replay.generation)?.id).toBe('meteo');
  });

  it('D4-10: le nom de la phase tombée n’est jamais coupé', () => {
    // Mesuré sur `proof/D4-20` : le bandeau affichait « Échec : Calcul des di… ».
    // Un nom tronqué ne dit pas ce qui a échoué, donc le bandeau ne sert plus a rien.
    const style = readFileSync(
      join(__dirname, '..', 'components', 'AdventurePrepShell.tsx'),
      'utf8'
    );
    const bloc = style.slice(
      style.indexOf('const NOTICE_HEADLINE'),
      style.indexOf('const NOTICE_ACTION')
    );
    // Pas de coupure, pas d’ellipse : le titre peut passer a la ligne.
    expect(bloc).not.toContain('textOverflow: ');
    expect(bloc).not.toContain('whiteSpace: ');
    expect(bloc).toContain('overflowWrap: ');
  });

  it('D4-9: le depot du parcours conserve les verdicts du moteur', () => {
    // Sans ce depot, le bandeau disparait au retour sur l ecran : les
    // verdicts doivent survivre au run qui les a produits.
    const base = fullDraft({ completedSteps: ['destination', 'itinerary'] });
    const avecItineraire = { ...base, itinerary: buildItinerary(base) };
    const replay = draftActions.retryPhase(
      { ...avecItineraire, generation: terminee(DEGRADE) },
      'trace'
    );
    const rendu = draftActions.applyPhaseRetry(replay, {
      phase: 'trace',
      model: replay.itinerary as ItineraryModel,
      outcome: verdict('trace', 'reussie'),
    });
    // Le parcours d’origine est conserve a l’identique : une reprise ne
    // remplace le modele que si le moteur en a rendu un nouveau.
    expect(rendu.itinerary).toBe(replay.itinerary);
    // La phase rejoue avec succes cesse d’etre accusee, et son verdict passe
    // a « reussie » : sans ca, le bandeau la reproposerait a l’infini.
    expect(failedGenerationPhase(rendu.generation)?.id).not.toBe('trace');
    const redote = rendu.generation.outcomes.find((phase) => phase.id === 'trace');
    expect(redote?.status).toBe('reussie');
  });
});
