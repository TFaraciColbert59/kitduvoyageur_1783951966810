import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * DISSOLUTION DU BORD BAS — la coupe franche qui sciait une ligne de mesure.
 *
 * Mesure live (2026-09-28, viewport 393x852, DScale 3, etape 3 « En avant ! »,
 * generation reelle 2 jours) :
 *
 *   .prep-body    top 60  / bottom 667   ( scrollHeight 1521, clientHeight 607 )
 *   .prep-footer  top 667 / bottom 736
 *
 *   bodyBottom === footerTop : le pied ne RECOUVRE rien. Le defaut n est donc
 *   pas un chevauchement, c est le `overflow-y: auto` du corps qui coupe la
 *   ligne « 22,7 km · 2 h 43 min · À vérifier » en plein milieu des glyphes,
 *   a 667 exactement. La « langue de verre » du pied existe bien
 *   (`.prep-footer::before`, 20 px, `blur(6px)`, mesure confirmee : content
 *   "", height 20px, bottom 68px) mais elle ne peut pas rattraper une coupe :
 *   son masque est transparent EN HAUT, la ou vivent les milieux de lettres.
 *   Un glyphe decoupe reste decoupe, quelle que soit la vitre posee apres.
 *
 *   Le seul traitement qui repond a « dire la continuation sans rien cacher »
 *   est donc de faire DISPARAITRE le contenu avant la coupe : un masque
 *   vertical au bas du corps. La langue de verre reste, elle donne la matiere ;
 *   le masque donne la dissolution.
 *
 * Meme harnais que `prep-bottom-inset.test.ts` : pas de jsdom, la feuille est
 * lue comme du texte.
 */

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Le bloc CSS dont l selecteur contient `wanted`. */
function rule(wanted: string): string {
  const found = withoutComments
    .split('}')
    .find((chunk) => chunk.includes(wanted));
  expect(found, `regle introuvable : ${wanted}`).toBeDefined();
  return found as string;
}

describe('Dissolution du bord bas de la zone scrollable', () => {
  it('DISS-01: le corps se dissout au lieu de se faire couper', () => {
    const body = rule('.prep-body {');
    expect(body).toMatch(/(?<!-webkit-)mask-image:\s*linear-gradient\(\s*to bottom/);
  });

  it('DISS-02: la hauteur du fondu est un token, pas une valeur en dur', () => {
    const body = rule('.prep-body {');
    expect(body).toContain('var(--prep-scroll-fade-h)');
    // Un fondu en dur ne serait pas reitable ni ajustable par theme.
    expect(body).not.toMatch(/calc\(100% - \d+px\)/);
  });

  it('DISS-03: le prefixed Safari/iOS accompagne le masque', () => {
    const body = rule('.prep-body {');
    expect(body).toMatch(/-webkit-mask-image:\s*linear-gradient\(\s*to bottom/);
  });

  it('DISS-04: la reserve basse couvre le fondu, sinon le dernier bloc s efface', () => {
    const body = rule('.prep-body {');
    const padding = body.match(/padding:\s*([^;]+);/)?.[1] ?? '';
    // Sans reserve, en fin de course le dernier bloc se retrouverait dans la
    // zone estompée — donc illisible a chaque arrivee.
    expect(padding).toMatch(/padding-bottom|var\(--prep-scroll-fade-h\)/);
    expect(padding).toContain('var(--prep-scroll-fade-h)');
  });

  it('DISS-05: le token existe et depasse la langue de verre', () => {
    const fade = Number(
      withoutComments.match(/--prep-scroll-fade-h:\s*(\d+)px/)?.[1] ?? '0',
    );
    const lip = Number(
      withoutComments.match(/--prep-scroll-lip-h:\s*(\d+)px/)?.[1] ?? '0',
    );
    expect(fade).toBeGreaterThan(0);
    // Le fondu doit etre plus large que la langue : il porte la ligne de
    // mesure entiere, pas seulement son dernier quart.
    expect(fade).toBeGreaterThan(lip);
  });

  it('DISS-06: la langue de verre reste — le masque ne remplace pas la matiere', () => {
    expect(withoutComments).toContain('.prep-footer::before');
    expect(withoutComments).toContain('--prep-scroll-lip-h');
  });
});
