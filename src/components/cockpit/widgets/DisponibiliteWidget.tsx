/* =============================================================================
   LKDV — Widget Disponibilité (Compact)
   =============================================================================
   Card compacte : synthèse équipements prêts/indisponibles | Fullscreen : gestion prêts, réparations, entretien, charge
   ============================================================================= */

import React, { memo, useMemo } from 'react';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { UnifiedProductState } from '@/types/product';

interface DisponibiliteWidgetProps {
  equipment: UserEquipmentItem[];
  productStates: UnifiedProductState[];
  onExpand: () => void;
  onCloseExpanded: () => void;
  isExpanded: boolean;
  cardRef: HTMLDivElement | null;
  headerRef: HTMLDivElement | null;
  layoutId: string;
  headerLayoutId: string;
}

export const DisponibiliteWidget = memo(function DisponibiliteWidget({
  equipment,
  onExpand,
  onCloseExpanded,
  isExpanded,
  cardRef,
  headerRef,
  layoutId,
  headerLayoutId,
}: DisponibiliteWidgetProps) {
  // Calculer les stats de disponibilité
  const stats = useMemo(() => {
    let prets = 0;
    let enReparation = 0;
    let enEntretien = 0;
    let aCharger = 0;
    let perdus = 0;
    let aRemplacer = 0;
    let disponibles = 0;

    equipment.forEach((item: UserEquipmentItem) => {
      if (item.loan_status === 'prêté') {
        prets++;
      } else {
        const condition = item.condition;
        if (condition === 'à_réparer') {
          enReparation++;
        } else if (condition === 'à_remplacer') {
          // à_remplacer covers: à_remplacer, perdu, en_entretien, etc.
          aRemplacer++;
        } else if (['Éclairage', 'Énergie & électronique', 'Navigation'].some(c => item.category?.includes(c))) {
          // Heuristique : électronique = à charger
          aCharger++;
        } else {
          disponibles++;
        }
      }
    });

    return { prets, enReparation, enEntretien, aCharger, perdus, aRemplacer, disponibles };
  }, [equipment]);

  const totalIndisponibles = stats.prets + stats.enReparation + stats.enEntretien + stats.perdus + stats.aRemplacer;
  const hasIssues = totalIndisponibles > 0 || stats.aCharger > 0;

  // --- RENDU COMPACT ---
  const renderCompact = () => (
    <div className="flex flex-col h-full text-white justify-between">
      <div className="flex flex-col items-center justify-center py-3">
        {!hasIssues ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-[#A3C4A3]/20 flex items-center justify-center text-2xl mx-auto mb-2 text-[#A3C4A3]">
              ✓
            </div>
            <span className="text-sm font-bold text-[#A3C4A3] block">
              {stats.disponibles} équipements prêts
            </span>
            <span className="text-[11px] text-white/50">
              Tout est opérationnel
            </span>
          </div>
        ) : (
          <div className="w-full text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-3xl font-black text-[#E76F51] drop-shadow-[0_0_15px_rgba(231,111,81,0.5)]">
                {totalIndisponibles + stats.aCharger}
              </span>
              <span className="text-xs text-white/70 font-semibold leading-tight">
                à attention
              </span>
            </div>
            <div className="flex justify-center gap-3 text-[10px] text-white/60">
              {stats.prets > 0 && <span className="flex items-center gap-1 bg-[#E9C46A]/20 text-[#E9C46A] px-2 py-0.5 rounded">🤝 {stats.prets}</span>}
              {stats.enReparation > 0 && <span className="flex items-center gap-1 bg-[#6BA3D6]/20 text-[#6BA3D6] px-2 py-0.5 rounded">🔧 {stats.enReparation}</span>}
              {stats.enEntretien > 0 && <span className="flex items-center gap-1 bg-[#E9C46A]/20 text-[#E9C46A] px-2 py-0.5 rounded">📅 {stats.enEntretien}</span>}
              {stats.aCharger > 0 && <span className="flex items-center gap-1 bg-[#6BA3D6]/20 text-[#6BA3D6] px-2 py-0.5 rounded">🔋 {stats.aCharger}</span>}
              {stats.aRemplacer > 0 && <span className="flex items-center gap-1 bg-[#E76F51]/20 text-[#E76F51] px-2 py-0.5 rounded">🔄 {stats.aRemplacer}</span>}
              {stats.perdus > 0 && <span className="flex items-center gap-1 bg-neutral-500/20 text-neutral-400 px-2 py-0.5 rounded">❓ {stats.perdus}</span>}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onExpand}
        className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors text-center"
      >
        {hasIssues ? 'Gérer les indisponibilités' : 'Voir le détail'}
      </button>
    </div>
  );

  // --- RENDU FULLSCREEN ---
  const renderFullscreen = () => {
    // Grouper les équipements par statut
    const groups = useMemo(() => {
      const groups: Record<string, UserEquipmentItem[]> = {
        disponibles: [],
        prets: [],
        en_reparation: [],
        en_entretien: [],
        a_charger: [],
        perdus: [],
        a_remplacer: [],
      };

      equipment.forEach((item: UserEquipmentItem) => {
        if (item.loan_status === 'prêté') {
          groups.prets.push(item);
        } else {
          const condition = item.condition;
          if (condition === 'à_réparer') {
            groups.en_reparation.push(item);
          } else if (condition === 'à_remplacer') {
            // à_remplacer covers: à_remplacer, perdu, en_entretien, etc.
            groups.a_remplacer.push(item);
          } else if (['Éclairage', 'Énergie & électronique', 'Navigation'].some(c => item.category?.includes(c))) {
            groups.a_charger.push(item);
          } else {
            groups.disponibles.push(item);
          }
        }
      });

      return groups;
    }, [equipment]);

    const renderGroup = (title: string, items: UserEquipmentItem[], color: string, icon: string, actions: React.ReactNode) => {
      if (items.length === 0) return null;

      return (
        <div key={title} className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <span style={{ color }}>{icon}</span>
              {title} ({items.length})
            </h4>
          </div>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="p-3 bg-black/30 rounded-xl border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs text-white">{item.name}</span>
                  <span className="text-[10px] text-white/50">{item.category}</span>
                  <span className="text-[10px] text-white/40 font-mono">{item.weight_g}g</span>
                </div>
                <div className="flex items-center gap-2">
                  {actions}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 pt-2">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">Disponibilité & Entretien</h3>
            <p className="text-xs text-white/60">État réel de vos équipements : ce qui est utilisable maintenant.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderGroup(
            'Disponibles',
            groups.disponibles,
            '#A3C4A3',
            '✅',
            <span className="text-[10px] text-[#A3C4A3] font-bold">Prêt</span>
          )}

          {renderGroup(
            'Prêtés',
            groups.prets,
            '#E9C46A',
            '🤝',
            <button className="px-2 py-1 bg-[#E9C46A]/20 text-[#E9C46A] rounded text-[10px] font-bold" onClick={() => {}}>
              Marquer rendu
            </button>
          )}

          {renderGroup(
            'En réparation',
            groups.en_reparation,
            '#6BA3D6',
            '🔧',
            <button className="px-2 py-1 bg-[#6BA3D6]/20 text-[#6BA3D6] rounded text-[10px] font-bold" onClick={() => {}}>
              Réparation finie
            </button>
          )}

          {renderGroup(
            'Entretien requis',
            groups.en_entretien,
            '#E9C46A',
            '📅',
            <button className="px-2 py-1 bg-[#E9C46A]/20 text-[#E9C46A] rounded text-[10px] font-bold" onClick={() => {}}>
              Valider entretien
            </button>
          )}

          {renderGroup(
            'À charger (électronique)',
            groups.a_charger,
            '#6BA3D6',
            '🔋',
            <button className="px-2 py-1 bg-[#6BA3D6]/20 text-[#6BA3D6] rounded text-[10px] font-bold" onClick={() => {}}>
              Marquer chargé
            </button>
          )}

          {renderGroup(
            'À remplacer',
            groups.a_remplacer,
            '#E76F51',
            '🔄',
            <button className="px-2 py-1 bg-[#E76F51]/20 text-[#E76F51] rounded text-[10px] font-bold" onClick={() => {}}>
              Voir alternatives
            </button>
          )}

          {renderGroup(
            'Perdus / Introuvables',
            groups.perdus,
            '#888',
            '❓',
            <button className="px-2 py-1 bg-white/10 text-white rounded text-[10px] font-bold" onClick={() => {}}>
              Retrouver / Remplacer
            </button>
          )}
        </div>

        {/* Actions globales */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <h4 className="font-bold text-sm text-white mb-3">Actions rapides</h4>
          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] rounded-xl text-xs font-bold">
              + Déclarer un prêt
            </button>
            <button className="px-3 py-1.5 bg-[#6BA3D6]/20 text-[#6BA3D6] rounded-xl text-xs font-bold">
              + Déclarer une réparation
            </button>
            <button className="px-3 py-1.5 bg-[#E9C46A]/20 text-[#E9C46A] rounded-xl text-xs font-bold">
              + Planifier un entretien
            </button>
            <button className="px-3 py-1.5 bg-white/10 text-white rounded-xl text-xs font-bold">
              + Signaler perdu
            </button>
          </div>
        </div>
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

DisponibiliteWidget.displayName = 'DisponibiliteWidget';






