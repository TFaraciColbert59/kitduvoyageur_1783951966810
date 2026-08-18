/* =============================================================================
   LKDV — Widget Prochain Départ (Large/Hero)
   =============================================================================
   Card compacte : décision immédiate + fullscreen préparation guidée
   ============================================================================= */

import React, { memo } from 'react';
import Link from 'next/link';
import { PlannedHike } from '@/lib/preparation/plannedHikes';
import { DeparturePreparationPlan } from '@/lib/preparation/SmartDepartureEngine';
import { CustomKit } from '@/hooks/useUserKits';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { formatWeight, daysUntil, buildHikeContext } from '@/app/mon-materiel/page';

interface ProchainDepartWidgetProps {
  // Données
  activeHike: PlannedHike | null;
  plannedHikes: PlannedHike[];
  activeKit: CustomKit | null;
  kits: CustomKit[];
  departurePlan: DeparturePreparationPlan | null;
  hikeReadiness: {
    readinessPct: number;
    ownedCount: number;
    totalCount: number;
    missingItems: any[];
  };
  equipment: UserEquipmentItem[];
  // Actions
  onSetActiveHike: (hike: PlannedHike) => void;
  onOpenKitDrawer: () => void;
  onExpand: () => void;
  onCloseExpanded: () => void;
  // État expansion
  isExpanded: boolean;
  // Refs pour animation
  cardRef: React.RefObject<HTMLDivElement>;
  headerRef: React.RefObject<HTMLDivElement>;
  // Layout IDs
  layoutId: string;
  headerLayoutId: string;
}

