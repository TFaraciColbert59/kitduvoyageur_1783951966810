'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Backpack,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudSun,
  Compass,
  Cpu,
  Droplets,
  ExternalLink,
  Footprints,
  Gauge,
  Loader2,
  MapPin,
  Mountain,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { resolveGearProductImage } from '@/components/clubs/drawer/ClubGearProductCard';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type { ComputedItinerary, ExplanationVariableItem } from '../../routing/types';

export interface RouteExplainabilitySubSheetProps {
  itinerary: ComputedItinerary;
  activeKitId?: string | null;
  packWeightKg?: number;
  onOpenKit?: () => void;
  onFocusCoordinates?: (coords: [number, number], label?: string) => void;
  onBack?: () => void;
  embedded?: boolean;
}

interface InventoryItemRow {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  weight_g?: number | null;
  photo_url?: string | null;
  condition?: string | null;
  status?: string | null;
  tags?: string[] | null;
  quantity?: number | null;
}

interface KitItemRow {
  id: string;
  product_ownership_id?: string | null;
  product_id?: string | null;
  name: string;
  category?: string | null;
  weight_g?: number | null;
  quantity?: number | null;
  is_checked?: boolean | null;
}

interface KitRow {
  id: string;
  name: string;
  season?: string | null;
  total_weight_g?: number | null;
  is_favorite?: boolean | null;
  materiel_kit_items?: KitItemRow[];
}

interface GearNeedSpec {
  id: string;
  title: string;
  category: string;
  reason: string;
  priority: 'essential' | 'recommended';
  pattern: RegExp;
  fallbackImage: string;
}

interface ResolvedGearNeed extends GearNeedSpec {
  status: 'in_kit' | 'in_inventory' | 'missing';
  matchedName?: string;
  matchedBrand?: string | null;
  matchedWeightG?: number | null;
  matchedImage?: string;
  kitItemId?: string;
  isChecked?: boolean;
  inventoryItemId?: string;
  inventoryCategory?: string | null;
}

