/* =============================================================================
   LKDV — Widget À ne pas oublier (Large/Hero) - Checklist Proactive Intelligente
   =============================================================================
   Card compacte : 2-3 actions critiques | Fullscreen : checklist catégorisée priorisée
   Sources : inventaire + départ + météo + règles Obsidian + SmartDepartureEngine
   ============================================================================= */

import React, { memo, useMemo } from 'react';
import { PlannedHike } from '@/lib/preparation/plannedHikes';
import { DeparturePreparationPlan } from '@/lib/preparation/SmartDepartureEngine';
import { CustomKit } from '@/hooks/useUserKits';
import { UserEquipmentItem, UnifiedProduct, FALLBACK_AUTHENTIC_PRODUCTS } from '@/hooks/useEquipment';
import { UnifiedProductState } from '@/types/product';

interface OublierWidgetProps {
  activeHike: PlannedHike | null;
  activeKit: CustomKit | null;
  kits: CustomKit[];
  departurePlan: DeparturePreparationPlan | null;
  hikeReadiness: { missingItems: any[] };
  equipment: UserEquipmentItem[];
  productStates: UnifiedProductState[];
  catalogProducts: UnifiedProduct[];
  alerts: any[];
  checkedOublis: Record<string, boolean>;
  onToggleCheck: (id: string) => void;
  onExpand: () => void;
  onCloseExpanded: () => void;
  onAddToCart: (product: any) => void;
  onAddToEquipment: (product: any) => void;
  isExpanded: boolean;
  cardRef: HTMLDivElement | null;
  headerRef: HTMLDivElement | null;
  layoutId: string;
  headerLayoutId: string;
}

// Types locaux pour la checklist
interface ChecklistItem {
  id: string;
  label: string;
  category: 'sécurité' | 'consommable' | 'météo' | 'oubli' | 'document' | 'confort';
  reason: string;
  critical: boolean;
  actionType?: 'cart' | 'gear' | 'check';
  productSuggestion?: UnifiedProduct;
}

