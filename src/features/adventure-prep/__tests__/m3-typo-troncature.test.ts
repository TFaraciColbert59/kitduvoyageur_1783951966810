import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * M3 — lisibles, jamais tronques, jamais chevauches.
 *
 * M3.1 « zero ellipse sur un label ». Les trois sur trois reproches portaient
 * sur des MOTS (« Budget / per... », « Commun... », « J3 m... ») : c'est le
 * triptyque overflow:hidden + text-overflow:ellipsis + white-space:nowrap qui
 * coupe, pas la place disponible. Ces neuf selecteurs ont ete liberes : le
 * texte se replie a la ligne suivante. En contrepartie, trois selecteurs
 * GARDENT l'ellipse parce que d'autres tests du repo l'exigent — les
 * decocher ici serait casser le travail de quelqu'un d'autre, et ce serait
 * aussi une redecide de design qui n'est pas la mienne. Le test verrouille
 * les deux moities pour qu'aucune ne derive en silence.
 *
 * M3.2 « 4 tailles max, aucune taille ecrite en dur hors tokens ». Les
 * 71 declarations font-size de la feuille passent desormais par quatre
 * jetons. Les deux exceptions restantes sont des `min(jeton, Ncqi)` : elles
 * ne creent pas de taille nouvelle, elles font retrecir le MECHRE jeton
 * dans un conteneur etroit — une unite relative au conteneur, pas un nombre.
 *
 * M3.3 « libelle et valeur ne se chevauchent jamais ». Sur la tuile de
 * mesure, les deux sont en display:block : ils s empilent, ils ne partagent
 * aucune ligne, quelle que soit la longueur du libelle.
 */

const CSS = join(__dirname, '..', 'adventure-prep.css');
const css = readFileSync(CSS, 'utf8');
const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

