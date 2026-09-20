'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { usePreparationStore } from '../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Card, HeaderBackButton, PageHeader } from '@/components/ui';

/**
 * PreparationHeader — en-tête de préparation : retour canonique, identité du
 * trek, statut de complétude et télémétrie de charge.
 */
export function PreparationHeader() {
  const { trekName, destination, getPreparationStats, getWeightBreakdown } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const stats = getPreparationStats();
  const breakdown = getWeightBreakdown();
  const totalPackKg = (breakdown.totalPackWeightGrams / 1000).toFixed(1);

  const cleanDestination = trekName
    ? trekName.replace(/\s*\(copie\)/gi, '').trim()
    : 'Préparation Trek';

  const statusTone =
    stats.overallScore >= 70 ? 'sage' : stats.overallScore < 40 ? 'danger' : 'warn';

  return (
    <div className="flex w-full shrink-0 flex-col gap-[var(--space-3)]">
      <PageHeader
        back={
          <HeaderBackButton
            fallbackHref="/hub/depart"
            label="Retour au Hub"
            onClick={() => triggerHaptic('light')}
          />
        }
        title={
          <span className="flex items-center gap-[var(--space-2)]">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--lkv-action)]"
            />
            <span className="truncate">{cleanDestination}</span>
          </span>
        }
        subtitle={destination}
        actions={<Badge tone={statusTone}>{stats.statusLabel}</Badge>}
      />

      <Card className="space-y-[var(--space-3)]">
        <div className="flex items-center justify-between text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Icon name="sparkles" size={15} className="text-[color:var(--sage-600)]" />
            <span>Complétude globale</span>
          </div>
          <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
            {stats.overallScore}%
          </span>
        </div>

        <div className="relative h-3 w-full overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)] p-0.5 shadow-inner">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--sage-600),var(--lkv-action))] transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(4, stats.overallScore))}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-[var(--space-2)] pt-0.5 text-center font-mono text-[10px] font-semibold">
          <Card variant="compact" className="flex flex-col items-center">
            <span className="text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              Sac (Dos)
            </span>
            <span className="font-bold text-[color:var(--lkv-text-primary)]">{totalPackKg} kg</span>
          </Card>
          <Card variant="compact" className="flex flex-col items-center">
            <span className="text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              Dans le sac
            </span>
            <span className="font-bold text-[color:var(--lkv-text-primary)]">
              {stats.packedCount}/{stats.totalCount}
            </span>
          </Card>
          <Card variant="compact" className="flex flex-col items-center">
            <span className="text-[9px] uppercase text-[color:var(--lkv-text-muted)]">Vitaux</span>
            <span className="font-bold text-[color:var(--lkv-text-primary)]">
              {stats.vitalPackedCount}/{stats.vitalCount}
            </span>
          </Card>
          <Card variant="compact" className="flex flex-col items-center">
            <span className="text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              À acheter
            </span>
            <span className="font-bold text-[color:var(--lkv-warning-dark)]">
              {stats.toBuyCount}
            </span>
          </Card>
        </div>
      </Card>
    </div>
  );
}