export const ProchainDepartWidget = memo(function ProchainDepartWidget({
  activeHike,
  plannedHikes,
  activeKit,
  kits,
  departurePlan,
  hikeReadiness,
  equipment,
  onSetActiveHike,
  onOpenKitDrawer,
  onExpand,
  onCloseExpanded,
  isExpanded,
  cardRef,
  headerRef,
  layoutId,
  headerLayoutId,
}: ProchainDepartWidgetProps) {
  const daysLeft = activeHike ? daysUntil(activeHike.targetDate) : null;
  const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

  // Déterminer l'état principal pour la card compacte
  const getCompactState = () => {
    if (!activeHike) {
      return {
        title: 'Aucun départ programmé',
        subtitle: 'Planifiez une sortie pour que LKDV prépare votre sac',
        action: { label: 'Explorer les randonnées', href: '/explorer', variant: 'primary' },
        icon: '🏔️',
      };
    }

    if (daysLeft !== null && daysLeft <= 0) {
      return {
        title: activeHike.name,
        subtitle: `Départ ${daysLeft === 0 ? "aujourd'hui" : 'dépassé'}`,
        readiness: `${hikeReadiness.readinessPct}% prêt`,
        missingCount: hikeReadiness.missingItems.length,
        action: hikeReadiness.missingItems.length > 0
          ? { label: 'Résoudre maintenant', onClick: onExpand, variant: 'critical' }
          : { label: 'Prêt à partir', onClick: onExpand, variant: 'success' },
        icon: '🚀',
        urgent: true,
      };
    }

    if (daysLeft !== null && daysLeft <= 3) {
      return {
        title: activeHike.name,
        subtitle: `Départ dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        readiness: `${hikeReadiness.readinessPct}% prêt`,
        missingCount: hikeReadiness.missingItems.length,
        action: hikeReadiness.missingItems.length > 0
          ? { label: `${hikeReadiness.missingItems.length} action${hikeReadiness.missingItems.length > 1 ? 's' : ''} requise${hikeReadiness.missingItems.length > 1 ? 's' : ''}`, onClick: onExpand, variant: 'warning' }
          : { label: 'Voir la préparation', onClick: onExpand, variant: 'info' },
        icon: '⏱️',
        urgent: true,
      };
    }

    return {
      title: activeHike.name,
      subtitle: activeHike.targetDate ? `Départ le ${new Date(activeHike.targetDate).toLocaleDateString('fr-FR')}` : 'Date à définir',
      readiness: `${hikeReadiness.readinessPct}% prêt`,
      missingCount: hikeReadiness.missingItems.length,
      action: hikeReadiness.missingItems.length > 0
        ? { label: 'Compléter la préparation', onClick: onExpand, variant: 'secondary' }
        : { label: 'Tout est prêt', onClick: onExpand, variant: 'success' },
      icon: '🗓️',
    };
  };

  const compactState = getCompactState();

  // --- RENDU COMPACT ---
  const renderCompact = () => (
    <div className="flex flex-col h-full text-white justify-between">
      {/* Header + Countdown */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#17402C] text-[#A3C4A3] border border-[#A3C4A3]/30">
              Prochain Départ
            </span>
            {activeHike?.isOvernight && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/70">
                ⛺ Bivouac ({(activeHike.nightsCount || 1)}n)
              </span>
            )}
          </div>
          <h3 className="font-black tracking-tight text-xl md:text-2xl text-white truncate">
            {compactState.title}
          </h3>
          <p className="text-white/70 text-xs md:text-sm mt-0.5 truncate">
            {compactState.subtitle}
          </p>
        </div>

        <div className="flex flex-col items-end shrink-0 pl-3">
          <span className={`font-black tracking-tighter text-3xl ${compactState.urgent && isUrgent ? 'text-[#E76F51] animate-pulse' : compactState.urgent ? 'text-[#E9C46A]' : 'text-[#A3C4A3]'}`}>
            {daysLeft === null ? (activeHike ? 'Date libre' : '—') : daysLeft === 0 ? "Aujourd'hui" : daysLeft > 0 ? `J-${daysLeft}` : 'Passé'}
          </span>
          <span className="text-xs font-semibold text-white/60 mt-0.5">
            {compactState.readiness}
          </span>
        </div>
      </div>

      {/* Infos Smart : Kit + Consommables */}
      <div className="grid grid-cols-2 gap-2 bg-black/20 p-2.5 rounded-2xl border border-white/5 mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50 uppercase font-semibold">Kit assigné</span>
          <span className="text-xs font-bold text-[#A3C4A3] truncate">
            🎒 {activeKit?.name || 'Aucun kit lié'}
          </span>
          <span className="text-[11px] text-white/70">
            {activeKit ? formatWeight(activeKit.total_weight_g || 0) : '—'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50 uppercase font-semibold">Smart Consommables</span>
          <span className="text-xs font-bold text-white truncate">
            💧 {departurePlan?.consumables.waterLiters || 2}L · 🍲 {departurePlan?.consumables.foodMealsCount || 2} repas
          </span>
          <span className="text-[11px] text-white/70">
            🔥 {departurePlan?.consumables.fuelGrams || 100}g gaz
          </span>
        </div>
      </div>

      {/* Alerte manquant ou OK */}
      {hikeReadiness.missingItems.length > 0 ? (
        <div className="flex items-center justify-between px-3 py-2 bg-[#E76F51]/15 border border-[#E76F51]/30 rounded-xl text-xs mb-3">
          <span className="text-[#E76F51] font-bold">
            ⚠️ {hikeReadiness.missingItems.length} équipement(s) manquant(s)
          </span>
          <span className="text-[11px] text-white/70 underline">
            {isExpanded ? 'Voir la liste ci-dessous' : 'Agrandir pour compléter'}
          </span>
        </div>
      ) : activeHike ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#17402C]/40 border border-[#A3C4A3]/20 rounded-xl text-xs text-[#A3C4A3] mb-3">
          <span>✓</span>
          <span className="font-semibold">Kit complet & prêt pour le départ</span>
        </div>
      ) : null}

      {/* Action principale compacte */}
      {compactState.action && (
        <button
          onClick={compactState.action.onClick || (() => {})}
          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
            compactState.action.variant === 'primary' ? 'bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5]' :
            compactState.action.variant === 'critical' ? 'bg-[#E76F51] text-white hover:bg-[#d66348]' :
            compactState.action.variant === 'warning' ? 'bg-[#E9C46A] text-[#0B1F17] hover:bg-[#d8b45e]' :
            compactState.action.variant === 'success' ? 'bg-[#17402C] text-[#A3C4A3] hover:bg-[#0B1F17]' :
            compactState.action.variant === 'info' ? 'bg-[#6BA3D6]/20 text-[#6BA3D6] hover:bg-[#6BA3D6]/30 border border-[#6BA3D6]/30' :
            'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {compactState.action.label}
        </button>
      )}

      {/* Lien explorer si aucun départ */}
      {!activeHike && compactState.action && (
        <Link
          href="/explorer"
          className="w-full py-2.5 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5] rounded-xl text-xs font-bold transition-colors text-center block"
        >
          {compactState.action.label}
        </Link>
      )}
    </div>
  );

  // --- RENDU FULLSCREEN (Préparation Guidée) ---
  const renderFullscreen = () => (
    <div className="space-y-6 pt-2">
      {/* 1. Sélecteur randonnée si plusieurs */}
      {plannedHikes.length > 1 && (
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-3">
            Changer la randonnée active :
          </label>
          <div className="flex flex-wrap gap-2">
            {plannedHikes.map(h => (
              <button
                key={h.id}
                onClick={() => onSetActiveHike(h)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  h.id === activeHike?.id ? 'bg-[#A3C4A3] text-[#0B1F17]' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {h.name} ({h.targetDate || 'Date ?'})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Détails sortie */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
          <span className="text-[11px] text-white/50 block">Distance</span>
          <span className="text-xl font-black text-white">{activeHike?.distanceKm || '—'} km</span>
        </div>
        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
          <span className="text-[11px] text-white/50 block">Dénivelé +</span>
          <span className="text-xl font-black text-[#A3C4A3]">+{activeHike?.elevationGain || 0} m</span>
        </div>
        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
          <span className="text-[11px] text-white/50 block">Points d'eau</span>
          <span className="text-xl font-black text-white">
            {activeHike?.hasWaterPoints ? `${activeHike.waterPointsCount || 1} répertorié(s)` : 'Aucun point d\'eau'}
          </span>
        </div>
        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
          <span className="text-[11px] text-white/50 block">Météo</span>
          <span className="text-xl font-black text-white">{activeHike?.weather?.tempC ? `${activeHike.weather.tempC}°C` : 'Tempérée'}</span>
        </div>
      </div>

      {/* 3. Kit associé + switcher */}
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-sm uppercase tracking-wider text-[#A3C4A3]">
            Kit associé à cette sortie
          </h4>
          <button
            onClick={onOpenKitDrawer}
            className="text-xs font-bold text-white/80 hover:text-white underline"
          >
            Éditer dans le studio kits
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {kits.map(k => {
            const isSelected = activeKit?.id === k.id;
            return (
              <div
                key={k.id}
                onClick={() => onSetActiveHike?.({ ...activeHike!, assignedKitId: k.id } as any)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#17402C] border-[#A3C4A3] shadow-[0_0_15px_rgba(163,196,163,0.2)]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm">{k.name}</span>
                  {isSelected && <span className="text-xs text-[#A3C4A3]">✓ Actif</span>}
                </div>
                <p className="text-xs text-white/60 mt-1">{k.items?.length || 0} articles · {formatWeight(k.total_weight_g || 0)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Équipements manquants - résolution */}
      {hikeReadiness.missingItems.length > 0 && (
        <div className="bg-[#E76F51]/10 p-5 rounded-2xl border border-[#E76F51]/30">
          <h4 className="font-bold text-sm uppercase tracking-wider text-[#E76F51] mb-4">
            Équipements manquants pour cette randonnée ({hikeReadiness.missingItems.length})
          </h4>
          <div className="space-y-3">
            {hikeReadiness.missingItems.map(mi => (
              <div key={mi.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-black/40 rounded-xl border border-white/10">
                <div>
                  <span className="font-bold text-sm text-white">{mi.item_name}</span>
                  <span className="text-xs text-white/50 block">{mi.category} · {formatWeight(mi.weight_g)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // TODO: addToEquipment
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Déjà possédé (ajouter)
                  </button>
                  <button
                    onClick={() => {
                      // TODO: handleAddProductToCart
                    }}
                    className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5] rounded-lg text-xs font-bold transition-colors"
                  >
                    + Ajouter au panier
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Consommables détaillés */}
      {departurePlan && (
        <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
          <h4 className="font-bold text-sm uppercase tracking-wider text-[#A3C4A3] mb-4">
            Consommables & Préparation estimée
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-white/50 block">Eau</span>
              <span className="text-xl font-black text-white">{departurePlan.consumables.waterLiters}L</span>
              <span className="text-xs text-white/60 block">{departurePlan.consumables.waterReason}</span>
            </div>
            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-white/50 block">Repas chauds</span>
              <span className="text-xl font-black text-white">{departurePlan.consumables.foodMealsCount}</span>
              <span className="text-xs text-white/60 block">Estimation calories</span>
            </div>
            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-white/50 block">Gaz</span>
              <span className="text-xl font-black text-white">{departurePlan.consumables.fuelGrams}g</span>
              <span className="text-xs text-white/60 block">Cartouches nécessaires</span>
            </div>
            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-white/50 block">Poids total estimé</span>
              <span className="text-xl font-black text-[#A3C4A3]">
                {activeKit ? formatWeight((activeKit.total_weight_g || 0) + (departurePlan.consumables.waterLiters * 1000) + departurePlan.consumables.fuelGrams + (departurePlan.consumables.foodMealsCount * 400)) : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Documents & Logistique */}
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
        <h4 className="font-bold text-sm uppercase tracking-wider text-[#A3C4A3] mb-4">
          Documents & Logistique
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Pièce d\'identité', required: true },
            { label: 'Assurance', required: true },
            { label: 'Réservation refuge', required: activeHike?.isOvernight },
            { label: 'Carte IGN / GPS', required: true },
            { label: 'Numéros urgence', required: true },
            { label: 'Espèces (refuges)', required: true },
            { label: 'Autorisation parc', required: false },
            { label: 'Transport retour', required: false },
          ].map((doc, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-black/30 rounded-xl border border-white/5">
              <span className={`w-4 h-4 rounded border ${doc.required ? 'border-[#E76F51] bg-[#E76F51]/20' : 'border-white/20'}`} />
              <span className="text-xs text-white/80">{doc.label} {doc.required && <span className="text-[#E76F51] ml-1">*</span>}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Validation finale */}
      {activeHike && (
        <div className={`p-5 rounded-2xl border ${hikeReadiness.missingItems.length === 0 ? 'border-[#A3C4A3] bg-[#17402C]/40' : 'border-[#E9C46A] bg-[#E9C46A]/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-lg text-white mb-1">
                {hikeReadiness.missingItems.length === 0 ? '✅ Prêt à partir' : '⚠️ Préparation incomplète'}
              </h4>
              <p className="text-xs text-white/70">
                {hikeReadiness.missingItems.length === 0
                  ? 'Votre kit est complet, les consommables sont prêts. Bon voyage !'
                  : `${hikeReadiness.missingItems.length} équipement(s) manquant(s) et ${departurePlan?.consumables.waterLiters || 2}L d'eau à prévoir.`}
              </p>
            </div>
            {hikeReadiness.missingItems.length === 0 && (
              <button className="px-5 py-2 bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs rounded-xl">
                Générer la fiche de départ
              </button>
            )}
          </div>
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

ProchainDepartWidget.displayName = 'ProchainDepartWidget';