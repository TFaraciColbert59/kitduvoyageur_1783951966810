/**
 * LKDV — Largeurs de reference, et l endroit ou chacune est reellement
 * imposee.
 *
 * POURQUOI CE FICHIER EXISTE. Les largeurs que le produit promet de tenir
 * etaient ecrites en dur, dispersees, et jamais verifiees : 375 et 393 dans
 * des configs Playwright, 768 et 1024 dans des tokens, `30rem` dans une
 * feuille `/prepare`. Deux consequences :
 *
 *   1. Une largeur pouvait disparaitre sans que quoi que ce soit rougisse.
 *   2. Les valeurs divergeaient sans qu on le sache (393 est un cadre de
 *      capture ET une media query ; 1024 n est qu un token).
 *
 * CE QUE CE MODULE NE FAIT PAS. Il ne remplace pas `src/design/tokens.ts` :
 * l export `breakpoints` de ce fichier-la reste le miroir Tailwind
 * (sm/md/lg/xl/2xl) consomme par le JS. Ici on ne met que les largeurs de
 * VALIDATION, et surtout l `ancrage` de chacune : le fichier du produit, et
 * le motif qui doit s y trouver.
 *
 * LE POINT IMPORTANT. Une valeur ecrite dans un module et verifiee par ce
 * meme module ne prouve rien — c est exactement le piege du fichier
 * `responsive-breakpoints.spec.ts` avant refonte. La valeur d ici n est donc
 * qu un POINTEUR. C est `tests/responsive/responsive-breakpoints.spec.ts` qui
 * va chercher le motif dans le fichier reel, et qui rougit s il a disparu.
 * Un ancrage fantome, vers un fichier vide, ne peut donc pas passer.
 */

/** Une largeur est prouvee soit par une declaration CSS, soit par un viewport. */
export type Ancrage =
  | {
      readonly type: 'css';
      /** Chemin relatif depuis la racine du depot. */
      readonly fichier: string;
      /** Motif qui doit apparaitre HORS commentaire dans ce fichier. */
      readonly motif: string;
    }
  | {
      readonly type: 'viewport';
      /** Chemin relatif depuis la racine du depot. */
      readonly fichier: string;
      readonly largeurPx: number;
    };

export interface LargeurReference {
  readonly id: string;
  readonly largeurPx: number;
  /** Pourquoi ce chiffre existe, en une phrase. */
  readonly role: string;
  readonly ancrages: readonly Ancrage[];
}

/** Racine rem du document : 16px, valeur par defaut de tous les navigateurs. */
export const RACINE_REM_PX = 16;

/**
 * Cible tactile minimale, en px. Ce n est PAS une invention locale : la
 * valeur reelle est declaree par le token `--lkv-touch-min` de tokens.css,
 * et TEST-RESPONSIVE-05 va la lire la pour comparer.
 */
export const TOUCH_MIN_PX = 44;

/** Convertit une longueur rem vers px, pour comparer a une largeur en px. */
export function remVersPx(rem: number, racinePx: number = RACINE_REM_PX): number {
  return rem * racinePx;
}

/**
 * Les largeurs que le produit promet, avec leur preuve.
 *
 * 1024 n a volontairement qu un ancrage token : `--bp-lg` existe, mais
 * aucune media query du depot ne s en sert. Le dire ici evite qu un
 * relecteur suppose le contraire.
 */
export const LARGEURS: readonly LargeurReference[] = [
  {
    id: 'mobile-compact',
    largeurPx: 375,
    role: "iPhone SE. La plus petite largeur promise : en dessous, rien n'est capture.",
    ancrages: [{ type: 'viewport', fichier: 'playwright.baseline.config.ts', largeurPx: 375 }],
  },
  {
    id: 'mobile-reference',
    largeurPx: 393,
    role: 'Cadre de reference N7 (393x852). Sert de juge de paix visuel ET de palier CSS.',
    ancrages: [
      { type: 'viewport', fichier: 'playwright.baseline.config.ts', largeurPx: 393 },
      {
        type: 'css',
        fichier: 'src/features/adventure-prep/adventure-prep.css',
        motif: 'min-width: 393px',
      },
    ],
  },
  {
    id: 'tablette',
    largeurPx: 768,
    role: 'Palier Tailwind md. Separer la colonne de la rangee de commandes.',
    ancrages: [
      { type: 'css', fichier: 'src/styles/tokens.css', motif: '--bp-md: 768px' },
      { type: 'css', fichier: 'src/styles/tailwind.css', motif: '@media (min-width: 768px)' },
    ],
  },
  {
    id: 'bureau',
    largeurPx: 1024,
    role: 'Palier Tailwind lg. Declaration comme token, non consomme par une media query.',
    ancrages: [{ type: 'css', fichier: 'src/styles/tokens.css', motif: '--bp-lg: 1024px' }],
  },
  {
    id: 'bureau-large',
    largeurPx: 1440,
    role: 'Desktop de reference. La grille des vues longues (clubs, carnets) s y arrete.',
    ancrages: [
      { type: 'viewport', fichier: 'playwright.baseline.config.ts', largeurPx: 1440 },
      { type: 'viewport', fichier: 'playwright.visual.config.ts', largeurPx: 1440 },
      {
        type: 'css',
        fichier: 'src/components/dev/glass/glassLab.module.css',
        motif: 'max-width: 1440px',
      },
    ],
  },
];

/** La regle des 44px, et les endroits reels ou elle est ecrite. */
export const ANCRAGE_CIBLE_TACTILE: readonly Ancrage[] = [
  { type: 'css', fichier: 'src/styles/tokens.css', motif: `--lkv-touch-min: ${TOUCH_MIN_PX}px` },
  { type: 'css', fichier: 'src/styles/tailwind.css', motif: `min-height: ${TOUCH_MIN_PX}px` },
];

/**
 * Les garde-fous qui empechent un debordement horizontal du shell.
 *
 * `clip` et pas `hidden` : `hidden` fabrique un conteneur de defilement, donc
 * un `position: sticky` a l interieur se comporte differemment. Le choix est
 * delibere, donc il est ecrit.
 */
export const ANCRAGES_GARDE_FOUS: readonly { fichier: string; motifs: readonly string[] }[] = [
  {
    fichier: 'src/styles/tailwind.css',
    motifs: ['overflow-x: clip', 'max-width: 100vw', 'box-sizing: border-box'],
  },
];

/** Paliers propres a `/prepare`, exprimes comme le CSS les ecrit. */
export const PALIERS_PREPARE: readonly { requete: string; largeurPx: number }[] = [
  { requete: '@media (max-width: 30rem)', largeurPx: remVersPx(30) },
  { requete: '@media (max-width: 360px)', largeurPx: 360 },
  { requete: '@media (min-width: 480px)', largeurPx: 480 },
  { requete: '@media (min-resolution: 1.5dppx) and (min-width: 393px)', largeurPx: 393 },
];
