'use client';

import React from 'react';
import Link from 'next/link';
import { ShakedownReport } from '../types/gear.types';

interface ShakedownAuditViewProps {
  report: ShakedownReport;
}

export const ShakedownAuditView: React.FC<ShakedownAuditViewProps> = ({ report }) => {
  const {
    score,
    potentialWeightSavedGrams,
    potentialPercentageSaved,
    duplicateWarnings,
    missingVitalWarnings,
    heavyItemWarnings,
    recommendations,
  } = report;

  const getScoreColor = (val: number) => {
    if (val >= 80) return '#16A34A';
    if (val >= 50) return '#D97706';
    return '#DC2626';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Shakedown Score Banner */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-2xl font-mono shadow-md flex-shrink-0"
            style={{
              backgroundColor: `${getScoreColor(score)}15`,
              color: getScoreColor(score),
              border: `2px solid ${getScoreColor(score)}40`,
            }}
          >
            {score}
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
              SCORE D'OPTIMISATION DU SAC
            </span>
            <h3 className="text-lg font-bold text-[#17402C] dark:text-[#E7E3D6]">
              {score >= 80 ? 'Sac Parfaitement Équilibré' : 'Gain de Poids Recommandé'}
            </h3>
            <p className="text-xs text-[#5A7064] dark:text-[#9AAD9E]">
              Potentiel d'allègement :{' '}
              <strong className="text-[#17402C] dark:text-[#E7E3D6]">
                -{potentialWeightSavedGrams} g (-{potentialPercentageSaved}%)
              </strong>
            </p>
          </div>
        </div>

        <div className="text-right">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${getScoreColor(score)}20`,
              color: getScoreColor(score),
            }}
          >
            {score >= 80 ? 'Optimisé' : score >= 50 ? 'Améliorable' : 'Surchargé'}
          </span>
        </div>
      </div>

      {/* Critical Warnings (Missing Vitals & Duplicates) */}
      {(missingVitalWarnings.length > 0 || duplicateWarnings.length > 0) && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-widest text-red-600 dark:text-red-400">
            Points d'Attention Prioritaires
          </h4>

          <div className="space-y-2">
            {missingVitalWarnings.map((warning, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-red-500/10 dark:bg-red-950/30 border border-red-500/30 flex items-center gap-3 text-xs"
              >
                <span className="text-base">🚨</span>
                <span className="font-semibold text-red-800 dark:text-red-300 flex-1">
                  {warning}
                </span>
                <Link
                  href="/materiel"
                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 transition-colors"
                >
                  Ajouter
                </Link>
              </div>
            ))}

            {duplicateWarnings.map((warning, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 flex items-center gap-3 text-xs"
              >
                <span className="text-base">⚠️</span>
                <span className="font-semibold text-amber-800 dark:text-amber-300 flex-1">
                  {warning}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heavy Items Section */}
      {heavyItemWarnings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
            Postes Lourds Identifiés ({heavyItemWarnings.length})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {heavyItemWarnings.map((heavy) => (
              <div
                key={heavy.itemId}
                className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[#17402C] dark:text-[#E7E3D6] block truncate">
                    {heavy.name}
                  </span>
                  <span className="text-[11px] font-mono text-red-600 dark:text-red-400">
                    {heavy.weightGrams} g (Seuil opti : {heavy.thresholdGrams} g)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-600">
                  +{heavy.weightGrams - heavy.thresholdGrams} g
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations & Shop Alternatives */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Recommandations d'Allègement Ultra-Light
          </h4>

          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.itemId}
                className="p-4 rounded-3xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-300">
                      Remplacer : {rec.itemName} ({rec.currentWeightGrams} g)
                    </span>
                    <h5 className="text-sm font-bold text-[#17402C] dark:text-[#E7E3D6] mt-0.5">
                      ✨ {rec.suggestedName}
                    </h5>
                    <p className="text-xs text-[#5A7064] dark:text-[#9AAD9E] mt-1">
                      {rec.reason}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-mono font-bold text-xs">
                      -{rec.weightSavedGrams} g
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20 text-xs">
                  {rec.estimatedPriceEur && (
                    <span className="font-bold text-[#17402C] dark:text-[#E7E3D6]">
                      Prix estimé : ~{rec.estimatedPriceEur} €
                    </span>
                  )}

                  <Link
                    href={`/produit/${rec.shopSlug || 'equipement-ultralight'}`}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    Voir l'alternative en boutique →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
