import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrepCrumb } from '../components/PrepCrumb';
import { PrepNavActions } from '../components/AdventurePrepShell';
import { fullDraft } from './fixtures';
import { canOpenStep, hasStepContent } from '../engine/steps';
import { buildItinerary } from '../engine/itinerary';
import type { AdventurePrepDraft, PrepStepId } from '../types';

/*
 * AN1 - navigation tactile entre les etapes.
 *
 * Mesure d avant (393x852, etape 3, Parcours reel genere) : le rail rendait
 * trois <span>, et le seul retour vers une etape atteinte etait un bouton
 * `Revenir a ...` place dans un conteneur `prep-visually-hidden` mesure a
 * 1x1 px, clip-path inset(50%) - donc hors de portee du doigt. Consequence
 * mesuree : depuis l etape 3 on ne pouvait revenir ni a l etape 1 ni a l
 * etape 2, sauf recharger l URL.
 *
 * Contrat nouveau : le bandeau ne gagne AUCUN bouton chromé (pas de fleche,
 * pas de croix, pas de filtres, pas d icone) - la demande utilisateur est
 * explicite. En revanche une etape ATTEINTE devient un bouton invisible a
 * l oeil : memes police, meme soulignement, meme couleur, meme metriques. La
 * difference invisible, c est qu elle repond au doigt.
 */

const noop = (): void => undefined;

function rail(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(React.createElement(PrepCrumb, { step, draft, onOpenStep: noop }));
}

/** Sans callback, le rail doit redevenir purement informatif. */
function railInerte(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(React.createElement(PrepCrumb, { step, draft }));
}

/**
 * Les trois etapes atteintes : le cas nominal de l etape 3.
 *
 * L itineraire vient du MOTEUR (buildItinerary), pas d un objet fabrique a la
 * main : un itineraire bricole ne prouverait que le rendu du gabarit, pas la
 * regle de joignabilite, qui lit isStepSatisfied -> itinerary !== null.
 */
function step3(): AdventurePrepDraft {
  const draft = fullDraft({ completedSteps: ['destination', 'itinerary'] });
  return { ...draft, itinerary: buildItinerary(draft) };
}

describe('AN1 - le rail rend une etape atteinte reellement actionnable', () => {
  it('AN1-1: a l etape 3, l etape 1 atteinte est un bouton, plus un span', () => {
    const html = rail('departure', step3());
    expect(html).toContain('data-step="destination"');
    expect(html).toMatch(/<button[^>]*data-step="destination"/);
  });

  it('AN1-2: a l etape 3, l etape 2 atteinte est un bouton', () => {
    const html = rail('departure', step3());
    expect(html).toMatch(/<button[^>]*data-step="itinerary"/);
  });

  it('AN1-3: l etape courante n est jamais un bouton - on ne se navigue pas tout seul', () => {
    const html = rail('departure', step3());
    expect(html).not.toMatch(/<button[^>]*data-step="departure"/);
    expect(html).toContain('aria-current="step"');
  });

  it('AN1-4: une etape verrouillee n est PAS un bouton et le dit', () => {
    const draft = fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } });
    const html = rail('destination', draft);
    expect(html).not.toMatch(/<button[^>]*data-step="(itinerary|departure)"/);
    expect(html).toContain('data-locked="true"');
  });

  it('AN1-5: le bouton porte le nom de l etape ET la prise "Revenir a", pour le lecteur d ecran', () => {
    const html = rail('departure', step3());
    expect(html).toContain('aria-label="Revenir à Créations"');
    expect(html).toContain('aria-label="Revenir à Préparation"');
  });

  it('AN1-6: le bouton est un bouton de type button, jamais un submit implicite', () => {
    const html = rail('departure', step3());
    expect(count(html, /type="button"/g)).toBe(2);
  });
});

