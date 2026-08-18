/* =============================================================================
   LKDV — Widget Alertes (Compact) - Problèmes Réels Uniquement
   =============================================================================
   Card compacte : nombre + priorité max | Fullscreen : centre d'alertes trié par gravité
   Sources : maintenance dépassée, péremption, réparation, prêté, indisponible critique, poids dépassé
   ============================================================================= */

import React, { memo, useMemo } from 'react';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { CustomKit } from '@/hooks/useUserKits';
import { PlannedHike } from '@/lib/preparation/plannedHikes';
import { DeparturePreparationPlan } from '@/lib/preparation/SmartDepartureEngine';

interface Alert {
  id: string;
  kind: 'maintenance' | 'expiry' | 'replace' | 'loan' | 'weight' | 'missing_critical';
  title: string;
  description: string;
  critical: boolean;
  item: UserEquipmentItem;
  departure?: PlannedHike;
}

interface AlertesWidgetProps {
  equipment: UserEquipmentItem[];
  kits: CustomKit[];
  activeHike: PlannedHike | null;
  departurePlan: DeparturePreparationPlan | null;
  onExpand: () => void;
  onCloseExpanded: () => void;
  isExpanded: boolean;
  cardRef: React.RefObject<HTMLDivElement>;
  headerRef: React.RefObject<HTMLDivElement>;
  layoutId: string;
  headerLayoutId: string;
  onResolveMaintenance: (item: UserEquipmentItem) => void;
  onReturnLoan: (item: UserEquipmentItem) => void;
  onAddToCart: (product: any) => void;
}

