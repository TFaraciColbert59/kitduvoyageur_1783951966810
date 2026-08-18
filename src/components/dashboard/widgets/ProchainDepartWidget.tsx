import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { formatDate, formatDateRange } from '@/src/lib/utils/dateHelpers';
import { daysUntil } from '@/src/lib/utils/dateHelpers';
import { formatWeight } from '@/src/lib/utils/formatters';
import { useToast } from '@/src/components/ui/use-toast';

interface ProchainDepartWidgetProps {
  equipment: Array<any>;
  kits: Array<any>;
  activeHike: any;
  departurePlan: any;
  recommendedKit: any;
  onUpdateEquipment: (updates: any) => Promise<void>;
  onUpdateKit: (kitId: string, updates: any) => Promise<void>;
  onCreateHike: (hikeData: any) => Promise<void>;
  onAssignKitToHike: (hikeId: string, kitId: string) => Promise<void>;
  onClose: () => void;
  isFullscreen: boolean;
  onAgrandir: () => void;
}

export function ProchainDepartWidget({
  equipment,
  kits,
  activeHike,
  departurePlan,
  recommendedKit,
  onUpdateEquipment,
  onUpdateKit,
  onCreateHike,
  onAssignKitToHike,
  onClose,
  isFullscreen,
  onAgrandir
}: ProchainDepartWidgetProps) {
  const { toast } = useToast();
  const [isNewHikeModalOpen, setIsNewHikeModalOpen] = useState(false);

  // Handle missing items
  const missingItems = departurePlan?.missingItems || [];

  // Handle blocking actions
  const blockingActions = [];
  if (missingItems.length > 0) {
    blockingActions.push(...missingItems.map(item => `Manquant : ${item.name}`));
  }
  if (departurePlan?.weightExceedsLimit) {
    blockingActions.push(`Poids du kit trop élevé : ${formatWeight(departurePlan.totalWeightG)}`);
  }

  // Handle kit recommendation
  const kitRecommendation = recommendedKit
    ? `${recommendedKit.name} · score ${departurePlan?.suitabilityScore}/100`
    : 'Kit auto-généré à partir de votre inventaire';

  if (isFullscreen) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Prochain départ</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        {activeHike ? (
          <>
            <div className="space-y-4">
              {/* Départ info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {daysUntil(activeHike.targetDate) !== null && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                      (daysUntil(activeHike.targetDate) ?? 0) < 0
                        ? 'bg-white/10 text-white/50'
                        : 'bg-[#A3C4A3]/20 text-[#A3C4A3]'
                    }`}>
                      {(daysUntil(activeHike.targetDate) ?? 0) < 0
                        ? `Terminée (J+${Math.abs(daysUntil(activeHike.targetDate) ?? 0)})`
                        : `J-${daysUntil(activeHike.targetDate)}`}
                    </span>
                  )}
                  <span className="text-xs text-white/60">{formatDateRange(activeHike)}</span>
                </div>
                <h3 className="text-lg font-extrabold text-white mt-1 leading-tight">{activeHike.name}</h3>
                <p className="text-xs text-white/65">
                  {activeHike.terrain || activeHike.season || 'Randonnée'} · {activeHike.companions || `${activeHike.isOvernight ? 'Nuitée en refuge/bivouac' : 'Sortie à la journée'}`}
                </p>
              </div>

              {/* Kit recommandé */}
              <div className="p-4 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[#A3C4A3] font-bold block">Kit recommandé pour cette sortie</span>
                    {recommendedKit ? (
                      <p className="text-xs text-white/90 font-semibold truncate mt-0.5">
                        {recommendedKit.name} · score {departurePlan?.suitabilityScore}/100
                      </p>
                    ) : (
                      <p className="text-xs text-white/70 mt-0.5">Kit auto-généré à partir de votre inventaire</p>
                    )}
                  </div>
                  {recommendedKit && recommendedKit.id !== (activeHike.kitId || null) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onAssignKitToHike(activeHike.id, recommendedKit.id);
                        toast({ description: `Kit « ${recommendedKit.name} » assigné au départ`, variant: 'default' });
                      }}
                    >
                      Utiliser ce kit
                    </Button>
                  )}
                  {recommendedKit && recommendedKit.id === (activeHike.kitId || null) && (
                    <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] text-white/80 shrink-0">✓ Déjà sélectionné</span>
                  )}
                </div>

                {/* Consommables requis */}
                {departurePlan?.consumables && departurePlan.consumables.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase text-[#A3C4A3] font-block">Consommables requis</span>
                      <span className="text-[9px] text-[#A3C4A3] font-mono">{departurePlan.consumables.length} items</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      {departurePlan.consumables.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <span className="truncate">{item.name}</span>
                          <span className="flex items-center gap-1">
                            {item.owned ? (
                              <span className="text-[#A3C4A3]">✓ Possédé</span>
                            ) : (
                              <span className="text-white/60">✗ À acquérir</span>
                            )}
                            {item.quantity > 1 && (
                              <span className="text-white/50">{item.quantity}x</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Poids estimé */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[10px] font-mono uppercase text-[#A3C4A3] font-bold">Poids estimé du kit</span>
                  <span className="font-mono font-bold text-white">
                    {formatWeight(departurePlan?.totalWeightG || 0)}
                    {departurePlan?.weightExceedsLimit && (
                      <span className="ml-2 text-xs bg-red/20 text-red/80 rounded px-1.5 py-0.5">Limite dépassée</span>
                    )}
                  </span>
                </div>
              </div>

              {/* À ne pas oublier (extrait) */}
              <div className="p-4 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">À ne pas oublier</h3>
                  <span className="text-[9px] text-[#A3C4A3] font-mono font-bold">Voir tous</span>
                </div>
                <div className="space-y-2">
                  {/* Show top 3 dont-forget items */}
                  {departurePlan?.dontForgetItems?.slice(0, 3).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded-xl">
                      <span className="truncate">{item.name}</span>
                      <span className="text-[9px] text-white/60">{item.reason}</span>
                    </div>
                  ))}
                  {departurePlan?.dontForgetItems?.length > 3 && (
                    <div className="text-center text-xs text-white/50 pt-2">
                      Et {departurePlan.dontForgetItems.length - 3} autres éléments...
                    </div>
                  )}
                </div>
              </div>

              {/* Actions bloquantes */}
              {blockingActions.length > 0 && (
                <div className="p-4 rounded-2xl bg-red/10 border border-red/20 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Actions requises</h3>
                    <span className="text-[9px] text-[#F4A18C] font-mono font-bold">{blockingActions.length} blocage{s}</span>
                  </div>
                  <div className="space-y-2">
                    {blockingActions.map((action: string, index: number) => (
                      <div key={index} className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded-xl">
                        <span className="truncate text-white/90">{action}</span>
                        <button
                          onClick={() => {
                            // Handle specific action based on type
                            if (action.startsWith('Manquant : ')) {
                              const itemName = action.substring(11);
                              const missingItem = missingItems.find((mi: any) => mi.name === itemName);
                              if (missingItem) {
                                onUpdateEquipment({
                                  ...missingItem,
                                  owned: true,
                                  purchase_price: 0, // Will be updated when actually purchased
                                  notes: `Ajouté automatiquement pour le départ ${activeHike.name}`
                                });
                                toast({ description: `Article « ${itemName} » marqué comme possédé`, variant: 'default' });
                              }
                            }
                          }}
                          className="text-[9px] text-[#A3C4A3] hover:text-white underline"
                        >
                          Résoudre
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* État de préparation */}
              <div className="p-4 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">État de préparation</h3>
                  <span className="text-[9px] text-[#A3C4A3] font-mono font-bold">
                    {blockingActions.length === 0 ? 'Prêt à partir' : `${blockingActions.length} action(s) requise(s)`}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Kit complet</span>
                    <span className="text-white/60">
                      {departurePlan?.missingItems.length === 0 ? '✓' : `✗ ${departurePlan?.missingItems.length} manquants`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Poids acceptable</span>
                    <span className="text-white/60">
                      {!departurePlan?.weightExceedsLimit ? '✓' : '✗ Limite dépassée'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Consommables prêts</span>
                    <span className="text-white/60">
                      {departurePlan?.consumables.every((c: any) => c.owned) ? '✓' : `✗ ${departurePlan?.consumables.filter((c: any) => !c.owned).length} manquants`}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center space-y-4">
              <span className="text-4xl block">🧭</span>
              <p className="text-sm text-white/75 font-medium">Aucune sortie planifiée pour le moment</p>
              <p className="text-xs text-white/50">Planifiez votre prochaine randonnée pour voir ici le kit recommandé, les articles manquants et les consommables.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsNewHikeModalOpen(true)}
              >
                🧭 Planifier ma première sortie
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compact view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Prochain départ</h3>
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

      {activeHike ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {daysUntil(activeHike.targetDate) !== null && (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                  (daysUntil(activeHike.targetDate) ?? 0) < 0
                    ? 'bg-white/10 text-white/50'
                    : 'bg-[#A3C4A3]/20 text-[#A3C4A3]'
                }`}>
                  {(daysUntil(activeHike.targetDate) ?? 0) < 0
                    ? `T(J+${Math.abs(daysUntil(activeHike.targetDate) ?? 0)})`
                    : `J-${daysUntil(activeHike.targetDate)}`}
                </span>
              )}
              <span className="text-[9px] text-white/60">{formatDate(activeHike.targetDate)}</span>
            </div>
            <h4 className="text-sm font-semibold text-white truncate max-w-[120px]">{activeHike.name}</h4>
          </div>

          <div className="space-y-2">
            {blockingActions.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[9px] text-white/60 font-medium">{blockingActions.length} action{bloquante}</p>
                {blockingActions.slice(0, 2).map((action: string, index: number) => (
                  <div key={index} className="flex items-center justify-between text-[9px]">
                    <span className="truncate max-w-[100px]">{action.length > 20 ? action.substring(0, 17) + '...' : action}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-[#A3C4A3] font-medium">Prêt à partir</p>
            )}
          </div>

          {recommendedKit && (
            <div className="space-y-1 pt-2 border-t border-white/5">
              <p className="text-[9px] text-white/60 font-medium">Kit : {recommendedKit.name}</p>
              <p className="text-[9px] text-white/60">
                {formatWeight(departurePlan?.totalWeightG || 0)} · {departurePlan?.missingItems.length} manquants
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center space-y-2">
          <span className="text-2xl block">🧭</span>
          <p className="text-[9px] text-white/60">Aucune sortie planifiée</p>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsNewHikeModalOpen(true)}
          >
            Planifier
          </Button>
        </div>
      )}
    </div>
  );
}