// @vitest-environment jsdom

/**
 * Honnetete (PartirLibrementView) - plus un bouton qui ne fait rien.
 *
 * LA DETTE, relue dans le composant :
 *
 *   <Button variant="secondary" size="lg" style={{ flex: 1 }}>Pause</Button>
 *   <Button variant="primary" size="lg" style={{ width: '100%' }}>
 *     Enregistrer cette trace
 *   </Button>
 *
 * Aucun `onClick`. Un `<button>` sans gestionnaire est un element d'interface
 * qui promet une action et n'en fait aucune : l'utilisateur le presse, rien ne
 * se passe, et il conclut que l'application est cassee. C'est exactement ce
 * que `p3-honesty-fallbacks.test.ts` interdit ailleurs dans le feature
 * (« aucun maillon n'est un `onClick={() => {}}` ») ; `/partir-librement` etait
 * le seul ecran qui y echappait.
 *
 * LES DEUX SORTIES, et elles ne se valent pas :
 *
 *   1. « Pause » : le chronometre est une VRAIE mesure (`formatTime` compte
 *      le temps reellement ecoule) et il tourne deja. Suspendre une mesure
 *      reelle est une capacite reelle, petite et honnete : elle s'implemente.
 *      Supprimer le bouton serait Sanzioter un existant.
 *   2. « Enregistrer cette trace » : il n'y a AUCUNE trace. Le composant
 *      n'appelle pas `watchPosition` — `l0-partir-librement-honnetete`
 *      verrouille deja ce point — et `saveAdventure` enregistre un PROGRAMME,
 *      pas une sortie de terrain. Le bouton promet donc de sauver un objet
 *      qui n'a jamais existe. Il part, et son absence se dit.
 *
 * Ces tests montent le VRAI composant et balaient ses trois etats : une
 * garde sur une liste de libelles ecrite a la main finirait par diverger de
 * l'interface des qu'un bouton change.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import PartirLibrementView from '../components/PartirLibrementView';

const FICHIER = join(
  process.cwd(),
  'src/features/adventure-prep/components/PartirLibrementView.tsx'
);

type Etat = 'before' | 'during' | 'after';

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/* Le harnais : poser un etat, trouver un bouton, constater un effet.  */
/* ------------------------------------------------------------------ */

/** Un rendu neuf dans l'etat demande, DOM propre : aucun etat ne fuite. */
function poserEtat(etat: Etat): HTMLElement {
  cleanup();
  const { container } = render(<PartirLibrementView />);
  if (etat !== 'before') cliquer(container, /commencer ma session/i);
  if (etat === 'after') cliquer(container, /terminer/i);
  return container;
}

function boutons(noeud: HTMLElement): HTMLElement[] {
  return Array.from(noeud.querySelectorAll('button'));
}

function libelles(noeud: HTMLElement): string[] {
  return boutons(noeud).map((bouton) => (bouton.textContent ?? '').trim());
}

function bouton(noeud: HTMLElement, motif: RegExp): HTMLElement {
  const cible = boutons(noeud).find((element) => motif.test((element.textContent ?? '').trim()));
  if (!cible) throw new Error(`bouton introuvable : ${motif}`);
  return cible;
}

function cliquer(noeud: HTMLElement, motif: RegExp): void {
  fireEvent.click(bouton(noeud, motif));
}

/**
 * Un clic « agit » s'il change le rendu.
 *
 * C'est la seule definition d'action acceptable ici : le composant n'a ni
 * reseau, ni stockage, ni callback externe, donc un effet ne peut se voir que
 * dans le DOM. Un bouton dont le clic ne change rien ne fait rien.
 */
function changeLeRendu(noeud: HTMLElement, motif: RegExp): boolean {
  const avant = noeud.innerHTML;
  cliquer(noeud, motif);
  return noeud.innerHTML !== avant;
}

/* ------------------------------------------------------------------ */
/* La garde statique : le code ne peut pas redevenir un bouton mort.   */
/* ------------------------------------------------------------------ */

