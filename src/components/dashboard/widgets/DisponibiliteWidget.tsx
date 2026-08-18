import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { formatWeight } from '@/src/lib/utils/formatters';
import { useToast } from '@/src/components/ui/use-toast';

interface DisponibiliteWidgetProps {
  equipment: Array<any>;
  onUpdateEquipment: (updates: any) => Promise<void>;
  onClose: () => void;
  isFullscreen: boolean;
  onAgrandir: () => void;
}

export function DisponibiliteWidget({
  equipment,
  onUpdateEquipment,
  onClose,
  isFullscreen,
  onAgrandir
}: DisponibiliteWidgetProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'in-kit' | 'reserved' | 'loaned' | 'maintenance' | 'lost'>('all');

  // Status categories
  const statusCategories = [
    { id: 'all', label: 'Tous', icon: '📋' },
    { id: 'available', label: 'Disponibles', icon: '✅' },
    { id: 'in-kit', label: 'Dans un kit', icon: '🎒' },
    { id: 'reserved', label: 'Réservés', icon: '📌' },
    { id: 'loaned', label: 'Prêtés', icon: '🔄' },
    { id: 'maintenance', label: 'Entretien', icon: '🔧' },
    { id: 'lost', label: 'Perdus', icon: '❓' }
  ];

  // Filter equipment based on status
  const filteredEquipment = equipment.filter(item => {
    if (statusFilter === 'all') return true;

    switch (statusFilter) {
      case 'available':
        return item.owned &&
               item.loan_status !== 'prêté' &&
               !item.needs_maintenance &&
               item.condition !== 'abîmé' &&
               item.kit_id === null;
      case 'in-kit':
        return item.owned && item.kit_id !== null;
      case 'reserved':
        // Assuming we have a reserved_for_hike property or similar
        return item.owned && item.reserved_for_hike !== null;
      case 'loaned':
        return item.loan_status === 'prêté';
      case 'maintenance':
        return item.needs_maintenance || item.condition === 'abîmé';
      case 'lost':
        return !item.owned || item.status === 'lost';
      default:
        return true;
    }
  });

  // Stats
  const totalItems = equipment.length;
  const availableItems = equipment.filter(item =>
    item.owned &&
    item.loan_status !== 'prêté' &&
    !item.needs_maintenance &&
    item.condition !== 'abîmé' &&
    item.kit_id === null
  ).length;

  const inKitItems = equipment.filter(item => item.owned && item.kit_id !== null).length;
  const loanedItems = equipment.filter(item => item.loan_status === 'prêté').length;
  const maintenanceItems = equipment.filter(item => item.needs_maintenance || item.condition === 'abîmé').length;
  const lostItems = equipment.filter(item => !item.owned || item.status === 'lost').length;

  if (isFullscreen) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Disponibilité</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Status filter */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">Filtrer par statut</h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {statusCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setStatusFilter(category.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    statusFilter === category.id
                      ? 'bg-white/12 border-[#A3C4A3]/50 text-white font-bold'
                      : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">
                Articles ({filteredEquipment.length})
              </h3>
              <span className="text-[9px] text-[#A3C4A3] font-mono">
                {availableItems} disponibles · {inKitItems} en kit · {loanedItems} prêtés
              </span>
            </div>

            {filteredEquipment.length > 0 ? (
              <div className="space-y-2">
                {filteredEquipment.map((item: any) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                      getStatusClass(item)
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-sm font-semibold truncate">{item.name}</h4>
                      {item.brand && (
                        <p className="text-xs text-white/50">{item.brand}</p>
                      )}
                      <p className="text-xs text-white/60">
                        {getStatusLabel(item)} · {item.weight_g ? formatWeight(item.weight_g) : 'Poids NC'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      {getStatusBadge(item)}
                      {item.weight_g && (
                        <span className="text-white/60">
                          {formatWeight(item.weight_g)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-white/50 text-center py-6">
                Aucun article trouvé avec ce filtre.
              </p>
            )}
          </div>

          {/* Statistics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[9px] font-extrabold text-white uppercase tracking-wider mb-2">Répartition de la disponibilité</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-white/60 mb-1">Disponibles</p>
                <p className="font-bold text-white">{availableItems}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">En kit</p>
                <p className="font-bold text-white">{inKitItems}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Prêtés</p>
                <p className="font-bold text-white">{loanedItems}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Entretien/abîmé</p>
                <p className="font-bold text-white">{maintenanceItems}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Perdus/manquants</p>
                <p className="font-bold text-white">{lostItems}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Taux de disponibilité</p>
                <p className="font-bold text-white">
                  {totalItems > 0
                    ? `${Math.round((availableItems / totalItems) * 100)}%`
                    : '0%'}
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
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Disponibilité</h3>
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
          {availableItems} disponibles
        </p>
        <p className="text-[9px] text-white/60">
          {totalItems} suivis · {loanedItems} prêtés · {maintenanceItems} entretien
        </p>
      </div>

      {/* Quick status indicators */}
      {(loanedItems > 0 || maintenanceItems > 0) && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[9px] text-white/60 text-center">
            {loanedItems > 0 ? `🔄 ${loanedItems} prêté(s)` : ''}
            {loanedItems > 0 && maintenanceItems > 0 ? ' | ' : ''}
            {maintenanceItems > 0 ? `⚠ ${maintenanceItems} entretien(s)` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getStatusClass(item: any): string {
  if (!item.owned) return 'bg-white/3 border-white/6 text-white/60';
  if (item.loan_status === 'prêté') return 'bg-white/3 border-white/6 text-white/60';
  if (item.needs_maintenance || item.condition === 'abîmé') return 'bg-white/3 border-white/6 text-white/60';
  if (item.kit_id !== null) return 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10';
  return 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10';
}

function getStatusLabel(item: any): string {
  if (!item.owned) return 'Non possédé';
  if (item.loan_status === 'prêté') return 'Prêté';
  if (item.needs_maintenance) return 'Entretien requis';
  if (item.condition === 'abîmé') return 'Abîmé';
  if (item.kit_id !== null) return 'Dans un kit';
  return 'Disponible';
}

function getStatusBadge(item: any): JSX.Element {
  if (!item.owned) {
    return <span className="text-white/60">✗</span>;
  }
  if (item.loan_status === 'prêté') {
    return <span className="text-white/60">🔄</span>;
  }
  if (item.needs_maintenance || item.condition === 'abîmé') {
    return <span className="text-white/60">⚠</span>;
  }
  if (item.kit_id !== null) {
    return <span className="text-[#A3C4A3]">🎒</span>;
  }
  return <span className="text-[#A3C4A3]">✅</span>;
}