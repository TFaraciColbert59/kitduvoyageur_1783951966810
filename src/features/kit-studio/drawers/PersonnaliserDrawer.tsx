'use client';

/**
 * src/features/kit-studio/drawers/PersonnaliserDrawer.tsx
 * Tiroir Personnaliser du Kit Studio (Lot L6-2 / D-04..D-07 / ADR-004).
 *
 * Invariants :
 * - D-04 : La modification d'une pièce (matière, teinte, finition) n'affecte QUE la pièce ciblée.
 * - D-05 : Aucun rechargement du canvas WebGL lors d'une personnalisation de pièce.
 * - D-06 : Changer de modèle de sac conserve 100 % des objets et signale explicitement les objets
 *          dont l'emplacement précédent n'existe plus sur le nouveau modèle (déplacés en « Non rangé »).
 * - D-07 : Si `customizableParts` est vide, affiche un état indisponible explicite (zéro bouton muet).
 */

import React, { useEffect, useState } from 'react';
import { Backpack, Check, Palette, Sliders } from 'lucide-react';
import { DrawerEmpty, DrawerShell, type DrawerTab } from '@/components/ui/drawer';
import { presentResilientChoices } from '@/features/hub/lib/nativeChoices';
import { fetchBagManifest } from '../scene/bag/loader';
import { BAG_COLOR_SWATCHES, BAG_MATERIAL_PRESETS } from '../scene/bag/materials';
import {
  BUILTIN_BAG_MODELS,
  getPartLabel,
  getSlotLabel,
  manifestSlotsToSlotStates,
} from '../scene/bag/parts';
import type {
  BagCapabilities,
  KitConfiguration,
  PartConfig,
  PartId,
  SlotState,
} from '../state/types';

export interface DisplacedSlotReport {
  previousBagId: string | null;
  nextBagLabel: string;
  displacedItems: Array<{ id: string; name: string; lostSlotLabel: string }>;
}

/**
 * D-06 : Calcule la liste exacte des objets dont le slot actuel disparaît sur le nouveau sac.
 */
export function computeDisplacedSlotItems(
  config: KitConfiguration,
  nextAvailableSlots: readonly SlotState[],
  nextBagLabel: string
): DisplacedSlotReport {
  const validNextSlotIds = new Set(nextAvailableSlots.map((s) => s.id));
  const displacedItems: Array<{ id: string; name: string; lostSlotLabel: string }> = [];

  for (const item of config.items) {
    if (item.slotId && !validNextSlotIds.has(item.slotId)) {
      displacedItems.push({
        id: item.id,
        name: item.name,
        lostSlotLabel: getSlotLabel(item.slotId),
      });
    }
  }

  return {
    previousBagId: config.bag.modelId,
    nextBagLabel,
    displacedItems,
  };
}

export interface PersonnaliserDrawerProps {
  config: KitConfiguration;
  selectedPartId: PartId | null;
  onFocusPart: (partId: PartId | null) => void;
  onCustomizePart: (partId: PartId, patch: Partial<PartConfig>) => Promise<void> | void;
  onSelectBagModel: (
    modelId: string | null,
    capabilities: BagCapabilities,
    declaredCapacityL: number | null,
    availableSlots: SlotState[]
  ) => Promise<void> | void;
}

