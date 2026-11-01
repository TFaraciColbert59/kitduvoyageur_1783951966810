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

  const effectiveListMode = viewMode === 'list' || degradedReason !== null;

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

  return (
    <div
      data-testid="kit-studio-view"
      data-view-mode={effectiveListMode ? 'list' : '3d'}
      data-readonly={isReadOnlyPeer ? 'true' : 'false'}
      data-lighting-preset={autoAmbience ? lightingPreset : 'atelier-neutre'}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--hub-bg)] text-[var(--hub-text-primary)]"
      style={{
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
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

      {/* 1. Barre supérieure du Studio */}
      <header className="px-3.5 py-2 flex items-center justify-between gap-2 border-b border-[var(--hub-border-subtle)] bg-[var(--hub-surface-card)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            data-testid="studio-exit-btn"
            onClick={onExitStudio}
            aria-label="Quitter l’atelier et revenir au Camp de Base"
            className="min-h-[44px] min-w-[44px] rounded-full bg-[var(--hub-surface)] border border-[var(--hub-border)] flex items-center justify-center text-[var(--hub-primary)] shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <h1
              data-testid="studio-kit-title"
              className="text-sm font-bold text-[var(--hub-text-primary)] truncate"
            >
              {isReadOnlyPeer
                ? `${inspectedMember.kit.name} (${inspectedMember.memberName})`
                : kitName}
            </h1>
            <div
              data-testid="studio-header-weight"
              className="text-xs text-[var(--hub-text-secondary)] truncate"
            >
              {weightSummary.fullLabel} • {displayedTotals.checkedCount}/
              {displayedTotals.itemCount} prêt
              {displayedTotals.checkedCount > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Sélecteur direct 3D / Liste (cible >= 44px, persistant D-16) */}
        <button
          type="button"
          data-testid="studio-quick-mode-toggle"
          onClick={() =>
            handleChangeViewMode(effectiveListMode ? '3d' : 'list')
          }
          aria-label={
            effectiveListMode
              ? 'Passer en scène 3D interactive'
              : 'Passer en mode Liste'
          }
          className="min-h-[44px] px-3.5 rounded-full bg-[var(--hub-surface)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-primary)] inline-flex items-center gap-1.5 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
        >
          {effectiveListMode ? (
            <>
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>3D</span>
            </>
          ) : (
            <>
              <List className="w-4 h-4" aria-hidden="true" />
              <span>Liste</span>
            </>
          )}
        </button>
      </header>

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

      {/* 2. Zone centrale : Chargement / Erreur (A-07) / Vide honnête (D-03) / Scène 3D XOR Liste */}
      <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
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
          <>
            {effectiveListMode ? (
              <BagListView
                config={displayedConfig}
                totals={displayedTotals}
                degradedReason={degradedReason}
                readOnly={isReadOnlyPeer}
                ownerLabel={inspectedMember?.memberName ?? null}
                onToggleChecked={
                  isReadOnlyPeer
                    ? undefined
                    : (id, checked) => void studio.toggleItemChecked(id, checked)
                }
                onUpdateQuantity={
                  isReadOnlyPeer
                    ? undefined
                    : (id, qty) => void studio.updateItemQuantity(id, qty)
                }
                onMoveItem={
                  isReadOnlyPeer
                    ? undefined
                    : (id, slot) => void studio.moveItem(id, slot)
                }
                onRemoveItem={
                  isReadOnlyPeer
                    ? undefined
                    : (id) => void studio.removeItem(id)
                }
                onOpenDrawer={
                  isReadOnlyPeer
                    ? undefined
                    : (d) => onSelectDrawer(d)
                }
              />
            ) : (
              <BagScene
                config={displayedConfig}
                focusedPartId={focusedPartId}
                activeDrawerOpen={Boolean(activeDrawer)}
                isCoveredByOpaqueSheet={false}
                isUiGestureActive={() => drawerDragActiveRef.current}
                badgeCatalog={badgeCatalogMap}
                readOnly={isReadOnlyPeer}
                onSelectPart={
                  isReadOnlyPeer
                    ? undefined
                    : (partId) => {
                        const targetPart =
                          partId === 'shoulder-strap-r' ? 'shoulder-strap-l' : partId;
                        setFocusedPartId(targetPart);
                        onSelectDrawer('personnaliser');
                      }
                }
                onManifestLoaded={handleManifestLoaded}
                onDegraded={(reason) => setDegradedReason(reason)}
                externalIntent={externalIntent}
              />
            )}
          </>
        )}
      </main>

      {/* 3. Barre capsule inférieure : Sélection des éléments à personnaliser (Apple Liquid Glass iOS 27) */}
      {loadState === 'ready' && (
        <nav
          aria-label="Sélection des éléments à personnaliser"
          data-studio-ui="true"
          className="px-3 pt-2 pb-2 shrink-0 relative z-[2010]"
          style={{
            paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
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
            {activeDrawer === 'personnaliser' &&
              focusedPartId &&
              STUDIO_CUSTOM_PARTS.some((p) => p.id === focusedPartId) && (
                <span className="sel-lens" aria-hidden="true" />
              )}
            {STUDIO_CUSTOM_PARTS.map((target) => {
              const active =
                activeDrawer === 'personnaliser' && focusedPartId === target.id;
              return (
                <button
                  key={target.id}
                  type="button"
                  data-testid={`studio-part-target-${target.id}`}
                  aria-pressed={active}
                  onClick={() => handleSelectPartTarget(target.id)}
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

      {/* 4. Feuille du tiroir actif du Studio (Liquid Glass iOS 27 .lkdv-seal-drawer) */}
      {loadState === 'ready' && activeDrawer && (
        <div
          data-testid="studio-drawer-backdrop"
          className="hub-camp-drawer-overlay kit-studio-drawer-backdrop"
          onClick={handleCloseDrawer}
        >
          <div
            data-testid={`studio-active-drawer-${activeDrawer}`}
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
            className="hub-camp-drawer-sheet h-[56dvh] max-h-[56dvh] flex flex-col"
            style={{
              paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-[var(--hub-border-subtle)] shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--hub-primary)]">
                {activeDrawer === 'personnaliser' && focusedPartId
                  ? `Personnaliser — ${STUDIO_CUSTOM_PARTS.find((p) => p.id === focusedPartId)?.label ?? focusedPartId}`
                  : drawerButtons.find((b) => b.id === activeDrawer)?.label ?? activeDrawer}
              </span>
              <div
                data-drawer-handle="true"
                className="w-10 h-1.5 rounded-full bg-[var(--hub-border-strong)]"
              />
              <button
                type="button"
                data-testid="studio-close-drawer-btn"
                onClick={handleCloseDrawer}
                aria-label="Fermer le tiroir de l’atelier"
                className="camp-glass-close-btn"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-1">
            {activeDrawer === 'inventaire' && (
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

            {activeDrawer === 'personnaliser' && !isReadOnlyPeer && (
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

            {activeDrawer === 'statistiques' && (
              <StatistiquesDrawer
                config={displayedConfig}
                totals={displayedTotals}
              />
            )}

            {activeDrawer === 'lignee' && !isReadOnlyPeer && (
              <LigneeDrawer
                kitId={displayedConfig.kitId}
                initialLineage={bootstrap?.lineage}
              />
            )}

            {activeDrawer === 'insignes' && !isReadOnlyPeer && (
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

            {activeDrawer === 'options' && !isReadOnlyPeer && (
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
      </div>
    )}
  </div>
);
}
