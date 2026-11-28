import type { ActivityDomainEvent } from '../activityEventBus';

export interface GearUsageLedgerDelta {
  userId: string;
  sessionId: string;
  productOwnershipId: string;
  deltaDistanceM: number;
  deltaHours: number;
  deltaCycles: number;
  reason: 'activity_completed' | 'activity_cropped' | 'activity_split_reversal' | 'activity_split_child' | 'activity_deleted';
  idempotencyKey: string;
}

export type GearAssetCategory =
  | 'running_shoes'
  | 'trail_shoes'
  | 'bike_chain'
  | 'fork_fox'
  | 'fork_rockshox'
  | 'ski_skins'
  | 'epi_rope_en892'
  | 'epi_via_ferrata_en958';

export interface GearWearStateInput {
  productOwnershipId: string;
  label: string;
  category: GearAssetCategory;
  totalDistanceM: number;
  totalHours: number;
  totalCycles: number;
  manufacturedAtIso?: string | null;
  severeFallRecorded?: boolean;
  nowIso?: string;
}

export interface GearWearAlert {
  productOwnershipId: string;
  label: string;
  severity: 'warning' | 'critical_retire';
  code:
    | 'shoes_wear_warning'
    | 'shoes_wear_replace'
    | 'chain_wear_warning'
    | 'chain_wear_replace'
    | 'suspension_service_due'
    | 'ski_skins_reglue'
    | 'epi_age_expired'
    | 'epi_fall_retire_mandatory';
  messageFr: string;
}

/**
 * Calcule des écritures réversibles dans `public.gear_usage_ledger`.
 * Toute mutation (`cropped`, `split`, `deleted`) génère des deltas algébriques exacts
 * pour que la somme cumulée reste toujours cohérente (0 double-comptage).
 */
export function computeGearLedgerDeltas(event: ActivityDomainEvent): GearUsageLedgerDelta[] {
  if (event.eventType === 'activity.completed.v1') {
    const { gearIds, distanceM, movingS } = event.payload;
    const hours = Number((Math.max(0, movingS) / 3600).toFixed(3));
    return gearIds.map((gearId) => ({
      userId: event.userId,
      sessionId: event.sessionId,
      productOwnershipId: gearId,
      deltaDistanceM: Math.round(Math.max(0, distanceM)),
      deltaHours: hours,
      deltaCycles: 1,
      reason: 'activity_completed',
      idempotencyKey: `${event.idempotencyKey}:gear:${gearId}`,
    }));
  }

  if (event.eventType === 'activity.cropped.v1') {
    const { gearIds, previousDistanceM, newDistanceM, previousMovingS, newMovingS } = event.payload;
    const deltaDist = Math.round(newDistanceM - previousDistanceM);
    const deltaHours = Number(((newMovingS - previousMovingS) / 3600).toFixed(3));
    if (deltaDist === 0 && deltaHours === 0) return [];
    return gearIds.map((gearId) => ({
      userId: event.userId,
      sessionId: event.sessionId,
      productOwnershipId: gearId,
      deltaDistanceM: deltaDist,
      deltaHours,
      deltaCycles: 0,
      reason: 'activity_cropped',
      idempotencyKey: `${event.idempotencyKey}:gear:${gearId}`,
    }));
  }

  if (event.eventType === 'activity.split.v1') {
    const { gearIds, parentDistanceM, parentMovingS, children } = event.payload;
    const deltas: GearUsageLedgerDelta[] = [];
    for (const gearId of gearIds) {
      // 1. Annulation comptable de la session parent
      deltas.push({
        userId: event.userId,
        sessionId: event.sessionId,
        productOwnershipId: gearId,
        deltaDistanceM: -Math.round(Math.max(0, parentDistanceM)),
        deltaHours: -Number((Math.max(0, parentMovingS) / 3600).toFixed(3)),
        deltaCycles: -1,
        reason: 'activity_split_reversal',
        idempotencyKey: `${event.idempotencyKey}:rev:${gearId}`,
      });
      // 2. Répartition exacte sur les sessions enfants
      for (const child of children) {
        deltas.push({
          userId: event.userId,
          sessionId: child.childSessionId,
          productOwnershipId: gearId,
          deltaDistanceM: Math.round(Math.max(0, child.distanceM)),
          deltaHours: Number((Math.max(0, child.movingS) / 3600).toFixed(3)),
          deltaCycles: 1,
          reason: 'activity_split_child',
          idempotencyKey: `${event.idempotencyKey}:child:${child.childSessionId}:${gearId}`,
        });
      }
    }
    return deltas;
  }

  if (event.eventType === 'activity.deleted.v1') {
    const { gearIds, distanceM, movingS, cyclesCount = 1 } = event.payload;
    const hours = Number((Math.max(0, movingS) / 3600).toFixed(3));
    return gearIds.map((gearId) => ({
      userId: event.userId,
      sessionId: event.sessionId,
      productOwnershipId: gearId,
      deltaDistanceM: -Math.round(Math.max(0, distanceM)),
      deltaHours: -hours,
      deltaCycles: -Math.max(1, cyclesCount),
      reason: 'activity_deleted',
      idempotencyKey: `${event.idempotencyKey}:del:${gearId}`,
    }));
  }

  return [];
}

