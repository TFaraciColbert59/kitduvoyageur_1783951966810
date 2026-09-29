import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrepNav, type PrepNavProps } from '../components/PrepCrumb';
import { PREP_STEPS, PREP_STEP_LABELS, type AdventurePrepDraft, type PrepStepId } from '../types';
import { canOpenStep } from '../engine/steps';
import { fullDraft } from './fixtures';

/**
 * Bandeau haut du preparateur : un rail d etapes, rien d autre.
 *
 * Le fil d Ariane remplace le « Étape 1 sur 3 » : trois segments nommes, un
 * actif — c'est la maquette qui fait foi, un compteur ne dit pas ou l on est.
 */

const noop = (): void => undefined;

function nav(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(React.createElement(PrepNav, { step, draft }));
}

/** Le bandeau reellement monte par le shell : il recoit la navigation. */
function navNav(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(React.createElement(PrepNav, { step, draft, onOpenStep: noop }));
}

/** Props d avant le nettoyage : doivent etre devenues inertes. */
type LegacyPrepNavProps = PrepNavProps & {
  onOpenStep: () => void;
  onClose: () => void;
  onOpenPreferences: () => void;
};

function legacyNav(step: PrepStepId, draft: AdventurePrepDraft): string {
  const props = { step, draft, onOpenStep: noop, onClose: noop, onOpenPreferences: noop };
  return renderToStaticMarkup(React.createElement(PrepNav, props as unknown as LegacyPrepNavProps));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function count(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

describe('Fil d’Ariane — segments', () => {
  it('NA-01: les trois étapes sont nommées dans l’ordre', () => {
    expect(PREP_STEPS).toEqual(['destination', 'itinerary', 'departure']);
    expect(PREP_STEP_LABELS.destination).toBe('Créations');
    expect(PREP_STEP_LABELS.itinerary).toBe('Préparation');
    expect(PREP_STEP_LABELS.departure).toBe('En avant !');
  });

  it('NA-02: le libellé d’un segment est celui de son étape', () => {
    const labels = PREP_STEPS.map((id: PrepStepId) => PREP_STEP_LABELS[id]);
    expect(labels).toEqual(['Créations', 'Préparation', 'En avant !']);
  });
});

describe('Fil d’Ariane — ce qui est atteignable', () => {
  it('NA-03: on peut revenir d’une étape, jamais en avancer d’une', () => {
    const draft = fullDraft({ completedSteps: ['destination', 'itinerary'] });
    expect(canOpenStep(draft, 'destination')).toBe(true);
    expect(canOpenStep(draft, 'departure')).toBe(false);
  });

  it('NA-04: sans depart ni arrivee, l etape 2 s ouvre des qu il y a une intention', () => {
    // B4 : ni le depart ni l arrivee ne ferment l etape 2. Le seul verrou
    // restant est l absence d intention.
    const draft = fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } });
    expect(canOpenStep(draft, 'itinerary')).toBe(true);
    expect(canOpenStep(draft, 'destination')).toBe(true);
    // CONTRE-EXEMPLE : sans sujet pour le modele, l etape reste fermee.
    const sansIntention = fullDraft({
      activities: { primary: null, extra: [], nights: [] },
      route: { origin: null, destination: null, shape: 'boucle' },
    });
    expect(canOpenStep(sansIntention, 'itinerary')).toBe(false);
  });

  it('NA-05: la toute première étape reste toujours ouverte', () => {
    expect(canOpenStep(fullDraft(), 'destination')).toBe(true);
  });

  it('NA-06: l’étape 2 s’ouvre dès que la destination est complète', () => {
    // C’est là que le parcours se construit : elle ne peut pas exiger un
    // itinéraire qui n’existe pas encore.
    expect(canOpenStep(fullDraft(), 'itinerary')).toBe(true);
  });
});

