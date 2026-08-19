/**
 * LKDV — Mon Matériel • Domaine : préparation d'un départ (readiness).
 * Score de préparation, blocants, checklist contextualisée (données réelles
 * + règles génériques explicites) et snapshot de validation.
 * Fonctions pures — l'écriture de l'historique reste à la charge du caller.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';
import { evaluateKitCompleteness, assessKitItem } from './gear-completeness';
import { countdownLabel, daysUntil, formatWeather, pct } from './gear-format';
import type { GearAlert } from './gear-alerts';

export type DepartureStatus = 'ready' | 'to_check' | 'blocked';

export type ChecklistLevel = 'critique' | 'verifier' | 'conseille' | 'pret';

export interface DepartureChecklistItem {
  id: string;
  label: string;
  reason: string;
  level: ChecklistLevel;
  category: string;
  source: 'donnée' | 'règle';
  gearId?: string;
}

export interface DepartureBlocker {
  id: string;
  label: string;
  detail: string;
  gearId?: string;
  kind: 'missing' | 'unavailable' | 'alert';
  solutionKey: 'add_to_cart' | 'nudge' | 'resolve_conflict' | 'review' | 'add_to_equipment';
}

export interface DepartureReadiness {
  status: DepartureStatus;
  readinessPct: number;
  ownedCount: number;
  availableCount: number;
  totalCount: number;
  blockers: DepartureBlocker[];
  toCheckCount: number;
  criticalChecklist: DepartureChecklistItem[];
}

export interface DepartureSnapshot {
  id: string;
  createdAt: string;
  departureId: string;
  departureName: string;
  targetDate?: string;
  status: DepartureStatus;
  kitId?: string;
  kitName?: string;
  checklist: DepartureChecklistItem[];
  checklistCheckedIds: string[];
  totalWeightG: number;
  weatherSummary?: string;
}

/** Règles génériques de bon sens, toujours présentées comme telles (source: 'règle'). */
function genericChecks(departure: PlannedHike, equipment: UserEquipmentItem[]): DepartureChecklistItem[] {
  const out: DepartureChecklistItem[] = [];
  const invNames = equipment.map((e) => `${e.name} ${e.category || ''}`.toLowerCase());
  const hasKw = (kws: string[]) => kws.some((k) => invNames.some((n) => n.includes(k)));

  const consumChecks: { label: string; kws: string[]; reason: string }[] = [
    { label: 'Gaz / cartouche pour réchaud', kws: ['gaz', 'cartouche', 'réchaud', 'rechaud'], reason: 'Indispensable si cuisine au réchaud — non détecté dans l’inventaire.' },
    { label: 'Pastilles de purification d’eau', kws: ['pastille', 'purif', 'micropur'], reason: 'Autonomie eau en l’absence de point sûr.' },
    { label: 'Piles / batterie externe', kws: ['piles', 'pile ', 'batterie', 'powerbank', 'power bank'], reason: 'Sécurité électronique (frontale, GPS) — à charger.' },
    { label: 'Pharmacie (pansements, anti-douleur)', kws: ['pharmacie', 'pansement', 'trousse', 'secours'], reason: 'Essentiel en milieu isolé.' },
    { label: 'Crème solaire', kws: ['crème solaire', 'creme solaire', 'solaire'], reason: 'Protection UV — été ou altitude.' },
    { label: 'Répulsif anti-moustiques', kws: ['répulsif', 'repulsif', 'anti-moustique', 'moustique'], reason: 'Confort en forêt / zones humides.' },
  ];
  consumChecks.forEach((c) => {
    const present = hasKw(c.kws);
    out.push({
      id: `ck-con-${c.label.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      label: c.label,
      reason: present ? 'Présent dans l’inventaire.' : c.reason,
      level: present ? 'pret' : 'conseille',
      category: 'Consommables',
      source: 'règle',
    });
  });

  const docChecks = [
    { label: 'Pièce d’identité', reason: 'Obligatoire hors zone de résidence.' },
    { label: 'Assurance (annulation / rapatriement)', reason: 'Rarement emporté de tête — à vérifier.' },
    { label: 'Argent liquide', reason: 'Souvent indispensable hors réseau.' },
    { label: 'Numéros d’urgence', reason: 'À avoir à portée.' },
  ];
  docChecks.forEach((d, i) => {
    out.push({
      id: `ck-doc-${i}`,
      label: d.label,
      reason: d.reason,
      level: 'conseille',
      category: 'Documents',
      source: 'règle',
    });
  });

  if (departure.isOvernight) {
    out.push({
      id: 'ck-ctx-bivouac',
      label: 'Équipement bivouac (tente, duvet, lampe)',
      reason: `Nuit sur place (${(departure.nightsCount || 1) + 1} jours).`,
      level: 'verifier',
      category: 'Contexte départ',
      source: 'règle',
    });
  }
  const tempC = departure.weather?.tempC;
  if (typeof tempC === 'number') {
    if (tempC < 5) {
      out.push({
        id: 'ck-ctx-cold',
        label: 'Couche chaude supplémentaire',
        reason: `${Math.round(tempC)} °C annoncés au départ.`,
        level: 'verifier',
        category: 'Contexte départ',
        source: 'donnée',
      });
    }
    if (tempC > 24) {
      out.push({
        id: 'ck-ctx-hot',
        label: 'Hydratation & protection solaire',
        reason: `Temps chaud annoncé (${Math.round(tempC)} °C).`,
        level: 'verifier',
        category: 'Contexte départ',
        source: 'donnée',
      });
    }
  }

  return out;
}

/** Checklist contextualisée : données du kit assigné + alertes + règles génériques. */
export function buildDepartureChecklist(
  departure: PlannedHike,
  kit: CustomKit | null,
  equipment: UserEquipmentItem[],
  alertOverride: GearAlert[] = []
): DepartureChecklistItem[] {
  const out: DepartureChecklistItem[] = [];

  // 1. Alertes données (maintenance, péremption, prêt, état)
  if (alertOverride.length > 0) {
    for (const a of alertOverride) {
      const level: ChecklistLevel =
        a.severity === 'critical'
          ? 'critique'
          : a.severity === 'warning'
          ? 'verifier'
          : 'conseille';
      out.push({
        id: `ck-alert-${a.kind}-${a.gearId || ''}`,
        label: a.label.replace(/^[^:]*: /, ''),
        reason: a.detail,
        level,
        category: 'Alertes',
        source: 'donnée',
        gearId: a.gearId,
      });
    }
  }

  // 2. Kit assigné : articles non possédés (critique) ou indisponibles (verifier)
  if (kit && kit.items.length > 0) {
    const completeness = evaluateKitCompleteness(kit, equipment);
    for (const assessment of completeness.assessments) {
      if (!assessment.owned) {
        out.push({
          id: `ck-kit-missing-${assessment.item.id}`,
          label: assessment.item.item_name,
          reason: 'Manquant au kit du prochain départ — à acheter ou à emprunter.',
          level: 'critique',
          category: `Kit ${kit.name}`,
          source: 'donnée',
        });
      } else if (!assessment.available && assessment.reason) {
        out.push({
          id: `ck-kit-unavail-${assessment.item.id}`,
          label: assessment.item.item_name,
          reason: assessment.reason,
          level: 'verifier',
          category: `Kit ${kit.name}`,
          source: 'donnée',
          gearId: assessment.gear?.id,
        });
      }
    }
  }

  // 3. Règles génériques (explicites en UI via source: 'règle')
  out.push(...genericChecks(departure, equipment));

  return out;
}

/** Évalue le niveau de préparation d'un départ. */
export function evaluateDepartureReadiness(
  departure: PlannedHike,
  kit: CustomKit | null,
  equipment: UserEquipmentItem[],
  alertOverride: GearAlert[] = []
): DepartureReadiness {
  const checklist = buildDepartureChecklist(departure, kit, equipment, alertOverride);
  const kitItems = kit?.items || [];

  const assessments = kitItems.map((item) => assessKitItem(item, equipment));
  const ownedCount = assessments.filter((a) => a.owned).length;
  const availableCount = assessments.filter((a) => a.available).length;

  const blockers: DepartureBlocker[] = [];
  for (const a of assessments) {
    if (!a.owned) {
      blockers.push({
        id: `blk-miss-${a.item.id}`,
        label: a.item.item_name,
        detail: 'Absent de l’inventaire — à ajouter au panier ou à l’équipement.',
        kind: 'missing',
        solutionKey: 'add_to_cart',
      });
    } else if (!a.available && a.reason) {
      blockers.push({
        id: `blk-unav-${a.item.id}`,
        label: a.item.item_name,
        detail: a.reason,
        gearId: a.gear?.id,
        kind: 'unavailable',
        solutionKey: 'resolve_conflict',
      });
    }
  }

  // Alertes critiques de l'inventaire liées au départ (conflits compris).
  for (const alert of alertOverride) {
    if (alert.severity === 'critical' && alert.gearId) {
      const gear = equipment.find((e) => e.id === alert.gearId);
      blockers.push({
        id: `blk-alert-${alert.kind}-${alert.gearId}`,
        label: gear?.name || alert.label,
        detail: alert.detail,
        gearId: alert.gearId,
        kind: 'alert',
        solutionKey: alert.actionKey === 'replace' ? 'add_to_equipment' : 'resolve_conflict',
      });
    }
  }

  const totalCount = kitItems.length > 0 ? kitItems.length : Math.max(1, checklist.length);
  const ready = kitItems.length > 0
    ? pct(availableCount, kitItems.length)
    : pct(checklist.filter((c) => c.level === 'pret').length, checklist.length);

  const criticalCount = checklist.filter((c) => c.level === 'critique').length;
  const warningCount = checklist.filter((c) => c.level === 'verifier').length;

  const status: DepartureStatus =
    blockers.length > 0 || criticalCount > 0
      ? 'blocked'
      : warningCount > 0 || kitItems.length === 0
      ? 'to_check'
      : 'ready';

  return {
    status,
    readinessPct: ready,
    ownedCount,
    availableCount,
    totalCount,
    blockers,
    toCheckCount: warningCount,
    criticalChecklist: checklist.filter((c) => c.level === 'critique'),
  };
}

/** Snapshot de préparation (créé à la validation : date, kit, checklist, poids). */
export function buildDepartureSnapshot(
  departure: PlannedHike,
  kit: CustomKit | null,
  equipment: UserEquipmentItem[],
  checkedIds: string[],
  alertOverride: GearAlert[] = []
): DepartureSnapshot {
  const checklist = buildDepartureChecklist(departure, kit, equipment, alertOverride);
  const readiness = evaluateDepartureReadiness(departure, kit, equipment, alertOverride);
  const totalWeightG = (kit?.items || []).reduce(
    (sum, i) => sum + (i.weight_g || 0) * (i.quantity || 1),
    0
  );
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    departureId: departure.id,
    departureName: departure.name,
    targetDate: departure.targetDate,
    status: readiness.status,
    kitId: kit?.id,
    kitName: kit?.name,
    checklist,
    checklistCheckedIds: checkedIds,
    totalWeightG,
    weatherSummary: formatWeather(departure),
  };
}

export { countdownLabel, daysUntil };