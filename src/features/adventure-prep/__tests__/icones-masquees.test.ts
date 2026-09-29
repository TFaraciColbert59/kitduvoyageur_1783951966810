import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * ICONES MASQUEES — une icone doit PEINDRE, jamais etre neutralisee.
 *
 * LE DEFAUT, reel et total : `adventure-prep.css` portait
 *
 *   :is(.prep-action, .prep-act, .prep-nav, .prep-footer, .prep-block,
 *        .prep-search, .prep-cats) span[style*='mask-image']
 *     { background-color: transparent !important; }
 *
 * `Icon.tsx` rend une icone en <span style="... mask-image:url(...)"> et
 * pose `backgroundColor: color || 'currentColor'` sur ce span. La regle
 * annulait donc exactement la peinture du glyphe.
 *
 * MESURE, navigateur 393x852, /prepare?nouvelle=1, tiroir Depart :
 *   - bouton « Utiliser ma position » : 44x44, DOM correct
 *     (`<span role="img" style="... mask-image:url(/icons/sf/compass.svg)">`)
 *   - `background-color` calcule : `rgba(0, 0, 0, 0)`
 *   - capture : deux cercles VIDES, ni boussole ni carte
 *   - etape 1 complete : 9 icones masquees sur 15 invisibles
 *
 * Pourquoi c'etait une erreur de mecanique : en CSS Masking, `mask-image`
 * ne rogne pas une image de fond, il rogne la PEINTURE de l'element. Un
 * `background-color` sous un masque ne peint que la forme du masque, il ne
 * peut donc pas produire de carre. La regle ne calmait rien : elle effacait.
 *
 * CE QUE CE TEST EMPECHE : la neutralisation de revenir. Elle est
 * invisible au test de contraste — un glyphe absent n'est pas un texte
 * illisible, l'audit mesurait 0 echec AVEC les icones effacees. C'est
 * exactement le genre de panne qu'un audit de contraste ne voit pas.
 */

/** La feuille du preparateur, seule capable de neutraliser une icone. */
const FEUILLE = join(__dirname, '..', 'adventure-prep.css');

/**
 * Les COMMENTAIRES sont retires avant toute lecture.
 *
 * Sans cela le fichier se mord lui-meme : la regle historique est citee en
 * toutes lettres dans le commentaire qui explique pourquoi elle a ete
 * supprimee, et un test qui lit le texte brut y voit une regle toujours
 * vivante. Un test qui ment sur son propre fichier est pire qu aucun test.
 */
const CSS = readFileSync(FEUILLE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Le composant qui peint : sans lui, il n'y aurait rien a neutraliser. */
const ICON_TSX = join(__dirname, '..', '..', '..', 'components', 'ui', 'Icon', 'Icon.tsx');
const ICON_SRC = readFileSync(ICON_TSX, 'utf8');

/** Les conteneurs que l'ancienne regle visait, et ou vivent les icones. */
const CONTENEURS = [
  '.prep-action', '.prep-act', '.prep-nav', '.prep-footer',
  '.prep-block', '.prep-search', '.prep-cats',
];

type Regle = { selecteur: string; corps: string };

/** Decompose la feuille en regles plates (le CSS du projet n'a pas de @media imbrique de predicats). */
function regles(): readonly Regle[] {
  const trouvees: Regle[] = [];
  const motif = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(CSS)) !== null) {
    const selecteur = m[1].trim();
    if (selecteur.startsWith('/*') || selecteur.startsWith('@')) continue;
    trouvees.push({ selecteur, corps: m[2] });
  }
  return trouvees;
}

describe('Icones masquees — la peinture du glyphe ne doit jamais etre annulee', () => {
  it('ICONE-01: aucune regle ne neutralise le fond d une icone masquee', () => {
    const coupables = regles()
      .filter((r) => r.selecteur.includes('mask-image'))
      .filter((r) => /background(?:-color)?\s*:\s*(?:transparent|none|initial)\b/i.test(r.corps))
      .map((r) => r.selecteur);
    expect(coupables).toEqual([]);
  });

  it('ICONE-02: la regle historique, elle, a bien disparu', () => {
    // Contre-temoin nominatif : sans ce nom-la, une autre facon de neutraliser
    // pourrait passer sous ICONE-01 en ecrivant autrement la meme horreur.
    expect(CSS).not.toContain("span[style*='mask-image'] {\n  background-color: transparent !important;\n}");
    expect(CSS).not.toMatch(/span\[style\*=['"]mask-image['"]\][^{]*\{[^}]*background[^}]*!important/);
  });

  it('ICONE-03: Icon.tsx peint toujours son glyphe', () => {
    // Sans ceoud painting, ICONE-01 neadiatorait plus a rien : il n y aurait
    // plus de fond a annuler, et le test passerait sur un Icon casse.
    expect(ICON_SRC).toContain("backgroundColor: color || 'currentColor'");
    expect(ICON_SRC).toContain('maskImage:');
  });

  it('ICONE-04: les conteneurs vises existent bien dans la feuille', () => {
    // Garde du perimetre : si les 7 classes disparaissent, la regle historique
    // ne porterait plus sur rien et ce fichier ne surveillerait plus rien.
    for (const c of CONTENEURS) {
      expect(CSS, `classe absente de la feuille : ${c}`).toContain(c);
    }
  });

  it('ICONE-05: le fichier de feuille mesure est bien le vrai', () => {
    expect(FEUILLE.endsWith(join('adventure-prep', 'adventure-prep.css'))).toBe(true);
    expect(CSS.length).toBeGreaterThan(50_000);
  });
});
