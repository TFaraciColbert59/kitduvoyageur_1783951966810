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

const ACTIVITY_PATHS: Record<CrestActivity, string> = {
  rando: 'M3 19.5 9.5 7l4 7.5 2-3 5.5 8z',
  ski: 'M12 3v18M4.8 7.2l14.4 9.6M19.2 7.2 4.8 16.8',
  velo:
    'M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM8.5 14l3-5.5h3.5M12 14l3.5 3.5',
  escalade: 'M3 20l6-11 4 7 2-3 6 7M15 4v4M15 4l4 1.6L15 8',
  trail: 'M3 18c3 0 4.5-2 7.5-2s4.5 2 7.5 1.5M6 7h2M11 7h2M16 7h2M6 11h2M11 11h2',
};

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

/** Hash 32 bits stable (aucun `Math.random`, aucun état). */
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
 * - initiale du nom + icône d'activité, motif de champ dérivé de la graine ;
 * - teinte uniquement en jetons verts (`data-tone` → `--crest-bg` dans
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
  const source = seed != null && String(seed).length > 0 ? String(seed) : name || 'club';
  const hashValue = hash(source);
  const tone = hashValue % 5;
  const pattern = CREST_PATTERNS[Math.floor(hashValue / 5) % CREST_PATTERNS.length];
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
      data-tone={tone}
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
        <path d={ACTIVITY_PATHS[resolvedActivity]} />
      </g>
      <text className="lkdv-crest-initial" x="20" y="34" textAnchor="middle">
        {initial}
      </text>
    </svg>
  );
}

export default ClubCrest;
