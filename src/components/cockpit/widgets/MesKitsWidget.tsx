/* =============================================================================
   LKDV — Widget Mes Kits (Large/Hero)
   =============================================================================
   Card compacte : kit recommandé + état | Fullscreen : répertoire complet + produits par catégorie
   ============================================================================= */

import React, { memo } from 'react';
import { CustomKit } from '@/hooks/useUserKits';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { formatWeight } from '@/app/mon-materiel/page';

interface MesKitsWidgetProps {
  kits: CustomKit[];
  activeKit: CustomKit | null;
  activeHike: any; // PlannedHike
  equipment: UserEquipmentItem[];
  selectedKitInFullscreen: string | null;
  onSetSelectedKitInFullscreen: (kitId: string) => void;
  onOpenKitDrawer: () => void;
  onCreateKit: () => void;
  onAssignKitToDeparture: (kit: CustomKit) => void;
  onExpand: () => void;
  isExpanded: boolean;
  cardRef: React.RefObject<HTMLDivElement>;
  headerRef: React.RefObject<HTMLDivElement>;
  layoutId: string;
  headerLayoutId: string;
}

export const MesKitsWidget = memo(function MesKitsWidget({
  kits,
  activeKit,
  activeHike,
  equipment,
  selectedKitInFullscreen,
  onSetSelectedKitInFullscreen,
  onOpenKitDrawer,
  onCreateKit,
  onAssignKitToDeparture,
  onExpand,
  isExpanded,
  cardRef,
  headerRef,
  layoutId,
  headerLayoutId,
}: MesKitsWidgetProps) {
  // Calculer l'état de préparation du kit actif
  const getKitReadiness = (kit: CustomKit) => {
    const kitItems = kit.items || [];
    if (kitItems.length === 0) return { pct: 100, owned: 0, total: 0, missing: [] as any[] };

    let owned = 0;
    const missing: any[] = [];
    kitItems.forEach(ki => {
      const isOwned = equipment.some(e =>
        (ki.gear_item_id && e.id === ki.gear_item_id) ||
        e.name.toLowerCase() === ki.item_name.toLowerCase()
      );
      if (isOwned) owned++;
      else missing.push(ki);
    });
    return {
      pct: Math.round((owned / kitItems.length) * 100),
      owned,
      total: kitItems.length,
      missing,
    };
  };

  const activeKitReadiness = activeKit ? getKitReadiness(activeKit) : null;
  const isKitAssignedToDeparture = activeHike?.assignedKitId === activeKit?.id;

  // --- RENDU COMPACT ---
  const renderCompact = () => (
    <div className="flex flex-col h-full text-white justify-between">
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
            Mes Kits
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#17402C] text-[#A3C4A3] font-bold">
            {kits.length} kit{kits.length > 1 ? 's' : ''}
          </span>
        </div>

        {activeKit && (
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 mb-3">
            <div className="flex justify-between items-baseline mb-1">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-base truncate max-w-[140px] text-white">
                  {activeKit.name}
                </h4>
                {isKitAssignedToDeparture && (
                  <span className="px-2 py-0.5 rounded-full bg-[#A3C4A3] text-[#0B1F17] text-[10px] font-bold">
                    Départ actif
                  </span>
                )}
              </div>
              <span className="text-lg font-black text-[#A3C4A3]">
                {formatWeight(activeKit.total_weight_g || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-white/60">
              <span>{activeKit.items?.length || 0} équipements</span>
              <span>{activeKit.season || '3 saisons'}</span>
              <span className={`font-bold ${activeKitReadiness?.pct === 100 ? 'text-[#A3C4A3]' : activeKitReadiness && activeKitReadiness.pct >= 70 ? 'text-[#E9C46A]' : 'text-[#E76F51]'}`}>
                {activeKitReadiness ? `${activeKitReadiness.pct}% prêt` : '—'}
              </span>
            </div>
          </div>
        )}

        {!activeKit && kits.length === 0 && (
          <div className="text-center py-6 text-white/50">
            <span className="text-3xl block mb-2">🎒</span>
            <p className="text-sm">Aucun kit créé</p>
          </div>
        )}

        {/* Aperçu kit secondaire */}
        {kits.length > 1 && activeKit && (
          <div className="space-y-1.5 mt-2">
            {kits.filter(k => k.id !== activeKit.id).slice(0, 2).map(k => {
              const readiness = getKitReadiness(k);
              return (
                <div key={k.id} className="flex justify-between items-center px-2.5 py-1.5 bg-black/20 rounded-xl text-xs text-white/70">
                  <span className="truncate max-w-[130px] font-medium">{k.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#A3C4A3]">{formatWeight(k.total_weight_g || 0)}</span>
                    <span className={`text-[10px] ${readiness.pct === 100 ? 'text-[#A3C4A3]' : readiness.pct >= 70 ? 'text-[#E9C46A]' : 'text-[#E76F51]'}`}>
                      {readiness.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-white/5 space-y-2">
        <button
          onClick={onOpenKitDrawer}
          className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors text-center"
        >
          Ouvrir le Studio Kits
        </button>
        {kits.length === 0 && (
          <button
            onClick={onCreateKit}
            className="w-full py-2 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5] rounded-xl text-xs font-bold transition-colors text-center"
          >
            + Créer mon premier kit
          </button>
        )}
      </div>
    </div>
  );

  // --- RENDU FULLSCREEN ---
  const renderFullscreen = () => (
    <div className="space-y-6 pt-2">
      {/* Header avec création kit */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">Tous mes kits de randonnée ({kits.length})</h3>
        <button
          onClick={onCreateKit}
          className="px-4 py-2 bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs rounded-xl"
        >
          + Créer un nouveau kit
        </button>
      </div>

      {/* Grille des kits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kits.map(k => {
          const isSelected = selectedKitInFullscreen === k.id;
          const isAssigned = activeHike?.assignedKitId === k.id;
          const readiness = getKitReadiness(k);

          return (
            <div
              key={k.id}
              onClick={() => onSetSelectedKitInFullscreen(k.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between min-h-[180px] ${
                isSelected
                  ? 'bg-[#17402C]/60 border-[#A3C4A3]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-extrabold text-base text-white">{k.name}</span>
                  {isAssigned && (
                    <span className="px-2 py-0.5 rounded-full bg-[#A3C4A3] text-[#0B1F17] text-[10px] font-bold">
                      Départ actif
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/60 mb-3">{k.description || 'Kit configuré pour l\'aventure'}</p>
              </div>

              <div className="flex justify-between items-end pt-3 border-t border-white/10">
                <div>
                  <span className="text-[10px] text-white/40 block uppercase">Poids du kit</span>
                  <span className="text-xl font-black text-[#A3C4A3]">{formatWeight(k.total_weight_g || 0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-white/70 font-semibold">{k.items?.length || 0} items</span>
                  <span className={`text-[10px] ml-1 ${readiness.pct === 100 ? 'text-[#A3C4A3]' : readiness.pct >= 70 ? 'text-[#E9C46A]' : 'text-[#E76F51]'}`}>
                    {readiness.pct}% prêt
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Détail du kit sélectionné */}
      {selectedKitInFullscreen && (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mt-6">
          {(() => {
            const targetKit = kits.find(k => k.id === selectedKitInFullscreen);
            if (!targetKit) return null;

            // Organiser les items par catégorie
            const itemsByCategory = (targetKit.items || []).reduce((acc, item) => {
              const cat = item.category || 'Autre';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(item);
              return acc;
            }, {} as Record<string, typeof targetKit.items>);

            return (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="font-bold text-lg text-white">{targetKit.name} — Contenu détaillé</h4>
                    <p className="text-xs text-white/60">Poids total : {formatWeight(targetKit.total_weight_g || 0)}</p>
                  </div>
                  <div className="flex gap-2">
                    {activeHike && (
                      <button
                        onClick={() => onAssignKitToDeparture(targetKit)}
                        className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs rounded-lg"
                      >
                        Assigner au départ
                      </button>
                    )}
                  </div>
                </div>

                {targetKit.items && targetKit.items.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(itemsByCategory).map(([category, items]) => (
                      <div key={category}>
                        <h5 className="font-bold text-xs uppercase tracking-wider text-[#A3C4A3] mb-2">{category}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {items.map(item => {
                            // Chercher dans l'équipement possédé
                            const ownedItem = equipment.find(e =>
                              (item.gear_item_id && e.id === item.gear_item_id) ||
                              e.name.toLowerCase() === item.item_name.toLowerCase()
                            );
                            const isOwned = !!ownedItem;
                            const isAvailable = isOwned && ownedItem!.loan_status !== 'prêté' && ownedItem!.condition !== 'a_remplacer';

                            return (
                              <div key={item.id} className="p-3 bg-black/30 rounded-xl border border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-[#A3C4A3]' : isOwned ? 'bg-[#E9C46A]' : 'bg-white/30'}`} />
                                  <div>
                                    <span className="font-bold text-xs text-white">{item.item_name}</span>
                                    <span className="text-[10px] text-white/50 block">{formatWeight(item.weight_g)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isOwned ? (
                                    <>
                                      {ownedItem!.loan_status === 'prêté' && (
                                        <span className="px-2 py-0.5 rounded bg-[#E9C46A]/20 text-[#E9C46A] text-[10px] font-bold">Prêté</span>
                                      )}
                                      {ownedItem!.condition === 'a_remplacer' && (
                                        <span className="px-2 py-0.5 rounded bg-[#E76F51]/20 text-[#E76F51] text-[10px] font-bold">À remplacer</span>
                                      )}
                                      {ownedItem!.condition === 'en_reparation' && (
                                        <span className="px-2 py-0.5 rounded bg-[#6BA3D6]/20 text-[#6BA3D6] text-[10px] font-bold">En réparation</span>
                                      )}
                                      {isAvailable && (
                                        <span className="px-2 py-0.5 rounded bg-[#A3C4A3]/20 text-[#A3C4A3] text-[10px] font-bold">Prêt</span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">Manquant</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/50 text-center py-6">Ce kit ne contient aucun équipement pour l'instant.</p>
                )}
              </div>
            );
          })()}
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

MesKitsWidget.displayName = 'MesKitsWidget';