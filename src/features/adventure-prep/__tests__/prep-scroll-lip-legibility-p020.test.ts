import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'adventure-prep.css'), 'utf8');

/**
 * P0.20 — la langue de verre AN9 rendait ILLISIBLE le dernier contenu lisible.
 *
 * Mesure navigateur 393x852, etape 1, gabarit a duree suggeree, bandeau
 * cookies visible (etat de premiere visite, celui que voit une personne reelle) :
 *
 *   .prep-body     top 60   bottom 528   clientHeight 468   maxScroll 181
 *   .prep-footer   top 528  bottom 593   (position relative — AUCUN recouvrement)
 *   pastille « Duree proposee · modifiable »  top 507.4  bottom 547  (h 39.6)
 *
 * Deux verites que la mesure tranche :
 *
 *  1. Le pied ne RECOUVRE rien. `bodyBottom === footerTop === 528` : le pied est
 *     un frere flex sous le scrollport, pas une couche au-dessus. La coupe est
 *     donc celle du scrollport — un behavement normal, pas un defaut de mise en
 *     page. 40 px de defilement suffisent a rendre la pastille integralement
 *     lisible (mesure : scrollTop 40 -> badgeVisibleH 39.6/39.6 = 100 %).
 *
 *  2. MAIS au repos il ne reste que 20.6 px visibles sur 39.6, soit 52 %. Et la
 *     langue fait exactement 20 px, ancree a `bottom: 100%` du pied : elle
 *     occupe donc 508 -> 528, c'est-a-dire 97 % du peu de slice encore lisible.
 *     Son `backdrop-filter: blur(6px)` ternit precisement le texte qui
 *     survivait. La pastille parait cassee en deux, alors que rien n'est perdu.
 *
 *  Or le dessein meme d'AN9 etait de « le dire sans rien cacher » : une langue
 *  qui rend le dernier fragment illisible cache ce qu'elle pretend montrer.
 *  Le degrade suffit a signaler la continuation ; le flou, applique sur toute la
 *  hauteur, ne fait que detruire la lisibilite. D'ou le correctif : le flou doit
 *  etre MASQUE — nul en haut de la langue (la tranche encore lisible reste
 *  nette), plein au ras de la coupe (la transition vers le pied reste en verre).
 */

function reglePseudo(sel: string, pseudo: string): string {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + pseudo + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}

function hauteurLangue(): number {
  const m = css.match(/--prep-scroll-lip-h\s*:\s*(\d+(?:\.\d+)?)px/);
  if (!m) throw new Error('--prep-scroll-lip-h absent');
  return Number(m[1]);
}

const lip = reglePseudo('.prep-footer', '::before');

describe('P0.20 — la langue ne doit plus ternir le dernier contenu lisible', () => {
  it('la langue est animee par un masque qui eteint le flou vers le haut', () => {
    // Sans masque, le flou couvre toute la hauteur de la langue et donc toute
    // la tranche encore visible du dernier bloc. C'est le defaut mesure.
    expect(lip).toMatch(/mask-image:/);
  });

  it('le masque est transparent en haut de la langue, opaque en bas', () => {
    const m = lip.match(/mask-image:\s*linear-gradient\(([^;]*)\)/);
    expect(m).not.toBeNull();
    const decl = m?.[1] ?? '';
    // L ordre des sillons est explicite : la transition doit se faire vers la
    // couleur de lArgument, pas s attendre a une inversion implicite.
    expect(decl).toMatch(/to\s+top/);
    expect(decl).toMatch(/transparent/);
    // Le haut de la langue (fin du gradient) est le point qui touche le contenu
    // encore lisible : il doit y etre transparent.
    expect(decl.trim().endsWith('transparent 100%')).toBe(true);
  });

  it('le flou reste anisotrope : il estome pres de la coupe, pas sur le contenu', () => {
    // On garde un verre — le style iOS 27 l exige — mais on interdit explicitement
    // de redevenir un aplat flou uniforme sur toute la langue.
    expect(lip).toMatch(/backdrop-filter:/);
    expect(lip).toMatch(/-webkit-backdrop-filter:/);
    // Une langue plus courte que la tranche visible ne servirait a rien ; plus
    // longue qu avant, elle recommencerait a manger le contenu.
    expect(hauteurLangue()).toBeLessThanOrEqual(20);
  });

  it('le degrade de la langue reste present : c est lui qui signale la suite', () => {
    expect(lip).toMatch(/linear-gradient\(/);
    expect(lip).toMatch(/background:\s*linear-gradient/);
  });

  it('la langue ne peut toujours ni capter le geste ni deplacer le contenu', () => {
    expect(lip).toMatch(/pointer-events:\s*none/);
    expect(lip).toMatch(/position:\s*absolute/);
    // Le masque ne doit pas introduire de second calque interactif.
    expect(lip).not.toMatch(/pointer-events:\s*(auto|all)/);
  });
});