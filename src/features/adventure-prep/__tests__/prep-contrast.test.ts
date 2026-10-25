import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

interface Rule {
  selector: string;
  body: string;
}

function prepRules(): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .map((m) => ({ selector: m[1].trim(), body: m[2] }))
    .filter((r) => r.selector.split(',').every((s) => s.startsWith('.prep-')));
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of body.split(';')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    out.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return out;
}

/* --- P5.2 : le contraste du CTA, verifie SANS navigateur et SANS serveur. ---
   Une lecture de jeton ne prouve rien si elle ne suit pas la cascade. Donc
   on resout la chaine EXACTE que le CTA lit, dans l ordre, et on calcule le
   ratio WCAG sur le couple obtenu. Le sabotage d un seul maillon (l accent,
   l encre, ou la regle du CTA) fait rougir le test sur le bon nom. */

function hex(c: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) throw new Error('couleur non hex : ' + c);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Ratio WCAG 2.x entre deux couleurs opaques. */
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function jetonDe(source: string, nom: string): string {
  const m = new RegExp(nom.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+);').exec(source);
  if (!m) throw new Error('jeton introuvable : ' + nom);
  return m[1].trim();
}

function corpsDe(source: string, selecteur: string): string {
  const ech = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('(?:^|\\})\\s*' + ech + '\\s*\\{([^}]*)\\}', 'm').exec(source);
  return m?.[1] ?? '';
}