describe('Bandeau haut — il ne reste que le rail', () => {
  it('NA-07: le bandeau est une région de navigation nommée', () => {
    const html = nav('destination', fullDraft());
    expect(html).toContain('<nav');
    expect(html).toContain('aria-label="Progression de la préparation"');
  });

  it('NA-08: le rail remplace le compteur d’étape', () => {
    const text = visible(nav('destination', fullDraft()));
    expect(text).toContain('Créations');
    expect(text).not.toContain('Étape 1 sur 3');
  });

  it('NA-09: le bandeau n expose que le rail, jamais un bouton de chrome', () => {
    // Contrat MODIFIE le 2026-09-28 (AN1). Ce qui reste interdit : tout bouton
    // dote d'un icone, d'un fond ou d'un libelle de commande - la demande
    // utilisateur ("aucun bouton en haut de page") porte sur le CHROME, pas
    // sur le fait qu'un libelle d'etape reponde au doigt. Mesure d avant : le
    // seul retour vers une etape atteinte etait un bouton "Revenir a ..."
    // dans un conteneur 1x1 px, donc hors de portee du doigt. Voir
    // step-rail-nav-an1.test.tsx.
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      const html = navNav(step, fullDraft({ completedSteps: ['destination', 'itinerary'] }));
      // Aucune icone, aucun role=button, aucun titre de bouton de chrome.
      expect(html).not.toContain('<svg');
      expect(html).not.toMatch(/aria-label="Revenir en arri/);
      // Et chaque bouton eventuel est un retour de rail, sans icone.
      for (const m of html.matchAll(/<button([^>]*)>/g)) {
        expect(m[1]).toContain('class="prep-crumb__link"');
        expect(m[1]).toContain('data-step=');
      }
    }
  });

  it('NA-10: plus aucune icône dans tout le bandeau haut', () => {
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      expect(nav(step, fullDraft())).not.toContain('<svg');
    }
  });

  it('NA-11: le bouton de retour a disparu, et avec lui son libellé', () => {
    const html = nav('itinerary', fullDraft());
    expect(html).not.toContain('Revenir en arrière');
    expect(html).not.toContain('chevron-left');
  });

  it('NA-12: la croix de fermeture a disparu, et avec elle son libellé', () => {
    const html = nav('itinerary', fullDraft());
    expect(html).not.toContain('Fermer et revenir au hub');
  });

  it('NA-13: le bouton de filtres a disparu, et avec lui son libellé', () => {
    const html = nav('itinerary', fullDraft());
    expect(html).not.toContain('Ouvrir les préférences du trajet');
  });

  it('NA-14: les trois étapes restent lisibles dans le bandeau', () => {
    const text = visible(nav('itinerary', fullDraft({ completedSteps: ['destination'] })));
    const labels = PREP_STEPS.map((id: PrepStepId) => PREP_STEP_LABELS[id]);
    for (const label of labels) {
      expect(text).toContain(label);
    }
  });
});

describe('Bandeau haut — props retirées', () => {
  it('NA-15: le bandeau se rend avec step et draft, rien d’autre', () => {
    // Si une prop de commande etait encore requise, TypeScript refuserait
    // cet appel : la preuve est le type, la preuve supplementaire est le rendu.
    const html = renderToStaticMarkup(
      React.createElement(PrepNav, { step: 'departure', draft: fullDraft() })
    );
    expect(html).toContain('En avant !');
  });

  it('NA-16: un appelant ancien n’obtient que le rail, et rien de plus', () => {
    // onOpenStep redevenu une vraie prop : c'est lui qui rend le retour
    // tactile possible. onClose et onOpenPreferences, eux, restent inertes -
    // la fleche, la croix et le bouton de filtres ne reviennent pas.
    const html = legacyNav('itinerary', fullDraft({ completedSteps: ['destination'] }));
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('Revenir en arri');
    expect(html).not.toContain('chevron-left');
    expect(html).not.toContain('Ouvrir les pr');
    // le nav + le rail + le nom accessible du bouton de retour
    expect(count(html, /aria-label="/g)).toBe(3);
  });

  it('NA-17: le rail occupe toute la largeur du bandeau', () => {
    // La grille du bandeau garde deux colonnes d icône vides ; sans cet
    // etirement le rail se retrouverait cantonne a 44 px de large.
    const html = nav('destination', fullDraft());
    expect(html).toMatch(/class="prep-crumb"[^>]*style="[^"]*grid-column:\s*1 \/ -1/);
  });
});
