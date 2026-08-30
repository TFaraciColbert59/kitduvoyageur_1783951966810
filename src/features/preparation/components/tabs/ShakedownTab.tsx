'use client';

import React from 'react';
import Link from 'next/link';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Sparkles, AlertTriangle, ShieldAlert, Scale, ShoppingBag, ArrowRight } from 'lucide-react';

export function ShakedownTab() {
  const { getShakedownReport, addItem } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const report = getShakedownReport();
  const {
    score,
    potentialWeightSavedGrams,
    potentialPercentageSaved,
    duplicateWarnings,
    missingVitalWarnings,
    heavyItemWarnings,
    recommendations,
    gearGaps,
  } = report;

  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-emerald-800 bg-emerald-100 border-emerald-300';
    if (val >= 50) return 'text-amber-800 bg-amber-100 border-amber-300';
    return 'text-rose-800 bg-rose-100 border-rose-300';
  };

  const handleAddMissingItem = (gap: typeof gearGaps[0]) => {
    triggerHaptic('success');
    addItem({
      name: gap.suggestedProduct?.name || gap.name,
      weightGrams: gap.suggestedProduct?.weightGrams || 150,
      category: gap.category,
      status: 'to_buy',
      isWorn: false,
      isConsumable: false,
      isVital: gap.priority === 'vital',
      isPrivate: false,
      quantity: 1,
      priceEur: gap.suggestedProduct?.priceEur,
      shopProductSlug: gap.suggestedProduct?.shopSlug,
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Shakedown Score Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-2xl font-mono shadow-2xs border ${getScoreColor(
              score
            )}`}
          >
            {score}
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
              AUDIT SHAKEDOWN DU SAC
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#17402C] dark:text-white">
              {score >= 80 ? 'Sac Parfaitement Optimisé' : 'Potentiel d’Allègement'}
            </h3>
            <p className="text-xs text-[#5A7064] dark:text-[#9AAD9E]">
              Gain possible :{' '}
              <strong className="text-[#17402C] dark:text-white">
                -{potentialWeightSavedGrams} g (-{potentialPercentageSaved}%)
              </strong>
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getScoreColor(
            score
          )}`}
        >
          {score >= 80 ? 'Optimal' : score >= 50 ? 'Améliorable' : 'Surchargé'}
        </span>
      </div>

      {/* Critical Warnings (Missing Vitals & Duplicates) */}
      {(missingVitalWarnings.length > 0 || duplicateWarnings.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5 px-1">
            <ShieldAlert size={14} />
            <span>Points d'Attention Prioritaires</span>
          </h4>

          <div className="space-y-1.5">
            {missingVitalWarnings.map((warning, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-red-100 border border-red-300 flex items-center justify-between gap-2 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2 text-red-950 font-bold">
                  <span className="text-sm">🚨</span>
                  <span>{warning}</span>
                </div>
              </div>
            ))}

            {duplicateWarnings.map((warning, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-amber-100 border border-amber-300 flex items-center gap-2 text-xs text-amber-950 font-bold shadow-2xs"
              >
                <span className="text-sm">⚠️</span>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gear Gaps — Équipements Manquants */}
      {gearGaps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#17402C] dark:text-white flex items-center justify-between px-1">
            <span>Équipements Recommandés Manquants ({gearGaps.length})</span>
            <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E] font-normal">Discret & non intrusif</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {gearGaps.map((gap) => (
              <div
                key={gap.id}
                className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 shadow-xs flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h5 className="text-xs font-bold text-[#17402C] dark:text-white">{gap.name}</h5>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                        gap.priority === 'vital'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}
                    >
                      {gap.priority === 'vital' ? 'VITAL' : 'CONSEILLÉ'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5A7064] dark:text-[#9AAD9E] mt-0.5 leading-tight">{gap.reason}</p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/10">
                  {gap.suggestedProduct && (
                    <span className="text-[10px] font-mono text-[#365233] dark:text-[#9AAD9E] font-semibold">
                      ~{gap.suggestedProduct.priceEur}€ · {gap.suggestedProduct.weightGrams}g
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddMissingItem(gap)}
                    className="ml-auto px-2.5 py-1 rounded-xl bg-[#17402C] hover:bg-[#1f543a] text-white text-[10px] font-bold shadow-2xs active:scale-95 transition-all"
                  >
                    + Ajouter à ma liste
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heavy Items Section */}
      {heavyItemWarnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#17402C] dark:text-white flex items-center gap-1.5 px-1">
            <Scale size={14} />
            <span>Postes Lourds Identifiés ({heavyItemWarnings.length})</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {heavyItemWarnings.map((heavy) => (
              <div
                key={heavy.itemId}
                className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 flex items-center justify-between text-xs shadow-xs"
              >
                <div>
                  <span className="font-bold text-[#17402C] dark:text-white block truncate">{heavy.name}</span>
                  <span className="text-[10px] font-mono text-red-700 dark:text-red-400">
                    {heavy.weightGrams} g (Seuil : {heavy.thresholdGrams} g)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
                  +{heavy.weightGrams - heavy.thresholdGrams} g
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations & Shop Alternatives */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 px-1">
            <Sparkles size={14} />
            <span>Opportunités d'Allègement Ultra-Light</span>
          </h4>

          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div
                key={rec.itemId}
                className="p-4 rounded-3xl bg-emerald-50 dark:bg-[#17402C]/90 backdrop-blur-xl border border-emerald-300 dark:border-emerald-500/40 space-y-2.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-emerald-900 dark:text-emerald-300 font-semibold">
                      Remplacer : {rec.itemName} ({rec.currentWeightGrams} g)
                    </span>
                    <h5 className="text-xs sm:text-sm font-bold text-[#17402C] dark:text-white mt-0.5">
                      ✨ {rec.suggestedName}
                    </h5>
                    <p className="text-[11px] text-[#365233] dark:text-[#9AAD9E] mt-0.5">{rec.reason}</p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-emerald-800 text-white font-mono font-bold text-xs shrink-0">
                    -{rec.weightSavedGrams} g
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-emerald-200 dark:border-emerald-500/20 text-xs">
                  {rec.estimatedPriceEur && (
                    <span className="font-bold text-[#17402C] dark:text-white text-[11px]">
                      Estimé : ~{rec.estimatedPriceEur} €
                    </span>
                  )}

                  <Link
                    href={`/produit/${rec.shopSlug || 'equipement-ultralight'}`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs flex items-center gap-1 transition-all"
                  >
                    <span>Voir l'alternative</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
