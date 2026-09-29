/**
 * P1.7 / P1.8 - Le tiroir « Etapes » est un LIEU ou une LISTE de plus.
 *
 * Le tiroir s'ouvrait, listait les etapes par jour, et n affichait aucune
 * carte : il exigeait du lecteur qu il reconstruise de tete ou passe par le
 * programme du dessus. Ces tests montent le VRAI composant et le VRAI
 * `PrepMap` - aucun stub - et verifient quatre choses distinctes :
 *
 *   1. une carte MapLibre reelle est montee quand le programme est localise ;
 *   2. elle ne peut pas doubler la modale qui l'heberge ;
 *   3. sans aucune position, AUCUNE carte n est dessinee et l ecran dit
 *      pourquoi, plutot que d afficher un cadre vide qui ferait croire a un
 *      parcours mesure ;
 *   4. la liste groupe par jour, et le clic d une etape remonte reellement son
 *      identifiant vers l ecran qui sait la mettre en evidence.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { StepsSheet } from '../components/PrepItinerarySheets';
import type { ItineraryModel } from '../types';
import { draftAvec, programmeLocalise, programmeSansPosition, storeFactice } from './programmeFactice';

afterEach(() => cleanup());

function monter(modele: ItineraryModel | null, onClose = () => undefined) {
  return render(
    React.createElement(StepsSheet, { draft: draftAvec(modele), actions: storeFactice(), onClose }),
  );
}

describe('P1.7 - le tiroir des etapes porte la carte reelle', () => {
  it('P1-01: une carte MapLibre est montee, avec son canevas et ses commandes', () => {
    const { container } = monter(programmeLocalise());

    // La carte, pas un cadre vide : `PrepMap` ne rend son canevas et sa
    // commande de recentrage que si le composant est reellement instancie.
    expect(container.querySelector('.prep-map__canvas')).not.toBeNull();
    expect(screen.getByRole('button', { name: /recentrer/i })).toBeTruthy();
    expect(container.querySelector('[data-program-map="on"]')).not.toBeNull();
  });

  it('P1-02: le nombre d etapes localisees annonce la carte, sans arrondir', () => {
    const { container } = monter(programmeLocalise());
    const hint = container.querySelector('.prep-maphint');
    expect(hint?.textContent ?? '').toContain('3 étapes localisées');
  });

  it('P1-03: le tiroir n ouvre pas de second dialogue au-dessus du sien', () => {
    // La feuille est deja un dialogue : un plein ecran de carte par-dessus
    // empilerait deux modales et l annoncateur en nommerait deux.
    const { container } = monter(programmeLocalise());
    expect(screen.queryByRole('button', { name: /agrandir la carte/i })).toBeNull();
    expect(container.querySelector('[aria-label="Carte en plein écran"]')).toBeNull();
  });
});

describe('P1.7 - aucune position, aucune carte inventee', () => {
  it('P1-04: sans coordonnee reelle, aucune carte n est dessinee', () => {
    const { container } = monter(programmeSansPosition());
    expect(container.querySelector('.prep-map__canvas')).toBeNull();
    expect(container.querySelector('[data-program-map="on"]')).toBeNull();
    expect(container.querySelector('[data-program-map="pending"]')).not.toBeNull();
  });

  it('P1-05: l ecart est nomme, et aucun chiffre de parcours ne sort du vide', () => {
    const { container } = monter(programmeSansPosition());
    const texte = (container.querySelector('[data-program-map="pending"]')?.textContent ?? '').replace(/\s+/g, ' ');
    expect(texte).toContain('ne sont pas encore mesurées');
    // Aucune distance ni duree ne peut sortir d un trace absent.
    expect(texte).not.toMatch(/\d+\s?(km|min)/);
  });
});

describe('P1.8 - la liste groupe par jour et sait remonter une etape', () => {
  it('P1-06: un titre par jour, et les etapes du bon jour', () => {
    const { container } = monter(programmeLocalise());
    const titres = Array.from(container.querySelectorAll('h3')).map((n) => n.textContent?.trim());
    expect(titres).toEqual(['Jour 1', 'Jour 2']);
    const sections = container.querySelectorAll('section');
    expect(sections[0].textContent).toContain('Départ Chamonix');
    expect(sections[0].textContent).toContain('Refuge');
    expect(sections[0].textContent).not.toContain('Retour');
    expect(sections[1].textContent).toContain('Retour');
  });

  it('P1-07: le clic d une etape remonte SON identifiant, puis ferme le tiroir', () => {
    const vus: string[] = [];
    const ecoute = (event: Event) => {
      const detail = (event as CustomEvent<{ stepId?: unknown }>).detail;
      vus.push(String(detail?.stepId));
    };
    window.addEventListener('prep:focus-step', ecoute);
    try {
      const onClose = vi.fn();
      const { container } = monter(programmeLocalise(), onClose);

      const cible = Array.from(container.querySelectorAll('.prep-act')).find((n) =>
        (n.textContent ?? '').includes('Refuge'),
      );
      expect(cible, 'le bouton de l etape doit exister').toBeTruthy();

      fireEvent.click(cible as HTMLElement);

      expect(vus).toEqual(['s2']);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('prep:focus-step', ecoute);
    }
  });
});
