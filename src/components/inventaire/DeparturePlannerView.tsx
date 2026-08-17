'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { CustomKit } from '@/hooks/useUserKits';
import {
  DepartureHikeContext,
  resolveDeparturePlan,
  recordPostHikeGearUsage,
} from '@/lib/preparation/SmartDepartureEngine';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import Icon from '@/components/ui/AppIcon';

interface DeparturePlannerViewProps {
  userEquipment: UserEquipmentItem[];
  userKits: CustomKit[];
  preselectedKit?: CustomKit | null;
  onOpenAddGearModal: () => void;
}

const SAMPLE_TRAILS: DepartureHikeContext[] = [
  {
    id: 'trail-1',
    name: 'Tour du Mont-Blanc — Étape 1',
    distanceKm: 14.5,
    elevationGain: 950,
    elevationLoss: 400,
    difficulty: 'Difficile',
    season: 'Été',
    terrain: 'Haute Montagne',
    hasWaterPoints: true,
    waterPointsCount: 2,
    hasRefuges: true,
    isOvernight: true,
    nightsCount: 1,
    weather: {
      temperature: 14,
      rainProbability: 0.15,
      precipitationMm: 0,
      windSpeedKmh: 20,
      uvIndex: 6,
      condition: 'Éclaircies en altitude',
    } as any,
  },
  {
    id: 'trail-2',
    name: 'Massif des Calanques — Sentier Côtier',
    distanceKm: 11.2,
    elevationGain: 420,
    elevationLoss: 420,
    difficulty: 'Moyen',
    season: 'Printemps',
    terrain: 'Rocheux & Littoral',
    hasWaterPoints: false,
    waterPointsCount: 0,
    hasRefuges: false,
    isOvernight: false,
    weather: {
      temperature: 24,
      rainProbability: 0,
      precipitationMm: 0,
      windSpeedKmh: 15,
      uvIndex: 8,
      condition: 'Ensoleillé & Chaud',
    } as any,
  },
  {
    id: 'trail-3',
    name: 'GR20 Corse — Refuge de Carrozzu',
    distanceKm: 8.5,
    elevationGain: 1100,
    elevationLoss: 600,
    difficulty: 'Expert',
    season: 'Été',
    terrain: 'Minéral & Arêtes',
    hasWaterPoints: true,
    waterPointsCount: 1,
    hasRefuges: true,
    isOvernight: true,
    nightsCount: 1,
    weather: {
      temperature: 11,
      rainProbability: 0.4,
      precipitationMm: 2.5,
      windSpeedKmh: 35,
      uvIndex: 5,
      condition: 'Averses orageuses possibles',
    } as any,
  },
];

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function DeparturePlannerView({
  userEquipment,
  userKits,
  preselectedKit,
  onOpenAddGearModal,
}: DeparturePlannerViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [selectedTrailIndex, setSelectedTrailIndex] = useState(0);
  const [customDistance, setCustomDistance] = useState<string>('');
  const [customElevation, setCustomElevation] = useState<string>('');
  const [isOvernightToggle, setIsOvernightToggle] = useState<boolean | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [departureCompleted, setDepartureCompleted] = useState(false);

  const baseTrail = SAMPLE_TRAILS[selectedTrailIndex];

  const currentContext: DepartureHikeContext = useMemo(() => {
    return {
      ...baseTrail,
      distanceKm: customDistance ? Number(customDistance) : baseTrail.distanceKm,
      elevationGain: customElevation ? Number(customElevation) : baseTrail.elevationGain,
      isOvernight: isOvernightToggle !== null ? isOvernightToggle : baseTrail.isOvernight,
    };
  }, [baseTrail, customDistance, customElevation, isOvernightToggle]);

  // Résolution automatique du plan de départ
  const departurePlan = useMemo(() => {
    const customUserKits = preselectedKit ? [preselectedKit, ...userKits] : userKits;
    return resolveDeparturePlan(currentContext, customUserKits, userEquipment);
  }, [currentContext, preselectedKit, userKits, userEquipment]);

  const toggleChecked = (id: string) => {
    triggerHaptic('light');
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleValidateDeparture = async () => {
    triggerHaptic('selection');
    const usedGearIds = departurePlan.checklist.inPackReady
      .map((i) => i.ownedGearId)
      .filter(Boolean) as string[];

    await recordPostHikeGearUsage(usedGearIds);
    setDepartureCompleted(true);
  };

  return (
    <div className="space-y-6">
      {/* ── 1. CHOIX RAPIDE DE LA RANDONNÉE ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
              Sortie à préparer
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#0B1F17]">
              {currentContext.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {SAMPLE_TRAILS.map((trail, idx) => (
              <button
                key={trail.id}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedTrailIndex(idx);
                  setCustomDistance('');
                  setCustomElevation('');
                  setIsOvernightToggle(null);
                  setDepartureCompleted(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedTrailIndex === idx
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/[0.04] text-[#6B7A72] hover:text-[#0B1F17]'
                }`}
              >
                {trail.name.split('—')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Paramètres de l'itinéraire */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/[0.04] text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-[#FBFAF6]">
            <p className="text-[10px] text-[#6B7A72]">Distance</p>
            <p className="font-bold text-[#0B1F17]">{currentContext.distanceKm} km</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#FBFAF6]">
            <p className="text-[10px] text-[#6B7A72]">Dénivelé +</p>
            <p className="font-bold text-[#0B1F17]">+{currentContext.elevationGain} m</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#FBFAF6]">
            <p className="text-[10px] text-[#6B7A72]">Type de sortie</p>
            <p className="font-bold text-[#0B1F17]">
              {currentContext.isOvernight ? '⛺ Bivouac / Nuitée' : '🚶‍♂️ Journée'}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#FBFAF6]">
            <p className="text-[10px] text-[#6B7A72]">Points d'eau</p>
            <p className="font-bold text-[#0B1F17]">
              {currentContext.hasWaterPoints ? '💧 Sources attestées' : '❌ Aucun point d\'eau'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. SCORE D'ADÉQUATION, POIDS TOTAL & MÉTÉO EN UN COUP D'ŒIL ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score & Kit proposé */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
                Kit & Préparation
              </span>
              <span className="text-xs font-bold text-[#17402C] font-mono bg-[#E1EBDD] px-2 py-0.5 rounded-md">
                {departurePlan.suitabilityScore}% prêt
              </span>
            </div>
            <h4 className="text-sm font-bold text-[#0B1F17]">
              {departurePlan.selectedKit
                ? departurePlan.selectedKit.name
                : 'Kit sur-mesure optimisé'}
            </h4>
            <p className="text-[11px] text-[#6B7A72] mt-0.5">
              {departurePlan.isAutoGeneratedKit
                ? 'Généré automatiquement à partir de votre matériel disponible'
                : 'Sélectionné automatiquement comme le plus adapté'}
            </p>
          </div>

          <div className="pt-3 mt-2 border-t border-black/[0.04] text-[11px] text-[#17402C] font-semibold flex items-center gap-1">
            <span>✓ {departurePlan.checklist.inPackReady.length} articles prêts</span>
          </div>
        </div>

        {/* Poids Total (Matériel + Consommables) */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
              Poids total du sac estimé
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-[#0B1F17] font-mono mt-1">
              {formatWeight(departurePlan.totalPackWeightG)}
            </div>
            <p className="text-[11px] text-[#6B7A72] mt-0.5">
              Matériel fond de sac + eau ({departurePlan.consumables.waterLiters}L) & vivres
            </p>
          </div>

          <div className="pt-3 mt-2 border-t border-black/[0.04] text-[11px] text-[#6B7A72] font-mono">
            {departurePlan.totalPackWeightG < 6000 ? '🪶 Sac léger' : '🎒 Sac tout confort'}
          </div>
        </div>

        {/* Météo & Conseils en direct */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
                Météo du parcours
              </span>
              <span className="text-xs font-bold text-[#0B1F17] font-mono">
                {departurePlan.weatherSummary.tempMinMax}
              </span>
            </div>
            <h4 className="text-sm font-bold text-[#0B1F17]">
              {departurePlan.weatherSummary.condition}
            </h4>
            <p className="text-[11px] text-[#6B7A72] mt-0.5">
              {departurePlan.weatherSummary.advice}
            </p>
          </div>

          <div className="pt-3 mt-2 border-t border-black/[0.04] text-[11px] text-[#6B7A72] font-mono flex items-center justify-between">
            <span>Pluie : {departurePlan.weatherSummary.rainRiskPct}%</span>
            <span>Vent : {departurePlan.weatherSummary.windKmh} km/h</span>
          </div>
        </div>
      </div>

      {/* ── 3. CHECKLIST INTELLIGENTE DU DÉPART ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-2xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
          <div>
            <h3 className="text-base font-bold text-[#0B1F17]">
              Checklist de départ : « Tout est pensé »
            </h3>
            <p className="text-xs text-[#6B7A72]">
              Cochez vos articles en préparant votre sac avant de partir.
            </p>
          </div>

          <span className="text-xs font-mono font-semibold text-[#17402C] bg-[#E1EBDD] px-2.5 py-1 rounded-full">
            {checkedItems.size} / {departurePlan.checklist.inPackReady.length + departurePlan.checklist.consumablesToPack.length} vérifiés
          </span>
        </div>

        {/* Section A: Matériel dans le sac */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F17] flex items-center gap-1.5">
            <span>🎒</span> Matériel dans le sac ({departurePlan.checklist.inPackReady.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {departurePlan.checklist.inPackReady.map((item) => {
              const isChecked = checkedItems.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleChecked(item.id)}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-[#E1EBDD]/40 border-[#A9C6B0] text-[#17402C]'
                      : 'bg-[#FBFAF6] border-black/[0.04] text-[#0B1F17] hover:border-black/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-4 h-4 rounded-md border flex items-center justify-center font-bold text-[10px] shrink-0 border-[#17402C] bg-white text-[#17402C]">
                      {isChecked ? '✓' : ''}
                    </span>
                    <span className={`truncate font-medium ${isChecked ? 'line-through opacity-70' : ''}`}>
                      {item.name}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#6B7A72] shrink-0 ml-2">
                    {item.weightG} g
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section B: Consommables calculés */}
        <div className="space-y-2 pt-2 border-t border-black/[0.04]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F17] flex items-center gap-1.5">
            <span>💧</span> Consommables calculés automatiquement
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {departurePlan.checklist.consumablesToPack.map((item) => {
              const isChecked = checkedItems.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleChecked(item.id)}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-[#E1EBDD]/40 border-[#A9C6B0] text-[#17402C]'
                      : 'bg-emerald-50/50 border-emerald-200/60 text-[#0B1F17]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-4 h-4 rounded-md border flex items-center justify-center font-bold text-[10px] shrink-0 border-[#17402C] bg-white text-[#17402C]">
                      {isChecked ? '✓' : ''}
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate font-semibold ${isChecked ? 'line-through opacity-70' : ''}`}>
                        {item.name}
                      </p>
                      {item.actionHint && (
                        <p className="text-[10px] text-[#6B7A72] truncate">{item.actionHint}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[#6B7A72] shrink-0 ml-2">
                    {item.weightG} g
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section C: Alertes de sécurité / Prêts */}
        {departurePlan.checklist.securityChecks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <span>⚠️</span> Vérifications & Alertes de sécurité
            </h4>
            <div className="space-y-2">
              {departurePlan.checklist.securityChecks.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-xs flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-amber-950">{item.name}</p>
                    <p className="text-[11px] text-amber-900">{item.warningMessage || item.actionHint}</p>
                  </div>
                  <button
                    onClick={onOpenAddGearModal}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-900 text-white shrink-0 hover:bg-black transition-colors"
                  >
                    Vérifier
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section D: Éléments manquants / Recommandations */}
        {departurePlan.checklist.missingItems.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7A72] flex items-center gap-1.5">
              <span>✨</span> Éléments conseillés pour les conditions
            </h4>
            <div className="space-y-2">
              {departurePlan.checklist.missingItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#FBFAF6] border border-black/[0.06] text-xs flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-[#0B1F17]">{item.name}</p>
                    <p className="text-[11px] text-[#6B7A72]">{item.actionHint}</p>
                  </div>
                  <button
                    onClick={onOpenAddGearModal}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#17402C] text-white shrink-0 hover:bg-[#0B1F17] transition-colors"
                  >
                    + Ajouter
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. BOUTON FINAL : VALIDER LE DÉPART ── */}
        <div className="pt-4 border-t border-black/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#6B7A72]">
            {departureCompleted ? (
              <span className="text-[#17402C] font-semibold flex items-center gap-1">
                ✓ Départ enregistré ! L'usage de votre matériel a été comptabilisé.
              </span>
            ) : (
              <span>Prêt pour l'aventure ? Enregistrez votre départ pour actualiser l'historique du matériel.</span>
            )}
          </div>

          <button
            disabled={departureCompleted}
            onClick={handleValidateDeparture}
            className={`w-full sm:w-auto px-6 py-3 rounded-full text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
              departureCompleted
                ? 'bg-emerald-700 text-white cursor-default'
                : 'bg-[#17402C] text-white hover:bg-[#0B1F17] active:scale-95'
            }`}
          >
            <span>{departureCompleted ? '✓ Sortie en cours' : '🚀 Valider mon sac & Partir'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
