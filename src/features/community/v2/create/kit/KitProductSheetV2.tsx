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
  const swipeStartY = useRef<number | null>(null);

  useEffect(() => {
    setZoomed(false);
    setFavorite(readFavoriteProductIds().includes(product.id));
    setQuantity(1);
    setWeightG(product.weightG ?? 0);
    setShareOpen(false);
    setPreviewCollapsed(false);
  }, [product.id, product.weightG, setPreviewCollapsed]);

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
            avatarUrl={imgSrc}
          >
            <div className="lkdv-cv2c-ps-hero" data-zoomed={zoomed || undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element -- photo produit */}
              <img src={imgSrc} alt={product.name} className="lkdv-cv2c-ps-hero-img" />
              <span className="lkdv-cv2c-ps-badge is-right">{singleHeroBadge}</span>
              <button
                type="button"
                className="lkdv-cv2c-ps-zoom-btn"
                aria-label={zoomed ? 'Réduire la photo' : 'Zoomer sur la photo'}
                onClick={() => setZoomed((z) => !z)}
              >
                {zoomed ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
              </button>
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
            {(
              [
                {
                  id: 'achat',
                  label: 'Acheter neuf',
                  sub: product.priceLabel && product.source === 'achat' ? product.priceLabel : 'Boutique LKDV',
                  Icon: ShoppingBag,
                },
                {
                  id: 'location',
                  label: 'Louer',
                  sub: product.priceLabel && product.source === 'location' ? product.priceLabel : 'Pour la durée du trip',
                  Icon: Calendar,
                },
                {
                  id: 'occasion',
                  label: 'Occasion',
                  sub: product.priceLabel && product.source === 'occasion' ? product.priceLabel : 'Seconde main vérifiée',
                  Icon: Repeat,
                },
                {
                  id: 'pret',
                  label: 'Emprunter (Prêt)',
                  sub: 'Entre voyageurs & clubs',
                  Icon: Handshake,
                },
              ] as const
            ).map(({ id, label, sub, Icon }) => (
              <Link
                key={id}
                href={`/explorer?q=${encodeURIComponent(product.name)}&mode=${id}`}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  borderRadius: 12,
                  background: '#f8faf8',
                  border: '1px solid rgba(23, 64, 44, 0.1)',
                  textDecoration: 'none',
                  color: '#172b24',
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
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <b style={{ fontSize: '0.78rem', lineHeight: 1.2 }}>{label}</b>
                  <small
                    style={{
                      fontSize: '0.68rem',
                      color: '#56665d',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sub}
                  </small>
                </span>
              </Link>
            ))}
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
