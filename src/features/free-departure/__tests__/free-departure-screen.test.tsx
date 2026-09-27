import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreeDepartureScreen } from '../components/FreeDepartureScreen';
import { activityById } from '@/features/adventure-prep/catalog';
import type { ActivityGuess } from '../engine/activityGuess';
import type { LocationPermission } from '../engine/location';

/**
 * zustand v5 sert le `getServerSnapshot` — l'etat INITIAL — pendant
 * `renderToStaticMarkup`. Injecter un etat via `setState` n'aurait donc
 * aucun effet. On remplace le store par un selecteur pur : le composant
 * under-test est reellement execute, seule la source de donnees change.
 */
const state = vi.hoisted(() => ({ current: { activityId: null as string | null } }));

vi.mock('../store/useFreeDepartureStore', () => {
  const use = ((selector: (store: { activityId: string | null }) => unknown) =>
    selector(state.current)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useFreeDepartureStore: use };
});

const HANDOFF = {
  onRequestPermission: () => undefined,
  onStart: () => undefined,
  onClose: () => undefined,
  onPickActivity: () => undefined,
};

/** Une proposition plausible, telle que `guessActivity` la produirait. */
function guess(): ActivityGuess {
  return {
    activityId: 'course',
    label: activityById('course')?.label ?? 'Course',
    icon: 'footprints',
    because: 'vitesse moyenne 10 km/h, sur 1 h 20, 13,3 km',
    confidence: 'proposee',
  };
}

function render(options: { guess?: ActivityGuess | null; permission?: LocationPermission } = {}) {
  state.current = { activityId: null };
  return renderToStaticMarkup(
    React.createElement(FreeDepartureScreen, {
      guess: options.guess === undefined ? null : options.guess,
      permission: options.permission ?? 'inconnue',
      ...HANDOFF,
    })
  );
}

/**
 * Texte reellement affiche, balises et attributs retires.
 *
 * Les regles produit portent sur ce que l'utilisateur LIT, pas sur les noms de
 * classes : les garder dans l'assertion rendrait le test fragile et faux.
 */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'é')
    .replace(/&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(activityId: string | null): string {
  state.current = { activityId };
  return renderToStaticMarkup(
    React.createElement(FreeDepartureScreen, {
      guess: null,
      permission: 'inconnue',
      ...HANDOFF,
    })
  );
}

describe('FreeDepartureScreen — ecran de depart libre (A11)', () => {
  it('FREE-S01: annonce qu’aucun itineraire n’est a preparer', () => {
    const text = visible(render());
    expect(text).toContain('Aucun itinéraire à préparer');
    expect(text).toContain('Partir librement');
  });

  it('FREE-S02: sans mesure, l’ecran DIT qu’il ne sait pas plutot que deviner', () => {
    const text = visible(render());
    expect(text).toContain('Détection automatique');
    expect(text).toContain('Activité à identifier');
    // Aucune activite n'est inventee tant qu'aucune mesure n'existe.
    expect(text).not.toContain(activityById('rando-journee')?.label ?? '@@absent');
  });

  it('FREE-S03: une proposition est affichee AVEC sa justification', () => {
    const text = visible(render({ guess: guess() }));
    expect(text).toContain(activityById('course')?.label ?? '@@absent');
    expect(text).toContain('vitesse moyenne 10 km/h');
  });

  it('FREE-S04: un choix manuel n’est jamais ecrase par la proposition', () => {
    state.current = { activityId: 'rando-journee' };
    const html = renderToStaticMarkup(
      React.createElement(FreeDepartureScreen, {
        guess: guess(),
        permission: 'inconnue',
        ...HANDOFF,
      })
    );
    const text = visible(html);
    expect(text).toContain(activityById('rando-journee')?.label ?? '@@absent');
    expect(text).toContain('Activité choisie par toi');
    expect(text).not.toContain('Proposition d’après');
  });

  it('FREE-S05: revenir a l’automatique reaffiche « à identifier »', () => {
    expect(visible(pick(null))).toContain('Activité à identifier');
  });

  it('FREE-S06: l’usage de la localisation est explique AVANT la demande', () => {
    const text = visible(render());
    expect(text).toContain('La position sert uniquement à enregistrer ta trace');
    expect(text).toContain('Rien n’est envoyé ni partagé');
    expect(text).toContain('Localisation non activée');
  });

  it('FREE-S07: un refus est explique sans jamais bloquer le depart', () => {
    const text = visible(render({ permission: 'refusee' }));
    expect(text).toContain('Localisation refusée');
    expect(text).toContain('Tu pars sans trace ni distance');
    // Le refus est une information, pas une porte : le depart reste la.
    expect(text).toContain('Démarrer');
  });

  it('FREE-S08: « Demarrer » reste disponible quel que soit l’etat de localisation', () => {
    for (const permission of ['inconnue', 'accordee', 'refusee', 'indisponible'] as const) {
      expect(visible(render({ permission })), permission).toContain('Démarrer');
    }
  });

  it('FREE-S09: une panne GPS n’est jamais presentee comme un refus', () => {
    const text = visible(render({ permission: 'indisponible' }));
    expect(text).toContain('indisponible sur cet appareil');
    expect(text).not.toContain('Tu pars sans trace ni distance');
  });

  it('FREE-S10: le depart libre n’est jamais chiffre (A9)', () => {
    const text = visible(render({ guess: guess(), permission: 'accordee' }));
    // Ni pourcentage, ni note sur 100, ni score : l'ecran n'a pas de note.
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('FREE-S11: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render()).not.toContain('safe-area-inset');
  });
});
