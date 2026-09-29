/**
 * TEST-RESPONSIVE — Paliers, cible tactile, garde-fous anti-debordement.
 *
 * HISTOIRE, parce qu elle dit ce que ce fichiercorrigeait.
 *
 * Ce fichier etait une suite de trois tests qui ne pouvaient pas echouer. Il
 * declarait `const BREAKPOINTS = { mobile: 390, ... }` puis verifiait que
 * `BREAKPOINTS.mobile === 390` ; il declarait `const minTouchTargetPx = 44`
 * puis verifiait `minTouchTargetPx >= 44` ; il declarait un objet
 * `shellStyles = { overflowX: 'clip', ... }` puis verifiait que cet objet
 * valait ce qu il venait d ecrire. Le produit pouvait etre remplace par `null` :
 * la suite restait verte. Une suite verte qui ne peut pas rougir ne protege
 * rien — c est le point de ce chantier.
 *
 * LA REGLE APPLIQUEE ICI. Toute valeur assertionnee est LUE dans une source
 * reelle du depot, sur le disque. Aucune constante n est declaree dans ce
 * fichier pour etre ensuite comparee a elle-meme. Les seules valeurs ecrites
 * ici sont des POINTEURS : on dit ou aller chercher, et le spec va le chercher.
 *
 * LE PIEGE SUIVANT, plus subtil. `adventure-prep.css` parle de ses propres
 * mesures en commentaire (`375x812 / 393x852 / 768x1024`). Un `includes` naive
 * confondrait cette prose avec une declaration, et le test passerait sur du
 * vide. D ou `sansCommentaires()` : une assertion ne compte que si elle trouve
 * une VRAIE declaration. TEST-RESPONSIVE-00 prouve que ce filtre mord.
 *
 * Aucun navigateur, aucun build : tout est lu en Node, ce qui garde ce fichier
 * dans la suite vitest principale.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ANCRAGE_CIBLE_TACTILE,
  ANCRAGES_GARDE_FOUS,
  LARGEURS,
  PALIERS_PREPARE,
  TOUCH_MIN_PX,
  type Ancrage,
} from '../../src/design/breakpoints';

/* ------------------------------------------------------------------ */
/* Lecture des sources reelles. Aucun cache : on veut voir le produit.  */
/* ------------------------------------------------------------------ */

function lire(fichier: string): string {
  return readFileSync(resolve(process.cwd(), fichier), 'utf8');
}

/** Retire les commentaires CSS/JS pour ne garder que le code reellement ecrit. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** Vrai si `motif` est une declaration reelle, et pas une mention en commentaire. */
function declare(source: string, motif: string): boolean {
  return sansCommentaires(source).includes(motif);
}

/** Vrai si une config Playwright ouvre un viewport a cette largeur exacte. */
function viewportConfigure(source: string, largeurPx: number): boolean {
  return new RegExp(`viewport\\s*:\\s*\\{[^}]*width\\s*:\\s*${largeurPx}\\b`).test(source);
}

/** Verifie un ancrage du contrat contre le disque, et dit pourquoi il echoue. */
function resoutAncrage(ancrage: Ancrage): string | null {
  const source = lire(ancrage.fichier);
  if (ancrage.type === 'css') {
    return declare(source, ancrage.motif)
      ? null
      : `${ancrage.fichier} ne declare pas "${ancrage.motif}"`;
  }
  return viewportConfigure(source, ancrage.largeurPx)
    ? null
    : `${ancrage.fichier} n'ouvre aucun viewport a ${ancrage.largeurPx}px`;
}

