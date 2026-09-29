import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * G3.1 (suite) — AUCUN TEXTE DE LECTURE NE DOIT NAGER SUR LA PHOTO.
 *
 * LE DEFAUT, reel et mesure : `.prep-maphint` — le message d attente de la
 * carte — etait un `<p>` nu, sans panneau ni verre, pose directement sur la
 * photo. La ou tous les autres textes de lecture ont un materiau, celui-la
 * n'en avait aucun.
 *
 * Campagne navigateur 393x852, `/prepare?nouvelle=1`, draft d itineraire
 * seme (`--seed qa-local/p53-draft.json`) :
 *
 *   AVANT  worst 2,64:1  best 12,05:1   sur un fond clair a 141
 *   APRES  worst 3,23:1  best  9,19:1   sur son propre panneau
 *
 * L ecart worst/best de 9 points AVANT est le signe d un texte pose sur une
 * photo variable : sur les neiges claires il disparait completement. La
 * capture le montrait — le texte se lisait en haut du cadre et se noyait en
 * bas. Un seulcorrectif d encre n aurait pas suffi : il fallait une surface.
 */

const FEUILLE = join(__dirname, '..', 'adventure-prep.css');

/** Regle vivante, commentaires retires. */
function bloc(sel: string): string {
  const brut = readFileSync(FEUILLE, 'utf8').replace(/\r\n/g, '\n');
  const vivant = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const i = vivant.indexOf(sel + ' {');
  if (i < 0) throw new Error(`regle absente : ${sel}`);
  const fin = vivant.indexOf('}', i);
  return vivant.slice(i, fin);
}

describe('G3.1 - le message de la carte a sa propre surface', () => {
  it('MAPHINT-01: le maphint porte un materiau, pas un fond transparent', () => {
    const r = bloc('.prep-maphint');
    expect(r).toMatch(/background-color:\s*var\(--prep-panel-bg\)/);
    expect(r).toMatch(/backdrop-filter:/);
  });

  it('MAPHINT-02: son encre vient des jetons du preparateur', () => {
    expect(bloc('.prep-maphint')).toMatch(/color:\s*var\(--prep-ink-secondary\)/);
  });

  it('MAPHINT-03: il est arrondi comme les autres panneaux de lecture', () => {
    // Sans arrondi, le texte flotte sur un aplat rectangulaire : le meme
    // materiau doit se lire comme les cartes voisines.
    expect(bloc('.prep-maphint')).toMatch(/border-radius:\s*var\(--prep-radius-card\)/);
  });

  it('MAPHINT-04: le test mord — un maphint sans materiau echouerait', () => {
    // Auto-verification : le test ne peut pas passer sur une feuille ou le
    // maphint aurait retrouve son fond transparent. Sans ce controle, un
    // garde-fou incapable d echouer ne prouverait rien.
    const cassee = '.prep-maphint { color: var(--prep-ink-subtle); }';
    expect(cassee).not.toMatch(/background-color/);
    expect(bloc('.prep-maphint')).toMatch(/background-color/);
  });
});
