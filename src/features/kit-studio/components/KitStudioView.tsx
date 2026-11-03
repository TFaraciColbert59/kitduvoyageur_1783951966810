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
  GitBranch,
  Package,
  Palette,
  Plus,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { DrawerEmpty, DrawerError, DrawerSkeleton } from '@/components/ui/drawer';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { AestheticLightingPreset } from '@/features/hub/ambience/environment';
import type { StudioDrawer } from '@/features/hub/state/drawerMachine';
import { BagScene, type BadgeCatalogMeta } from '../scene/BagScene';
import type { BagManifest } from '../scene/bag/parts';
import type { CameraIntent } from '../scene/camera/intents';

import {
  createInitialKitConfiguration,
  DEFAULT_BAG_CAPABILITIES,
} from '../state/kitConfiguration';
import { selectDerivedTotals } from '../state/selectors';
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

const FALLBACK_STUDIO_PAYLOAD: StudioBootstrapPayload = {
  authenticated: false,
  state: 'ok',
  kits: [{ id: 'demo-alpin-40', name: 'Sac Alpin 40 L' }],
  activeKit: {
    kitId: 'demo-alpin-40',
    name: 'Sac Alpin 40 L',
    revision: 1,
    bagModelId: 'trekker-55',
    bagParts: {
      body: { color: 'var(--hub-bag-forest)', material: 'toile' },
      straps: { color: 'var(--hub-primary)', material: 'ripstop' },
      buckles: { color: 'var(--hub-secondary)', material: 'metal' },
    },
    isSharedWithGroup: true,
    items: [
      { id: 'item-1', productOwnershipId: null, name: 'Gourde inox 1L', category: 'Hydratation', quantity: 1, weightG: 180, weightSource: 'declared', isChecked: true, slotId: 'interior-main', slotOrder: 0, visual: null },
      { id: 'item-2', productOwnershipId: null, name: 'Tente 2 places', category: 'Bivouac', quantity: 1, weightG: 1650, weightSource: 'declared', isChecked: true, slotId: 'interior-main', slotOrder: 1, visual: null },
      { id: 'item-3', productOwnershipId: null, name: 'Duvet compact 5°C', category: 'Couchage', quantity: 1, weightG: 710, weightSource: 'declared', isChecked: true, slotId: 'interior-bottom', slotOrder: 0, visual: null },
      { id: 'item-4', productOwnershipId: null, name: 'Lampe frontale 300lm', category: 'Sécurité', quantity: 1, weightG: 90, weightSource: 'declared', isChecked: true, slotId: 'lid-top', slotOrder: 0, visual: null },
      { id: 'item-5', productOwnershipId: null, name: 'Trousse de premiers secours', category: 'Sécurité', quantity: 1, weightG: 210, weightSource: 'declared', isChecked: false, slotId: 'pocket-front', slotOrder: 0, visual: null },
      { id: 'item-6', productOwnershipId: null, name: 'Réchaud à gaz compact', category: 'Cuisine', quantity: 1, weightG: 140, weightSource: 'declared', isChecked: true, slotId: 'interior-main', slotOrder: 2, visual: null },
    ],
    placedBadges: [{ id: 'badge-placed-1', badgeId: 'badge-alpin', anchorId: 'badge-body-front', scale: 1 }],
  },
  ownedCandidates: [
    { id: 'cand-1', productOwnershipId: null, name: 'Filtre à eau compact', category: 'Hydratation', weightG: 85 },
    { id: 'cand-2', productOwnershipId: null, name: 'Veste imperméable Hardshell', category: 'Vêtements', weightG: 360 },
    { id: 'cand-3', productOwnershipId: null, name: 'Matelas gonflable 3 saisons', category: 'Couchage', weightG: 390 },
  ],
  badges: [
    { id: 'badge-alpin', label: 'Alpin', description: 'Écusson alpin officiel', kind: 'patch', earned: true, colorToken: 'var(--hub-bag-forest)' },
    { id: 'badge-camp', label: 'Camp partagé', description: 'Bivouac en altitude', kind: 'patch', earned: true, colorToken: 'var(--hub-primary)' },
    { id: 'badge-sommet', label: 'Premier 3000m', description: 'Trophée officiel 3000m', kind: 'trophy', earned: true, colorToken: 'var(--hub-secondary)' },
  ],
  loans: [
    {
      id: 'loan-1',
      itemName: 'Réchaud à gaz compact',
      category: 'Cuisine',
      weightG: 140,
      ownerId: 'mem-1',
      ownerName: 'Camille',
      borrowerId: 'own-user',
      startDate: '2026-11-01',
      dueDate: '2026-11-05',
      status: 'active',
      canPackInKit: true,
      canSublend: false,
    },
  ],
  catalogItems: [
    { id: 'cat-1', name: 'Bâtons de marche carbone', category: 'Randonnée', weightG: 280, inStock: true, priceCents: 4999 },
    { id: 'cat-2', name: 'Popote aluminium 2 pers', category: 'Cuisine', weightG: 220, inStock: true, priceCents: 1850 },
    { id: 'cat-3', name: 'Crampons légers 10 pointes', category: 'Alpinisme', weightG: 480, inStock: true, priceCents: 1200 },
  ],
  groupMembers: [
    {
      memberId: 'mem-1',
      memberName: 'Camille',
      readOnly: true,
      viewerCanReadDocs: false,
      kit: {
        kitId: 'kit-camille',
        name: 'Sac de Camille',
        bagModelId: 'daypack-20',
        bagParts: {},
        revision: 1,
      },
      items: [
        { id: 'c-1', productOwnershipId: null, name: 'Réchaud partagé', category: 'Cuisine', quantity: 1, weightG: 140, weightSource: 'declared', isChecked: true, slotId: null, slotOrder: 0, visual: null },
        { id: 'c-2', productOwnershipId: null, name: 'Popote duo', category: 'Cuisine', quantity: 1, weightG: 220, weightSource: 'declared', isChecked: true, slotId: null, slotOrder: 1, visual: null },
      ],
      placedBadges: [],
    },
    {
      memberId: 'mem-2',
      memberName: 'Alex',
      readOnly: true,
      viewerCanReadDocs: false,
      kit: {
        kitId: 'kit-alex',
        name: 'Sac d’Alex',
        bagModelId: 'trekker-55',
        bagParts: {},
        revision: 1,
      },
      items: [
        { id: 'a-1', productOwnershipId: null, name: 'Filtre à eau partagé', category: 'Hydratation', quantity: 1, weightG: 85, weightSource: 'declared', isChecked: true, slotId: null, slotOrder: 0, visual: null },
        { id: 'a-2', productOwnershipId: null, name: 'Lampe frontale 400lm', category: 'Sécurité', quantity: 1, weightG: 95, weightSource: 'declared', isChecked: true, slotId: null, slotOrder: 1, visual: null },
      ],
      placedBadges: [],
    },
  ],
};

