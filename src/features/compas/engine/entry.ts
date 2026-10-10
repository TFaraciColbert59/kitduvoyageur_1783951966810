/**
 * Compas — exigences d'entrée par passeport et destination (PLAN-100 4.2).
 *
 * Module PUR : aucune donnée importée. La table (travelrequirements.info, jeu
 * « Entry Requirements Dataset » v1.3.0, CC BY 4.0, générée par
 * `scripts/compas/build-entry-requirements.mjs`) est lue côté serveur seulement
 * (`server/entryRequirements.ts`), comme les aéroports ; ici, la recherche dans une
 * table donnée et les mots du Compas pour chaque exigence.
 *
 * La table dit ce que le jeu affirme, avec sa date de vérification. Elle ne dit pas
 * tout (pas de carte d'identité, pas de validité du passeport, pas de vaccins) :
 * `non_confirme` ou une absence de ligne renvoie aux règles internes et au service
 * officiel, jamais à une affirmation inventée.
 */

/** L'exigence d'entrée, en mots du métier (le jeu publie neuf valeurs, liste fermée). */
export type EntryKind =
  | 'libre_circulation'
  | 'sans_visa'
  | 'visa_arrivee'
  | 'e_visa'
  | 'autorisation'
  | 'visa_a_demander'
  | 'permis'
  | 'interdit'
  | 'non_confirme';

/** Code du jeu → mot du Compas. */
export const ENTRY_KINDS: Readonly<Record<string, EntryKind>> = Object.freeze({
  'freedom-of-movement': 'libre_circulation',
  'visa-free': 'sans_visa',
  'visa-on-arrival': 'visa_arrivee',
  evisa: 'e_visa',
  eta: 'autorisation',
  'embassy-visa': 'visa_a_demander',
  'travel-permit': 'permis',
  banned: 'interdit',
  unconfirmed: 'non_confirme',
});

export interface EntryRequirement {
  kind: EntryKind;
  /** Séjour maximal sans formalité de plus, en jours ; null quand le jeu ne le dit pas. */
  maxStayDays: number | null;
  /** Façon de compter le séjour (« rolling-180 », « per-entry »…), null si non dite. */
  stayWindow: string | null;
  /** Dernière vérification de la source par l'éditeur (AAAA-MM-JJ). */
  verified: string;
}

/**
 * Un groupe du fichier : [exigence du jeu, séjour max | null, fenêtre | null, date de
 * vérification, passeports (codes ISO2 triés, séparés par une espace)].
 */
export type EntryGroup = readonly [string, number | null, string | null, string, string];
/** Destination (ISO2) → groupes. */
export type EntryTable = Readonly<Record<string, readonly EntryGroup[]>>;

const ISO2 = /^[A-Z]{2}$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const code = (v: string | null | undefined): string | null => {
  const c = (v ?? '').trim().toUpperCase();
  return ISO2.test(c) ? c : null;
};

/** Vrai pour un jour du calendrier réel. */
function realDay(s: unknown): s is string {
  if (typeof s !== 'string' || !DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Ce que `table` dit pour ce passeport et cette destination, null s'il n'y a pas de
 * ligne (ou si la ligne est illisible : exigence inconnue de cette version du code,
 * séjour ou date mal formés). Jamais une valeur devinée.
 */
export function entryRequirementIn(
  table: EntryTable,
  passport: string | null | undefined,
  destination: string | null | undefined
): EntryRequirement | null {
  const from = code(passport);
  const to = code(destination);
  if (!from || !to || !Object.hasOwn(table, to)) return null;
  const needle = ` ${from} `;
  for (const [requirement, stay, window, verified, passports] of table[to]) {
    if (!` ${passports} `.includes(needle)) continue;
    const kind = Object.hasOwn(ENTRY_KINDS, requirement) ? ENTRY_KINDS[requirement] : undefined;
    if (!kind || !realDay(verified)) return null;
    if (stay != null && !(Number.isInteger(stay) && stay > 0)) return null;
    return { kind, maxStayDays: stay ?? null, stayWindow: typeof window === 'string' ? window : null, verified };
  }
  return null;
}

/**
 * Faut-il consulter la table ? Seulement pour une nationalité connue qui passe une
 * frontière : pas son propre pays (un citoyen y entre de droit), pas un départ déjà
 * dans le pays (`abroad` faux), pas de pays de destination. `find` : la recherche
 * (celle du serveur, ou une table de test).
 */
export function entryFor(
  find: (passport: string, destination: string) => EntryRequirement | null,
  nationality: string | null | undefined,
  destination: string | null | undefined,
  abroad: boolean | null
): EntryRequirement | null {
  const from = code(nationality);
  const to = code(destination);
  if (!from || !to || from === to || abroad === false) return null;
  return find(from, to);
}

/** Visa ou autorisation à obtenir (donc des frais possibles) : le seul cas où « Formalités » se chiffre. */
export function needsFormalities(kind: EntryKind): boolean {
  return kind === 'visa_arrivee' || kind === 'e_visa' || kind === 'autorisation' || kind === 'visa_a_demander';
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 2026-10-07 » → « 7 octobre 2026 » (« 1er » pour le premier), null si ce n'est pas un jour réel. */
export function frenchDay(iso: string): string | null {
  if (!realDay(iso)) return null;
  const [, y, m, d] = DAY.exec(iso) as RegExpExecArray;
  const day = Number(d);
  return `${day === 1 ? '1er' : day} ${MONTHS[Number(m) - 1]} ${y}`;
}

const days = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;

/** La façon de compter le séjour, seulement pour les trois formes publiées par le jeu. */
function windowPhrase(window: string | null): string {
  if (window === 'per-entry') return ' par entrée';
  if (window === 'per-12-months-from-first-entry') return ' sur 12 mois à partir de la première entrée';
  const rolling = /^rolling-(\d{2,3})$/.exec(window ?? '');
  return rolling ? ` par période de ${Number(rolling[1])} jours` : '';
}

/**
 * Ce que dit la table, sans le lieu ni la date (« passeport valide, sans visa jusqu’à
 * 90 jours par période de 180 jours »). `non_confirme` : null, la ligne du Compas
 * reste celle des règles.
 */
export function describeEntry(req: EntryRequirement): string | null {
  const stay = req.maxStayDays == null ? '' : `jusqu’à ${days(req.maxStayDays)}${windowPhrase(req.stayWindow)}`;
  switch (req.kind) {
    case 'sans_visa':
      return `passeport valide, sans visa${stay && ` ${stay}`}`;
    case 'visa_arrivee':
      return `passeport valide, visa à l’arrivée${stay && `, séjour ${stay}`}`;
    case 'e_visa':
      return `passeport valide, e-visa à demander en ligne avant le départ${stay && `, séjour ${stay}`}`;
    case 'autorisation':
      return `passeport valide, autorisation électronique (ETA/ESTA) à obtenir avant le départ${stay && `, séjour ${stay}`}`;
    case 'visa_a_demander':
      return `passeport valide, visa à demander avant le départ (ambassade ou consulat)${stay && `, séjour ${stay}`}`;
    case 'permis':
      return 'passeport valide, permis d’entrée spécifique à obtenir avant le départ';
    case 'libre_circulation':
      return 'libre circulation, sans visa';
    case 'interdit':
      return 'entrée interdite aux détenteurs de ton passeport';
    case 'non_confirme':
      return null;
  }
}
