import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { formatDate } from '@/src/lib/utils/dateHelpers';
import { daysUntil } from '@/src/lib/utils/dateHelpers';
import { useToast } from '@/src/components/ui/use-toast';

interface DontForgetWidgetProps {
  equipment: Array<any>;
  activeHike: any;
  departurePlan: any;
  onUpdateEquipment: (updates: any) => Promise<void>;
  onClose: () => void;
  isFullscreen: boolean;
  onAgrandir: () => void;
}

export function DontForgetWidget({
  equipment,
  activeHike,
  departurePlan,
  onUpdateEquipment,
  onClose,
  isFullscreen,
  onAgrandir
}: DontForgetWidgetProps) {
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  // Get dont-forget items from departure plan or generate based on hike context
  const dontForgetItems = departurePlan?.dontForgetItems || [];

  // Generate contextual dont-forget items if not provided
  const contextualItems = [];
  if (activeHike) {
    // Weather-based items
    if (activeHike.weather?.includes('rain') || activeHike.season === 'automne' || activeHike.season === 'hiver') {
      contextualItems.push({
        id: 'rain-gear',
        name: 'Vêtements de pluie',
        reason: 'Précipitations prévues ou saison humide',
        owned: equipment.some(item =>
          item.name.toLowerCase().includes('rain') ||
          item.name.toLowerCase().includes('imperméable') ||
          item.category === 'vêtements' && item.name.toLowerCase().includes('poncho')
        )
      });
    }

    // Cold weather items
    if (activeHike.season === 'hiver' || (activeHike.altitude_max || 0) > 2000) {
      contextualItems.push({
        id: 'warm-gear',
        name: 'Vêtements chauds supplémentaires',
        reason: 'Températures basses attendues ou altitude élevée',
        owned: equipment.some(item =>
          item.name.toLowerCase().includes('fleece') ||
          item.name.toLowerCase().includes('down') ||
          item.name.toLowerCase().includes('duvet') ||
          item.category === 'vêtements' && item.name.toLowerCase().includes('chaud')
        )
      });
    }

    // Navigation items
    contextualItems.push({
      id: 'navigation',
      name: 'Carte et boussole/GPS',
      reason: 'Navigation essentielle en milieu isolé',
      owned: equipment.some(item =>
        item.category === 'orientation' ||
        item.name.toLowerCase().includes('gps') ||
        item.name.toLowerCase().includes('carte') ||
        item.name.toLowerCase().includes('boussole')
      )
    });

    // Emergency items
    contextualItems.push({
      id: 'emergency',
      name: 'Trousse de premiers secours complète',
      reason: 'Sécurité en cas de blessure ou d\'urgence',
      owned: equipment.some(item =>
        item.category === 'secours' ||
        item.name.toLowerCase().includes('secours') ||
        item.name.toLowerCase().includes('first aid') ||
        item.name.toLowerCase().includes('urgence')
      )
    });

    // Hydration/nutrition
    contextualItems.push({
      id: 'hydration',
      name: 'Système d\'hydratation ou bouteilles',
      reason: 'Hydratation critique pour l\'effort physique',
      owned: equipment.some(item =>
        item.name.toLowerCase().includes('hydrat') ||
        item.name.toLowerCase().includes('bouteille') ||
        item.name.toLowerCase().includes('gourde') ||
        item.category === 'eau'
      )
    });

    contextualItems.push({
      id: 'nutrition',
      name: 'Rations de secours énergétiques',
      reason: 'Apport énergétique en cas de prolongation de la sortie',
      owned: equipment.some(item =>
        item.name.toLowerCase().includes('barre') ||
        item.name.toLowerCase().includes('énergétique') ||
        item.name.toLowerCase().includes('secours') ||
        item.category === 'nutrition'
      )
    });

    // Lighting
    contextualItems.push({
      id: 'lighting',
      name: 'Éclairage de secours',
      reason: 'Visibilité en cas de retard ou de bivouac imprévu',
      owned: equipment.some(item =>
        item.name.toLowerCase().includes('lampe') ||
        item.name.toLowerCase().includes('frontale') ||
        item.name.toLowerCase().includes('torche') ||
        item.category === 'éclairage'
      )
    });
  }

  // Combine and deduplicate items
  const allItems = [...dontForgetItems, ...contextualItems];
  const uniqueItems = Array.from(
    new Map(allItems.map(item => [item.id, item])).values()
  );

  if (isFullscreen) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">À ne pas oublier</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Add new item form */}
          {isAddingItem && (
            <div className="p-4 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Ajouter un rappel</h3>
                <button
                  onClick={() => {
                    setIsAddingItem(false);
                    setNewItemName('');
                  }}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newItemName.trim()) {
                    // Add to equipment as a reminder item
                    onUpdateEquipment({
                      name: newItemName,
                      category: 'rappel',
                      weight_g: 0,
                      purchase_price: 0,
                      notes: `Rappel ajouté le ${new Date().toLocaleDateString()}`,
                      owned: true
                    });
                    setIsAddingItem(false);
                    setNewItemName('');
                    toast({ description: `Rappel « ${newItemName} » ajouté`, variant: 'default' });
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs text-white/60 mb-1">Nom du rappel</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Ex: Vérifier les batteries de la lampe"
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    // Form submission handled above
                  }}
                  disabled={!newItemName.trim()}
                >
                  Ajouter le rappel
                </Button>
              </form>
            </div>
          )}

          {/* Items list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">
                Rappels contextuels ({uniqueItems.length})
              </h3>
              {uniqueItems.length > 0 && (
                <button
                  onClick={() => setIsAddingItem(true)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium"
                >
                  + Ajouter
                </button>
              )}
            </div>

            {uniqueItems.length > 0 ? (
              <div className="space-y-2">
                {uniqueItems.map((item: any, index: number) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                      item.owned
                        ? 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                        : 'bg-white/3 border-white/6 text-white/60'
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-sm font-semibold truncate">{item.name}</h4>
                      <p className="text-xs text-white/60">{item.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      {item.owned ? (
                        <span className="text-[#A3C4A3]">✓ Possédé</span>
                      ) : (
                        <span className="text-white/60">✗ À prévoir</span>
                      )}
                      {!item.owned && (
                        <button
                          onClick={() => {
                            // Mark as owned or add to equipment
                            onUpdateEquipment({
                              name: item.name,
                              category: item.category || 'Autre',
                              weight_g: 0,
                              purchase_price: 0,
                              notes: `Ajouté depuis les rappels le ${new Date().toLocaleDateString()}`,
                              owned: true
                            });
                            toast({ description: `Article « ${item.name} » marqué comme possédé`, variant: 'default' });
                          }}
                          className="text-[9px] text-[#A3C4A3] hover:text-white underline px-2 py-0.5 rounded"
                        >
                          Marquer comme possédé
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-white/50 text-center py-6">
                Aucun rappel contextuel pour le moment.
              </p>
            )}
          </div>

          {/* Statistics */}
          <div className="p-4 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25">
            <div className="space-y-3">
              <h3 className="text-[9px] font-extrabold text-white uppercase tracking-wider mb-2">Statistiques</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-white/60 mb-1">Rappels prévus</p>
                  <p className="font-bold text-white">{uniqueItems.length}</p>
                </div>
                <div>
                  <p className="text-white/60 mb-1">Rappels prêts</p>
                  <p className="font-bold text-white">
                    {uniqueItems.filter(item => item.owned).length}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 mb-1">À prévoir</p>
                  <p className="font-bold text-white">
                    {uniqueItems.filter(item => !item.owned).length}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 mb-1">Taux de préparation</p>
                  <p className="font-bold text-white">
                    {uniqueItems.length > 0
                      ? `${Math.round((uniqueItems.filter(item => item.owned).length / uniqueItems.length) * 100)}%`
                      : '0%'}
                  </p>
                </div>
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
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">À ne pas oublier</h3>
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
            <p className="text-[9px] text-white/60 font-medium">
              {uniqueItems.filter(item => !item.owned).length} élément{s} à prévoir
            </p>
            {uniqueItems.filter(item => !item.owned).length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="space-y-1">
                  {uniqueItems
                    .filter(item => !item.owned)
                    .slice(0, 2)
                    .map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-[9px]">
                        <span className="truncate max-w-[100px]">
                          {item.name.length > 15 ? item.name.substring(0, 12) + '...' : item.name}
                        </span>
                        <span className="text-white/60">{item.reason.substring(0, 10)}...</span>
                      </div>
                    ))}
                </div>
                {uniqueItems.filter(item => !item.owned).length > 2 && (
                  <p className="text-center text-xs text-white/50 pt-1">
                    Et {uniqueItems.filter(item => !item.owned).length - 2} autres...
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/5">
            <p className="text-[9px] text-white/60 text-center">
              {uniqueItems.length > 0
                ? `${Math.round((uniqueItems.filter(item => item.owned).length / uniqueItems.length) * 100)}% prêt`
                : 'Aucun rappel'}
            </p>
          </div>
        </>
      ) : (
        <div className="text-center space-y-3">
          <span className="text-2xl block">📋</span>
          <p className="text-[9px] text-white/60">Planifiez une sortie pour voir les rappels contextuels</p>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              // This would open hike planning in a real implementation
              toast({ description: 'Planification de sortie à implémenter', variant: 'default' });
            }}
          >
            Planifier
          </Button>
        </div>
      )}
    </div>
  );
}