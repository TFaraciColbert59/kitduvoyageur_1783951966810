import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'adventure-prep.css'), 'utf8');
const tokens = readFileSync(join(here, '..', '..', '..', 'styles', 'tokens.css'), 'utf8');

/**
 * AN9 — mesure navigateur 393x852, etape 1, gabarit a duree suggeree :
 *   .prep-body    top 60 / bottom 528 (clientHeight 468, scrollHeight 643)
 *   .prep-footer  top 528 / bottom 593, position relative, opaque
 *   pastille « Duree a preciser · modifiable »  top 511.4 / bottom 541.2 (h 29.8)
 *   => CHEVAUCHEMENT 13.2 px : 44 % de la pastille sous la ligne de coupe.
 *
 * La cause supposee au checklist (« pas de reserve entre le dernier bloc et
 * .prep-footer ») est FAUSSE, et la corriger sous ce nom aurait ajoute un
 * trou : mesure, apres defilement en bas, il reste 23.7 px libres, le corps
 * defile (maxScroll 175 px) et la pastille redevient entierement lisible.
 *
 * Le defaut reel est la COUPURE : .prep-footer est opaque et ne laissait
 * aucun signe de continuation, donc un bloc intact traversant la ligne de
 * coupe paraissait casse. Ces tests verrouillent la langue de verre qui
 * remplace la coupe.
 */

/** Reserve reelle du corps : padding-bottom de .prep-body, via --space-6. */
function reserveDuCorps(): number {
  const def = tokens.match(/--space-6\s*:\s*(\d+(?:\.\d+)?)px/);
  if (!def) throw new Error('--space-6 introuvable dans tokens.css');
  return Number(def[1]);
}

function reglePseudo(sel: string, pseudo: string): string {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + pseudo + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}

function hauteurLangue(): number {
  const m = css.match(/--prep-scroll-lip-h\s*:\s*(\d+(?:\.\d+)?)px/);
  if (!m) throw new Error('--prep-scroll-lip-h absent : la langue de verre n est pas dimensionnee');
  return Number(m[1]);
}

describe('AN9 — le contenu ne doit plus etre tranche net par la barre d action', () => {
  it('pose une langue de verre juste au-dessus de la barre d action', () => {
    const lip = reglePseudo('.prep-footer', '::before');
    expect(lip).not.toBe('');
    // Ancree sur le BORD HAUT du pied, donc la langue vit dans la zone
    // scrollable et recouvre la ligne de coupe — pas le contenu du pied.
    expect(lip).toMatch(/bottom:\s*100%/);
  });

  it('la langue est hors flux : elle ne peut pas deplacer le contenu', () => {
    const lip = reglePseudo('.prep-footer', '::before');
    // Un pseudo-element de .prep-body serait un 6e item flex : il aurait
    // ajoute un `gap` de 16 px, mesure a 643 -> 659 px de scrollHeight, et
    // un bord sur deux. Hors flux, elle ne coute aucune hauteur.
    expect(lip).toMatch(/position:\s*absolute/);
    expect(lip).not.toMatch(/position:\s*(sticky|relative|fixed)/);
    expect(lip).not.toMatch(/flex:/);
  });

  it('la langue ne capte ni clic ni geste', () => {
    const lip = reglePseudo('.prep-footer', '::before');
    expect(lip).toMatch(/pointer-events:\s*none/);
  });

  it('la langue est un degrade vers le materiau, pas un aplat', () => {
    const lip = reglePseudo('.prep-footer', '::before');
    expect(lip).toMatch(/linear-gradient\(/);
    // Un aplat opaque serait une deuxieme barre franche : exactement le
    // defaut qu on supprime. Le degrade doit donc partir du transparent et
    // MONTER vers le materiau, puisque la zone masquee est en dessous.
    const grad = lip.match(/linear-gradient\(([^;]*)\)/);
    expect(grad?.[1]).toMatch(/transparent/);
    expect(lip).toMatch(/to top/);
  });

  it('la langue tient dans la reserve du corps : le dernier bloc n est jamais masque', () => {
    // Mesure navigateur : a fond de course le dernier bloc s arrete 23,7 px
    // au-dessus de la barre d action. La langue doit tenir dans cette
    // reserve, sinon elle ternit le dernier bloc en permanence.
    const reserve = reserveDuCorps();
    expect(reserve).toBe(24);
    expect(hauteurLangue()).toBeLessThanOrEqual(reserve);
    // 16 px : couvre la coupe mesuree de 13,2 px sans depasser la reserve.
    expect(hauteurLangue()).toBeGreaterThanOrEqual(14);
  });

  it('la langue du pied ne double pas celle du corps', () => {
    // Une seule piste de degradation : deux langues superposees
    // s additionneraient et noircyraient deux fois le meme bord.
    expect(reglePseudo('.prep-body', '::after')).toBe('');
  });

  it('aucun masque global sur le corps : il estomperait le dernier bloc', () => {
    expect(css).not.toMatch(/\.prep-body\s*\{[^}]*mask-image/);
  });
});
