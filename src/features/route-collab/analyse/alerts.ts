/**
 * Alertes datées (7.6) : fermetures, vigilance et incendie, chacune avec sa source, sa date de relevé et la fin de
 * sa validité. Pur. Seules les sources déjà intégrées sont lues :
 * - les dangers déclarés sur les étapes (`RouteHazard` : fermeture, alerte météo, terrain, accès) ;
 * - les feux : NASA FIRMS via `analyzeFireAlerts` (point chaud satellite = information, jamais une fermeture).
 * Une alerte sans fin de validité dit « fin de validité inconnue » ; une alerte échue est marquée expirée et
 * n'est jamais comptée comme active.
 */
import type { RouteHazard } from '../types';

export type AlertKind = 'closure' | 'vigilance' | 'fire' | 'terrain' | 'access';

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  closure: 'Fermeture',
  vigilance: 'Vigilance',
  fire: 'Incendie',
  terrain: 'Terrain',
  access: 'Accès',
};

export interface DatedAlert {
  readonly id: string;
  readonly kind: AlertKind;
  readonly title: string;
  readonly source: string;
  /** Date du relevé ou de l'observation (ISO) ; `null` quand la source ne la donne pas. */
  readonly observedAt: string | null;
  /** Fin de validité (ISO) ; `null` : inconnue. */
  readonly validUntil: string | null;
  readonly expired: boolean;
  readonly severity: 'info' | 'warning' | 'critical';
  /** Jour concerné quand l'alerte vient d'une étape. */
  readonly day: number | null;
  readonly detail: string | null;
}

/** Réponse du serveur pour les feux (déjà passée par `analyzeFireAlerts`). */
export interface FireAlertPayload {
  readonly status: 'clear' | 'alerts' | 'partial' | 'unavailable';
  readonly source: string | null;
  readonly retrievedAt: string | null;
  readonly reason: string | null;
  readonly impacts: readonly {
    readonly incidentId: string;
    readonly kind: 'official_alert' | 'hotspot' | 'burned_area';
    readonly severity: 'info' | 'warning' | 'critical';
    readonly label: string | null;
    readonly message: string;
    readonly fromKm: number;
    readonly toKm: number;
    readonly observedAt: string | null;
    readonly validUntil: string | null;
    readonly source: string | null;
  }[];
}

/** Réponse du serveur pour les alertes officielles (Meteoalarm, même service que le tiroir Vérifs du Compas). */
export interface OfficialAlertsPayload {
  readonly status: 'lues' | 'partielles' | 'pas_encore_publiees' | 'non_couvert' | 'zone_non_rapprochee' | 'indisponibles';
  readonly service: string | null;
  readonly readAt: string | null;
  readonly alerts: readonly {
    readonly id: string;
    readonly source: string;
    readonly hazard: string;
    readonly level: 'jaune' | 'orange' | 'rouge';
    readonly area: string;
    readonly onset: string | null;
    readonly expires: string | null;
    readonly sent: string | null;
    readonly fetchedAt: string;
    readonly headline: string | null;
  }[];
}

export const OFFICIAL_STATUS_GAP: Record<OfficialAlertsPayload['status'], string | null> = {
  lues: null,
  partielles: 'Vigilance officielle : la zone n’est reconnue qu’en partie, d’autres alertes peuvent exister.',
  pas_encore_publiees: 'Vigilance officielle : rien n’est encore publié pour ces dates.',
  non_couvert: 'Vigilance officielle : ce pays n’a pas de flux utilisable, aucun « aucune alerte » n’est affiché.',
  zone_non_rapprochee: 'Vigilance officielle : la zone du lieu n’est pas reconnaissable dans le flux, aucun « aucune alerte » n’est affiché.',
  indisponibles: 'Vigilance officielle : source indisponible ou dates hors période publiée.',
};

