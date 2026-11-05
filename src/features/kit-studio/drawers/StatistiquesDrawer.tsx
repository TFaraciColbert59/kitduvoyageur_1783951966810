'use client';

/**
 * src/features/kit-studio/drawers/StatistiquesDrawer.tsx
 * Tiroir Statistiques du Kit Studio (Lot L6-3 / C-03, D-08..D-11).
 *
 * Règles d'intégrité des mesures :
 * - D-08 : Unités explicites en `g` ou `kg` sur chaque masse affichée.
 * - C-03 : Objets sans poids comptés à part (« + N objets non pesés »), jamais assimilés à 0 g.
 * - D-09 : Aucun affichage de jauge ni de capacité volumique lorsque `declaredCapacityL` ou `volumeEstimateL` vaut `null`.
 * - D-10 : Aucune note synthétique ni qualificatif normatif sur le sac.
 * - D-11 : Comparaison côte à côte de deux variantes conservées sans écrasement.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bookmark, GitCompare, Trash2 } from 'lucide-react';
import { DrawerEmpty, DrawerShell, type DrawerTab } from '@/components/ui/drawer';
import { formatWeight, selectDerivedTotals } from '../state/selectors';
import type { DerivedTotals, KitConfiguration } from '../state/types';

export interface KitComparisonSnapshot {
  id: string;
  label: string;
  capturedAtIso: string;
  revision: number;
  bagModelId: string | null;
  knownWeightG: number;
  checkedWeightG: number;
  unknownWeightCount: number;
  itemCount: number;
  checkedCount: number;
  itemNames: string[];
}

export interface CategoryWeightRow {
  category: string;
  knownWeightG: number;
  itemCount: number;
  unknownCount: number;
}

export function computeCheckedKnownWeightG(config: KitConfiguration): number {
  let sum = 0;
  for (const item of config.items) {
    if (!item.isChecked) continue;
    const qty = Math.max(1, item.quantity ?? 1);
    if (typeof item.weightG === 'number' && Number.isFinite(item.weightG)) {
      sum += Math.max(0, item.weightG) * qty;
    }
  }
  return sum;
}

export function computeCategoryBreakdown(config: KitConfiguration): CategoryWeightRow[] {
  const map = new Map<string, CategoryWeightRow>();

  for (const item of config.items) {
    const cat = item.category || 'Équipement';
    const qty = Math.max(1, item.quantity ?? 1);
    const row = map.get(cat) ?? {
      category: cat,
      knownWeightG: 0,
      itemCount: 0,
      unknownCount: 0,
    };
    row.itemCount += qty;
    if (typeof item.weightG === 'number' && Number.isFinite(item.weightG)) {
      row.knownWeightG += Math.max(0, item.weightG) * qty;
    } else {
      row.unknownCount += qty;
    }
    map.set(cat, row);
  }

  return Array.from(map.values()).sort((a, b) => b.knownWeightG - a.knownWeightG);
}

export function createConfigSnapshot(
  config: KitConfiguration,
  label: string
): KitComparisonSnapshot {
  const totals = selectDerivedTotals(config);
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    label: label.trim() || `Variante rév. ${config.revision}`,
    capturedAtIso: new Date().toISOString(),
    revision: config.revision,
    bagModelId: config.bag.modelId,
    knownWeightG: totals.knownWeightG,
    checkedWeightG: computeCheckedKnownWeightG(config),
    unknownWeightCount: totals.unknownWeightCount,
    itemCount: totals.itemCount,
    checkedCount: totals.checkedCount,
    itemNames: config.items.map((i) => i.name),
  };
}

export function formatSignedWeightDelta(deltaG: number): string {
  if (deltaG === 0) return '0 g';
  const sign = deltaG > 0 ? '+' : '−';
  return `${sign} ${formatWeight(Math.abs(deltaG))}`;
}

const SNAPSHOT_STORAGE_PREFIX = 'lkdv_studio_snapshots_';

export interface StatistiquesDrawerProps {
  config: KitConfiguration;
  totals: DerivedTotals;
}

export function StatistiquesDrawer({ config, totals }: StatistiquesDrawerProps) {
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [snapshots, setSnapshots] = useState<KitComparisonSnapshot[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState<string>('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const storageKey = `${SNAPSHOT_STORAGE_PREFIX}${config.kitId}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSnapshots(parsed);
          if (parsed[0]?.id) {
            setSelectedSnapshotId(parsed[0].id);
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const persistSnapshots = (next: KitComparisonSnapshot[]) => {
    setSnapshots(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  };

  const handlePinSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const snap = createConfigSnapshot(
      config,
      snapshotLabel || `Variante #${snapshots.length + 1}`
    );
    const next = [snap, ...snapshots];
    persistSnapshots(next);
    setSelectedSnapshotId(snap.id);
    setSnapshotLabel('');
  };

  const handleDeleteSnapshot = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    persistSnapshots(next);
    if (selectedSnapshotId === id) {
      setSelectedSnapshotId(next[0]?.id ?? null);
    }
  };

  const checkedKnownWeightG = useMemo(
    () => computeCheckedKnownWeightG(config),
    [config]
  );
  const categoryRows = useMemo(() => computeCategoryBreakdown(config), [config]);

  // D-09 : Le volume n'est affiché QUE si la capacité déclarée ET l'estimation modélisée sont toutes deux fiables (non-null)
  const hasReliableVolume =
    typeof config.bag.declaredCapacityL === 'number' &&
    config.bag.declaredCapacityL > 0 &&
    typeof totals.volumeEstimateL === 'number' &&
    totals.volumeEstimateL > 0;

  const activeComparison =
    snapshots.find((s) => s.id === selectedSnapshotId) ?? snapshots[0] ?? null;

  const renderMetricsPane = () => (
    <div data-testid="studio-statistiques-pane" className="space-y-4 pb-8">
      {/* Cartes de pesée : masse prévue vs masse cochée + alerte objets non pesés (C-03, D-08) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
            Masse connue prévue
          </span>
          <div
            data-testid="stats-known-weight"
            className="text-lg font-bold text-[var(--hub-primary)]"
          >
            {totals.itemCount > 0 && totals.knownWeightG === 0 && totals.unknownWeightCount > 0
              ? '—'
              : formatWeight(totals.knownWeightG)}
          </div>
          <div className="text-[11px] text-[var(--hub-text-secondary)]">
            {totals.itemCount} unité{totals.itemCount > 1 ? 's' : ''} inscrite
            {totals.itemCount > 1 ? 's' : ''}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
            Masse prête (cochée)
          </span>
          <div
            data-testid="stats-checked-weight"
            className="text-lg font-bold text-[var(--hub-action)]"
          >
            {formatWeight(checkedKnownWeightG)}
          </div>
          <div className="text-[11px] text-[var(--hub-text-secondary)]">
            {totals.checkedCount} / {totals.itemCount} prêt{totals.checkedCount > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* C-03 : Mention explicite et visible des objets sans poids */}
      {totals.unknownWeightCount > 0 && (
        <div
          data-testid="stats-unknown-weight-banner"
          role="status"
          className="p-3.5 rounded-2xl bg-[var(--hub-warning-bg)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)]"
        >
          + {totals.unknownWeightCount} objet{totals.unknownWeightCount > 1 ? 's' : ''} non pesé
          {totals.unknownWeightCount > 1 ? 's' : ''} — masse exclue du total ci-dessus.
        </div>
      )}

      {/* D-09 : Volume affiché UNIQUEMENT lorsque fiable ; RIEN affiché lorsque null */}
      {hasReliableVolume ? (
        <section
          data-testid="stats-volume-section"
          className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--hub-primary)]">
              Capacité compartimentée modélisée
            </span>
            <span className="font-semibold text-[var(--hub-text-secondary)]">
              {totals.volumeEstimateL} L / {config.bag.declaredCapacityL} L déclarés
            </span>
          </div>
        </section>
      ) : null}

      {/* Répartition par catégorie avec unités explicites (D-08) */}
      <section className="space-y-2" aria-label="Répartition par catégorie">
        <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
          Répartition par famille
        </h4>

        {categoryRows.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
            <DrawerEmpty
              title="Aucune donnée de masse"
              hint="Ajoutez des équipements à votre sac pour consulter leur répartition par catégorie."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {categoryRows.map((row) => (
              <div
                key={row.category}
                data-testid={`stats-category-${row.category}`}
                className="p-3 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-bold text-[var(--hub-text-primary)]">{row.category}</div>
                  <div className="text-[var(--hub-text-secondary)]">
                    {row.itemCount} objet{row.itemCount > 1 ? 's' : ''}
                    {row.unknownCount > 0
                      ? ` • + ${row.unknownCount} non pesé${row.unknownCount > 1 ? 's' : ''}`
                      : ''}
                  </div>
                </div>
                <div className="font-bold text-[var(--hub-primary)] shrink-0">
                  {row.knownWeightG === 0 && row.unknownCount > 0
                    ? '—'
                    : formatWeight(row.knownWeightG)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderComparePane = () => {
    const weightDeltaG = activeComparison
      ? totals.knownWeightG - activeComparison.knownWeightG
      : 0;
    const itemDelta = activeComparison
      ? totals.itemCount - activeComparison.itemCount
      : 0;

    return (
      <div data-testid="studio-compare-pane" className="space-y-4 pb-8">
        {/* Épinglage d'une variante sans écraser l'état courant (D-11) */}
        <form
          onSubmit={handlePinSnapshot}
          className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--hub-secondary)]">
            Conserver un repère de comparaison
          </div>
          <div className="flex gap-2">
            <label htmlFor="snap-label-input" className="sr-only">
              Nom de la variante
            </label>
            <input
              id="snap-label-input"
              data-testid="stats-snapshot-label-input"
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="Ex. Configuration bivouac été…"
              className="flex-1 min-h-[44px] px-3 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
            />
            <button
              type="submit"
              data-testid="stats-pin-snapshot-btn"
              className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <Bookmark className="w-4 h-4" aria-hidden="true" />
              <span>Épingler</span>
            </button>
          </div>
        </form>

        {snapshots.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
            <DrawerEmpty
              title="Aucune variante épinglée"
              hint="Épinglez l’état actuel avant de modifier votre sac : les deux configurations resteront consultables côte à côte."
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {snapshots.map((snap) => {
                const selected = activeComparison?.id === snap.id;
                return (
                  <div key={snap.id} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      data-testid={`stats-select-snapshot-${snap.id}`}
                      aria-pressed={selected}
                      onClick={() => setSelectedSnapshotId(snap.id)}
                      className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold ${
                        selected
                          ? 'bg-[var(--hub-primary)] border-[var(--hub-primary)] text-[var(--hub-text-inverted)]'
                          : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)] text-[var(--hub-text-primary)]'
                      }`}
                    >
                      {snap.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      aria-label={`Supprimer le repère ${snap.label}`}
                      className="min-h-[44px] min-w-[44px] rounded-xl border border-[var(--hub-border)] bg-[var(--hub-surface)] text-[var(--hub-text-muted)] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            {activeComparison && (
              <div
                data-testid="stats-comparison-grid"
                className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--hub-surface)] space-y-1">
                    <div className="font-bold text-[var(--hub-text-muted)] uppercase text-[10px]">
                      Repère conservé
                    </div>
                    <div className="font-bold text-sm text-[var(--hub-primary)]">
                      {activeComparison.label}
                    </div>
                    <div>Masse : {formatWeight(activeComparison.knownWeightG)}</div>
                    <div>Objets : {activeComparison.itemCount}</div>
                    {activeComparison.unknownWeightCount > 0 && (
                      <div className="text-[var(--hub-warning)]">
                        + {activeComparison.unknownWeightCount} non pesé(s)
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--hub-primary-subtle)] space-y-1">
                    <div className="font-bold text-[var(--hub-primary)] uppercase text-[10px]">
                      Sac actuel (rév. {config.revision})
                    </div>
                    <div className="font-bold text-sm text-[var(--hub-primary)]">
                      En édition
                    </div>
                    <div>Masse : {formatWeight(totals.knownWeightG)}</div>
                    <div>Objets : {totals.itemCount}</div>
                    {totals.unknownWeightCount > 0 && (
                      <div className="text-[var(--hub-warning)]">
                        + {totals.unknownWeightCount} non pesé(s)
                      </div>
                    )}
                  </div>
                </div>

                <div
                  data-testid="stats-comparison-delta"
                  className="pt-2 border-t border-[var(--hub-border-subtle)] flex items-center justify-between font-semibold text-[var(--hub-text-primary)]"
                >
                  <span>Écart par rapport au repère :</span>
                  <span>
                    {formatSignedWeightDelta(weightDeltaG)} ({itemDelta >= 0 ? `+${itemDelta}` : itemDelta} obj.)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const tabs: DrawerTab[] = [
    {
      id: 'pesee',
      label: 'Pesée & Répartition',
      icon: <BarChart3 className="w-4 h-4" aria-hidden="true" />,
      render: renderMetricsPane,
    },
    {
      id: 'comparer',
      label: 'Comparer',
      icon: <GitCompare className="w-4 h-4" aria-hidden="true" />,
      render: renderComparePane,
    },
  ];

  return <DrawerShell tabs={tabs} activeIndex={tabIndex} onIndexChange={setTabIndex} />;
}
