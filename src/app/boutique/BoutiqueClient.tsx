'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { addToCart } from '@/lib/cart';
import NewFooterSection from '@/app/components/home/NewFooterSection';

// ─── Types ────────────────────────────────────────────────────────────────────

type TransactionType = 'achat' | 'location' | 'occasion' | 'enchere';
type SortOption = 'pertinence' | 'prix_asc' | 'prix_desc' | 'poids_asc' | 'note_desc';

interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  weight_g: number;
  price_eur: number;
  image: string;
  image_alt: string;
  rating: number;
  review_count: number;
  available: boolean;
  transaction_type: TransactionType;
  price_per_day?: number;
  original_price?: number;
  condition?: string;
  starting_bid?: number;
  ends_at?: string;
  savings?: number;
  score_kdv?: number;
}

interface OptimizedKit {
  product: ShopProduct;
  chosen_type: TransactionType;
  chosen_price: number;
  savings: number;
}

const CATEGORIES_BOUTIQUE = ['Tout', 'Portage', 'Couchage', 'Vêtements', 'Éclairage', 'Hydratation'];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'pertinence', label: 'Coup de cœur' },
  { value: 'prix_asc', label: 'Prix croissant' },
  { value: 'prix_desc', label: 'Prix décroissant' },
  { value: 'poids_asc', label: 'Plus léger' },
  { value: 'note_desc', label: 'Mieux noté' },
];

const PAGE_SIZE = 6;

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PRODUCTS: ShopProduct[] = [
  {
    id: '1', slug: 'sac-45l-toile-ciree', name: 'Le sac 45 L', brand: 'Le Kit du Voyageur', category: 'Portage',
    weight_g: 1200, price_eur: 340, original_price: 395,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=85',
    image_alt: 'Sac à dos 45L en toile cirée verte, trois compartiments, bandoulière ventrale',
    rating: 4.9, review_count: 47, available: true, transaction_type: 'achat', savings: 55,
  },
  {
    id: '2', slug: 'duvet-plumes-trois-saisons', name: 'Duvet en plumes', brand: 'Le Kit du Voyageur', category: 'Couchage',
    weight_g: 680, price_eur: 248,
    image: 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80',
    image_alt: 'Sac de couchage en duvet vert foncé compressé sur tissu beige',
    rating: 4.8, review_count: 31, available: true, transaction_type: 'achat', savings: 0,
  },
  {
    id: '3', slug: 'tente-legere-deux-places', name: 'Tente légère', brand: 'Le Kit du Voyageur', category: 'Couchage',
    weight_g: 1100, price_eur: 418,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    image_alt: 'Tente légère orange compressée sur tissu beige, deux places',
    rating: 4.7, review_count: 28, available: true, transaction_type: 'achat', savings: 0,
  },
  {
    id: '4', slug: 'gourde-titane-1l', name: 'Gourde titane', brand: 'Le Kit du Voyageur', category: 'Hydratation',
    weight_g: 95, price_eur: 68,
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
    image_alt: 'Gourde en titane vert sauge posée sur tissu beige',
    rating: 4.9, review_count: 62, available: true, transaction_type: 'achat', savings: 0,
  },
  {
    id: '5', slug: 'veste-3-couches', name: 'Veste 3 couches', brand: 'Le Kit du Voyageur', category: 'Vêtements',
    weight_g: 485, price_eur: 312,
    image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80',
    image_alt: 'Veste imperméable verte pliée sur tissu beige, toutes saisons',
    rating: 4.8, review_count: 19, available: true, transaction_type: 'achat', savings: 0,
  },
  {
    id: '6', slug: 'lampe-frontale-240-lumens', name: 'Lampe frontale', brand: 'Le Kit du Voyageur', category: 'Éclairage',
    weight_g: 91, price_eur: 84,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    image_alt: 'Lampe frontale noire 240 lumens posée sur tissu beige',
    rating: 4.6, review_count: 44, available: true, transaction_type: 'achat', savings: 0,
  },
];

// ─── Editorial Product Card ───────────────────────────────────────────────────

