import { createClient } from '@/lib/supabase/server';

export interface MaterielSummary {
  depart: {
    id: string;
    destination: string;
    startsAt: string;
    readinessPct: number;
    status: 'ok' | 'warning' | 'critical';
    totalWeightKg?: number;
    itemsCount?: number;
  };
  forget: {
    forgetRemaining: number;
    checkedItems: number;
    totalItems: number;
    nextDepartLabel: string | null;
    sampleItems: { name: string; is_checked: boolean }[];
  };
  kits: {
    count: number;
    avgCompletionPct: number;
    trashCount: number;
    assignedKitName: string | null;
    totalWeightKg: number;
    topKits: { id: string; name: string; weightKg: number; completionPct: number }[];
  };
  inventaire: {
    count: number;
    goodConditionPct: number;
    orderedCount: number;
    lastAddedLabel: string | null;
    goodCount: number;
  };
  alertes: {
    count: number;
    criticalCount: number;
    warningCount: number;
    reliabilityScore: number;
    lastAlertLabel: string | null;
  };
  dispo: {
    unavailableCount: number;
    total: number;
    hasConflict: boolean;
    nextReturnLabel: string | null;
    availableCount: number;
  };
}

const EMPTY: MaterielSummary = {
  depart: {
    id: 'none',
    destination: 'Aucun départ planifié',
    startsAt: new Date().toISOString(),
    readinessPct: 0,
    status: 'warning',
    totalWeightKg: 0,
    itemsCount: 0,
  },
  forget: {
    forgetRemaining: 0,
    checkedItems: 0,
    totalItems: 0,
    nextDepartLabel: null,
    sampleItems: [],
  },
  kits: {
    count: 0,
    avgCompletionPct: 0,
    trashCount: 0,
    assignedKitName: null,
    totalWeightKg: 0,
    topKits: [],
  },
  inventaire: {
    count: 0,
    goodConditionPct: 100,
    orderedCount: 0,
    lastAddedLabel: null,
    goodCount: 0,
  },
  alertes: {
    count: 0,
    criticalCount: 0,
    warningCount: 0,
    reliabilityScore: 100,
    lastAlertLabel: null,
  },
  dispo: {
    unavailableCount: 0,
    total: 0,
    hasConflict: false,
    nextReturnLabel: null,
    availableCount: 0,
  },
};

function daysLabel(date: string | null): string | null {
  if (!date) return null;
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'retour passé';
  if (days === 0) return 'retour aujourd’hui';
  return `retour dans ${days} j`;
}

