'use client';

/**
 * src/features/kit-studio/list/BagListView.tsx
 * Mode Liste citoyen de première classe — parité fonctionnelle 1:1 avec la 3D (Lot L5-4 / C-15 / E-07).
 *
 * Utilisé :
 * 1. Volontairement via le sélecteur persistant 3D / Liste (D-16)
 * 2. Automatiquement pour le rangement intérieur des sacs `openable: false` (ex. duffel-60, C-13)
 * 3. Automatiquement lors d'une dégradation WebGL / performance (`DEGRADED`, C-18 / C-19)
 * 4. En lecture seule lors de l'inspection du kit d'un membre du groupe (`readOnly = true` -> aucun bouton d'édition dans le DOM, E-07)
 */

import React from 'react';
import { Award, Check, Layers, Minus, Package, Plus, Trash2 } from 'lucide-react';
import { DrawerEmpty } from '@/components/ui/drawer';
import { formatWeight, formatWeightSummary } from '../state/selectors';
import type {
  DerivedTotals,
  KitConfiguration,
  KitItem,
  SlotId,
} from '../state/types';
import {
  BUILTIN_BAG_MODELS,
  getAnchorLabel,
  getPartLabel,
  getSlotLabel,
} from '../scene/bag/parts';

export interface BagListViewProps {
  config: KitConfiguration;
  totals: DerivedTotals;
  degradedReason?: string | null;
  readOnly?: boolean;
  ownerLabel?: string | null;
  onToggleChecked?: (itemId: string, isChecked: boolean) => void;
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
  onMoveItem?: (itemId: string, targetSlotId: SlotId | null) => void;
  onRemoveItem?: (itemId: string) => void;
  onOpenDrawer?: (drawer: 'inventaire' | 'personnaliser' | 'insignes' | 'statistiques') => void;
}

