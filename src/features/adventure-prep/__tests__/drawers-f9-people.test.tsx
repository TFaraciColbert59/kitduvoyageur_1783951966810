// @vitest-environment jsdom

/**
 * F9 - Le tiroir Participants a TROIS colonnes, et chacune dit la verite.
 *
 * Les trois colonnes n'ont pas la meme source, et c'est precisement ce que le
 * test verifie :
 *
 *   - « Confirmes » sort de `group.knownMembers`, une donnee saisie. L'effectif
 *     affiche est `adults + children`, les deux champs reels, jamais une
 *     estimation ;
 *   - « Materiel partage » sort des besoins reels, une fois le porteur
 *     DESIGNE. C'etait le trou ferme ici : la colonne lisait les besoins bruts,
 *     dont le porteur est par construction `null`, donc l attribution faite
 *     dans le tiroir Equipement n'arrivait jamais ici et le badge « Porte par »
 *     etait du code mort ;
 *   - « Invites » n'a AUCUNE source. Le lien part, signé, et le depot ne garde
 *     pas la liste. La colonne doit donc DIRE qu'elle ne suit personne, et ne
 *     surtout pas afficher « 0 invite » : un zero est un suivi, meme faux.
 *
 * Regle de preuve : deux morsants distincts.
 *   1. On remet `sharedGear` sur les besoins bruts -> la colonne perd
 *      l'attribution et les tests 04, 05 et 06 tombent.
 *   2. On remplace l'etat honnete des invites par un compte -> le test 03
 *      tombe.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ParticipantsSheet } from '../components/PrepSetupSheets';
import { headcountOf, pendingShareCount, sharedGear } from '../engine/people';
import { fullDraft } from './fixtures';
import { resolvedGear } from '../engine/gear';
import type { AdventurePrepDraft, GearNeed } from '../types';

afterEach(() => cleanup());

const BROUILLON = fullDraft();
const MEMBRES = BROUILLON.group.knownMembers;

function actionsPiques() {
  return { assignGear: vi.fn() } as never;
}

/**
 * Un besoin REEL de la draft, au seul porte-modifie.
 *
 * On ne l'ecrit pas a la main : le nom, la categorie et la vitalite viennent
 * des blueprints du moteur, donc le test ne peut pas diverger du materiel que
 * l'ecran affiche reellement. Seul l attribut est pose ici, parce que c est
 * precisement ce que le tiroir doit savoir lire.
 */
function besoin(id: string, ownerId: string | null): GearNeed {
  const derive = resolvedGear(fullDraft()).find((item) => item.id === id);
  if (!derive) throw new Error('besoin derive absent : ' + id);
  return { ...derive, ownerId, weightGrams: null };
}
function sections() {
  return Array.from(document.querySelectorAll('section.prep-drawer__section'));
}

function titres() {
  return sections().map((s) => s.querySelector('h3')?.textContent ?? '');
}