/**
 * Évalue les seuils d'usure et de sécurité EPI (normes EN 892 / EN 958).
 */
export function evaluateGearWearAlerts(items: ReadonlyArray<GearWearStateInput>): GearWearAlert[] {
  const alerts: GearWearAlert[] = [];

  for (const item of items) {
    const km = item.totalDistanceM / 1000;

    if (item.category === 'running_shoes' || item.category === 'trail_shoes') {
      if (km >= 800) {
        alerts.push({
          productOwnershipId: item.productOwnershipId,
          label: item.label,
          severity: 'critical_retire',
          code: 'shoes_wear_replace',
          messageFr: `${item.label} a dépassé 800 km (${Math.round(km)} km) : remplacement recommandé.`,
        });
      } else if (km >= 500) {
        alerts.push({
          productOwnershipId: item.productOwnershipId,
          label: item.label,
          severity: 'warning',
          code: 'shoes_wear_warning',
          messageFr: `${item.label} atteint ${Math.round(km)} km (seuil contrôle amorti 500 km).`,
        });
      }
    } else if (item.category === 'bike_chain') {
      if (km >= 4800) {
        alerts.push({
          productOwnershipId: item.productOwnershipId,
          label: item.label,
          severity: 'critical_retire',
          code: 'chain_wear_replace',
          messageFr: `${item.label} atteint ${Math.round(km)} km : remplacement chaîne urgent (risque cassette).`,
        });
      } else if (km >= 2400) {
        alerts.push({
          productOwnershipId: item.productOwnershipId,
          label: item.label,
          severity: 'warning',
          code: 'chain_wear_warning',
          messageFr: `${item.label} atteint ${Math.round(km)} km : vérifiez l'allongement (0,5 % / 0,75 %).`,
        });
      }
    } else if (item.category === 'fork_fox' && item.totalHours >= 125) {
      alerts.push({
        productOwnershipId: item.productOwnershipId,
        label: item.label,
        severity: 'warning',
        code: 'suspension_service_due',
        messageFr: `${item.label} : révision suspension Fox recommandée (${Math.round(item.totalHours)} h / 125 h).`,
      });
    } else if (item.category === 'fork_rockshox' && item.totalHours >= 200) {
      alerts.push({
        productOwnershipId: item.productOwnershipId,
        label: item.label,
        severity: 'warning',
        code: 'suspension_service_due',
        messageFr: `${item.label} : révision complète RockShox recommandée (${Math.round(item.totalHours)} h / 200 h).`,
      });
    } else if (item.category === 'ski_skins' && item.totalCycles >= 40) {
      alerts.push({
        productOwnershipId: item.productOwnershipId,
        label: item.label,
        severity: 'warning',
        code: 'ski_skins_reglue',
        messageFr: `${item.label} : ${item.totalCycles} sorties — réencollage des peaux conseillé (seuil 40 cycles).`,
      });
    } else if (item.category === 'epi_rope_en892' || item.category === 'epi_via_ferrata_en958') {
      if (item.severeFallRecorded) {
        alerts.push({
          productOwnershipId: item.productOwnershipId,
          label: item.label,
          severity: 'critical_retire',
          code: 'epi_fall_retire_mandatory',
          messageFr: `ALERTE EPI (${item.category === 'epi_via_ferrata_en958' ? 'EN 958' : 'EN 892'}) : chute enregistrée sur ${item.label} — mise au rebut immédiate obligatoire.`,
        });
      }
      if (item.manufacturedAtIso) {
        const nowMs = item.nowIso ? Date.parse(item.nowIso) : Date.now();
        const mfgMs = Date.parse(item.manufacturedAtIso);
        if (Number.isFinite(nowMs) && Number.isFinite(mfgMs)) {
          const ageYears = (nowMs - mfgMs) / (365.25 * 24 * 3600 * 1000);
          if (ageYears >= 10) {
            alerts.push({
              productOwnershipId: item.productOwnershipId,
              label: item.label,
              severity: 'critical_retire',
              code: 'epi_age_expired',
              messageFr: `ALERTE EPI : ${item.label} dépasse la durée de vie maximale constructeur de 10 ans (${ageYears.toFixed(1)} ans).`,
            });
          }
        }
      }
    }
  }

  return alerts;
}