/** getMaterielSummary — agrégats serveur pour la grille /materiel (Server-only, RLS). */
export async function getMaterielSummary(): Promise<MaterielSummary> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY;

    const [kits, inv, alerts, loans] = await Promise.all([
      supabase.from('materiel_kits').select('id, name, total_weight_g, is_trashed, materiel_kit_items(name, weight_g, is_checked)').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('product_ownership').select('id, condition, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('alerts').select('severity, is_resolved').eq('user_id', user.id).eq('is_resolved', false),
      supabase.from('materiel_loans').select('status, due_date').eq('lender_id', user.id),
    ]);

    const kitRows = kits.data ?? [];
    const activeKits = kitRows.filter((k) => !k.is_trashed);
    const firstKit = activeKits[0] ?? null;
    const kitItems = (firstKit?.materiel_kit_items ?? []) as { name?: string | null; weight_g?: number | null; is_checked: boolean }[];
    const checkedCount = kitItems.filter((i) => i.is_checked).length;
    const readiness = kitItems.length ? Math.round((checkedCount / kitItems.length) * 100) : 0;
    const totalWeight = kitItems.reduce((acc, i) => acc + (i.weight_g ?? 0), 0);

    const invData = inv.data ?? [];
    const invCount = invData.length;
    const goodConditionItems = invData.filter((i) => i.condition && i.condition !== 'a_remplacer').length;
    const activeAlerts = (alerts.data ?? []).filter((a) => !a.is_resolved);
    const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;
    const warningCount = activeAlerts.filter((a) => a.severity === 'warning').length;
    const loansActive = (loans.data ?? []).filter((l) => l.status === 'en_cours' || l.status === 'en_retard');
    const nextReturn = loansActive.sort((a, b) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime())[0];

    const avgCompletion = activeKits.length
      ? activeKits.reduce((s, k) => {
          const items = (k.materiel_kit_items ?? []) as { is_checked: boolean }[];
          return s + (items.length ? (items.filter((i) => i.is_checked).length / items.length) * 100 : 100);
        }, 0) / activeKits.length
      : 0;

    const sampleItems = kitItems.slice(0, 3).map((item, idx) => ({
      name: item.name || `Équipement ${idx + 1}`,
      is_checked: !!item.is_checked,
    }));

    const topKits = activeKits.slice(0, 3).map((k) => {
      const items = (k.materiel_kit_items ?? []) as { weight_g?: number | null; is_checked: boolean }[];
      const checked = items.filter((i) => i.is_checked).length;
      const w = items.reduce((acc, i) => acc + (i.weight_g ?? 0), 0) || k.total_weight_g || 0;
      return {
        id: k.id,
        name: k.name,
        weightKg: Number((w / 1000).toFixed(1)),
        completionPct: items.length ? Math.round((checked / items.length) * 100) : 100,
      };
    });

    const departTotalKg = firstKit?.total_weight_g ? firstKit.total_weight_g / 1000 : totalWeight / 1000;

    const depart: MaterielSummary['depart'] = firstKit
      ? {
          id: firstKit.id,
          destination: firstKit.name,
          startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
          readinessPct: readiness,
          status: readiness >= 80 ? 'ok' : readiness >= 40 ? 'warning' : 'critical',
          totalWeightKg: Number(departTotalKg.toFixed(1)),
          itemsCount: kitItems.length,
        }
      : EMPTY.depart;

    const totalActiveKitsWeightKg = activeKits.reduce((s, k) => s + (k.total_weight_g || 0), 0) / 1000;

    const summary: MaterielSummary = {
      depart,
      forget: {
        forgetRemaining: kitItems.length - checkedCount,
        checkedItems: checkedCount,
        totalItems: kitItems.length,
        nextDepartLabel: firstKit ? firstKit.name : null,
        sampleItems: sampleItems.length > 0 ? sampleItems : [
          { name: 'Tente & Bivouac', is_checked: true },
          { name: 'Gourde filtrante 1L', is_checked: false },
          { name: 'Trousse de secours', is_checked: false },
        ],
      },
      kits: {
        count: activeKits.length,
        avgCompletionPct: Math.round(avgCompletion),
        trashCount: kitRows.length - activeKits.length,
        assignedKitName: firstKit?.name ?? null,
        totalWeightKg: Number(totalActiveKitsWeightKg.toFixed(1)),
        topKits,
      },
      inventaire: {
        count: invCount,
        goodConditionPct: invCount ? Math.round((goodConditionItems / invCount) * 100) : 100,
        orderedCount: 0,
        lastAddedLabel: invData.length > 0 ? 'Dernier ajout récent' : null,
        goodCount: goodConditionItems,
      },
      alertes: {
        count: activeAlerts.length,
        criticalCount,
        warningCount,
        reliabilityScore: Math.max(0, 100 - activeAlerts.length * 10),
        lastAlertLabel: activeAlerts.length > 0 ? `${activeAlerts.length} alerte(s) active(s)` : null,
      },
      dispo: {
        unavailableCount: loansActive.length,
        total: invCount,
        hasConflict: false,
        nextReturnLabel: nextReturn ? daysLabel(nextReturn.due_date) : null,
        availableCount: Math.max(0, invCount - loansActive.length),
      },
    };

    return summary;
  } catch (err) {
    console.error('getMaterielSummary', err);
    return EMPTY;
  }
}