describe('P5.2 - le CTA « Créer mon parcours » garde 4,5:1', () => {
  // La paire reellement resolue au navigateur (393x852, /prepare) :
  //   actif  fond rgb(127,196,154)  encre rgb(8,21,15)  -> 9,13:1
  // Elle vient de la chaine : .prep-footer__primary { color: var(--lkv-on-action);
  // background-color: var(--lkv-action) } et, dans .adventure-prep,
  //   --lkv-action: var(--prep-ink-accent) = #7fc49a
  //   --lkv-on-action                    = #08150f
  const fond = hex(jetonDe(css, '--prep-ink-accent'));
  const encre = hex(jetonDe(css, '--lkv-on-action'));

  it('P5.2-01: le CTA actif lit bien le couple accent / encre du preparateur', () => {
    // On verifie d abord le LIEN, avant de mesurer : si le CTA cessait de lire
    // var(--lkv-action) / var(--lkv-on-action), le ratio ci-dessous
    // continuerait de passer sur des couleurs que plus personne n affiche.
    const corps = corpsDe(css, '.prep-footer__primary');
    expect(corps, 'le CTA doit lire sa couleur de fond dans --lkv-action').toMatch(
      /background-color:\s*var\(--lkv-action\)/,
    );
    expect(corps, 'le CTA doit lire son encre dans --lkv-on-action').toMatch(
      /color:\s*var\(--lkv-on-action\)/,
    );
  });

  it('P5.2-02: le couple accent / encre du CTA depasse 4,5:1', () => {
    const r = ratio(fond, encre);
    expect(r, `CTA actif : ${r.toFixed(2)}:1 (attendu >= 4,5:1)`).toBeGreaterThanOrEqual(4.5);
  });

  it('P5.2-03: l etat desactive est une PALETTE, pas une opacite', () => {
    // Mesure navigateur : le CTA desactive heritait du bouton clair de l app
    // (fond blanc 0,92 + opacity 0,45) et son texte tombait a ~1,3:1 sur le
    // verre sombre. Le correctif neutralise l heritage avec une palette
    // explicite. Une opacite reviendrait a cacquer sur la photo.
    const corps = corpsDe(css, '.prep-footer__primary:disabled');
    expect(corps, 'regle :disabled du CTA introuvable').not.toBe('');
    expect(corps, 'l etat desactive ne doit pas utiliser d opacite < 1').not.toMatch(
      /opacity:\s*(?!1\b)0?\.\d+/,
    );
    expect(corps, 'l etat desactive doit porter une encre explicite').toMatch(/color:\s*var\(/);
  });

  it('P5.2-05: l etat desactive lit ses couleurs dans --g3-bg-disabled et --g3-text-disabled', () => {
    const corps = corpsDe(css, '.prep-footer__primary:disabled');
    expect(corps, 'le CTA desactive doit lire son fond dans --g3-bg-disabled').toMatch(
      /background-color:\s*var\(--g3-bg-disabled\)/,
    );
    expect(corps, 'le CTA desactive doit lire son encre dans --g3-text-disabled').toMatch(
      /color:\s*var\(--g3-text-disabled\)/,
    );
  });

  it('P5.2-04: le calcul WCAG du test n est pas vacuous (auto-verification)', () => {
    // Un garde-fou incapable d echouer ne prouve rien. On le soumet a des
    // sondes de contraste CONNU. Si la calculatrice etait fausse, ici on le voit.
    expect(ratio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1); // paire max WCAG
    expect(ratio([250, 250, 250], [255, 255, 255])).toBeLessThan(1.2); // quasi invisible
  });
});


describe('les surfaces du preparateur restent lisibles en theme sombre', () => {
  it('aucune surface trainant de blanc ne porte un texte blanc', () => {
    // Regression mesuree en navigateur : la note melangeait sa surface avec
    // #fff alors que le texte restait blanc (theme sombre) -> ratio ~1.05,
    // texte invisible. Une surface claire impose une encre foncee.
    const offenders = prepRules()
      .filter(({ body }) => {
        const d = declarations(body);
        const bg = d.get('background-color') ?? d.get('background') ?? '';
        const color = d.get('color') ?? '';
        return bg.includes('#fff') && /^var\(--lkv-text-/.test(color);
      })
      .map((r) => r.selector);
    expect(offenders).toEqual([]);
  });

  it('la note ne melange pas sa surface avec du blanc', () => {
    const note = prepRules().find((r) => r.selector === '.prep-note');
    expect(note?.body ?? '').not.toMatch(/#fff/);
  });

  it("la note d'avertissement ne melange pas sa surface avec du blanc", () => {
    const warn = prepRules().find((r) => r.selector === ".prep-note[data-tone='warn']");
    expect(warn?.body ?? '').not.toMatch(/#fff/);
  });
});

/* --- G3.1 : l encre d appoint posee en style INLINE -----------------------
   Mesure navigateur, campagne `measure_prep_contrast.mjs --seed` sur le
   draft reel d itineraire, 4 points de rupture : « Poids du sac a estimer »
   sortait a 2,24:1. Le fond qui le porte tient 5,04:1 : le defaut est
   l ENCRE, pas le panneau.

   La cause est un `style` INLINE pose par DepartureStep.tsx :
   `color: var(--lkv-text-subtle)`, ou le jeton global vaut 46 % de blanc
   sous le theme de la page. Une declaration de classe ne peut pas
   l emporter : il faut `!important`. C est le meme arbitrage que
   `.prep-block`, qui neutralise deja un `backgroundColor` inline sur ce
   composant. On ne touche ni au JSX (fichier d un autre agent) ni au jeton
   global (design system) : on rattrape le span par selecteur
   d attribut, sur l encre de lecture du preparateur. */

describe('G3.1 - le span d appoint pose en style inline est rattrape', () => {
  const regle = '.prep-block span[style*=\'--lkv-text-subtle\']';

  /* La regle vit dans un GROUPE de selecteurs (deux jetons globaux sur la
     meme declaration), donc `corpsDe` — qui exige le selecteur suivi de `{` —
     ne la voit pas. On resout le groupe entier, puis on garde le corps. */
  /** Les selecteurs du GROUPE dont le 1er membre est `premierSelecteur`. */
  function listeGroupe(source: string, premierSelecteur: string): string[] {
    const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of sansCommentaires.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selecteurs = m[1].split(",").map((s) => s.trim());
      if (selecteurs[0] === premierSelecteur) return selecteurs;
    }
    return [];
  }

  function corpsGroupe(source: string, premierSelecteur: string): string {
    const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of sansCommentaires.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selecteurs = m[1].split(",").map((s) => s.trim());
      if (selecteurs[0] === premierSelecteur) return m[2];
    }
    return "";
  }

  it('G3.1-05: la regle existe et couvre les deux jetsons globaux casses', () => {
    const corps = corpsGroupe(css, regle);
    expect(corps, `regle ${regle} introuvable : le span inline retomberait a 46 % de blanc`).not.toBe('');
    // Le selecteur doit aussi couvrir --lkv-text-secondary : meme piege, meme
    // encre de sortie.
    // Le selecteur doit aussi couvrir --lkv-text-secondary : meme piege, meme
    // encre de sortie. On relit le GROUPE entier, pas seulement son 1er membre.
    const liste = listeGroupe(css, regle).join(", ");
    expect(liste, "le selecteur doit couvrir --lkv-text-subtle ET --lkv-text-secondary").toMatch(
      /--lkv-text-secondary/,
    );
  });

  it('G3.1-06: le span recoit l encre du preparateur, en !important', () => {
    // !important n est pas un detail de style : c est ce qui permet a la
    // feuille de rattraper un style inline. Sans lui, la regle ne gagne rien
    // et le texte reste a 46 % de blanc.
    const corps = corpsGroupe(css, regle);
    expect(corps, "l encre du span doit venir du jeton du preparateur").toMatch(
      /color:\s*var\(--prep-ink-subtle\)/,
    );
    expect(corps, 'le style inline l emporte : !important est obligatoire ici').toMatch(
      /color:[^;]*!important/,
    );
  });

  it('G3.1-07: le jeton de sortie ne retombe jamais sous 0,66 de blanc', () => {
    // Meme plancher que le reste de la feuille. Un jeton ecrit « a la main »
    // ici ferait passer G3.1-06 et echouerait ici.
    const alpha = Number(/([0-9]*\.?[0-9]+)\s*\)/.exec(jetonDe(css, '--prep-ink-subtle'))?.[1]);
    expect(Number.isNaN(alpha)).toBe(false);
    expect(alpha, `encre de sortie a ${(alpha * 100).toFixed(0)} % de blanc`).toBeGreaterThanOrEqual(0.66);
  });

  it('G3.1-08: le calcul du plancher n est pas vacuous (auto-verification)', () => {
    // Deux sondes de contraste CONNUES. Si l extraction etait fausse, ici on
    // le voit : le vrai jeton passe, un jeton a 46 % ne passerait pas.
    const alphaDe = (src: string) =>
      Number(/([0-9]*\.?[0-9]+)\s*\)/.exec(jetonDe(src, '--prep-ink-subtle'))?.[1]);
    expect(alphaDe(css)).toBeGreaterThanOrEqual(0.66);
    expect(alphaDe(':root{--prep-ink-subtle: rgb(255 255 255 / 0.46);}')).toBeLessThan(0.66);
  });
});