export const AlertesWidget = memo(function AlertesWidget({
  equipment,
  kits,
  activeHike,
  departurePlan,
  onExpand,
  onCloseExpanded,
  isExpanded,
  cardRef,
  headerRef,
  layoutId,
  headerLayoutId,
  onResolveMaintenance,
  onReturnLoan,
  onAddToCart,
}: AlertesWidgetProps) {
  // Calculer les alertes (logique extraite de page.tsx)
  const alerts = useMemo((): Alert[] => {
    const now = Date.now();
    const out: Alert[] = [];

    equipment.forEach(it => {
      // Maintenance dépassée
      if (it.next_maintenance_date && new Date(it.next_maintenance_date).getTime() < now) {
        out.push({
          id: `maint-${it.id}`,
          kind: 'maintenance',
          title: `Entretien dépassé : ${it.name}`,
          description: `Prévu le ${new Date(it.next_maintenance_date).toLocaleDateString('fr-FR')}. Ré-imperméabilisation / révision requise.`,
          critical: true,
          item: it,
        });
      }

      // Péremption (30 jours)
      if (it.expiry_date && new Date(it.expiry_date).getTime() < (now + 30 * 86400000)) {
        const isPast = new Date(it.expiry_date).getTime() < now;
        out.push({
          id: `exp-${it.id}`,
          kind: 'expiry',
          title: `${isPast ? 'Périmé' : 'Péremption proche'} : ${it.name}`,
          description: `Date limite : ${new Date(it.expiry_date).toLocaleDateString('fr-FR')}.`,
          critical: isPast,
          item: it,
        });
      }

      // État dégradé
      if (it.condition === 'à_remplacer' || it.condition === 'à_réparer') {
        out.push({
          id: `rep-${it.id}`,
          kind: 'replace',
          title: `Matériel ${it.condition.replace('_', ' ')} : ${it.name}`,
          description: `État dégradé constaté. Remplacement recommandé avant un grand départ.`,
          critical: true,
          item: it,
        });
      }

      // Prêté
      if (it.loan_status === 'prêté') {
        out.push({
          id: `loan-${it.id}`,
          kind: 'loan',
          title: `Matériel prêté : ${it.name}`,
          description: `Prêté à ${it.loan_to_name || 'un ami'}. Pensez à le récupérer pour votre sortie.`,
          critical: false,
          item: it,
        });
      }
    });

    // Poids dépassé pour départ actif
    if (activeHike && departurePlan) {
      // TODO: calculer poids kit + consommables vs objectif
    }

    // Équipement critique manquant pour départ imminent
    if (activeHike && departurePlan) {
      const daysLeft = activeHike.targetDate
        ? Math.ceil((new Date(activeHike.targetDate).getTime() - now) / 86400000)
        : null;
      if (daysLeft !== null && daysLeft <= 7) {
        departurePlan.requiredItems?.forEach((ri: any) => {
          const isOwned = equipment.some(e =>
            e.name.toLowerCase() === ri.name.toLowerCase()
          );
          if (!isOwned) {
            out.push({
              id: `missing-critical-${ri.name}`,
              kind: 'missing_critical',
              title: `Indispensable manquant : ${ri.name}`,
              description: `Requis pour "${activeHike.name}" (J-${daysLeft}).`,
              critical: true,
              item: { id: `virtual-${ri.name}`, name: ri.name, category: ri.category, weight_g: ri.weight_g } as UserEquipmentItem,
              departure: activeHike,
            });
          }
        });
      }
    }

    // Trier : critiques d'abord, puis par type
    return out.sort((a, b) => {
      if (a.critical !== b.critical) return b.critical ? 1 : -1;
      const kindOrder = { maintenance: 0, expiry: 1, missing_critical: 2, replace: 3, loan: 4, weight: 5 };
      return (kindOrder[a.kind] || 99) - (kindOrder[b.kind] || 99);
    });
  }, [equipment, activeHike, departurePlan]);

  const hasAlerts = alerts.length > 0;
  const criticalCount = alerts.filter(a => a.critical).length;

  // --- RENDU COMPACT ---
  const renderCompact = () => (
    <div className="flex flex-col h-full text-white justify-between">
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
            Alertes & Fiabilité
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            hasAlerts ? (criticalCount > 0 ? 'bg-[#E76F51]/20 text-[#E76F51]' : 'bg-[#E9C46A]/20 text-[#E9C46A]') : 'bg-[#17402C] text-[#A3C4A3]'
          }`}>
            {hasAlerts ? `${alerts.length} action${alerts.length > 1 ? 's' : ''}` : '0 alerte'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center py-3">
          {!hasAlerts ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#A3C4A3]/20 flex items-center justify-center text-2xl mx-auto mb-2 text-[#A3C4A3]">
                ✓
              </div>
              <span className="text-sm font-bold text-[#A3C4A3] block">100% Opérationnel</span>
              <span className="text-[11px] text-white/50">Aucun matériel à réviser</span>
            </div>
          ) : (
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl font-black text-[#E76F51] drop-shadow-[0_0_15px_rgba(231,111,81,0.5)]">
                  {alerts.length}
                </span>
                <span className="text-xs text-white/70 font-semibold leading-tight">
                  point{alerts.length > 1 ? 's' : ''} d'attention
                </span>
              </div>
              <div className="p-2.5 bg-[#E76F51]/15 border border-[#E76F51]/30 rounded-xl">
                <span className="text-xs font-bold text-[#E76F51] block truncate">
                  {alerts[0].title}
                </span>
                <span className="text-[10px] text-white/70 line-clamp-1">
                  {alerts[0].description}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onExpand}
        className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors text-center"
      >
        {hasAlerts ? (criticalCount > 0 ? `Résoudre ${criticalCount} critique${criticalCount > 1 ? 's' : ''}` : 'Voir les alertes') : 'Voir l\'historique'}
      </button>
    </div>
  );

  // --- RENDU FULLSCREEN ---
  const renderFullscreen = () => (
    <div className="space-y-6 pt-2">
      {/* Filtres par type */}
      <div className="flex flex-wrap gap-2">
        {['all', 'maintenance', 'expiry', 'loan', 'replace', 'missing_critical', 'weight'].map(tab => (
          <button
            key={tab}
            onClick={() => {}}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
              tab === 'all' ? 'bg-[#A3C4A3] text-[#0B1F17]' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {tab === 'all' ? `Toutes (${alerts.length})` : tab}
          </button>
        ))}
      </div>

      {alerts.length === 0 ? (
        <div className="p-12 text-center bg-white/5 rounded-3xl border border-white/10">
          <span className="text-4xl block mb-2">🎉</span>
          <h4 className="text-lg font-bold text-white mb-1">Tout votre équipement est à jour !</h4>
          <p className="text-xs text-white/60">Aucune maintenance en retard, aucun objet prêté, aucune péremption.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {alerts.map(alert => (
            <div key={alert.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${alert.critical ? 'bg-[#E76F51]/20 text-[#E76F51]' : 'bg-amber-500/20 text-amber-300'}`}>
                    {alert.kind}
                  </span>
                  <span className="text-xs text-white/50">{alert.item.category}</span>
                </div>
                <h4 className="font-bold text-sm text-white mt-1">{alert.title}</h4>
                <p className="text-xs text-white/60 mt-0.5">{alert.description}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                {alert.kind === 'maintenance' && (
                  <button
                    onClick={() => onResolveMaintenance(alert.item)}
                    className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] rounded-lg text-xs font-bold hover:bg-[#b5d6b5]"
                  >
                    ✓ Marquer comme révisé
                  </button>
                )}
                {alert.kind === 'loan' && (
                  <button
                    onClick={() => onReturnLoan(alert.item)}
                    className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] rounded-lg text-xs font-bold hover:bg-[#b5d6b5]"
                  >
                    ✓ Marquer comme rendu
                  </button>
                )}
                {alert.kind === 'replace' && (
                  <button
                    onClick={() => onAddToCart({ name: alert.item.name, weight_g: alert.item.weight_g })}
                    className="px-3 py-1.5 bg-[#E76F51] text-white rounded-lg text-xs font-bold"
                  >
                    + Remplacer (Panier)
                  </button>
                )}
                {alert.kind === 'missing_critical' && (
                  <button
                    onClick={() => onAddToCart({ name: alert.item.name, weight_g: alert.item.weight_g })}
                    className="px-3 py-1.5 bg-[#E76F51] text-white rounded-lg text-xs font-bold"
                  >
                    + Au panier (Urgent)
                  </button>
                )}
                {alert.kind === 'expiry' && (
                  <button className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs font-bold">
                    Voir alternatives
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {renderCompact()}
      {isExpanded && renderFullscreen()}
    </>
  );
});

AlertesWidget.displayName = 'AlertesWidget';