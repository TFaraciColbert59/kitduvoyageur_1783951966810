'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Calendar,
  Check,
  ChevronRight,
  Handshake,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Repeat,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { addToCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import type { PickerProduct, KitSource } from '@/features/community/create/kit/types';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import { CollapsibleHeroPreview, useScrollCollapsePreview } from '../photo/CollapsibleHeroPreview';
import { formatKitItemWeightV2, formatKitWeightV2, type KitUnitsV2 } from './kitContextV2';
import { kitGoalOfWeightV2, kitGoalV2 } from './kitTemplatesV2';

const CATEGORY_BENCHMARK_G: Record<string, number> = {
  Portage: 1150,
  Abri: 1100,
  Couchage: 900,
  Cuisine: 450,
  Eau: 350,
  Vêtements: 650,
  Électronique: 250,
  Sécurité: 280,
  Divers: 400,
};

interface ShareConv {
  id: string;
  title?: string | null;
  name?: string | null;
  avatar_url?: string | null;
}

interface ShopOffer {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceEur: number;
  weightG: number;
  image: string;
  category: string;
  inStock: boolean;
}

interface CommunityOffer {
  id: string;
  title: string;
  priceEur: number | null;
  condition: string | null;
  ownerId: string | null;
  ownerName: string;
  ownerAvatar: string | null;
  ownerTrustScore: number | null;
  image: string | null;
}

type ObtainMode = 'achat' | 'location' | 'occasion' | 'pret';

function cheapestOffer(list: CommunityOffer[]): CommunityOffer | null {
  if (list.length === 0) return null;
  return list.reduce((best, cur) => {
    const bp = best.priceEur ?? Number.POSITIVE_INFINITY;
    const cp = cur.priceEur ?? Number.POSITIVE_INFINITY;
    return cp < bp ? cur : best;
  }, list[0]);
}

function normalizeText(v: string | null | undefined): string {
  return (v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface ProductAddOverrides {
  category?: string;
  quantity?: number;
  weightG?: number;
  borrowed?: boolean;
}

export interface KitProductSheetV2Props {
  product: PickerProduct;
  initialCategory?: string;
  currentKitWeightG: number;
  units?: KitUnitsV2;
  alreadyInKit?: boolean;
  positionLabel?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onFavoriteChange?: () => void;
  onClose: () => void;
  onAdd: (product: PickerProduct, overrides: ProductAddOverrides, keepOpen: boolean) => void;
  onRemove?: (product: PickerProduct) => void;
}

export function readFavoriteProductIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('lkdv_fav_products') || '[]') as string[];
  } catch {
    return [];
  }
}