export function alertsFromOfficial(official: OfficialAlertsPayload | null, now: Date): DatedAlert[] {
  if (!official) return [];
  return official.alerts.map((a) => {
    const validUntil = a.expires && Number.isFinite(Date.parse(a.expires)) ? a.expires : null;
    return {
      id: `official:${a.id}`,
      kind: 'vigilance' as const,
      title: `Vigilance ${a.level} · ${a.hazard} · ${a.area}`,
      source: a.source,
      observedAt: a.sent ?? a.fetchedAt,
      validUntil,
      expired: isExpired(validUntil, now),
      severity: a.level === 'rouge' ? ('critical' as const) : ('warning' as const),
      day: null,
      detail: a.headline,
    };
  });
}

function kindOfHazard(type: RouteHazard['type']): AlertKind {
  if (type === 'closure') return 'closure';
  if (type === 'weather_alert') return 'vigilance';
  if (type === 'access') return 'access';
  return 'terrain';
}

function isExpired(validUntil: string | null, now: Date): boolean {
  if (!validUntil) return false;
  const t = Date.parse(validUntil);
  return Number.isFinite(t) && t < now.getTime();
}

export function alertsFromStages(
  stages: readonly { readonly dayNumber: number; readonly hazards: readonly RouteHazard[] }[],
  now: Date,
): DatedAlert[] {
  const out: DatedAlert[] = [];
  for (const st of stages) {
    for (const h of st.hazards) {
      const validUntil = h.expiresAt && Number.isFinite(Date.parse(h.expiresAt)) ? h.expiresAt : null;
      out.push({
        id: `hazard:${h.id}`,
        kind: kindOfHazard(h.type),
        title: h.title,
        source: h.source || 'Source non renseignée',
        observedAt: Number.isFinite(Date.parse(h.observedAt)) ? h.observedAt : null,
        validUntil,
        expired: isExpired(validUntil, now),
        severity: h.type === 'closure' ? 'critical' : 'warning',
        day: st.dayNumber,
        detail: h.severitySource ? `Gravité : ${h.severitySource}` : null,
      });
    }
  }
  return out;
}

export function alertsFromFire(fire: FireAlertPayload | null, now: Date): DatedAlert[] {
  if (!fire) return [];
  return fire.impacts.map((i) => {
    const validUntil = i.validUntil && Number.isFinite(Date.parse(i.validUntil)) ? i.validUntil : null;
    return {
      id: `fire:${i.incidentId}:${i.fromKm}`,
      kind: 'fire' as const,
      title: i.label ?? i.message,
      source: i.source ?? fire.source ?? 'Source non renseignée',
      observedAt: i.observedAt && Number.isFinite(Date.parse(i.observedAt)) ? i.observedAt : fire.retrievedAt,
      validUntil,
      expired: isExpired(validUntil, now),
      severity: i.severity,
      day: null,
      detail: `${i.message} (km ${i.fromKm} à ${i.toKm})`,
    };
  });
}

export interface AlertsReading {
  readonly alerts: readonly DatedAlert[];
  readonly active: readonly DatedAlert[];
  readonly expiredCount: number;
  /** Ce que la page ne sait pas : sources absentes, jamais « aucune alerte » sans l'avoir vérifié. */
  readonly gaps: readonly string[];
}

export function readAlerts(
  stages: Parameters<typeof alertsFromStages>[0],
  fire: FireAlertPayload | null,
  now: Date,
  official: OfficialAlertsPayload | null = null,
): AlertsReading {
  const alerts = [...alertsFromStages(stages, now), ...alertsFromOfficial(official, now), ...alertsFromFire(fire, now)].sort(
    (a, b) => Number(a.expired) - Number(b.expired) || (b.observedAt ?? '').localeCompare(a.observedAt ?? ''),
  );
  const gaps: string[] = [];
  if (!fire) gaps.push('Feux : source pas encore lue.');
  else if (fire.status === 'unavailable') gaps.push(fire.reason ?? 'Feux : source indisponible, aucun « aucun feu » affiché.');
  if (!official) gaps.push('Vigilance officielle : source pas encore lue (il faut des étapes datées).');
  else {
    const g = OFFICIAL_STATUS_GAP[official.status];
    if (g) gaps.push(g);
  }
  gaps.push('Fermetures : seules celles déclarées sur les étapes sont connues (aucune source de fermetures n’est intégrée).');
  return { alerts, active: alerts.filter((a) => !a.expired), expiredCount: alerts.filter((a) => a.expired).length, gaps };
}
