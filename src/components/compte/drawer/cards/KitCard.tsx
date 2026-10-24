'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { wearPercent } from './WearGauge';
import { formatEuro, formatHistoryLine, formatWeight } from './format';
import { generatedProductImage } from './productImage';
import { CalendarDays, ChevronLeft, ChevronRight, Coins, Compass, Download, FileText, GitFork, History, Layers, LayoutGrid, Package, Share2 } from 'lucide-react';

export type KitViewer = 'owner' | 'visitor';

export interface KitProductView {
  id: string;
  name: string;
  category: string | null;
  weightG: number | null;
  quantity: number;
  condition: string | null;
  priority: string | null;
  vital: boolean;
  brand: string | null;
  description: string | null;
  image: string | null;
  priceCents?: number | null;
  purchaseDate?: string | null;
  maintenanceDueAt?: string | null;
  isLent?: boolean | null;
  status?: string | null;
  location?: string | null;
  tags?: string[] | null;
}

export interface KitEntry {
  id?: string | null;
  realId?: string | null;
  n?: string | null;
  name?: string | null;
  gen?: string | null;
  generation?: number | string | null;
  proven?: number | null;
  field_proven_count?: number | null;
  prop?: number | null;
  w?: number | null;
  total_weight_g?: number | null;
  items?: number | unknown[] | null;
  desc?: string | null;
  description?: string | null;
  image?: string | null;
  coverImage?: string | null;
  cover_image_url?: string | null;
  outings?: number | null;
  products?: KitProductView[] | null;
  quantity?: number | null;
}

export interface KitCardProps {
  kit: KitEntry;
  expandedHeight?: number;
  /** Propriétaire ou visiteur ; sinon déduit du payload. */
  viewer?: KitViewer;
  /** Payload du bootstrap, pour la déduction du viewer en usage direct. */
  payload?: unknown;
}

type ActionKind = 'fork' | 'share' | 'sheet' | 'royalties' | 'history' | 'discovery' | 'export' | 'calendar';

interface ActionPanel {
  title: string;
  lines: string[];
  href?: string;
}

interface KitInsight {
  title: string;
  lines: string[];
}

interface KitSheetResponse {
  kit?: {
    name?: string | null;
    parent_name?: string | null;
    is_public?: boolean | null;
  } | null;
  journal?: unknown;
  trust?: {
    endurance_score?: number | null;
    propagation_score?: number | null;
    sessions_count?: number | null;
  } | null;
}

interface HistoryEntry {
  action?: string | null;
  created_at?: string | null;
}

interface DiscoveryLineage {
  kit_name?: string | null;
  endurance_score?: number | null;
  sessions_count?: number | null;
}

interface DiscoveryItem {
  kept_count?: number | null;
}

interface RoyaltyShare {
  /** `kit_royalty_shares.share_cents` (pas `amount_cents`). */
  share_cents?: number | null;
}

interface RoyaltyLedgerEntry {
  amount_cents?: number | null;
  /** `credit` ou `debit` ; seuls les crédits comptent dans le solde boutique. */
  entry_type?: string | null;
}

/** Erreur métier déjà rédigée en français, à afficher telle quelle. */
class KitActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KitActionError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Résout le mode visiteur : prop explicite, puis `payload.viewer`, puis
 * `payload.profile.viewer`, propriétaire par défaut. Le host ne transmet pas
 * encore `viewer` au slot ; la lentille le déduit donc du bootstrap.
 */
export function resolveKitViewer(
  explicit: KitViewer | undefined,
  payload: unknown
): KitViewer {
  if (explicit === 'owner' || explicit === 'visitor') return explicit;
  const root = asRecord(payload);
  if (root.viewer === 'owner' || root.viewer === 'visitor') return root.viewer;
  const profile = asRecord(root.profile);
  if (profile.viewer === 'owner' || profile.viewer === 'visitor') return profile.viewer;
  return 'owner';
}

function firstString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function kitName(kit: KitEntry): string {
  return firstString(kit.n, kit.name) || 'Kit';
}

/** Génération réelle G1→G3 : `gen` sinon `generation` sinon le nombre d'ancêtres. */
export function kitGeneration(kit: KitEntry): number {
  const fromLabel = typeof kit.gen === 'string' ? kit.gen.match(/G\s*(\d+)/i) : null;
  const explicit = fromLabel ? Number(fromLabel[1]) : firstNumber(kit.generation);
  const ancestors = firstNumber(kit.prop);
  const value = explicit ?? (ancestors !== null ? ancestors + 1 : 1);
  return Math.max(1, Math.min(3, Math.round(value)));
}

/**
 * Image produit du kit. La chaîne amont est déjà résolue par le bootstrap
 * (`cover_image_url` → `product_ownership.photo_url` → `kit_items.image`) et
 * exposée dans `image` ; sans image réelle, on génère un visuel de repli.
 * Aucune photo inventée, aucun repli sur les objets de la carte.
 */
export function resolveKitImage(kit: KitEntry, size = 96): string {
  const direct = firstString(kit.image, kit.cover_image_url, kit.coverImage);
  if (direct) return direct;
  return generatedProductImage(kitName(kit), size);
}

function kitItemCount(kit: KitEntry): number {
  if (typeof kit.items === 'number' && Number.isFinite(kit.items)) return Math.max(0, kit.items);
  if (Array.isArray(kit.items)) return kit.items.length;
  return 0;
}

function kitIdOf(kit: KitEntry): string {
  return firstString(kit.realId, kit.id);
}

