/**
 * Compas — alertes officielles (Meteoalarm, flux France de Météo-France).
 *
 * Fonctions pures. Règles tirées du flux réel (2026-10-01) :
 * - seuls les champs STRUCTURÉS font foi (`awareness_level`, `awareness_type`) :
 *   le libellé libre (« Vigilance jaune orages ») peut contredire le niveau ;
 * - le flux garde un historique : pour une zone, un phénomène et un jour, seule
 *   la dernière émission à fenêtre valide compte ;
 * - une mise à jour à fenêtre nulle (début ≥ fin, « verte », avec `references`)
 *   clôt le message précédent, souvent suivie d'une nouvelle alerte quelques
 *   secondes après ; sans cette nouvelle alerte, l'état actuel n'est pas connu :
 *   l'alerte reste affichée, marquée « mise à jour depuis » ;
 * - Météo-France ne publie que pour le jour même et le lendemain.
 */

import type { OfficialAlert } from './danger';

/** Ce que le Compas sait des alertes officielles pour ce voyage. */
export type AlertsStatus =
  /** Flux lu pour la zone et les dates du voyage (liste vide = aucune vigilance). */
  | 'lues'
  /** Départ au-delà du lendemain : rien n'est encore publié. */
  | 'pas_encore_publiees'
  /** Zone hors France : flux non couvert par le Compas. */
  | 'hors_france'
  /** Flux, lieu ou dates indisponibles. */
  | 'indisponibles';

export const METEOALARM_SOURCE = 'Météo-France via Meteoalarm';

const LEVELS: Record<number, OfficialAlert['level']> = { 2: 'jaune', 3: 'orange', 4: 'rouge' };

/** Types de phénomène du standard Meteoalarm (`awareness_type`). */
const HAZARDS: Record<number, string> = {
  1: 'vent violent',
  2: 'neige-verglas',
  3: 'orages',
  4: 'brouillard',
  5: 'canicule',
  6: 'grand froid',
  7: 'vagues-submersion',
  8: 'feux de forêt',
  9: 'avalanches',
  10: 'pluie',
  11: 'crues',
  12: 'inondations',
  13: 'pluie-inondation',
};

/** « Hautes Alpes », « Hautes-Alpes », « hautes-alpes » → même clé. */
export function normalizeArea(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’\s]+/g, ' ')
    .trim();
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Les dates du voyage touchent-elles aujourd'hui ou demain (horizon publié) ? */
export function withinPublishedHorizon(from: string, to: string, today: string): boolean {
  if (![from, to, today].every((d) => ISO_DAY.test(d))) return false;
  return from <= addDays(today, 1) && to >= today;
}

const leadingNumber = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Dernier jour couvert : une fin à minuit appartient au jour précédent. */
function lastDay(expires: string): string {
  const day = expires.slice(0, 10);
  return /T00:00(:00)?/.test(expires) ? addDays(day, -1) : day;
}

interface Candidate {
  id: string;
  sent: number;
  level: number;
  type: number | null;
  area: string;
  onset: string;
  expires: string;
}

/**
 * Alertes en vigueur pour une zone (département) et des dates de voyage.
 * Un corps illisible rend une liste vide : l'appelant décide du statut.
 */
export function parseMeteoalarm(
  json: unknown,
  opts: { area: string; from: string; to: string; now: Date; fetchedAt: string }
): OfficialAlert[] {
  const warnings = (json as { warnings?: unknown })?.warnings;
  if (!Array.isArray(warnings)) return [];
  const wanted = normalizeArea(opts.area);
  if (!wanted) return [];

  // Dernière émission par (phénomène, jour de début) pour cette zone, et
  // dernière mise à jour à fenêtre nulle par phénomène.
  const latest = new Map<string, Candidate>();
  const closedAt = new Map<string, number>();
  for (const w of warnings) {
    const alert = (w as { alert?: Record<string, unknown> })?.alert;
    if (!alert || alert.msgType === 'Cancel') continue;
    const sent = Date.parse(String(alert.sent ?? ''));
    const infos = Array.isArray(alert.info) ? (alert.info as Array<Record<string, unknown>>) : [];
    const info = infos.find((i) => i.language === 'fr-FR') ?? infos[0];
    if (!info || !Number.isFinite(sent)) continue;
    const onset = String(info.onset ?? info.effective ?? '');
    const expires = String(info.expires ?? '');
    if (!ISO_DAY.test(onset.slice(0, 10)) || !ISO_DAY.test(expires.slice(0, 10))) continue;
    const params = Array.isArray(info.parameter)
      ? (info.parameter as Array<{ valueName?: unknown; value?: unknown }>)
      : [];
    const level = leadingNumber(params.find((p) => p.valueName === 'awareness_level')?.value);
    const type = leadingNumber(params.find((p) => p.valueName === 'awareness_type')?.value);
    if (level == null) continue;
    const areas = Array.isArray(info.area) ? (info.area as Array<{ areaDesc?: unknown }>) : [];
    const match = areas.find(
      (a) => typeof a.areaDesc === 'string' && normalizeArea(a.areaDesc) === wanted
    );
    if (!match) continue;
    const start = Date.parse(onset);
    const stop = Date.parse(expires);
    if (!(stop > start)) {
      const k = String(type ?? '?');
      closedAt.set(k, Math.max(closedAt.get(k) ?? 0, sent));
      continue;
    }
    const key = `${type ?? '?'}|${onset.slice(0, 10)}`;
    const prev = latest.get(key);
    if (prev && prev.sent >= sent) continue;
    latest.set(key, {
      id: String(alert.identifier ?? key),
      sent,
      level,
      type,
      area: String(match.areaDesc),
      onset,
      expires,
    });
  }

  const now = opts.now.getTime();
  const out: OfficialAlert[] = [];
  for (const c of latest.values()) {
    const level = LEVELS[c.level];
    if (!level) continue; // 1 = vert : pas de vigilance
    const end = Date.parse(c.expires);
    if (Number.isFinite(end) && end <= now) continue;
    if (c.onset.slice(0, 10) > opts.to || lastDay(c.expires) < opts.from) continue;
    const closed = closedAt.get(String(c.type ?? '?'));
    out.push({
      id: c.id,
      source: METEOALARM_SOURCE,
      sent: new Date(c.sent).toISOString(),
      updatedSince: closed != null && closed > c.sent ? new Date(closed).toISOString() : null,
      hazard: (c.type != null && HAZARDS[c.type]) || 'phénomène non précisé',
      level,
      area: c.area,
      onset: c.onset,
      expires: c.expires,
      fetchedAt: opts.fetchedAt,
    });
  }
  const rank = { rouge: 0, orange: 1, jaune: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level] || (a.onset ?? '').localeCompare(b.onset ?? ''));
}
