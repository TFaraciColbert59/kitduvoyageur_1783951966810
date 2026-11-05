'use client';

/**
 * src/features/kit-studio/components/KitStudioView.tsx
 * Vue plein écran du Kit Studio montée comme état de `/hub` (`?studio=1`, zéro page ajoutée — ADR-005 / B-02).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  CircleDot,
  Compass,
  Eye,
  Folder,
  GitBranch,
  List,
  Package,
  Palette,
  Plus,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { DrawerEmpty, DrawerError, DrawerSkeleton } from '@/components/ui/drawer';
import type { AestheticLightingPreset } from '@/features/hub/ambience/environment';
import type { StudioDrawer } from '@/features/hub/state/drawerMachine';
import { BagListView } from '../list/BagListView';
// Styles du camp (tiroir, pilule, monde) : la vue est aussi montée hors du hub, sur /kit-studio.
import '../../hub/styles/hub-camp-option3.css';
import { BagScene, type BadgeCatalogMeta } from '../scene/BagScene';
import type { BagManifest } from '../scene/bag/parts';
import type { CameraIntent } from '../scene/camera/intents';

export interface StudioCustomPartTarget {
  id: PartId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

export const STUDIO_CUSTOM_PARTS: StudioCustomPartTarget[] = [
  {
    id: 'body',
    label: 'Corps',
    shortLabel: 'Corps',
    icon: <Package className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'lid',
    label: 'Rabat',
    shortLabel: 'Rabat',
    icon: <Shield className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'front-pocket',
    label: 'Poche',
    shortLabel: 'Poche',
    icon: <Folder className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'shoulder-strap-l',
    label: 'Bretelles',
    shortLabel: 'Bret.',
    icon: <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'hip-belt',
    label: 'Ceinture',
    shortLabel: 'Ceint.',
    icon: <CircleDot className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'lid-buckle',
    label: 'Boucles',
    shortLabel: 'Boucl.',
    icon: <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
];
import {
  createInitialKitConfiguration,
  DEFAULT_BAG_CAPABILITIES,
} from '../state/kitConfiguration';
import { formatWeightSummary, selectDerivedTotals } from '../state/selectors';
import type {
  AnchorId,
  BagCapabilities,
  KitConfiguration,
  KitItem,
  PartConfig,
  PartId,
  SlotId,
  SlotState,
} from '../state/types';
import { useKitStudio, type KitMutationPayload } from '../state/useKitStudio';
import type {
  AcquisitionCatalogItem,
  MemberLoanRecord,
} from '../drawers/acquisition/acquisitionEngine';
import type { SharedGroupMemberKit } from '../drawers/groupe/GroupePane';
import {
  InsignesDrawer,
  type StudioBadgeDefinition,
} from '../drawers/InsignesDrawer';
import {
  InventaireDrawer,
  type OwnedInventoryCandidate,
} from '../drawers/InventaireDrawer';
import { LigneeDrawer } from '../drawers/LigneeDrawer';
import {
  OptionsDrawer,
  readPersistedStudioViewMode,
  writePersistedStudioViewMode,
  type StudioViewMode,
} from '../drawers/OptionsDrawer';
import { PersonnaliserDrawer } from '../drawers/PersonnaliserDrawer';
import { StatistiquesDrawer } from '../drawers/StatistiquesDrawer';

export interface StudioBootstrapPayload {
  authenticated: boolean;
  state: 'ok' | 'empty' | 'error';
  error?: string | null;
  kits: Array<{ id: string; name: string }>;
  activeKit: {
    kitId: string;
    name: string;
    revision: number;
    bagModelId: string | null;
    bagParts: Record<PartId, PartConfig>;
    isSharedWithGroup: boolean;
    items: KitItem[];
    placedBadges: Array<{
      id: string;
      badgeId: string;
      anchorId: string;
      scale: number;
    }>;
  } | null;
  ownedCandidates: OwnedInventoryCandidate[];
  badges: StudioBadgeDefinition[];
  loans: MemberLoanRecord[];
  catalogItems: AcquisitionCatalogItem[];
  groupMembers?: SharedGroupMemberKit[];
  lineage?: Record<string, any> | null;
}

export interface KitStudioViewProps {
  requestedKitId?: string | null;
  activeDrawer?: StudioDrawer;
  subDrawerId?: string;
  tripId?: string | null;
  crewId?: string | null;
  onSelectDrawer: (drawer?: StudioDrawer) => void;
  onExitStudio: () => void;
}

function payloadToKitConfiguration(
  activeKit: NonNullable<StudioBootstrapPayload['activeKit']>
): KitConfiguration {
  return createInitialKitConfiguration(activeKit.kitId, {
    revision: activeKit.revision,
    bag: {
      modelId: activeKit.bagModelId ?? 'trekker-55',
      capabilities: DEFAULT_BAG_CAPABILITIES,
      parts: activeKit.bagParts ?? {},
      declaredCapacityL: 55,
    },
    items: activeKit.items ?? [],
    placedBadges: activeKit.placedBadges ?? [],
  });
}



export function KitStudioView({
  requestedKitId = null,
  activeDrawer,
  subDrawerId,
  tripId = null,
  crewId = null,
  onSelectDrawer,
  onExitStudio,
}: KitStudioViewProps) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );
  const [bootstrap, setBootstrap] = useState<StudioBootstrapPayload | null>(null);
  const [isLocalDraft, setIsLocalDraft] = useState<boolean>(false);
  const [kitName, setKitName] = useState<string>('Mon sac');
  const [isSharedWithGroup, setIsSharedWithGroup] = useState<boolean>(false);

  const [viewMode, setViewMode] = useState<StudioViewMode>(() =>
    readPersistedStudioViewMode()
  );
  const [degradedReason, setDegradedReason] = useState<string | null>(null);
  const [veilVisible, setVeilVisible] = useState<boolean>(true);

  const [focusedPartId, setFocusedPartId] = useState<PartId | null>(null);
  const [externalIntent, setExternalIntent] = useState<{
    nonce: number;
    intent: CameraIntent;
  } | null>(null);
  const intentNonceRef = useRef<number>(0);

  // Inspection lecture seule du sac d'un coéquipier (E-02, E-07)
  const [inspectedMember, setInspectedMember] = useState<SharedGroupMemberKit | null>(
    null
  );
  const [inspectedConfig, setInspectedConfig] = useState<KitConfiguration | null>(null);

  // Réglages d'ambiance (L6-5)
  const [autoAmbience, setAutoAmbience] = useState<boolean>(true);
  const [lightingPreset, setLightingPreset] =
    useState<AestheticLightingPreset>('auto');

  const drawerDragActiveRef = useRef<boolean>(false);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState<boolean>(false);

  const triggerHaptic = useCallback((duration = 10) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  }, []);

  // Détection du geste Swipe vers la gauche avec le doigt pour quitter l’atelier et revenir au Camp
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: performance.now(),
      };
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    const deltaTime = performance.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Swipe vers la gauche franc : deltaX < -50px, composante horizontale dominante
    if (deltaX < -50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1 && deltaTime < 900) {
      onExitStudio();
    }
  }, [onExitStudio]);

  const initialEmptyConfig = useMemo(
    () =>
      createInitialKitConfiguration(
        requestedKitId || '00000000-0000-4000-8000-000000000001',
        {
          bag: {
            modelId: 'trekker-55',
            capabilities: DEFAULT_BAG_CAPABILITIES,
            parts: {},
            declaredCapacityL: 55,
          },
        }
      ),
    [requestedKitId]
  );

  // En mode brouillon local hors session authentifiée, les mutations restent purement locales (zéro faux appel serveur en échec)
  const studioApiClient = useCallback(
    async (mutation: KitMutationPayload, clientRevision: number) => {
      if (isLocalDraft) {
        return { success: true, revision: clientRevision };
      }
      const response = await fetch('/api/kit-studio/configuration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitId: bootstrap?.activeKit?.kitId ?? initialEmptyConfig.kitId,
          clientRevision,
          mutation,
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Erreur serveur (${response.status})`);
      }
      return response.json();
    },
    [isLocalDraft, bootstrap?.activeKit?.kitId, initialEmptyConfig.kitId]
  );

  const [seedConfig, setSeedConfig] = useState<KitConfiguration>(initialEmptyConfig);

  const studio = useKitStudio({
    initialConfig: seedConfig,
    apiClient: studioApiClient,
  });

  // Synchronise le réducteur lorsque le chargement initial aboutit
  const syncedBootstrapIdRef = useRef<string | null>(null);
  const loadBootstrap = useCallback(async () => {
    setLoadState('loading');
    try {
      const qs = requestedKitId
        ? `?kitId=${encodeURIComponent(requestedKitId)}`
        : '';
      const res = await fetch(`/api/kit-studio/configuration${qs}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Impossible de lire la configuration (${res.status})`);
      }
      const data = (await res.json()) as StudioBootstrapPayload;
      if (data.state === 'error') {
        throw new Error(data.error || 'Erreur de lecture du kit');
      }

      setBootstrap(data);
      if (data.state === 'empty' || !data.activeKit) {
        setLoadState('empty');
      } else {
        const nextCfg = payloadToKitConfiguration(data.activeKit);
        setSeedConfig(nextCfg);
        setKitName(data.activeKit.name || 'Mon sac');
        setIsSharedWithGroup(Boolean(data.activeKit.isSharedWithGroup));
        setIsLocalDraft(!data.authenticated);
        syncedBootstrapIdRef.current = `${data.activeKit.kitId}:${data.activeKit.revision}`;
        setLoadState('ready');
      }
    } catch (err) {
      // Aucune donnée de démonstration : un kit fabriqué ne doit jamais s'afficher à la place du vrai.
      console.warn('[KitStudioView] configuration indisponible :', err);
      setLoadState('error');
    }
  }, [requestedKitId]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  // Réinitialise l'état interne de useKitStudio quand seedConfig change suite au bootstrap
  const prevSeedRef = useRef<KitConfiguration>(seedConfig);
  if (prevSeedRef.current !== seedConfig) {
    prevSeedRef.current = seedConfig;
  }

  // Voile de transition 180 ms à l'entrée pour masquer le passage de témoin WebGL (ADR-002)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVeilVisible(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, []);

  const emitCameraIntent = useCallback((intent: CameraIntent) => {
    intentNonceRef.current += 1;
    setExternalIntent({
      nonce: intentNonceRef.current,
      intent,
    });
  }, []);

  const handleCreateFirstKit = async () => {
    try {
      const res = await fetch('/api/kit-studio/configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mon sac d’expédition',
          bagModelId: 'trekker-55',
        }),
      });

      if (res.status === 401) {
        // Session locale non authentifiée : ouvre un brouillon local VIDE (0 objet fictif, D-03)
        setIsLocalDraft(true);
        setKitName('Brouillon local (non connecté)');
        setLoadState('ready');
        return;
      }

      if (!res.ok) {
        throw new Error('Échec de création du kit');
      }

      const created = await res.json();
      const createdId = created?.kit?.kitId || initialEmptyConfig.kitId;
      const fresh = createInitialKitConfiguration(createdId, {
        bag: {
          modelId: created?.kit?.bagModelId || 'trekker-55',
          capabilities: DEFAULT_BAG_CAPABILITIES,
          parts: {},
          declaredCapacityL: 55,
        },
        items: [],
      });
      setBootstrap((prev) =>
        prev
          ? {
              ...prev,
              state: 'ok',
              activeKit: {
                kitId: createdId,
                name: created?.kit?.name || 'Mon sac d’expédition',
                revision: 1,
                bagModelId: 'trekker-55',
                bagParts: {},
                isSharedWithGroup: false,
                items: [],
                placedBadges: [],
              },
            }
          : null
      );
      setSeedConfig(fresh);
      setKitName(created?.kit?.name || 'Mon sac d’expédition');
      setIsLocalDraft(false);
      setLoadState('ready');
    } catch (err) {
      console.warn('[KitStudioView] création du kit impossible :', err);
      setLoadState('error');
    }
  };

  // Remontée des slots réels du manifeste GLB une fois chargé
  const hydratedBagModelRef = useRef<string | null>(null);
  const handleManifestLoaded = useCallback(
    (manifest: BagManifest, slots: SlotState[], capabilities: BagCapabilities) => {
      if (inspectedMember) return;
      if (
        hydratedBagModelRef.current === manifest.modelId &&
        Object.keys(studio.state.slots).length > 0
      ) {
        return;
      }
      hydratedBagModelRef.current = manifest.modelId;
      if (Object.keys(studio.state.slots).length === 0 && slots.length > 0) {
        // Hydratation locale silencieuse si aucun slot n'était encore chargé
        void studio
          .selectBagModel(
            manifest.modelId,
            capabilities,
            manifest.declaredCapacityL,
            slots
          )
          .catch(() => {});
      }
    },
    [inspectedMember, studio]
  );

  // D-02 : Ajout d'objet -> mise à jour de l'état + animation caméra d'ouverture/pose si sac ouvrable
  const handleAddItem = useCallback(
    async (item: Omit<KitItem, 'slotOrder'>, slotId?: SlotId | null) => {
      await studio.addItem(item, slotId);
      const targetSlot = slotId ?? item.slotId;
      if (
        targetSlot &&
        targetSlot.startsWith('interior') &&
        studio.state.bag.capabilities.openable &&
        item.visual !== null
      ) {
        emitCameraIntent({
          kind: 'open-and-place',
          slotId: targetSlot,
        });
      }
    },
    [studio, emitCameraIntent]
  );

  // B-07 & D-17 : Fermeture propre d'un tiroir -> la caméra referme le sac / revient à OVERVIEW
  const handleCloseDrawer = useCallback(() => {
    setFocusedPartId(null);
    emitCameraIntent({ kind: 'close-bag' });
    onSelectDrawer(undefined);
  }, [emitCameraIntent, onSelectDrawer]);

  const handleChangeViewMode = useCallback((mode: StudioViewMode) => {
    writePersistedStudioViewMode(mode);
    setViewMode(mode);
    if (mode === '3d') {
      setDegradedReason(null);
    }
  }, []);

  const handleRenameKit = useCallback(
    async (nextName: string) => {
      const prevName = kitName;
      setKitName(nextName);
      if (isLocalDraft) return;
      const nextRev = studio.state.revision + 1;
      const res = await fetch('/api/kit-studio/configuration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitId: studio.state.kitId,
          clientRevision: nextRev,
          mutation: {
            type: 'options/rename',
            payload: { name: nextName },
          },
        }),
      });
      if (!res.ok) {
        setKitName(prevName);
      }
    },
    [kitName, isLocalDraft, studio.state.kitId, studio.state.revision]
  );

  const handleToggleShareGroup = useCallback(
    async (nextShared: boolean) => {
      const prev = isSharedWithGroup;
      setIsSharedWithGroup(nextShared);
      if (isLocalDraft) return;
      const nextRev = studio.state.revision + 1;
      const res = await fetch('/api/kit-studio/configuration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitId: studio.state.kitId,
          clientRevision: nextRev,
          mutation: {
            type: 'options/shareGroup',
            payload: { isSharedWithGroup: nextShared },
          },
        }),
      });
      if (!res.ok) {
        setIsSharedWithGroup(prev);
      }
    },
    [isSharedWithGroup, isLocalDraft, studio.state.kitId, studio.state.revision]
  );

  const handleInspectMember = useCallback(
    (member: SharedGroupMemberKit | null, derivedCfg: KitConfiguration | null) => {
      setInspectedMember(member);
      setInspectedConfig(derivedCfg);
    },
    []
  );

  // Configuration réellement affichée dans la scène ou la liste (son propre sac OU celui du coéquipier en lecture seule E-02)
  const activeEffectiveOwnConfig =
    bootstrap?.activeKit &&
    studio.state.kitId !== bootstrap.activeKit.kitId &&
    syncedBootstrapIdRef.current ===
      `${bootstrap.activeKit.kitId}:${bootstrap.activeKit.revision}`
      ? seedConfig
      : studio.state;

  const displayedConfig = inspectedConfig ?? activeEffectiveOwnConfig;
  const displayedTotals = useMemo(
    () => selectDerivedTotals(displayedConfig),
    [displayedConfig]
  );
  const isReadOnlyPeer = inspectedMember !== null;

  // Sélection directe d'une pièce du sac pour personnalisation depuis la barre capsule
  const handleSelectPartTarget = useCallback(
    (partId: PartId) => {
      if (isReadOnlyPeer) return;

      // Toggle : si le tiroir Personnaliser est déjà ouvert sur cette pièce, le fermer
      if (activeDrawer === 'personnaliser' && focusedPartId === partId) {
        handleCloseDrawer();
        return;
      }

      setFocusedPartId(partId);
      emitCameraIntent({
        kind: 'focus-part',
        partId,
      });
      onSelectDrawer('personnaliser');
    },
    [activeDrawer, focusedPartId, handleCloseDrawer, isReadOnlyPeer, emitCameraIntent, onSelectDrawer]
  );
  const weightSummary = formatWeightSummary(displayedTotals);

  const badgeCatalogMap = useMemo(() => {
    const map = new Map<string, BadgeCatalogMeta>();
    for (const b of bootstrap?.badges ?? []) {
      map.set(b.id, {
        id: b.id,
        label: b.label,
        kind: b.kind,
        colorToken: b.colorToken,
      });
    }
    return map;
  }, [bootstrap?.badges]);

  const effectiveListMode = viewMode === 'list';

  const drawerButtons: Array<{
    id: StudioDrawer;
    label: string;
    icon: React.ReactNode;
    allowedInReadOnly: boolean;
  }> = [
    {
      id: 'inventaire',
      label: 'Inventaire',
      icon: <Package className="w-4 h-4" aria-hidden="true" />,
      allowedInReadOnly: true,
    },
    {
      id: 'personnaliser',
      label: 'Personnaliser',
      icon: <Palette className="w-4 h-4" aria-hidden="true" />,
      allowedInReadOnly: false,
    },
    {
      id: 'statistiques',
      label: 'Statistiques',
      icon: <BarChart3 className="w-4 h-4" aria-hidden="true" />,
      allowedInReadOnly: true,
    },
    {
      id: 'lignee',
      label: 'Lignée',
      icon: <GitBranch className="w-4 h-4" aria-hidden="true" />,
      allowedInReadOnly: false,
    },
    {
      id: 'insignes',
      label: 'Insignes',
      icon: <Award className="w-4 h-4" aria-hidden="true" />,
      allowedInReadOnly: false,
    },
    {
      id: 'options',
      label: 'Options',
      icon: <Settings className="w-4 h-4" aria-hidden="true" />,
      allowedInReadOnly: false,
    },
  ];

  const visibleDrawerButtons = isReadOnlyPeer
    ? drawerButtons.filter((b) => b.allowedInReadOnly)
    : drawerButtons;

  const effectiveDrawer = activeDrawer ?? 'personnaliser';

  return (
    <div
      data-testid="kit-studio-view"
      data-view-mode={effectiveListMode ? 'list' : '3d'}
      data-readonly={isReadOnlyPeer ? 'true' : 'false'}
      data-lighting-preset={autoAmbience ? lightingPreset : 'atelier-neutre'}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--hub-bg)] text-[var(--hub-text-primary)] select-none overflow-hidden"
      style={{
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <h1 className="sr-only">
        {isReadOnlyPeer
          ? `${inspectedMember.kit.name} (${inspectedMember.memberName})`
          : kitName}
      </h1>

      {/* Voile de transition plein écran (180 ms, opacity uniquement — ADR-002, G-03) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-50 pointer-events-none transition-opacity"
        style={{
          background: 'var(--hub-studio-veil-bg)',
          opacity: veilVisible ? 1 : 0,
          transitionDuration: 'var(--hub-veil-duration, 180ms)',
        }}
      />

      {/* Bandeau lecture seule explicite lors de l'inspection d'un coéquipier (E-02, E-07) */}
      {isReadOnlyPeer && inspectedMember && (
        <div
          data-testid="studio-readonly-member-banner"
          role="status"
          className="px-4 py-2.5 bg-[var(--hub-primary-subtle)] border-b border-[var(--hub-border)] flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--hub-primary)] min-w-0">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Lecture seule — sac partagé par {inspectedMember.memberName}
            </span>
          </div>
          <button
            type="button"
            data-testid="studio-return-own-kit-btn"
            onClick={() => handleInspectMember(null, null)}
            className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-primary)] text-[var(--hub-text-inverted)] text-xs font-semibold shrink-0"
          >
            Revenir à mon sac
          </button>
        </div>
      )}

      {/* Alerte de rollback d'écriture optimiste en échec (C-20) */}
      {studio.activeError && (
        <div
          data-testid="studio-mutation-error-banner"
          role="alert"
          className="px-4 py-2 bg-[var(--hub-danger-bg)] border-b border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-danger)]"
        >
          Échec de synchronisation annulé : {studio.activeError}
        </div>
      )}

      {/* 1. Zone 3D supérieure : sac parfaitement centré verticalement et horizontalement */}
      <main
        className={`w-full relative flex flex-col overflow-hidden shrink-0 transition-all duration-300 ${
          isDrawerCollapsed ? 'flex-1 min-h-0' : 'h-[62dvh] max-h-[62dvh]'
        }`}
      >
        {loadState === 'loading' && (
          <div className="p-6 max-w-md mx-auto w-full">
            <DrawerSkeleton />
          </div>
        )}

        {loadState === 'error' && (
          <div
            data-testid="studio-load-error"
            className="p-6 max-w-md mx-auto w-full my-auto"
          >
            <div className="p-5 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
              <DrawerError onRetry={loadBootstrap} />
            </div>
          </div>
        )}

        {loadState === 'empty' && (
          <div
            data-testid="studio-empty-account"
            className="p-6 max-w-md mx-auto w-full my-auto"
          >
            <div className="p-6 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
              <DrawerEmpty
                title="Aucun kit enregistré"
                hint="Créez votre premier sac réel pour commencer votre préparation. Aucun équipement fictif ne sera ajouté à votre place."
                action={
                  <button
                    type="button"
                    data-testid="studio-create-first-kit-btn"
                    onClick={handleCreateFirstKit}
                    className="min-h-[44px] px-4 rounded-full bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 mt-2"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Créer mon premier kit</span>
                  </button>
                }
              />
            </div>
          </div>
        )}

        {loadState === 'ready' && (
          <BagScene
            config={displayedConfig}
            focusedPartId={focusedPartId}
            activeDrawerOpen={!isDrawerCollapsed}
            isCoveredByOpaqueSheet={false}
            isUiGestureActive={() => drawerDragActiveRef.current}
            badgeCatalog={badgeCatalogMap}
            readOnly={isReadOnlyPeer}
            onSelectPart={
              isReadOnlyPeer
                ? undefined
                : (partId) => {
                    triggerHaptic(10);
                    const targetPart =
                      partId === 'shoulder-strap-r' ? 'shoulder-strap-l' : partId;
                    setFocusedPartId(targetPart);
                    onSelectDrawer('personnaliser');
                    setIsDrawerCollapsed(false);
                  }
            }
            onManifestLoaded={handleManifestLoaded}
            onDegraded={(reason) => setDegradedReason(reason)}
            externalIntent={externalIntent}
          />
        )}
      </main>

      {/* 2. Pilule flottante « ... » au centre (quand le tiroir est baissé, comme sur la page Hub) */}
      {loadState === 'ready' && isDrawerCollapsed && (
        <div className="studio-floating-pill-container" data-testid="studio-pill-container">
          <button
            type="button"
            data-testid="studio-floating-pill"
            onClick={() => {
              triggerHaptic(14);
              setIsDrawerCollapsed(false);
            }}
            className="camp-floating-pill active:scale-90 transition-transform"
            aria-label="Ouvrir le tiroir de personnalisation"
          >
            <span className="camp-pill-dots" aria-hidden="true">
              ...
            </span>
          </button>
        </div>
      )}

      {/* 3. Feuille du tiroir en bas (Liquid Glass iOS 27 — 30dvh exploitant tout le bas de l'écran, 0 texte "personnaliser", 0 croix, encoche centrée) */}
      {loadState === 'ready' && !isDrawerCollapsed && (
        <div
          data-testid={`studio-active-drawer-${effectiveDrawer}`}
          data-drawer-sheet="true"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={() => {
            drawerDragActiveRef.current = true;
          }}
          onPointerUp={() => {
            drawerDragActiveRef.current = false;
          }}
          onPointerCancel={() => {
            drawerDragActiveRef.current = false;
          }}
          className="hub-camp-drawer-sheet h-[30dvh] max-h-[30dvh] w-full shrink-0 flex flex-col z-30 transition-all duration-300"
          style={{
            paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Encoche centrée pour baisser le tiroir (zéro texte "personnaliser", zéro croix) */}
          <div
            role="button"
            tabIndex={0}
            data-testid="studio-collapse-drawer-btn"
            onClick={() => {
              triggerHaptic(12);
              setIsDrawerCollapsed(true);
            }}
            aria-label="Baisser le tiroir"
            className="w-full flex items-center justify-center pt-2 pb-1 cursor-pointer shrink-0 group active:scale-95 transition-transform"
          >
            <div
              data-drawer-handle="true"
              className="w-10 h-1.5 rounded-full bg-[var(--hub-border-strong)] transition-all duration-200 group-hover:w-12 group-hover:bg-[var(--hub-primary)] shadow-2xs"
            />
          </div>
          <button
            type="button"
            data-testid="studio-close-drawer-btn"
            onClick={() => {
              triggerHaptic(10);
              setIsDrawerCollapsed(true);
            }}
            className="sr-only"
            aria-hidden="true"
          />

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-0.5">
            {effectiveDrawer === 'inventaire' && (
              <InventaireDrawer
                config={displayedConfig}
                totals={displayedTotals}
                ownedCandidates={bootstrap?.ownedCandidates ?? []}
                catalogItems={bootstrap?.catalogItems ?? []}
                loans={bootstrap?.loans ?? []}
                groupMembers={bootstrap?.groupMembers}
                tripId={tripId}
                crewId={crewId}
                kitName={kitName}
                initialSubTab={
                  subDrawerId === 'groupe'
                    ? 'groupe'
                    : subDrawerId === 'acquisition'
                      ? 'acquisition'
                      : isReadOnlyPeer
                        ? 'groupe'
                        : 'inventaire'
                }
                readOnly={isReadOnlyPeer}
                inspectedMemberId={inspectedMember?.memberId ?? null}
                onInspectMember={handleInspectMember}
                onAddItem={handleAddItem}
                onRemoveItem={(id) => studio.removeItem(id)}
                onToggleChecked={(id, checked) =>
                  studio.toggleItemChecked(id, checked)
                }
                onMoveItem={(id, slot) => studio.moveItem(id, slot)}
                onUpdateQuantity={(id, qty) => studio.updateItemQuantity(id, qty)}
              />
            )}

            {effectiveDrawer === 'personnaliser' && !isReadOnlyPeer && (
              <PersonnaliserDrawer
                config={displayedConfig}
                selectedPartId={focusedPartId}
                onFocusPart={(pid) => setFocusedPartId(pid)}
                onCustomizePart={(pid, patch) => {
                  void studio.customizePart(pid, patch);
                  if (
                    pid === 'shoulder-strap-l' &&
                    displayedConfig.bag.capabilities.customizableParts.includes(
                      'shoulder-strap-r'
                    )
                  ) {
                    void studio.customizePart('shoulder-strap-r', patch);
                  }
                }}
                onSelectBagModel={(mid, caps, capL, slots) =>
                  studio.selectBagModel(mid, caps, capL, slots)
                }
              />
            )}

            {effectiveDrawer === 'statistiques' && (
              <StatistiquesDrawer
                config={displayedConfig}
                totals={displayedTotals}
              />
            )}

            {effectiveDrawer === 'lignee' && !isReadOnlyPeer && (
              <LigneeDrawer
                kitId={displayedConfig.kitId}
                initialLineage={bootstrap?.lineage}
              />
            )}

            {effectiveDrawer === 'insignes' && !isReadOnlyPeer && (
              <InsignesDrawer
                config={displayedConfig}
                badges={bootstrap?.badges ?? []}
                readOnly={isReadOnlyPeer}
                onPlaceBadge={(bid: AnchorId, aid: AnchorId, scale?: number) =>
                  studio.placeBadge(bid, aid, scale)
                }
                onRemoveBadge={(pid) => studio.removeBadge(pid)}
              />
            )}

            {effectiveDrawer === 'options' && !isReadOnlyPeer && (
              <OptionsDrawer
                kitName={kitName}
                viewMode={effectiveListMode ? 'list' : '3d'}
                onChangeViewMode={handleChangeViewMode}
                isSharedWithGroup={isSharedWithGroup}
                onToggleShareWithGroup={handleToggleShareGroup}
                onRenameKit={handleRenameKit}
                autoAmbienceEnabled={autoAmbience}
                onToggleAutoAmbience={setAutoAmbience}
                lightingPreset={lightingPreset}
                onChangeLightingPreset={setLightingPreset}
                readOnly={isReadOnlyPeer}
              />
            )}
          </div>
        </div>
      )}

      {/* 4. Barre de sélection des éléments de la page Kit Studio (Apple Liquid Glass iOS 27) */}
      {loadState === 'ready' && (
        <nav
          aria-label="Sélection des éléments à personnaliser"
          data-studio-ui="true"
          className="px-3 pt-1 pb-1.5 shrink-0 relative z-[2010] w-full"
          style={{
            paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div
            className="hub-drawer-capsule"
            style={
              {
                '--n': STUDIO_CUSTOM_PARTS.length,
                '--i': Math.max(
                  0,
                  STUDIO_CUSTOM_PARTS.findIndex((p) => p.id === focusedPartId)
                ),
              } as React.CSSProperties
            }
          >
            {focusedPartId &&
              STUDIO_CUSTOM_PARTS.some((p) => p.id === focusedPartId) && (
                <span className="sel-lens" aria-hidden="true" />
              )}
            {STUDIO_CUSTOM_PARTS.map((target) => {
              const active = focusedPartId === target.id;
              return (
                <button
                  key={target.id}
                  type="button"
                  data-testid={`studio-part-target-${target.id}`}
                  aria-pressed={active}
                  onClick={() => {
                    triggerHaptic(10);
                    handleSelectPartTarget(target.id);
                    if (isDrawerCollapsed) {
                      setIsDrawerCollapsed(false);
                    }
                  }}
                  className={active ? 'active' : ''}
                >
                  {target.icon}
                  <span className="hidden sm:inline">{target.label}</span>
                  <span className="sm:hidden">{target.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
