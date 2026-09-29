// @vitest-environment jsdom

/**
 * L0 — `/partir-librement` n'invente plus ses mesures.
 *
 * LE DEFAUT RENCONTRE, reel et silencieux :
 * `PartirLibrementView.tsx` est une page REELLEMENT servie par la route
 * `/partir-librement` (etat `before | during | after` pilote par un `useState`
 * local). Elle affichait trois nombres ecrits en dur dans le JSX :
 *
 *   « 0.0 km »   — pendant la session, colonne « Distance »
 *   « 2.4 km »   — au recapitulatif, colonne « Distance »
 *   « 120 m »    — au recapitulatif, colonne « D+ »
 *
 * Aucun de ces trois nombres n'etait mesure. Le composant n'appelle
 * `watchPosition` ni aucun autre capteur : il n'y a donc aucun traceur dans le
 * feature, et ces valeurs n'etaient mesurees par rien. Meme logique que le
 * « 0.0 km » d'un podometre jamais allume : un zero affiche comme une mesure
 * est un mensonge, parce qu'il est indiscernable d'un releve reel.
 *
 * La carte avait le meme defaut, en plus grave : un fond
 * `--prep-map-skeleton-bg` sur lequel le composant ecrivait « Carte plein
 * ecran » et « -- Trace GPS en cours -- ». Ce composant ne monte ni MapLibre
 * ni aucune tuile. L'habillage promettait une carte la ; l'absence etait
 * deguisee en fonctionnalite.
 *
 * CE QUE CES TESTS PROUVENT :
 *   1. les trois constantes n'existent plus dans le fichier (garde statique) ;
 *   2. en session ET au recapitulatif, une mesure absente affiche « A
 *      verifier », et jamais un nombre ;
 *   3. le libelle de carte honnete est present, la fausse carte ne l'est plus ;
 *   4. la DUREE reste une vraie mesure — le compteur de temps n'est pas une
 *      donnee fautee, il compte le temps reellement ecoule.
 *
 * CE QUE CES TESTS NE PROUVENT PAS, et le disent :
 * brancher `watchPosition` (permission, cadence, accumulation du traceur) est
 * une DECISION DE PRODUIT, pas un correctif de style. Elle n'est pas prise ici.
 * Le manque reste donc nomme a l'ecran plutot que masque — et c'est
 * exactement ce que ces tests verrouillent.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PartirLibrementView from '../components/PartirLibrementView';

const FICHIER = join(process.cwd(), 'src/features/adventure-prep/components/PartirLibrementView.tsx');

/** Les trois mesures qui n'etaient mesurees par rien. */
const MESURES_FABRIQUEES = ['0.0 km', '2.4 km', '120 m'];

function source(): string {
  return readFileSync(FICHIER, 'utf8');
}

/**
 * Le CODE, commentaires retires.
 *
 * Ce fichier explique en clair pourquoi « 0.0 km » etait une invention : il les
 * nomme. Un garde qui balaie le texte brut se detecte donc lui-meme, et
 * devient un test qu'on ne peut pas rediger sans effacer l'explication. On ne garde
 * que le code : c'est lui qui peut redevenir une invention.
 */
function code(): string {
  return source()
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

afterEach(cleanup);

describe('L0 — /partir-librement : aucune mesure fabriquee', () => {
  describe('garde statique — le fichier ne peut plus redevenir une invention', () => {
    it('L0-01: aucune des trois mesures ecrites en dur ne subsiste', () => {
      const residues = MESURES_FABRIQUEES.filter((mesure) => code().includes(mesure));
      expect(residues).toEqual([]);
    });

    it('L0-02: la fausse carte et le faux trace GPS sont retires', () => {
      // « Trace GPS en cours » n'a jamais ete trace : c'etait du theatre.
      const faux = ['Carte plein ecran', 'Trace GPS en cours'].filter((s) => code().includes(s));
      expect(faux).toEqual([]);
    });

    it('L0-03: la mesure absente porte une constante nommee, pas un litteral', () => {
      // « A verifier » doit exister UNE fois, comme constante : c'est elle qui
      // rend la substitution impossible a contourner. Un litteral repete dans
      // le JSX finirait inevitably par diverger sur une des trois colonnes.
      expect(source()).toContain("const MESURE_ABSENTE = 'À vérifier'");
    });

    it('L0-04: le composant ne pretend demarrer aucun GPS', () => {
      // Filet de coherence : si quelqu'un branche un vrai traceur, ce test doit
      // echouer pour qu'on reecrive la presentation au lieu de laisser
      // « A verifier » cohabiter avec une vraie mesure.
      expect(code()).not.toMatch(/watchPosition|getCurrentPosition/);
    });
  });

  describe('garde de rendu — ce que la personne voit vraiment', () => {
    function allerAuRecapitulatif() {
      render(<PartirLibrementView />);
      fireEvent.click(screen.getByRole('button', { name: /commencer ma session/i }));
      fireEvent.click(screen.getByRole('button', { name: /terminer/i }));
    }

    it('L0-05: pendant la session, la distance absente se dit « A verifier »', () => {
      render(<PartirLibrementView />);
      fireEvent.click(screen.getByRole('button', { name: /commencer ma session/i }));

      expect(screen.getByText('Distance')).toBeTruthy();
      expect(screen.getByText('À vérifier')).toBeTruthy();
      // La distance n'est pas un zero deguise.
      expect(screen.queryByText('0.0 km')).toBeNull();
    });

    it('L0-06: au recapitulatif, distance ET denivele absents se disent « A verifier »', () => {
      allerAuRecapitulatif();

      expect(screen.getByText('Récapitulatif session')).toBeTruthy();
      // Deux colonnes absentes, donc deux occurrences honnete du meme libelle.
      expect(screen.getAllByText('À vérifier')).toHaveLength(2);
      expect(screen.queryByText('2.4 km')).toBeNull();
      expect(screen.queryByText('120 m')).toBeNull();
    });

    it('L0-07: la carte inexistante est nommee, pas maquillee', () => {
      render(<PartirLibrementView />);

      expect(screen.getByText(/le suivi de position n’est pas actif/i)).toBeTruthy();
      expect(screen.queryByText(/Carte plein écran/i)).toBeNull();
    });

    it('L0-08: la duree reste une VRAIE mesure — elle n est pas neutralisee', () => {
      allerAuRecapitulatif();

      // Le temps ecoule se compte pour de vrai : « 0m 00s » au premier rendu.
      // Neutraliser aussi la duree aurait ete une faute de l'autre sens.
      expect(screen.getByText('0m 00s')).toBeTruthy();
    });
  });
});