export function PersonnaliserDrawer({
  config,
  selectedPartId,
  onFocusPart,
  onCustomizePart,
  onSelectBagModel,
}: PersonnaliserDrawerProps) {
  const [tabIndex, setTabIndex] = useState<number>(0);
  const customizableParts = config.bag.capabilities.customizableParts;

  const [activePart, setActivePart] = useState<PartId | null>(
    selectedPartId && customizableParts.includes(selectedPartId)
      ? selectedPartId
      : customizableParts[0] ?? null
  );

  const [lostSlotsReport, setLostSlotsReport] = useState<DisplacedSlotReport | null>(null);
  const [switchingBagId, setSwitchingBagId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPartId && customizableParts.includes(selectedPartId)) {
      setActivePart(selectedPartId);
    } else if (activePart && !customizableParts.includes(activePart)) {
      setActivePart(customizableParts[0] ?? null);
    } else if (!activePart && customizableParts.length > 0) {
      setActivePart(customizableParts[0]);
    }
  }, [selectedPartId, customizableParts, activePart]);

  const handleChoosePart = (partId: PartId) => {
    setActivePart(partId);
    onFocusPart(partId);
  };

  const handleSwitchBagModel = async (modelId: string) => {
    if (modelId === config.bag.modelId) return;
    setSwitchingBagId(modelId);
    try {
      const manifest = await fetchBagManifest(modelId);
      const modelMeta = BUILTIN_BAG_MODELS.find((m) => m.modelId === modelId);
      const nextSlots = manifest ? manifestSlotsToSlotStates(manifest) : [];
      const nextCapabilities: BagCapabilities = manifest
        ? {
            ...manifest.capabilities,
            openable: manifest.capabilities.openable && Boolean(manifest.hasHinge),
          }
        : {
            rotatable: true,
            openable: modelMeta?.openable ?? true,
            hasInterior: modelMeta?.openable ?? true,
            customizableParts: ['body'],
            badgeAnchors: [],
            attachmentPoints: [],
          };
      const nextCapacity = manifest?.declaredCapacityL ?? modelMeta?.capacityL ?? null;
      const nextLabel = manifest?.label ?? modelMeta?.label ?? modelId;

      const report = computeDisplacedSlotItems(config, nextSlots, nextLabel);
      await onSelectBagModel(modelId, nextCapabilities, nextCapacity, nextSlots);
      setLostSlotsReport(report);
    } finally {
      setSwitchingBagId(null);
    }
  };

  const handleNativeBagPicker = async () => {
    const choice = await presentResilientChoices({
      title: 'Choisir un modèle de sac',
      options: BUILTIN_BAG_MODELS.map((m) => ({
        id: m.modelId,
        title: `${m.label} (${m.capacityL} L)`,
        subtitle: m.summary,
      })),
    });
    if (choice && typeof choice === 'string') {
      await handleSwitchBagModel(choice);
    }
  };

  const currentPartConfig: PartConfig = activePart ? config.bag.parts[activePart] ?? {} : {};

  const renderPartsPane = () => {
    // D-07 : Si aucune pièce personnalisable n'est disponible, état indisponible explicite
    if (customizableParts.length === 0) {
      return (
        <div
          data-testid="personnaliser-unavailable"
          className="p-5 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]"
        >
          <DrawerEmpty
            title="Personnalisation par pièce indisponible"
            hint="Ce gabarit de sac ne comporte aucune pièce modulable individuelle. Choisissez un autre modèle dans l’onglet « Modèle de sac » pour personnaliser ses tissus."
          />
        </div>
      );
    }

    return (
      <div data-testid="studio-personnaliser-pane" className="space-y-5 pb-8">
        {/* 1. Sélecteur de pièce ciblée (D-04) */}
        <section className="space-y-2" aria-label="Pièce du sac à personnaliser">
          <div className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
            1. Choisir la pièce ({customizableParts.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {customizableParts.map((partId) => {
              const isSelected = partId === activePart;
              const isCustomized = Boolean(config.bag.parts[partId]);
              return (
                <button
                  key={partId}
                  type="button"
                  data-testid={`personnaliser-part-btn-${partId}`}
                  aria-pressed={isSelected}
                  onClick={() => handleChoosePart(partId)}
                  className={`min-h-[44px] px-3.5 rounded-2xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                    isSelected
                      ? 'bg-[var(--hub-primary)] border-[var(--hub-primary)] text-[var(--hub-text-inverted)]'
                      : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)] text-[var(--hub-text-primary)]'
                  }`}
                >
                  <span>{getPartLabel(partId)}</span>
                  {isCustomized && (
                    <span
                      aria-label="Pièce personnalisée"
                      className="w-2 h-2 rounded-full bg-[var(--hub-secondary)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Nuancier de couleurs issues des tokens CSS (zéro hex littéral) */}
        {activePart && (
          <section className="space-y-2" aria-label="Teinte de la pièce">
            <div className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
              2. Teinte pour « {getPartLabel(activePart)} »
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BAG_COLOR_SWATCHES.map((swatch) => {
                const selected =
                  currentPartConfig.color === swatch.token ||
                  currentPartConfig.color === swatch.id;
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    data-testid={`personnaliser-color-${swatch.id}`}
                    aria-pressed={selected}
                    onClick={() =>
                      onCustomizePart(activePart, {
                        color: swatch.token,
                      })
                    }
                    className={`min-h-[44px] p-2.5 rounded-2xl border flex items-center gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                      selected
                        ? 'bg-[var(--hub-primary-subtle)] border-[var(--hub-primary)]'
                        : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="w-5 h-5 rounded-full border border-[var(--hub-border-strong)] shrink-0"
                      style={{ background: swatch.token }}
                    />
                    <span className="text-xs font-semibold text-[var(--hub-text-primary)] truncate">
                      {swatch.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Matières techniques PBR */}
        {activePart && (
          <section className="space-y-2" aria-label="Matière du tissu">
            <div className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
              3. Matière technique
            </div>
            <div className="space-y-2">
              {BAG_MATERIAL_PRESETS.map((preset) => {
                const selected = currentPartConfig.material === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`personnaliser-material-${preset.id}`}
                    aria-pressed={selected}
                    onClick={() =>
                      onCustomizePart(activePart, {
                        material: preset.id,
                      })
                    }
                    className={`w-full min-h-[48px] p-3 rounded-2xl border flex items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                      selected
                        ? 'bg-[var(--hub-primary-subtle)] border-[var(--hub-primary)]'
                        : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--hub-text-primary)]">
                        {preset.label}
                      </div>
                      <div className="text-[11px] text-[var(--hub-text-secondary)]">
                        {preset.description}
                      </div>
                    </div>
                    {selected && (
                      <Check
                        className="w-4 h-4 text-[var(--hub-primary)] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  };

  const renderBagModelsPane = () => (
    <div data-testid="studio-bag-models-pane" className="space-y-4 pb-8">
      {/* D-06 : Signalement explicite des objets conservés mais remis en « Non rangé » lors d'un changement de sac */}
      {lostSlotsReport && (
        <div
          data-testid="bag-switch-lost-slots-banner"
          role="status"
          className="p-3.5 rounded-2xl bg-[var(--hub-surface-muted)] border border-[var(--hub-border)] space-y-1.5 text-xs"
        >
          <div className="font-bold text-[var(--hub-primary)]">
            Modèle actif : {lostSlotsReport.nextBagLabel} — tous vos équipements ont été conservés ({config.items.length}).
          </div>
          {lostSlotsReport.displacedItems.length > 0 ? (
            <div className="space-y-1 text-[var(--hub-warning)]">
              <div className="font-semibold">
                {lostSlotsReport.displacedItems.length} équipement
                {lostSlotsReport.displacedItems.length > 1 ? 's ont été replacés' : ' a été replacé'} en « Non rangé » (emplacement absent sur ce sac) :
              </div>
              <ul className="pl-3 space-y-0.5 text-[var(--hub-text-secondary)]">
                {lostSlotsReport.displacedItems.map((d) => (
                  <li key={d.id}>
                    • {d.name} (anciennement : {d.lostSlotLabel})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[var(--hub-text-secondary)]">
              Tous les compartiments occupés existent sur ce modèle : aucun objet déplacé.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
          5 gabarits procéduraux LKDV
        </span>
        <button
          type="button"
          onClick={handleNativeBagPicker}
          className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-action)]"
        >
          Sélecteur rapide
        </button>
      </div>

      <div className="space-y-2.5">
        {BUILTIN_BAG_MODELS.map((bag) => {
          const isCurrent = config.bag.modelId === bag.modelId;
          const isBusy = switchingBagId === bag.modelId;
          return (
            <button
              key={bag.modelId}
              type="button"
              data-testid={`select-bag-model-${bag.modelId}`}
              aria-pressed={isCurrent}
              disabled={isBusy}
              onClick={() => handleSwitchBagModel(bag.modelId)}
              className={`w-full min-h-[60px] p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                isCurrent
                  ? 'bg-[var(--hub-primary-subtle)] border-[var(--hub-primary)]'
                  : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-[var(--hub-primary)]">
                  {bag.label}
                </div>
                <div className="text-xs text-[var(--hub-text-secondary)]">
                  {bag.summary}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--hub-surface)] text-[var(--hub-primary)]">
                  {bag.capacityL} L
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'pieces',
      label: 'Pièces & Matières',
      icon: <Palette className="w-4 h-4" aria-hidden="true" />,
      render: renderPartsPane,
    },
    {
      id: 'modele',
      label: 'Modèle de sac',
      icon: <Backpack className="w-4 h-4" aria-hidden="true" />,
      render: renderBagModelsPane,
    },
  ];

  return <DrawerShell tabs={tabs} activeIndex={tabIndex} onIndexChange={setTabIndex} />;
}
