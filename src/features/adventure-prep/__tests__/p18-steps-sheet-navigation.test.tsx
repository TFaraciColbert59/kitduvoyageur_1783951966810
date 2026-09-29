/**
 * P1.8 - Le tiroir Etapes navigue, se ferme, et ne dessine rien de faux.
 *
 * Deux volets du meme composant que la suite de rendu :
 *  - les gestes (selection d une etape, fermeture) doivent atteindre REELLEMENT
 *    le callback et l evenement ecoute par l ecran, pas un faux gestionnaire ;
 *  - un programme vide ne doit laisser NI tuile NI bouton d etape : une ligne
 *    dessinee sans etape derriere, c est une promesse que le modele ne tient pas.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { StepsSheet } from '../components/PrepItinerarySheets';
import type { ItineraryModel } from '../types';
import { draftAvec, programmeLocalise, storeFactice } from './programmeFactice';

afterEach(() => cleanup());

function monter(modele: ItineraryModel | null, onClose: () => void = () => undefined) {
  return render(
    React.createElement(StepsSheet, {
      draft: draftAvec(modele),
      actions: storeFactice(),
      onClose,
    }),
  );
}

function boutonsDEtape(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('button.prep-act'));
}

describe('P1.8 - selectionner une etape et fermer le tiroir', () => {
  it('P18-01: cliquer une etape remonte son identifiant ET ferme le tiroir', () => {
    const vus: string[] = [];
    const ecoute = (event: Event) => {
      const detail = (event as CustomEvent<{ stepId?: unknown }>).detail;
      vus.push(String(detail?.stepId));
    };
    window.addEventListener('prep:focus-step', ecoute);
    try {
      const onClose = vi.fn();
      const { container } = monter(programmeLocalise(), onClose);

      const cible = boutonsDEtape(container).find((b) => (b.textContent ?? '').includes('Refuge'));
      expect(cible, 'le bouton de l etape nuit doit exister').toBeTruthy();

      fireEvent.click(cible as HTMLElement);

      // L identifiant remonte ET le tiroir se referme : c est le contrat
      // que l ecran appelant attend pour mettre l etape en evidence.
      expect(vus).toEqual(['s2']);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('prep:focus-step', ecoute);
    }
  });

  it('P18-02: le bouton Fermer appelle le callback, sans evenement d etape', () => {
    const vus: string[] = [];
    const ecoute = (event: Event) => {
      const detail = (event as CustomEvent<{ stepId?: unknown }>).detail;
      vus.push(String(detail?.stepId));
    };
    window.addEventListener('prep:focus-step', ecoute);
    try {
      const onClose = vi.fn();
      const { container } = monter(programmeLocalise(), onClose);

      const fermer = Array.from(container.querySelectorAll('button')).find(
        (b) => (b.textContent ?? '').trim() === 'Fermer',
      );
      expect(fermer, 'le bouton Fermer doit exister').toBeTruthy();

      fireEvent.click(fermer as HTMLElement);

      expect(onClose).toHaveBeenCalledTimes(1);
      // Fermer ne doit selectionner aucune etape : sinon le tiroir se
      // rouvrirait en mettant l accent sur une ligne au hasard.
      expect(vus).toEqual([]);
    } finally {
      window.removeEventListener('prep:focus-step', ecoute);
    }
  });

  it('P18-03: sans programme, le tiroir ne dessine aucune tuile', () => {
    const { container } = monter(null);
    expect(boutonsDEtape(container)).toHaveLength(0);
    expect(container.querySelector('.prep-act')).toBeNull();
  });

  it('P18-04: un programme sans etape ne dessine aucune tuile fantome', () => {
    // On retire les etapes ET les journees : un modele sans contenu doit etre
    // coherent partout, sinon on testerait un etat que le moteur ne produit pas.
    const modele: ItineraryModel = { ...programmeLocalise(), days: 1, steps: [], perDay: [], weather: [] };
    const { container } = monter(modele);
    // Zero bouton d etape : pas de ligne vide, pas de Jour 1 qui promet
    // un contenu absent.
    expect(boutonsDEtape(container)).toHaveLength(0);
    expect(container.querySelector('.prep-act')).toBeNull();
  });
});