const VALID_MATERIEL_CATEGORIES = new Set([
  'Sacs & Portage',
  'Couchage & Tentes',
  'Vêtements & Vestes',
  'Cuisine & Réchauds',
  'Eau & Filtres',
  'Lampes & Éclairage',
  'Navigation & GPS',
  'Sécurité & Soins',
  'Accessoires & Outils',
  'Autre',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeMaterielCategory(raw: string | null | undefined): string {
  if (raw && VALID_MATERIEL_CATEGORIES.has(raw)) return raw;
  return 'Autre';
}

function sanitizeUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

const PILLARS: Array<{
  id: ExplanationVariableItem['pillar'];
  short: string;
  icon: React.ReactNode;
}> = [
  { id: 'physiology', short: 'Physio', icon: <Activity size={13} aria-hidden="true" /> },
  { id: 'equipment', short: 'Équip.', icon: <Backpack size={13} aria-hidden="true" /> },
  { id: 'weather', short: 'Météo', icon: <CloudSun size={13} aria-hidden="true" /> },
  { id: 'terrain', short: 'Terrain', icon: <Mountain size={13} aria-hidden="true" /> },
];

// Lightweight client cache so switching tabs inside the drawer is instant
let cachedInventoryPayload: {
  fetchedAt: number;
  authenticated: boolean;
  items: InventoryItemRow[];
  kits: KitRow[];
} | null = null;
const INVENTORY_CACHE_TTL_MS = 60_000;

function normalizeFr(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function dedupeKitRows(rawKits: readonly KitRow[]): KitRow[] {
  const byId = new Map<string, KitRow>();
  for (const kit of rawKits) {
    if (kit?.id && !byId.has(kit.id)) {
      byId.set(kit.id, kit);
    }
  }
  const order: string[] = [];
  const bestByName = new Map<string, KitRow>();
  const score = (k: KitRow) =>
    (k.is_favorite ? 1000 : 0) +
    Math.min(k.materiel_kit_items?.length ?? 0, 100) * 10 +
    ((k.total_weight_g ?? 0) > 0 ? 5 : 0);

  for (const kit of byId.values()) {
    const key = normalizeFr(kit.name || kit.id).trim();
    const prev = bestByName.get(key);
    if (!prev) {
      order.push(key);
      bestByName.set(key, kit);
    } else if (score(kit) > score(prev)) {
      bestByName.set(key, kit);
    }
  }
  return order.map((k) => bestByName.get(k)).filter((k): k is KitRow => Boolean(k));
}

function formatWeightCompact(grams: number | null | undefined): string {
  if (!grams || grams <= 0) return '';
  if (grams >= 1000) return `${(grams / 1000).toFixed(1).replace('.', ',')} kg`;
  return `${Math.round(grams)} g`;
}

function parseMinTempC(wxValue: string | undefined): number | null {
  if (!wxValue) return null;
  const matches = wxValue.match(/-?\d+(?=\s*°C)/g);
  if (!matches || matches.length === 0) return null;
  const nums = matches.map(Number).filter((n) => Number.isFinite(n));
  return nums.length > 0 ? Math.min(...nums) : null;
}

function parseRidgeWindKmh(wxValue: string | undefined): number | null {
  if (!wxValue) return null;
  const ridge = wxValue.match(/crête\s+(\d+)\s*km\/h/i);
  if (ridge?.[1]) return Number(ridge[1]);
  const wind = wxValue.match(/vent\s+(\d+)\s*km\/h/i);
  if (wind?.[1]) return Number(wind[1]);
  return null;
}

function iconForVariable(id: string, pillar: ExplanationVariableItem['pillar']): React.ReactNode {
  if (id.includes('pace')) return <Footprints size={15} aria-hidden="true" />;
  if (id.includes('pack')) return <Backpack size={15} aria-hidden="true" />;
  if (id.includes('altitude')) return <Mountain size={15} aria-hidden="true" />;
  if (id.includes('readiness')) return <Gauge size={15} aria-hidden="true" />;
  if (id.includes('safety') || id.includes('mode')) return <ShieldCheck size={15} aria-hidden="true" />;
  if (id.includes('conditions')) return <Wind size={15} aria-hidden="true" />;
  if (id.includes('daylight')) return <Sun size={15} aria-hidden="true" />;
  if (id.includes('services')) return <Droplets size={15} aria-hidden="true" />;
  if (pillar === 'weather') return <Thermometer size={15} aria-hidden="true" />;
  if (pillar === 'equipment') return <ShieldCheck size={15} aria-hidden="true" />;
  if (pillar === 'terrain') return <Mountain size={15} aria-hidden="true" />;
  return <Activity size={15} aria-hidden="true" />;
}

function pillarStatusTone(
  variables: readonly ExplanationVariableItem[],
  pillar: ExplanationVariableItem['pillar'],
): 'good' | 'warn' | 'bad' | 'neutral' {
  const items = variables.filter((v) => v.pillar === pillar);
  if (items.some((v) => v.tone === 'bad')) return 'bad';
  if (items.some((v) => v.tone === 'warn')) return 'warn';
  if (items.some((v) => v.tone === 'good')) return 'good';
  return 'neutral';
}

function engineShortLabel(engine: ComputedItinerary['engineUsed'], ms: number): string {
  const t = ms < 1 ? '< 1 ms' : `${Math.round(ms)} ms`;
  switch (engine) {
    case 'rust_wasm_local':
      return `Rust/WASM · ${t}`;
    case 'ts_parity_local':
      return `Local · ${t}`;
    case 'multimodal_hybrid':
      return `Multimodal + DEM · ${t}`;
    case 'geoapify_enriched':
      return `Geoapify + DEM · ${t}`;
    default:
      return `Valhalla + DEM · ${t}`;
  }
}

function buildRouteGearNeeds(itinerary: ComputedItinerary): GearNeedSpec[] {
  const wxVar = itinerary.explanation.variables.find((v) => v.id === 'wx-conditions');
  const minTempC = parseMinTempC(wxVar?.value);
  const ridgeWindKmh = parseRidgeWindKmh(wxVar?.value);
  const hasRain =
    Boolean(wxVar?.detail && /précipitations/i.test(wxVar.detail)) ||
    Boolean(wxVar?.impactLabel && /orage/i.test(wxVar.impactLabel));
  const isCold = (minTempC !== null && minTempC <= 8) || (itinerary.maxAltM ?? 0) >= 1500;
  const isNight = itinerary.afterDarkMinutes > 0;
  const isAlpine =
    (itinerary.maxAltM ?? 0) >= 2200 ||
    ['T4', 'T5', 'T6'].includes(itinerary.explanation.maxSacGradeLabel);
  const isSnowRisk =
    itinerary.mode === 'ski' ||
    itinerary.mode === 'raquettes' ||
    (itinerary.explanation.exposedSlope30PlusM > 50 && isCold);

  const needs: GearNeedSpec[] = [];

  if (isNight || itinerary.durationP50Min >= 150) {
    needs.push({
      id: 'need-headlamp',
      title: 'Lampe frontale',
      category: 'Lampes & Éclairage',
      reason: isNight ? `Arrivée de nuit (+${itinerary.afterDarkMinutes} min)` : 'Sécurité fin de journée',
      priority: isNight ? 'essential' : 'recommended',
      pattern: /(frontale|headlamp|lampe|eclairage|petzl|black diamond|ledlenser)/,
      fallbackImage: '/assets/images/product-headlamp.jpg',
    });
  }

  if (isCold) {
    needs.push({
      id: 'need-thermal',
      title: 'Couche chaude / doudoune',
      category: 'Vêtements & Vestes',
      reason:
        minTempC !== null
          ? `Froid annoncé (${minTempC}°C)`
          : `Altitude ${itinerary.maxAltM} m`,
      priority: minTempC !== null && minTempC <= 3 ? 'essential' : 'recommended',
      pattern: /(doudoune|polaire|merino|thermique|fleece|down|isol|pull|gant|bonnet)/,
      fallbackImage: '/assets/images/product-jacket.jpg',
    });
  }

  needs.push({
    id: 'need-shell',
    title: 'Veste imperméable / coupe-vent',
    category: 'Vêtements & Vestes',
    reason: hasRain
      ? 'Pluie ou orage sur le corridor'
      : ridgeWindKmh !== null && ridgeWindKmh >= 30
        ? `Vent exposé (${ridgeWindKmh} km/h)`
        : 'Protection vent & averses',
    priority: hasRain || (ridgeWindKmh !== null && ridgeWindKmh >= 40) ? 'essential' : 'recommended',
    pattern: /(gore-?tex|hardshell|impermeable|coupe-vent|veste|shell|rain|poncho|k-?way)/,
    fallbackImage: '/assets/images/gear-jacket.jpg',
  });

  needs.push({
    id: 'need-water',
    title: `Hydratation (${itinerary.hydrationLiters.toFixed(1).replace('.', ',')} L)`,
    category: 'Eau & Filtres',
    reason:
      itinerary.explanation.waterPointsCount > 0
        ? `${itinerary.explanation.waterPointsCount} point(s) d’eau sur la trace`
        : 'Aucun point d’eau sur la trace',
    priority: 'essential',
    pattern: /(gourde|flasque|flask|camelbak|poche a eau|hydrat|filtre|katadyn|sawyer|nalgene|bouteille)/,
    fallbackImage: '/assets/images/product-bottle.jpg',
  });

  needs.push({
    id: 'need-firstaid',
    title: 'Trousse secours & survie',
    category: 'Sécurité & Soins',
    reason: `Sortie ${itinerary.distanceKm.toFixed(0)} km · autonomie terrain`,
    priority: itinerary.distanceKm >= 15 || isAlpine ? 'essential' : 'recommended',
    pattern: /(secours|first aid|trousse|survie|pharmacie|pansement|sifflet)/,
    fallbackImage: '/assets/images/product-backpack.jpg',
  });

  if (itinerary.durationP50Min >= 150 || itinerary.distanceKm >= 15) {
    needs.push({
      id: 'need-nav',
      title: 'Batterie externe / GPS',
      category: 'Navigation & GPS',
      reason: `Guidage ${Math.round(itinerary.durationP50Min / 60)}h+`,
      priority: 'recommended',
      pattern: /(batterie|powerbank|chargeur|gps|boussole|carte|inreach|garmin|montre)/,
      fallbackImage: '/assets/images/product-backpack-2.jpg',
    });
  }

  if (isAlpine) {
    needs.push({
      id: 'need-alpine',
      title: 'Chaussures cramponnables / bâtons',
      category: 'Sacs & Portage',
      reason: `Terrain ${itinerary.explanation.maxSacGradeLabel} · pente ${itinerary.explanation.maxSlopeDeg}°`,
      priority: 'essential',
      pattern: /(crampon|piolet|chaussure|baton|casque|harnais|baudrier)/,
      fallbackImage: '/assets/images/gear-boots.jpg',
    });
  }

  if (isSnowRisk) {
    needs.push({
      id: 'need-avalanche',
      title: 'Pack DVA · Pelle · Sonde',
      category: 'Sécurité & Soins',
      reason: 'Neige & pentes ≥ 30°',
      priority: 'essential',
      pattern: /(dva|arva|pelle|sonde|avalanche)/,
      fallbackImage: '/assets/images/product-backpack.jpg',
    });
  }

  return needs;
}

function matchGearToInventory(
  needs: GearNeedSpec[],
  inventoryItems: InventoryItemRow[],
  activeKit: KitRow | null,
): {
  resolved: ResolvedGearNeed[];
  otherKitItems: KitItemRow[];
} {
  const usableInventory = inventoryItems.filter(
    (it) => it.condition !== 'pour_pieces' && it.status !== 'vendu',
  );
  const kitItems = activeKit?.materiel_kit_items ?? [];
  const usedKitItemIds = new Set<string>();

  const ownershipById = new Map<string, InventoryItemRow>();
  for (const inv of usableInventory) {
    ownershipById.set(inv.id, inv);
  }

  const resolved: ResolvedGearNeed[] = needs.map((need) => {
    // 1. Check active kit first
    const matchedKitItem = kitItems.find((ki) => {
      const hay = normalizeFr(`${ki.name} ${ki.category ?? ''}`);
      return need.pattern.test(hay);
    });
    if (matchedKitItem) {
      usedKitItemIds.add(matchedKitItem.id);
      const linkedInv = matchedKitItem.product_ownership_id
        ? ownershipById.get(matchedKitItem.product_ownership_id)
        : undefined;
      return {
        ...need,
        status: 'in_kit',
        matchedName: matchedKitItem.name,
        matchedBrand: linkedInv?.brand ?? null,
        matchedWeightG: matchedKitItem.weight_g ?? linkedInv?.weight_g ?? null,
        matchedImage:
          linkedInv?.photo_url ||
          resolveGearProductImage(matchedKitItem.name, matchedKitItem.category ?? need.category),
        kitItemId: matchedKitItem.id,
        isChecked: Boolean(matchedKitItem.is_checked),
      };
    }

    // 2. Check full personal inventory (product_ownership)
    const matchedInv = usableInventory.find((inv) => {
      const hay = normalizeFr(
        `${inv.name} ${inv.brand ?? ''} ${inv.category ?? ''} ${(inv.tags ?? []).join(' ')}`,
      );
      return need.pattern.test(hay);
    });
    if (matchedInv) {
      return {
        ...need,
        status: 'in_inventory',
        matchedName: matchedInv.name,
        matchedBrand: matchedInv.brand ?? null,
        matchedWeightG: matchedInv.weight_g ?? null,
        matchedImage:
          matchedInv.photo_url ||
          resolveGearProductImage(matchedInv.name, matchedInv.category ?? need.category),
        inventoryItemId: matchedInv.id,
        inventoryCategory: matchedInv.category ?? null,
      };
    }

    // 3. Not owned yet → recommend clearly
    return {
      ...need,
      status: 'missing',
      matchedImage: need.fallbackImage,
    };
  });

  const otherKitItems = kitItems.filter((ki) => !usedKitItemIds.has(ki.id)).slice(0, 8);
  return { resolved, otherKitItems };
}

export function RouteExplainabilitySubSheet({
  itinerary,
  activeKitId = null,
  packWeightKg,
  onOpenKit,
  onFocusCoordinates,
  onBack,
  embedded = false,
}: RouteExplainabilitySubSheetProps) {
  const [activePillar, setActivePillar] = useState<ExplanationVariableItem['pillar']>('physiology');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryAuthed, setInventoryAuthed] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>(
    () => cachedInventoryPayload?.items ?? [],
  );
  const [userKits, setUserKits] = useState<KitRow[]>(
    () => cachedInventoryPayload?.kits ?? [],
  );
  const [pendingToggleIds, setPendingToggleIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingAddIds, setPendingAddIds] = useState<ReadonlySet<string>>(() => new Set());
  const [kitActionError, setKitActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!onBack || embedded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack, embedded]);

  // Load real user inventory + kits when Equipment pillar opens (or warm from cache)
  useEffect(() => {
    if (activePillar !== 'equipment') return;
    if (
      cachedInventoryPayload &&
      Date.now() - cachedInventoryPayload.fetchedAt < INVENTORY_CACHE_TTL_MS
    ) {
      setInventoryAuthed(cachedInventoryPayload.authenticated);
      setInventoryItems(cachedInventoryPayload.items);
      setUserKits(cachedInventoryPayload.kits);
      return;
    }

    let cancelled = false;
    setInventoryLoading(true);

    Promise.all([
      fetch('/api/materiel/items').then(async (r) =>
        r.status === 401
          ? { authed: false, items: [] as InventoryItemRow[] }
          : {
              authed: true,
              items: (((await r.json()) as { items?: InventoryItemRow[] }).items ?? []),
            },
      ),
      fetch('/api/materiel/kits').then(async (r) =>
        r.status === 401
          ? { authed: false, kits: [] as KitRow[] }
          : {
              authed: true,
              kits: (((await r.json()) as { kits?: KitRow[] }).kits ?? []),
            },
      ),
    ])
      .then(([itemsRes, kitsRes]) => {
        if (cancelled) return;
        const authed = itemsRes.authed || kitsRes.authed;
        const dedupedKits = dedupeKitRows(kitsRes.kits);
        cachedInventoryPayload = {
          fetchedAt: Date.now(),
          authenticated: authed,
          items: itemsRes.items,
          kits: dedupedKits,
        };
        setInventoryAuthed(authed);
        setInventoryItems(itemsRes.items);
        setUserKits(dedupedKits);
        setInventoryLoading(false);
      })
      .catch(() => {
        if (!cancelled) setInventoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePillar]);

  const { explanation } = itinerary;
  const sb = explanation.surfaceBreakdownPct;
  const pillarItems = explanation.variables.filter((v) => v.pillar === activePillar);

  const selectedKit = useMemo(() => {
    if (userKits.length === 0) return null;
    if (activeKitId) {
      const exact = userKits.find((k) => k.id === activeKitId);
      if (exact) return exact;
    }
    return userKits.find((k) => k.is_favorite) ?? userKits[0] ?? null;
  }, [userKits, activeKitId]);

  const handleToggleKitItem = useCallback(
    async (kitItemId: string, nextChecked: boolean) => {
      if (!kitItemId || kitItemId.startsWith('optimistic-') || pendingToggleIds.has(kitItemId)) {
        return;
      }
      setKitActionError(null);
      setPendingToggleIds((prev) => {
        const next = new Set(prev);
        next.add(kitItemId);
        return next;
      });

      const applyChecked = (checked: boolean) => {
        setUserKits((prev) => {
          const updated = prev.map((kit) => ({
            ...kit,
            materiel_kit_items: kit.materiel_kit_items?.map((ki) =>
              ki.id === kitItemId ? { ...ki, is_checked: checked } : ki,
            ),
          }));
          if (cachedInventoryPayload) {
            cachedInventoryPayload = { ...cachedInventoryPayload, kits: updated };
          }
          return updated;
        });
      };

      applyChecked(nextChecked);

      try {
        const res = await fetch(`/api/materiel/kit-items/${encodeURIComponent(kitItemId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_checked: nextChecked }),
        });
        if (!res.ok) {
          throw new Error('Impossible de mettre à jour cet article.');
        }
      } catch {
        applyChecked(!nextChecked);
        setKitActionError('Mise à jour du sac impossible pour le moment.');
      } finally {
        setPendingToggleIds((prev) => {
          const next = new Set(prev);
          next.delete(kitItemId);
          return next;
        });
      }
    },
    [pendingToggleIds],
  );

  const handleAddToKit = useCallback(
    async (item: ResolvedGearNeed) => {
      if (!selectedKit || !inventoryAuthed || pendingAddIds.has(item.id)) return;
      setKitActionError(null);
      setPendingAddIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });

      const existingItems = selectedKit.materiel_kit_items ?? [];
      const normalizedExisting = existingItems.map((ki) => ({
        product_ownership_id: sanitizeUuidOrNull(ki.product_ownership_id),
        product_id: sanitizeUuidOrNull(ki.product_id),
        name: ki.name.trim().slice(0, 120) || 'Article',
        category: normalizeMaterielCategory(ki.category),
        weight_g: Math.max(0, Math.min(50000, Math.round(ki.weight_g ?? 0))),
        quantity: Math.max(1, Math.min(999, Math.round(ki.quantity ?? 1))),
        is_checked: Boolean(ki.is_checked),
      }));

      const addedPayload = {
        product_ownership_id: sanitizeUuidOrNull(item.inventoryItemId),
        product_id: null,
        name: (item.matchedName ?? item.title).trim().slice(0, 120),
        category: normalizeMaterielCategory(item.inventoryCategory ?? item.category),
        weight_g: Math.max(0, Math.min(50000, Math.round(item.matchedWeightG ?? 0))),
        quantity: 1,
        is_checked: false,
      };

      const nextItems = [...normalizedExisting, addedPayload];
      const nextTotalWeightG = nextItems.reduce(
        (sum, entry) => sum + entry.weight_g * entry.quantity,
        0,
      );

      const previousKits = userKits;
      const optimisticRow: KitItemRow = {
        id: `optimistic-${item.id}`,
        product_ownership_id: addedPayload.product_ownership_id,
        product_id: null,
        name: addedPayload.name,
        category: addedPayload.category,
        weight_g: addedPayload.weight_g,
        quantity: 1,
        is_checked: false,
      };

      setUserKits((prev) => {
        const updated = prev.map((kit) =>
          kit.id === selectedKit.id
            ? {
                ...kit,
                total_weight_g: nextTotalWeightG,
                materiel_kit_items: [...(kit.materiel_kit_items ?? []), optimisticRow],
              }
            : kit,
        );
        if (cachedInventoryPayload) {
          cachedInventoryPayload = { ...cachedInventoryPayload, kits: updated };
        }
        return updated;
      });

      try {
        const res = await fetch(`/api/materiel/kits/${encodeURIComponent(selectedKit.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: nextItems,
            total_weight_g: nextTotalWeightG,
          }),
        });
        if (!res.ok) {
          throw new Error('Ajout au sac refusé.');
        }

        const refreshRes = await fetch('/api/materiel/kits');
        if (refreshRes.ok) {
          const json = (await refreshRes.json()) as { kits?: KitRow[] };
          const deduped = dedupeKitRows(json.kits ?? []);
          setUserKits(deduped);
          if (cachedInventoryPayload) {
            cachedInventoryPayload = {
              ...cachedInventoryPayload,
              fetchedAt: Date.now(),
              kits: deduped,
            };
          }
        }
      } catch {
        setUserKits(previousKits);
        if (cachedInventoryPayload) {
          cachedInventoryPayload = { ...cachedInventoryPayload, kits: previousKits };
        }
        setKitActionError('Impossible d’ajouter cet article au sac.');
      } finally {
        setPendingAddIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [selectedKit, inventoryAuthed, pendingAddIds, userKits],
  );

  const gearNeeds = useMemo(() => buildRouteGearNeeds(itinerary), [itinerary]);
  const { resolved: resolvedGear, otherKitItems } = useMemo(
    () => matchGearToInventory(gearNeeds, inventoryItems, selectedKit),
    [gearNeeds, inventoryItems, selectedKit],
  );

  const ownedGear = useMemo(
    () => resolvedGear.filter((g) => g.status === 'in_kit' || g.status === 'in_inventory'),
    [resolvedGear],
  );
  const missingGear = useMemo(
    () => resolvedGear.filter((g) => g.status === 'missing'),
    [resolvedGear],
  );
  const readinessPct =
    resolvedGear.length > 0 ? Math.round((ownedGear.length / resolvedGear.length) * 100) : 0;

  // Derived Weather & Physio hero values
  const wxCondVar = explanation.variables.find((v) => v.id === 'wx-conditions');
  const wxDaylightVar = explanation.variables.find((v) => v.id === 'wx-daylight');
  const equipModeVar = explanation.variables.find((v) => v.id === 'equip-mode');
  const ridgeWindKmh = parseRidgeWindKmh(wxCondVar?.value);
  const sunsetLabel = wxDaylightVar?.value?.replace(/^Coucher\s+/i, '') || '—';

  const renderVariableRows = (items: readonly ExplanationVariableItem[]) => (
    <div className="xp20-carnet-group-card">
      {items.map((item) => {
        const expanded = expandedId === item.id;
        return (
          <div key={item.id} className="xp20-carnet-row">
            <div className="xp20-carnet-row-main">
              <span className="xp20-carnet-row-ico" data-tone={item.tone}>
                {iconForVariable(item.id, item.pillar)}
              </span>
              <div className="xp20-carnet-row-copy">
                <div className="xp20-carnet-row-title">{item.value}</div>
                <div className="xp20-carnet-row-sub">
                  {item.label.split('(')[0]?.trim()}
                </div>
              </div>
              <div className="xp20-carnet-row-right">
                <span className="xp20-route-impact-badge" data-tone={item.tone}>
                  {item.impactLabel}
                </span>
                <button
                  type="button"
                  className="xp20-carnet-row-chevron"
                  aria-expanded={expanded}
                  aria-label={`Détail ${item.label}`}
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    style={{
                      transform: expanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.16s ease',
                    }}
                  />
                </button>
              </div>
            </div>

            {expanded ? (
              <div className="xp20-carnet-row-detail">
                <p>{item.detail}</p>
                <div className="xp20-carnet-row-detail-foot">
                  <span>{item.source ?? 'Calcul LKDV'}</span>
                  {item.focusCoords && onFocusCoordinates ? (
                    <button
                      type="button"
                      className="xp20-carnet-map-pill"
                      onClick={() => onFocusCoordinates(item.focusCoords!, item.label)}
                    >
                      <MapPin size={11} aria-hidden="true" />
                      <span>Voir sur la carte</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={embedded ? 'xp20-route-embedded' : 'xp20-route-subsheet'}
      role="region"
      aria-label="Variables visuelles de l’itinéraire"
    >
      {!embedded && onBack ? (
        <div className="xp20-route-header">
          <button
            type="button"
            className="xp20-route-icon-btn"
            onClick={onBack}
            aria-label="Retour à l’itinéraire"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <div className="xp20-route-header-copy">
            <h2 className="xp20-route-title">Détails</h2>
          </div>
        </div>
      ) : null}

      {/* Carnet & Club Horizontal Pill Rail */}
      <div className="xp20-carnet-pill-rail" role="tablist" aria-label="Piliers d’analyse">
        {PILLARS.map((p) => {
          const active = p.id === activePillar;
          const tone = pillarStatusTone(explanation.variables, p.id);
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              className="xp20-carnet-pill"
              data-active={active ? 'true' : 'false'}
              onClick={() => {
                setActivePillar(p.id);
                setExpandedId(null);
              }}
            >
              <span className="xp20-pillar-dot" data-tone={tone} aria-hidden="true" />
              {p.icon}
              <span>{p.short}</span>
            </button>
          );
        })}
      </div>

      <div className={embedded ? 'xp20-route-embedded-body' : 'xp20-route-scroll'}>
        {/* ── PILLAR 1: PHYSIO (Carnet Chiffres Layout) ────────────────────── */}
        {activePillar === 'physiology' ? (
          <>
            <div className="xp20-carnet-hero-card">
              <div className="xp20-carnet-hero-head">
                <div className="xp20-carnet-hero-eyebrow">
                  <span className="xp20-carnet-row-ico" data-tone="good">
                    <Activity size={14} aria-hidden="true" />
                  </span>
                  <span>Effort physiologique</span>
                </div>
                <span
                  className="xp20-route-impact-badge"
                  data-tone={itinerary.relativeEffortPct >= 80 ? 'warn' : 'good'}
                >
                  {itinerary.relativeEffortPct}% eCRF
                </span>
              </div>

              <div className="xp20-carnet-kpi-3">
                <div className="xp20-carnet-kpi-mini">
                  <small>Dépense</small>
                  <b>{Math.round(itinerary.estimatedKcal)} kcal</b>
                </div>
                <div className="xp20-carnet-kpi-mini">
                  <small>Eau</small>
                  <b>{itinerary.hydrationLiters.toFixed(1).replace('.', ',')} L</b>
                </div>
                <div className="xp20-carnet-kpi-mini">
                  <small>Sac</small>
                  <b>{(packWeightKg ?? 6).toFixed(1).replace('.', ',')} kg</b>
                </div>
              </div>

              <div className="xp20-carnet-progress-wrap">
                <div className="xp20-carnet-progress-track" aria-hidden="true">
                  <span
                    className="xp20-carnet-progress-fill"
                    data-tone={itinerary.relativeEffortPct >= 80 ? 'warn' : 'good'}
                    style={{ width: `${Math.min(100, Math.max(8, itinerary.relativeEffortPct))}%` }}
                  />
                </div>
              </div>
            </div>

            {renderVariableRows(pillarItems)}
          </>
        ) : null}

        {/* ── PILLAR 2: ÉQUIPEMENT (Carnet Kit + Club Coffre Real Inventory) ── */}
        {activePillar === 'equipment' ? (
          <>
            {/* Hero Readiness & Locomotion Card */}
            <div className="xp20-carnet-hero-card">
              <div className="xp20-carnet-hero-head">
                <div className="xp20-carnet-hero-eyebrow">
                  <span className="xp20-carnet-row-ico" data-tone="good">
                    <Backpack size={14} aria-hidden="true" />
                  </span>
                  <span>Préparation sac</span>
                </div>
                {onOpenKit ? (
                  <button
                    type="button"
                    className="xp20-carnet-soft-btn"
                    onClick={onOpenKit}
                  >
                    <Package size={12} aria-hidden="true" />
                    <span>{selectedKit ? selectedKit.name : 'Mon sac'}</span>
                  </button>
                ) : null}
              </div>

              <div className="xp20-carnet-equip-summary">
                <div>
                  <strong className="xp20-carnet-big-num">
                    {inventoryLoading
                      ? 'Vérification…'
                      : ownedGear.length > 0
                        ? `${ownedGear.length} / ${resolvedGear.length} prêts`
                        : `${resolvedGear.length} conseillés`}
                  </strong>
                  <p className="xp20-carnet-sub-line">
                    {equipModeVar?.value ?? 'Itinéraire adapté à vos pratiques'}
                  </p>
                </div>
                {inventoryLoading ? (
                  <Loader2 size={16} className="xp20-route-spin" aria-hidden="true" />
                ) : (
                  <span
                    className="xp20-route-impact-badge"
                    data-tone={missingGear.some((m) => m.priority === 'essential') ? 'warn' : 'good'}
                  >
                    {ownedGear.length === resolvedGear.length ? 'Complet' : `${readinessPct}%`}
                  </span>
                )}
              </div>

              <div className="xp20-carnet-progress-wrap">
                <div className="xp20-carnet-progress-track" aria-hidden="true">
                  <span
                    className="xp20-carnet-progress-fill"
                    data-tone={ownedGear.length === resolvedGear.length ? 'good' : 'warn'}
                    style={{ width: `${Math.max(8, readinessPct)}%` }}
                  />
                </div>
              </div>
            </div>

            {kitActionError ? (
              <div
                role="status"
                style={{
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: 'rgba(185, 28, 28, 0.08)',
                  border: '0.5px solid rgba(185, 28, 28, 0.22)',
                  color: '#991b1b',
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                {kitActionError}
              </div>
            ) : null}

            {/* Section 1: Real Matched Items from User's Inventory / Active Kit */}
            {ownedGear.length > 0 ? (
              <section className="xp20-carnet-section">
                <div className="xp20-carnet-section-head">
                  <span>
                    <CheckCircle2 size={13} color="#0E8F5B" aria-hidden="true" />
                    Dans ton inventaire
                  </span>
                  <small>{ownedGear.length} trouvé{ownedGear.length > 1 ? 's' : ''}</small>
                </div>
                <div className="xp20-carnet-group-card">
                  {ownedGear.map((item) => {
                    const weightText = formatWeightCompact(item.matchedWeightG);
                    const isInKit = item.status === 'in_kit' && Boolean(item.kitItemId);
                    const isChecked = Boolean(item.isChecked);
                    const isToggling = Boolean(item.kitItemId && pendingToggleIds.has(item.kitItemId));
                    const isOptimistic = Boolean(item.kitItemId?.startsWith('optimistic-'));
                    const isAdding = pendingAddIds.has(item.id);

                    return (
                      <div key={item.id} className="xp20-gear-item-row">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.matchedImage || generatedProductImage(item.matchedName ?? item.title, 72)}
                          alt=""
                          className="xp20-gear-thumb"
                          loading="lazy"
                        />
                        <div className="xp20-gear-item-copy">
                          <div className="xp20-gear-item-name">
                            {item.matchedName ?? item.title}
                          </div>
                          <div className="xp20-gear-item-meta">
                            <span>{item.title}</span>
                            {item.matchedBrand ? <span>· {item.matchedBrand}</span> : null}
                            {weightText ? <span>· {weightText}</span> : null}
                          </div>
                        </div>
                        {isInKit && item.kitItemId ? (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            aria-label={`${isChecked ? 'Décocher' : 'Cocher'} ${item.matchedName ?? item.title} dans le sac`}
                            disabled={isToggling || isOptimistic}
                            onClick={() => {
                              void handleToggleKitItem(item.kitItemId!, !isChecked);
                            }}
                            className="xp20-gear-status-pill"
                            data-status="in_kit"
                            style={{
                              cursor: isToggling || isOptimistic ? 'wait' : 'pointer',
                              border: isChecked
                                ? '0.5px solid rgba(14, 143, 91, 0.45)'
                                : '0.5px solid rgba(23, 64, 44, 0.22)',
                              background: isChecked
                                ? 'rgba(14, 143, 91, 0.18)'
                                : 'rgba(255, 255, 255, 0.86)',
                              color: isChecked ? '#0e6b44' : '#17402c',
                              opacity: isToggling ? 0.65 : 1,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                display: 'inline-grid',
                                placeItems: 'center',
                                background: isChecked ? '#0e8f5b' : 'transparent',
                                border: isChecked
                                  ? '1px solid #0e8f5b'
                                  : '1.5px solid rgba(23, 64, 44, 0.4)',
                                color: '#ffffff',
                              }}
                            >
                              {isChecked ? <Check size={9} strokeWidth={3} /> : null}
                            </span>
                            <span>{isChecked ? 'Prêt' : 'Dans le sac'}</span>
                          </button>
                        ) : selectedKit && inventoryAuthed ? (
                          <button
                            type="button"
                            disabled={isAdding}
                            aria-label={`Ajouter ${item.matchedName ?? item.title} au sac ${selectedKit.name}`}
                            onClick={() => {
                              void handleAddToKit(item);
                            }}
                            className="xp20-gear-status-pill"
                            data-status="in_inventory"
                            style={{
                              cursor: isAdding ? 'wait' : 'pointer',
                              border: '0.5px solid rgba(23, 64, 44, 0.26)',
                              background: 'rgba(23, 64, 44, 0.1)',
                              color: '#17402c',
                              opacity: isAdding ? 0.65 : 1,
                            }}
                          >
                            {isAdding ? (
                              <Loader2 size={10} className="xp20-route-spin" aria-hidden="true" />
                            ) : (
                              <Plus size={10} aria-hidden="true" />
                            )}
                            <span>Sac</span>
                          </button>
                        ) : (
                          <Link
                            href="/hub/kit"
                            className="xp20-gear-status-pill"
                            data-status="in_inventory"
                            style={{
                              textDecoration: 'none',
                              border: '0.5px solid rgba(23, 64, 44, 0.2)',
                            }}
                          >
                            <Plus size={10} aria-hidden="true" />
                            <span>Sac</span>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Section 2: Route-Tailored Recommended Items (Missing or Guest) */}
            {missingGear.length > 0 ? (
              <section className="xp20-carnet-section">
                <div className="xp20-carnet-section-head">
                  <span>
                    <Sparkles size={13} color="#17402C" aria-hidden="true" />
                    {ownedGear.length > 0 ? 'À prévoir pour ce trajet' : 'Conseillé pour ce trajet'}
                  </span>
                  <Link href="/hub/inventaire" className="xp20-carnet-section-link">
                    <span>{inventoryAuthed ? 'Mon inventaire' : 'Gérer'}</span>
                    <ExternalLink size={10} aria-hidden="true" />
                  </Link>
                </div>
                <div className="xp20-carnet-group-card">
                  {missingGear.map((item) => {
                    const isAdding = pendingAddIds.has(item.id);
                    return (
                      <div key={item.id} className="xp20-gear-item-row">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.matchedImage || item.fallbackImage}
                          alt=""
                          className="xp20-gear-thumb"
                          loading="lazy"
                        />
                        <div className="xp20-gear-item-copy">
                          <div className="xp20-gear-item-name">{item.title}</div>
                          <div className="xp20-gear-item-meta">{item.reason}</div>
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span
                            className="xp20-gear-status-pill"
                            data-status={item.priority === 'essential' ? 'essential' : 'recommended'}
                          >
                            {item.priority === 'essential' ? 'Indispensable' : 'Conseillé'}
                          </span>
                          {selectedKit && inventoryAuthed ? (
                            <button
                              type="button"
                              disabled={isAdding}
                              aria-label={`Ajouter ${item.title} au sac ${selectedKit.name}`}
                              onClick={() => {
                                void handleAddToKit(item);
                              }}
                              className="xp20-gear-status-pill"
                              style={{
                                cursor: isAdding ? 'wait' : 'pointer',
                                border: '0.5px solid rgba(23, 64, 44, 0.24)',
                                background: 'rgba(255, 255, 255, 0.9)',
                                color: '#17402c',
                                opacity: isAdding ? 0.65 : 1,
                              }}
                            >
                              {isAdding ? (
                                <Loader2 size={10} className="xp20-route-spin" aria-hidden="true" />
                              ) : (
                                <Plus size={10} aria-hidden="true" />
                              )}
                              <span>Sac</span>
                            </button>
                          ) : (
                            <Link
                              href="/hub/kit"
                              className="xp20-gear-status-pill"
                              style={{
                                textDecoration: 'none',
                                border: '0.5px solid rgba(23, 64, 44, 0.2)',
                                background: 'rgba(255, 255, 255, 0.9)',
                                color: '#17402c',
                              }}
                            >
                              <Plus size={10} aria-hidden="true" />
                              <span>Sac</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Section 3: Carnet Horizontal Mini-Tile Rail for other real items in active kit */}
            {otherKitItems.length > 0 ? (
              <section className="xp20-carnet-section">
                <div className="xp20-carnet-section-head">
                  <span>
                    <Package size={13} aria-hidden="true" />
                    Aussi dans {selectedKit?.name ?? 'ton sac'}
                  </span>
                  <small>{otherKitItems.length} objets</small>
                </div>
                <div className="xp20-carnet-mini-rail">
                  {otherKitItems.map((ki) => (
                    <div key={ki.id} className="xp20-carnet-mini-tile">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveGearProductImage(ki.name, ki.category ?? '')}
                        alt=""
                        className="xp20-carnet-mini-tile-img"
                        loading="lazy"
                      />
                      <b title={ki.name}>{ki.name}</b>
                      <small>{formatWeightCompact(ki.weight_g) || '—'}</small>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Locomotion & Safety verification row */}
            {equipModeVar ? renderVariableRows([equipModeVar]) : null}
          </>
        ) : null}

        {/* ── PILLAR 3: MÉTÉO (Carnet Chiffres + Uniform 3-Col KPIs) ────────── */}
        {activePillar === 'weather' ? (
          <>
            <div className="xp20-carnet-hero-card">
              <div className="xp20-carnet-hero-head">
                <div className="xp20-carnet-hero-eyebrow">
                  <span className="xp20-carnet-row-ico" data-tone={wxCondVar?.tone ?? 'good'}>
                    <CloudSun size={14} aria-hidden="true" />
                  </span>
                  <span>Météo du corridor</span>
                </div>
                <span className="xp20-route-impact-badge" data-tone={wxCondVar?.tone ?? 'good'}>
                  {wxCondVar?.impactLabel ?? 'Favorable'}
                </span>
              </div>

              <div className="xp20-carnet-big-num">
                {wxCondVar?.value.split('(')[0]?.trim() ?? 'Conditions actuelles'}
              </div>

              <div className="xp20-carnet-kpi-3">
                <div className="xp20-carnet-kpi-mini">
                  <small>Vent crête</small>
                  <b>{ridgeWindKmh !== null ? `${ridgeWindKmh} km/h` : '—'}</b>
                </div>
                <div className="xp20-carnet-kpi-mini">
                  <small>Coucher</small>
                  <b>{sunsetLabel}</b>
                </div>
                <div className="xp20-carnet-kpi-mini" data-tone={itinerary.afterDarkMinutes > 0 ? 'warn' : 'good'}>
                  <small>Fenêtre</small>
                  <b>{itinerary.afterDarkMinutes > 0 ? `+${itinerary.afterDarkMinutes}m nuit` : 'De jour'}</b>
                </div>
              </div>
            </div>

            {renderVariableRows(pillarItems)}
          </>
        ) : null}

        {/* ── PILLAR 4: TERRAIN (Carnet Surface + Uniform 3-Col KPIs) ───────── */}
        {activePillar === 'terrain' ? (
          <>
            <div className="xp20-carnet-hero-card">
              <div className="xp20-carnet-hero-head">
                <div className="xp20-carnet-hero-eyebrow">
                  <span className="xp20-carnet-row-ico" data-tone="good">
                    <Compass size={14} aria-hidden="true" />
                  </span>
                  <span>Surface & relief</span>
                </div>
                <span className="xp20-route-impact-badge" data-tone="good">
                  {explanation.maxSacGradeLabel}
                </span>
              </div>

              <div className="xp20-route-surface-bar" aria-label="Répartition des revêtements">
                {sb.trail > 0 ? <span style={{ width: `${sb.trail}%`, background: '#0E8F5B' }} /> : null}
                {sb.gravel > 0 ? <span style={{ width: `${sb.gravel}%`, background: '#D97706' }} /> : null}
                {sb.paved > 0 ? <span style={{ width: `${sb.paved}%`, background: '#475569' }} /> : null}
                {sb.technical > 0 ? <span style={{ width: `${sb.technical}%`, background: '#B45309' }} /> : null}
              </div>
              <div className="xp20-surface-legend">
                <span><i style={{ background: '#0E8F5B' }} />Sentier {sb.trail}%</span>
                <span><i style={{ background: '#D97706' }} />Piste {sb.gravel}%</span>
                <span><i style={{ background: '#475569' }} />Bitume {sb.paved}%</span>
                {sb.technical > 0 ? <span><i style={{ background: '#B45309' }} />Tech {sb.technical}%</span> : null}
              </div>

              <div className="xp20-carnet-kpi-3" style={{ marginTop: 10 }}>
                <div className="xp20-carnet-kpi-mini">
                  <small>Pente max</small>
                  <b>{explanation.maxSlopeDeg}°</b>
                </div>
                <div className="xp20-carnet-kpi-mini">
                  <small>Points d’eau</small>
                  <b>{explanation.waterPointsCount}</b>
                </div>
                <div className="xp20-carnet-kpi-mini">
                  <small>Abris</small>
                  <b>{explanation.sheltersCount}</b>
                </div>
              </div>
            </div>

            {renderVariableRows(pillarItems)}
          </>
        ) : null}

        {/* Ultra-compact engine pill */}
        <div className="xp20-route-provenance-chip">
          <Cpu size={12} aria-hidden="true" />
          <span>{engineShortLabel(itinerary.engineUsed, itinerary.computeTimeMs)}</span>
        </div>
      </div>
    </div>
  );
}