function parsePriceEuro(label: string | null): number | null {
  if (!label) return null;
  const match = label.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function heroSingleBadge(product: PickerProduct, loanBreakageEuro: number): string {
  switch (product.source) {
    case 'pret':
      return `Prêt gratuit · Casse/perte ${loanBreakageEuro} €`;
    case 'location':
      return product.priceLabel ? `Location · ${product.priceLabel}` : 'Location';
    case 'occasion':
      return product.priceLabel ? `Occasion · ${product.priceLabel}` : 'Occasion';
    case 'achat':
      return product.priceLabel ? `Boutique · ${product.priceLabel}` : 'Boutique';
    case 'inventory':
    default:
      return 'Mon inventaire';
  }
}

function wearColorFor(wearPct: number): string {
  if (wearPct <= 25) return '#15803d';
  if (wearPct <= 55) return '#d97706';
  return '#dc2626';
}

/**
 * Fiche produit Kit niveau 2 :
 * - En-tête : × à gauche + nom du produit centré
 * - Image produit repliable au scroll + 1 seule pastille utile (prix & infos source)
 * - Description, niveau d'usure (utilisation/prêt), carte propriétaire + badge de confiance
 * - Impact & Quantité / Poids unitaire
 * - En bas à droite : sélecteur capsule 3 icônes (Ajouter/Retirer, Enregistrer, Partager)
 */
export function KitProductSheetV2({
  product,
  initialCategory,
  currentKitWeightG,
  units = 'metric',
  alreadyInKit = false,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
  onFavoriteChange,
  onClose,
  onAdd,
  onRemove,
}: KitProductSheetV2Props) {
  const [zoomed, setZoomed] = useState(false);
  const [favorite, setFavorite] = useState(() => readFavoriteProductIds().includes(product.id));
  const [quantity, setQuantity] = useState(1);
  const [weightG, setWeightG] = useState<number>(() => product.weightG ?? 0);
  const [previewCollapsed, setPreviewCollapsed] = useScrollCollapsePreview(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [convs, setConvs] = useState<ShareConv[] | null>(null);
  const [convsLoading, setConvsLoading] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [sendingConvId, setSendingConvId] = useState<string | null>(null);
  const [sentConvIds, setSentConvIds] = useState<string[]>([]);
  const [heroPanel, setHeroPanel] = useState<'occasion' | 'location' | 'pret' | null>(null);
  const [selectedMode, setSelectedMode] = useState<ObtainMode>('achat');
  const [userPickedMode, setUserPickedMode] = useState(false);
  const [shopOffer, setShopOffer] = useState<ShopOffer | null>(null);
  const [occasionOffers, setOccasionOffers] = useState<CommunityOffer[]>([]);
  const [locationOffers, setLocationOffers] = useState<CommunityOffer[]>([]);
  const [loanOffers, setLoanOffers] = useState<CommunityOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [loanSending, setLoanSending] = useState(false);
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const swipeStartY = useRef<number | null>(null);

  useEffect(() => {
    setZoomed(false);
    setFavorite(readFavoriteProductIds().includes(product.id));
    setQuantity(1);
    setWeightG(product.weightG ?? 0);
    setShareOpen(false);
    setPreviewCollapsed(false);
    setHeroPanel(null);
    setUserPickedMode(false);
    setSelectedOccasionId(null);
    setSelectedLocationId(null);
    setSelectedLoanId(null);
    setVariantImages([]);
    setActiveImageIdx(0);
  }, [product.id, product.weightG, setPreviewCollapsed]);

  useEffect(() => {
    let alive = true;
    const needle = normalizeText(product.name);
    setOffersLoading(true);

    const loadOffers = async () => {
      try {
        const sb = createClient();
        const needleWords = needle
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !['pour', 'avec', 'sans', 'dans', 'plus'].includes(w));
        const shopPromise = product.productId
          ? sb.from('shop_products').select('*').eq('id', product.productId).maybeSingle()
          : sb
              .from('shop_products')
              .select('*')
              .ilike('name', `%${needleWords.slice(0, 2).join('%') || product.name}%`)
              .limit(1)
              .maybeSingle();

        const qParam = encodeURIComponent(product.name);
        const [shopRes, occRes, locRes, loanRes] = await Promise.all([
          shopPromise,
          fetch(`/api/marketplace/listings?mode=vente&q=${qParam}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : { listings: [] }))
            .catch(() => ({ listings: [] })),
          fetch(`/api/marketplace/listings?mode=location&q=${qParam}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : { listings: [] }))
            .catch(() => ({ listings: [] })),
          fetch(`/api/marketplace/listings?mode=pret&q=${qParam}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : { listings: [] }))
            .catch(() => ({ listings: [] })),
        ]);

        if (!alive) return;

        const sp = shopRes?.data as Record<string, unknown> | null;
        if (sp) {
          const stockNum = typeof sp.stock === 'number' ? sp.stock : typeof sp.stock_qty === 'number' ? sp.stock_qty : 1;
          setShopOffer({
            id: String(sp.id),
            slug: String(sp.slug ?? sp.id),
            name: String(sp.name ?? product.name),
            brand: String(sp.brand ?? product.brand ?? ''),
            priceEur: Number(sp.price_eur ?? sp.price ?? 0) || 0,
            weightG: Number(sp.weight_g ?? weightG) || 0,
            image: String(sp.image ?? ''),
            category: String(sp.category ?? product.category ?? 'Divers'),
            inStock: sp.in_stock !== false && stockNum > 0,
          });
        } else {
          setShopOffer(null);
        }

        const mapListings = (raw: unknown): CommunityOffer[] => {
          const list = Array.isArray((raw as { listings?: unknown[] })?.listings)
            ? ((raw as { listings: Array<Record<string, unknown>> }).listings)
            : [];
          return list
            .filter((l) => {
              if (product.productId && l.product_id === product.productId) return true;
              const title = normalizeText(String(l.name ?? l.title ?? l.product_name ?? ''));
              if (!needle || !title) return false;
              if (title === needle || title.includes(needle) || needle.includes(title)) return true;
              if (needleWords.length >= 2) {
                const hits = needleWords.filter((w) => title.includes(w));
                return hits.length >= Math.min(2, needleWords.length);
              }
              return needleWords.length === 1 && title.includes(needleWords[0]);
            })
            .map((l) => {
              const seller = (l.owner ?? l.seller ?? {}) as Record<string, unknown>;
              const rawPrice =
                typeof l.price_eur === 'number'
                  ? l.price_eur
                  : typeof l.price === 'number'
                    ? l.price
                    : typeof l.price_cents === 'number'
                      ? Math.round(l.price_cents / 100)
                      : null;
              return {
                id: String(l.id),
                title: String(l.name ?? l.title ?? l.product_name ?? product.name),
                priceEur: rawPrice,
                condition: typeof l.condition === 'string' ? l.condition : null,
                ownerId:
                  typeof l.owner_id === 'string'
                    ? l.owner_id
                    : typeof l.user_id === 'string'
                      ? l.user_id
                      : typeof seller.id === 'string'
                        ? seller.id
                        : null,
                ownerName: String(seller.full_name ?? seller.name ?? 'Voyageur LKDV'),
                ownerAvatar: typeof seller.avatar_url === 'string' ? seller.avatar_url : null,
                ownerTrustScore:
                  typeof seller.trust_score === 'number' ? Math.round(seller.trust_score) : null,
                image:
                  typeof l.photo_url === 'string'
                    ? l.photo_url
                    : typeof l.image_url === 'string'
                      ? l.image_url
                      : null,
              };
            });
        };

        const occ = mapListings(occRes);
        const locs = mapListings(locRes);
        const loans = mapListings(loanRes);
        setOccasionOffers(occ);
        setLocationOffers(locs);
        setLoanOffers(loans);
        setSelectedOccasionId(cheapestOffer(occ)?.id ?? null);
        setSelectedLocationId(cheapestOffer(locs)?.id ?? null);
        if (loans[0]) setSelectedLoanId(loans[0].id);

        // Charger les variantes/vues réelles depuis le bucket product-images si une URL Supabase est trouvée
        const candidateUrl =
          (product.image && /^https?:\/\//.test(product.image) ? product.image : '') ||
          (sp && typeof sp.image === 'string' && /^https?:\/\//.test(sp.image) ? sp.image : '') ||
          locs[0]?.image ||
          occ[0]?.image ||
          loans[0]?.image ||
          '';
        const match = candidateUrl.match(/^(https?:\/\/[^/]+\/storage\/v1\/object\/public\/product-images)\/([^/]+)\//);
        if (match) {
          const basePrefix = match[1];
          const folder = match[2];
          const { data: files } = await sb.storage.from('product-images').list(folder, { limit: 6 });
          if (alive && Array.isArray(files) && files.length > 0) {
            const urls = files
              .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((f) => `${basePrefix}/${folder}/${f.name}`);
            setVariantImages(urls);
          }
        }
      } finally {
        if (alive) setOffersLoading(false);
      }
    };

    void loadOffers();
    return () => {
      alive = false;
    };
  }, [product.brand, product.category, product.id, product.name, product.productId, weightG]);

  const bestMode = useMemo<ObtainMode>(() => {
    if (loanOffers.length > 0) return 'pret';
    if (shopOffer?.inStock) return 'achat';
    return 'occasion';
  }, [loanOffers.length, shopOffer]);

  useEffect(() => {
    if (!offersLoading && !userPickedMode) {
      setSelectedMode(bestMode);
    }
  }, [bestMode, offersLoading, userPickedMode]);

  const selectedOccasion = useMemo(
    () => occasionOffers.find((o) => o.id === selectedOccasionId) ?? cheapestOffer(occasionOffers),
    [occasionOffers, selectedOccasionId]
  );
  const selectedLocation = useMemo(
    () => locationOffers.find((o) => o.id === selectedLocationId) ?? cheapestOffer(locationOffers),
    [locationOffers, selectedLocationId]
  );
  const selectedLoan = useMemo(
    () => loanOffers.find((o) => o.id === selectedLoanId) ?? loanOffers[0] ?? null,
    [loanOffers, selectedLoanId]
  );

  const sendMarketplaceRequest = async (
    offer: CommunityOffer,
    mode: 'pret' | 'location' | 'vente'
  ): Promise<boolean> => {
    setLoanSending(true);
    try {
      const res = await fetch('/api/marketplace/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: offer.id,
          mode,
          productName: product.name,
          priceEur: offer.priceEur,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || 'Impossible d’envoyer la demande');
        return false;
      }
      const label =
        mode === 'pret' ? 'Demande de prêt' : mode === 'location' ? 'Demande de location' : 'Demande d’occasion';
      toast.success(`${label} envoyée par message et notification à ${offer.ownerName}`);
      setHeroPanel(null);
      return true;
    } catch {
      toast.error('Erreur réseau lors de l’envoi de la demande');
      return false;
    } finally {
      setLoanSending(false);
    }
  };

  const handleSendLoanRequest = async () => {
    if (!selectedLoan) return;
    await sendMarketplaceRequest(selectedLoan, 'pret');
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (shareOpen) setShareOpen(false);
        else onClose();
      } else if (event.key === 'ArrowLeft' && hasPrev && onPrev && !shareOpen) {
        onPrev();
      } else if (event.key === 'ArrowRight' && hasNext && onNext && !shareOpen) {
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasNext, hasPrev, onClose, onNext, onPrev, shareOpen]);

  const openSharePicker = async () => {
    const nextOpen = !shareOpen;
    setShareOpen(nextOpen);
    if (!nextOpen || convs !== null) return;
    setConvsLoading(true);
    try {
      const res = await fetch('/api/compte/share-post', { cache: 'no-store' });
      const data = res.ok ? ((await res.json()) as { conversations?: ShareConv[] }) : { conversations: [] };
      setConvs(Array.isArray(data?.conversations) ? data.conversations : []);
    } catch {
      setConvs([]);
    } finally {
      setConvsLoading(false);
    }
  };

  const sendToConversation = async (conv: ShareConv) => {
    setSendingConvId(conv.id);
    try {
      const parsedEuro = parsePriceEuro(product.priceLabel);
      const res = await fetch('/api/compte/share-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conv.id,
          productId: product.productId || product.id,
          name: product.name,
          photoUrl: product.image,
          category: product.category || initialCategory || null,
          priceCents:
            product.source === 'pret'
              ? 0
              : parsedEuro != null
                ? Math.round(parsedEuro * 100)
                : null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(
          err?.error === 'unauthenticated'
            ? 'Connecte-toi pour partager ce produit.'
            : 'Impossible d’envoyer dans cette conversation.',
        );
        return;
      }
      setSentConvIds((cur) => [...cur, conv.id]);
      const label = conv.title || conv.name || 'la conversation';
      toast.success(`Partagé dans ${label}`);
      setShareOpen(false);
    } catch {
      toast.error('Impossible d’envoyer dans cette conversation.');
    } finally {
      setSendingConvId(null);
    }
  };

  const imgSrc = product.image || generatedProductImage(product.name, 256);

  const heroGallery = useMemo(() => {
    const raw = [
      product.image && /^https?:\/\//.test(product.image) ? product.image : null,
      shopOffer?.image && /^https?:\/\//.test(shopOffer.image) ? shopOffer.image : null,
      ...variantImages,
      selectedLocation?.image && /^https?:\/\//.test(selectedLocation.image) ? selectedLocation.image : null,
      selectedOccasion?.image && /^https?:\/\//.test(selectedOccasion.image) ? selectedOccasion.image : null,
      selectedLoan?.image && /^https?:\/\//.test(selectedLoan.image) ? selectedLoan.image : null,
    ].filter((u): u is string => Boolean(u));
    const unique = Array.from(new Set(raw));
    return unique.length > 0 ? unique : [imgSrc];
  }, [imgSrc, product.image, selectedLoan?.image, selectedLocation?.image, selectedOccasion?.image, shopOffer?.image, variantImages]);

  const activeHeroImg = heroGallery[activeImageIdx] ?? heroGallery[0] ?? imgSrc;

  const effectiveAddWeight = Math.max(0, weightG) * quantity;
  const projectedTotalG = alreadyInKit ? currentKitWeightG : currentKitWeightG + effectiveAddWeight;
  const kitSharePct =
    projectedTotalG > 0 ? Math.min(100, Math.round((effectiveAddWeight / projectedTotalG) * 100)) : 0;

  const classBefore = kitGoalV2(kitGoalOfWeightV2(currentKitWeightG));
  const classAfter = kitGoalV2(kitGoalOfWeightV2(projectedTotalG));
  const classChanged = classBefore.id !== classAfter.id;

  const fmtKg = (g: number) => formatKitWeightV2(g, units);
  const fmtItem = (g: number) => formatKitItemWeightV2(g, units);

  const catKey = product.category?.trim() || initialCategory || 'Divers';
  const benchmarkG = CATEGORY_BENCHMARK_G[catKey] ?? 450;

  const isLoan = product.source === 'pret';
  const loanBreakageEuro = Math.round((product.depositCents ?? 0) / 100);
  const priceEuro = isLoan ? 0 : parsePriceEuro(product.priceLabel);
  const euroPer100g = useMemo(() => {
    if (isLoan || !priceEuro || weightG <= 0) return null;
    return ((priceEuro / weightG) * 100).toFixed(1).replace('.', ',');
  }, [isLoan, priceEuro, weightG]);

  const singleHeroBadge = heroSingleBadge(product, loanBreakageEuro);

  const isUsedOrLoan =
    product.source === 'pret' ||
    product.source === 'occasion' ||
    product.source === 'location' ||
    product.source === 'inventory';
  const showWear = isUsedOrLoan && (product.wear != null || Boolean(product.conditionLabel));
  const wearPct = product.wear ?? 20;

  const toggleFav = () => {
    const cur = readFavoriteProductIds();
    const next = favorite ? cur.filter((id) => id !== product.id) : [...cur, product.id];
    try {
      localStorage.setItem('lkdv_fav_products', JSON.stringify(next));
    } catch {
      /* stockage local optionnel */
    }
    setFavorite(!favorite);
    onFavoriteChange?.();
    toast.success(!favorite ? 'Produit enregistré' : 'Retiré des favoris');
  };

  const toggleKitMembership = () => {
    if (alreadyInKit && onRemove) {
      onRemove(product);
      toast.success(`${product.name} retiré du kit`);
      return;
    }
    onAdd(
      product,
      {
        category: initialCategory || product.category || 'Divers',
        quantity,
        weightG,
        borrowed: isLoan,
      },
      true,
    );
    toast.success(`${product.name} ajouté au kit`);
  };

  const visibleConvs = useMemo(() => {
    if (!convs) return [];
    const q = convSearch.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter((c) => (c.title || c.name || '').toLowerCase().includes(q));
  }, [convSearch, convs]);

  return (
    <div
      className="lkdv-cv2c-stack-overlay is-level2 is-product-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div
        className="lkdv-cv2-grab"
        aria-hidden="true"
        onPointerDown={(e) => {
          swipeStartY.current = e.clientY;
        }}
        onPointerUp={(e) => {
          if (swipeStartY.current != null && e.clientY - swipeStartY.current > 75) {
            onClose();
          }
          swipeStartY.current = null;
        }}
      >
        <span />
      </div>

      {/* En-tête minimaliste : × à gauche + NOM DU PRODUIT centré */}
      <div className="lkdv-cv2c-ps-head" style={{ borderBottom: 0 }}>
        <button
          type="button"
          className="lkdv-cv2c-stack-close"
          aria-label="Fermer la fiche produit"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
        <span
          className="lkdv-cv2c-ps-head-title"
          style={{
            flex: 1,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingInline: 8,
          }}
          title={product.name}
        >
          {product.name}
        </span>
        <span style={{ width: 34, flexShrink: 0 }} aria-hidden="true" />
      </div>

      {/* Corps scrollable jusqu'en bas sous le sélecteur bas droite */}
      <div className="lkdv-cv2c-ps-scroll" onClick={() => shareOpen && setShareOpen(false)}>
        {/* Aperçu produit repliable au scroll (1 seule pastille utile en haut à droite) */}
        <div className="lkdv-cv2c-ps-sticky-hero">
          <CollapsibleHeroPreview
            collapsed={previewCollapsed}
            onExpand={() => setPreviewCollapsed(false)}
            title={product.name}
            subtitle={`${fmtItem(weightG)} · ${singleHeroBadge}`}
            avatarUrl={activeHeroImg}
          >
            <div className="lkdv-cv2c-ps-hero" data-zoomed={zoomed || undefined}>
              {heroPanel === 'occasion' || heroPanel === 'location' ? (() => {
                const isLocation = heroPanel === 'location';
                const listOffers = isLocation ? locationOffers : occasionOffers;
                return (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px',
                    gap: '8px',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: '0.84rem', color: '#172b24' }}>
                      {isLocation ? `Locations (${listOffers.length})` : `Occasions (${listOffers.length})`}
                    </b>
                    <button
                      type="button"
                      onClick={() => setHeroPanel(null)}
                      aria-label="Revenir à la photo"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: 0,
                        background: 'rgba(23, 64, 44, 0.08)',
                        color: '#17402c',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {offersLoading ? (
                    <p style={{ margin: '12px 0', fontSize: '0.78rem', color: '#56665d' }}>
                      {isLocation ? 'Recherche des annonces de location…' : 'Recherche des annonces d’occasion…'}
                    </p>
                  ) : listOffers.length === 0 ? (
                    <div style={{ margin: 'auto 0', textAlign: 'center', padding: '12px' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#56665d' }}>
                        {isLocation
                          ? 'Aucune annonce de location avec cette référence pour le moment.'
                          : 'Aucune annonce d’occasion avec cette référence pour le moment.'}
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '8px',
                      }}
                    >
                      {listOffers.map((offer) => {
                        const isPicked = isLocation
                          ? selectedLocation?.id === offer.id
                          : selectedOccasion?.id === offer.id;
                        const offerImg = offer.image || imgSrc;
                        return (
                          <button
                            key={offer.id}
                            type="button"
                            onClick={() => {
                              if (isLocation) setSelectedLocationId(offer.id);
                              else setSelectedOccasionId(offer.id);
                            }}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 6,
                              padding: '8px',
                              borderRadius: 14,
                              aspectRatio: '1 / 1',
                              background: isPicked ? 'rgba(23, 64, 44, 0.06)' : '#ffffff',
                              border: isPicked ? '1.5px solid #17402c' : '1px solid rgba(23, 64, 44, 0.12)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              minWidth: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                overflow: 'hidden',
                                background: '#f2f6f3',
                                flex: 'none',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- photo offre */}
                              <img
                                src={offerImg}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            </div>
                            <div style={{ width: '100%', minWidth: 0 }}>
                              <b
                                style={{
                                  display: 'block',
                                  fontSize: '0.72rem',
                                  lineHeight: 1.2,
                                  color: '#172b24',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {offer.ownerName}
                              </b>
                              <small
                                style={{
                                  display: 'block',
                                  fontSize: '0.68rem',
                                  color: '#17402c',
                                  fontWeight: 700,
                                  marginTop: 2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {offer.priceEur !== null
                                  ? isLocation
                                    ? `${offer.priceEur} € / j`
                                    : `${offer.priceEur} €`
                                  : offer.condition || 'Bon état'}
                              </small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })() : heroPanel === 'pret' ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px',
                    gap: '8px',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: '0.84rem', color: '#172b24' }}>
                      Demander un prêt ({loanOffers.length})
                    </b>
                    <button
                      type="button"
                      onClick={() => setHeroPanel(null)}
                      aria-label="Revenir à la photo"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: 0,
                        background: 'rgba(23, 64, 44, 0.08)',
                        color: '#17402c',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {loanOffers.map((offer) => {
                      const active = selectedLoanId === offer.id;
                      return (
                        <button
                          key={offer.id}
                          type="button"
                          onClick={() => setSelectedLoanId(offer.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 12,
                            background: active ? 'rgba(22, 163, 74, 0.1)' : '#f8faf8',
                            border: active ? '1.5px solid #15803d' : '1px solid rgba(23, 64, 44, 0.1)',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <b style={{ display: 'block', fontSize: '0.78rem', color: '#172b24' }}>
                              {offer.ownerName}
                            </b>
                            <small style={{ fontSize: '0.7rem', color: '#56665d' }}>
                              {offer.condition || 'Disponible en prêt'}
                            </small>
                          </div>
                          {active ? <Check size={15} color="#15803d" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={!selectedLoanId || loanSending}
                    onClick={() => void handleSendLoanRequest()}
                    style={{
                      height: 36,
                      borderRadius: 999,
                      border: 0,
                      background: '#15803d',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    {loanSending ? 'Envoi…' : 'Envoyer la demande de prêt'}
                  </button>
                </div>
              ) : (
                <>
                  {heroGallery.length > 1 ? (
                    <div
                      aria-label="Vues du produit"
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: 10,
                        bottom: 10,
                        width: 42,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        overflowY: 'auto',
                        zIndex: 3,
                        scrollbarWidth: 'none',
                      }}
                    >
                      {heroGallery.map((url, idx) => {
                        const active = idx === activeImageIdx;
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setActiveImageIdx(idx)}
                            aria-label={`Vue ${idx + 1}`}
                            aria-pressed={active}
                            style={{
                              width: 38,
                              height: 38,
                              padding: 0,
                              borderRadius: 9,
                              overflow: 'hidden',
                              border: active
                                ? '1.5px solid #17402c'
                                : '1px solid rgba(23, 64, 44, 0.16)',
                              background: '#ffffff',
                              flex: 'none',
                              cursor: 'pointer',
                              opacity: active ? 1 : 0.72,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- miniature variante */}
                            <img
                              src={url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element -- photo produit */}
                  <img
                    src={activeHeroImg}
                    alt={product.name}
                    className="lkdv-cv2c-ps-hero-img"
                    style={heroGallery.length > 1 ? { paddingLeft: 48 } : undefined}
                  />
                  <span className="lkdv-cv2c-ps-badge is-right">{singleHeroBadge}</span>
                  <button
                    type="button"
                    className="lkdv-cv2c-ps-zoom-btn"
                    aria-label={zoomed ? 'Réduire la photo' : 'Zoomer sur la photo'}
                    onClick={() => setZoomed((z) => !z)}
                  >
                    {zoomed ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
                  </button>
                </>
              )}
            </div>
          </CollapsibleHeroPreview>
        </div>

        {/* Propriétaire + badge de confiance (cliquable vers son profil) */}
        {product.owner ? (
          <Link
            href={`/profil/${product.owner.id}`}
            className="lkdv-cv2c-owner-pill"
            aria-label={`Voir le profil de ${product.owner.name}`}
          >
            {product.owner.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar propriétaire
              <img src={product.owner.avatarUrl} alt="" className="lkdv-cv2c-owner-av" />
            ) : (
              <span className="lkdv-cv2c-owner-av" aria-hidden="true">
                {product.owner.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.84rem', color: '#111827' }}>{product.owner.name}</b>
                {product.owner.trustScore != null ? (
                  <span className="lkdv-cv2c-trust-badge">
                    <ShieldCheck size={11} aria-hidden="true" />
                    Confiance {Math.round(product.owner.trustScore)}
                  </span>
                ) : null}
              </div>
              <small style={{ fontSize: '0.72rem', color: '#64748b' }}>Voir le profil</small>
            </div>
            <ChevronRight size={15} color="#64748b" aria-hidden="true" />
          </Link>
        ) : null}

        {/* Différentes possibilités d'obtenir cet objet */}
        <div className="lkdv-cv2c-ps-card" style={{ gap: 8 }}>
          <span className="lkdv-cv2c-ps-label">Obtenir cet objet</span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {/* 1. Achat neuf -> sélectionne le mode achat */}
            <button
              type="button"
              onClick={() => {
                setUserPickedMode(true);
                setSelectedMode('achat');
                setHeroPanel(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 10px',
                borderRadius: 12,
                background: selectedMode === 'achat' ? 'rgba(23, 64, 44, 0.08)' : shopOffer?.inStock ? '#f8faf8' : '#f9fafb',
                border: selectedMode === 'achat' ? '1.5px solid #17402c' : '1px solid rgba(23, 64, 44, 0.1)',
                color: '#172b24',
                textAlign: 'left',
                cursor: 'pointer',
                opacity: shopOffer?.inStock === false && selectedMode !== 'achat' ? 0.65 : 1,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(23, 64, 44, 0.08)',
                  color: '#17402c',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <ShoppingBag size={14} aria-hidden="true" />
              </span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <b style={{ fontSize: '0.78rem', lineHeight: 1.2 }}>Acheter neuf</b>
                <small style={{ fontSize: '0.68rem', color: '#56665d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {offersLoading
                    ? 'Vérification…'
                    : shopOffer?.inStock
                      ? `${shopOffer.priceEur > 0 ? `${shopOffer.priceEur} € · ` : ''}En stock`
                      : 'Hors stock'}
                </small>
              </span>
            </button>

            {/* 2. Location -> sélectionne le mode location + ouvre le mini drawer */}
            <button
              type="button"
              onClick={() => {
                setUserPickedMode(true);
                setSelectedMode('location');
                setHeroPanel((cur) => (cur === 'location' ? null : 'location'));
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 10px',
                borderRadius: 12,
                background: selectedMode === 'location' || heroPanel === 'location' ? 'rgba(23, 64, 44, 0.08)' : '#f8faf8',
                border: selectedMode === 'location' || heroPanel === 'location' ? '1.5px solid #17402c' : '1px solid rgba(23, 64, 44, 0.1)',
                color: '#172b24',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(23, 64, 44, 0.08)',
                  color: '#17402c',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <Calendar size={14} aria-hidden="true" />
              </span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <b style={{ fontSize: '0.78rem', lineHeight: 1.2 }}>Louer</b>
                <small style={{ fontSize: '0.68rem', color: '#56665d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {offersLoading ? 'Recherche…' : `${locationOffers.length} annonce${locationOffers.length > 1 ? 's' : ''}`}
                </small>
              </span>
            </button>

            {/* 3. Occasion -> sélectionne le mode occasion + ouvre le mini drawer */}
            <button
              type="button"
              onClick={() => {
                setUserPickedMode(true);
                setSelectedMode('occasion');
                setHeroPanel((cur) => (cur === 'occasion' ? null : 'occasion'));
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 10px',
                borderRadius: 12,
                background: selectedMode === 'occasion' || heroPanel === 'occasion' ? 'rgba(23, 64, 44, 0.08)' : '#f8faf8',
                border: selectedMode === 'occasion' || heroPanel === 'occasion' ? '1.5px solid #17402c' : '1px solid rgba(23, 64, 44, 0.1)',
                color: '#172b24',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(23, 64, 44, 0.08)',
                  color: '#17402c',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <Repeat size={14} aria-hidden="true" />
              </span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <b style={{ fontSize: '0.78rem', lineHeight: 1.2 }}>Occasion</b>
                <small style={{ fontSize: '0.68rem', color: '#56665d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {offersLoading ? 'Recherche…' : `${occasionOffers.length} annonce${occasionOffers.length > 1 ? 's' : ''}`}
                </small>
              </span>
            </button>

            {/* 4. Emprunter (Prêt) -> rouge si indisponible, vert si dispo + sélectionne et ouvre sélecteur */}
            <button
              type="button"
              disabled={!offersLoading && loanOffers.length === 0}
              onClick={() => {
                if (loanOffers.length > 0) {
                  setUserPickedMode(true);
                  setSelectedMode('pret');
                  setHeroPanel((cur) => (cur === 'pret' ? null : 'pret'));
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 10px',
                borderRadius: 12,
                background:
                  loanOffers.length > 0
                    ? 'rgba(22, 163, 74, 0.1)'
                    : 'rgba(220, 38, 38, 0.08)',
                border:
                  selectedMode === 'pret' && loanOffers.length > 0
                    ? '1.5px solid #15803d'
                    : loanOffers.length > 0
                      ? '1px solid rgba(22, 163, 74, 0.35)'
                      : '1px solid rgba(220, 38, 38, 0.28)',
                color: loanOffers.length > 0 ? '#15803d' : '#b91c1c',
                textAlign: 'left',
                cursor: loanOffers.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background:
                    loanOffers.length > 0
                      ? 'rgba(22, 163, 74, 0.14)'
                      : 'rgba(220, 38, 38, 0.14)',
                  color: loanOffers.length > 0 ? '#15803d' : '#b91c1c',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <Handshake size={14} aria-hidden="true" />
              </span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <b style={{ fontSize: '0.78rem', lineHeight: 1.2 }}>Emprunter</b>
                <small style={{ fontSize: '0.68rem', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {offersLoading
                    ? 'Vérification…'
                    : loanOffers.length > 0
                      ? `${loanOffers.length} dispo${loanOffers.length > 1 ? 's' : ''}`
                      : 'Personne ne le prête'}
                </small>
              </span>
            </button>
          </div>
        </div>

        {/* Action principale + caractéristiques de l'option sélectionnée (défaut = moins cher / plus avantageux) */}
        {(() => {
          const isBest = selectedMode === bestMode && (loanOffers.length > 0 || locationOffers.length > 0 || occasionOffers.length > 0 || Boolean(shopOffer?.inStock));
          const modeLabel =
            selectedMode === 'pret'
              ? 'Emprunt (prêt)'
              : selectedMode === 'location'
                ? 'Location communauté'
                : selectedMode === 'occasion'
                  ? 'Occasion communauté'
                  : 'Achat neuf';

          const specs: Array<{ label: string; value: string; uppercase?: boolean; trustScore?: number | null; href?: string | null }> =
            selectedMode === 'pret'
              ? [
                  { label: 'Coût', value: 'Gratuit (0 €)' },
                  { label: 'Casse / perte', value: `${loanBreakageEuro} €` },
                  { label: 'Prêteur', value: selectedLoan?.ownerName ?? 'Aucun prêteur', trustScore: selectedLoan?.ownerTrustScore ?? null, href: selectedLoan?.ownerId ? `/profil/${selectedLoan.ownerId}` : null },
                  { label: 'État', value: selectedLoan?.condition ?? 'Bon état', uppercase: true },
                ]
              : selectedMode === 'location'
                ? [
                    { label: 'Tarif', value: selectedLocation?.priceEur != null ? `${selectedLocation.priceEur} € / j` : 'Sur demande' },
                    { label: 'État', value: selectedLocation?.condition ?? 'Bon état', uppercase: true },
                    { label: 'Loueur', value: selectedLocation?.ownerName ?? 'Communauté', trustScore: selectedLocation?.ownerTrustScore ?? null, href: selectedLocation?.ownerId ? `/profil/${selectedLocation.ownerId}` : null },
                    { label: 'Dispos', value: `${locationOffers.length} annonce${locationOffers.length > 1 ? 's' : ''}` },
                  ]
                : selectedMode === 'occasion'
                  ? [
                      { label: 'Prix', value: selectedOccasion?.priceEur != null ? `${selectedOccasion.priceEur} €` : 'À négocier' },
                      { label: 'État', value: selectedOccasion?.condition ?? 'Bon état', uppercase: true },
                      { label: 'Vendeur', value: selectedOccasion?.ownerName ?? 'Communauté', trustScore: selectedOccasion?.ownerTrustScore ?? null, href: selectedOccasion?.ownerId ? `/profil/${selectedOccasion.ownerId}` : null },
                      { label: 'Dispos', value: `${occasionOffers.length} annonce${occasionOffers.length > 1 ? 's' : ''}` },
                    ]
                  : [
                      { label: 'Prix', value: shopOffer?.priceEur ? `${shopOffer.priceEur} €` : 'Indisponible' },
                      { label: 'État', value: 'Neuf', uppercase: true },
                      { label: 'Stock', value: shopOffer?.inStock ? 'En stock' : 'Hors stock' },
                      { label: 'Poids', value: fmtItem(shopOffer?.weightG || weightG) },
                    ];

          const canAct =
            selectedMode === 'pret'
              ? Boolean(selectedLoan) && !loanSending
              : selectedMode === 'location'
                ? Boolean(selectedLocation) && !loanSending
                : selectedMode === 'occasion'
                  ? Boolean(selectedOccasion) && !loanSending
                  : Boolean(shopOffer?.inStock);

          const ctaText =
            selectedMode === 'pret'
              ? loanSending
                ? 'Envoi…'
                : 'Emprunter'
              : selectedMode === 'location'
                ? loanSending
                  ? 'Envoi…'
                  : `Louer${selectedLocation?.priceEur != null ? ` · ${selectedLocation.priceEur} € / j` : ''}`
                : selectedMode === 'occasion'
                  ? loanSending
                    ? 'Envoi…'
                    : `Ajouter au panier${selectedOccasion?.priceEur != null ? ` · ${selectedOccasion.priceEur} €` : ''}`
                  : shopOffer?.inStock
                    ? `Ajouter au panier${shopOffer.priceEur > 0 ? ` · ${shopOffer.priceEur} €` : ''}`
                    : 'Indisponible en neuf';

          const handlePrimaryCta = () => {
            if (selectedMode === 'pret') {
              void handleSendLoanRequest();
              return;
            }
            if (selectedMode === 'location' && selectedLocation) {
              void sendMarketplaceRequest(selectedLocation, 'location');
              return;
            }
            if (selectedMode === 'achat') {
              if (shopOffer?.inStock) {
                addToCart({
                  id: shopOffer.id,
                  slug: shopOffer.slug,
                  name: shopOffer.name,
                  brand: shopOffer.brand,
                  priceEur: shopOffer.priceEur,
                  weightG: shopOffer.weightG,
                  image: shopOffer.image || imgSrc,
                  imageAlt: shopOffer.name,
                  quantity,
                  category: shopOffer.category,
                });
                toast.success(`${shopOffer.name} ajouté au panier`);
              } else {
                toast.info('Produit indisponible en stock neuf');
              }
              return;
            }
            if (selectedMode === 'occasion' && selectedOccasion) {
              addToCart({
                id: selectedOccasion.id,
                slug: selectedOccasion.id,
                name: `${selectedOccasion.title} (Occasion)`,
                brand: product.brand ?? '',
                priceEur: selectedOccasion.priceEur ?? 0,
                weightG,
                image: selectedOccasion.image || imgSrc,
                imageAlt: selectedOccasion.title,
                quantity,
                category: product.category ?? 'Divers',
              });
              void sendMarketplaceRequest(selectedOccasion, 'vente');
            }
          };

          return (
            <div className="lkdv-cv2c-ps-card" style={{ gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                  {modeLabel}
                </span>
                {isBest ? (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(22, 163, 74, 0.12)',
                      color: '#15803d',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                    }}
                  >
                    {selectedMode === 'pret'
                      ? 'Emprunt prioritaire'
                      : selectedMode === 'achat'
                        ? 'Boutique LKDV · En stock'
                        : 'Meilleure alternative'}
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 6,
                }}
              >
                {specs.map((spec) => {
                  const inner = (
                    <>
                      <small style={{ fontSize: '0.66rem', color: '#64748b' }}>{spec.label}</small>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <b
                          style={{
                            fontSize: '0.76rem',
                            color: '#172b24',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textTransform: spec.uppercase ? 'uppercase' : undefined,
                          }}
                        >
                          {spec.value}
                        </b>
                        {spec.trustScore != null ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              padding: '1px 6px',
                              borderRadius: 999,
                              background: 'rgba(22, 163, 74, 0.12)',
                              color: '#15803d',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              flex: 'none',
                            }}
                            title="Score de confiance"
                          >
                            <ShieldCheck size={10} aria-hidden="true" />
                            {spec.trustScore}
                          </span>
                        ) : null}
                        {spec.href ? <ChevronRight size={12} color="#64748b" style={{ marginLeft: 'auto', flex: 'none' }} aria-hidden="true" /> : null}
                      </div>
                    </>
                  );
                  const boxStyle = {
                    padding: '6px 9px',
                    borderRadius: 10,
                    background: '#f8faf8',
                    border: '1px solid rgba(23, 64, 44, 0.08)',
                    display: 'flex',
                    flexDirection: 'column' as const,
                    gap: 1,
                    textDecoration: 'none',
                  };
                  return spec.href ? (
                    <Link key={spec.label} href={spec.href} onClick={onClose} style={boxStyle}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={spec.label} style={boxStyle}>
                      {inner}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!canAct}
                onClick={handlePrimaryCta}
                style={{
                  height: 40,
                  borderRadius: 999,
                  border: 0,
                  background: selectedMode === 'pret' ? '#15803d' : '#17402c',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: canAct ? 'pointer' : 'not-allowed',
                  opacity: canAct ? 1 : 0.55,
                }}
              >
                {selectedMode === 'pret' ? (
                  <Handshake size={15} aria-hidden="true" />
                ) : selectedMode === 'location' ? (
                  <Calendar size={15} aria-hidden="true" />
                ) : (
                  <ShoppingBag size={15} aria-hidden="true" />
                )}
                <span>{ctaText}</span>
              </button>
            </div>
          );
        })()}

        {/* Description du produit */}
        {product.description ? (
          <div className="lkdv-cv2c-ps-card">
            <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>Description</span>
            <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.45, color: '#334155' }}>
              {product.description}
            </p>
          </div>
        ) : null}

        {/* Niveau d'usure moderne (occasion, location, prêt, inventaire) */}
        {showWear ? (
          <div className="lkdv-cv2c-ps-card" style={{ gap: 8 }}>
            <div className="lkdv-cv2c-ps-row-head">
              <span>Niveau d’usure</span>
              <b>
                {product.conditionLabel ?? 'Bon état'} · {wearPct}%
              </b>
            </div>
            <div className="lkdv-cv2c-wear-bar" role="progressbar" aria-valuenow={wearPct} aria-valuemin={0} aria-valuemax={100}>
              <span
                className="lkdv-cv2c-wear-fill"
                style={{
                  width: `${Math.max(6, wearPct)}%`,
                  background: wearColorFor(wearPct),
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Impact dans le kit */}
        <div className="lkdv-cv2c-ps-card" style={{ gap: 10 }}>
          <div className="lkdv-cv2c-ps-kpi-grid">
            <div className="lkdv-cv2c-ps-kpi">
              <small>Poids ajouté</small>
              <b>{fmtItem(effectiveAddWeight)}</b>
            </div>
            <div className="lkdv-cv2c-ps-kpi">
              <small>Part du kit</small>
              <b>{kitSharePct}%</b>
            </div>
            <div className="lkdv-cv2c-ps-kpi">
              <small>{isLoan ? 'Casse / perte' : euroPer100g ? 'Coût / 100g' : 'Moyenne cat.'}</small>
              <b>
                {isLoan
                  ? `${loanBreakageEuro} €`
                  : euroPer100g
                    ? `${euroPer100g} €`
                    : `${benchmarkG} g`}
              </b>
            </div>
          </div>
          <div className="lkdv-cv2c-ps-progress-track">
            <span className="lkdv-cv2c-ps-progress-fill" style={{ width: `${Math.max(4, kitSharePct)}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
            <span>
              {isLoan ? 'Prêt gratuit' : `Kit projeté : ${fmtKg(projectedTotalG)}`}
            </span>
            <span>
              {classChanged ? `${classBefore.label} → ${classAfter.label}` : classAfter.label}
            </span>
          </div>
        </div>

        {/* Quantité & Poids unitaire */}
        <div className="lkdv-cv2c-ps-card lkdv-cv2c-ps-grid-2">
          <div>
            <span className="lkdv-cv2c-ps-label">Quantité</span>
            <div className="lkdv-cv2c-ps-stepper">
              <button
                type="button"
                aria-label="Diminuer la quantité"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} />
              </button>
              <output>{quantity}</output>
              <button
                type="button"
                aria-label="Augmenter la quantité"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="ps-custom-weight" className="lkdv-cv2c-ps-label">
              Poids unitaire (g)
            </label>
            <input
              id="ps-custom-weight"
              type="number"
              inputMode="numeric"
              min={0}
              max={60000}
              className="lkdv-cv2c-ps-input"
              value={weightG}
              onChange={(e) => setWeightG(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>
      </div>

      {/* Dock flottant bas à DROITE uniquement : 3 icônes sans libellé (Ajouter/Retirer, Enregistrer, Partager) */}
      <div className="lkdv-cv2c-stack-float-dock is-right-only">
        <div className="lkdv-cv2c-filter-wrap">
          <div className="lkdv-cv2c-pill-seg" role="group" aria-label="Actions produit">
            <button
              type="button"
              className="lkdv-cv2c-pill-seg-btn"
              data-active={alreadyInKit}
              aria-pressed={alreadyInKit}
              aria-label={alreadyInKit ? 'Retirer du kit' : 'Ajouter au kit'}
              title={alreadyInKit ? 'Retirer du kit' : 'Ajouter au kit'}
              onClick={toggleKitMembership}
            >
              {alreadyInKit ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="lkdv-cv2c-pill-seg-btn"
              data-active={favorite}
              aria-pressed={favorite}
              aria-label={favorite ? 'Enregistré' : 'Enregistrer'}
              title={favorite ? 'Enregistré' : 'Enregistrer'}
              onClick={toggleFav}
            >
              <Bookmark size={14} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lkdv-cv2c-pill-seg-btn"
              data-active={shareOpen}
              aria-expanded={shareOpen}
              aria-label="Partager"
              title="Partager"
              onClick={() => void openSharePicker()}
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </div>

          {shareOpen ? (
            <div className="lkdv-cv2c-dock-menu" role="dialog" aria-label="Partager dans une conversation">
              <div className="lkdv-cv2c-dock-menu-head">
                <b>Partager dans une conversation</b>
                <button
                  type="button"
                  className="lkdv-cv2c-dock-menu-reset"
                  aria-label="Fermer le partage"
                  onClick={() => setShareOpen(false)}
                >
                  <X size={13} />
                </button>
              </div>
              {convs && convs.length > 4 ? (
                <div className="lkdv-cv2c-stack-search" style={{ height: 32 }}>
                  <Search size={13} aria-hidden="true" />
                  <input
                    type="search"
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                    placeholder="Filtrer les conversations…"
                    aria-label="Filtrer les conversations"
                  />
                </div>
              ) : null}
              {convsLoading ? (
                <p className="lkdv-cv2-field-hint" style={{ padding: '12px 4px', margin: 0 }}>
                  <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement…
                </p>
              ) : visibleConvs.length === 0 ? (
                <p className="lkdv-cv2-field-hint" style={{ padding: '8px 4px', margin: 0 }}>
                  Aucune conversation active trouvée.
                </p>
              ) : (
                <ul className="lkdv-cv2c-share-conv-list" role="list">
                  {visibleConvs.map((conv) => {
                    const title = conv.title || conv.name || 'Conversation';
                    const sent = sentConvIds.includes(conv.id);
                    const busy = sendingConvId === conv.id;
                    return (
                      <li key={conv.id}>
                        <button
                          type="button"
                          className="lkdv-cv2c-share-conv-row"
                          disabled={busy}
                          onClick={() => void sendToConversation(conv)}
                        >
                          {conv.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- avatar conversation
                            <img src={conv.avatar_url} alt="" className="lkdv-cv2c-share-conv-av" />
                          ) : (
                            <span className="lkdv-cv2c-share-conv-av" aria-hidden="true">
                              {title.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: '#111827',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {title}
                          </span>
                          {busy ? (
                            <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
                          ) : sent ? (
                            <Check size={14} color="#047857" aria-hidden="true" />
                          ) : (
                            <Send size={13} color="#1b4332" aria-hidden="true" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
