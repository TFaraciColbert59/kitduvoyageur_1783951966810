import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * M0 — la cause racine n'etait pas une teinte, c'etait une absence.
 *
 * Trois absences distinctes, verifiees ici sur la feuille :
 *   M0.1 le reflet de bord, qui fait lire une surface translucide comme du
 *        verre et non comme un rectangle flou ;
 *   M0.2 la couleur du verre, qui etait du NOIR translucide ;
 *   M0.3 la base de la page, qui etait un noir opaque ecrit en dur.
 *
 * M0.4 verrouille ce qu'il ne faut pas casser : le flou de 22 px et le repli
 * `prefers-reduced-transparency`.
 *
 * NOTE DE LECTURE SUR M0.1. L'item du checklist demande « 0 occurrence de
 * `inset 0 1px 0` dans tout le fichier » tout en nommant ce trait « LA
 * signature du verre iOS » et en Reprochant lui-meme un
 * `inset 0 1px 0 rgb(255 255 255 / 0.28)` dans le correctif de reference de
 * la meme section. Les deux propositions ne peuvent pas etre vraies ensemble.
 * C'est l'INTENTION qui est appliquee ici — le reflet est porte, blanc, et
 * visible — et c'est elle que ces tests mesurent. Supprimer le reflet ferait
 * echouer `prep-liquid-glass-css.test.ts`, qui l'exige deja : le supprimer
 * serait casser glass, ce que la demande « liquide, pas cassé » interdit.
 */

const CSS = join(__dirname, '..', 'adventure-prep.css');
const css = readFileSync(CSS, 'utf8');
const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** La valeur brute d'un jeton. */
function jeton(nom: string): string {
  const m = new RegExp(`--${nom}:\\s*([^;]+);`).exec(css);
  expect(m, `jeton introuvable : --${nom}`).not.toBeNull();
  return (m?.[1] ?? '').trim();
}

/** Toutes les declarations d'un selecteur, tous blocs confondus. */
function bloc(selector: string): string | null {
  const corps: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m = re.exec(css);
  while (m !== null) {
    const sel = (m[1] ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => !p.startsWith('@'));
    if (sel.includes(selector)) corps.push((m[2] ?? '').trim());
    m = re.exec(css);
  }
  return corps.length === 0 ? null : corps.join('\n');
}

