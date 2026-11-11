import React from 'react';

/** Tailles canoniques de la tuile (28), de la ligne (44) et du détail (72). */
export type ClubCrestSize = 28 | 44 | 72;

export interface ClubCrestProps {
  /** Nom du club : porte l'initiale du blason. */
  name: string;
  /** Activité du club (rando, ski, vélo, escalade, trail…) : choisit l'icône. */
  activity?: string | null;
  /** Graine déterministe (id ou `crestSeed` du VM) ; à défaut, le nom. */
  seed?: string | number | null;
  /** Taille en px (canoniques 28 / 44 / 72 ; 52 et 64 pour les tuiles larges). */
  size?: number;
  className?: string;
}

type CrestActivity = 'rando' | 'ski' | 'velo' | 'escalade' | 'trail';

/** Pictogrammes d'activité de la maquette (`LK.IC.mountain / ski / bike / climb / shoe`, L1564-1622). */
const ACTIVITY_ICONS: Record<CrestActivity, React.ReactNode> = {
  rando: <path d="M3 19l6-10 4 6 2.5-4L21 19z" />,
  ski: (
    <>
      <path d="M3 19l17-7M6 13l3 5M14 8l3 5" />
      <circle cx="16" cy="5" r="1.8" />
    </>
  ),
  velo: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l4-8h4l4 8M10 8l4 8" />
    </>
  ),
  escalade: (
    <>
      <path d="M12 21V8M12 8l-5 4M12 8l5 3M9 21h6" />
      <circle cx="12" cy="4.5" r="1.8" />
    </>
  ),
  trail: <path d="M4 15c3 0 4-3 5-6l3 2c1 1 3 1 5 1l3 3v3H4z" />,
};

/** Teinte par activité (maquette `TONE`) : l'index est lu par `communaute-v2.css` (`data-tone`). */
const TONE_INDEX: Record<CrestActivity, number> = { rando: 0, ski: 1, velo: 2, escalade: 3, trail: 4 };

const CREST_PATTERNS = [
  'M4 22 20 14 36 22V30L20 22 4 30z',
  'M4 18h32v6H4z',
  'M20 4 36 9v13c0 2 0 3-1 5L20 14 5 27c-1-2-1-3-1-5V9z',
];

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Hash 32 bits stable (aucun `Math.random`, aucun état) : celui de la maquette (`hash`, L2295). */
function hash(value: string): number {
  let out = 7;
  for (let i = 0; i < value.length; i += 1) {
    out = (out * 31 + value.charCodeAt(i)) >>> 0;
  }
  return out;
}

function resolveActivity(activity: string | null | undefined): CrestActivity {
  const key = fold(activity ?? '');
  if (key.includes('ski')) return 'ski';
  if (key.includes('velo') || key.includes('bike') || key.includes('cycl')) return 'velo';
  if (key.includes('escal') || key.includes('grimp') || key.includes('climb') || key.includes('alpin'))
    return 'escalade';
  if (key.includes('trail') || key.includes('course') || key.includes('running') || key.includes('run'))
    return 'trail';
  return 'rando';
}

/** Initiale du blason : articles français retirés, première lettre en capitale. */
export function crestInitial(name: string | null | undefined): string {
  const clean = (name ?? '').trim().replace(/^(?:Les|La|Le|L['\u2019])\s*/i, '');
  const first = Array.from(clean)[0];
  return first ? first.toUpperCase() : '?';
}

/**
 * Blason de club généré et déterministe (aucune image requise).
 *
 * - initiale du nom + icône d'activité, motif de champ dérivé du nom (maquette) ;
 * - teinte par activité, uniquement en jetons verts (`data-tone` → `--crest-bg` dans
 *   `src/styles/communaute-v2.css` : forêt, sauge), aucune couleur littérale ;
 * - `aria-hidden` : le libellé complet est porté par le parent (tuile, détail) ;
 * - largeurs 28 / 44 / 72 px (hauteur = ratio 40:46 du bouclier).
 */
export function ClubCrest({
  name,
  activity,
  seed,
  size = 44,
  className,
}: ClubCrestProps) {
  // Maquette (`EXP.blason`, L2302) : le motif vient du NOM du club (`hash(c.n) % 3`), la teinte de
  // son ACTIVITÉ (`TONE`). La graine ne sert plus qu'à départager des clubs sans nom.
  const source = name && name.length > 0 ? name : seed != null && String(seed).length > 0 ? String(seed) : 'club';
  const hashValue = hash(source);
  const pattern = CREST_PATTERNS[hashValue % CREST_PATTERNS.length];
  const resolvedActivity = resolveActivity(activity);
  const initial = crestInitial(name);
  const width = size;
  const height = Math.round(size * 1.15);
  const classNameValue = className ? `lkdv-crest ${className}` : 'lkdv-crest';

  return (
    <svg
      className={classNameValue}
      width={width}
      height={height}
      viewBox="0 0 40 46"
      data-tone={TONE_INDEX[resolvedActivity]}
      data-activity={resolvedActivity}
      data-testid="club-crest"
      aria-hidden="true"
      focusable="false"
    >
      <path className="lkdv-crest-shield" d="M20 2 37 8v14c0 10-7 16-17 22C10 38 3 32 3 22V8z" />
      <path className="lkdv-crest-pattern" d={pattern} />
      <path
        className="lkdv-crest-inner"
        d="M20 5 34 10v12c0 8-6 13-14 18C12 35 6 30 6 22V10z"
      />
      <g className="lkdv-crest-icon" transform="translate(14 8) scale(.5)">
        {ACTIVITY_ICONS[resolvedActivity]}
      </g>
      <text className="lkdv-crest-initial" x="20" y="34" textAnchor="middle">
        {initial}
      </text>
    </svg>
  );
}

export default ClubCrest;