/** Extrait le corps d'un bloc CSS, par selecteur. */
function bloc(css: string, selecteur: string): string {
  const m = css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .match(new RegExp(`${selecteur}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`Bloc "${selecteur}" introuvable dans le CSS mesure`);
  return m[1];
}

/** Valeur numerique en px d'un token CSS, lue depuis le fichier. */
function tokenPx(css: string, nom: string): number {
  const m = css.replace(/\/\*[\s\S]*?\*\//g, ' ').match(new RegExp(`${nom}\\s*:\\s*(\\d+)px`));
  if (!m) throw new Error(`Token ${nom} absent du CSS mesure`);
  return Number(m[1]);
}

const CSS_TOKENS = lire('src/styles/tokens.css');
const CSS_SHELL = lire('src/styles/tailwind.css');
const CSS_PREP = lire('src/features/adventure-prep/adventure-prep.css');

describe('TEST-RESPONSIVE —ergonomie et standards responsive (sources reelles)', () => {
  /**
   * TEMOIN. Sans ce test, on ignore si les suivants mesurent le produit ou ne
   * font que relire leurs propres pointeurs. Il prend un vrai fichier et
   * verifie deux choses : qu un motif present est trouve, ET qu un motif absent
   * est bien rejete. Le second point est le seul qui compte : c est lui qui
   * interdit au harnais de valider n importe quoi.
   */
  it('TEST-RESPONSIVE-00 (temoin): le filtre mesure bien une declaration, pas une mention', () => {
    // Present, et reellement ecrit : la media query 393 existe dans /prepare.
    expect(declare(CSS_PREP, 'min-width: 393px')).toBe(true);

    // Absent comme declaration, mais PRESENT dans le fichier : la feuille
    // ecrit "375x812 / 393x852 / 768x1024" en commentaire, ligne 3305. Un
    // `includes` sans filtre passerait donc sur de la prose.
    expect(CSS_PREP).toContain('768x1024');
    expect(declare(CSS_PREP, '768x1024')).toBe(false);

    // Et un motif qui n existe nulle part doit etre rejete aussi.
    expect(declare(CSS_PREP, '--largeur-inventee')).toBe(false);
  });

  /**
   * Une source vide, deplacee ou tronquee rendrait toutes les assertions
   * suivantes vertes par accident (rien a trouver, donc rien ne peut manquer).
   * On verifie donc que ce qu on mesure a bien une taille de vrai fichier.
   */
  it('TEST-RESPONSIVE-01: les sources mesurees existent et sont substantielles', () => {
    const sources = [
      'src/styles/tokens.css',
      'src/styles/tailwind.css',
      'src/features/adventure-prep/adventure-prep.css',
      'playwright.baseline.config.ts',
      'playwright.visual.config.ts',
    ];
    for (const fichier of sources) {
      expect(lire(fichier).length, `${fichier} est absent ou vide`).toBeGreaterThan(500);
    }
  });

  /**
   * Le coeur du fichier. Chaque largeur promise par le contrat doit etre
   * IMPOSEE par une source reelle, pas seulement decrite. Un ancrage fantome
   * (ou un module sans ancrage du tout) fait rougir : c est ce qui interdit a
   * ce module de devenir a son tour une suite de constantes auto-satisfaites.
   */
  it('TEST-RESPONSIVE-02: chaque largeur du contrat est imposee par le produit', () => {
    const echecs: string[] = [];
    for (const largeur of LARGEURS) {
      if (largeur.ancrages.length === 0)
        echecs.push(`${largeur.id}: aucun ancrage, promesse non prouvee`);
      for (const ancrage of largeur.ancrages) {
        const raison = resoutAncrage(ancrage);
        if (raison) echecs.push(`${largeur.id} (${largeur.largeurPx}px) : ${raison}`);
      }
    }
    expect(echecs, `Ancrages non resolus :\n${echecs.join('\n')}`).toEqual([]);
  });

  /**
   * `src/design/tokens.ts` exporte un objet `breakpoints` (miroir Tailwind) que
   * personne n importe, et `tokens.css` expose les memes cinq paliers en
   * `--bp-*`. Tant que les deux copies vivent separees, elles peuvent deriver
   * en silence : le JS dit 768, le CSS dit 1024, et rien ne le voit. Ce test les
   * reconcilie. Il ne l importe pas (le CSS ne se consomme pas en JS) : il lit le
   * fichier et compare, ce qui donne enfin a cet export orphelin un verificateur.
   */
  it('TEST-RESPONSIVE-03: les paliers nommes CSS et JS disent la meme chose', () => {
    const source = lire('src/design/tokens.ts');
    const m = source.match(/breakpoints\s*=\s*\{([\s\S]*?)\}/);
    expect(m, 'export `breakpoints` absent de src/design/tokens.ts').not.toBeNull();

    const js = new Map<string, number>();
    for (const ligne of m![1].split('\n')) {
      const p = ligne.match(/'?([\w-]+)'?\s*:\s*'(\d+)px'/);
      if (p) js.set(p[1], Number(p[2]));
    }
    expect(js.size, 'aucun palier lu dans tokens.ts').toBeGreaterThan(0);

    for (const [cle, largeur] of js) {
      expect(
        tokenPx(CSS_TOKENS, `--bp-${cle}`),
        `--bp-${cle} absent ou different de tokens.ts`
      ).toBe(largeur);
    }
  });

  /**
   * `/prepare` ecrit un palier en rem (`30rem`). Une media query en rem vaut 480px
   * a la racine par defaut, mais le test doit le Calculer, pas le recopier :
   * on reutilise la conversion du module partage, sinon 480 serait une
   * constante locale de plus.
   */
  it('TEST-RESPONSIVE-04: /prepare declare ses paliers, rem convertis en px', () => {
    const manquant: string[] = [];
    for (const palier of PALIERS_PREPARE) {
      if (!declare(CSS_PREP, palier.requete)) manquant.push(palier.requete);
    }
    expect(manquant, `Paliers absents de adventure-prep.css : ${manquant.join(', ')}`).toEqual([]);

    // La conversion rem -> px est-elle juste, et non une copie en dur ?
    const enRem = PALIERS_PREPARE.find((p) => p.requete.includes('30rem'));
    expect(enRem?.largeurPx).toBe(480);
    expect(PALIERS_PREPARE.map((p) => p.largeurPx)).toContain(393);
  });

  /**
   * La regle des 44px (Apple HIG) doit etre lue, pas recitee. On extrait la
   * valeur reelle du token `--lkv-touch-min` et on la compare, puis on verifie
   * que le token est REELLEMENT consomme : un token que personne ne lit est un
   * voeu pieux, et `/prepare` ecrit 44px en dur au lieu de le referencer.
   */
  it('TEST-RESPONSIVE-05: la cible tactile 44px est declaree, consommee, et tenue', () => {
    const valeur = tokenPx(CSS_TOKENS, '--lkv-touch-min');
    expect(
      valeur,
      `--lkv-touch-min vaut ${valeur}px, sous le minimum de ${TOUCH_MIN_PX}px`
    ).toBeGreaterThanOrEqual(TOUCH_MIN_PX);

    // Le token doit avoir au moins un consommateur : sans cela la valeur n existe que
    // dans un commentaire de documentation.
    expect(declare(CSS_TOKENS, 'var(--lkv-touch-min)')).toBe(true);
    expect(declare(lire('src/styles/liquid-glass.css'), 'var(--lkv-touch-min)')).toBe(true);

    // Et /prepare doit produire des cibles a cette taille, en dur ou via le
    // token. Plancher de 5 : commandes, carte, rail, pastilles, fermeture.
    const cibles = CSS_PREP.match(/(?:min-height|min-width|height|width)\s*:\s*44px/g) ?? [];
    expect(
      cibles.length,
      `/prepare ne declare presque aucune cible 44px (${cibles.length})`
    ).toBeGreaterThanOrEqual(5);

    for (const ancrage of ANCRAGE_CIBLE_TACTILE) {
      expect(resoutAncrage(ancrage)).toBeNull();
    }
  });

  /**
   * Anti-debordement horizontal : les trois garde-fous doivent etre sur le
   * SHELL (`lkv-shell`), pas disperses dans la feuille. On extrait le bloc et on
   * verifie son contenu, sinon un `overflow-x: clip` pose sur un element
   * secondaire ferait passer le test pour rien.
   */
  it('TEST-RESPONSIVE-06: le shell porte les trois garde-fous de largeur', () => {
    const shell = bloc(CSS_SHELL, '\\.lkv-shell');
    for (const { fichier, motifs } of ANCRAGES_GARDE_FOUS) {
      const zone = fichier.endsWith('tailwind.css') ? shell : '';
      for (const motif of motifs) {
        expect(zone, `${motif} absent du bloc .lkv-shell`).toContain(motif);
      }
    }

    // Le corps porte aussi le garde-fou : une page qui echappe au shell
    // (erreur 404, page de confirmation) ne doit pas non plus deborder.
    const corps = bloc(CSS_SHELL, 'body');
    expect(corps).toContain('overflow-x: clip');
  });
});
