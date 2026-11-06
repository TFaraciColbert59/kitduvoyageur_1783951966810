'use client';

/**
 * src/features/kit-studio/drawers/acquisition/AcquisitionPane.tsx
 * Volet Acquisition & Prêts entre membres dans le tiroir Inventaire (Lot L7-4 / F-01..F-06).
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, Eye, Handshake, ShoppingBag, X } from 'lucide-react';
import { DrawerEmpty } from '@/components/ui/drawer';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { formatWeight } from '../../state/selectors';
import type { KitConfiguration, KitItem } from '../../state/types';
import {
  buildRealTransactionAction,
  createPlannedReservation,
  createTransientPreview,
  formatMemberLoan,
  getCatalogStockReason,
  type AcquisitionCatalogItem,
  type MemberLoanRecord,
  type TransientPreviewResult,
} from './acquisitionEngine';

export interface AcquisitionPaneProps {
  config: KitConfiguration;
  catalogItems?: AcquisitionCatalogItem[];
  loans?: MemberLoanRecord[];
  onAddPlannedItem: (item: Omit<KitItem, 'slotOrder'>) => Promise<void> | void;
}

export function AcquisitionPane({
  config,
  catalogItems = [],
  loans = [],
  onAddPlannedItem,
}: AcquisitionPaneProps) {
  const { haptic } = useHapticFeedback();
  const [activePreview, setActivePreview] = useState<TransientPreviewResult | null>(null);
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);

  const handlePreview = (item: AcquisitionCatalogItem) => {
    haptic('light');
    const { preview } = createTransientPreview(item, config);
    setActivePreview(preview);
  };

  const handlePlanItem = async (item: AcquisitionCatalogItem) => {
    haptic('light');
    const planned = createPlannedReservation(item, null);
    await onAddPlannedItem(planned.item);
    setReservationNotice(
      `« ${item.name} » ajouté au kit avec le statut « prévu » (non possédé).`
    );
  };

  const handleAddLoanToKit = async (loan: MemberLoanRecord) => {
    const view = formatMemberLoan(loan);
    if (!view.canAddAsLoanedToKit) return;
    haptic('light');
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `loan-${loan.id}`;
    await onAddPlannedItem({
      id,
      productOwnershipId: null,
      name: `${loan.itemName} (prêt de ${loan.ownerName})`,
      category: loan.category,
      quantity: 1,
      weightG: view.weightG,
      weightSource: view.weightG !== null ? 'declared' : 'unknown',
      isChecked: loan.status === 'active',
      slotId: null,
      visual: null,
    });
    setReservationNotice(
      `Prêt de ${loan.ownerName} (« ${loan.itemName} », retour le ${loan.dueDate}) inscrit au sac.`
    );
  };

  return (
    <div data-testid="studio-acquisition-pane" className="space-y-5 pb-8 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
      {/* Bandeau d'aperçu éphémère (F-01 : zéro écriture dans le kit) */}
      {activePreview && (
        <div
          data-testid="acquisition-preview-banner"
          role="status"
          className="p-3.5 rounded-2xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-border)] flex items-start justify-between gap-3"
        >
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--hub-primary)]">
              Aperçu temporaire (non ajouté au sac)
            </div>
            <div className="text-sm font-semibold text-[var(--hub-text-primary)]">
              {activePreview.name} •{' '}
              {activePreview.weightG !== null
                ? formatWeight(activePreview.weightG)
                : '— (poids non communiqué)'}
            </div>
            <p className="text-xs text-[var(--hub-text-secondary)]">
              Simulation de masse uniquement : votre inventaire et votre kit restent inchangés.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setActivePreview(null);
            }}
            aria-label="Fermer l’aperçu temporaire"
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[var(--hub-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {reservationNotice && (
        <div
          data-testid="acquisition-reservation-notice"
          role="status"
          className="p-3 rounded-2xl bg-[var(--hub-surface-muted)] border border-[var(--hub-border)] text-xs text-[var(--hub-text-primary)]"
        >
          {reservationNotice}
        </div>
      )}

      {/* 1. Prêts entre membres (F-06 : propriétaire, durée, restitution, permissions) */}
      <section className="space-y-2.5" aria-label="Prêts de matériel entre membres">
        <div className="flex items-center gap-2 px-1">
          <Handshake className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
            Prêts entre coéquipiers ({loans.length})
          </h4>
        </div>

        {loans.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs text-[var(--hub-text-secondary)]">
            Aucun prêt actif enregistré pour votre compte sur cette sortie.
          </div>
        ) : (
          <div className="space-y-2.5">
            {loans.map((loan) => {
              const formatted = formatMemberLoan(loan);
              return (
                <div
                  key={loan.id}
                  data-testid={`acquisition-loan-${loan.id}`}
                  className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[var(--hub-text-primary)]">
                        {formatted.itemName}
                      </div>
                      <div className="text-xs text-[var(--hub-text-secondary)]">
                        Propriétaire : <strong>{formatted.ownerName}</strong> •{' '}
                        {formatted.weightG !== null ? formatWeight(formatted.weightG) : '—'}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--hub-surface-muted)] text-[var(--hub-primary)]">
                      {formatted.statusLabel}
                    </span>
                  </div>

                  <div className="text-xs text-[var(--hub-text-secondary)] space-y-0.5">
                    <div>
                      Durée : <strong>{formatted.durationDays} j</strong> • Restitution prévue le{' '}
                      <strong>{formatted.dueDateIso}</strong>
                    </div>
                    <div>Permissions : {formatted.permissionsLabel}</div>
                  </div>

                  {formatted.canAddAsLoanedToKit ? (
                    <button
                      type="button"
                      data-testid={`loan-pack-btn-${loan.id}`}
                      onClick={() => handleAddLoanToKit(loan)}
                      className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-primary)]"
                    >
                      <BookmarkPlus className="w-4 h-4" aria-hidden="true" />
                      <span>Inscrire ce prêt dans mon sac</span>
                    </button>
                  ) : (
                    <p className="text-xs text-[var(--hub-text-muted)]">
                      Non emportable dans le sac ({formatted.statusLabel.toLowerCase()}).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Catalogue Boutique : Aperçu / Réservation « prévu » / Transaction Stripe réelle (F-01..F-05) */}
      <section className="space-y-2.5" aria-label="Catalogue matériel">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
              Compléter le kit (Aperçu • Prévu • Boutique)
            </h4>
          </div>
          <Link
            href="/boutique"
            className="min-h-[44px] inline-flex items-center px-2 text-xs font-semibold text-[var(--hub-action)] underline"
          >
            Ouvrir la boutique
          </Link>
        </div>

        {catalogItems.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
            <DrawerEmpty
              title="Aucun produit suggéré chargé"
              hint="Consultez la Boutique LKDV pour acquérir un équipement vérifié : aucun achat fictif n’est émis depuis l’atelier."
              action={
                <Link
                  href="/boutique"
                  className="min-h-[44px] px-4 rounded-full bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center justify-center"
                >
                  Parcourir la Boutique
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {catalogItems.map((item) => {
              const stockReason = getCatalogStockReason(item);
              const tx = buildRealTransactionAction(item, config.kitId);
              const priceLabel =
                typeof item.priceCents === 'number'
                  ? `${(item.priceCents / 100).toFixed(2).replace('.', ',')} €`
                  : null;

              return (
                <div
                  key={item.id}
                  data-testid={`acquisition-item-${item.id}`}
                  className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[var(--hub-text-primary)]">
                        {item.name}
                      </div>
                      <div className="text-xs text-[var(--hub-text-secondary)]">
                        {item.category || 'Équipement'} •{' '}
                        {item.weightG !== null ? formatWeight(item.weightG) : '—'}
                        {priceLabel ? ` • ${priceLabel}` : ''}
                      </div>
                    </div>
                  </div>

                  {stockReason && (
                    <p
                      data-testid={`acquisition-oos-reason-${item.id}`}
                      className="text-xs font-medium text-[var(--hub-danger)]"
                    >
                      {stockReason}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Chemin 1 : Aperçu sans mutation */}
                    <button
                      type="button"
                      data-testid={`acquisition-preview-btn-${item.id}`}
                      onClick={() => handlePreview(item)}
                      className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Aperçu</span>
                    </button>

                    {/* Chemin 2 : Planifier comme « prévu » (non possédé, F-04) */}
                    <button
                      type="button"
                      data-testid={`acquisition-plan-btn-${item.id}`}
                      onClick={() => handlePlanItem(item)}
                      className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-primary)] inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Marquer prévu</span>
                    </button>

                    {/* Chemin 3 : Transaction réelle Boutique / Stripe uniquement (F-02, F-05) */}
                    {tx.allowed ? (
                      <Link
                        href={tx.shopHref}
                        data-testid={`acquisition-buy-link-${item.id}`}
                        className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-primary)]"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Acheter en Boutique</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        data-testid={`acquisition-buy-disabled-${item.id}`}
                        aria-disabled="true"
                        title={tx.disabledReason}
                        className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-surface-muted)] border border-[var(--hub-border)] text-[var(--hub-text-muted)] text-xs font-semibold cursor-not-allowed opacity-70"
                      >
                        {tx.disabledReason}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
