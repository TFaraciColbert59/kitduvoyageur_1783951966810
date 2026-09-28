import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrepCrumb, type PrepNavProps } from '../components/PrepCrumb';
import { fullDraft } from './fixtures';
import { buildItinerary } from '../engine/itinerary';
import type { AdventurePrepDraft, PrepStepId } from '../types';

/*
 * Rail d etapes : trois libelles, un etat par segment, AUCUN bouton.
 *
 * Ces tests echouent tant que le bandeau expose une action : ils sont la preuve
 * executable de la demande « aucun bouton en haut de page, seulement
 * l affichage ameliore des etapes ».
 */

function crumb(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(React.createElement(PrepCrumb, { step, draft }));
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

/** Les libelles herites des trois boutons supprimes. */
const LEGACY_LABELS = [
  'Revenir en arrière',
  'Fermer et revenir au hub',
  'Ouvrir les préférences du trajet',
];

describe('Rail d etapes - contenu', () => {
  it('CR-01: les trois segments sont là, dans l’ordre', () => {
    const text = visible(crumb('destination', fullDraft()));
    expect(text).toContain('Créations');
    expect(text).toContain('Préparation');
    expect(text).toContain('En avant !');
    expect(text.indexOf('Créations')).toBeLessThan(text.indexOf('Préparation'));
    expect(text.indexOf('Préparation')).toBeLessThan(text.indexOf('En avant !'));
  });

  it('CR-02: l’étape courante est portée par aria-current, jamais par la couleur seule', () => {
    expect(crumb('itinerary', fullDraft())).toContain('aria-current="step"');
  });

  it('CR-03: une seule étape est courante, sur les trois états', () => {
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      expect(count(crumb(step, fullDraft()), /aria-current="step"/g)).toBe(1);
    }
  });

  it('CR-04: chaque segment porte exactement un état : actif, terminé ou verrouillé', () => {
    // Un etat « atteint » sans itineraire n existe pas : l etape 3 se peint
    // d apres ce qu elle affiche, donc il lui faut un itineraire reel.
    const base = fullDraft({ completedSteps: ['destination', 'itinerary'] });
    const html = crumb('departure', { ...base, itinerary: buildItinerary(base) });
    const states = [...html.matchAll(/data-state="([a-z_]+)"/g)].map((match) => match[1]);
    expect(states).toEqual(['done', 'done', 'active']);
  });

  it('CR-04b: un segment painted vert est un segment qui a du contenu', () => {
    // Le rail peint « done » depuis hasStepContent : vert et souligne veut
    // dire « atteignable », jamais « dans les Entrées de couleur seules ».
    const base = fullDraft({ completedSteps: ['destination', 'itinerary'] });
    const avecItineraire = { ...base, itinerary: buildItinerary(base) };
    const states = [...crumb('destination', avecItineraire).matchAll(/data-state="([a-z_]+)"/g)];
    expect(states.map((m) => m[1])).toEqual(['active', 'done', 'done']);
    const sansItineraire = [...crumb('destination', base).matchAll(/data-state="([a-z_]+)"/g)];
    expect(sansItineraire.map((m) => m[1])).toEqual(['active', 'locked', 'locked']);
  });

  it('CR-05: une étape terminée est signalée sans être activée', () => {
    const html = crumb('departure', fullDraft({ completedSteps: ['destination', 'itinerary'] }));
    expect(html).toContain('data-state="done"');
    expect(html).toContain('data-done="true"');
  });

  it('CR-06: une étape verrouillée est annoncée, et distincte d’une étape terminée', () => {
    const draft = fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } });
    const html = crumb('destination', draft);
    expect(html).toContain('data-state="locked"');
    expect(html).toContain('data-locked="true"');
    expect(html).not.toContain('data-done="true"');
  });

  it('CR-07: les deux séparateurs sont décoratifs, jamais annoncés', () => {
    const html = crumb('destination', fullDraft());
    expect(count(html, /aria-hidden="true"/g)).toBe(2);
  });
});

describe('Rail d etapes - absence de commande', () => {
  it('CR-08: sans navigation, le rail ne rend AUCUN bouton, quelle que soit l’étape', () => {
    // Ce test couvre le rail INERTE (pas de onOpenStep), pas le rail navigable :
    // le contrat de ce dernier est verifie dans step-rail-nav-an1.test.tsx.
    // Il reste vrai - et il compte : une prop de navigation doit etre
    // explicite, jamais deduite.
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      const html = crumb(step, fullDraft({ completedSteps: ['destination', 'itinerary'] }));
      expect(html).not.toContain('<button');
    }
  });

  it('CR-09: le rail ne rend AUCUNE icône', () => {
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      expect(crumb(step, fullDraft())).not.toContain('<svg');
    }
  });

  it('CR-10: aucun des libellés des trois boutons retirés ne subsiste', () => {
    const html = crumb('itinerary', fullDraft());
    for (const label of LEGACY_LABELS) {
      expect(html).not.toContain(label);
    }
  });

  it('CR-11: le seul nom accessible du rail est celui de son conteneur', () => {
    const html = crumb('destination', fullDraft());
    expect(count(html, /aria-label="/g)).toBe(1);
    expect(html).toContain('aria-label="Étapes de la préparation"');
  });
});

describe('Rail d etapes - sémantique', () => {
  it('CR-12: les segments sont des éléments de liste d’une liste nommée', () => {
    const html = crumb('destination', fullDraft());
    expect(html).toContain('<ol');
    expect(html).toContain('aria-label="Étapes de la préparation"');
    expect(count(html, /class="prep-crumb__item"/g)).toBe(3);
  });

  it('CR-13: le rail reste lisible quand aucun segment n’est atteint', () => {
    const draft = fullDraft({
      route: { origin: null, destination: null, shape: 'boucle' },
      completedSteps: [],
    });
    const text = visible(crumb('destination', draft));
    expect(text).toContain('Créations');
    expect(text).toContain('En avant !');
  });
});

/* Props legacies tolerees au typage : elles doivent etre inertes, pas
   reinterpretées par un appelantancien. */
export type LegacyPrepNavProps = PrepNavProps & {
  onOpenStep: () => void;
  onClose: () => void;
  onOpenPreferences: () => void;
};
