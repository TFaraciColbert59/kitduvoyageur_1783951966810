import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivityPickerScreen } from '../components/ActivityPickerScreen';
import { DestinationStep } from '../components/DestinationStep';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft, draftWithoutItineraryInput, CHAMONIX } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * Meme harnais que departure-screen.test.tsx : sous `renderToStaticMarkup`,
 * zustand v5 sert l'etat INITIAL et `setState` n'a aucun effet. Le module du
 * store est donc remplace par un selecteur pur — le composant est reellement
 * execute, seule la source de donnees change.
 */
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

type Screen = React.ComponentType<{ onOpenSheet: () => void }>;

function render(Component: Screen, draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(Component, { onOpenSheet: noop }));
}

/** Ce que l'utilisateur LIT, balises et attributs retires. */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Marqueur de ligne d'activite choisie : le composant etant le seul a l emettre. */
const CHOSEN = 'Sélectionnée';

describe('ActivityPickerScreen — choix d activité', () => {
  it('PICK-01: propose des activités avec leur durée', () => {
    const text = visible(render(ActivityPickerScreen, fullDraft()));
    expect(text).toContain('Randonnée');
    expect(text).toContain('Randonnée à la journée');
  });

  it('PICK-02: ne chiffre jamais la préparation', () => {
    const text = visible(render(ActivityPickerScreen, fullDraft()));
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('PICK-03: marque l’activité déjà choisie', () => {
    expect(render(ActivityPickerScreen, fullDraft())).toContain(CHOSEN);
  });

  it('PICK-04: un brouillon vierge ne présélectionne aucune activité', () => {
    expect(render(ActivityPickerScreen, draftWithoutItineraryInput())).not.toContain(CHOSEN);
  });

  it('PICK-05: n’expose aucun texte de gabarit', () => {
    const text = visible(render(ActivityPickerScreen, fullDraft()));
    expect(text).not.toMatch(/aide courte|Lorem|TODO|FIXME/i);
  });

  it('PICK-06: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render(ActivityPickerScreen, fullDraft())).not.toContain('safe-area-inset');
  });
});

describe('DestinationStep — parcours et dates', () => {
  it('DEST-01: affiche départ et arrivée en aller simple', () => {
    const text = visible(render(DestinationStep, fullDraft()));
    expect(text).toContain('Départ');
    expect(text).toContain('Chamonix');
    expect(text).toContain('Arrivée');
    expect(text).toContain('Argentière');
  });

  it('DEST-02: propose d’inverser départ et arrivée', () => {
    expect(render(DestinationStep, fullDraft())).toContain('Inverser départ et arrivée');
  });

  it('DEST-03: sans arrivée, aucune inversion mais l’arrivée reste saisissable', () => {
    const text = visible(
      render(DestinationStep, fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'boucle' } })),
    );
    expect(text).not.toContain('Inverser départ et arrivée');
    expect(text).toContain('Arrivée');
    expect(text).toContain('À vérifier');
  });

  /**
   * La qualification est un CONTRAT, pas une copie : le badge doit exister quand la
   * duree est suggeree et disparaitre quand elle est confirmee. Le libelle peut
   * changer, l honnnetete des donnees, elle, ne peut pas.
   */
  it('DEST-04: qualifie une durée suggérée au lieu de la laisser croire choisie', () => {
    const suggested = render(
      DestinationStep,
      fullDraft({
        calendar: { startDate: '2026-07-11', durationDays: 3, durationIsSuggested: true, returnDate: null },
      }),
    );
    // Un badge de qualification est bien affiche...
    expect(suggested).toContain('badge--suggestion');
    // ...et la duree suggeree porte le marqueur A_VERIFIER au lieu d un nombre.
    expect(suggested).toContain('data-unknown="true"');
    expect(visible(suggested)).not.toMatch(/\d+\s*jours?/);

    // Reciproquement, une duree confirmee ne porte plus de badge : le bruit disparait.
    const confirmed = render(
      DestinationStep,
      fullDraft({
        calendar: { startDate: '2026-07-11', durationDays: 3, durationIsSuggested: false, returnDate: '2026-07-13' },
      }),
    );
    expect(confirmed).not.toContain('badge--suggestion');
  });

  it('DEST-04b: une proposition ne porte pas la couleur d un avertissement', () => {
    // Mesure : « Durée à préciser · modifiable » sortait en ambre, la couleur
    // que toute l application reserve aux alertes. Rien n est en jeu ici : une
    // duree suggeree est une aide, pas un danger. Lereuse d ambre apprend a la
    // personne d ignorer la couleur, et la prochaine vraie alerte ne se lit
    // plus. Le badge reste, il devient neutre.
    const suggested = render(
      DestinationStep,
      fullDraft({
        calendar: { startDate: '2026-07-11', durationDays: 3, durationIsSuggested: true, returnDate: null },
      }),
    );
    expect(suggested).toContain('badge--suggestion');
    expect(suggested).not.toContain('badge amber');
  });

  it('DEST-05: signale une date de départ manquante', () => {
    const text = visible(
      render(
        DestinationStep,
        fullDraft({
          calendar: { startDate: null, durationDays: 3, durationIsSuggested: false, returnDate: null },
        }),
      ),
    );
    expect(text).toContain('À vérifier');
  });

  it('DEST-06: l effectif se lit en adultes, sans pastille de preferences', () => {
    const text = visible(render(DestinationStep, fullDraft()));
    // La pastille « Préférences » a ete retiree avec le bandeau titre : elle
    // occupait une ligne entiere pour recapituler ce que le bouton du bandeau
    // d'etapes ouvre deja. Ce qui compte ici, c'est l'effectif.
    expect(text).not.toContain('Préférences');
    // Maquette 10 : l'effectif se lit « N adultes », pas « N personnes ».
    expect(text).toContain('2 adultes');
  });

  it('DEST-07: ne propose ni distance, ni prix, ni pourcentage', () => {
    const text = visible(render(DestinationStep, fullDraft()));
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*€/);
    expect(text).not.toMatch(/\d+\s*km\b/i);
  });

  it('DEST-08: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render(DestinationStep, fullDraft())).not.toContain('safe-area-inset');
  });
});

