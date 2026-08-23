'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface ProductCardProps {
  product: {
    id: string;
    slug?: string;
    name: string;
    brand?: string | null;
    category?: string | null;
    price_eur?: number | null;
    weight_g?: number | null;
    image?: string | null;
    image_alt?: string | null;
    condition?: string | null;
    quantity?: number;
    score_kdv?: number;
    essentiality?: string;
    notes?: string | null;
  };
  context?: 'shop' | 'inventory' | 'configurator' | 'kit' | 'trip' | 'compact';
  viewMode?: 'grid' | 'list';
  isOwned?: boolean;
  isInCart?: boolean;
  cartQuantity?: number;
  onAddToCart?: () => void;
  onRemoveFromCart?: () => void;
  onAddToKit?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRemoveFromEquipment?: () => void;
  className?: string;
}

const CONDITION_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  neuf: { label: 'Neuf', bg: 'bg-[#E1EBDD]', text: 'text-[#17402C]' },
  excellent: { label: 'Excellent', bg: 'bg-[#E1EBDD]', text: 'text-[#17402C]' },
  bon: { label: 'Bon état', bg: 'bg-[#F4F1EB]', text: 'text-[#0B1F17]' },
  moyen: { label: 'État moyen', bg: 'bg-amber-100', text: 'text-amber-900' },
  usé: { label: 'Usé', bg: 'bg-amber-100', text: 'text-amber-900' },
  à_réparer: { label: 'À réparer', bg: 'bg-amber-200', text: 'text-amber-950' },
  à_remplacer: { label: 'À remplacer', bg: 'bg-rose-100', text: 'text-rose-900' },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Sacs à dos': '🎒',
  'Sac à dos': '🎒',
  'Tentes': '⛺',
  'Bivouac': '🏕️',
  'Couchage': '🛏️',
  'Vêtements': '🧥',
  'Chaussures': '🥾',
  'Cuisine': '🍳',
  'Navigation': '🧭',
  'Sécurité': '🩹',
  'Éclairage': '🔦',
  'Hydratation': '💧',
  'Eau': '💧',
  'Hygiène': '🧼',
  'Électronique': '🔋',
  'Accessoires': '🧰',
};

function getCategoryIcon(cat?: string | null): string {
  if (!cat) return '🎒';
  return CATEGORY_ICONS[cat] || '🎒';
}

