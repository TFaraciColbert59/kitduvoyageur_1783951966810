'use client';

/**
 * src/features/kit-studio/drawers/OptionsDrawer.tsx
 * Tiroir Options du Kit Studio (Lot L6-5 / D-16..D-22 / L7-1).
 *
 * Invariants :
 * - D-16 : Bascule 3D / Liste persistante (`localStorage` : `lkdv_studio_view_mode`).
 * - D-18 : Son muet par défaut.
 * - D-19 : `AudioContext` créé UNIQUEMENT lors du geste utilisateur explicite sur le bouton audio.
 * - D-20 : Suspendu en arrière-plan, ne reprend jamais tout seul.
 * - D-21 : Préférence « muet » persistante, ne se réarme jamais automatiquement.
 * - D-22 : Toute confirmation d'état est écrite visuellement (aucune information portée par le son seul).
 * - L7-1 : Partage au groupe via `is_shared_with_group` dédié (distinct de `is_public`).
 */

import React, { useEffect, useState } from 'react';
import { Eye, List, Pencil, Share2, Sun, Volume2, VolumeX } from 'lucide-react';
import { DrawerShell, type DrawerTab } from '@/components/ui/drawer';
import type { AestheticLightingPreset } from '@/features/hub/ambience/environment';
import {
  getHubSoundController,
  type HubSoundController,
  type HubSoundSnapshot,
} from '@/features/hub/ambience/sound';

export const STUDIO_VIEW_MODE_STORAGE_KEY = 'lkdv_studio_view_mode';

export type StudioViewMode = '3d' | 'list';

export function readPersistedStudioViewMode(): StudioViewMode {
  if (typeof window === 'undefined') return '3d';
  try {
    const raw = window.localStorage.getItem(STUDIO_VIEW_MODE_STORAGE_KEY);
    return raw === 'list' ? 'list' : '3d';
  } catch {
    return '3d';
  }
}

