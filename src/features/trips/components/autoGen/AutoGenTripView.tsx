'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { TripBriefBar } from './TripBriefBar';
import { ProposalCard } from './ProposalCard';
import { PersistentMetricsBar } from './PersistentMetricsBar';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';
import { runAutoGenPipeline } from '@/features/trips/engine/autoGenPipeline';
import type { TripBrief } from '@/features/trips/schemas/autoGen.schema';
import { Card } from '@/components/ui';

export interface AutoGenTripViewProps {
  initialBriefInput?: string;
  layers?: Record<string, Proposal<any>>;
  tradeoffsLog?: string[];
  onCompleteTrip?: (tripData: {
    layers: Record<string, Proposal<any>>;
    brief?: TripBrief | null;
  }) => void;
}

export const AutoGenTripView: React.FC<AutoGenTripViewProps> = ({
  initialBriefInput = '',
  layers: initialLayers = {},
  tradeoffsLog: initialTradeoffs = [],
  onCompleteTrip,
}) => {
  const [layers, setLayers] = useState<Record<string, Proposal<any>>>(initialLayers);
  const [tradeoffsLog, setTradeoffsLog] = useState<string[]>(initialTradeoffs);
  const [lastBrief, setLastBrief] = useState<TripBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (query: string) => {
    setIsGenerating(true);
    try {
      const output = await runAutoGenPipeline(query);
      setLayers(output.layers);
      setTradeoffsLog(output.tradeoffsLog);
      setLastBrief(output.brief ?? null);
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
    <div className="min-h-screen w-full bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset pb-32">
      {/* Barre supérieure : Saisie d'intention */}
      <div className="sticky top-0 z-[var(--z-sticky)] border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] saturate-[var(--glass-sat)] lkv-rim-inset px-4 py-4 backdrop-blur-[var(--glass-blur-sm)]">
        <TripBriefBar
          initialValue={initialBriefInput}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Journal de compromis (Tradeoffs Log) */}
        {tradeoffsLog.length > 0 && (
          <Card tone="sage" className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
            <div className="mb-1 flex items-center gap-[var(--space-2)] font-semibold text-[color:var(--lkv-primary-soft)]">
              <Icon name="sparkles" size={16} />
              <span>Optimisations & Compromis Déterministes Appliqués :</span>
            </div>
            {tradeoffsLog.map((log, idx) => (
              <div key={idx} className="flex items-start gap-[var(--space-2)] pl-1">
                <span className="font-bold text-[color:var(--lkv-secondary)]">•</span>
                <span>{log}</span>
              </div>
            ))}
          </Card>
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
        onValidate={() => onCompleteTrip && onCompleteTrip({ layers, brief: lastBrief })}
      />
    </div>
  );
};