function formatWeight(g?: number | null): string {
  if (g == null || g <= 0) return '—';
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function ProductCard({
  product,
  context = 'shop',
  viewMode = 'grid',
  isOwned = false,
  isInCart = false,
  cartQuantity = 0,
  onAddToCart,
  onRemoveFromCart,
  onAddToKit,
  onEdit,
  onDelete,
  onRemoveFromEquipment,
  className = '',
}: ProductCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const handleDelete = onDelete || onRemoveFromEquipment;

  const productUrl = product.slug ? `/produit/${product.slug}` : `/explorer`;
  const cond = product.condition ? CONDITION_BADGES[product.condition] || null : null;

  /* ──────────────────────────────────────────────────────────────────────────
     VUE LISTE (Horizontale)
     ────────────────────────────────────────────────────────────────────────── */
  if (viewMode === 'list') {
    return (
      <div
        className={`group bg-white rounded-2xl p-3 sm:p-4 border transition-all duration-200 shadow-2xs hover:shadow-md flex items-center justify-between gap-3 sm:gap-4 font-sans ${
          isInCart
            ? 'border-[#17402C] bg-[#FBFAF6] ring-1 ring-[#17402C]/20'
            : isOwned
            ? 'border-[#A9C6B0] bg-[#FBFAF6]'
            : 'border-black/[0.06] hover:border-[#17402C]/30'
        } ${className}`}
      >
        <Link href={productUrl} className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 text-left">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden relative shrink-0 border border-black/[0.04] bg-[#F4F1EB]">
            <AppImage
              src={product.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80'}
              alt={product.image_alt || product.name}
              fill
              sizes="(max-width: 640px) 64px, 80px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#5C6B63]">
                {getCategoryIcon(product.category)} {product.brand || product.category || 'Outdoor'}
              </span>
              {cond && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${cond.bg} ${cond.text}`}>
                  {cond.label}
                </span>
              )}
              {isOwned && context !== 'inventory' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E1EBDD] text-[#17402C]">
                  ✓ Déjà possédé
                </span>
              )}
            </div>

            <h4 className="font-bold text-sm text-[#0B1F17] truncate leading-tight group-hover:text-[#17402C] transition-colors">
              {product.name}
            </h4>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-[#5C6B63] font-mono">
              {product.price_eur != null && (
                <span className="font-bold text-[#17402C]">{product.price_eur} €</span>
              )}
              <span>·</span>
              <span>{formatWeight(product.weight_g)}</span>
              {product.quantity && product.quantity > 1 && (
                <>
                  <span>·</span>
                  <span className="font-bold text-[#0B1F17]">Qté : {product.quantity}</span>
                </>
              )}
            </div>
          </div>
        </Link>

        {/* Actions Liste */}
        <div className="flex items-center gap-2 shrink-0">
          {context === 'inventory' ? (
            <>
              {onEdit && (
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    onEdit();
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F4F1EB] text-[#0B1F17] hover:bg-[#EBE7DF] active:scale-95 transition-transform"
                >
                  Modifier
                </button>
              )}
              {handleDelete && (
                <button
                  onClick={() => {
                    triggerHaptic('warning');
                    handleDelete();
                  }}
                  className="p-1.5 rounded-full text-[#5C6B63] hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Supprimer de l'inventaire"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </>
          ) : context === 'configurator' ? (
            onAddToKit && (
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  onAddToKit();
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#17402C] text-white shadow-xs active:scale-95 transition-transform"
              >
                + Ajouter au kit
              </button>
            )
          ) : (
            <div className="flex items-center gap-1.5">
              {onAddToCart && (
                <button
                  onClick={() => {
                    triggerHaptic('selection');
                    onAddToCart();
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 shadow-2xs flex items-center gap-1.5 ${
                    isInCart
                      ? 'bg-[#17402C] text-white ring-2 ring-[#17402C]/30'
                      : 'bg-[#17402C] text-white hover:bg-[#0B1F17]'
                  }`}
                  title={isInCart ? 'Article présent dans votre panier' : 'Ajouter au panier'}
                >
                  <span>{isInCart ? `✓ Panier (${cartQuantity})` : '+ Ajouter au panier'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     VUE GRILLE (Classique & Responsive)
     ────────────────────────────────────────────────────────────────────────── */
  return (
    <div
      className={`group bg-white rounded-2xl overflow-hidden border transition-all duration-300 shadow-2xs hover:shadow-lg flex flex-col justify-between font-sans ${
        isInCart
          ? 'border-[#17402C] ring-2 ring-[#17402C]/20 bg-[#FBFAF6]'
          : isOwned
          ? 'border-[#A9C6B0] ring-1 ring-[#A9C6B0]/30 bg-[#FBFAF6]'
          : 'border-black/[0.06] hover:border-[#17402C]/30'
      } ${className}`}
    >
      {/* Visual Header */}
      <div className="relative aspect-square overflow-hidden bg-[#F4F1EB]">
        <Link href={productUrl} className="block w-full h-full">
          <AppImage
            src={product.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80'}
            alt={product.image_alt || product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
        </Link>

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
          {product.category && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[#0B1F17] shadow-xs truncate max-w-[130px]">
              {getCategoryIcon(product.category)} {product.category}
            </span>
          )}

          {isInCart && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#17402C] text-white shadow-xs ml-auto">
              ✓ Panier ({cartQuantity})
            </span>
          )}
          {!isInCart && isOwned && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E1EBDD] text-[#17402C] shadow-xs ml-auto border border-[#A9C6B0]">
              ✓ Possédé
            </span>
          )}
          {!isInCart && !isOwned && cond && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs ml-auto ${cond.bg} ${cond.text}`}>
              {cond.label}
            </span>
          )}
        </div>

        {/* Bottom Bar overlay: Poids */}
        <div className="absolute bottom-2 left-2 pointer-events-none">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white">
            ⚖️ {formatWeight(product.weight_g)}
          </span>
        </div>
      </div>

      {/* Body Information */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <p className="text-[10px] text-[#5C6B63] font-mono uppercase tracking-wider truncate">
            {product.brand || 'Le Kit du Voyageur'}
          </p>
          <Link href={productUrl} className="block group-hover:text-[#17402C] transition-colors">
            <h3 className="font-bold text-[#0B1F17] text-xs sm:text-sm leading-snug line-clamp-2 mt-0.5">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Price & Primary Action */}
        <div className="pt-2 border-t border-black/[0.04] space-y-2">
          {product.price_eur != null && (
            <div className="flex items-baseline justify-between">
              <span className="text-base sm:text-lg font-bold text-[#17402C] font-sans">
                {product.price_eur} €
              </span>
              {product.score_kdv && (
                <span className="text-[10px] font-mono font-semibold text-[#5C6B63]">
                  Score {product.score_kdv}/100
                </span>
              )}
            </div>
          )}

          {/* Action Unique: Ajouter au panier */}
          {context === 'inventory' ? (
            <div className="flex items-center gap-1.5">
              {onEdit && (
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    onEdit();
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[#F4F1EB] text-[#0B1F17] hover:bg-[#EBE7DF] active:scale-95 transition-transform text-center"
                >
                  Modifier
                </button>
              )}
              {handleDelete && (
                <button
                  onClick={() => {
                    triggerHaptic('warning');
                    handleDelete();
                  }}
                  className="p-2 rounded-xl text-[#5C6B63] hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Supprimer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              )}
            </div>
          ) : context === 'configurator' ? (
            onAddToKit && (
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  onAddToKit();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#0B1F17] shadow-xs active:scale-95 transition-transform"
              >
                + Ajouter au kit
              </button>
            )
          ) : (
            <button
              onClick={() => {
                triggerHaptic('selection');
                if (onAddToCart) {
                  onAddToCart();
                }
              }}
              className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs ${
                isInCart
                  ? 'bg-[#17402C] text-white ring-2 ring-[#17402C]/30'
                  : 'bg-[#17402C] text-white hover:bg-[#0B1F17]'
              }`}
            >
              <span>{isInCart ? `✓ Dans le panier (${cartQuantity})` : '+ Ajouter au panier'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