describe('ItineraryStepScreen — construction du parcours', () => {
  /** Brouillon complet + itineraire reellement construit par le moteur. */
  function builtDraft(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
    const draft = fullDraft(overrides);
    const model = buildItinerary(draft);
    if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
    return { ...draft, itinerary: model };
  }

  it('ITIN-01: sans parcours, propose de le générer', () => {
    const text = visible(render(ItineraryStepScreen, fullDraft({ itinerary: null })));
    expect(text).toContain('Générer mon parcours');
  });

  it('ITIN-02: promet que distances, durées et prix restent à vérifier', () => {
    const text = visible(render(ItineraryStepScreen, fullDraft({ itinerary: null })));
    expect(text).toContain('À vérifier');
  });

  it('ITIN-03: l’écran en attente ne publie aucun pourcentage', () => {
    const base = fullDraft();
    const text = visible(
      render(ItineraryStepScreen, { ...base, itinerary: null, generation: { ...base.generation, status: 'en_cours' } }),
    );
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
  });

  it('ITIN-04: un parcours construit s’affiche journée par journée', () => {
    const text = visible(render(ItineraryStepScreen, builtDraft()));
    expect(text).toContain('Jour 1');
    expect(text).toContain('Vers le départ');
  });

  it('ITIN-05: un parcours construit n’affiche aucun pourcentage', () => {
    const text = visible(render(ItineraryStepScreen, builtDraft()));
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('ITIN-06: un parcours interrompu reste reprenable', () => {
    const base = fullDraft();
    const text = visible(
      render(ItineraryStepScreen, { ...base, itinerary: null, generation: { ...base.generation, status: 'interrompu' } }),
    );
    expect(text).toContain('Reprise du parcours');
    expect(text).toContain('Continuer avec les éléments disponibles');
  });

  it('ITIN-07: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render(ItineraryStepScreen, builtDraft())).not.toContain('safe-area-inset');
  });
});
