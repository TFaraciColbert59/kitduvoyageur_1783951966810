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
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { fetchBagManifest } from '../scene/bag/loader';
import { BAG_COLOR_SWATCHES, BAG_MATERIAL_PRESETS } from '../scene/bag/materials';
import { DRAWER_ART } from '../domain/palette.scene';
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

/**
 * Rendu stylisé 3D vectoriel de chaque pièce avec ombrages volumétriques et couleur en temps réel.
 */
function PartVisual3D({ partId, color }: { partId: PartId; color?: string }) {
  const activeColor = color || 'var(--hub-bag-forest)';

  if (partId === 'body') {
    return (
      <svg viewBox="0 0 100 120" className="w-6 h-7 drop-shadow-xs transition-all duration-300" aria-hidden="true">
        <defs>
          <linearGradient id="vis-body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={activeColor} stopOpacity="1" />
            <stop offset="100%" stopColor={DRAWER_ART.shade} stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="vis-body-glare" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={DRAWER_ART.white} stopOpacity="0.35" />
            <stop offset="100%" stopColor={DRAWER_ART.white} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 22 20 L 78 20 L 84 105 L 16 105 Z" fill="url(#vis-body-grad)" />
        <path d="M 24 22 L 76 22 L 80 50 L 20 50 Z" fill="url(#vis-body-glare)" />
        <line x1="28" y1="20" x2="24" y2="105" stroke={DRAWER_ART.white20} strokeWidth="1.5" />
        <line x1="72" y1="20" x2="76" y2="105" stroke={DRAWER_ART.ink30} strokeWidth="1.5" />
      </svg>
    );
  }

  if (partId === 'lid') {
    return (
      <svg viewBox="0 0 100 80" className="w-7 h-5 drop-shadow-xs transition-all duration-300" aria-hidden="true">
        <defs>
          <linearGradient id="vis-lid-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={activeColor} stopOpacity="1" />
            <stop offset="100%" stopColor={DRAWER_ART.shadeDeep} stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="vis-lid-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={DRAWER_ART.white} stopOpacity="0.4" />
            <stop offset="100%" stopColor={DRAWER_ART.white} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 12 18 Q 50 10 88 18 L 84 58 Q 50 68 16 58 Z" fill="url(#vis-lid-grad)" />
        <path d="M 16 20 Q 50 14 84 20 L 82 35 Q 50 42 18 35 Z" fill="url(#vis-lid-sheen)" />
        <rect x="42" y="52" width="16" height="14" rx="3" fill={DRAWER_ART.shellDeep} />
      </svg>
    );
  }

  if (partId === 'front-pocket') {
    return (
      <svg viewBox="0 0 90 90" className="w-6 h-6 drop-shadow-xs transition-all duration-300" aria-hidden="true">
        <defs>
          <linearGradient id="vis-pocket-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={activeColor} />
            <stop offset="100%" stopColor={DRAWER_ART.shadeInk} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect x="15" y="15" width="60" height="60" rx="14" fill="url(#vis-pocket-grad)" />
        <rect x="20" y="24" width="50" height="4" rx="2" fill={DRAWER_ART.white25} />
        <path d="M 18 20 L 72 20 L 70 38 L 20 38 Z" fill={DRAWER_ART.white12} />
      </svg>
    );
  }

  if (partId === 'shoulder-strap-l' || partId === 'shoulder-strap-r' || partId === 'straps') {
    return (
      <svg viewBox="0 0 80 100" className="w-5 h-7 drop-shadow-xs transition-all duration-300" aria-hidden="true">
        <defs>
          <linearGradient id="vis-strap-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={DRAWER_ART.white} stopOpacity="0.25" />
            <stop offset="35%" stopColor={activeColor} />
            <stop offset="100%" stopColor={DRAWER_ART.shadeAbyss} />
          </linearGradient>
        </defs>
        <path d="M 22 10 Q 32 45 20 90" stroke="url(#vis-strap-grad)" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d="M 58 10 Q 48 45 60 90" stroke="url(#vis-strap-grad)" strokeWidth="12" strokeLinecap="round" fill="none" />
        <line x1="26" y1="48" x2="54" y2="48" stroke={DRAWER_ART.shellDeep} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (partId === 'hip-belt') {
    return (
      <svg viewBox="0 0 100 60" className="w-7 h-4 drop-shadow-xs transition-all duration-300" aria-hidden="true">
        <defs>
          <linearGradient id="vis-belt-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={DRAWER_ART.shadeNight} />
            <stop offset="50%" stopColor={activeColor} />
            <stop offset="100%" stopColor={DRAWER_ART.shadeNight} />
          </linearGradient>
        </defs>
        <path d="M 10 40 Q 50 15 90 40" stroke="url(#vis-belt-grad)" strokeWidth="16" strokeLinecap="round" fill="none" />
        <rect x="42" y="20" width="16" height="18" rx="4" fill={DRAWER_ART.shellMid} stroke={DRAWER_ART.white} strokeWidth="0.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 70 70" className="w-5 h-5 drop-shadow-xs transition-all duration-300" aria-hidden="true">
      <defs>
        <linearGradient id="vis-buckle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={DRAWER_ART.highlight} />
          <stop offset="50%" stopColor={activeColor} />
          <stop offset="100%" stopColor={DRAWER_ART.shellDark} />
        </linearGradient>
      </defs>
      <rect x="15" y="15" width="40" height="40" rx="8" fill="none" stroke="url(#vis-buckle-grad)" strokeWidth="6" />
      <line x1="35" y1="15" x2="35" y2="55" stroke={DRAWER_ART.white} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PersonnaliserDrawer({
  config,
  selectedPartId,
  onFocusPart,
  onCustomizePart,
  onSelectBagModel,
}: PersonnaliserDrawerProps) {
  const { haptic } = useHapticFeedback();
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
    haptic('light');
    setActivePart(partId);
    onFocusPart(partId);
  };

  const handleSwitchBagModel = async (modelId: string) => {
    if (modelId === config.bag.modelId) return;
    haptic('light');
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

  const currentPartConfig: PartConfig = activePart ? config.bag.parts[activePart] ?? {} : {};

  // 1. Volet Pièce : Slide card avec l'élément 3D par-dessus
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
            hint="Ce gabarit de sac ne comporte aucune pièce modulable individuelle. Choisissez un autre modèle dans l’onglet « Gabarit » pour personnaliser ses tissus."
          />
        </div>
      );
    }

    return (
      <div
        data-testid="studio-personnaliser-pane"
        className="flex flex-1 min-h-0 w-full flex-col justify-start overflow-y-auto overscroll-contain pb-2"
      >
        {/* Slide card horizontal des pièces sélectionnables avec aperçu 3D volumétrique */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory py-0.5 px-0.5">
          {customizableParts.map((partId) => {
            const isSelected = partId === activePart;
            const isCustomized = Boolean(config.bag.parts[partId]);
            const partColor = config.bag.parts[partId]?.color || currentPartConfig.color || 'var(--hub-bag-forest)';
            return (
              <button
                key={partId}
                type="button"
                data-testid={`personnaliser-part-btn-${partId}`}
                aria-pressed={isSelected}
                onClick={() => handleChoosePart(partId)}
                className={`min-w-[80px] w-[80px] h-[72px] shrink-0 snap-center rounded-2xl border flex flex-col items-center justify-between p-1.5 pb-1 transition-all duration-300 studio-slide-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                  isSelected
                    ? 'is-selected'
                    : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)] hover:border-[var(--hub-border-strong)]'
                }`}
              >
                {/* Rendu 3D stylisé de l'élément sélectionnable */}
                <div className="w-full flex-1 flex items-center justify-center">
                  <PartVisual3D partId={partId} color={partColor} />
                </div>

                {/* Nom épuré de la pièce — fond verre et texte blanc quand sélectionné */}
                <div className="w-full flex items-center justify-center gap-0.5">
                  <span
                    className={`text-[11px] leading-tight truncate text-center transition-colors duration-300 ${
                      isSelected
                        ? 'text-white font-bold'
                        : 'text-[var(--hub-text-primary)] font-medium'
                    }`}
                  >
                    {getPartLabel(partId)}
                  </span>
                  {isCustomized && (
                    <span
                      aria-label="Pièce personnalisée"
                      className={`w-1 h-1 rounded-full shrink-0 ${
                        isSelected ? 'bg-white' : 'bg-[var(--hub-secondary)]'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Nuancier de pastilles de couleur tactiles pour la pièce sélectionnée */}
        <div className="flex items-center gap-2 px-1 pt-1 overflow-x-auto no-scrollbar">
          {BAG_COLOR_SWATCHES.map((swatch) => {
            const isSwatchActive =
              swatch.token === currentPartConfig.color ||
              swatch.id === currentPartConfig.color;
            return (
              <button
                key={swatch.id}
                type="button"
                data-testid={`personnaliser-color-${swatch.id}`}
                onClick={() => {
                  haptic('light');
                  if (activePart) {
                    void onCustomizePart(activePart, { color: swatch.token });
                  }
                }}
                className={`w-7 h-7 rounded-full border border-white/90 shrink-0 shadow-xs transition-transform duration-200 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                  isSwatchActive
                    ? 'scale-110 ring-2 ring-[var(--hub-primary)] ring-offset-1'
                    : 'opacity-85 hover:opacity-100 hover:scale-105'
                }`}
                style={{ background: swatch.token }}
                title={swatch.label}
                aria-label={swatch.label}
              >
                {isSwatchActive && (
                  <Check className="w-3.5 h-3.5 text-white drop-shadow" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // 2. Volet Gabarit : Slide card à la Apple avec texte épuré genre "45L" au centre
  const renderBagModelsPane = () => (
    <div
      data-testid="studio-bag-models-pane"
      className="flex flex-1 min-h-0 w-full flex-col justify-start overflow-y-auto overscroll-contain pb-2"
    >
      {lostSlotsReport && (
        <div
          data-testid="bag-switch-lost-slots-banner"
          role="status"
          className="p-1 rounded-xl bg-[var(--hub-surface-muted)] border border-[var(--hub-border)] space-y-0.5 text-[10px] mb-0.5"
        >
          <div className="font-bold text-[var(--hub-primary)]">
            {lostSlotsReport.nextBagLabel}
          </div>
          {lostSlotsReport.displacedItems.length > 0 && (
            <div className="text-[var(--hub-warning)] text-[9px]">
              {lostSlotsReport.displacedItems.length} équipement(s) replacé(s) en « Non rangé »
            </div>
          )}
        </div>
      )}

      {/* Slide card gabarits à la Apple */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory py-0.5 px-0.5">
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
              className={`min-w-[80px] w-[80px] h-[72px] shrink-0 snap-center rounded-2xl border flex flex-col items-center justify-center p-1.5 transition-all duration-300 studio-slide-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                isCurrent
                  ? 'is-selected'
                  : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)] hover:border-[var(--hub-border-strong)]'
              }`}
            >
              {/* Texte épuré moderne pas trop grand au centre de la card, genre 45L à la Apple */}
              <div
                className={`transition-all duration-300 font-sans ${
                  isCurrent
                    ? 'text-xl font-extrabold tracking-tight text-white'
                    : 'text-lg font-bold text-[var(--hub-text-primary)]'
                }`}
              >
                {bag.capacityL}L
              </div>
              {isCurrent && (
                <span className="w-1.5 h-1.5 rounded-full bg-white mt-1 shadow-xs" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // 3. Volet Matière technique PBR
  const renderMaterialsPane = () => (
    <div
      data-testid="studio-materials-pane"
      className="space-y-1 pb-2 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain"
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory py-0.5 px-0.5">
        {BAG_MATERIAL_PRESETS.map((preset) => {
          const selected = currentPartConfig.material === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              data-testid={`personnaliser-material-${preset.id}`}
              aria-pressed={selected}
              onClick={() => {
                haptic('light');
                if (activePart) {
                  void onCustomizePart(activePart, { material: preset.id });
                }
              }}
              className={`min-w-[105px] w-[105px] h-[72px] shrink-0 snap-center rounded-2xl border flex flex-col justify-between p-1.5 pb-1 text-left transition-all duration-300 studio-slide-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                selected
                  ? 'is-selected'
                  : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)]'
              }`}
            >
              <div
                className={`text-xs leading-tight font-bold transition-colors duration-300 ${
                  selected ? 'text-white' : 'text-[var(--hub-text-primary)]'
                }`}
              >
                {preset.label}
              </div>
              <div
                className={`text-[9.5px] leading-snug line-clamp-2 transition-colors duration-300 ${
                  selected ? 'text-white/85' : 'text-[var(--hub-text-secondary)]'
                }`}
              >
                {preset.description}
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span
                  className={`text-[8.5px] uppercase font-semibold transition-colors duration-300 ${
                    selected ? 'text-white/70' : 'text-[var(--hub-text-muted)]'
                  }`}
                >
                  Finition
                </span>
                {selected && (
                  <Check
                    className="w-3 h-3 text-white shrink-0"
                    aria-hidden="true"
                  />
                )}
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
      label: 'Pièce',
      icon: <Palette className="w-4 h-4" aria-hidden="true" />,
      render: renderPartsPane,
    },
    {
      id: 'modele',
      label: 'Gabarit',
      icon: <Backpack className="w-4 h-4" aria-hidden="true" />,
      render: renderBagModelsPane,
    },
    {
      id: 'matiere',
      label: 'Matière',
      icon: <Sliders className="w-4 h-4" aria-hidden="true" />,
      render: renderMaterialsPane,
    },
  ];

  return (
    <DrawerShell
      tabs={tabs}
      activeIndex={tabIndex}
      onIndexChange={(idx) => {
        haptic('selection');
        setTabIndex(idx);
      }}
    />
  );
}
