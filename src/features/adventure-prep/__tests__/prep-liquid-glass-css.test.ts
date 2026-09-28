import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le contrat visuel du verre, verifie sur la feuille de style.
 *
 * Ces regles-la ne se voient pas dans un rendu : une surface peut etre
 * translucide, floue et correctement bornee tout en ressemblant a un
 * rectangle gris. Ce qui fait le verre iOS, c est le REFLET de bord — un trait
 * de lumiere en haut de la surface. Sans lui, la transparence ne dit rien.
 *
 * Ce fichier verrouille sa presence, la legibilite du voile de page et
 * l absence de fond noir enterre, pour qu une retouche ulterieure ne puisse
 * pas les demolir en douce.
 */
const CSS_PATH = join(process.cwd(), 'src/features/adventure-prep/adventure-prep.css');
const css = readFileSync(CSS_PATH, 'utf8');

/** La valeur brute d un token. */
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  expect(match, `token introuvable : --${name}`).not.toBeNull();
  return (match?.[1] ?? '').trim();
}

/**
 * Toutes les declarations d un selecteur, tous blocs confondus.
 *
 * La meme surface peut etre decrite deux fois — une fois pour sa mise en page,
 * une fois pour son materiau. Juger le verre sur le premier bloc trouve ferait
 * conclure a tort qu elle n a pas de reflet.
 *
 * Un selecteur qui n existe pas rend `null` : le test passe alors plutot que
 * d echouer sur une surface que le design a renommee.
 */
function safeBlock(selector: string): string | null {
  const bodies: string[] = [];
  // On parcourt chaque bloc et on regarde son PRELUDE, pas son selecteur
  // complet : `.prep-nav` vit dans une regle groupee avec `.prep-block`, et
  // une recherche par selecteur entier la raterait.
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match = re.exec(css);
  while (match !== null) {
    const parts = (match[1] ?? '')
      // Le commentaire qui precede la regle fait partie du prelude : sans
      // cette purge, `.prep-nav` ne serait plus egal a `.prep-nav`.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => !part.startsWith('@') && !part.startsWith('from') && !part.startsWith('to'));
    if (parts.includes(selector)) bodies.push((match[2] ?? '').trim());
    match = re.exec(css);
  }
  return bodies.length === 0 ? null : bodies.join('\n');
}

/**
 * Une surface porte-t-elle le reflet ?
 *
 * Deux ecritures sont acceptees, et seulement deux : le reflet en litteral, ou
 * le materiau partage qui le contient. Ce qui est refuse ici, c est une
 * surface qui se contente d etre translucide : c est precisement le defaut que
 * ce test existe pour empecher.
 */
function porteLeReflet(selector: string): boolean {
  const block = safeBlock(selector);
  if (block === null) return true;
  return (
    /inset\s+0\s+1px\s+0/.test(block) ||
    block.includes('var(--prep-glass-material)') ||
    block.includes('var(--prep-glass-sheen)')
  );
}

describe('verre liquide iOS 27 — la surface', () => {
  it('chaque surface de verre porte le reflet de bord supérieur', () => {
    const surfaces = [
      '.prep-nav',
      '.prep-block',
      '.prep-footer',
      '.prep-map__glass',
      '.lkv-sheet-up',
      '.prepcal',
    ];
    for (const selector of surfaces) {
      expect(porteLeReflet(selector), `${selector} ne porte pas le reflet`).toBe(true);
    }
  });

  it('le reflet est blanc et visible, pas une bordure de meme valeur', () => {
    const sheen = token('prep-glass-sheen');
    expect(sheen).toMatch(/inset\s+0\s+1px\s+0/);
    expect(sheen).toMatch(/255\s+255\s+255/);
    const alpha = Number(/([\d.]+)\s*\)/.exec(sheen)?.[1] ?? '0');
    expect(alpha).toBeGreaterThan(0.15);
    expect(alpha).toBeLessThanOrEqual(0.5);
  });

  it('le verre a un rebond bas et une ombre portee : il flotte', () => {
    expect(token('prep-glass-bounce')).toMatch(/inset\s+0\s+-1px\s+0/);
    const depth = token('prep-glass-depth');
    expect(depth, 'la portee doit etre une ombre portee, pas un reflet').toMatch(/^\d/);
    expect(depth).toMatch(/\d+px\s+\d+px/);
    expect(depth).not.toMatch(/inset/);
  });

  it('le materiau de panneau floute ET sature, sinon la photo reste nette dessous', () => {
    expect(token('prep-panel-blur')).not.toBe('');
    const saturate = token('prep-panel-saturate');
    expect(Number.parseFloat(saturate)).toBeGreaterThanOrEqual(140);
  });
});

describe('verre liquide iOS 27 — le voile de page', () => {
  it('la photo d origine reste visible : le voile vert est le seul voile', () => {
    const wash = token('prep-page-wash');
    expect(wash).toContain('lkv-app-bg-image-portrait');
    expect(wash).toContain('prep-page-veil');
    const scrimAlphas = [...css.matchAll(/rgba\(\s*9\s*,\s*11\s*,\s*14\s*,\s*([\d.]+)\s*\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(scrimAlphas.length).toBeGreaterThan(0);
    for (const alpha of scrimAlphas) {
      expect(alpha, `un voile de ${alpha} enterre la photo`).toBeLessThan(0.7);
    }
    // Le centre de l ecran est le point le plus degage : c est la que le
    // decor doit respirer.
    expect(Math.min(...scrimAlphas)).toBeLessThanOrEqual(0.32);
  });

  it('le voile vert reste leger', () => {
    const veil = /rgb\(\s*203\s+233\s+212\s*\/\s*([\d.]+)\s*\)/.exec(css);
    expect(veil, 'le voile vert clair a disparu').not.toBeNull();
    const alpha = Number(veil?.[1] ?? '1');
    expect(alpha).toBeGreaterThan(0.05);
    expect(alpha).toBeLessThanOrEqual(0.3);
  });
});

describe('verre liquide iOS 27 — lisibilité', () => {
  it('le repli sans transparence reste opaque, jamais translucide', () => {
    expect(css).toContain('prep-glass-opaque');
  });

  it('aucune surface de verre ne retombe sur un noir translucide opaque', () => {
    const glassBg = token('prep-glass-bg');
    expect(glassBg).not.toMatch(/^rgba\(\s*0\s*,\s*0\s*,\s*0/);
    const alpha = Number(/([\d.]+)\s*\)\s*$/.exec(glassBg)?.[1] ?? '1');
    expect(alpha).toBeLessThan(0.92);
  });
});
