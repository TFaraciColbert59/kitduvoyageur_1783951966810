import { createClient } from '@/lib/supabase/server';

export interface MaterielSummary {
  depart: {
    id: string;
    destination: string;
    startsAt: string;
    readinessPct: number;
    status: 'ok' | 'warning' | 'critical';
  };
  forget: { forgetRemaining: number; checkedItems: number; totalItems: number; nextDepartLabel: string | null };
  kits: { count: number; avgCompletionPct: number; trashCount: number; assignedKitName: string | null };
  inventaire: { count: number; goodConditionPct: number; orderedCount: number; lastAddedLabel: string | null };
  alertes: { count: number; criticalCount: number; warningCount: number; reliabilityScore: number; lastAlertLabel: string | null };
  dispo: { unavailableCount: number; total: number; hasConflict: boolean; nextReturnLabel: string | null };
}

const EMPTY: MaterielSummary = {
  depart: {
    id: 'none',
    destination: 'Aucun départ planifié',
    startsAt: new Date().toISOString(),
    readinessPct: 0,
    status: 'warning',
  },
  forget: { forgetRemaining: 0, checkedItems: 0, totalItems: 0, nextDepartLabel: null },
  kits: { count: 0, avgCompletionPct: 0, trashCount: 0, assignedKitName: null },
  inventaire: { count: 0, goodConditionPct: 0, orderedCount: 0, lastAddedLabel: null },
  alertes: { count: 0, criticalCount: 0, warningCount: 0, reliabilityScore: 100, lastAlertLabel: null },
  dispo: { unavailableCount: 0, total: 0, hasConflict: false, nextReturnLabel: null },
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
      supabase.from('materiel_kits').select('id, is_trashed').eq('user_id', user.id),
      supabase.from('product_ownership').select('id, condition, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('alerts').select('severity, is_resolved').eq('user_id', user.id).eq('is_resolved', false),
      supabase.from('materiel_loans').select('status, due_date').eq('lender_id', user.id),
    ]);

    const kitRows = kits.data ?? [];
    const invCount = inv.count ?? (inv.data && inv.data.length > 0 ? inv.data.length : 0);
    const activeAlerts = (alerts.data ?? []).filter((a) => !a.is_resolved);
    const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;
    const warningCount = activeAlerts.filter((a) => a.severity === 'warning').length;
    const loansActive = (loans.data ?? []).filter((l) => l.status === 'en_cours' || l.status === 'en_retard');
    const nextReturn = loansActive.sort((a, b) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime())[0];

    const summary: MaterielSummary = {
      depart: EMPTY.depart,
      forget: {
        forgetRemaining: 0,
        checkedItems: 0,
        totalItems: 0,
        nextDepartLabel: null,
      },
      kits: {
        count: kitRows.filter((k) => !k.is_trashed).length,
        avgCompletionPct: 0,
        trashCount: kitRows.filter((k) => k.is_trashed).length,
        assignedKitName: null,
      },
      inventaire: {
        count: invCount,
        goodConditionPct: 100,
        orderedCount: 0,
        lastAddedLabel: inv.data && inv.data.length > 0 ? 'Dernier ajout récent' : null,
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
      },
    };

    return summary;
  } catch (err) {
    console.error('getMaterielSummary', err);
    return EMPTY;
  }
}