export function writePersistedStudioViewMode(mode: StudioViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STUDIO_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export interface OptionsDrawerProps {
  kitName: string;
  viewMode: StudioViewMode;
  onChangeViewMode: (mode: StudioViewMode) => void;
  isSharedWithGroup: boolean;
  onToggleShareWithGroup?: (nextShared: boolean) => Promise<void> | void;
  onRenameKit?: (nextName: string) => Promise<void> | void;
  autoAmbienceEnabled?: boolean;
  onToggleAutoAmbience?: (enabled: boolean) => void;
  lightingPreset?: AestheticLightingPreset;
  onChangeLightingPreset?: (preset: AestheticLightingPreset) => void;
  soundController?: HubSoundController;
  readOnly?: boolean;
}

export function OptionsDrawer({
  kitName,
  viewMode,
  onChangeViewMode,
  isSharedWithGroup,
  onToggleShareWithGroup,
  onRenameKit,
  autoAmbienceEnabled = true,
  onToggleAutoAmbience,
  lightingPreset = 'auto',
  onChangeLightingPreset,
  soundController,
  readOnly = false,
}: OptionsDrawerProps) {
  const [tabIndex, setTabIndex] = useState<number>(0);
  const controller = soundController ?? getHubSoundController();

  const [soundSnap, setSoundSnap] = useState<HubSoundSnapshot>(() =>
    controller.getSnapshot()
  );
  const [nameDraft, setNameDraft] = useState<string>(kitName);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(kitName);
  }, [kitName]);

  useEffect(() => {
    return controller.subscribe((snap) => setSoundSnap(snap));
  }, [controller]);

  const handleToggleViewMode = (mode: StudioViewMode) => {
    writePersistedStudioViewMode(mode);
    onChangeViewMode(mode);
    setStatusNotice(
      mode === 'list'
        ? 'Affichage basculé en vue Liste (préférence enregistrée).'
        : 'Affichage basculé en vue 3D interactive (préférence enregistrée).'
    );
  };

  // D-19 : Geste utilisateur explicite -> seul moment où enableFromUserGesture() est appelé
  const handleToggleSoundFromGesture = async () => {
    if (soundSnap.isMuted) {
      await controller.enableFromUserGesture();
      controller.playTactileTick();
      setStatusNotice('Retours sonores d’atelier activés.');
    } else {
      await controller.mute();
      setStatusNotice('Atelier mis en sourdine (« muet » mémorisé).');
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !onRenameKit) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === kitName) return;
    await onRenameKit(trimmed);
    setStatusNotice(`Nom du kit mis à jour : « ${trimmed} » (articles conservés).`);
  };

  const handleShareToggle = async () => {
    if (readOnly || !onToggleShareWithGroup) return;
    const next = !isSharedWithGroup;
    await onToggleShareWithGroup(next);
    setStatusNotice(
      next
        ? 'Partage avec l’équipage activé (lecture seule, objets privés exclus).'
        : 'Partage avec l’équipage désactivé.'
    );
  };

  const renderDisplayAndSoundPane = () => (
    <div data-testid="studio-options-display-pane" className="space-y-4 pb-8">
      {statusNotice && (
        <div
          data-testid="options-status-notice"
          role="status"
          className="p-3 rounded-2xl bg-[var(--hub-surface-muted)] border border-[var(--hub-border)] text-xs text-[var(--hub-text-primary)]"
        >
          {statusNotice}
        </div>
      )}

      {/* 1. Rendu 3D immersif permanent */}
      <section className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
          Mode de représentation de l’atelier
        </div>
        <div className="flex items-center gap-2">
          <div
            data-testid="options-view-mode-3d"
            className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-[var(--hub-primary)] bg-[var(--hub-primary)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>Scène 3D Interactive</span>
          </div>
        </div>
        <p className="text-xs text-[var(--hub-text-secondary)]">
          L’atelier fonctionne exclusivement en rendu 3D interactif temps réel.
        </p>
      </section>

      {/* 2. Son d'atelier (D-18..D-22) */}
      <section className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-[var(--hub-text-primary)]">
              Son d’atelier
            </div>
            <p className="text-xs text-[var(--hub-text-secondary)]">
              {soundSnap.isMuted
                ? soundSnap.suspendedByBackground
                  ? 'Suspendu après mise en arrière-plan (appuyez pour réactiver).'
                  : 'Muet (aucune lecture automatique).'
                : 'Actif — se coupe dès que l’application passe en arrière-plan.'}
            </p>
          </div>

          <button
            type="button"
            data-testid="options-sound-toggle"
            aria-pressed={!soundSnap.isMuted}
            onClick={handleToggleSoundFromGesture}
            className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 ${
              !soundSnap.isMuted
                ? 'bg-[var(--hub-action)] border-[var(--hub-action)] text-[var(--hub-text-inverted)]'
                : 'bg-[var(--hub-surface)] border-[var(--hub-border)] text-[var(--hub-text-primary)]'
            }`}
          >
            {soundSnap.isMuted ? (
              <>
                <VolumeX className="w-4 h-4" aria-hidden="true" />
                <span>Muet</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>Son actif</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 3. Ambiance lumineuse honnête (KIT_STUDIO_SPEC §12.2) */}
      <section className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--hub-text-primary)]">
            <Sun className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
            <span>Éclairage d’atelier</span>
          </div>
          {onToggleAutoAmbience && (
            <button
              type="button"
              data-testid="options-ambience-auto-toggle"
              aria-pressed={autoAmbienceEnabled}
              onClick={() => onToggleAutoAmbience(!autoAmbienceEnabled)}
              className="min-h-[44px] px-3 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-surface)] text-xs font-semibold text-[var(--hub-text-primary)]"
            >
              {autoAmbienceEnabled ? 'Ambiance auto : Oui' : 'Ambiance auto : Non'}
            </button>
          )}
        </div>

        {onChangeLightingPreset && (
          <div>
            <label htmlFor="options-lighting-preset" className="sr-only">
              Traitement lumineux esthétique
            </label>
            <select
              id="options-lighting-preset"
              data-testid="options-lighting-select"
              value={lightingPreset}
              onChange={(e) =>
                onChangeLightingPreset(e.target.value as AestheticLightingPreset)
              }
              className="w-full min-h-[44px] px-3 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
            >
              <option value="auto">Automatique (selon données réelles disponibles)</option>
              <option value="atelier-neutre">Esthétique : Atelier neutre</option>
              <option value="lumiere-matinale">Esthétique : Lumière matinale</option>
              <option value="crepuscule-doux">Esthétique : Crépuscule doux</option>
            </select>
          </div>
        )}
      </section>
    </div>
  );

  const renderKitAndSharingPane = () => (
    <div data-testid="studio-options-sharing-pane" className="space-y-4 pb-8">
      {/* Renommage sûr du kit (A-01 : ne touche jamais aux articles) */}
      {!readOnly && onRenameKit && (
        <form
          onSubmit={handleRenameSubmit}
          className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5"
        >
          <label
            htmlFor="options-kit-rename"
            className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)] block"
          >
            Nom du sac
          </label>
          <div className="flex gap-2">
            <input
              id="options-kit-rename"
              data-testid="options-rename-input"
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="flex-1 min-h-[44px] px-3 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
            />
            <button
              type="submit"
              data-testid="options-rename-submit"
              className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Renommer</span>
            </button>
          </div>
        </form>
      )}

      {/* Partage explicite au groupe (L7-1 / D-24 : is_shared_with_group) */}
      <section className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-bold text-[var(--hub-text-primary)]">
              Partager mon kit avec l’équipage
            </div>
            <p className="text-xs text-[var(--hub-text-secondary)]">
              Autorise uniquement les coéquipiers confirmés de votre sortie ou groupe actif à consulter ce sac en lecture seule. Vos objets privés et documents d’identité ne sont jamais transmis.
            </p>
          </div>

          {!readOnly && onToggleShareWithGroup ? (
            <button
              type="button"
              data-testid="options-share-group-toggle"
              aria-pressed={isSharedWithGroup}
              onClick={handleShareToggle}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold shrink-0 ${
                isSharedWithGroup
                  ? 'bg-[var(--hub-primary)] border-[var(--hub-primary)] text-[var(--hub-text-inverted)]'
                  : 'bg-[var(--hub-surface)] border-[var(--hub-border)] text-[var(--hub-text-primary)]'
              }`}
            >
              {isSharedWithGroup ? 'Partagé' : 'Privé'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'affichage',
      label: 'Affichage & Son',
      icon: <Eye className="w-4 h-4" aria-hidden="true" />,
      render: renderDisplayAndSoundPane,
    },
    {
      id: 'partage',
      label: 'Sac & Équipage',
      icon: <Share2 className="w-4 h-4" aria-hidden="true" />,
      render: renderKitAndSharingPane,
    },
  ];

  return <DrawerShell tabs={tabs} activeIndex={tabIndex} onIndexChange={setTabIndex} />;
}