/** Le CODE, commentaires retires : ce sont eux qui expliquent, pas les couvrants. */
function codeDuComposant(): string {
  return readFileSync(FICHIER, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Les balises ouvrantes `<Button ...>`, une par une.
 *
 * Un `<Button\b[^>]*>` regulier ne suffirait pas : le premier `>` d'un
 * `onClick={() => ...}` fermerait la balise au milieu de la fleche, et le
 * gestionnaire passerait inapercu. On suit donc les accolades et les
 * guillemets pour ne s'arreter qu'au `>` de fer meture.
 */
function ouverturesButton(source: string): string[] {
  const trouvees: string[] = [];
  let index = 0;
  for (;;) {
    const debut = source.indexOf('<Button', index);
    if (debut === -1) return trouvees;
    let curseur = debut + '<Button'.length;
    let accolades = 0;
    let guillemet: string | null = null;
    while (curseur < source.length) {
      const caractere = source[curseur];
      if (guillemet !== null) {
        if (caractere === guillemet) guillemet = null;
      } else if (caractere === '"' || caractere === "'" || caractere === '`') {
        guillemet = caractere;
      } else if (caractere === '{') {
        accolades += 1;
      } else if (caractere === '}') {
        accolades -= 1;
      } else if (caractere === '>' && accolades === 0) {
        curseur += 1;
        break;
      }
      curseur += 1;
    }
    trouvees.push(source.slice(debut, curseur));
    index = curseur;
  }
}

function boutonsSansGestionnaire(source: string): string[] {
  return ouverturesButton(source).filter(
    (ouverture) => !/\bonClick\s*=/.test(ouverture) && !/\btype\s*=\s*"submit"/.test(ouverture)
  );
}

describe('PartirLibrementView - aucun bouton sans action', () => {
  it('PL-H-00 : TEMOIN - les deux gardes voient un bouton mort', () => {
    // 1. La garde statique, sur les deux verbatims de la dette.
    const mort = '<Button variant="secondary" size="lg" style={{ flex: 1 }}>Pause</Button>';
    expect(
      boutonsSansGestionnaire(mort),
      'le temoin ne prouve rien : le Button mort passe pour vivant'
    ).toHaveLength(1);
    const vivant =
      '<Button variant="secondary" size="lg" onClick={() => setPaused((p) => !p)}>Pause</Button>';
    expect(
      boutonsSansGestionnaire(vivant),
      'le temoin ne prouve rien : le Button vivant passe pour mort'
    ).toEqual([]);

    // 2. Le balayage du rendu, sur un composant qui reproduit le defaut.
    function Temoin(): React.ReactElement {
      return (
        <button type="button" onClick={() => undefined}>
          Pause
        </button>
      );
    }
    const { container } = render(<Temoin />);
    expect(changeLeRendu(container, /pause/i), 'le temoin ne prouve rien').toBe(false);
    cleanup();
  });

  it('PL-H-01 : dans les trois etats, aucun bouton ne reste sans effet', () => {
    for (const etat of ['before', 'during', 'after'] as const) {
      const decouverts = libelles(poserEtat(etat));
      // Anti-vacuite : sans bouton trouve, « aucun mort » serait vrai par
      // accident — par exemple si le composant ne rendait plus rien du tout.
      expect(decouverts.length, `aucun bouton rendu a l etat ${etat}`).toBeGreaterThan(0);

      // Chaque bouton est re-evalue sur un rendu NEUF : cliquer « Pause »
      // change l'etat, et un arbre deja transforme ne prouverait plus rien.
      const morts = decouverts.filter(
        (libelle) => !changeLeRendu(poserEtat(etat), new RegExp(`^${libelle}$`))
      );
      expect(morts, `bouton(s) sans effet a l etat ${etat}`).toEqual([]);
    }
  });

  it('PL-H-02 : « Pause » arrete VRAIMENT le chronometre', () => {
    vi.useFakeTimers();
    try {
      const noeud = poserEtat('during');
      expect(noeud.textContent, 'le chronometre ne demarre pas a zero').toContain('0m 00s');

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(noeud.textContent, 'le chronometre ne tourne pas').toContain('0m 05s');

      fireEvent.click(bouton(noeud, /^Pause$/));
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      // Trente secondes passent et rien ne bouge : la pause est un arret reel.
      expect(noeud.textContent, 'le chronometre a tourne pendant la pause').toContain('0m 05s');
    } finally {
      vi.useRealTimers();
    }
  });

  it('PL-H-03 : « Reprendre » repart de la ou le chronometre s etait arrete', () => {
    vi.useFakeTimers();
    try {
      const noeud = poserEtat('during');
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      fireEvent.click(bouton(noeud, /^Pause$/));
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      fireEvent.click(bouton(noeud, /^Reprendre$/));
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // 4 s + 2 s : la pause n'a pas remis le compteur a zero.
      expect(noeud.textContent, 'la reprise a reinitialise le chronometre').toContain('0m 06s');
    } finally {
      vi.useRealTimers();
    }
  });

  it('PL-H-04 : aucune trace n existe, donc rien n en promet l enregistrement', () => {
    const noeud = poserEtat('after');

    expect(
      libelles(noeud),
      'le bouton promet encore de sauver une trace inexistante'
    ).not.toContain('Enregistrer cette trace');
    // Retirer un bouton n'est pas se taire : le recapitulatif dit pourquoi.
    expect(noeud.textContent, 'l absence de trace n est pas nommee').toMatch(/aucune trace/iu);
  });

  it('PL-H-05 : garde statique - le code ne peut plus redevenir un bouton mort', () => {
    const source = codeDuComposant();
    const ouvertures = ouverturesButton(source);
    // Anti-vacuite : si le scan ne trouvait rien, la garde passerait toujours.
    expect(ouvertures.length, 'le scan ne trouve aucun Button : la garde est vide').toBeGreaterThan(
      0
    );
    expect(
      boutonsSansGestionnaire(source),
      'un <Button> sans onClick est revenu dans le composant'
    ).toEqual([]);
  });
});