describe('AN1 - le bandeau ne gagne aucun bouton chromé', () => {
  it('AN1-7: aucune icône, aucun role=button parasite, aucun titre de bouton', () => {
    const html = rail('departure', step3());
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('Revenir en arrière');
    expect(html).not.toContain('Fermer et revenir au hub');
  });

  it('AN1-8: tout bouton du rail pointe vers une etape REELLEMENT atteinte', () => {
    // Le rail n'ouvre que ce qui existe deja. On verifie l'invariant plutot
    // qu'une liste d'etapes : quel que soit le draft, aucun bouton ne peut
    // pointer vers une etape que le moteur refuserait d'ouvrir.
    const drafts = [
      fullDraft(),
      fullDraft({ completedSteps: ['destination'] }),
      fullDraft({ completedSteps: ['destination', 'itinerary'] }),
      fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } }),
    ];
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      for (const draft of drafts) {
        const html = rail(step, draft);
        for (const match of html.matchAll(/data-step="([a-z]+)"/g)) {
          expect(canOpenStep(draft, match[1] as PrepStepId)).toBe(true);
        }
      }
    }
  });

  it('AN1-8b: a l etape 1, le rail n offre aucun retour : donc aucun bouton', () => {
    expect(rail('destination', fullDraft())).not.toContain('<button');
  });

  it('AN1-9b: sans onOpenStep, le rail redevient purement informatif', () => {
    const html = railInerte('departure', step3());
    expect(html).not.toContain('<button');
    expect(html).toContain('Créations');
  });

  it('AN1-9: le bouton garde exactement l aspect du libelle (classe dediee, pas de chrome)', () => {
    const html = rail('departure', step3());
    const bouton = /<button[^>]*data-step="destination"[^>]*>/.exec(html)?.[0] ?? '';
    expect(bouton).toContain('class="prep-crumb__link"');
    expect(bouton).not.toMatch(/background|border-radius|padding:/);
  });
});

describe('AN1 - le rail ne ment jamais sur ce qui repond au doigt', () => {
  it('AN1-12: depuis l etape 2, l etape 3 atteinte redevient proposable', () => {
    // Mesure du 28/09 : depuis l etape 2, « En avant ! » etait peint en vert
    // souligné - donc lu comme un lien - mais rendu en <span>. Raison mesuree :
    // state venait de canOpenStep alors que reachable venait de
    // isStepSatisfied, qui renvoie false en permanence pour departure.
    const draft = step3();
    const html = rail('itinerary', draft);
    expect(html).toMatch(/<button[^>]*data-step="departure"/);
  });

  it('AN1-13: tout segment peint « done » repond au doigt', () => {
    // L invariant qui aurait attrape le defaut : la peinture et le
    // comportement doivent sortir de la MEME predicate. Un segment vert
    // souligne qui ne repond pas est une affordance fausse.
    const avecItineraire = step3();
    const sansItineraire = fullDraft();
    const bloque = fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } });
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      for (const draft of [avecItineraire, sansItineraire, bloque]) {
        const html = rail(step, draft);
        for (const match of html.matchAll(/data-state="([a-z_]+)"[^>]*data-step="([a-z]+)"/g)) {
          const [, state, target] = match;
          if (state !== 'done') continue;
          expect(canOpenStep(draft, target as PrepStepId)).toBe(true);
          expect(hasStepContent(draft, target as PrepStepId)).toBe(true);
          expect(html).toMatch(new RegExp('<button[^>]*data-step="' + target + '"'));
        }
      }
    }
  });

  it('AN1-13b: sans itineraire, aucune etape n est peinte « done » hors etape courante', () => {
    const html = rail('destination', fullDraft());
    expect(count(html, /data-state="done"/g)).toBe(0);
    expect(html).not.toContain('<button');
  });
});

describe('AN1 - plus de double navigation cachee', () => {
  it('AN1-10: PrepNavActions ne duplique plus les "Revenir a <etape>" clippés', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrepNavActions, { onOpenPreferences: noop, onGoHub: noop })
    );
    expect(html).not.toContain('Revenir à Créations');
    expect(html).not.toContain('Revenir à Préparation');
  });

  it('AN1-11: les deux actions hors-etape (hub, preferences) subsistent', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrepNavActions, { onOpenPreferences: noop, onGoHub: noop })
    );
    expect(html).toContain('Revenir au hub');
    expect(html).toContain('Ouvrir les préférences du trajet');
  });
});

function count(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}
