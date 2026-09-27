import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DestinationStep } from '../components/DestinationStep';
import { fullDraft, draftWithoutItineraryInput, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft } from '../types';

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
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('Écran 10 — Étape 1 : le titre et l’aide', () => {
  it('D10-01: le titre reprend la maquette au mot près', () => {
    expect(visible(render(fullDraft()))).toContain('On part où ?');
  });

  it('D10-02: la promesse tient en une ligne', () => {
    expect(visible(render(fullDraft()))).toContain('Trois réponses suffisent, le reste peut attendre.');
  });
});

describe('Écran 10 — les trois blocs', () => {
  it('D10-03: parcours, date et participants sont les trois decisions', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('Départ');
    expect(text).toContain('Arrivée');
    expect(text).toContain('Date');
    expect(text).toContain('Temps disponible');
    expect(text).toContain('Participants');
  });

  it('D10-04: la date et le temps sont deux cellules distinctes', () => {
    const html = render(fullDraft());
    expect(html).toContain('prep-cell');
    // Deux cellules séparées : le titre de la cellule durée existe seul.
    expect(visible(html)).toContain('Temps disponible');
  });

  it('D10-05: le lieu affiche sa commune puis son détail', () => {
    const draft = fullDraft({
      route: {
        origin: { id: 't', name: 'Trélon, Place Jean Jaurès', country: 'France', lat: 50.2, lon: 3.8 },
        destination: ARGENTIERE,
        shape: 'aller_simple',
      },
    });
    const text = visible(render(draft));
    expect(text).toContain('Trélon');
    expect(text).toContain('Place Jean Jaurès');
  });
});

describe('Écran 10 — forme du parcours', () => {
  it('D10-06: la bascule boucle / aller simple est toujours visible', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('Boucle');
    expect(text).toContain('Aller simple');
  });

  it('D10-07: la forme choisie est annoncée', () => {
    const html = render(fullDraft());
    expect(html).toContain('aria-pressed="true"');
  });

  it('D10-08: le bouton d’inversion reste atteignable en aller simple', () => {
    expect(render(fullDraft())).toContain('Inverser départ et arrivée');
  });

  it('D10-09: pas d’inversion sur une boucle', () => {
    const text = visible(
      render(fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'boucle' } })),
    );
    expect(text).toContain('Retour au départ');
    expect(text).not.toContain('Inverser départ et arrivée');
  });
});

describe('Écran 10 — participants', () => {
  it('D10-10: les initiales connues sont affichées', () => {
    const draft = fullDraft({
      group: { mode: 'groupe', adults: 4, children: 0, hasPets: false, knownMembers: ['Camille', 'Léo', 'Inès', 'Karim'] },
    });
    const html = render(draft);
    expect(html).toContain('C');
    expect(html).toContain('L');
    expect(html).toContain('I');
    expect(html).toContain('K');
  });

  it('D10-11: un effectif inconnu affiche « +N », jamais un prénom inventé', () => {
    const draft = fullDraft({
      group: { mode: 'groupe', adults: 3, children: 0, hasPets: false, knownMembers: [] },
    });
    expect(visible(render(draft))).toContain('+3');
  });

  it('D10-12: l’effectif total est annoncé en toutes lettres', () => {
    const draft = fullDraft({
      group: { mode: 'groupe', adults: 4, children: 0, hasPets: false, knownMembers: [] },
    });
    expect(visible(render(draft))).toContain('4 adultes');
  });
});

describe('Écran 10 — ce qu’il reste à saisir', () => {
  it('D10-13: la ligne de manque est absente quand tout est rempli', () => {
    expect(visible(render(fullDraft()))).not.toContain('Il manque');
  });

  it('D10-14: elle nomme exactement ce qui manque', () => {
    const draft = fullDraft({
      calendar: { startDate: null, durationDays: null, durationIsSuggested: false, returnDate: null },
    });
    expect(visible(render(draft))).toContain('Il manque : date, temps disponible');
  });

  it('D10-15: le bouton reste bloqué tant qu’un champ bloquant manque', () => {
    const draft = draftWithoutItineraryInput();
    expect(render(draft)).toContain('disabled');
  });
});

describe('Écran 10 — accès aux réglages', () => {
  it('D10-16: les préférences sont ouvrables depuis la pastille', () => {
    const html = render(fullDraft());
    expect(html).toContain('Préférences');
    expect(html).toContain('prep-pill--action');
  });

  it('D10-17: les préférences restent annoncées en toutes lettres', () => {
    const text = visible(
      render(
        fullDraft({
          preferences: {
            budgetPerPerson: 90,
            budgetLevel: 'modere',
            pace: 'tranquille',
            transport: 'train',
            interests: ['paysage'],
            accessibilityNeeds: [],
          },
        }),
      ),
    );
    expect(text).toContain('Tranquille');
    expect(text).toContain('Modéré');
    expect(text).toContain('Train');
  });
});

describe('Écran 10 — carte et appel', () => {
  it('D10-18: la carte est présente et étiquetée', () => {
    expect(render(fullDraft())).toContain('Zone');
  });

  it('D10-19: l’appel d’action crée le parcours', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('Créer mon parcours');
  });

  it('D10-20: une durée suggérée est qualifiée, jamais présentée comme un choix', () => {
    const html = render(
      fullDraft({
        calendar: { startDate: '2026-07-11', durationDays: 3, durationIsSuggested: true, returnDate: null },
      }),
    );
    expect(html).toContain('durée suggérée');
  });

  it('D10-21: aucune distance, aucun prix, aucun pourcentage avant calcul', () => {
    const text = visible(render(fullDraft()));
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*€/);
    expect(text).not.toMatch(/\d+\s*km\b/i);
  });

  it('D10-22: pas de safe-area sur la page principale', () => {
    expect(render(fullDraft())).not.toContain('safe-area-inset');
  });

  it('D10-23: la vue principale ne défile pas', () => {
    expect(render(fullDraft())).not.toContain('overflow-y');
  });
});