describe('F9 - les trois colonnes des participants', () => {
  it('01 - TROIS colonnes, dans l ordre, chacune composee du gabarit', () => {
    render(<ParticipantsSheet draft={BROUILLON} actions={actionsPiques()} onClose={vi.fn()} />);
    expect(titres()).toEqual(['Confirmés', 'Invités', 'Matériel partagé']);
    // Chaque colonne est une section du gabarit M1.1, pas un div a la main.
    expect(sections()).toHaveLength(3);
    for (const section of sections()) {
      expect(section.querySelector('h3.prep-section-title')).not.toBeNull();
    }
  });

  it('02 - Confirmes sort de la saisie, et l effectif est adults + children', () => {
    render(<ParticipantsSheet draft={BROUILLON} actions={actionsPiques()} onClose={vi.fn()} />);
    const lignes = Array.from(document.querySelectorAll('li[data-prep-row="confirme"]')).map(
      (li) => li.querySelector('.t1')?.textContent ?? '',
    );
    // Exactement les participants saisis, ni un de plus ni un de moins.
    expect(lignes).toEqual(MEMBRES);
    // L'effectif affiche est le calcul reel, pas un nombrePresence.
    const reel = headcountOf(BROUILLON);
    expect(reel).toBe(BROUILLON.group.adults + BROUILLON.group.children);
    expect(document.body.textContent ?? '').toContain(String(reel) + ' personne');
  });

  it('03 - Invites : le tiroir DIT qu il ne suit personne, il ne compte pas', () => {
    render(<ParticipantsSheet draft={BROUILLON} actions={actionsPiques()} onClose={vi.fn()} />);
    const colonne = sections()[1];
    const corps = colonne.textContent ?? '';
    // Le pourquoi est donne : sans lui, la colonne ressemble a un bug.
    expect(corps).toMatch(/lien sign/i);
    // Et surtout : aucun compte. « 0 invite » serait un suivi, meme vide.
    expect(corps).not.toMatch(/\d+\s*invit/i);
    // Aucun nom d invite ne peut apparaitre : il n en existe aucun.
    for (const membre of MEMBRES) {
      expect(document.querySelectorAll('li[data-prep-row="confirme"]').length).toBe(
        MEMBRES.length,
      );
      expect(colonne.textContent ?? '').not.toContain(membre);
    }
  });

  it('04 - Materiel partage suit le PORTEUR designe, pas le besoin brut', () => {
    // Le tiroir Equipement a designe Camille comme porteuse du sac.
    const attribue: AdventurePrepDraft = {
      ...BROUILLON,
      gear: [besoin('sac', MEMBRES[0])],
    };
    expect(sharedGear(attribue).find((item) => item.id === 'sac')?.ownerId).toBe(MEMBRES[0]);
    render(<ParticipantsSheet draft={attribue} actions={actionsPiques()} onClose={vi.fn()} />);
    const lignes = Array.from(document.querySelectorAll('li[data-prep-row="partage"]'));
    const sac = lignes.find((li) => (li.textContent ?? '').includes('Sac à dos'));
    expect(sac?.textContent ?? '').toContain('Porte par ' + MEMBRES[0]);
  });

  it('05 - le porteur se choisit DANS la colonne, avec les noms reels', () => {
    const assignGear = vi.fn();
    render(
      <ParticipantsSheet
        draft={BROUILLON}
        actions={{ assignGear } as never}
        onClose={vi.fn()}
      />,
    );
    const select = screen.getByLabelText('Porteur de Sac à dos') as HTMLSelectElement;
    // Les options sont les participants saisis, plus le retrait.
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', ...MEMBRES]);
    expect(select.value).toBe('');
    fireEvent.change(select, { target: { value: MEMBRES[0] } });
    expect(assignGear).toHaveBeenCalledWith('sac', MEMBRES[0]);
    // Retirer le porteur doit rester possible : c'est une decision revocable.
    fireEvent.change(select, { target: { value: '' } });
    expect(assignGear).toHaveBeenCalledWith('sac', null);
  });

  it('06 - ce qui reste a decider passe en haut, par ordre alphabetique', () => {
      const attribue: AdventurePrepDraft = {
        ...BROUILLON,
        gear: [besoin('sac', MEMBRES[0]), besoin('eau', null)],
      };
    const items = sharedGear(attribue);
    const premierAttribue = items.findIndex((item) => item.state === 'attribue');
    const dernierOuvert = items.map((item) => item.state).lastIndexOf('a-attribuer');
    expect(premierAttribue).toBeGreaterThan(0);
    expect(premierAttribue).toBeGreaterThan(dernierOuvert);
    // A l'interieur d'un etat, l'ordre est alphabetique : la liste se relit.
    const ouverts = items.filter((i) => i.state === 'a-attribuer').map((i) => i.name);
    expect(ouverts).toEqual([...ouverts].sort((a, b) => a.localeCompare(b)));
    // Le compteur de decisions ouvertes suit la liste reelle.
    expect(pendingShareCount(attribue)).toBe(ouverts.length);
  });

  it('07 - partie seul, la colonne dit pourquoi elle est vide', () => {
    const solo = fullDraft({
      group: { ...BROUILLON.group, adults: 1, knownMembers: [] },
    });
    expect(headcountOf(solo)).toBe(1);
    // Le moteur ne renvoie rien : il n y a personne avec qui partager.
    expect(sharedGear(solo)).toHaveLength(0);
    render(<ParticipantsSheet draft={solo} actions={actionsPiques()} onClose={vi.fn()} />);
    expect(document.querySelectorAll('li[data-prep-row="partage"]')).toHaveLength(0);
    const corps = sections()[2].textContent ?? '';
    expect(corps).toMatch(/seul/i);
    // Aucun materiel n est presente comme a partager quand on est seul.
    expect(corps).not.toMatch(/Porte par/);
  });
});