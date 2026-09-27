import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartureStep } from '../components/DepartureStep';
import { fullDraft, draftWithoutItineraryInput } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * zustand v5 sert le `getServerSnapshot` — l'etat INITIAL — pendant
 * `renderToStaticMarkup`. Injecter un etat via `setState` n'aurait donc
 * aucun effet. On remplace le store par un selecteur pur : le composant
 * under-test est reellement execute, seule la source de donnees change.
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

function render(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DepartureStep, { onOpenSheet: () => undefined }));
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
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('DepartureStep — écran de départ', () => {
  it('DEPART-01: affiche la couverture et ouvre sa modification', () => {
    const html = render(fullDraft({ coverName: 'Trois jours de refuge' }));
    expect(html).toContain('Trois jours de refuge');
    expect(html).toContain('Modifier');
  });

  it('DEPART-02: n’invente pas de couverture quand elle n’est pas personnalisée', () => {
    expect(render(fullDraft({ coverName: null }))).toContain('Ton aventure');
  });

  it('DEPART-03: récapitule équipement, eau et repas, participants', () => {
    const html = render(fullDraft());
    expect(html).toContain('Équipement');
    expect(html).toContain('Eau et repas');
    expect(html).toContain('Participants');
    expect(html).toContain('2 personnes');
  });

  it('DEPART-04: l’activité choisie donne le titre d’aide, pas « À vérifier »', () => {
    const html = render(fullDraft());
    expect(html).toContain('Randonnée');
    expect(html).toContain('3 jours');
  });

  it('DEPART-05: un sac vide ne vaut pas 0 kg', () => {
    const html = render(fullDraft());
    expect(html).toMatch(/Poids du sac/i);
    expect(html).not.toMatch(/Poids du sac\s*:\s*0[,.]0*\s*kg/);
  });

  it('DEPART-06: la préparation n’est jamais chiffrée', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('À vérifier');
    // Ni pourcentage, ni note sur 100, ni score : la préparation n'a pas de note (A9).
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('DEPART-07: signale une date de départ manquante', () => {
    const html = render(
      fullDraft({
        calendar: { startDate: null, durationDays: 3, durationIsSuggested: false, returnDate: null },
      }),
    );
    expect(html).toContain('Date de départ à vérifier');
  });

  it('DEPART-08: le bouton d’enregistrement est nommé et disponible', () => {
    const html = render(fullDraft());
    expect(html).toContain('Enregistrer mon aventure');
  });

  it('DEPART-09: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render(fullDraft())).not.toContain('safe-area-inset');
  });

  it('DEPART-10: le brouillon vierge ne suppose aucune activité', () => {
    expect(render(draftWithoutItineraryInput())).toContain('Activité à choisir');
  });

  it('DEPART-11: l’équipement dérive de l’activité, même avant synchronisation', () => {
    const html = render(fullDraft());
    // Le catalogue impose l'eau et la trousse : jamais « aucun équipement ».
    expect(html).toContain('Équipement');
    expect(html).not.toContain('Aucun équipement identifié');
  });
});