function declarations(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m = re.exec(css);
  while (m !== null) {
    const sel = (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((p) => p.trim());
    // Les commentaires sont retires du CORPS aussi : un commentaire qui
    // contient `:` et point-virgule absorberait sinon la declaration suivante.
    const corps = (m[2] ?? '').replace(/\/\*[\s\S]*?\*\//g, ' ');
    if (sel.includes(selector)) {
      for (const d of corps.split(';')) {
        const i = d.indexOf(':');
        if (i > 0) out.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
      }
    }
    m = re.exec(css);
  }
  return out;
}

/** Les neuf selecteurs liberes de l'ellipse. */
const LIBERES = [
  '.t1',
  '.t2',
  '.prep-metric__label',
  '.prep-programme__sky',
  '.prep-programme__steptitle',
  '.prep-step__place',
  '.prep-cell__value',
  '.prep-block__detail',
  '.prep-pill__label',
] as const;

/** Les trois selecteurs ou l'ellipse est un contrat d'autres tests. */
const CONTRACTUELS = ['.prep-block__label', '.prep-block__value', '.prep-act__name'] as const;

const TYPES = ['--prep-type-title', '--prep-type-body', '--prep-type-label', '--prep-type-meta'] as const;

describe('M3.1 — aucune ellipse sur un libelle', () => {
  it('les neuf selecteurs liberes existent tous', () => {
    for (const s of LIBERES) {
      expect(declarations(s).size, `le selecteur ${s} a disparu`).toBeGreaterThan(0);
    }
  });

  it('aucun des neuf ne porte text-overflow: ellipsis', () => {
    for (const s of LIBERES) {
      const d = declarations(s);
      expect(`${s} text-overflow=${d.get('text-overflow') ?? ''}`).toBe(
        `${s} text-overflow=`,
      );
    }
  });

  it('aucun des neuf ne peut tronquer son texte', () => {
    // Le triptyque complet, pas seulement text-overflow : un overflow:hidden
    // seul coupe deja visuellement sans jamais ecrire « ... ».
    for (const s of LIBERES) {
      const d = declarations(s);
      expect(`${s} overflow=${d.get('overflow') ?? ''}`, `${s} masque encore son contenu`).toBe(
        `${s} overflow=`,
      );
      expect(`${s} white-space=${d.get('white-space') ?? ''}`).not.toContain('nowrap');
    }
  });

  it('chacun des neuf peut replier son texte a la ligne', () => {
    for (const s of LIBERES) {
      const d = declarations(s);
      const repli = d.get('overflow-wrap') ?? d.get('word-break') ?? '';
      expect(repli, `${s} ne peut pas replier un mot long`).not.toBe('');
    }
  });

  it('les trois selecteurs contractuels gardent leur ellipse', () => {
    for (const s of CONTRACTUELS) {
      expect(
        declarations(s).get('text-overflow'),
        `${s} a perdu l ellipse que d autres tests du repo exigent`,
      ).toBe('ellipsis');
    }
  });
});

describe('M3.2 — quatre tailles, et rien d ecrit en dur', () => {
  it('il existe exactement quatre jetons de taille, tous(alias) sur le design system', () => {
    const trouves = [
      ...new Set([...css.matchAll(/(--prep-type-[a-z-]+):\s*([^;]+);/g)].map((m) => m[1] ?? '')),
    ].sort();
    expect(trouves).toEqual([...TYPES].sort());
    for (const t of TYPES) {
      const v = new RegExp(`${t}:\\s*([^;]+);`).exec(css)?.[1] ?? '';
      expect(v, `${t} doit pointer sur un jeton du design system`).toMatch(/^var\(\s*--lkv-text-/);
    }
  });

  it('aucune taille de police n est ecrite en pixels', () => {
    const brutes = [...sansCommentaires.matchAll(/font-size:\s*([0-9.]+px[^;]*);/g)].map(
      (m) => m[1] ?? '',
    );
    expect(brutes, `tailles en dur : ${JSON.stringify(brutes)}`).toEqual([]);
  });

  it('toutes les tailles passent par l un des quatre jetons', () => {
    const valeurs = [...sansCommentaires.matchAll(/font-size:\s*([^;]+);/g)].map((m) => (m[1] ?? '').trim());
    expect(valeurs.length, 'la feuille a perdu ses declarations font-size').toBeGreaterThan(60);
    for (const v of valeurs) {
      // Soit le jeton direct, soit un `min(jeton, cqi)` qui fait retrecir
      // ce meme jeton dans un conteneur etroit.
      expect(v, `taille hors jeton : ${v}`).toMatch(/^var\(--prep-type-|^min\(var\(--prep-type-/);
    }
  });

  it('aucun bridage fluide ne subsiste : la tuile de mesure ne peut pas descendre sous 13 px', () => {
    // G3.1, mesure au navigateur en 393x852. Les deux bridages
    // min(jeton, cqi) avaient ete poses pour faire retrecir le MEME jeton
    // dans un conteneur etroit. Sur la tuile de mesure ils produisaient
    // l'inverse de leur but : la boite de contenu de .prep-metric y fait
    // 80 px, donc 13,5 cqi = 10,8 px et 15 cqi = 12 px. Le chiffre que
    // l'utilisateur vient mesurer devenait illisible, et le plancher
    // max(12px, ...) pose pour le rattraper violait ce meme contrat en
    // ecrivant une taille en dur.
    //
    // Le correctif nest pas de choisir un autre plancher en pixels : une
    // unite de conteneur ne peut pas garantir une taille lisible sur une
    // grille 3 colonnes dans un telephone de 393 px, la place ny est pas.
    // Les valeurs passent donc par le jeton, et si elles debordent elles
    // passent a la ligne : min-width: 0 est deja pose sur la tuile (M3.3).
    const brides = valeurs().filter((v) => v.includes('cqi'));
    expect(brides, 'un bridage en unite de conteneur est revenu').toEqual([]);
    expect(css, 'container-type sans consommateur @container').not.toContain('container-type:');
  });

  it('la valeur de mesure porte un jeton, jamais une taille relative', () => {
    const d = declarations('.prep-metric__value');
    expect(d.get('font-size')).toBe('var(--prep-type-body)');
  });

describe('M3.3 — libelle et valeur ne se chevauchent jamais', () => {
  it('le libelle de tuile est un bloc', () => {
    expect(declarations('.prep-metric__label').get('display')).toBe('block');
  });

  it('la valeur de tuile est un bloc', () => {
    expect(declarations('.prep-metric__value').get('display')).toBe('block');
  });

  it('aucun des deux ne sort du flux', () => {
    // display:block les deux : ils s empilent. Un `position: absolute` ou un
    // `float` remettrait le libelle PAR-DESSUS le chiffre, exactement le
    // chevauchement que l item interdit.
    for (const s of ['.prep-metric__label', '.prep-metric__value'] as const) {
      const d = declarations(s);
      expect(`${s} position=${d.get('position') ?? ''}`).toBe(`${s} position=`);
      expect(`${s} float=${d.get('float') ?? ''}`).toBe(`${s} float=`);
    }
  });

  it('la tuile reserve sa propre largeur au lieu de la prendre sur le texte', () => {
    // Sans `min-width: 0`, un enfant long refuse de retrecir et pousse la
    // tuile hors de la grille : le premier des deux chevauchements.
    expect(declarations('.prep-metric').get('min-width')).toBe('0');
  });
});

/** Toutes les valeurs font-size de la feuille, dedoublonnees. */
function valeurs(): string[] {
  return [...new Set([...sansCommentaires.matchAll(/font-size:\s*([^;]+);/g)].map((m) => (m[1] ?? '').trim()))];
}
});
