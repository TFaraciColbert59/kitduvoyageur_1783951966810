'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import WeightGauge from '@/components/WeightGauge';
import { createClient } from '@/lib/supabase/client';
import { saveCart, getCart } from '@/lib/cart';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  listing_id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  activity: string[];
  weight_g: number;
  price_eur: number;
  stock: number;
  image: string;
  image_alt: string;
  badge?: string;
  listing_type: ListingType;
}

type ListingType = 'tous' | 'neuf' | 'kit' | 'occasion' | 'enchere' | 'location';
type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'weight-asc' | 'weight-desc';

const LISTING_TYPES: { key: ListingType; label: string; icon: string; color: string }[] = [
  { key: 'tous', label: 'Tout', icon: 'ArchiveBoxIcon', color: 'text-foreground' },
  { key: 'neuf', label: 'Neuf', icon: 'SparklesIcon', color: 'text-emerald-400' },
  { key: 'kit', label: 'Kit assemblé', icon: 'CubeIcon', color: 'text-blue-400' },
  { key: 'occasion', label: 'Occasion', icon: 'TagIcon', color: 'text-yellow-400' },
  { key: 'enchere', label: 'Enchère', icon: 'BoltIcon', color: 'text-orange-400' },
  { key: 'location', label: 'Location', icon: 'KeyIcon', color: 'text-purple-400' },
];