function EditorialProductCard({ product }: { product: ShopProduct }) {
  const [wished, setWished] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: product.id, slug: product.slug, name: product.name, brand: product.brand,
      category: product.category, priceEur: product.price_eur, weightG: product.weight_g,
      image: product.image, imageAlt: product.image_alt,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const categoryLabel = () => {
    const map: Record<string, string> = {
      'Portage': 'PORTAGE', 'Couchage': 'COUCHAGE', 'Vêtements': 'VÊTEMENTS',
      'Éclairage': 'ÉCLAIRAGE', 'Hydratation': 'HYDRATATION',
    };
    return map[product.category] || product.category.toUpperCase();
  };

  return (
    <article className="group" aria-label={`${product.name} — ${product.price_eur} €`}>
      <Link href={`/produit/${product.slug}`} className="block">
        {/* Image */}
        <div
          className="relative overflow-hidden"
          style={{ borderRadius: '12px', aspectRatio: '4/3', background: '#F5F2EC' }}
        >
          <AppImage
            src={product.image}
            alt={product.image_alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {/* Wishlist button */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWished((w) => !w); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
            aria-label={wished ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={wished ? '#1C2620' : 'none'} stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          {/* Nouveauté badge */}
          {product.id === '4' && (
            <div className="absolute top-3 left-3">
              <span
                style={{
                  background: '#1C2620',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.12em',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                }}
              >
                Nouveauté
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="pt-3">
        <p
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#9BA89F',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: '3px',
          }}
        >
          {categoryLabel()}
        </p>
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/produit/${product.slug}`}>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '15px',
                  color: '#1C2620',
                  lineHeight: '1.25',
                  marginBottom: '1px',
                }}
              >
                {product.name}{' '}
                {product.id === '3' && (
                  <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#6B8A7A' }}>deux places.</em>
                )}
                {product.id === '6' && (
                  <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#6B8A7A' }}>240 lumens.</em>
                )}
              </h3>
            </Link>
            {(product.id === '2') && (
              <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#9BA89F', fontFamily: 'var(--font-sans)' }}>trois saisons.</p>
            )}
            {(product.id === '5') && (
              <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#9BA89F', fontFamily: 'var(--font-sans)' }}>toutes saisons.</p>
            )}
          </div>
          {/* Quick add */}
          <button
            onClick={handleAdd}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{
              background: added ? '#1C2620' : 'rgba(28,38,32,0.08)',
              border: '1px solid rgba(28,38,32,0.12)',
            }}
            aria-label={added ? 'Ajouté au panier' : 'Ajouter au panier'}
          >
            {added ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '15px',
            color: '#1C2620',
            marginTop: '6px',
          }}
        >
          {product.price_eur} €
        </p>
      </div>
    </article>
  );
}

// ─── Configurator CTA Card ────────────────────────────────────────────────────

function ConfiguratorCard() {
  return (
    <Link href="/ai-configurator" className="group block h-full">
      <div
        className="h-full flex flex-col items-center justify-center transition-all duration-300 group-hover:opacity-90"
        style={{
          background: '#1C2620',
          borderRadius: '12px',
          minHeight: '260px',
          padding: '32px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 text-center">
          {/* Lock icon */}
          <div
            className="mx-auto mb-5 flex items-center justify-center"
            style={{
              width: '48px',
              height: '48px',
              border: '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Assistant
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '16px',
              color: '#FFFFFF',
              lineHeight: '1.3',
              marginBottom: '6px',
            }}
          >
            Composer votre sac
          </p>
          <p
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-sans)',
              lineHeight: '1.5',
              marginBottom: '20px',
            }}
          >
            4 questions · résultat sur mesure
          </p>
          <div
            className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 group-hover:scale-110"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-2 mt-12" aria-label="Pagination">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ border: '1px solid rgba(28,38,32,0.15)', color: '#1C2620' }}
        aria-label="Page précédente"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="w-9 h-9 rounded-full text-sm transition-all"
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: p === page ? 700 : 400,
            background: p === page ? '#1C2620' : 'transparent',
            color: p === page ? '#FFFFFF' : '#1C2620',
            border: p === page ? '1px solid #1C2620' : '1px solid rgba(28,38,32,0.15)',
          }}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ border: '1px solid rgba(28,38,32,0.15)', color: '#1C2620' }}
        aria-label="Page suivante"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BoutiqueClient() {
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [sortBy, setSortBy] = useState<SortOption>('pertinence');
  const [products, setProducts] = useState<ShopProduct[]>(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [featuredAdded, setFeaturedAdded] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, sortBy]);

  // Try to load from Supabase, fall back to mock
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        const fetchPromise = supabase
          .from('shop_products')
          .select('id, slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, price_per_day, original_price, condition, starting_bid, ends_at, savings, score_kdv')
          .order('score_kdv', { ascending: false })
          .limit(200);

        const result = await Promise.race([fetchPromise, timeoutPromise]);
        if (result && 'data' in result && result.data && result.data.length > 0) {
          setProducts(result.data as ShopProduct[]);
        }
      } catch {
        // keep mock data
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Featured product = first product (highest score_kdv)
  const featuredProduct = products[0];

  // Filtered + sorted products (excluding featured)
  const filtered = useMemo(() => {
    let list = products.slice(1).filter((p) => {
      const catMap: Record<string, string[]> = {
        'Portage': ['Sacs à dos', 'Portage'],
        'Couchage': ['Couchage', 'Tentes'],
        'Vêtements': ['Vêtements', 'Chaussures'],
        'Éclairage': ['Éclairage'],
        'Hydratation': ['Eau', 'Hydratation'],
      };
      if (activeCategory === 'Tout') return true;
      const mapped = catMap[activeCategory] || [activeCategory];
      return mapped.includes(p.category);
    });

    switch (sortBy) {
      case 'prix_asc': list = [...list].sort((a, b) => a.price_eur - b.price_eur); break;
      case 'prix_desc': list = [...list].sort((a, b) => b.price_eur - a.price_eur); break;
      case 'poids_asc': list = [...list].sort((a, b) => a.weight_g - b.weight_g); break;
      case 'note_desc': list = [...list].sort((a, b) => b.rating - a.rating); break;
      default: break;
    }
    return list;
  }, [products, activeCategory, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const handleFeaturedAdd = useCallback(() => {
    if (!featuredProduct) return;
    addToCart({
      id: featuredProduct.id, slug: featuredProduct.slug, name: featuredProduct.name,
      brand: featuredProduct.brand, category: featuredProduct.category,
      priceEur: featuredProduct.price_eur, weightG: featuredProduct.weight_g,
      image: featuredProduct.image, imageAlt: featuredProduct.image_alt,
    });
    setFeaturedAdded(true);
    setTimeout(() => setFeaturedAdded(false), 2500);
  }, [featuredProduct]);

  const totalCount = products.length;

  return (
    <div className="min-h-screen" style={{ background: '#F7F4EE', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ══════════════════════════════════════════════
          HERO — dark green editorial header
      ══════════════════════════════════════════════ */}
      <section
        style={{ background: '#F7F4EE', paddingTop: '80px' }}
        aria-labelledby="boutique-title"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-10 pb-6 sm:pt-14 sm:pb-8">
          {/* Breadcrumb */}
          <p
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#9BA89F',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            Boutique · Édition Automne 2026
          </p>

          {/* Headline + stats */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-12 mb-8 sm:mb-10">
            <div className="flex-1">
              <h1
                id="boutique-title"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                  lineHeight: '1.0',
                  letterSpacing: '-0.04em',
                  color: '#1C2620',
                  marginBottom: '4px',
                }}
              >
                Six objets,
              </h1>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                  lineHeight: '1.0',
                  letterSpacing: '-0.04em',
                  color: '#1C2620',
                  fontStyle: 'italic',
                  marginBottom: '20px',
                }}
                aria-hidden="true"
              >
                rien de plus.
              </h1>
              <p
                style={{
                  fontSize: 'clamp(13px, 1.5vw, 15px)',
                  color: '#6B8A7A',
                  lineHeight: '1.65',
                  maxWidth: '420px',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Testés six semaines minimum sur le terrain. Ce qui reste, on le garde. Ce qui casse retourne d&apos;où ça vient.
              </p>
            </div>

            {/* Stats */}
            <div className="flex-shrink-0 text-right">
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                  color: '#1C2620',
                  lineHeight: '1',
                  letterSpacing: '-0.03em',
                }}
              >
                {totalCount} pièces
              </p>
              <p
                style={{
                  fontSize: '12px',
                  color: '#9BA89F',
                  fontFamily: 'var(--font-sans)',
                  marginTop: '4px',
                }}
              >
                Testés en Chartreuse, Vercors et Écrins
                <br />par 47 voyageurs partenaires
              </p>
            </div>
          </div>

          {/* Category filters + sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Category pills */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              {CATEGORIES_BOUTIQUE.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex-shrink-0 transition-all duration-200"
                  style={{
                    padding: '7px 16px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: activeCategory === cat ? 600 : 400,
                    background: activeCategory === cat ? '#1C2620' : 'transparent',
                    color: activeCategory === cat ? '#FFFFFF' : '#6B8A7A',
                    border: activeCategory === cat ? '1px solid #1C2620' : '1px solid rgba(28,38,32,0.18)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: '#9BA89F',
                  letterSpacing: '0.08em',
                }}
              >
                Trier par
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="focus:outline-none cursor-pointer"
                style={{
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  color: '#1C2620',
                  background: 'transparent',
                  border: 'none',
                  fontWeight: 500,
                  padding: '4px 0',
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9BA89F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FEATURED PRODUCT — dark green hero card
      ══════════════════════════════════════════════ */}
      {featuredProduct && (
        <section aria-label="Produit vedette">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pb-6">
            <div
              className="overflow-hidden"
              style={{
                background: '#1C2620',
                borderRadius: '20px',
              }}
            >
              <div className="flex flex-col lg:flex-row">
                {/* Product image */}
                <div
                  className="relative flex-shrink-0"
                  style={{
                    width: '100%',
                    maxWidth: '420px',
                    aspectRatio: '4/3',
                    background: '#F5F2EC',
                  }}
                >
                  <AppImage
                    src={featuredProduct.image}
                    alt={featuredProduct.image_alt}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 420px"
                    className="object-cover"
                  />
                </div>

                {/* Product info */}
                <div
                  className="flex-1 flex flex-col justify-center"
                  style={{ padding: 'clamp(28px, 5vw, 56px)' }}
                >
                  {/* Tags */}
                  <div className="flex items-center gap-2 mb-5">
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        color: 'rgba(255,255,255,0.5)',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '3px 10px',
                        borderRadius: '999px',
                      }}
                    >
                      ✦ Nouveauté
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        color: 'rgba(255,255,255,0.5)',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '3px 10px',
                        borderRadius: '999px',
                      }}
                    >
                      Le sac essentiel
                    </span>
                  </div>

                  {/* Name */}
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 'clamp(2rem, 4vw, 3.2rem)',
                      lineHeight: '1.05',
                      letterSpacing: '-0.03em',
                      color: '#FFFFFF',
                      marginBottom: '4px',
                    }}
                  >
                    {featuredProduct.name}
                  </h2>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 400,
                      fontStyle: 'italic',
                      fontSize: 'clamp(1.5rem, 3vw, 2.4rem)',
                      color: 'rgba(255,255,255,0.45)',
                      lineHeight: '1.1',
                      marginBottom: '20px',
                    }}
                  >
                    toile cirée.
                  </p>

                  {/* Description */}
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.55)',
                      lineHeight: '1.7',
                      maxWidth: '380px',
                      fontFamily: 'var(--font-sans)',
                      marginBottom: '24px',
                    }}
                  >
                    Trois compartiments, une bandoulière ventrale, un point d&apos;accroche pour tapis de sol, fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.
                  </p>

                  {/* Price */}
                  <div className="flex items-center gap-3 mb-8">
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
                        color: '#FFFFFF',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {featuredProduct.price_eur} €
                    </span>
                    {featuredProduct.original_price && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '14px',
                          color: 'rgba(255,255,255,0.35)',
                          textDecoration: 'line-through',
                        }}
                      >
                        {featuredProduct.original_price} €
                      </span>
                    )}
                    {featuredProduct.savings && featuredProduct.savings > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          background: '#4A6355',
                          color: '#FFFFFF',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontWeight: 700,
                        }}
                      >
                        −{Math.round((featuredProduct.savings / (featuredProduct.original_price || featuredProduct.price_eur)) * 100)}%
                      </span>
                    )}
                  </div>

                  {/* CTAs */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/produit/${featuredProduct.slug}`}
                      className="inline-flex items-center gap-2 font-semibold transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: '#FFFFFF',
                        color: '#1C2620',
                        borderRadius: '12px',
                        padding: '13px 22px',
                        fontSize: '14px',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Découvrir le sac
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <button
                      onClick={handleFeaturedAdd}
                      className="inline-flex items-center gap-2 font-semibold transition-all duration-200 hover:bg-white/10"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: '#FFFFFF',
                        borderRadius: '12px',
                        padding: '13px 22px',
                        fontSize: '14px',
                        fontFamily: 'var(--font-sans)',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {featuredAdded ? '✓ Ajouté' : 'Ajouter au panier'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          PRODUCT GRID — "Le reste du kit."
      ══════════════════════════════════════════════ */}
      <section
        style={{ background: '#F7F4EE', paddingTop: '48px', paddingBottom: '64px' }}
        aria-labelledby="grid-title"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
          {/* Section header */}
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <h2
              id="grid-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                color: '#1C2620',
                letterSpacing: '-0.03em',
                lineHeight: '1.1',
              }}
            >
              Le <em style={{ fontStyle: 'italic', fontWeight: 400 }}>reste</em> du kit.
            </h2>
            <Link
              href="/catalogue"
              className="flex items-center gap-1.5 transition-all duration-200 hover:gap-2.5"
              style={{
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                color: '#6B8A7A',
                fontWeight: 500,
              }}
            >
              Voir tout · {filtered.length + 1} pièces
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} aria-hidden="true">
                  <div
                    className="animate-pulse"
                    style={{ borderRadius: '12px', aspectRatio: '4/3', background: '#E8E4DC' }}
                  />
                  <div className="pt-3 space-y-2">
                    <div className="h-2.5 w-16 rounded" style={{ background: '#E8E4DC' }} />
                    <div className="h-4 w-3/4 rounded" style={{ background: '#E8E4DC' }} />
                    <div className="h-4 w-12 rounded" style={{ background: '#E8E4DC' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p style={{ fontSize: '40px', marginBottom: '12px' }}>🎒</p>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '20px',
                  color: '#1C2620',
                  marginBottom: '8px',
                }}
              >
                Aucun équipement dans cette catégorie
              </h3>
              <p style={{ color: '#9BA89F', fontSize: '14px', marginBottom: '20px' }}>
                Essayez une autre catégorie.
              </p>
              <button
                onClick={() => setActiveCategory('Tout')}
                className="transition-all duration-200 hover:opacity-80"
                style={{
                  background: '#1C2620',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                }}
              >
                Voir tout
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {paginated.map((product) => (
                  <EditorialProductCard key={product.id} product={product} />
                ))}
                {/* Configurator CTA card — always last in first page */}
                {currentPage === 1 && (
                  <ConfiguratorCard />
                )}
              </div>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onChange={(p) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          METHOD SECTION — "Six semaines en Chartreuse."
      ══════════════════════════════════════════════ */}
      <section
        style={{ background: '#F7F4EE', paddingBottom: '80px' }}
        aria-labelledby="method-title"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
          <div
            className="overflow-hidden"
            style={{ borderRadius: '20px', background: '#FFFFFF' }}
          >
            <div className="flex flex-col lg:flex-row">
              {/* Image */}
              <div
                className="relative flex-shrink-0"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  minHeight: '320px',
                  background: '#E8E4DC',
                }}
              >
                <AppImage
                  src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80"
                  alt="Atelier de réparation d'équipement outdoor en Chartreuse, outils accrochés au mur en bois"
                  fill
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover"
                />
              </div>

              {/* Text */}
              <div
                className="flex-1 flex flex-col justify-center"
                style={{ padding: 'clamp(32px, 5vw, 64px)' }}
              >
                <p
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: '#9BA89F',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    marginBottom: '16px',
                  }}
                >
                  Notre méthode
                </p>
                <h2
                  id="method-title"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 'clamp(1.8rem, 3.5vw, 3rem)',
                    lineHeight: '1.1',
                    letterSpacing: '-0.03em',
                    color: '#1C2620',
                    marginBottom: '20px',
                  }}
                >
                  Six semaines
                  <br />
                  en <em style={{ fontStyle: 'italic', fontWeight: 400 }}>Chartreuse.</em>
                </h2>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#6B8A7A',
                    lineHeight: '1.75',
                    maxWidth: '380px',
                    fontFamily: 'var(--font-sans)',
                    marginBottom: '28px',
                  }}
                >
                  Chaque objet passe six semaines dans le sac de trois testeurs. On note ce qui casse, ce qui use, ce qui étonne. Puis on décide.
                </p>
                <Link
                  href="/guides"
                  className="inline-flex items-center gap-2 font-semibold transition-all duration-200 hover:-translate-y-0.5 self-start"
                  style={{
                    background: '#1C2620',
                    color: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '12px 22px',
                    fontSize: '14px',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Lire notre méthode
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER — identical to homepage
      ══════════════════════════════════════════════ */}
      <NewFooterSection />
    </div>
  );
}
