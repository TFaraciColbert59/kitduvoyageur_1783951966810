/**
 * Dépendances du projet : ce qu'un changement oblige à recalculer.
 *
 * Le préremplissage garde l'empreinte des réglages qui l'ont produit
 * (`basis`). Quand le projet change, on compare l'empreinte d'alors à celle
 * d'aujourd'hui : seules les parties qui en dépendent sont refaites (passer de
 * 7 à 10 jours refait l'itinéraire, les nuits, le sac et le budget ; changer
 * le nombre de personnes ne touche pas l'itinéraire). Le Verdict, le Kit et
 * l'affichage sont dérivés à la lecture : ils suivent sans rien recalculer.
 *
 * Pur et déterministe.
 */

export type AutofillPart = 'steps' | 'nights' | 'transport' | 'kit' | 'budget';

export const PART_LABEL: Record<AutofillPart, string> = {
  steps: 'itinéraire',
  nights: 'nuits',
  transport: 'trajet',
  kit: 'sac',
  budget: 'budget',
};

/** Ce qui a produit le préremplissage (jamais de coordonnée fine : arrondi à ~1 km). */
export interface ProjectBasis {
  destination: string | null;
  days: number | null;
  hours: number | null;
  month: number | null;
  activity: string | null;
  party: number;
  nights: string | null;
  outdoorNights: number | null;
  autonomy: string | null;
  priority: string | null;
  pace: string | null;
  level: string | null;
  terrain: string | null;
  targetKm: number | null;
}

/** Pour chaque réglage, les parties écrites qui en dépendent. */
const DEPENDS: Record<keyof ProjectBasis, AutofillPart[]> = {
  destination: ['steps', 'nights', 'transport', 'kit', 'budget'],
  days: ['steps', 'nights', 'kit', 'budget'],
  hours: ['steps', 'kit', 'budget'],
  activity: ['steps', 'nights', 'kit', 'budget'],
  month: ['nights', 'kit', 'budget'],
  party: ['transport', 'kit', 'budget'],
  nights: ['nights', 'kit', 'budget'],
  outdoorNights: ['nights', 'kit', 'budget'],
  autonomy: ['nights', 'kit', 'budget'],
  priority: ['nights', 'budget'],
  pace: ['steps', 'budget'],
  level: ['steps', 'budget'],
  terrain: ['steps', 'budget'],
  targetKm: ['steps', 'budget'],
};

/** Refaire l'itinéraire refait aussi ce qui s'y accroche (nuits sur les étapes, départ). */
const FOLLOWS: Partial<Record<AutofillPart, AutofillPart[]>> = {
  steps: ['nights', 'transport', 'budget'],
  nights: ['budget'],
  transport: ['budget'],
  kit: ['budget'],
};

const ORDER: AutofillPart[] = ['steps', 'nights', 'transport', 'kit', 'budget'];

export function projectBasis(input: {
  anchor: { name: string; lat: number; lon: number } | null;
  destinationName: string | null;
  days: number | null;
  hours: number | null;
  startDate: string | null;
  activity: string | null;
  partySize: number | null;
  prefs: {
    nights?: string | null;
    outdoorNights?: number | null;
    autonomy?: string | null;
    priority?: string | null;
    pace?: string | null;
    level?: string | null;
    terrain?: string | null;
    targetKm?: number | null;
  } | null;
}): ProjectBasis {
  const p = input.prefs ?? {};
  const destination = input.anchor
    ? `${input.anchor.name}@${input.anchor.lat.toFixed(2)},${input.anchor.lon.toFixed(2)}`
    : input.destinationName?.trim().toLowerCase() || null;
  return {
    destination,
    days: input.days,
    hours: input.hours,
    month: input.startDate ? Number(input.startDate.slice(5, 7)) || null : null,
    activity: input.activity,
    party: Math.max(1, input.partySize ?? 1),
    nights: p.nights ?? null,
    outdoorNights: p.outdoorNights ?? null,
    autonomy: p.autonomy ?? null,
    priority: p.priority ?? null,
    // « normal » est le défaut : le choisir explicitement ne change rien.
    pace: p.pace && p.pace !== 'normal' ? p.pace : null,
    level: p.level ?? null,
    terrain: p.terrain ?? null,
    targetKm: p.targetKm ?? null,
  };
}

/** Réglages qui ont changé depuis le préremplissage. */
export function changedFields(before: Partial<ProjectBasis>, now: ProjectBasis): Array<keyof ProjectBasis> {
  return (Object.keys(DEPENDS) as Array<keyof ProjectBasis>).filter(
    // Un réglage absent de l'empreinte d'alors (ancienne version) n'est pas un changement.
    (k) => k in before && (before[k] ?? null) !== (now[k] ?? null)
  );
}

/** Parties à refaire, dans l'ordre où le préremplissage les écrit. */
/** Essais au plus pour remplacer un itinéraire de secours (une étape par jour sur le lieu). */
export const STAGES_RETRY_MAX = 3;

/**
 * Itinéraire de secours (le spécialiste n'a pas répondu à temps) : retenté à
 * l'ouverture suivante, avec ce qui en dépend, au plus `STAGES_RETRY_MAX` fois
 * d'affilée. `fallbackRuns` = nombre de préremplissages d'affilée restés en secours.
 */
export function retryParts(fallbackRuns: unknown): AutofillPart[] {
  const n = Number(fallbackRuns);
  if (!Number.isInteger(n) || n < 1 || n >= STAGES_RETRY_MAX) return [];
  return ORDER.filter((p) => p === 'steps' || (FOLLOWS.steps ?? []).includes(p));
}

/** Union ordonnée de parties à refaire. */
export function unionParts(...lists: AutofillPart[][]): AutofillPart[] {
  const all = new Set(lists.flat());
  return ORDER.filter((p) => all.has(p));
}

export function staleParts(before: Partial<ProjectBasis> | null, now: ProjectBasis): AutofillPart[] {
  if (!before) return [];
  const out = new Set<AutofillPart>();
  const add = (p: AutofillPart) => {
    if (out.has(p)) return;
    out.add(p);
    for (const f of FOLLOWS[p] ?? []) add(f);
  };
  for (const k of changedFields(before, now)) for (const p of DEPENDS[k]) add(p);
  return ORDER.filter((p) => out.has(p));
}

/**
 * Une ligne écrite par le préremplissage reste « à lui » tant que personne
 * ne l'a modifiée depuis (au-delà de 5 s de marge sur l'horodatage du run).
 * Retouchée, elle devient un choix de l'utilisateur : jamais remplacée.
 */
export function untouchedSince(updatedAt: string | null | undefined, runAt: string | null | undefined): boolean {
  if (!updatedAt || !runAt) return false;
  const u = Date.parse(updatedAt);
  const r = Date.parse(runAt);
  return Number.isFinite(u) && Number.isFinite(r) && u <= r + 5000;
}

/** « Itinéraire, nuits et budget réadaptés » */
export function partsText(parts: AutofillPart[]): string {
  const labels = parts.map((p) => PART_LABEL[p]);
  if (!labels.length) return '';
  const text = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
