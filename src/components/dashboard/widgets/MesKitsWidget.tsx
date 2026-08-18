import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { formatWeight } from '@/src/lib/utils/formatters';
import { useToast } from '@/src/components/ui/use-toast';

interface MesKitsWidgetProps {
  equipment: Array<any>;
  kits: Array<any>;
  activeKit: any;
  onUpdateEquipment: (updates: any) => Promise<void>;
  onUpdateKit: (kitId: string, updates: any) => Promise<void>;
  onCreateKit: (kitData: any) => Promise<void>;
  onClose: () => void;
  isFullscreen: boolean;
  onAgrandir: () => void;
}

export function MesKitsWidget({
  equipment,
  kits,
  activeKit,
  onUpdateEquipment,
  onUpdateKit,
  onCreateKit,
  onClose,
  isFullscreen,
  onAgrandir
}: MesKitsWidgetProps) {
  const { toast } = useToast();
  const [isNewKitModalOpen, setIsNewKitModalOpen] = useState(false);
  const [selectedKitForDetail, setSelectedKitForDetail] = useState<any>(null);

  if (isFullscreen) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Mes kits</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Kit selection / creation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Sélection du kit</h3>
              <button
                onClick={() => setIsNewKitModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium"
              >
                + Nouveau kit
              </button>
            </div>

            <div className="space-y-2">
              {kits.length > 0 ? (
                <div className="space-y-2">
                  {kits.map((kit: any) => (
                    <div
                      key={kit.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                        kit.id === (activeKit?.id || null)
                          ? 'bg-white/12 border-[#A3C4A3]/50 text-white font-bold'
                          : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                      }`}
                      onClick={() => setSelectedKitForDetail(kit)}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate">{kit.name}</h4>
                        <p className="text-xs text-white/60">
                          {kit.items.length} articles · {formatWeight(kit.totalWeightG || 0)}
                        </p>
                      </div>
                      <span className="text-[9px] text-[#A3C4A3] font-mono">
                        {kit.id === (activeKit?.id || null) ? 'Actif' : 'Sélectionner'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/50 text-center">
                  Aucun kit créé. Commencez par créer votre premier kit !
                </p>
              )}
            </div>
          </div>

          {/* Kit detail view */}
          {selectedKitForDetail && (
            <div className="p-4 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">
                  {selectedKitForDetail.name}
                </h3>
                <button
                  onClick={() => setSelectedKitForDetail(null)}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* Kit info */}
                <div className="space-y-2">
                  <p className="text-xs text-white/60">
                    {selectedKitForDetail.description || 'Kit sans description'}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span>
                      <strong>{selectedKitForDetail.items.length}</strong> articles
                    </span>
                    <span>
                      <strong>{formatWeight(selectedKitForDetail.totalWeightG || 0)}</strong>
                    </span>
                    <span>
                      <strong>{selectedKitForDetail.totalValue || 0}€</strong>
                    </span>
                  </div>
                </div>

                {/* Items by category */}
                <div className="space-y-3">
                  <h3 className="text-[9px] font-extrabold text-white uppercase tracking-wider mb-2">
                    Contenu du kit
                  </div>
                  {selectedKitForDetail.items.length > 0 ? (
                    <div className="space-y-2">
                      {Object.values(
                        selectedKitForDetail.items.reduce((acc: any, item: any) => {
                          const category = item.category || 'Autre';
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(item);
                          return acc;
                        }, {})
                      ).map((categoryItems: any[], index: number) => {
                        const categoryName = Object.keys(
                          selectedKitForDetail.items.reduce((acc: any, item: any) => {
                            const category = item.category || 'Autre';
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(item);
                            return acc;
                          }, {})
                        )[index];
                        return (
                          <div key={index} className="space-y-1">
                            <h4 className="text-[9px] font-semibold text-[#A3C4A3] uppercase tracking-wider">
                              {categoryName}
                            </h4>
                            <div className="space-y-1">
                              {categoryItems.map((item: any, itemIndex: number) => (
                                <div
                                  key={itemIndex}
                                  className="flex items-center justify-between px-2 py-1 bg-white/3 rounded-xl"
                                >
                                  <span className="truncate max-w-[100px]">
                                    {item.name}{item.brand && ` (${item.brand})`}
                                  </span>
                                  <div className="flex items-center gap-2 text-[9px]">
                                    {item.weight_g && (
                                      <span className="text-white/60">
                                        {item.weight_g}g
                                      </span>
                                    )}
                                    {item.condition === 'neuf' && (
                                      <span className="text-[#A3C4A3]">✓ Neuf</span>
                                    )}
                                    {item.loan_status === 'prêté' && (
                                      <span className="text-white/60">⚠ Prêté</span>
                                    )}
                                    {item.condition === 'abîmé' && (
                                      <span className="text-white/60">⚠ Abîmé</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[9px] text-white/50 text-center py-4">
                      Ce kit ne contient aucun article pour le moment.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end pt-3 border-t border-white/5">
                  <button
                    onClick={() => {
                      // Set as active kit
                      onUpdateKit(selectedKitForDetail.id, { isActive: true });
                      // Deactivate others
                      kits
                        .filter(k => k.id !== selectedKitForDetail.id)
                        .forEach(k => onUpdateKit(k.id, { isActive: false }));
                      setSelectedKitForDetail(null);
                      toast({ description: `Kit « ${selectedKitForDetail.name} » défini comme actif`, variant: 'default' });
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    Définir comme actif
                  </button>
                  <button
                    onClick={() => {
                      // Clone kit
                      onCreateKit({
                        ...selectedKitForDetail,
                        id: undefined,
                        name: `Copie de ${selectedKitForDetail.name}`,
                        isActive: false
                      });
                      setSelectedKitForDetail(null);
                      toast({ description: `Kit dupliqué`, variant: 'default' });
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    Dupliquer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Kit stats */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Statistiques des kits</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-white/60 mb-1">Nombre de kits</p>
                <p className="font-bold text-white">{kits.length}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Articles suivis</p>
                <p className="font-bold text-white">{equipment.length}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Valeur totale</p>
                <p className="font-bold text-white">
                  {kits.reduce((sum, kit) => sum + (kit.totalValue || 0), 0)}€
                </p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Poids moyen</p>
                <p className="font-bold text-white">
                  {formatWeight(
                    kits.reduce((sum, kit) => sum + (kit.totalWeightG || 0), 0) /
                      Math.max(kits.length, 1)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Mes kits</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAgrandir();
          }}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
        >
          <span className="text-[10px]">⤢</span>
        </button>
      </div>

      {kits.length > 0 ? (
        <>
          {activeKit && (
            <div className="space-y-2">
              <p className="text-[9px] text-white/60 font-medium">{activeKit.name}</p>
              <p className="text-[9px] text-white/60">
                {activeKit.items.length} articles · {formatWeight(activeKit.totalWeightG || 0)}
              </p>
              {activeKit.items.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-[9px] text-white/60">
                    {activeKit.items.filter(i => i.owned && !i.needs_maintenance).length}/{activeKit.items.length} prêts
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Kit recommendation based on active hike would go here */}
          {!activeKit && kits.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] text-white/60 font-medium">{kits[0].name}</p>
              <p className="text-[9px] text-white/60">
                {kits[0].items.length} articles · {formatWeight(kits[0].totalWeightG || 0)}
              </p>
            </div>
          )}

          {kits.length === 0 && (
            <div className="text-center space-y-2">
              <span className="text-2xl block">🎒</span>
              <p className="text-[9px] text-white/60">Aucun kit créé</p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsNewKitModalOpen(true)}
              >
                Créer
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center space-y-2">
          <span className="text-2xl block">🎒</span>
          <p className="text-[9px] text-white/60">Aucun kit créé</p>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsNewKitModalOpen(true)}
          >
            Créer
          </Button>
        </div>
      )}
    </div>
  );
}