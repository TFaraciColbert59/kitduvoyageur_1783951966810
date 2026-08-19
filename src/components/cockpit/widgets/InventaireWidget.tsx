/* =============================================================================
   LKDV — Widget Inventaire & Catalogue (Large/Hero)
   =============================================================================
   Card compacte : synthèse inventaire | Fullscreen : répertoire complet 9 catégories
   États produit : Possédé/Prêté/Abîmé/En réparation/En entretien/Perdu/Non possédé/En attente/Commandé/à réceptionner/Alternative
   Parcours achat : Ajouter à l'inventaire → Panier → Commande → Réception → Produit possédé auto
   ============================================================================= */

import React, { memo, useMemo } from 'react';
import { UserEquipmentItem, UnifiedProduct, FALLBACK_AUTHENTIC_PRODUCTS } from '@/hooks/useEquipment';
import { EQUIPMENT_CATEGORIES, EquipmentCategory, UnifiedProductState } from '@/types/product';

interface InventaireWidgetProps {
  equipment: UserEquipmentItem[];
  productStates: UnifiedProductState[];
  catalogProducts: UnifiedProduct[];
  selectedCategoryTab: string;
  setSelectedCategoryTab: (cat: string) => void;
  gearSearchQuery: string;
  setGearSearchQuery: (q: string) => void;
  gearPossessionFilter: 'all' | 'owned' | 'catalog';
  setGearPossessionFilter: (f: 'all' | 'owned' | 'catalog') => void;
  onOpenAddModal: () => void;
  onAddToEquipment: (product: any, condition?: any) => void;
  onAddToCart: (product: any) => void;
  onOpenLendModal: (item: UserEquipmentItem) => void;
  onOpenEditModal: (item: UserEquipmentItem) => void;
  onExpand: () => void;
  onCloseExpanded: () => void;
  isExpanded: boolean;
  cardRef: HTMLDivElement | null;
  headerRef: HTMLDivElement | null;
  layoutId: string;
  headerLayoutId: string;
}

const ALL_CATEGORIES = ['Tous', ...EQUIPMENT_CATEGORIES];

