import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { formatWeight } from '@/src/lib/utils/formatters';
import { useToast } from '@/src/components/ui/use-toast';

interface InventaireWidgetProps {
  equipment: Array<any>;
  onUpdateEquipment: (updates: any) => Promise<void>;
  onClose: () => void;
  isFullscreen: boolean;
  onAgrandir: () => void;
}

export function InventaireWidget({
  equipment,
  onUpdateEquipment,
  onClose,
  isFullscreen,
  onAgrandir
}: InventaireWidgetProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    brand: '',
    category: '',
    weight_g: 0,
    purchase_price: 0,
    description: ''
  });

  // Get categories
  const categories = [...new Set(equipment.map(item => item.category || 'Autre').filter(Boolean))];

  // Filter equipment
  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Stats
  const ownedCount = equipment.filter(item => item.owned).length;
  const notOwnedCount = equipment.length - ownedCount;
  const inKitCount = equipment.filter(item => item.kit_id !== null).length;
  const loanedCount = equipment.filter(item => item.loan_status === 'prêté').length;
  const maintenanceCount = equipment.filter(item => item.needs_maintenance).length;

  if (isFullscreen) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Inventaire & catalogue</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Search and filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Recherche et filtres</h3>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium"
              >
                + Ajouter un article
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="block text-xs text-white/60 mb-1">Rechercher</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nom, marque, catégorie..."
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                />
              </div>

              {categories.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs text-white/60 mb-1">Catégorie</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        !selectedCategory
                          ? 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                          : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      Toutes
                    </button>
                    {categories.map((category: string) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                          selectedCategory === category
                            ? 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                            : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add item form */}
          {showAddForm && (
            <div className="p-4 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Nouvel article</h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewItem({
                      name: '',
                      brand: '',
                      category: '',
                      weight_g: 0,
                      purchase_price: 0,
                      description: ''
                    });
                  }}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newItem.name.trim()) {
                    onUpdateEquipment({
                      ...newItem,
                      owned: true,
                      loan_status: 'disponible',
                      condition: 'neuf',
                      needs_maintenance: false
                    });
                    setShowAddForm(false);
                    setNewItem({
                      name: '',
                      brand: '',
                      category: '',
                      weight_g: 0,
                      purchase_price: 0,
                      description: ''
                    });
                    toast({ description: `Article « ${newItem.name} » ajouté à l'inventaire`, variant: 'default' });
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs text-white/60 mb-1">Nom</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Tente 2 personnes"
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Marque</label>
                  <input
                    type="text"
                    value={newItem.brand}
                    onChange={(e) => setNewItem(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ex: MSR, Quechua, Salomon..."
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Catégorie</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((category: string) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Poids (g)</label>
                    <input
                      type="number"
                      value={newItem.weight_g}
                      onChange={(e) => setNewItem(prev => ({ ...prev, weight_g: Number(e.target.value) || 0 }))}
                      placeholder="Ex: 2500"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Prix (€)</label>
                    <input
                      type="number"
                      value={newItem.purchase_price}
                      onChange={(e) => setNewItem(prev => ({ ...prev, purchase_price: Number(e.target.value) || 0 }))}
                      placeholder="Ex: 199.99"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Description</label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Notes sur l'article..."
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-end pt-3 border-t border-white/5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      // Form submission handled above
                    }}
                    disabled={!newItem.name.trim()}
                  >
                    Ajouter l'article
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Equipment list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">
                Articles ({filteredEquipment.length})
              </h3>
              <span className="text-[9px] text-[#A3C4A3] font-mono">
                {ownedCount} possédés · {notOwnedCount} à acquérir
              </span>
            </div>

            {filteredEquipment.length > 0 ? (
              <div className="space-y-2">
                {filteredEquipment.map((item: any) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                      item.owned
                        ? (item.loan_status === 'prêté'
                          ? 'bg-white/3 border-white/6 text-white/60'
                          : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                        )
                        : 'bg-white/3 border-white/6 text-white/60'
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-sm font-semibold truncate">{item.name}</h4>
                      {item.brand && (
                        <p className="text-xs text-white/50">{item.brand}</p>
                      )}
                      <p className="text-xs text-white/60">
                        {item.category || 'Autre'} · {item.weight_g ? formatWeight(item.weight_g) : 'Poids NC'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      {!item.owned ? (
                        <span className="text-white/60">✗ Non possédé</span>
                      ) : (
                        <>
                          {item.loan_status === 'prêté' && (
                            <span className="text-white/60">⚠ Prêté</span>
                          )}
                          {item.loan_status !== 'prêté' && item.kit_id !== null && (
                            <span className="text-[#A3C4A3]">✓ Dans un kit</span>
                          )}
                          {item.loan_status !== 'prêté' && item.kit_id === null && (
                            <span className="text-white/60">△ Hors kit</span>
                          )}
                          {item.needs_maintenance && (
                            <span className="text-white/60">⚠ Entretien requis</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-white/50 text-center py-6">
                Aucun article trouvé avec ces filtres.
              </p>
            )}
          </div>

          {/* Statistics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[9px] font-extrabold text-white uppercase tracking-wider mb-2">Statistiques</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-white/60 mb-1">Possédés</p>
                <p className="font-bold text-white">{ownedCount}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">À acquérir</p>
                <p className="font-bold text-white">{notOwnedCount}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Dans un kit</p>
                <p className="font-bold text-white">{inKitCount}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Prêtés</p>
                <p className="font-bold text-white">{loanedCount}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Entretien requis</p>
                <p className="font-bold text-white">{maintenanceCount}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Valeur totale</p>
                <p className="font-bold text-white">
                  {equipment.reduce((sum, item) => sum + (item.purchase_price || 0), 0)}€
                </p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Poids total</p>
                <p className="font-bold text-white">
                  {formatWeight(equipment.reduce((sum, item) => sum + (item.weight_g || 0), 0))}
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
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Inventaire & catalogue</h3>
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

      <div className="space-y-2">
        <p className="text-[9px] text-white/60 font-medium">
          {equipment.length} articles suivis
        </p>
        <p className="text-[9px] text-white/60">
          {ownedCount} possédés · {notOwnedCount} à acquérir
        </p>
        {inKitCount > 0 && (
          <p className="text-[9px] text-white/60 pt-1 border-t border-white/5">
            {inKitCount} dans un kit · {loanedCount} prêtés
          </p>
        )}
      </div>

      {/* Quick stats */}
      {maintenanceCount > 0 || loanedCount > 0 && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[9px] text-white/60 text-center">
            {maintenanceCount > 0 ? `⚠ ${maintenanceCount} entretien(s)` : ''}
            {maintenanceCount > 0 && loanedCount > 0 ? ' | ' : ''}
            {loanedCount > 0 ? `🔄 ${loanedCount} prêté(s)` : ''}
          </p>
        </div>
      )}
    </div>
  );
}