/**
 * Carte kit du drawer Profil : image produit systématique, nom, poids,
 * objets, génération, preuves, jauge d'usure et filiation G1→G2→G3.
 *
 * Les actions réutilisent les routes kit existantes (fork, partage, fiche,
 * référencement, royalties, historique, découverte) : aucune route n'est
 * réinventée, aucune donnée n'est simulée.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function kitProductImage(product: KitProductView, size = 96): string {
  return product.image || generatedProductImage(product.name, size);
}

function kitFact(value: string | null | undefined): string {
  return value?.trim() || '—';
}

function kitDateLabel(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function kitStatusLabel(value: string | null | undefined): string {
  const key = value?.trim().toLowerCase();
  if (!key) return '';
  if (key === 'available' || key === 'disponible') return 'Disponible';
  if (key === 'maintenance') return 'Entretien';
  if (key === 'lost' || key === 'perdu') return 'Perdu';
  if (key === 'retired' || key === 'retire') return 'Retiré';
  return value!.trim();
}

function kitPriorityLabel(value: string | null | undefined): string {
  const key = value?.trim().toLowerCase();
  if (!key) return '—';
  if (key === 'recommended') return 'Recommandé';
  if (key === 'essential' || key === 'required') return 'Essentiel';
  if (key === 'optional') return 'Optionnel';
  if (key === 'vital') return 'Vital';
  return value!.trim();
}

export function KitCard({ kit, viewer, payload, expandedHeight }: KitCardProps) {
  const name = kitName(kit);
  const kitId = kitIdOf(kit);
  const viewerMode = resolveKitViewer(viewer, payload);
  const products = useMemo(
    () => (Array.isArray(kit.products) ? kit.products.filter(Boolean) : []),
    [kit.products]
  );
  const computedWeight = products.reduce(
    (total, product) => total + (product.weightG ?? 0) * product.quantity,
    0
  );
  const weight = firstNumber(kit.w, kit.total_weight_g) ?? computedWeight;
  const quantity = Math.max(
    0,
    Math.round(firstNumber(kit.quantity) ?? products.reduce((total, product) => total + product.quantity, 0))
  ) || kitItemCount(kit);
  const wear = wearPercent(kit.outings);
  const [view, setView] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const [busy, setBusy] = useState<ActionKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<ActionPanel | null>(null);
  const [insights, setInsights] = useState<KitInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const selectedProduct = products.find((product) => product.id === selectedId) ?? products[0] ?? null;
  const selectedIndex = Math.max(0, products.findIndex((product) => product.id === selectedProduct?.id));
  const goProduct = (delta: number) => {
    if (products.length < 2) return;
    const next = (selectedIndex + delta + products.length) % products.length;
    setSelectedId(products[next].id);
    haptic(7);
  };

  useEffect(() => {
    setView(0);
    setSelectedId(products[0]?.id ?? null);
    setDragX(0);
  }, [kitId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId && products[0]) setSelectedId(products[0].id);
  }, [products, selectedId]);

  useEffect(() => {
    if (view !== 2 || !kitId) return;
    let cancelled = false;
    setInsightsLoading(true);
    setInsights([]);
    const json = async (url: string, init?: RequestInit) => {
      try {
        const response = await fetch(url, init);
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    };
    Promise.all([
      json(`/api/kits/${encodeURIComponent(kitId)}/sheet`),
      json('/api/kits/my-royalties'),
      json(`/api/materiel/kits/${encodeURIComponent(kitId)}/history`),
      json('/api/kits/discovery'),
    ]).then(([sheet, royalties, history, discovery]) => {
      if (cancelled) return;
      const sections: KitInsight[] = [];
      if (sheet) {
        const data = sheet as KitSheetResponse;
        const sheetName = firstString(data.kit?.name, name);
        const lines: string[] = [];
        const parentName = firstString(data.kit?.parent_name);
        if (parentName) lines.push(`Adapté de ${parentName}.`);
        const endurance = firstNumber(data.trust?.endurance_score);
        if (endurance !== null) lines.push(`Indice d’endurance : ${endurance.toFixed(2)}.`);
        const sessions = firstNumber(data.trust?.sessions_count);
        if (sessions !== null) lines.push(`Sorties suivies : ${Math.round(sessions)}.`);
        if (data.kit?.is_public) lines.push('Kit public : visible dans la découverte.');
        if (lines.length) sections.push({ title: `Fiche · ${sheetName}`, lines });
      }
      if (royalties) {
        const data = royalties as { shares?: RoyaltyShare[]; ledger?: RoyaltyLedgerEntry[] };
        const shares = Array.isArray(data.shares) ? data.shares : [];
        const ledger = Array.isArray(data.ledger) ? data.ledger : [];
        const shareCents = shares.reduce((total, share) => total + Number(share.share_cents ?? 0), 0);
        const ledgerCents = ledger.reduce((total, entry) => entry.entry_type === 'credit' ? total + Number(entry.amount_cents ?? 0) : total, 0);
        const lines = [
          `${shares.length} part${shares.length > 1 ? 's' : ''} créateur.`,
          `Crédit boutique : ${formatEuro(ledgerCents / 100) ?? '0,00 €'}.`,
        ];
        if (shareCents > 0) lines.push(`Parts cumulées : ${formatEuro(shareCents / 100)}.`);
        sections.push({ title: 'Royalties', lines });
      }
      if (history) {
        const data = history as { entries?: HistoryEntry[] };
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const lines = entries.map(formatHistoryLine).filter((line): line is string => Boolean(line)).slice(0, 5);
        if (lines.length) sections.push({ title: 'Historique', lines });
      }
      if (discovery) {
        const data = discovery as { lineages?: DiscoveryLineage[]; items?: DiscoveryItem[] };
        const lineages = Array.isArray(data.lineages) ? data.lineages : [];
        const items = Array.isArray(data.items) ? data.items : [];
        const lines = [
          ...lineages.slice(0, 3).map((lineage) => {
            const lineageName = firstString(lineage.kit_name) || 'Lignée';
            const endurance = firstNumber(lineage.endurance_score);
            return endurance === null ? lineageName : `${lineageName} · endurance ${endurance.toFixed(2)}`;
          }),
          ...items.slice(0, 2).map((item) => {
            const kept = firstNumber(item.kept_count);
            return kept === null ? 'Objet conservé sur le terrain.' : `Objet gardé dans ${Math.round(kept)} fork${Math.round(kept) === 1 ? '' : 's'}.`;
          }),
        ];
        if (lines.length) sections.push({ title: 'Découverte', lines });
      }
      setInsights(sections);
    }).finally(() => { if (!cancelled) setInsightsLoading(false); });
    return () => { cancelled = true; };
  }, [view, kitId, name]);

  const haptic = (pattern: number | number[] = 8) => {
    try { navigator.vibrate?.(pattern); } catch { /* optionnel */ }
  };

  const goTo = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(2, next));
    if (bounded === 2 && !products.length) return;
    if (bounded === view) return;
    haptic(bounded === 2 ? 12 : 7);
    setView(bounded);
  }, [products.length, view]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button,a,input,textarea')) return;
    dragRef.current = { x: event.clientX, y: event.clientY, active: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) { dragRef.current = null; return; }
      drag.active = true;
      setDragging(true);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optionnel */ }
    }
    let next = dx;
    if (view === 0 && next > 0) next = Math.min(next * 0.24, 12);
    if (view === 2 && next < 0) next = Math.max(next * 0.24, -12);
    setDragX(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* optionnel */ }
    if (!drag?.active) { setDragX(0); return; }
    const dx = event.clientX - drag.x;
    setDragX(0);
    if (dx <= -30) goTo(view + 1);
    else if (dx >= 30) goTo(view - 1);
  };

  const selectProduct = (product: KitProductView) => {
    setSelectedId(product.id);
    haptic(12);
    setView(2);
  };

  const run = useCallback(
    async (kind: ActionKind, task: () => Promise<void>, fallbackError: string) => {
      if (busy !== null) return;
      setBusy(kind);
      setError(null);
      setNotice(null);
      try {
        await task();
      } catch (cause) {
        // Les erreurs métier sont déjà en français ; tout le reste (réseau,
        // « Failed to fetch », JSON invalide) reçoit le message localisé de
        // l'action, jamais le message brut du navigateur.
        setError(cause instanceof KitActionError ? cause.message : fallbackError);
      } finally {
        setBusy(null);
      }
    },
    [busy]
  );

  /**
   * Défense : les boutons sont désactivés sans identifiant, mais un appel
   * programmatique ne doit jamais requêter une route `/api/kits//…`.
   */
  const requireKitId = (): string | null => {
    if (kitId) return kitId;
    setError('Ce kit n’a pas d’identifiant exploitable.');
    return null;
  };

  const forkKit = () => {
    const id = requireKitId();
    if (!id) return;
    void run(
      'fork',
      async () => {
        const response = await fetch('/api/materiel/fork', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kit_id: id }),
        });
        if (!response.ok) throw new KitActionError('Impossible de récupérer ce kit.');
        setNotice('Kit récupéré dans ton Compas.');
      },
      'Impossible de récupérer ce kit.'
    );
  };

  const shareKit = () => {
    const id = requireKitId();
    if (!id) return;
    void run(
      'share',
      async () => {
        const response = await fetch('/api/materiel/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kit_id: id, permission: 'lecture' }),
        });
        if (!response.ok) throw new KitActionError('Impossible de partager ce kit.');
        const data = (await response.json()) as { url?: string };
        if (!data.url) throw new KitActionError('Lien de partage indisponible.');
        const fullUrl =
          typeof window !== 'undefined' ? `${window.location.origin}${data.url}` : data.url;
        const clipboard =
          typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
        let copied = false;
        if (clipboard?.writeText) {
          try {
            await clipboard.writeText(fullUrl);
            copied = true;
          } catch {
            /* Le lien reste affiché même si le presse-papier est refusé. */
          }
        }
        setPanel({ title: 'Lien de partage', lines: [fullUrl], href: data.url });
        setNotice(
          copied ? 'Lien de partage copié.' : 'Lien de partage affiché ci-dessus.'
        );
      },
      'Impossible de partager ce kit.'
    );
  };

  const openSheet = () => {
    const id = requireKitId();
    if (!id) return;
    void run(
      'sheet',
      async () => {
        // Référencement d'abord (cookie d'attribution), puis fiche existante.
        await fetch(`/api/kits/${encodeURIComponent(id)}/refer`);
        const response = await fetch(`/api/kits/${encodeURIComponent(id)}/sheet`);
        if (!response.ok) throw new KitActionError('Fiche du kit indisponible.');
        const data = (await response.json()) as KitSheetResponse;
        const lines: string[] = [];
        const sheetName = firstString(data.kit?.name, name);
        lines.push(sheetName);
        const parentName = firstString(data.kit?.parent_name);
        if (parentName) lines.push(`Adapté de ${parentName}.`);
        // `endurance_score` est un indice brut (sqrt), jamais un pourcentage.
        const endurance = firstNumber(data.trust?.endurance_score);
        if (endurance !== null) lines.push(`Indice d’endurance : ${endurance.toFixed(2)}.`);
        const sessions = firstNumber(data.trust?.sessions_count);
        if (sessions !== null) lines.push(`Sorties suivies : ${Math.round(sessions)}.`);
        if (data.kit?.is_public) lines.push('Kit public : visible dans la découverte.');
        if (lines.length === 1) lines.push('Aucun détail complémentaire pour le moment.');
        setPanel({ title: `Fiche du kit ${sheetName}`, lines });
      },
      'Fiche du kit indisponible.'
    );
  };

  const openRoyalties = () => {
    void run(
      'royalties',
      async () => {
        const response = await fetch('/api/kits/my-royalties');
        if (response.status === 404) {
          setNotice('Part créateur bientôt disponible.');
          return;
        }
        if (!response.ok) throw new KitActionError('Part créateur indisponible.');
        const data = (await response.json()) as {
          shares?: RoyaltyShare[];
          ledger?: RoyaltyLedgerEntry[];
        };
        const shares = Array.isArray(data.shares) ? data.shares : [];
        const ledger = Array.isArray(data.ledger) ? data.ledger : [];
        // `kit_royalty_shares` porte `share_cents`, pas `amount_cents`.
        const shareCents = shares.reduce(
          (total, share) => total + Number(share.share_cents ?? 0),
          0
        );
        // Le solde boutique ne somme que les crédits ; les débits sont ignorés
        // pour ne pas afficher un montant net trompeur.
        const ledgerCents = ledger.reduce(
          (total, entry) =>
            entry.entry_type === 'credit' ? total + Number(entry.amount_cents ?? 0) : total,
          0
        );
        const lines = [
          `${shares.length} part${shares.length > 1 ? 's' : ''} créateur.`,
          `Crédit boutique : ${formatEuro(ledgerCents / 100) ?? '0,00 €'}.`,
        ];
        if (shareCents > 0) lines.push(`Parts cumulées : ${formatEuro(shareCents / 100)}.`);
        setPanel({ title: 'Royalties', lines });
      },
      'Part créateur indisponible.'
    );
  };

  const openHistory = () => {
    const id = requireKitId();
    if (!id) return;
    void run(
      'history',
      async () => {
        const response = await fetch(
          `/api/materiel/kits/${encodeURIComponent(id)}/history`
        );
        if (!response.ok) throw new KitActionError('Historique indisponible.');
        const data = (await response.json()) as { entries?: HistoryEntry[] };
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const lines = entries
          .map(formatHistoryLine)
          .filter((line): line is string => Boolean(line))
          .slice(0, 5);
        setPanel({
          title: `Historique du kit ${name}`,
          lines: lines.length ? lines : ['Aucune version enregistrée.'],
        });
      },
      'Historique indisponible.'
    );
  };

  const openDiscovery = () => {
    void run(
      'discovery',
      async () => {
        const response = await fetch('/api/kits/discovery');
        if (!response.ok) throw new KitActionError('Découverte indisponible.');
        const data = (await response.json()) as {
          lineages?: DiscoveryLineage[];
          items?: DiscoveryItem[];
        };
        const lineages = Array.isArray(data.lineages) ? data.lineages : [];
        const items = Array.isArray(data.items) ? data.items : [];
        const lines = [
          ...lineages.slice(0, 3).map((lineage) => {
            const lineageName = firstString(lineage.kit_name) || 'Lignée';
            const endurance = firstNumber(lineage.endurance_score);
            // Indice brut de `kit_trust_scores`, jamais un pourcentage.
            return endurance === null
              ? lineageName
              : `${lineageName} · Indice d’endurance ${endurance.toFixed(2)}`;
          }),
          ...items.slice(0, 2).map((item) => {
            const kept = firstNumber(item.kept_count);
            if (kept === null) return 'Objet conservé sur le terrain.';
            const forks = Math.round(kept);
            return `Objet gardé dans ${forks} fork${forks === 1 ? '' : 's'}.`;
          }),
        ];
        setPanel({
          title: 'Découverte des lignées',
          lines: lines.length ? lines : ['Aucune lignée publiée pour le moment.'],
        });
      },
      'Découverte indisponible.'
    );
  };

  const exportKit = () => {
    const id = requireKitId();
    if (!id) return;
    void run(
      'export',
      async () => {
        const response = await fetch('/api/materiel/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'json', scope: 'kit', kit_id: id }),
        });
        if (!response.ok) throw new KitActionError('Export du kit indisponible.');
        downloadBlob(await response.blob(), `kit-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`);
        setNotice('Export du kit téléchargé.');
      },
      'Export du kit indisponible.'
    );
  };

  const exportCalendar = () => {
    void run(
      'calendar',
      async () => {
        const response = await fetch('/api/materiel/calendar');
        if (!response.ok) throw new KitActionError('Calendrier indisponible.');
        downloadBlob(await response.blob(), 'retours-prets.ics');
        setNotice('Calendrier des retours téléchargé.');
      },
      'Calendrier indisponible.'
    );
  };

  const owner = viewerMode === 'owner';
  const actionDisabled = !kitId || busy !== null;
  const trackStyle: React.CSSProperties = {
    transform: `translateX(calc(${-view * 100}% + ${dragX}px))`,
  };

  return (
    <article
      className="lkdv-kit-card lkdv-kit-card-v2"
      data-kit-id={kitId || undefined}
      data-busy={busy ?? undefined}
      data-view={view}
      data-expanded={view > 0 && expandedHeight ? 'true' : 'false'}
      style={view > 0 && expandedHeight ? { height: `${expandedHeight}px` } : undefined}
    >
      <div
        className="lkdv-kit-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={() => { dragRef.current = null; setDragging(false); setDragX(0); }}
      >
        <div className={`lkdv-kit-track${dragging ? ' is-dragging' : ''}`} style={trackStyle}>
          <section className="lkdv-kit-pane" data-view="base" aria-hidden={view !== 0}>
            <div className="lkdv-kit-base">
              <div className="lkdv-kit-base-main">
                <h3 className="lkdv-kit-name">{name}</h3>
                <p className="lkdv-kit-base-meta">
                  <span>{formatWeight(weight)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{quantity} pièce{quantity === 1 ? '' : 's'}</span>
                </p>
                <div
                  className="lkdv-kit-wear"
                  data-due={wear !== null && wear >= 80 ? 'true' : 'false'}
                  role="progressbar"
                  aria-label={`Usure du kit ${name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={wear ?? 0}
                  aria-valuetext={wear === null ? 'Usure non renseignée' : `${wear} % d’usure`}
                >
                  <i style={{ width: `${wear ?? 0}%` }} />
                </div>
              </div>
              <div className="lkdv-kit-rail" aria-label={`Produits du kit ${name}`}>
                {products.length ? products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="lkdv-kit-rail-item"
                    aria-label={product.name}
                    title={product.name}
                    onClick={() => selectProduct(product)}
                  >
                    <img src={kitProductImage(product, 96)} alt="" loading="lazy" decoding="async" draggable={false} />
                  </button>
                )) : <span className="lkdv-kit-rail-empty" aria-hidden="true">—</span>}
              </div>
            </div>
          </section>

          <section className="lkdv-kit-pane" data-view="composition" aria-hidden={view !== 1}>
            <div className="lkdv-kit-composition">
              {products.length ? (
                <div className="lkdv-kit-comp-scroll">
                  {products.map((product) => (
                    <button key={product.id} type="button" className="lkdv-kit-comp-row" onClick={() => selectProduct(product)}>
                      <img src={kitProductImage(product, 96)} alt="" loading="lazy" decoding="async" draggable={false} />
                      <span className="lkdv-kit-comp-txt">
                        <b>{product.name}</b>
                        <small>
                          {[product.category, formatWeight(product.weightG), `×${product.quantity}`].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="lkdv-kit-empty">Aucun produit dans ce kit.</p>
              )}
            </div>
          </section>

          <section className="lkdv-kit-pane" data-view="product" aria-hidden={view !== 2}>
            <div className="lkdv-kit-product">
              {selectedProduct ? (
                <div className="lkdv-kit-product-scroll">
                  <div className="lkdv-kit-product-hero">
                    <div className="lkdv-kit-product-visual">
                      <img src={kitProductImage(selectedProduct, 192)} alt="" loading="lazy" decoding="async" draggable={false} />
                      {products.length > 1 ? (
                        <>
                          <button type="button" className="lkdv-kit-product-nav is-left" aria-label="Produit précédent" onClick={() => goProduct(-1)}><ChevronLeft size={14} /></button>
                          <button type="button" className="lkdv-kit-product-nav is-right" aria-label="Produit suivant" onClick={() => goProduct(1)}><ChevronRight size={14} /></button>
                          <span className="lkdv-kit-product-index">{selectedIndex + 1}/{products.length}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="lkdv-kit-product-identity">
                      <h3>{selectedProduct.name}</h3>
                      {(selectedProduct.brand || selectedProduct.category) ? (
                        <p>{[selectedProduct.brand, selectedProduct.category].filter(Boolean).join(' · ')}</p>
                      ) : null}
                      <div className="lkdv-kit-product-chips">
                        {selectedProduct.category ? <span>{selectedProduct.category}</span> : null}
                        {selectedProduct.priority ? <span data-tone="priority">{kitPriorityLabel(selectedProduct.priority)}</span> : null}
                        {selectedProduct.vital ? <span data-tone="vital">Vital</span> : null}
                        {selectedProduct.isLent ? <span data-tone="vital">Prêté</span> : null}
                        {selectedProduct.status ? <span data-tone="priority">{kitStatusLabel(selectedProduct.status)}</span> : null}
                      </div>
                    </div>
                  </div>

                  <p className="lkdv-kit-product-context">
                    Dans {name} · {quantity} pièce{quantity === 1 ? '' : 's'}
                    {weight > 0 && selectedProduct.weightG
                      ? ` · ${Math.round(((selectedProduct.weightG * selectedProduct.quantity) / weight) * 100)} % du poids`
                      : ''}
                  </p>

                  <section className="lkdv-kit-product-section">
                    <h4>Caractéristiques</h4>
                    <div className="lkdv-kit-facts">
                      <div><span>Poids</span><b>{formatWeight(selectedProduct.weightG)}</b></div>
                      <div><span>Quantité</span><b>×{selectedProduct.quantity}</b></div>
                      {selectedProduct.condition ? <div><span>État</span><b>{kitFact(selectedProduct.condition)}</b></div> : null}
                      {owner && selectedProduct.priceCents ? <div><span>Prix</span><b>{formatEuro(selectedProduct.priceCents / 100)}</b></div> : null}
                      {owner && selectedProduct.purchaseDate ? <div><span>Acheté le</span><b>{kitDateLabel(selectedProduct.purchaseDate)}</b></div> : null}
                    </div>
                  </section>

                  {owner && (selectedProduct.maintenanceDueAt || selectedProduct.location) ? (
                    <section className="lkdv-kit-product-section">
                      <h4>Suivi</h4>
                      <div className="lkdv-kit-facts">
                        {selectedProduct.maintenanceDueAt ? <div><span>Entretien</span><b>{kitDateLabel(selectedProduct.maintenanceDueAt)}</b></div> : null}
                        {selectedProduct.location ? <div><span>Rangement</span><b>{selectedProduct.location}</b></div> : null}
                      </div>
                    </section>
                  ) : null}

                  {selectedProduct.tags && selectedProduct.tags.length > 0 ? (
                    <div className="lkdv-kit-product-chips">
                      {selectedProduct.tags.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  ) : null}

                  {selectedProduct.description ? (
                    <section className="lkdv-kit-product-section">
                      <h4>Notes</h4>
                      <p className="lkdv-kit-product-desc">{selectedProduct.description}</p>
                    </section>
                  ) : null}

                  {insightsLoading ? <p className="lkdv-kit-insight-loading">Chargement des informations…</p> : null}
                  {insights.map((insight) => (
                    <section key={insight.title} className="lkdv-kit-insight" aria-label={insight.title}>
                      <h4>{insight.title}</h4>
                      {insight.lines.map((line) => <p key={`${insight.title}-${line}`}>{line}</p>)}
                    </section>
                  ))}

                  {panel ? (
                    <section className="lkdv-kit-panel" role="region" aria-label={panel.title}>
                      <h4>{panel.title}</h4>
                      {panel.lines.map((line, index) => <p key={`${panel.title}-${index}`}>{line}</p>)}
                      {panel.href ? <a className="lkdv-kit-panel-link" href={panel.href}>Ouvrir le lien</a> : null}
                    </section>
                  ) : null}
                  {notice ? <p className="lkdv-kit-notice" role="status">{notice}</p> : null}
                  {error ? <p className="lkdv-kit-error" role="alert">{error}</p> : null}
                </div>
              ) : (
                <p className="lkdv-kit-empty">Choisis un produit dans la composition.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="lkdv-kit-selector" role="tablist" aria-label={`États du kit ${name}`}>
        <span className="lkdv-kit-lens" aria-hidden="true" style={{ '--i': view } as React.CSSProperties} />
        {[
          { icon: LayoutGrid, label: 'Vue du kit' },
          { icon: Layers, label: 'Composition du kit' },
          { icon: Package, label: 'Détail du produit' },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              role="tab"
              aria-selected={view === index}
              aria-label={item.label}
              title={item.label}
              disabled={index === 2 && !products.length}
              onClick={() => goTo(index)}
            >
              <Icon size={15} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
    </article>
  );
}

export const KIT_CARD_CSS = `
.lkdv-kit-card.lkdv-kit-card-v2{position:relative!important;display:block!important;height:190px;min-height:190px;transition:height .42s cubic-bezier(.22,1,.36,1)!important;padding:0!important;border-radius:20px!important;overflow:hidden!important;background:linear-gradient(180deg,rgba(255,255,255,.68),rgba(255,255,255,.42))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.09),0 4px 14px rgba(23,43,36,.07)!important;color:var(--label,#17402C)!important;}
.lkdv-kit-viewport{position:absolute!important;inset:0!important;overflow:hidden!important;touch-action:pan-y!important;border-radius:20px!important;}
.lkdv-kit-track{display:flex!important;width:100%!important;height:100%!important;transition:transform .42s cubic-bezier(.22,1,.36,1)!important;will-change:transform!important;}
.lkdv-kit-track.is-dragging{transition:none!important;}
.lkdv-kit-pane{position:relative!important;flex:0 0 100%!important;width:100%!important;height:100%!important;padding:11px 11px 48px!important;box-sizing:border-box!important;overflow:hidden!important;border-radius:0 0 16px 16px!important;opacity:.5!important;transform:scale(.97)!important;transition:opacity .4s ease,transform .5s cubic-bezier(.22,1,.36,1)!important;}
.lkdv-kit-card-v2[data-view="0"] .lkdv-kit-pane[data-view="base"],
.lkdv-kit-card-v2[data-view="1"] .lkdv-kit-pane[data-view="composition"],
.lkdv-kit-card-v2[data-view="2"] .lkdv-kit-pane[data-view="product"]{opacity:1!important;transform:none!important;}
.lkdv-kit-track.is-dragging .lkdv-kit-pane{transition:none!important;}
.lkdv-kit-base{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;gap:8px!important;height:100%!important;min-width:0!important;}
.lkdv-kit-base-main{grid-column:2!important;grid-row:1!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:7px!important;min-width:0!important;}
.lkdv-kit-name{margin:0!important;font:700 15.5px/1.18 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;letter-spacing:-.015em!important;color:var(--label,#17402C)!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
.lkdv-kit-base-meta{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:4px!important;margin:0!important;font:500 11.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;font-variant-numeric:tabular-nums!important;}
.lkdv-kit-wear{height:4px!important;border-radius:999px!important;background:rgba(23,43,36,.1)!important;overflow:hidden!important;margin-top:2px!important;}
.lkdv-kit-wear i{display:block!important;height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,#5B7F55,#3D7A52)!important;transition:width .3s ease!important;}
.lkdv-kit-wear[data-due="true"] i{background:linear-gradient(90deg,#C9A34A,#A97D22)!important;}
.lkdv-kit-rail{grid-column:1!important;grid-row:1!important;align-self:start!important;height:calc(100% + 48px)!important;margin-bottom:-48px!important;display:flex!important;flex-direction:column!important;gap:6px!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding:2px 1px!important;scrollbar-width:none!important;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 8px,#000 calc(100% - 8px),transparent 100%)!important;mask-image:linear-gradient(180deg,transparent 0,#000 8px,#000 calc(100% - 8px),transparent 100%)!important;}
.lkdv-kit-rail::-webkit-scrollbar{display:none!important;}
.lkdv-kit-rail-item{width:52px!important;height:52px!important;flex:none!important;padding:0!important;border:0!important;border-radius:12px!important;overflow:hidden!important;background:rgba(236,244,233,.8)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;cursor:pointer!important;transition:transform .2s cubic-bezier(.3,1.4,.5,1)!important;}
.lkdv-kit-rail-item:active{transform:scale(.93)!important;}
.lkdv-kit-rail-item img{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;}
.lkdv-kit-rail-empty{display:grid!important;place-items:center!important;width:52px!important;height:52px!important;border-radius:12px!important;background:rgba(236,244,233,.55)!important;color:var(--label2,#56665D)!important;font:600 12px var(--sf)!important;}
.lkdv-kit-composition,.lkdv-kit-product{height:100%!important;min-height:0!important;}
.lkdv-kit-comp-scroll,.lkdv-kit-product-scroll{height:100%!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding-right:2px!important;scrollbar-width:none!important;border-radius:14px!important;scroll-padding-bottom:48px!important;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 18px),transparent 100%)!important;mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 18px),transparent 100%)!important;}
.lkdv-kit-comp-scroll::-webkit-scrollbar,.lkdv-kit-product-scroll::-webkit-scrollbar{display:none!important;}
.lkdv-kit-comp-scroll{display:flex!important;flex-direction:column!important;gap:6px!important;padding-bottom:48px!important;}
.lkdv-kit-comp-row{display:flex!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:52px!important;flex:none!important;padding:5px!important;border:0!important;border-radius:12px!important;background:rgba(255,255,255,.38)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.06)!important;text-align:left!important;cursor:pointer!important;}
.lkdv-kit-comp-row:active{background:rgba(255,255,255,.56)!important;}
.lkdv-kit-comp-row img{width:42px!important;height:42px!important;flex:none!important;border-radius:9px!important;object-fit:cover!important;background:rgba(236,244,233,.8)!important;}
.lkdv-kit-comp-txt{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0!important;}
.lkdv-kit-comp-txt b{font:600 12px/1.2 var(--sf)!important;color:var(--label,#17402C)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-kit-comp-txt small{font:500 10px/1.25 var(--sf)!important;color:var(--label2,#56665D)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-kit-product-scroll{display:flex!important;flex-direction:column!important;gap:7px!important;padding-bottom:48px!important;}
.lkdv-kit-product-hero{display:flex!important;align-items:center!important;gap:11px!important;min-width:0!important;}
.lkdv-kit-product-visual{position:relative!important;flex:none!important;}
.lkdv-kit-product-hero img{width:112px!important;height:112px!important;flex:none!important;border-radius:14px!important;object-fit:cover!important;background:rgba(236,244,233,.8)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-kit-product-nav{position:absolute!important;top:50%!important;z-index:4!important;width:24px!important;height:24px!important;margin-top:-12px!important;padding:0!important;border:.5px solid rgba(255,255,255,.75)!important;border-radius:999px!important;background:rgba(255,255,255,.72)!important;-webkit-backdrop-filter:blur(12px)!important;backdrop-filter:blur(12px)!important;color:#17402C!important;display:grid!important;place-items:center!important;cursor:pointer!important;}
.lkdv-kit-product-nav.is-left{left:4px!important;}
.lkdv-kit-product-nav.is-right{right:4px!important;}
.lkdv-kit-product-index{position:absolute!important;right:5px!important;bottom:5px!important;padding:1px 5px!important;border-radius:999px!important;background:rgba(10,20,14,.5)!important;color:#fff!important;font:600 8px/1.2 var(--sf)!important;}
.lkdv-kit-product-hero h3{margin:0!important;font:700 15px/1.18 var(--sf)!important;color:var(--label,#17402C)!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
.lkdv-kit-product-hero p{margin:3px 0 0!important;font:500 10.5px/1.25 var(--sf)!important;color:var(--label2,#56665D)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-kit-facts{display:grid!important;grid-template-columns:1fr 1fr!important;gap:4px!important;}
.lkdv-kit-facts>div{display:flex!important;flex-direction:column!important;gap:1px!important;padding:5px 7px!important;border-radius:9px!important;background:rgba(255,255,255,.36)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)!important;}
.lkdv-kit-facts span{font:500 9px/1.2 var(--sf)!important;color:var(--label2,#56665D)!important;text-transform:uppercase!important;letter-spacing:.03em!important;}
.lkdv-kit-facts b{font:600 11px/1.25 var(--sf)!important;color:var(--label,#17402C)!important;font-variant-numeric:tabular-nums!important;}
.lkdv-kit-product-identity{min-width:0!important;display:flex!important;flex-direction:column!important;gap:3px!important;}
.lkdv-kit-product-chips{display:flex!important;flex-wrap:wrap!important;gap:3px!important;margin-top:1px!important;}
.lkdv-kit-product-chips span{padding:2px 7px!important;border-radius:999px!important;background:rgba(23,64,44,.08)!important;color:#17402C!important;font:600 9px/1.2 var(--sf)!important;white-space:nowrap!important;}
.lkdv-kit-product-chips span[data-tone="priority"]{background:rgba(150,186,142,.28)!important;}
.lkdv-kit-product-chips span[data-tone="vital"]{background:rgba(201,163,74,.22)!important;color:#6B5217!important;}
.lkdv-kit-product-context{margin:0!important;font:500 10px/1.3 var(--sf)!important;color:var(--label2,#56665D)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-kit-product-section{display:flex!important;flex-direction:column!important;gap:4px!important;}
.lkdv-kit-product-section h4{margin:0!important;font:700 9.5px/1.2 var(--sf)!important;color:var(--label2,#56665D)!important;text-transform:uppercase!important;letter-spacing:.06em!important;}
.lkdv-kit-insight{display:flex!important;flex-direction:column!important;gap:3px!important;padding:7px 9px!important;border-radius:11px!important;background:rgba(255,255,255,.34)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)!important;}
.lkdv-kit-insight h4{margin:0!important;font:700 9px/1.2 var(--sf)!important;color:var(--label2,#56665D)!important;text-transform:uppercase!important;letter-spacing:.05em!important;}
.lkdv-kit-insight p{margin:0!important;font:400 10px/1.35 var(--sf)!important;color:var(--label2,#56665D)!important;}
.lkdv-kit-insight-loading{margin:0!important;font:400 10px/1.3 var(--sf)!important;color:var(--label2,#56665D)!important;}
.lkdv-kit-product-desc{margin:0!important;font:400 11px/1.4 var(--sf)!important;color:var(--label2,#56665D)!important;}
.lkdv-kit-vital{align-self:flex-start!important;padding:2px 7px!important;border-radius:999px!important;background:rgba(23,64,44,.1)!important;color:#17402C!important;font:700 9px/1.2 var(--sf)!important;text-transform:uppercase!important;letter-spacing:.04em!important;}
.lkdv-kit-empty{display:grid!important;place-items:center!important;height:100%!important;margin:0!important;font:500 11px/1.3 var(--sf)!important;color:var(--label2,#56665D)!important;text-align:center!important;}
.lkdv-kit-actions{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;gap:3px!important;margin-top:1px!important;max-width:270px!important;}
.lkdv-kit-actions button{width:30px!important;height:30px!important;min-height:30px!important;padding:0!important;border:.5px solid rgba(255,255,255,.75)!important;border-radius:999px!important;background:rgba(255,255,255,.4)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)!important;color:#17402C!important;display:grid!important;place-items:center!important;cursor:pointer!important;}
.lkdv-kit-actions button:active{transform:scale(.9)!important;}
.lkdv-kit-actions button:disabled{opacity:.4!important;cursor:default!important;}
.lkdv-kit-selector{position:absolute!important;left:auto!important;right:10px!important;bottom:9px!important;z-index:30!important;pointer-events:auto!important;display:grid!important;grid-auto-flow:column!important;grid-auto-columns:32px!important;height:30px!important;padding:2px!important;border-radius:999px!important;background:rgba(255,255,255,.65)!important;-webkit-backdrop-filter:blur(28px) saturate(180%)!important;backdrop-filter:blur(28px) saturate(180%)!important;border:.5px solid rgba(255,255,255,.8)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 4px 14px rgba(23,43,36,.08)!important;box-sizing:border-box!important;}
.lkdv-kit-lens{position:absolute!important;top:2px!important;bottom:2px!important;left:2px!important;width:32px!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.72))!important;box-shadow:0 2px 8px rgba(23,64,44,.12),inset 0 1px 0 #fff!important;transform:translateX(calc(var(--i,0) * 32px))!important;transition:transform .3s cubic-bezier(.22,1,.36,1)!important;z-index:1!important;pointer-events:none!important;}
.lkdv-kit-selector button{position:relative!important;z-index:2!important;display:grid!important;place-items:center!important;width:32px!important;height:26px!important;padding:0!important;border:0!important;border-radius:999px!important;background:transparent!important;color:#56665D!important;cursor:pointer!important;}
.lkdv-kit-selector button[aria-selected="true"]{color:#17402C!important;}
.lkdv-kit-selector button:disabled{opacity:.35!important;cursor:default!important;}
.lkdv-kit-panel{display:flex!important;flex-direction:column!important;gap:4px!important;padding:8px 10px!important;border-radius:12px!important;background:rgba(236,244,233,.72)!important;box-shadow:inset 0 0 0 .8px rgba(91,127,85,.28)!important;}
.lkdv-kit-panel h4{margin:0!important;font:700 11px/1.25 var(--sf)!important;color:var(--tint,#17402C)!important;}
.lkdv-kit-panel p{margin:0!important;font:400 10.5px/1.35 var(--sf)!important;color:var(--label2,#56665D)!important;overflow-wrap:anywhere!important;}
.lkdv-kit-panel-link{font:600 10.5px/1.4 var(--sf)!important;color:var(--tint,#17402C)!important;text-decoration:underline!important;text-underline-offset:2px!important;}
.lkdv-kit-notice{margin:0!important;font:500 10.5px/1.35 var(--sf)!important;color:var(--good,#3D7A52)!important;}
.lkdv-kit-error{margin:0!important;font:500 10.5px/1.35 var(--sf)!important;color:var(--bad,#A8443A)!important;}
@media (prefers-reduced-motion:reduce){.lkdv-kit-track,.lkdv-kit-lens,.lkdv-kit-wear i{transition:none!important;}.lkdv-kit-rail-item:active,.lkdv-kit-comp-row:active{transform:none!important;}}
.lkdv-kit-card-v2 .lkdv-kit-menu-wrap{top:8px!important;right:8px!important;z-index:14!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu{top:42px!important;right:0!important;width:auto!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:7px!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button{width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;border:.5px solid rgba(255,255,255,.82)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(255,255,255,.74),rgba(255,255,255,.46) 55%,rgba(255,255,255,.6))!important;-webkit-backdrop-filter:blur(18px) saturate(1.8)!important;backdrop-filter:blur(18px) saturate(1.8)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.14),0 6px 18px rgba(10,20,14,.16)!important;color:#17402C!important;display:grid!important;place-items:center!important;opacity:0;animation:lkdvKitBubbleIn .38s cubic-bezier(.22,1,.36,1) forwards!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button:nth-child(1){animation-delay:.02s!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button:nth-child(2){animation-delay:.06s!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button:nth-child(3){animation-delay:.1s!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button:nth-child(4){animation-delay:.14s!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button:nth-child(5){animation-delay:.18s!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button:nth-child(6){animation-delay:.22s!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu button:active{transform:scale(.92)!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu-trigger svg{transition:transform .28s cubic-bezier(.22,1,.36,1)!important;}
.lkdv-kit-card-v2 .lkdv-kit-menu-trigger.is-open svg{transform:rotate(90deg)!important;}
@keyframes lkdvKitBubbleIn{from{opacity:0;transform:translateY(-8px) scale(.8)}to{opacity:1;transform:none}}
`;

export default KitCard;