export const OublierWidget = memo(function OublierWidget({
  activeHike,
  activeKit,
  kits,
  departurePlan,
  hikeReadiness,
  equipment,
  catalogProducts,
  alerts,
  checkedOublis,
  onToggleCheck,
  onExpand,
  onCloseExpanded,
  onAddToCart,
  onAddToEquipment,
  isExpanded,
  cardRef,
  headerRef,
  layoutId,
  headerLayoutId,
}: OublierWidgetProps) {
  // Générer la checklist proactive (même logique que page.tsx mais extraite)
  const proactiveList = useMemo((): ChecklistItem[] => {
    const list: ChecklistItem[] = [];

    // 1. Équipements manquants du kit actif
    hikeReadiness.missingItems.forEach(mi => {
      const matchedProd = (catalogProducts || FALLBACK_AUTHENTIC_PRODUCTS).find(
        p => p.name.toLowerCase().includes(mi.item_name.toLowerCase()) || mi.item_name.toLowerCase().includes(p.name.toLowerCase())
      );
      list.push({
        id: `missing-kit-${mi.id}`,
        label: `${mi.item_name} (Manquant du kit)`,
        category: 'sécurité',
        reason: `Indispensable pour le kit "${activeKit?.name}"`,
        critical: true,
        actionType: 'cart',
        productSuggestion: matchedProd,
      });
    });

    // 2. Consommables SmartDepartureEngine
    if (departurePlan) {
      if (departurePlan.consumables.fuelGrams > 0) {
        list.push({
          id: 'gas-refill',
          label: `Cartouche de gaz (~${departurePlan.consumables.fuelGrams}g requis)`,
          category: 'consommable',
          reason: `Calculé pour ${departurePlan.consumables.foodMealsCount} repas chauds`,
          critical: true,
        });
      }
      if (departurePlan.consumables.waterLiters > 0) {
        list.push({
          id: 'water-stock',
          label: `Autonomie en eau : ${departurePlan.consumables.waterLiters}L`,
          category: 'consommable',
          reason: departurePlan.consumables.waterReason,
          critical: true,
        });
      }
      if (departurePlan.consumables.rainProtectionNeeded) {
        list.push({
          id: 'rain-shield',
          label: 'Veste imperméable / Cape de pluie',
          category: 'météo',
          reason: 'Risque d\'intempéries signalé sur le parcours',
          critical: true,
        });
      }
      if (departurePlan.consumables.sunProtectionNeeded) {
        list.push({
          id: 'sun-shield',
          label: 'Crème solaire & Lunettes cat. 3/4',
          category: 'météo',
          reason: 'Indice UV élevé / haute altitude',
          critical: false,
        });
      }
    }

    // 3. Alertes critiques → rappels
    alerts.forEach(a => {
      if (a.kind === 'expiry') {
        list.push({
          id: `alert-exp-${a.item.id}`,
          label: `Vérifier péremption : ${a.item.name}`,
          category: 'sécurité',
          reason: 'Date limite dépassée ou imminente',
          critical: true,
        });
      } else if (a.kind === 'loan') {
        list.push({
          id: `alert-loan-${a.item.id}`,
          label: `Récupérer prêt : ${a.item.name}`,
          category: 'oubli',
          reason: `Actuellement chez ${a.item.loan_to_name || 'un ami'}`,
          critical: false,
        });
      } else if (a.kind === 'maintenance') {
        list.push({
          id: `alert-maint-${a.item.id}`,
          label: `Entretien : ${a.item.name}`,
          category: 'sécurité',
          reason: 'Ré-imperméabilisation / révision requise',
          critical: true,
        });
      }
    });

    // 4. Oublis fréquents (toujours présents)
    list.push(
      { id: 'charge-powerbank', label: 'Recharger lampe frontale & batterie externe', category: 'oubli', reason: 'Autonomie électrique sur le sentier', critical: false },
      { id: 'ign-map', label: 'Carte IGN papier & boussole de secours', category: 'sécurité', reason: 'Sécurité en cas de panne de batterie smartphone/GPS', critical: false },
      { id: 'waterproof-bag', label: 'Sacs étanches pour vêtements & duvet', category: 'oubli', reason: 'Protection absolue contre l\'humidité', critical: false },
      { id: 'cash-id', label: 'Pièce d\'identité & espèces (refuges)', category: 'document', reason: 'Nombreux refuges sans terminal carte bancaire', critical: false },
      { id: 'first-aid', label: 'Trousse de secours complète', category: 'sécurité', reason: 'Indispensable pour toute sortie', critical: true },
      { id: 'headlamp', label: 'Lampe frontale + piles de rechange', category: 'sécurité', reason: 'Visibilité nocturne / bivouac', critical: true },
      { id: 'knife', label: 'Couteau / multi-outil', category: 'confort', reason: 'Utile au quotidien en randonnée', critical: false },
      { id: 'trash-bags', label: 'Sacs à déchets (Leave No Trace)', category: 'confort', reason: 'Respect de l\'environnement', critical: false },
    );

    return list;
  }, [activeHike, activeKit, departurePlan, hikeReadiness, alerts, equipment, catalogProducts]);

  const uncheckedCount = proactiveList.filter(p => !checkedOublis[p.id]).length;
  const criticalUnchecked = proactiveList.filter(p => p.critical && !checkedOublis[p.id]).length;

  // --- RENDU COMPACT ---
  const renderCompact = () => (
    <div className="flex flex-col h-full text-white">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${criticalUnchecked > 0 ? 'text-[#E76F51] drop-shadow-[0_0_12px_rgba(231,111,81,0.5)]' : 'text-[#E9C46A] drop-shadow-[0_0_12px_rgba(233,196,106,0.3)]'}`}>
            {uncheckedCount}
          </span>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/70 block">
              À ne pas oublier
            </span>
            <span className="text-[10px] text-white/50">
              {proactiveList.length - uncheckedCount}/{proactiveList.length} vérifiés
            </span>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E9C46A]/20 text-[#E9C46A] border border-[#E9C46A]/30">
          Checklist Départ
        </span>
      </div>

      {/* Liste compacte - 3 items max */}
      <div className="space-y-2 flex-1 overflow-hidden">
        {proactiveList.slice(0, 3).map((item) => {
          const isChecked = !!checkedOublis[item.id];
          return (
            <div
              key={item.id}
              onClick={() => onToggleCheck(item.id)}
              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition-all ${
                isChecked
                  ? 'bg-white/5 border-white/5 opacity-50'
                  : item.critical
                  ? 'bg-[#E76F51]/10 border-[#E76F51]/30'
                  : 'bg-black/30 border-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="w-4 h-4 rounded accent-[#A3C4A3] pointer-events-none"
                />
                <div className="truncate">
                  <span className={`text-xs font-semibold block truncate ${isChecked ? 'line-through text-white/50' : item.critical ? 'text-[#E76F51]' : 'text-white'}`}>
                    {item.label}
                  </span>
                  <span className="text-[10px] text-white/50 truncate block">{item.reason}</span>
                </div>
              </div>
              {item.actionType === 'cart' && item.productSuggestion && !isChecked && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddToCart(item.productSuggestion); }}
                  className="px-2 py-1 bg-[#A3C4A3] text-[#0B1F17] rounded text-[10px] font-bold shrink-0"
                >
                  + Panier
                </button>
              )}
            </div>
          );
        })}
      </div>

      {proactiveList.length > 3 && !isExpanded && (
        <p className="text-[11px] text-white/40 text-center mt-2">
          +{proactiveList.length - 3} points de contrôle (agrandir)
        </p>
      )}
    </div>
  );

  // --- RENDU FULLSCREEN : Checklist Intelligente catégorisée ---
  const renderFullscreen = () => {
    // Grouper par catégorie avec priorité
    const categories = [
      { key: 'sécurité', label: '🔴 Sécurité & Indispensable', color: '#E76F51' },
      { key: 'consommable', label: '🟡 Consommables & Approvisionnement', color: '#E9C46A' },
      { key: 'météo', label: '🔵 Météo & Conditions', color: '#6BA3D6' },
      { key: 'oubli', label: '🟣 Oublis Fréquents', color: '#C77DFF' },
      { key: 'document', label: '🟢 Documents & Logistique', color: '#A3C4A3' },
      { key: 'confort', label: '⚪ Confort & Optionnel', color: '#888' },
    ];

    return (
      <div className="space-y-6 pt-2">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">Checklist d'Expédition Complète</h3>
            <p className="text-xs text-white/60">Cochez les éléments au fur et à mesure que vous préparez votre sac.</p>
          </div>
          <button
            onClick={() => {
              // TODO: reset checklist
            }}
            className="text-xs text-white/60 hover:text-white underline"
          >
            Tout décocher
          </button>
        </div>

        {categories.map(cat => {
          const items = proactiveList.filter(p => p.category === cat.key);
          if (items.length === 0) return null;

          const uncheckedInCat = items.filter(p => !checkedOublis[p.id]).length;

          return (
            <div key={cat.key} className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span style={{ color: cat.color }}>●</span>
                  {cat.label}
                  {uncheckedInCat > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/70">
                      {uncheckedInCat} restant{uncheckedInCat > 1 ? 's' : ''}
                    </span>
                  )}
                </h4>
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const isChecked = !!checkedOublis[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isChecked
                          ? 'bg-white/5 border-white/5 opacity-50'
                          : item.critical
                          ? 'bg-white/10 border-white/10'
                          : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div
                        onClick={() => onToggleCheck(item.id)}
                        className="flex items-center gap-3 cursor-pointer flex-1"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-5 h-5 rounded accent-[#A3C4A3] pointer-events-none"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isChecked ? 'line-through text-white/50' : item.critical ? 'text-[#E76F51]' : 'text-white'}`}>
                              {item.label}
                            </span>
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                              {item.category}
                            </span>
                            {item.critical && (
                              <span className="px-1.5 py-0.5 rounded bg-[#E76F51]/20 text-[#E76F51] text-[9px] font-bold">
                                CRITIQUE
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-white/50 block">{item.reason}</span>
                        </div>
                      </div>

                      {item.actionType === 'cart' && item.productSuggestion && !isChecked && (
                        <button
                          onClick={() => onAddToCart(item.productSuggestion)}
                          className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs rounded-lg shrink-0"
                        >
                          + Panier
                        </button>
                      )}

                      {item.actionType === 'gear' && !isChecked && (
                        <button
                          onClick={() => onAddToEquipment({ name: item.label })}
                          className="px-3 py-1.5 bg-white/10 text-white font-bold text-xs rounded-lg shrink-0"
                        >
                          + Inventaire
                        </button>
                      )}

                      {!item.actionType && !isChecked && (
                        <button
                          onClick={() => onToggleCheck(item.id)}
                          className="px-3 py-1.5 bg-white/10 text-white font-bold text-xs rounded-lg shrink-0"
                        >
                          Marquer OK
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {renderCompact()}
      {isExpanded && renderFullscreen()}
    </>
  );
});

OublierWidget.displayName = 'OublierWidget';






