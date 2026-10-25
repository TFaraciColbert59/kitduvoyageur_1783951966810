import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Contrat du materiau de verre du preparateur.
 *
 * Releve du 2026-09-28, viewport 393x852 : les cartes d activities rendant
 * `background-color: var(--card-tint-solid)` se mesuraient a
 * `rgba(16, 16, 16, 0.82)` avec `backdrop-filter: none` et `box-shadow: none`.
 * Un aplat noir a 82 % n est pas du verre : c est un rectangle. Une surface
 * translucide ne se lit comme une vitre que si elle floute ce qu elle couvre
 * et si une lumiere est posee sur ses aretes.
 *
 * Ces tests verrouillent le materiau, pas une valeur de couleur : une future
 * retouche de teinte ne doit pas les faire echouer.
 */

const css = readFileSync(join(__dirname, '..', 'adventure-prep.css'), 'utf8');

/** Regles d un selecteur, en tolerant toute la mise en forme du fichier. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm').exec(css);
  if (!match) throw new Error(`selecteur introuvable: ${selector}`);
  return match[1];
}

// G1 - `.prep-day` (les pastilles de jour du rail) etait un aplat
// `var(--card-tint-solid)` hors du lot : posee sur la photo, elle se lisait
// comme un rectangle. Elle porte desormais le meme materiau que les autres.
const GLASS_SURFACES = ['.prep-act', '.prep-nav', '.prep-block', '.prep-footer', '.prep-day'];

// Les surfaces de CONTENU posees sur la photo. Elles etaient de simples
// melanges opaques de `--card-tint-solid` (88 a 94 %) : mesurees a 393x852,
// les cartes de jour se lisaient comme des rectangles noirs poses sur le
// decor, alors que la photo venait d'etre analysee pour eclaircir le fond.
// Elles doivent porter le meme materiau que les panneaux du hub.
const CONTENT_SURFACES = [
  '.prep-metric',
  '.prep-step',
  '.prep-programme__day',
  '.prep-block',
];

describe('materiau de verre du preparateur', () => {
  it.each(GLASS_SURFACES)('%s floute ce qu il couvre', (selector) => {
    const body = rule(selector);
    expect(body).toMatch(/backdrop-filter:\s*blur\(/);
  });

  it.each(GLASS_SURFACES)('%s pose de la lumiere sur ses aretes', (selector) => {
    // Le reflet de bord est ce qui distingue une vitre d un aplat flou.
    expect(rule(selector)).toMatch(/box-shadow:[^;]*var\(--prep-glass-material\)/);
  });

  it('aucune surface de verre ne retombe sur un aplat opaque', () => {
    for (const selector of GLASS_SURFACES) {
      expect(rule(selector)).not.toMatch(/background(-color)?:\s*var\(--card-tint-solid\)/);
    }
  });

  // P5.1 - "Un seul verre, une seule recette". L ombre de la barre d etapes
  // (.prep-nav) et celle de la carte d etape (.prep-block, P0.11) doivent etre
  // la MEME valeur resolue. Le defaut mesure au navigateur (393x852) :
  // deux regles .prep-block redECLARAIENT `box-shadow: 0 1px 2px ...` a la
  // meme specificite (0,1,0) que l invariant de verre, donc c etaient elles
  // qui parlaient en dernier et la carte gardait une ombre de 2px.
  //
  // On verifie l INVARIANT, pas la valeur : la carte DOIT lire la recette
  // unique --prep-glass-material, et aucune autre regle .prep-block ne doit
  // redeclarer un fond ni une ombre qui la concurrencentrait.
  it('P5.1: la carte d etape lit la MEME recette d ombre que la barre d etapes', () => {
    const ombreRecette = /box-shadow:\s*var\(--prep-glass-material\)\s*;/.test(css);
    expect(ombreRecette, 'la recette unique --prep-glass-material doit etre declaree').toBe(true);

    // L ombre de l invariant ne doit plus etre forcee : l unicite de la
    // recette doit tenir seule. Un `!important` ici signifierait qu un conflit
    // a ressurgi et qu on le masque au lieu de le supprimer.
    expect(
      css,
      'P5.1: l ombre de l invariant ne doit pas porter !important (conflit masque)',
    ).not.toMatch(/box-shadow:\s*var\(--prep-glass-material\)\s*!important/);
  });

  it('P5.1: aucune autre regle .prep-block ne redeclare fond ni ombre', () => {
    // Toutes les regles brutes du selecteur .prep-block, pas seulement la
    // premiere. Une regle ulterieure qui reintroduirait un fond opaque ou une
    // ombre divergente resecouerait exactement le defaut corrige.
    // On ancre sur le selecteur, pas sur un `}` precedent : ces regles
    // suivent un commentaire, donc le caractere d avant n est ni `}` ni le
    // debut du fichier. Un selecteur `.prep-block` est suivi de `{`.
    const blocs = [...css.matchAll(/\.prep-block\s*\{([^}]*)\}/g)].map((m) => m[1] as string);
    expect(blocs.length, 'au moins une regle .prep-block doit exister').toBeGreaterThan(0);
    for (const corps of blocs) {
      // Ni fond ni ombre concurrents : l invariant plus haut les porte.
      expect(corps, 'un .prep-block redeclare un fond').not.toMatch(
        /background(-color)?\s*:/,
      );
      expect(corps, 'un .prep-block redeclare une ombre').not.toMatch(/box-shadow\s*:/);
    }
  });
  it('le materiau compose le reflet, le rebond et la portee', () => {
    const sheen = /--prep-glass-sheen:\s*inset 0 1px 0/.test(css);
    const bounce = /--prep-glass-bounce:\s*inset 0 -1px 0/.test(css);
    const depth = /--prep-glass-depth:\s*0 8px 32px/.test(css);
    const composed = /--prep-glass-material:[^;]*var\(--prep-glass-sheen\)[^;]*var\(--prep-glass-bounce\)[^;]*var\(--prep-glass-depth\)/.test(css);
    expect(sheen && bounce && depth && composed).toBe(true);
  });

  it.each(CONTENT_SURFACES)('%s floute ce qu il couvre', (selector) => {
    expect(rule(selector)).toMatch(/backdrop-filter:\s*blur\(/);
  });

  it.each(CONTENT_SURFACES)('%s pose la lumiere sur ses aretes', (selector) => {
    expect(rule(selector)).toMatch(/box-shadow:[^;]*var\(--prep-glass-material\)/);
  });

  it.each(CONTENT_SURFACES)(
    '%s ne retombe sur aucun aplat de teinte, meme melange',
    (selector) => {
      // Le controle precedent ne visait que `background: var(--card-tint-solid)`.
      // Un `color-mix(in srgb, var(--card-tint-solid) 94%, ...)` passait donc
      // le test tout en restant opaque a l'ecran. On interdit desormais le
      // ton de la teinte, quelle que soit la maniere dont on l'ecrit.
      expect(rule(selector)).not.toMatch(/background(-color)?:[^;]*--card-tint-solid/);
    },
  );

  // P5.1 - le tiroir P0.9 est montee par un portail Radix dans <body>, donc
  // hors de `.adventure-prep` : la regle est scopee par `:has()` sur le shell.
  // Elle ne peut pas reutiliser l invariant tel quel, mais elle doit lire LA
  // MEME recurrence de materiau, sinon le tiroir et la barre d etapes sont
  // deux verifierres.
  //
  // Mesure avant correction : le tiroir composait son ombre a la main
  // (--prep-glass-bounce + liseré haut + portee + --prep-shadow-float) et ne
  // partageait ni le reflet `--prep-glass-sheen` ni la portee
  // `--prep-glass-depth` du materiau commun.
  //
  // `rule()` ne peut pas servir ici : ce selecteur est precede d un commentaire
  // et non d une `}`, donc on l ancre directement.
  const corpsTiroir = /body:has\(\.app-shell--preparer\)\s*\.lkv-sheet-up\s*\{([^}]*)\}/.exec(css);

  it('P5.1: le tiroir lit la MEME recurrence de materiau que la barre d etapes', () => {
    expect(corpsTiroir, 'la regle du tiroir .lkv-sheet-up est introuvable').not.toBeNull();
    const corps = corpsTiroir![1] as string;
    expect(corps, 'le tiroir ne lit pas la recette unique --prep-glass-material').toMatch(
      /box-shadow:[^;]*var\(--prep-glass-material\)/,
    );
  });

  it('P5.1: le tiroir ne double pas un layer que le materiau contient deja', () => {
    const corps = corpsTiroir![1] as string;
    // --prep-glass-material compose deja --prep-glass-bounce : le garder en
    // plus drewdouble l arete du bas.
    expect(corps, 'le tiroir empile --prep-glass-bounce en double').not.toMatch(
      /var\(--prep-glass-bounce\)/,
    );
  });

  it('P5.1: le tiroir garde son liseré du HAUT, seule arete visible', () => {
    // Le materiau ne pose un inset qu en bas. Sur une feuille qui monte du
    // bas, l arete vue est celle du haut : la retirer rendrait la feuille
    // sans liseré superieur.
    const corps = corpsTiroir![1] as string;
    expect(corps, 'le liseré du haut du tiroir a disparu').toMatch(
      /0 -1px 0 0 var\(--prep-hairline-ink\)/,
    );
  });

  // G3.1 - deux surfaces hors lot ont rejoint l invariant apres mesure.
  // 393x852, draft reel de l etape 3 :
  //   l en-tete d etape   « Ton aventure » 3,74 / resume 3,46 / Modifier 3,19
  //   points a verifier   1,40 / 1,91 / 1,92 / 1,99
  // Aucune n avait de regle du tout : l en-tete est un `div` sans classe
  // (background transparent, border-radius 0), et le bloc « points a verifier »
  // recevait un LAVAGE d alerte clair en style inline qui écrasait le noir.
  //
  // Elles ne se lisent pas avec `rule()` : dans l invariant ce sont des
  // SELECTEURS DE LISTE, leur corps est celui du bloc entier. On verifie donc
  // l appartenance a la liste, et le materiau une seule fois pour elle.
  // L corps doit porter --prep-panel-bg : c est ce qui designe LE bloc invariant
  // parmi les regles qui listent `.prep-nav`, et non une regle de forme voisine.
  const invariant =
    /\.prep-nav\s*,([^}]*?)\{([^}]*var\(--prep-panel-bg\)[^}]*)\}/.exec(css);

  it('G3.1: l invariant de verre couvre l en-tape et le bloc points-a-verifier', () => {
    expect(invariant, 'l invariant de verre .prep-nav est introuvable').not.toBeNull();
    const selecteurs = invariant![1] as string;
    expect(selecteurs, 'l en-tete d etape ne partage pas le materiau').toContain(
      '.prep-body > div:has(> div > .prep-title)',
    );
    expect(selecteurs, 'le bloc points-a-verifier ne partage pas le materiau').toContain(
      '.prep-openpoints',
    );
  });

  it('G3.1: le materiau partage est declare une seule fois, en un bloc', () => {
    const corps = invariant![2] as string;
    expect(corps, 'le fond du materiau partage a disparu').toMatch(
      /background-color:\s*var\(--prep-panel-bg\)\s*!important/,
    );
    expect(corps, 'le flou du materiau partage a disparu').toMatch(
      /backdrop-filter:\s*blur\(var\(--prep-panel-blur\)\)/,
    );
    expect(corps, 'l ombre du materiau partage a disparu').toMatch(
      /box-shadow:\s*var\(--prep-glass-material\)/,
    );
  });
});