/**
 * Les 6 drawers du Kit Studio, dans l'ordre de la capsule d'onglets.
 * Source unique de la navigation : icône seule, le libellé ne vit que dans `aria-label`.
 */
const STUDIO_DRAWER_BUTTONS: Array<{
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

export function KitStudioView({
  requestedKitId = null,
  activeDrawer,
  subDrawerId,
  tripId = null,
  crewId = null,
  onSelectDrawer,
  onExitStudio,
}: KitStudioViewProps) {
  const { triggerHaptic } = useHapticFeedback();

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
      console.warn('[KitStudioView] loadBootstrap failed, activating robust local fallback:', err);
      setBootstrap(FALLBACK_STUDIO_PAYLOAD);
      const fallbackCfg = payloadToKitConfiguration(FALLBACK_STUDIO_PAYLOAD.activeKit!);
      setSeedConfig(fallbackCfg);
      setKitName(FALLBACK_STUDIO_PAYLOAD.activeKit!.name);
      setIsSharedWithGroup(true);
      setIsLocalDraft(true);
      setLoadState('ready');
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

  // Masquage impératif de la bottom bar native iPhone (UIKit via NavigationBar) et web
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } })
    );
    document.documentElement.setAttribute('data-kit-studio-open', 'true');
    document.body.setAttribute('data-kit-studio-open', 'true');

    return () => {
      window.dispatchEvent(
        new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } })
      );
      document.documentElement.removeAttribute('data-kit-studio-open');
      document.body.removeAttribute('data-kit-studio-open');
    };
  }, []);

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
      console.warn('[KitStudioView] loadBootstrap failed, activating robust local fallback:', err);
      setBootstrap(FALLBACK_STUDIO_PAYLOAD);
      const fallbackCfg = payloadToKitConfiguration(FALLBACK_STUDIO_PAYLOAD.activeKit!);
      setSeedConfig(fallbackCfg);
      setKitName(FALLBACK_STUDIO_PAYLOAD.activeKit!.name);
      setIsSharedWithGroup(true);
      setIsLocalDraft(true);
      setLoadState('ready');
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

  const formattedWeightKg = useMemo(() => {
    const kg = displayedTotals.knownWeightG / 1000;
    return kg.toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }, [displayedTotals.knownWeightG]);

  const weightProgressPct = useMemo(() => {
    // Benchmark 10 kg pour sac de randonnée itinérante
    const benchmarkG = 10000;
    return Math.min(100, Math.max(6, (displayedTotals.knownWeightG / benchmarkG) * 100));
  }, [displayedTotals.knownWeightG]);

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

  const visibleDrawerButtons = useMemo(
    () =>
      isReadOnlyPeer
        ? STUDIO_DRAWER_BUTTONS.filter((button) => button.allowedInReadOnly)
        : STUDIO_DRAWER_BUTTONS,
    [isReadOnlyPeer]
  );

  const effectiveDrawer = activeDrawer ?? 'personnaliser';
  const activeDrawerIndex = visibleDrawerButtons.findIndex(
    (button) => button.id === effectiveDrawer
  );

  // Garde de synchro URL → drawer actif : la machine de navigation peut arriver
  // avec un `activeDrawer` retardataire (état client restauré, HMR) alors que
  // l'URL désigne déjà un drawer. L'URL fait foi : on réaligne la machine une fois.
  const urlDrawerSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('studio') !== '1') {
      urlDrawerSyncRef.current = null;
      return;
    }
    const urlDrawer = visibleDrawerButtons.find(
      (button) => button.id === params.get('drawer')
    );
    if (!urlDrawer || urlDrawer.id === activeDrawer) {
      urlDrawerSyncRef.current = null;
      return;
    }
    const syncKey = `${urlDrawer.id}>${activeDrawer ?? '∅'}`;
    if (urlDrawerSyncRef.current === syncKey) return;
    urlDrawerSyncRef.current = syncKey;
    onSelectDrawer(urlDrawer.id);
  }, [activeDrawer, onSelectDrawer, visibleDrawerButtons]);

  const handleSelectDrawerTab = useCallback(
    (drawer: StudioDrawer) => {
      triggerHaptic('selection');
      if (drawer !== 'personnaliser') {
        setFocusedPartId(null);
      }
      onSelectDrawer(drawer);
      setIsDrawerCollapsed(false);
    },
    [onSelectDrawer, triggerHaptic]
  );

  // Navigation clavier de la capsule (role=tablist) : flèches, Home, End.
  const handleDrawerTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const { key } = event;
      if (
        key !== 'ArrowRight' &&
        key !== 'ArrowLeft' &&
        key !== 'Home' &&
        key !== 'End'
      ) {
        return;
      }
      const count = visibleDrawerButtons.length;
      if (count === 0) return;
      event.preventDefault();

      let nextIndex: number;
      if (key === 'Home') {
        nextIndex = 0;
      } else if (key === 'End') {
        nextIndex = count - 1;
      } else if (key === 'ArrowRight') {
        nextIndex = activeDrawerIndex >= 0 ? (activeDrawerIndex + 1) % count : 0;
      } else {
        nextIndex =
          activeDrawerIndex >= 0 ? (activeDrawerIndex - 1 + count) % count : count - 1;
      }

      const nextButton =
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[
          nextIndex
        ];
      nextButton?.focus();
      const nextDrawer = visibleDrawerButtons[nextIndex]?.id;
      if (nextDrawer) {
        handleSelectDrawerTab(nextDrawer);
      }
    },
    [activeDrawerIndex, handleSelectDrawerTab, visibleDrawerButtons]
  );

  return (
    <div
      data-testid="kit-studio-view"
      data-view-mode={effectiveListMode ? 'list' : '3d'}
      data-readonly={isReadOnlyPeer ? 'true' : 'false'}
      data-lighting-preset={autoAmbience ? lightingPreset : 'atelier-neutre'}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 flex flex-col text-[var(--hub-text-primary)] select-none overflow-hidden"
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
        className="w-full relative flex-1 min-h-0 flex flex-col overflow-hidden transition-all duration-300"
      >
        {/* Barre de progression de charge (ultra épurée, liquid glass fondue dans le décor) */}
        {loadState === 'ready' && (
          <div
            data-testid="studio-weight-progress-bar"
            className="studio-liquid-weight-bar"
            aria-label={`Poids : ${formattedWeightKg} kg`}
          >
            <span className="studio-weight-label">
              poid : {formattedWeightKg}Kg
            </span>
            <div className="studio-progress-track">
              <div
                className="studio-progress-fill"
                style={{ width: `${weightProgressPct}%` }}
              />
            </div>
          </div>
        )}
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
                    triggerHaptic('selection');
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

        {/* Sortie visible du Studio (44×44, en haut à gauche, sans toucher au swipe gauche existant) */}
        <button
          type="button"
          data-testid="studio-exit-btn"
          aria-label="Quitter le Kit Studio"
          onClick={() => {
            triggerHaptic('light');
            onExitStudio();
          }}
          className="camp-glass-close-btn absolute left-4"
          style={{ top: 'max(16px, var(--safe-top))' }}
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
      </main>

      {/* 2. Pilule flottante « ... » au centre (quand le tiroir est baissé, comme sur la page Hub) */}
      {loadState === 'ready' && isDrawerCollapsed && (
        <div className="studio-floating-pill-container" data-testid="studio-pill-container">
          <button
            type="button"
            data-testid="studio-floating-pill"
            onClick={() => {
              triggerHaptic('light');
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

      {/* 3. Feuille du tiroir en bas (Liquid Glass iOS 27 — 38dvh : capsule d'onglets + contenu, encoche centrée, pilule de repli) */}
      {loadState === 'ready' && !isDrawerCollapsed && (
        <div
          data-testid={`studio-active-drawer-${effectiveDrawer}`}
          data-drawer-sheet="true"
          role="region"
          aria-label="Panneau Kit Studio"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
            event.preventDefault();
            triggerHaptic('light');
            if (!isDrawerCollapsed) {
              setIsDrawerCollapsed(true);
            } else {
              onExitStudio();
            }
          }}
          onPointerDown={() => {
            drawerDragActiveRef.current = true;
          }}
          onPointerUp={() => {
            drawerDragActiveRef.current = false;
          }}
          onPointerCancel={() => {
            drawerDragActiveRef.current = false;
          }}
          className="hub-camp-drawer-sheet w-full shrink-0 flex flex-col z-30 transition-all duration-300 mt-auto"
          style={{
            height: '38dvh',
            maxHeight: '38dvh',
            paddingBottom: 'max(16px, var(--safe-bottom))',
          }}
        >
          {/* Encoche centrée pour baisser le tiroir (zéro texte "personnaliser", zéro croix) */}
          <div
            role="button"
            tabIndex={0}
            data-testid="studio-collapse-drawer-btn"
            onClick={() => {
              triggerHaptic('light');
              setIsDrawerCollapsed(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                triggerHaptic('light');
                setIsDrawerCollapsed(true);
              }
            }}
            aria-label="Baisser le tiroir"
            className="w-full flex items-center justify-center pt-2 pb-1 cursor-pointer shrink-0 group active:scale-95 transition-transform"
          >
            <div
              data-drawer-handle="true"
              className="w-10 h-1.5 rounded-full bg-[var(--hub-border-strong)] transition-all duration-200 group-hover:w-12 group-hover:bg-[var(--hub-primary)] shadow-2xs"
            />
          </div>

          {/* Capsule d'onglets des 6 drawers : icônes seules, libellé en aria-label, lentille active */}
          <div className="px-3 pb-1.5 shrink-0" data-testid="studio-drawer-tabbar">
            <div
              role="tablist"
              aria-label="Sections du Kit Studio"
              data-testid="studio-drawer-tabs"
              onKeyDown={handleDrawerTabKeyDown}
              className="hub-drawer-capsule"
              style={{ '--n': visibleDrawerButtons.length } as React.CSSProperties}
            >
              {activeDrawerIndex >= 0 && (
                <span
                  className="sel-lens"
                  aria-hidden="true"
                  style={{ '--i': activeDrawerIndex } as React.CSSProperties}
                />
              )}
              {visibleDrawerButtons.map((button) => {
                const active = button.id === effectiveDrawer;
                const focusable =
                  active ||
                  (activeDrawerIndex < 0 &&
                    button.id === visibleDrawerButtons[0]?.id);
                return (
                  <button
                    key={button.id}
                    type="button"
                    role="tab"
                    id={`studio-drawer-tab-${button.id}`}
                    data-testid={`studio-drawer-tab-${button.id}`}
                    aria-selected={active}
                    aria-label={button.label}
                    tabIndex={focusable ? 0 : -1}
                    className={active ? 'active' : ''}
                    onClick={() => handleSelectDrawerTab(button.id)}
                  >
                    <span className="ic" aria-hidden="true">
                      {button.icon}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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
    </div>
  );
}
