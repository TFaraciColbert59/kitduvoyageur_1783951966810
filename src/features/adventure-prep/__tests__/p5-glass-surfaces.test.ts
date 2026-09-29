/**
 * P5.1 / P5.7 - triage des surfaces opaques du preparateur.
 *
 * Le systeme de design n'a qu'UNE recette de verre, celle de `.prep-step` :
 * `--prep-panel-bg` pour le fond, le trio `--prep-panel-blur` /
 * `--prep-panel-saturate` / `--prep-panel-brightness` pour le flou, l'arete
 * `--prep-hairline` et le materiau `--prep-glass-material` pour l'ombre.
 *
 * Toute surface du /prepare qui ne porte pas cette recette doit soit la
 * porter, soit etre declaree volontairement opaque par un marqueur `P5.7`
 * pose sur place. Ce fichier tient l'inventaire : il refuse qu'une surface
 * opaque apparaisse sans verdict, ce qui est la seule protection contre la
 * regression silencieuse qu'un tri ponctuel ne voit jamais venir.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CSS_PREP = 'src/features/adventure-prep/adventure-prep.css';
const CSS_VERRE = 'src/styles/liquid-glass.css';
const CSS_TOKENS = 'src/styles/tokens.css';
const CSS_IOS = 'src/styles/liquid-ios27.css';
const SHELL = 'src/features/adventure-prep/components/AdventurePrepShell.tsx';

const lire = (chemin: string): string => readFileSync(chemin, 'utf8');
const sansCommentaire = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '');

/* --- Jetons ------------------------------------------------------------- */

/** Table de jetons. Le dernier fichier chargeur gagne, donc l ouvrage qui
 *  redefinit `--lkv-surface` dans le preparateur est celui qui compte. Les
 *  commentaires sont retires AVANT lecture : une mention de jeton dans une
 *  note franche polluerait sinon la table.
 *
 *  Les declarations en cascade conditionnelle sont IGNOREES. `--prep-glass-bg`
 *  est `rgb(255 255 255 / 0.12)` a l racine, mais rebattee sur un aplat opaque
 *  par `@media (prefers-reduced-transparency: reduce)`. Lire la derniere
 *  declaration brute ferait passer un verre translucide pour un aplat, et
 *  le tri classerait opaque tout ce qui s'appuie sur ce jeton. */
const JETONS_SIMPLE = (): Record<string, string> => {
  const table: Record<string, string> = {};

  for (const f of [CSS_TOKENS, CSS_IOS, CSS_VERRE, CSS_PREP]) {
    // Un jeton n est global que s il vit au niveau racine ou dans un bloc
    // `:root` / `html`. `--prep-glass-bg` en a deux definitions : la racine
    // translucide, et le repli OPAQUE sous `prefers-reduced-transparency`.
    // Collecter la derniere venue ferait passer un verre pour un aplat et
    // classerait opaque tout ce qui s appuie dessus. On suit donc la
    // profondeur d accolades et on ignore tout ce qui est sous une condition
    // ou un selecteur de composant.
    const texte = sansCommentaire(lire(f));
    let selecteurCourant = '';
    let prof = 0;
    let tampon = '';
    const verser = (bloc: string): void => {
      for (const m of bloc.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        table[m[1]] = m[2].trim();
      }
    };
    for (let i = 0; i < texte.length; i += 1) {
      const ch = texte[i];
      if (ch === '{') {
        const t = selecteurCourant.trim();
        selecteurCourant = '';
        if (prof === 0) {
          tampon = '';
          if (!t.startsWith('@')) selecteurCourant = t;
        } else if (prof === 1 && /^(html|:root)\b/.test(t)) {
          tampon = '';
        } else {
          tampon = '#ignore#';
        }
        prof += 1;
        continue;
      }
      if (ch === '}') {
        prof -= 1;
        if (prof === 0 || tampon === '') {
          if (tampon !== '#ignore#') verser(tampon);
        }
        tampon = '';
        selecteurCourant = '';
        continue;
      }
      if (prof === 0) {
        // declarations posees hors de tout bloc
        if (ch === ';') {
          verser(tampon);
          tampon = '';
        } else tampon += ch;
      } else if (prof === 1 && tampon !== '#ignore#') {
        tampon += ch;
      }
    }
  }
  return table;
};

