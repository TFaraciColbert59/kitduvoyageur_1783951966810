'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import Link from 'next/link';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Button, Card } from '@/components/ui';

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

  const getScoreTone = (val: number) => (val >= 80 ? 'sage' : val >= 50 ? 'warn' : 'danger');

  const handleAddMissingItem = (gap: (typeof gearGaps)[0]) => {
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
    <div className="space-y-[var(--space-4)] animate-in fade-in duration-200">
      <Card className="flex items-center justify-between gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] font-mono text-2xl font-extrabold text-[color:var(--lkv-text-primary)]">
            {score}
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              AUDIT SHAKEDOWN DU SAC
            </span>
            <h3 className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              {score >= 80 ? 'Sac Parfaitement Optimisé' : 'Potentiel d’Allègement'}
            </h3>
            <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
              Gain possible :{' '}
              <strong className="text-[color:var(--lkv-text-primary)]">
                -{potentialWeightSavedGrams} g (-{potentialPercentageSaved}%)
              </strong>
            </p>
          </div>
        </div>

        <Badge tone={getScoreTone(score)}>
          {score >= 80 ? 'Optimal' : score >= 50 ? 'Améliorable' : 'Surchargé'}
        </Badge>
      </Card>

      {(missingVitalWarnings.length > 0 || duplicateWarnings.length > 0) && (
        <div className="space-y-[var(--space-2)]">
          <h4 className="flex items-center gap-[var(--space-2)] px-1 text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-danger-dark)]">
            <Icon name="shield-alert" size={14} />
            <span>Points d&apos;Attention Prioritaires</span>
          </h4>

          <div className="space-y-[var(--space-2)]">
            {missingVitalWarnings.map((warning, idx) => (
              <Card
                key={idx}
                tone="danger"
                className="flex items-center justify-between gap-[var(--space-2)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)]"
              >
                <div className="flex items-center gap-[var(--space-2)] font-bold text-[color:var(--lkv-danger-dark)]">
                  <span aria-hidden="true">🚨</span>
                  <span>{warning}</span>
                </div>
              </Card>
            ))}

            {duplicateWarnings.map((warning, idx) => (
              <Card
                key={idx}
                tone="warn"
                className="flex items-center gap-[var(--space-2)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-warning-dark)]"
              >
                <span aria-hidden="true">⚠️</span>
                <span>{warning}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {gearGaps.length > 0 && (
        <div className="space-y-[var(--space-2)]">
          <h4 className="flex items-center justify-between px-1 text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            <span>Équipements Recommandés Manquants ({gearGaps.length})</span>
            <span className="text-[10px] font-normal text-[color:var(--lkv-text-muted)]">
              Discret & non intrusif
            </span>
          </h4>

          <div className="grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-2">
            {gearGaps.map((gap) => (
              <Card key={gap.id} className="flex flex-col justify-between gap-[var(--space-2)]">
                <div>
                  <div className="flex items-center justify-between gap-[var(--space-2)]">
                    <h5 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                      {gap.name}
                    </h5>
                    <Badge tone={gap.priority === 'vital' ? 'danger' : 'info'}>
                      {gap.priority === 'vital' ? 'VITAL' : 'CONSEILLÉ'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-tight text-[color:var(--lkv-text-muted)]">
                    {gap.reason}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-1)]">
                  {gap.suggestedProduct && (
                    <span className="font-mono text-[10px] font-semibold text-[color:var(--lkv-text-secondary)]">
                      ~{gap.suggestedProduct.priceEur}€ · {gap.suggestedProduct.weightGrams}g
                    </span>
                  )}
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() => handleAddMissingItem(gap)}
                  >
                    + Ajouter à ma liste
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {heavyItemWarnings.length > 0 && (
        <div className="space-y-[var(--space-2)]">
          <h4 className="flex items-center gap-[var(--space-2)] px-1 text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            <Icon name="scale" size={14} />
            <span>Postes Lourds Identifiés ({heavyItemWarnings.length})</span>
          </h4>

          <div className="grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-2">
            {heavyItemWarnings.map((heavy) => (
              <Card
                key={heavy.itemId}
                className="flex items-center justify-between text-[length:var(--lkv-text-footnote)]"
              >
                <div>
                  <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">
                    {heavy.name}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--lkv-danger-dark)]">
                    {heavy.weightGrams} g (Seuil : {heavy.thresholdGrams} g)
                  </span>
                </div>
                <span className="font-mono text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-warning-dark)]">
                  +{heavy.weightGrams - heavy.thresholdGrams} g
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-[var(--space-2)]">
          <h4 className="flex items-center gap-[var(--space-2)] px-1 text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--sage-800)]">
            <Icon name="sparkles" size={14} />
            <span>Opportunités d&apos;Allègement Ultra-Light</span>
          </h4>

          <div className="space-y-[var(--space-2)]">
            {recommendations.map((rec) => (
              <Card key={rec.itemId} tone="sage" className="space-y-[var(--space-3)]">
                <div className="flex items-start justify-between gap-[var(--space-2)]">
                  <div>
                    <span className="font-mono text-[10px] font-semibold uppercase text-[color:var(--sage-800)]">
                      Remplacer : {rec.itemName} ({rec.currentWeightGrams} g)
                    </span>
                    <h5 className="mt-0.5 text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                      ✨ {rec.suggestedName}
                    </h5>
                    <p className="mt-0.5 text-[11px] text-[color:var(--lkv-text-secondary)]">
                      {rec.reason}
                    </p>
                  </div>

                  <Badge tone="sage">-{rec.weightSavedGrams} g</Badge>
                </div>

                <div className="flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)] text-[length:var(--lkv-text-footnote)]">
                  {rec.estimatedPriceEur && (
                    <span className="text-[11px] font-bold text-[color:var(--lkv-text-primary)]">
                      Estimé : ~{rec.estimatedPriceEur} €
                    </span>
                  )}

                  <Link
                    href={`/produit/${rec.shopSlug || 'equipement-ultralight'}`}
                    className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-2)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)] text-[11px] font-bold text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
                  >
                    <span>Voir l&apos;alternative</span>
                    <Icon name="arrow-right" size={12} />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