export const InventaireWidget = memo(function InventaireWidget({
  equipment,
  catalogProducts,
  selectedCategoryTab,
  setSelectedCategoryTab,
  gearSearchQuery,
  setGearSearchQuery,
  gearPossessionFilter,
  setGearPossessionFilter,
  onOpenAddModal,
  onAddToEquipment,
  onAddToCart,
  onOpenLendModal,
  onOpenEditModal,
  onExpand,
  onCloseExpanded,
  isExpanded,
  cardRef,
  headerRef,
  layoutId,
  headerLayoutId,
}: InventaireWidgetProps) {
  const totalWeight = equipment.reduce((sum, item) => sum + (item.weight_g || 0), 0);
  const ownedCount = equipment.length;
  const missingEssentialCount = 0; // TODO: calculer basé sur catégories essentielles

  // --- RENDU COMPACT ---
  const renderCompact = () => (
    <div className="flex flex-col h-full text-white justify-between">
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
            Inventaire & Catalogue
          </span>
          <span className="text-xs text-[#A3C4A3] font-bold">
            {ownedCount} possédés · {catalogProducts?.length || 0} catalogue
          </span>
        </div>

        {/* Stats clés */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
            <span className="text-xl font-black text-white">{ownedCount}</span>
            <span className="text-[10px] text-white/50 block">Possédés</span>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
            <span className="text-xl font-black text-[#A3C4A3]">{formatWeight(totalWeight)}</span>
            <span className="text-[10px] text-white/50 block">Poids total</span>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
            <span className="text-xl font-black text-[#E9C46A]">{missingEssentialCount || '—'}</span>
            <span className="text-[10px] text-white/50 block">à compléter</span>
          </div>
        </div>

        {/* Top catégories */}
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_CATEGORIES.slice(0, 4).map(cat => {
            const count = equipment.filter(e =>
              (e.category || '').toLowerCase().includes(cat.toLowerCase().split(' & ')[0].toLowerCase())
            ).length;
            return (
              <div key={cat} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] flex items-center gap-1">
                <span className="text-white/70">{cat.split(' & ')[0]}</span>
                <span className="text-[#A3C4A3] font-black">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-2 border-t border-white/5">
        <button
          onClick={onOpenAddModal}
          className="flex-1 py-1.5 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5] rounded-xl text-xs font-bold transition-colors text-center"
        >
          + Ajouter équipement
        </button>
        <button
          onClick={onExpand}
          className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors text-center"
        >
          Catalogue complet
        </button>
      </div>
    </div>
  );

  // --- FILTRAGE PRODUITS ---
  const filteredOwned = useMemo(() => {
    return equipment
      .filter(e => selectedCategoryTab === 'Tous' || (e.category || '').toLowerCase().includes(selectedCategoryTab.toLowerCase().split(' & ')[0]))
      .filter(e => !gearSearchQuery || e.name.toLowerCase().includes(gearSearchQuery.toLowerCase()) || (e.brand || '').toLowerCase().includes(gearSearchQuery.toLowerCase()));
  }, [equipment, selectedCategoryTab, gearSearchQuery]);

  const filteredCatalog = useMemo(() => {
    const catalog = catalogProducts || FALLBACK_AUTHENTIC_PRODUCTS;
    return catalog
      .filter(p => selectedCategoryTab === 'Tous' || p.category.toLowerCase().includes(selectedCategoryTab.toLowerCase().split(' & ')[0]))
      .filter(p => !equipment.some(e => e.name.toLowerCase() === p.name.toLowerCase()))
      .filter(p => !gearSearchQuery || p.name.toLowerCase().includes(gearSearchQuery.toLowerCase()) || p.brand.toLowerCase().includes(gearSearchQuery.toLowerCase()));
  }, [catalogProducts, equipment, selectedCategoryTab, gearSearchQuery]);

  // --- RENDU FULLSCREEN ---
  const renderFullscreen = () => (
    <div className="space-y-6 pt-2">
      {/* Barre de recherche + filtres + ajout */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryTab(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedCategoryTab === cat ? 'bg-[#A3C4A3] text-[#0B1F17]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder="Rechercher un matériel..."
            value={gearSearchQuery}
            onChange={(e) => setGearSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-white/10 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#A3C4A3]"
          />
          <button
            onClick={onOpenAddModal}
            className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] rounded-xl text-xs font-bold shrink-0"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {/* Filtres possession */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setGearPossessionFilter('all')}
          className={`px-3 py-1 rounded-lg text-xs font-bold ${gearPossessionFilter === 'all' ? 'bg-white/20 text-white' : 'text-white/50'}`}
        >
          Tous
        </button>
        <button
          onClick={() => setGearPossessionFilter('owned')}
          className={`px-3 py-1 rounded-lg text-xs font-bold ${gearPossessionFilter === 'owned' ? 'bg-[#17402C] text-[#A3C4A3]' : 'text-white/50'}`}
        >
          Possédés ({equipment.length})
        </button>
        <button
          onClick={() => setGearPossessionFilter('catalog')}
          className={`px-3 py-1 rounded-lg text-xs font-bold ${gearPossessionFilter === 'catalog' ? 'bg-amber-500/20 text-amber-300' : 'text-white/50'}`}
        >
          Catalogue
        </button>
      </div>

      {/* Grille produits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {/* 1. Équipements possédés */}
        {(gearPossessionFilter === 'all' || gearPossessionFilter === 'owned') && (
          <>
            {filteredOwned.length === 0 ? (
              <div className="col-span-full text-center py-8 text-white/40">
                <span className="text-3xl block mb-2">🎒</span>
                <p>Aucun équipement dans cette catégorie</p>
              </div>
            ) : (
              filteredOwned.map(item => {
                // Déterminer l'état du produit
                let statusLabel = 'Possédé';
                let statusColor = 'bg-[#17402C] text-[#A3C4A3]';
                let statusDetail = item.condition || 'Bon état';

                if (item.loan_status === 'prêté') {
                  statusLabel = 'Prêté';
                  statusColor = 'bg-[#E9C46A]/20 text-[#E9C46A]';
                  statusDetail = `Prêté à ${item.loan_to_name || 'quelqu\'un'}`;
                } else if (item.condition === 'à_réparer') {
                  statusLabel = 'En réparation';
                  statusColor = 'bg-[#6BA3D6]/20 text-[#6BA3D6]';
                } else if (item.condition === 'à_remplacer') {
                  // Differentiate based on notes or other fields
                  if (item.notes?.toLowerCase().includes('perdu') || item.notes?.toLowerCase().includes('lost')) {
                    statusLabel = 'Perdu';
                    statusColor = 'bg-neutral-500/20 text-neutral-400';
                  } else if (item.notes?.toLowerCase().includes('entretien') || item.notes?.toLowerCase().includes('maintenance')) {
                    statusLabel = 'Entretien';
                    statusColor = 'bg-[#E9C46A]/20 text-[#E9C46A]';
                  } else {
                    statusLabel = 'à remplacer';
                    statusColor = 'bg-[#E76F51]/20 text-[#E76F51]';
                  }
                }


                return (
                  <div key={item.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`px-2 py-0.5 rounded ${statusColor} text-[10px] font-bold uppercase`}>
                          {statusLabel}
                        </span>
                        <span className="text-xs text-white/50 font-medium">{item.category}</span>
                      </div>
                      <h4 className="font-bold text-sm text-white mt-1">{item.name}</h4>
                      <p className="text-xs text-white/60">{item.brand || 'Sans marque'} · {formatWeight(item.weight_g)}</p>
                      <p className="text-[10px] text-white/40 mt-1">{statusDetail}</p>
                    </div>

                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onOpenLendModal(item)}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold"
                        >
                          Prêter
                        </button>
                        <button
                          onClick={() => onOpenEditModal(item)}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold"
                        >
                          Éditer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* 2. Catalogue / Non possédés */}
        {(gearPossessionFilter === 'all' || gearPossessionFilter === 'catalog') && (
          <>
            {filteredCatalog.length === 0 ? (
              <div className="col-span-full text-center py-8 text-white/40">
                <span className="text-3xl block mb-2">🛍️</span>
                <p>Tous les produits de cette catégorie sont déjà possédés</p>
              </div>
            ) : (
              filteredCatalog.map(product => (
                <div key={product.id} className="p-4 bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                        Non possédé
                      </span>
                      <span className="text-xs font-black text-white">{product.price_eur} €</span>
                    </div>
                    <h4 className="font-bold text-sm text-white mt-1">{product.name}</h4>
                    <p className="text-xs text-white/60">{product.brand} · {formatWeight(product.weight_g)}</p>
                  </div>

                  <div className="flex gap-2 pt-3 mt-3 border-t border-white/5">
                    <button
                      onClick={() => {
                        onAddToEquipment(
                          {
                            name: product.name,
                            brand: product.brand,
                            category: product.category,
                            weight_g: product.weight_g,
                            price_eur: product.price_eur,
                          },
                          { condition: 'neuf' }
                        );
                      }}
                      className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      + Inventaire
                    </button>
                    <button
                      onClick={() => onAddToCart(product)}
                      className="flex-1 py-1.5 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5] rounded-lg text-xs font-bold transition-colors"
                    >
                      + Au panier
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {renderCompact()}
      {isExpanded && renderFullscreen()}
    </>
  );
});

function formatWeight(g: number): string {
  if (!g || g <= 0) return '0 g';
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(g)} g`;
}

InventaireWidget.displayName = 'InventaireWidget';