const TYPE_BADGE: Record<ListingType, { label: string; cls: string }> = {
  tous: { label: '', cls: '' },
  neuf: { label: 'Neuf', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  kit: { label: 'Kit', cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  occasion: { label: 'Occasion', cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' },
  enchere: { label: 'Enchère', cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/30' },
  location: { label: 'Location', cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
};

// ── Product Card ───────────────────────────────────────────────────────────────
function ProductCard({
  product,
  listingType,
  onAddToCart,
}: {
  product: Product;
  listingType: ListingType;
  onAddToCart: (id: string) => void;
}) {
  const [added, setAdded] = useState(false);
  const effectiveType = product.listing_type && product.listing_type !== 'tous' ? product.listing_type : listingType;
  const badge = TYPE_BADGE[effectiveType === 'tous' ? 'neuf' : effectiveType];

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdded(true);
    onAddToCart(product.id);
    setTimeout(() => setAdded(false), 2000);
  };

  const actionLabel = () => {
    switch (effectiveType) {
      case 'enchere': return 'Enchérir';
      case 'location': return 'Réserver';
      case 'occasion': return 'Acheter';
      default: return product.stock === 0 ? 'Épuisé' : 'Ajouter';
    }
  };

  return (
    <article className="product-card group" aria-label={`${product.name} — ${product.price_eur} €`}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <AppImage
          src={product.image}
          alt={product.image_alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(28,38,32,0.3) 0%, transparent 50%)' }} />
        {badge.label && (
          <div className="absolute top-3 left-3">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-600 ${badge.cls}`} style={{ fontFamily: 'var(--font-mono)' }}>
              {badge.label}
            </span>
          </div>
        )}
        {product.badge && (
          <div className="absolute top-3 right-3">
            <span className="tag-badge" style={{ background: 'var(--primary)', color: 'white' }}>{product.badge}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider truncate" style={{ fontFamily: 'var(--font-mono)' }}>
              {product.brand}
            </p>
            <h3 className="font-display font-700 text-foreground text-sm leading-tight mt-0.5 line-clamp-2" style={{ fontFamily: 'var(--font-display)' }}>
              {product.name}
            </h3>
          </div>
        </div>
        <span className="tag-badge tag-activity text-[10px] mt-2 mb-3 inline-block">{product.category}</span>
        <div className="mb-3">
          <WeightGauge weightG={product.weight_g} maxG={2000} size="sm" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-lg font-600 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
            {product.price_eur} €
          </span>
          <button
            onClick={handleAdd}
            disabled={effectiveType === 'neuf' && product.stock === 0}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 transition-all duration-200 min-h-[36px] ${
              added
                ? 'bg-secondary text-white'
                : effectiveType === 'neuf'&& product.stock === 0 ?'bg-muted text-muted-foreground cursor-not-allowed' :'bg-primary text-white hover:bg-primary/90'
            }`}
            aria-label={added ? 'Ajouté' : actionLabel()}
          >
            <Icon name={added ? 'CheckIcon' : 'PlusIcon'} size={14} variant="outline" />
            {added ? 'Ajouté' : actionLabel()}
          </button>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="topo-card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[4/3]" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="flex justify-between items-center">
          <div className="skeleton h-5 w-16 rounded" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ShopClient() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ListingType>('tous');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [activeActivity, setActiveActivity] = useState('Toutes');
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState(600);
  const [maxWeight, setMaxWeight] = useState(2000);
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const supabase = useMemo(() => createClient(), []);

  // Sync type from URL param
  useEffect(() => {
    const typeParam = searchParams.get('type') as ListingType | null;
    if (typeParam && LISTING_TYPES.some((t) => t.key === typeParam)) {
      setActiveType(typeParam);
    }
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Query listings joined with products to get listing_type per product
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select(`
          id,
          listing_type,
          prix_cents,
          statut,
          produit_id,
          products (
            id,
            slug,
            name,
            brand,
            category,
            activity,
            weight_g,
            price_eur,
            stock,
            image,
            image_alt,
            badge,
            featured,
            created_at
          )
        `)
        .eq('statut', 'actif')
        .order('created_at', { ascending: false });

      if (listingsError) throw listingsError;

      // Flatten listings+products into Product[] with listing_type
      const mapped: Product[] = (listingsData ?? [])
        .filter((l) => l.products)
        .map((l) => {
          const p = (l.products as unknown) as {
            id: string; slug: string; name: string; brand: string; category: string;
            activity: string[]; weight_g: number; price_eur: number; stock: number;
            image: string; image_alt: string; badge?: string; featured?: boolean; created_at?: string;
          };
          return {
            id: p.id,
            listing_id: l.id,
            slug: p.slug,
            name: p.name,
            brand: p.brand,
            category: p.category,
            activity: p.activity ?? [],
            weight_g: p.weight_g ?? 0,
            price_eur: l.prix_cents ? l.prix_cents / 100 : Number(p.price_eur),
            stock: p.stock ?? 0,
            image: p.image ?? '',
            image_alt: p.image_alt ?? '',
            badge: p.badge ?? '',
            listing_type: (l.listing_type as ListingType) ?? 'neuf',
          };
        });

      // If no listings data, fall back to products table directly (all treated as 'neuf')
      if (mapped.length === 0) {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });
        if (productsError) throw productsError;
        const fallback: Product[] = (productsData ?? []).map((p) => ({
          ...p,
          listing_id: p.id,
          listing_type: 'neuf' as ListingType,
        }));
        setProducts(fallback);
      } else {
        setProducts(mapped);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    setCartCount(getCart().reduce((s, i) => s + i.quantity, 0));
  }, []);

  const allCategories = useMemo(() => ['Tous', ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const allActivities = useMemo(() => ['Toutes', ...Array.from(new Set(products.flatMap((p) => p.activity ?? [])))], [products]);
  const allBrands = useMemo(() => Array.from(new Set(products.map((p) => p.brand))), [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      // ── FIX: apply listing_type filter ──────────────────────────────────────
      const typeOk = activeType === 'tous' || p.listing_type === activeType;
      const catOk = activeCategory === 'Tous' || p.category === activeCategory;
      const actOk = activeActivity === 'Toutes' || (p.activity ?? []).includes(activeActivity);
      const brandOk = selectedBrands.size === 0 || selectedBrands.has(p.brand);
      const priceOk = p.price_eur <= maxPrice;
      const weightOk = p.weight_g <= maxWeight;
      const searchOk = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      return typeOk && catOk && actOk && brandOk && priceOk && weightOk && searchOk;
    });

    switch (sortBy) {
      case 'price-asc': list = list.sort((a, b) => a.price_eur - b.price_eur); break;
      case 'price-desc': list = list.sort((a, b) => b.price_eur - a.price_eur); break;
      case 'weight-asc': list = list.sort((a, b) => a.weight_g - b.weight_g); break;
      case 'weight-desc': list = list.sort((a, b) => b.weight_g - a.weight_g); break;
    }
    return list;
  }, [products, activeType, activeCategory, activeActivity, selectedBrands, maxPrice, maxWeight, searchQuery, sortBy]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const existing = getCart();
    const idx = existing.findIndex((i) => i.id === productId);
    if (idx >= 0) existing[idx].quantity += 1;
    else existing.push({
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      category: product.category,
      priceEur: product.price_eur,
      weightG: product.weight_g,
      quantity: 1,
      image: product.image,
      imageAlt: product.image_alt,
    });
    saveCart(existing);
    setCartCount(existing.reduce((s, i) => s + i.quantity, 0));
    setToast(`${product.name} ajouté au panier`);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-secondary text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          ✓ {toast}
        </div>
      )}

      {/* Hero */}
      <section className="bg-dark-bg py-14 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E7E3D6' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="max-w-7xl mx-auto relative">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-1 h-12 bg-primary flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                SHOP — {products.length} PRODUITS
              </p>
              <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                ÉQUIPEMENT OUTDOOR
              </h1>
              <p className="mt-3 text-white/60 text-lg max-w-2xl">
                Neuf, kits assemblés, occasion vérifiée, enchères et location — tout l&apos;équipement en un seul endroit.
              </p>
            </div>
            <Link href="/panier" className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Icon name="ShoppingCartIcon" size={20} className="text-white" />
              </div>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-white text-[10px] font-700 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          {/* Search */}
          <div className="relative max-w-xl mb-6">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Rechercher un produit, une marque..."
              className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-primary/60"
            />
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap gap-2">
            {LISTING_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveType(t.key); setPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-600 transition-all border ${
                  activeType === t.key
                    ? 'bg-primary text-white border-primary' :'bg-white/8 text-white/70 border-white/15 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Icon name={t.icon} size={14} variant="outline" className={activeType === t.key ? 'text-white' : t.color} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside className={`${filterOpen ? 'block' : 'hidden'} lg:block w-64 flex-shrink-0`}>
            <div className="sticky top-24 space-y-6">
              {/* Categories */}
              <div>
                <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Catégorie</h3>
                <div className="space-y-1">
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setActiveCategory(cat); setPage(1); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${activeCategory === cat ? 'bg-primary/10 text-primary font-600' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activities */}
              <div>
                <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Activité</h3>
                <div className="space-y-1">
                  {allActivities.map((act) => (
                    <button
                      key={act}
                      onClick={() => { setActiveActivity(act); setPage(1); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${activeActivity === act ? 'bg-primary/10 text-primary font-600' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brands */}
              <div>
                <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Marque</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {allBrands.map((brand) => (
                    <label key={brand} className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedBrands.has(brand)}
                        onChange={() => toggleBrand(brand)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-muted-foreground">{brand}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Prix max : {maxPrice} €</h3>
                <input type="range" min={10} max={600} value={maxPrice} onChange={(e) => { setMaxPrice(Number(e.target.value)); setPage(1); }} className="w-full accent-primary" />
              </div>

              {/* Weight */}
              <div>
                <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Poids max : {maxWeight}g</h3>
                <input type="range" min={50} max={2000} value={maxWeight} onChange={(e) => { setMaxWeight(Number(e.target.value)); setPage(1); }} className="w-full accent-primary" />
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="FunnelIcon" size={14} />
                  Filtres
                </button>
                <p className="text-sm text-muted-foreground">
                  <span className="font-600 text-foreground">{filtered.length}</span> produits
                </p>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="relevance">Pertinence</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
                <option value="weight-asc">Poids croissant</option>
                <option value="weight-desc">Poids décroissant</option>
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Icon name="MagnifyingGlassIcon" size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-display font-700 text-foreground mb-1">Aucun produit trouvé</p>
                <p className="text-sm text-muted-foreground">Essayez d&apos;autres filtres ou une autre recherche</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {paginated.map((product) => (
                    <Link key={product.listing_id} href={`/produit/${product.slug}`}>
                      <ProductCard product={product} listingType={activeType} onAddToCart={handleAddToCart} />
                    </Link>
                  ))}
                </div>
                {hasMore && (
                  <div className="text-center mt-10">
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="btn-secondary px-8 py-3"
                    >
                      Charger plus de produits
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