export function BagListView({
  config,
  totals,
  degradedReason = null,
  readOnly = false,
  ownerLabel = null,
  onToggleChecked,
  onUpdateQuantity,
  onMoveItem,
  onRemoveItem,
  onOpenDrawer,
}: BagListViewProps) {
  const weightSummary = formatWeightSummary(totals);
  const slotEntries = Object.values(config.slots);
  const bagMeta = BUILTIN_BAG_MODELS.find((m) => m.modelId === config.bag.modelId);
  const unslottedItems = config.items.filter(
    (item) => !item.slotId || !config.slots[item.slotId]
  );

  const customizedPartIds = Object.keys(config.bag.parts);

  const renderItemRow = (item: KitItem) => (
    <div
      key={item.id}
      data-testid={`list-kit-item-${item.id}`}
      className="p-3 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        {!readOnly ? (
          <button
            type="button"
            data-testid={`list-check-item-${item.id}`}
            onClick={() => onToggleChecked?.(item.id, !item.isChecked)}
            aria-pressed={item.isChecked}
            aria-label={
              item.isChecked
                ? `Décocher ${item.name}`
                : `Marquer ${item.name} comme prêt`
            }
            className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
              item.isChecked
                ? 'bg-[var(--hub-action)] border-[var(--hub-action)] text-[var(--hub-text-inverted)]'
                : 'bg-[var(--hub-surface)] border-[var(--hub-border-strong)] text-[var(--hub-text-muted)]'
            }`}
          >
            <Check className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <span
            aria-label={item.isChecked ? 'Objet prêt' : 'Objet prévu'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              item.isChecked
                ? 'bg-[var(--hub-success-bg)] text-[var(--hub-success)]'
                : 'bg-[var(--hub-surface-muted)] text-[var(--hub-text-muted)]'
            }`}
          >
            {item.isChecked ? '✓' : '•'}
          </span>
        )}

        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--hub-text-primary)] truncate">
            {item.name}
          </div>
          <div className="text-xs text-[var(--hub-text-secondary)] flex flex-wrap items-center gap-2">
            <span>{item.category || 'Équipement'}</span>
            <span>•</span>
            <span data-testid={`list-weight-item-${item.id}`}>
              {item.weightG === null ? '—' : formatWeight(item.weightG)}
              {item.weightG === null ? ' (non pesé)' : ''}
            </span>
            <span>•</span>
            <span>Qté {item.quantity}</span>
          </div>
        </div>
      </div>

      {/* E-07 : En lecture seule (kit d'un membre du groupe), AUCUN contrôle d'édition n'est rendu dans le DOM */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="sr-only" htmlFor={`slot-select-${item.id}`}>
            Emplacement pour {item.name}
          </label>
          <select
            id={`slot-select-${item.id}`}
            data-testid={`list-slot-select-${item.id}`}
            value={item.slotId ?? ''}
            onChange={(e) =>
              onMoveItem?.(item.id, e.target.value ? e.target.value : null)
            }
            className="min-h-[44px] px-2.5 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
          >
            <option value="">Non rangé</option>
            {slotEntries.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {getSlotLabel(slot.id)}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center rounded-xl border border-[var(--hub-border)] bg-[var(--hub-surface)]">
            <button
              type="button"
              data-testid={`list-qty-dec-${item.id}`}
              onClick={() =>
                onUpdateQuantity?.(item.id, Math.max(1, item.quantity - 1))
              }
              disabled={item.quantity <= 1}
              aria-label={`Diminuer la quantité de ${item.name}`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--hub-text-primary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
            >
              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <span className="px-2 text-xs font-bold text-[var(--hub-text-primary)]">
              {item.quantity}
            </span>
            <button
              type="button"
              data-testid={`list-qty-inc-${item.id}`}
              onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}
              aria-label={`Augmenter la quantité de ${item.name}`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--hub-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            data-testid={`list-remove-item-${item.id}`}
            onClick={() => onRemoveItem?.(item.id)}
            aria-label={`Retirer ${item.name} du kit`}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[var(--hub-border)] bg-[var(--hub-surface)] text-[var(--hub-danger)] flex items-center justify-center hover:bg-[var(--hub-danger-bg)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      data-testid="kit-studio-list-view"
      className="w-full h-full overflow-y-auto p-4 space-y-4 bg-[var(--hub-surface)] text-[var(--hub-text-primary)]"
    >
      {/* En-tête honnête du mode Liste / Lecture seule / Dégradation */}
      <div className="p-4 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--hub-secondary)]">
              {readOnly
                ? `Consultation lecture seule${ownerLabel ? ` • ${ownerLabel}` : ''}`
                : 'Atelier en mode Liste'}
            </span>
            <h3 className="text-base font-bold text-[var(--hub-primary)]">
              {bagMeta?.label ?? 'Sac en mode Liste'}
              {config.bag.declaredCapacityL !== null
                ? ` (${config.bag.declaredCapacityL} L)`
                : ''}
            </h3>
          </div>

          <div className="text-right">
            <div
              data-testid="list-total-weight"
              className="text-sm font-bold text-[var(--hub-primary)]"
            >
              {weightSummary.primary}
            </div>
            {weightSummary.secondary && (
              <div
                data-testid="list-unknown-weight-notice"
                className="text-xs font-medium text-[var(--hub-warning)]"
              >
                + {weightSummary.secondary}
              </div>
            )}
          </div>
        </div>

        {degradedReason && (
          <p
            data-testid="list-degraded-banner"
            className="text-xs px-3 py-2 rounded-xl bg-[var(--hub-surface-muted)] text-[var(--hub-text-secondary)]"
          >
            Vue Liste active : {degradedReason}. Toutes vos actions d’organisation, de pesée et de personnalisation sont intégralement disponibles.
          </p>
        )}

        {!config.bag.capabilities.openable && config.bag.modelId && (
          <p
            data-testid="list-non-openable-notice"
            className="text-xs px-3 py-2 rounded-xl bg-[var(--hub-surface-muted)] text-[var(--hub-text-secondary)]"
          >
            Ce modèle de sac est monobloc (intérieur non articulé en 3D) : le rangement de son contenu s’effectue directement ici en vue Liste.
          </p>
        )}

        {!readOnly && onOpenDrawer && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenDrawer('inventaire')}
              className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-primary)]"
            >
              <Package className="w-4 h-4" aria-hidden="true" />
              <span>Ajouter / gérer l’inventaire</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenDrawer('personnaliser')}
              className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-[var(--hub-primary)] text-xs font-semibold flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              <span>Personnaliser ({customizedPartIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenDrawer('insignes')}
              className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-[var(--hub-primary)] text-xs font-semibold flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
            >
              <Award className="w-4 h-4" aria-hidden="true" />
              <span>Insignes ({config.placedBadges.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Résumé des pièces personnalisées et insignes posés */}
      {(customizedPartIds.length > 0 || config.placedBadges.length > 0) && (
        <div className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2">
          {customizedPartIds.length > 0 && (
            <div className="text-xs text-[var(--hub-text-secondary)]">
              <strong className="text-[var(--hub-text-primary)]">Pièces personnalisées : </strong>
              {customizedPartIds.map((pid) => getPartLabel(pid)).join(', ')}
            </div>
          )}
          {config.placedBadges.length > 0 && (
            <div className="text-xs text-[var(--hub-text-secondary)]">
              <strong className="text-[var(--hub-text-primary)]">Insignes épinglés : </strong>
              {config.placedBadges
                .map((b) => `${b.badgeId} (${getAnchorLabel(b.anchorId)})`)
                .join(', ')}
            </div>
          )}
        </div>
      )}

      {/* État vide honnête (D-03) */}
      {config.items.length === 0 ? (
        <div className="p-6 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucun objet dans ce kit"
            hint={
              readOnly
                ? 'Ce membre n’a pas encore ajouté d’équipement à son sac partagé.'
                : 'Ouvrez le tiroir Inventaire pour ajouter vos équipements réels.'
            }
          />
        </div>
      ) : (
        <div className="space-y-4 pb-20">
          {/* Articles non rangés */}
          {unslottedItems.length > 0 && (
            <section className="space-y-2" aria-label="Objets non rangés">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
                  Non rangé ({unslottedItems.length})
                </h4>
              </div>
              <div className="space-y-2">{unslottedItems.map(renderItemRow)}</div>
            </section>
          )}

          {/* Emplacements du sac */}
          {slotEntries.map((slot) => {
            const slotItems = config.items.filter((i) => i.slotId === slot.id);
            return (
              <section
                key={slot.id}
                data-testid={`list-slot-group-${slot.id}`}
                className="space-y-2"
                aria-label={getSlotLabel(slot.id)}
              >
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
                    {getSlotLabel(slot.id)} ({slotItems.length}
                    {slot.maxItems ? `/${slot.maxItems}` : ''})
                  </h4>
                  {slot.capacityL !== null && (
                    <span className="text-xs text-[var(--hub-text-subtle)]">
                      {slot.capacityL} L
                    </span>
                  )}
                </div>

                {slotItems.length === 0 ? (
                  <div className="px-3.5 py-2.5 rounded-2xl border border-dashed border-[var(--hub-border)] text-xs text-[var(--hub-text-muted)]">
                    Emplacement libre
                  </div>
                ) : (
                  <div className="space-y-2">{slotItems.map(renderItemRow)}</div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