const JETONS = JETONS_SIMPLE();

/** Resout `var()` en cascade. Une reference inconnue devient `?` : l'appelant
 *  doit alors refuser de conclure plutot que d'inventer une valeur. */
const resoudre = (brut: string, profondeur = 0): string => {
  if (profondeur > 12) return brut;
  return (
    brut
      .trim()
      .replace(
        /var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/g,
        (_, nom: string, repli?: string) =>
          resoudre(repli && repli.trim() ? repli.trim() : (JETONS[nom] ?? '?'), profondeur + 1),
      )
      .replace(/color-mix\(\s*in\s+srgb\s*,/i, 'CM(')
      .trim()
  );
};

/* --- Alpha -------------------------------------------------------------- */

/** Alpha effectif d'une couleur. `color-mix` compose en alpha premultiplie :
 *  un pourcentage omis prend le reste de la somme. */
const alpha = (brut: string, profondeur = 0): number | null => {
  const c = String(brut).trim();
  if (profondeur > 8) return null;

  if (/^CM\(/i.test(c)) {
    const composants: Array<[number | null, number]> = [];
    for (let piece of c.slice(3).replace(/\)\s*$/, '').split(',')) {
      piece = piece.trim();
      if (/^in\s+srgb$/i.test(piece)) continue;
      if (/^transparent$/i.test(piece)) {
        composants.push([null, 0]);
        continue;
      }
      const pct = piece.match(/^(.*?)\s*([\d.]+)%$/);
      const couleur = pct ? pct[1].trim() : piece;
      const part = pct ? parseFloat(pct[2]) / 100 : null;
      let a = 1;
      if (couleur !== '') {
        const lu = alpha(resoudre(couleur), profondeur + 1);
        if (lu === null) return null;
        a = lu;
      }
      composants.push([part, a]);
    }
    if (composants.length === 0) return null;
    if (!composants.some(([p]) => p !== null)) return null;
    const somme = composants.reduce((s, [p]) => s + (p ?? 0), 0);
    const manquant = composants.filter(([p]) => p === null).length;
    let total = 0;
    for (const [p, a] of composants) total += (p === null ? (1 - somme) / manquant : p) * a;
    return Math.min(1, total);
  }

  if (/^(transparent|none|unset|initial)$/i.test(c)) return 0;
  // Couleurs systeme CSS : opaques par definition, `Canvas` compris.
  if (/^(canvas|canvastext|buttonface|buttontext|field|fieldtext|accentcolor|accentcolortext|highlight|highlighttext|mark|marktext|graytext|activeborder|activecaption|appworkspace|caption|inactiveborder|inactivecaption|inactivecaptiontext|infobackground|infotext|menu|menutext|scrollbar|threeddarkshadow|threedface|threedhighlight|threedlightshadow|threedshadow)$/i.test(c))
    return 1;
  const rgba = c.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i,
  );
  if (rgba) {
    if (rgba[4] === undefined) return 1;
    return rgba[4].endsWith('%') ? parseFloat(rgba[4]) / 100 : parseFloat(rgba[4]);
  }
  if (/^#[\da-f]{6}$/i.test(c) || /^#[\da-f]{3}$/i.test(c)) return 1;
  if (/^#[\da-f]{8}$/i.test(c)) return parseInt(c.slice(7, 9), 16) / 255;
  if (/^#[\da-f]{4}$/i.test(c)) return parseInt(c.slice(4), 16) / 255;
  return null;
};

/* --- Regles CSS --------------------------------------------------------- */

interface Regle {
  readonly selecteur: string;
  readonly media: string;
  readonly corps: string;
  readonly debut: number;
}

const regles = (css: string): Regle[] => {
  // Les commentaires sont masques en conservant les sauts de ligne : les
  // numeros de ligne restent ceux du fichier livre, et un autre agent peut
  // decaler le fichier entre deux executions.
  const texte = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const sorties: Regle[] = [];
  const pile: string[] = [];
  let selecteur = '';
  let debut = 0;
  let corps = '';
  let enRegle = false;
  let ligne = 1;
  let i = 0;

  // Lecture caractere par caractere : un selecteur peut s'ecrire sur plusieurs
  // lignes (`.prep-nav,` puis `.prep-block,`...), et une regle peut etre
  // imbriquee dans un `@media`. Un lecteur par ligne perdrait l'un des deux.
  while (i < texte.length) {
    const ch = texte[i];
    if (ch === '\n') ligne += 1;
    if (enRegle) {
      if (ch === '}') {
        sorties.push({
          selecteur: selecteur.trim(),
          media: pile.filter((p) => p.startsWith('@media')).join(' '),
          corps,
          debut,
        });
        enRegle = false;
        corps = '';
        selecteur = '';
      } else corps += ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      const t = selecteur.trim().replace(/\s+/g, ' ');
      if (t.startsWith('@')) {
        pile.push(t);
        selecteur = '';
      } else {
        // Le selecteur doit survivre jusqu'a l'accolade fermante : c'est elle
        // qui publie la regle, pas l'accolade ouvrante. Le remettre a zero ici
        // ferait publier un selecteur vide pour les 346 regles du fichier.
        enRegle = true;
        corps = '';
      }
      i += 1;
      continue;
    }
    if (ch === '}') {
      pile.pop();
      selecteur = '';
      i += 1;
      continue;
    }
    if (ch === ';') {
      selecteur = '';
      i += 1;
      continue;
    }
    // Les espaces comptent : un selecteur compose s ecrit avec une espace
    // (`.prep-block__row[aria-pressed='true'] .prep-act-icon`). Ne garder que
    // les caracteres non blancs lausunait en `.prep-block__row[...].prep-act-icon`,
    // qui ne correspond a aucune regle et se perdait dans l'inventaire.
    if (ch !== '}' && ch !== ';') {
      if (selecteur.trim() === '' && /\S/.test(ch)) debut = ligne;
      selecteur += ch;
    }
    i += 1;
  }
  return sorties;
};

const REGLE = regles(lire(CSS_PREP));

/** Specificite suffisante pour trancher deux declarations d'une meme
 *  propriete : identifiant, puis classe / pseudo-classe / attribut, puis type. */
const specificite = (selecteur: string): number => {
  const s = selecteur.replace(/\([^()]*\)/g, ' A ');
  const id = (s.match(/#[\w-]+/g) ?? []).length;
  const classe = (s.match(/\.[\w-]+|::?[\w-]+|\sA\s/g) ?? []).length;
  const type = (s.replace(/\sA\s/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return id * 10000 + classe * 100 + type;
};

/** Chaque partie d'une liste de selecteurs. Les espaces autour des
 *  combinateurs sont supprimes : le lecteur CSS les ecrase en `>`, et
 *  l'inventaire doit pouvoir nommer une regle telle qu'elle est ecrite. */
const partsSelecteur = (selecteur: string): string[] =>
  selecteur.split(',').map((s) => s.trim().replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, '$1'));

/** Regles qui ciblent exactement ce selecteur, ou le contiennent comme partie
 *  d'une liste. C'est ce qui permet a `.prep-nav` d'etre lu a travers la regle
 *  de groupe qui le porte en `!important`. */
const reglesDe = (selecteur: string): Array<{ regle: Regle; part: string }> =>
  REGLE.flatMap((regle) => {
    const part = partsSelecteur(regle.selecteur).find((p) => p === selecteur);
    return part ? [{ regle, part }] : [];
  });

const corpsDe = (selecteur: string): string =>
  reglesDe(selecteur)
    .map((c) => c.regle.corps)
    .join('\n');

interface FondEffectif {
  readonly valeur: string;
  readonly importante: boolean;
  readonly debut: number;
}

/** Fond retenu apres cascade complete : `!important` l'emporte, puis la
 *  specificite de la partie qui cible, puis l'ordre source. Sans ca, une
 *  surface rendue en verre par une regle de groupe passerait pour opaque. */
const fondEffectif = (selecteur: string): FondEffectif | null => {
  let gagnant: FondEffectif | null = null;
  let score = -1;
  reglesDe(selecteur).forEach(({ regle, part }, index) => {
    for (const d of regle.corps.matchAll(/(^|[\s;{])background(-color)?\s*:\s*([^;]+);/g)) {
      const important = /!important/i.test(d[3]);
      const rang = (important ? 1e9 : 0) + specificite(part) * 1e3 + index;
      if (rang <= score) continue;
      score = rang;
      gagnant = {
        valeur: resoudre(d[3].replace(/!important/i, '').trim()),
        importante: important,
        debut: regle.debut,
      };
    }
  });
  return gagnant;
};

const estOpaque = (valeur: string): boolean => {
  const a = alpha(valeur);
  return a !== null && a >= 0.999;
};

/* --- Inventaire --------------------------------------------------------- */

type Verdict = 'verre' | 'opaque-pine';

interface Entree {
  readonly selecteur: string;
  readonly verdict: Verdict;
  readonly groupe: string;
  /** Ancre facultative : designe la bonne regle quand un selecteur revient
   *  plusieurs fois dans la feuille. */
  readonly ancre?: string;
}

const A_VERRE: readonly Entree[] = [
  { selecteur: ".prep-step__state[data-state='a_reserver']", verdict: 'verre', groupe: 'badge-etat' },
  { selecteur: ".prep-step__state[data-state='confirme']", verdict: 'verre', groupe: 'badge-etat' },
  {
    selecteur: ".prep-step__state[data-state='confirme_communaute']",
    verdict: 'verre',
    groupe: 'badge-etat',
  },
  { selecteur: ".prep-step__state[data-state='retenu']", verdict: 'verre', groupe: 'badge-etat' },
  { selecteur: '.prep-gear-row__badge--missing', verdict: 'verre', groupe: 'badge-fiabilite' },
  { selecteur: '.prep-gear-row__badge--check', verdict: 'verre', groupe: 'badge-fiabilite' },
  { selecteur: '.prep-gear-row__badge--shared', verdict: 'verre', groupe: 'badge-fiabilite' },
  { selecteur: '.prep-swap__button', verdict: 'verre', groupe: 'controle' },
  { selecteur: '.prepcal__nav', verdict: 'verre', groupe: 'controle' },
  { selecteur: ".seg>button[aria-pressed='true']", verdict: 'verre', groupe: 'controle' },
];

const A_OPAQUE: readonly Entree[] = [
  { selecteur: '.adventure-prep', verdict: 'opaque-pine', groupe: 'sol', ancre: '--prep-page-bg' },

  { selecteur: '.prep-map', verdict: 'opaque-pine', groupe: 'carte', ancre: '--prep-map-bg' },
  { selecteur: '.prep-map--full', verdict: 'opaque-pine', groupe: 'carte' },
  { selecteur: '.prep-picker', verdict: 'opaque-pine', groupe: 'carte', ancre: '--prep-map-bg' },

  { selecteur: '.prep-avatar', verdict: 'opaque-pine', groupe: 'avatar' },
  { selecteur: ".prep-avatar[data-tone='1']", verdict: 'opaque-pine', groupe: 'avatar' },
  { selecteur: ".prep-avatar[data-tone='2']", verdict: 'opaque-pine', groupe: 'avatar' },
  { selecteur: ".prep-avatar[data-tone='3']", verdict: 'opaque-pine', groupe: 'avatar' },
  { selecteur: ".prep-avatar[data-tone='4']", verdict: 'opaque-pine', groupe: 'avatar' },
  { selecteur: ".prep-avatar[data-tone='5']", verdict: 'opaque-pine', groupe: 'avatar' },

  { selecteur: ".prep-day[aria-pressed='true']", verdict: 'opaque-pine', groupe: 'aplats-pleins' },
  { selecteur: '.prep-footer__primary', verdict: 'opaque-pine', groupe: 'aplats-pleins' },
  {
    selecteur: ".prep-block__row[aria-pressed='true'] .prep-act-icon",
    verdict: 'opaque-pine',
    groupe: 'aplats-pleins',
  },

  { selecteur: ".prep-swap__button:hover", verdict: 'opaque-pine', groupe: 'teintes-etat' },
  {
    selecteur: '.prepcal__nav:hover:not(:disabled)',
    verdict: 'opaque-pine',
    groupe: 'teintes-etat',
  },
  {
    selecteur: ".prepcal__day:hover:not(:disabled):not(.is-selected)",
    verdict: 'opaque-pine',
    groupe: 'teintes-etat',
  },
  { selecteur: '.prepcal__day.is-selected', verdict: 'opaque-pine', groupe: 'teintes-etat' },

  { selecteur: '.prep-screen', verdict: 'opaque-pine', groupe: 'ecran-generation' },
  { selecteur: '.prep-map__glass', verdict: 'opaque-pine', groupe: 'repli-transparence' },

  /* Trouve par l'exhaustivite, pas par la liste de depart. */
  {
    selecteur: '.prep-block__row[aria-pressed=\'true\'] .prep-act-icon',
    verdict: 'opaque-pine',
    groupe: 'aplats-pleins',
  },
];

const INVENTAIRE: readonly Entree[] = [...A_VERRE, ...A_OPAQUE];

/** Selecteurs opaques qu'aucun composant ne rend. On ne leur forge pas de
 *  verdict : on constate leur disparition et on la surveille. */
const SELECTEURS_MORTS: readonly (string | { selecteur: string; verifie: string })[] = [
  ".prep-segmented__item[aria-pressed='true']",
  '.prep-pill--action',
  /* `.badge.amber` n est mort qu AU NIVEAU DU COMPOSE. `.badge` vit, pose par
     `badge badge--suggestion prep-cell__badge` : exiger que `.badge` disparaisse
     serait faux. C est le modificateur `amber` qui ne trouve jamais preneur. */
  { selecteur: '.badge.amber', verifie: 'amber' },
];

const classesEnUsage = (): Set<string> => {
  const trouvees = new Set<string>();
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier)) {
      if (['node_modules', '.git', '__tests__', '.next'].includes(entree)) continue;
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.(tsx|ts)$/.test(entree)) {
        const source = lire(chemin);
        for (const m of source.matchAll(/class(?:Name)?\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          for (const c of `${m[1] ?? m[2] ?? ''}`.split(/\s+/)) {
            if (c && !c.includes('{') && !c.includes('}')) trouvees.add(c);
          }
        }
      }
    }
  };
  parcourir('src');
  return trouvees;
};

const EN_USAGE = classesEnUsage();
/** Premiere classe d'un selecteur, suffixe de modificateur compris. */
const classeDe = (selecteur: string): string =>
  (selecteur.trim().match(/\.[\w-]+/) ?? [''])[0].replace(/^\./, '');

/* --- Detection des orphelins ------------------------------------------- */

const morts = (): Set<string> => new Set(SELECTEURS_MORTS.map(String));

/** Chaque selecteur rendu par un composant, avec son fond APRES cascade.
 *  Une surface qu'une regle de groupe rend deja en verre n'apparait pas : c'est
 *  le but, sinon `.prep-nav` passerait pour un orphelin. */
const opaquesRendus = (): Array<{ selecteur: string; valeur: string }> => {
  const vus = new Set<string>();
  const sortie: Array<{ selecteur: string; valeur: string }> = [];
  for (const regle of REGLE) {
    // Le repli d accessibilite est opaque par contrat : il a son verdict.
    if (regle.media.includes('prefers-reduced-transparency')) continue;
    for (const part of partsSelecteur(regle.selecteur)) {
      if (!part || vus.has(part) || !EN_USAGE.has(classeDe(part))) continue;
      vus.add(part);
      const fond = fondEffectif(part);
      if (fond && estOpaque(fond.valeur)) sortie.push({ selecteur: part, valeur: fond.valeur });
    }
  }
  return sortie;
};

/** Selecteurs opaques rendus sans verdict : exactement ce que le tri laisse
 *  deriver. L'auto-verification fait tourner CE CODE LA, sinon l'assertion
 *  d'exhaustivite pourrait mordre a vide. */
const cibles = (
  surfaces: ReadonlyArray<{ selecteur: string; valeur: string }>,
  verdictus: ReadonlySet<string>,
  disparus: ReadonlySet<string>,
): string[] =>
  surfaces
    .filter((s) => !verdictus.has(s.selecteur) && !disparus.has(s.selecteur))
    .map((s) => `${s.selecteur}  ->  ${s.valeur}`);

/* --- Recette de verre --------------------------------------------------- */

const FOND = 'var(--prep-panel-bg)';
const OMBRE = 'var(--prep-glass-material)';
const ARET = 'var(--prep-hairline-ink)';
const FLou = /backdrop-filter:\s*blur\(var\(--prep-panel-blur\)\)\s*saturate\(var\(--prep-panel-saturate\)\)\s*brightness\(var\(--prep-panel-brightness\)\)/;

const LIGNES = lire(CSS_PREP).split(/\r?\n/);

/* Le bloc de commentaire qui precede immediatement une regle, ou vide.
   On ne cherche pas un motif de ligne : ce fichier melange des blocs etoiles
   (etoile en tete) et des blocs nus (fermeture en fin de ligne). On remonte donc
   depuis la ligne juste au-dessus du selecteur jusqu a trouver une fermeture de
   commentaire, puis on remonte encore jusqu a son ouverture. Ce qui se trouve
   entre les deux, ligne vide comprise, est le bloc. */
const commentaireAvant = (debut: number): string => {
  let i = debut - 2;
  // Une ligne vide separe parfois le marqueur du selecteur (`.prep-screen`) :
  // on la saute, mais on s'arrete des qu on retombe sur du code.
  while (i >= 0 && /^\s*$/.test(LIGNES[i])) i -= 1;
  let fin = i;
  while (fin >= 0 && !LIGNES[fin].includes('*/')) fin -= 1;
  if (fin < 0) return '';
  let ouverture = fin;
  while (ouverture >= 0 && !LIGNES[ouverture].includes('/*')) ouverture -= 1;
  if (ouverture < 0) return '';
  return LIGNES.slice(ouverture, fin + 1).join('\n');
};

const MIGRER = A_VERRE.map((e) => [e.selecteur, e] as const);
const PINER = A_OPAQUE.map((e) => [e.selecteur, e] as const);

describe('P5.1 / P5.7 - surfaces opaques du preparateur', () => {
  describe('recette unique de verre', () => {
    it.each(MIGRER)('%s porte la recette de verre', (_nom, entree) => {
      const corps = corpsDe(entree.selecteur);
      expect(corps, `la regle ${entree.selecteur} doit exister`).not.toBe('');
      expect(corps, 'fond du panneau').toContain(FOND);
      expect(corps, 'materiau').toContain(OMBRE);
      expect(corps, 'arete').toContain(ARET);
      expect(corps.replace(/\s+/g, ' '), 'flou du panneau').toMatch(FLou);

      const fond = fondEffectif(entree.selecteur);
      expect(fond, 'fond calculable').not.toBeNull();
      expect(estOpaque(fond!.valeur), `fond resolu : ${fond!.valeur}`).toBe(false);
    });
  });

  describe('opaques volontairement pines', () => {
    it.each(PINER)('%s reste opaque', (_nom, entree) => {
      if (entree.selecteur === '.prep-screen') {
        // Le voile de generation n'a pas de fond CSS : il est pose en inline
        // par le shell. C'est le meme verdict, lu la ou il est ecrit.
        const boite = lire(SHELL).match(/SCREEN_BOX[^=]*=\s*\{[\s\S]*?\}/);
        expect(boite, 'SCREEN_BOX doit exister').not.toBeNull();
        const fond = boite![0].match(/backgroundColor:\s*'([^']+)'/);
        expect(fond, 'un fond inline doit etre pose').not.toBeNull();
        const a = alpha(resoudre(fond![1]));
        expect(a, `${fond![1]} doit etre resolu`).not.toBeNull();
        expect(a!).toBeGreaterThanOrEqual(0.999);
        return;
      }
      if (entree.selecteur === '.prep-map__glass') {
        const regle = REGLE.find(
          (r) =>
            r.media.includes('prefers-reduced-transparency') &&
            partsSelecteur(r.selecteur).includes('.prep-map__glass'),
        );
        expect(regle, 'le repli d accessibilite doit exister').toBeDefined();
        const a = alpha(resoudre('var(--card-tint-solid)'));
        expect(a).not.toBeNull();
        expect(a!).toBeGreaterThanOrEqual(0.999);
        return;
      }
      const fond = fondEffectif(entree.selecteur);
      expect(fond, 'fond calculable').not.toBeNull();
      expect(estOpaque(fond!.valeur), `${entree.selecteur} doit rester opaque`).toBe(true);
    });

    it.each(PINER)('%s porte un marqueur P5.7 sur place', (_nom, entree) => {
      // Plusieurs regles peuvent viser le meme selecteur (`.prep-map` en a
      // trois). On ne retient pas la premiere venue : c est celle qui porte le
      // fond reellement juge opaque, donc celle que le marqueur doit precéder.
      const candidates = reglesDe(entree.selecteur)
        .map((c) => c.regle)
        .filter((r) => !entree.ancre || r.corps.includes(entree.ancre));
      const ancree = candidates.find((r) => commentaireAvant(r.debut).length > 0) ?? candidates[0];
      expect(ancree, `la regle de ${entree.selecteur} doit exister`).toBeDefined();
      expect(
        commentaireAvant(ancree!.debut),
        `un commentaire doit preceder ${entree.selecteur}`,
      ).not.toBe('');

      expect(
        commentaireAvant(ancree!.debut),
        `marqueur P5.7 manquant sur ${entree.selecteur}`,
      ).toContain('P5.7');
    });
  });

  describe('exhaustivite du tri', () => {
    it('aucune surface opaque rendue ne reste sans verdict', () => {
      const orphelins = cibles(opaquesRendus(), new Set(INVENTAIRE.map((e) => e.selecteur)), morts());
      expect(orphelins.sort(), 'surfaces opaques a traiter').toEqual([]);
    });

    it('les selecteurs declares morts ne sont rendus par aucun composant', () => {
      for (const mort of SELECTEURS_MORTS) {
        const sel = typeof mort === 'string' ? mort : mort.selecteur;
        // Un selecteur compose n est mort qu au niveau du compose : on ne verifie
        // que la ou le selecteur porte un modificateur, sinon `.badge` serait
        // declare mort alors qu'un composant le pose.
        const composee = typeof mort === 'string' ? mort.includes('.') : true;
        const aVerifier = composee
          ? ((sel.match(/\.[\w-]+/g) ?? []).map((c) => c.slice(1)) as string[]).slice(1)
          : ((sel.match(/\.[\w-]+/g) ?? []).map((c) => c.slice(1)) as string[]);
        if (!composee) {
          for (const c of aVerifier) {
            expect(EN_USAGE.has(c), `${sel} est rendu via .${c} : il lui faut un verdict`).toBe(false);
          }
          continue;
        }
        const modificateur = (typeof mort === 'object' ? mort.verifie : aVerifier[0]) ?? aVerifier[0];
        expect(EN_USAGE.has(modificateur), `${sel} est rendu via .${modificateur} : il lui faut un verdict`).toBe(
          false,
        );
      }
    });
  });

  describe('ecran de generation', () => {
    it('le voile plein ecran reste opaque et le dit', () => {
      const shell = lire(SHELL);
      const boite = shell.match(/SCREEN_BOX[^=]*=\s*\{[\s\S]*?\}/);
      expect(boite, 'SCREEN_BOX doit exister').not.toBeNull();
      const fond = boite![0].match(/backgroundColor:\s*'([^']+)'/);
      expect(fond, 'un fond inline doit etre pose').not.toBeNull();
      const a = alpha(resoudre(fond![1]));
      expect(a, `${fond![1]} doit etre resolu`).not.toBeNull();
      expect(a!, 'le voile ne doit jamais laisser passer le verre').toBeGreaterThanOrEqual(0.999);

      const css = lire(CSS_PREP);
      const regle = regles(css).find((r) => partsSelecteur(r.selecteur).includes('.prep-screen'));
      expect(regle).toBeDefined();
      // Fenetre large ou bloc de commentaire lu en entier : le marqueur de
      // `.prep-screen` fait six lignes, une fenetre de deux lignes le raterait.
      expect(
        commentaireAvant(regle!.debut),
        'marqueur P5.7 manquant sur .prep-screen',
      ).toContain('P5.7');
    });
  });

  describe('auto-verification du classifieur', () => {
    it('reconnait un aplat opaque et laisse passer le verre', () => {
      expect(estOpaque(resoudre('#262b38')), 'un hex plein est opaque').toBe(true);
      expect(estOpaque(resoudre('rgb(16 16 16 / 0.94)')), 'le panneau est translucide').toBe(false);
      expect(estOpaque(resoudre('var(--prep-panel-bg)')), 'via jeton').toBe(false);
      expect(
        estOpaque(resoudre('color-mix(in srgb, var(--lkv-action) 10%, #262b38)')),
        'un melange sur un aplat reste opaque',
      ).toBe(true);
      expect(
        estOpaque(resoudre('color-mix(in srgb, var(--lkv-text-primary) 6%, transparent)')),
        'un melange sur transparent reste translucide',
      ).toBe(false);
    });

    it('classe une surface opaque hors inventaire comme un orphelin', () => {
      const connues = new Set(A_OPAQUE.map((e) => e.selecteur));
      const disparus = morts();
      const surface = opaquesRendus();

      // Temoin : une surface rejetee, une surface pinee, une surface disparue.
      expect(
        cibles([{ selecteur: '.prep-fantome', valeur: '#262b38' }], connues, disparus),
        'une surface inconnue doit etre signalee',
      ).toEqual(['.prep-fantome  ->  #262b38']);
      expect(
        cibles([{ selecteur: '.prep-map', valeur: '#151821' }], connues, disparus),
        'une surface pinee ne doit pas etre signalee',
      ).toEqual([]);
      expect(
        cibles([{ selecteur: '.prep-pill--action', valeur: '#262b38' }], connues, disparus),
        'un selecteur disparu ne doit pas etre signale',
      ).toEqual([]);
      expect(surface.length, 'le CSS livre contient des surfaces opaques rendues').toBeGreaterThan(0);
    });
  });
});