/** Les trois canaux d'une couleur `rgb(r g b / a)`, ou null. */
function rgb(valeur: string): { r: number; g: number; b: number; a: number } | null {
  const m = /rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/.exec(valeur);
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

describe('M0.1 — le reflet de bord est porte, pas seulement defini', () => {
  it('le jeton du reflet existe, est blanc, et assez visible pour se voir', () => {
    const sheen = jeton('prep-glass-sheen');
    expect(sheen, 'le reflet de bord a disparu').toMatch(/inset\s+0\s+1px\s+0/);
    const c = rgb(sheen);
    expect(c, `le reflet n'est pas une couleur lisible : ${sheen}`).not.toBeNull();
    expect(c?.r).toBe(255);
    expect(c?.g).toBe(255);
    expect(c?.b).toBe(255);
    expect(c?.a, 'un reflet trop faible ne se voit pas').toBeGreaterThan(0.15);
    expect(c?.a, 'un reflet trop fort devient une bordure').toBeLessThanOrEqual(0.5);
  });

  it('le materiau compose bien le reflet — un jeton isole ne servirait a rien', () => {
    // C'est precisement le piege annonce : un jeton defini et jamais lu
    // ne change aucun pixel. On verifie donc la COMPOSITION, pas le jeton.
    expect(jeton('prep-glass-material')).toMatch(/var\(--prep-glass-sheen\)/);
    expect(jeton('prep-glass-material')).toMatch(/var\(--prep-glass-bounce\)/);
    expect(jeton('prep-glass-material')).toMatch(/var\(--prep-glass-depth\)/);
  });

  it('le materiau est APPLIQUE : chaque surface de verre le consomme', () => {
    // Un jeton compose mais jamais pose reste un jeton mort. La liste est
    // celle de `prep-liquid-glass-css.test.ts`, et on exige en plus que la
    // surface cite explicitement le materiau compose.
    for (const s of ['.prep-nav', '.prep-block', '.prep-footer']) {
      expect(bloc(s), `${s} a disparu de la feuille`).not.toBeNull();
      expect(bloc(s) ?? '', `${s} ne pose pas le materiau de verre`).toContain(
        'var(--prep-glass-material)',
      );
    }
  });

  it('le nombre de surfaces qui portent le reflet ne peut pas retrograder', () => {
    const porteuses = [...sansCommentaires.matchAll(/box-shadow:[^;]*var\(--prep-glass-material\)/g)];
    expect(
      porteuses.length,
      'le materiau de verre a ete retire de plusieurs surfaces a la fois',
    ).toBeGreaterThanOrEqual(8);
  });
});

describe('M0.2 — le verre est blanc, pas noir', () => {
  it('la couleur du verre est du BLANC a 10-30 %', () => {
    const bg = jeton('prep-glass-bg');
    const c = rgb(bg);
    expect(c, `le verre n est pas une couleur analysable : ${bg}`).not.toBeNull();
    expect(c?.r, 'le verre doit etre blanc').toBe(255);
    expect(c?.g, 'le verre doit etre blanc').toBe(255);
    expect(c?.b, 'le verre doit etre blanc').toBe(255);
    expect(c?.a, 'la densite sort de la plage 10-30 % de la spec').toBeGreaterThanOrEqual(0.1);
    expect(c?.a, 'la densite sort de la plage 10-30 % de la spec').toBeLessThanOrEqual(0.3);
  });

  it('aucun canal du verre ne reste sombre', () => {
    // Le piege de l ancien rendu : un "presque noir" (14 18 16) passe le
    // test "ce n est pas du noir pur" tout en se lisant comme un trou.
    const c = rgb(jeton('prep-glass-bg'));
    const canaux = [c?.r ?? 0, c?.g ?? 0, c?.b ?? 0];
    for (const v of canaux) {
      expect(v, 'un canal sombre signifie un verre noir, pas un verre clair').toBeGreaterThan(200);
    }
  });
});

describe('M0.3 — la photo reste la base, plus un aplat noir', () => {
  it('la base de la page est le jeton du reste de l app, pas un noir en dur', () => {
    // `.lkv-app-background` (src/styles/tailwind.css) pose exactement
    // `background-color: var(--lkv-app-bg-fallback)`. Le preparateur
    // reprends cette valeur : plus de fond noir qui n'appartient qu'a lui.
    expect(jeton('prep-page-bg')).toBe('var(--lkv-app-bg-fallback)');
  });

  it('le noir en dur a disparu de toute la feuille', () => {
    // #0b0d12 n'a de sens que dans le repli du theme SOMBRE, ou
    // --lkv-app-bg-fallback le redonne tout seul. Ecrit en dur dans le
    // preparateur, il imposait le fond noir en theme clair.
    expect(css, 'le fond noir opaque est toujours ecrit en dur').not.toMatch(/#0b0d12/i);
  });

  it('la photo d origine est bien la couche peinte, en portrait ET en paysage', () => {
    expect(jeton('prep-page-wash')).toContain('lkv-app-bg-image-portrait');
    expect(jeton('prep-page-wash-landscape')).toContain('lkv-app-bg-image-landscape');
    expect(jeton('prep-page-wash')).toContain('prep-page-veil');
  });

  it('le voile vert est CLAIR et LEGER, comme demande', () => {
    const voile = rgb(jeton('prep-page-veil'));
    expect(voile, 'le voile vert a disparu').not.toBeNull();
    // Vert : le canal vert domine nettement les deux autres.
    expect(voile?.g ?? 0).toBeGreaterThan(voile?.r ?? 0);
    expect(voile?.g ?? 0).toBeGreaterThan(voile?.b ?? 0);
    expect(voile?.a, 'un voile trop dense ecraserait la photo').toBeGreaterThan(0.05);
    expect(voile?.a, 'un voile trop dense ecraserait la photo').toBeLessThanOrEqual(0.3);
  });

  it('le voile de lisibilite ne peut pas devenir un aplat', () => {
    const scrim = jeton('prep-page-scrim');
    for (const m of scrim.matchAll(/rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*,\s*([\d.]+)\s*\)/g)) {
      expect(Number(m[4]), 'un voile trop dense enterre la photo').toBeLessThan(0.7);
    }
  });
});

describe('M0.4 — ce qui ne doit pas etre casse', () => {
  it('le flou de panneau reste a 22 px', () => {
    expect(jeton('prep-panel-blur')).toBe('22px');
  });

  it('le repli prefers-reduced-transparency aplatit bien le verre', () => {
    const m = /@media \(prefers-reduced-transparency: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(m, 'le repli sans transparence a disparu').not.toBeNull();
    const corps = m?.[1] ?? '';
    expect(corps).toContain('--prep-glass-bg: var(--prep-glass-opaque)');
    expect(corps).toContain('--prep-glass-blur: 0px');
  });

  it('le repli reste declare, et pas seulement herite', () => {
    // Le jeton existe toujours : un repli qui ne pointe nulle part
    // laisserait le verre translucide sur un systeme qui l interdit.
    expect(jeton('prep-glass-opaque')).not.toBe('');
  });
});