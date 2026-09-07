'use client';

import React, { useState } from 'react';
import { TripBriefBar } from './TripBriefBar';
import { ProposalCard } from './ProposalCard';
import { PersistentMetricsBar } from './PersistentMetricsBar';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';
import { runAutoGenPipeline } from '@/features/trips/engine/autoGenPipeline';
import { Sparkles } from 'lucide-react';

export interface AutoGenTripViewProps {
  initialBriefInput?: string;
  layers?: Record<string, Proposal<any>>;
  tradeoffsLog?: string[];
  onCompleteTrip?: (tripData: any) => void;
}

export const AutoGenTripView: React.FC<AutoGenTripViewProps> = ({
  initialBriefInput = '',
  layers: initialLayers = {},
  tradeoffsLog: initialTradeoffs = [],
  onCompleteTrip,
}) => {
  const [layers, setLayers] = useState<Record<string, Proposal<any>>>(initialLayers);
  const [tradeoffsLog, setTradeoffsLog] = useState<string[]>(initialTradeoffs);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (query: string) => {
    setIsGenerating(true);
    try {
      const output = await runAutoGenPipeline(query);
      setLayers(output.layers);
      setTradeoffsLog(output.tradeoffsLog);
    } catch (err) {
      console.error('Error generating trip:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLockToggle = (proposalId: string, locked: boolean) => {
    setLayers((prev) => {
      const next = { ...prev };
      for (const [k, p] of Object.entries(next)) {
        if (p.id === proposalId) {
          next[k] = { ...p, locked };
          break;
        }
      }
      return next;
    });
  };

  const handleSelectAlternative = (proposalId: string, altIndex: number) => {
    setLayers((prev) => {
      const next = { ...prev };
      for (const [k, p] of Object.entries(next)) {
        if (p.id === proposalId) {
          const allOptions = [p, ...(p.alternatives || [])];
          const selected = allOptions[altIndex];
          if (selected) {
            next[k] = {
              ...selected,
              alternatives: allOptions.filter((_, idx) => idx !== altIndex),
            };
          }
          break;
        }
      }
      return next;
    });
  };

  // Recalcul des métriques en temps réel
  const accomPrice = layers.accommodations?.value?.priceEur || 0;
  const budgetValue = layers.budget?.value?.totalPerPersonEur || layers.budget?.value?.totalEur;
  const totalBudgetEur = budgetValue || accomPrice || 350;
  const maxBudgetEur = layers.budget?.value?.maxTargetEur || 500;

  const kitWeight = layers.kit?.value?.targetWeightKg || 8.0;
  const totalWeightKg = kitWeight;
  const maxWeightKg = 14.0; // 20% de 70kg

  return (
    <div className="w-full min-h-screen bg-stone-50 dark:bg-stone-950 pb-32">
      {/* Barre supérieure : Saisie d'intention */}
      <div className="sticky top-0 z-30 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 py-4 px-4">
        <TripBriefBar
          initialValue={initialBriefInput}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Journal de compromis (Tradeoffs Log) */}
        {tradeoffsLog.length > 0 && (
          <div className="rounded-2xl p-4 bg-forest-50/70 dark:bg-forest-950/30 border border-forest-200 dark:border-forest-800/60 text-xs text-forest-900 dark:text-forest-200 space-y-1.5">
            <div className="flex items-center font-semibold text-forest-800 dark:text-forest-300 gap-1.5 mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Optimisations & Compromis Déterministes Appliqués :</span>
            </div>
            {tradeoffsLog.map((log, idx) => (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-forest-500 font-bold">•</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}

        {/* Grille des 12 couches fonctionnelles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(layers).map(([layerKey, proposal]) => (
            <ProposalCard
              key={proposal.id || layerKey}
              proposal={proposal}
              onLockToggle={handleLockToggle}
              onSelectAlternative={handleSelectAlternative}
            />
          ))}
        </div>
      </div>

      {/* Barre d'état persistance basse */}
      <PersistentMetricsBar
        totalBudgetEur={totalBudgetEur}
        maxBudgetEur={maxBudgetEur}
        totalWeightKg={totalWeightKg}
        maxWeightKg={maxWeightKg}
        onValidate={() => onCompleteTrip && onCompleteTrip({ layers })}
      />
    </div>
  );
};
