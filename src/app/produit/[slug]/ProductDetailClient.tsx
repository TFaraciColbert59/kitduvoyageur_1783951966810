'use client';

import ProductLineageCard from '@/components/kits/ProductLineageCard';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { Metric } from '@/components/ui/Metric';
import { Badge, Button, Card, Chip, IconButton, LoadingState, PageHeader } from '@/components/ui';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { addToCart } from '@/lib/cart';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useEquipment } from '@/hooks/useEquipment';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import ProductBuyBar from '@/components/produit/ProductBuyBar';
import { cleanItemName } from '@/lib/cleanItemName';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  slug: string;
  nom: string;
  marque: string;
  categorie: string;
  description: string;
  prix_cents: number;
  poids_g: number;
  images: { url: string; alt: string }[];
  tags: string[];
  materials?: string;
  dimensions?: string;
  warranty?: string;
  variants?: any[];
  rating?: number;
  review_count?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function cleanCategory(raw: string): string {
  if (!raw) return 'Équipement';
  return raw
    .replace(/^categorie[-_ ]*/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/bigbuy/gi, '')
    .trim() || 'Équipement';
}

function mapToProduct(data: Record<string, unknown>): Product {
  const rawName = (data.name as string) || 'Produit';
  const name = cleanItemName(rawName);
  const image = (data.image as string) || 'https://via.placeholder.com/400x300?text=No+Image';
  const rawBrand = (data.brand as string) || 'Le Kit du Voyageur';
  const marque = /bigbuy/i.test(rawBrand) ? 'Le Kit du Voyageur' : rawBrand;
  const rawCat = (data.category_main as string) || (data.category as string) || 'Équipement';
  return {
    id: data.id as string,
    slug: data.slug as string,
    nom: name,
    marque,
    categorie: cleanCategory(rawCat),
    description: (data.description_why as string) || '',
    prix_cents: Number.isFinite(Number(data.price_eur)) ? Math.round(Number(data.price_eur) * 100) : 0,
    poids_g: Number.isFinite(Number(data.weight_g)) ? Number(data.weight_g) : Number(data.weight_grams) || 0,
    images: [{ url: image, alt: (data.image_alt as string) || name }],
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    materials: (data.materials as string) || '',
    dimensions: (data.dimensions as string) || '',
    warranty: (data.warranty as string) || '',
    variants: Array.isArray(data.variants) ? (data.variants as any[]) : [],
    rating: Number(data.rating) || 4.9,
    review_count: Number(data.review_count) || 12,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductDetailClient({ slug, initialProduct }: { slug: string; initialProduct?: Record<string, unknown> | null }) {
  const [product, setProduct] = useState<Product | null>(() =>
    initialProduct ? mapToProduct(initialProduct) : null
  );
  const [loading, setLoading] = useState(!initialProduct);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [cartAdded, setCartAdded] = useState(false);
  const [selectedColor, setSelectedColor] = useState('vert');
  const [selectedVolume, setSelectedVolume] = useState('45 L');
  const [selectedStrap, setSelectedStrap] = useState('Ventrale + poitrine');
  const [isFavorite, setIsFavorite] = useState(false);
  const { user } = useAuth();
  const { isOwned, isInCart, getCartQuantity, addToCart } = useEquipment();
  const owned = product ? isOwned(product.id) : false;
  const inCart = product ? isInCart(product.id) : false;
  const cartQty = product ? getCartQuantity(product.id) : 0;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const supabase = createClient();
        let currentProdData = initialProduct;

        if (!currentProdData) {
          const { data, error } = await supabase
            .from('shop_products')
            .select('*')
            .eq('slug', slug)
            .single();
          if (error) throw error;
          currentProdData = data;
        }

        if (cancelled) return;

        if (currentProdData) {
          const mapped = mapToProduct(currentProdData);
          
          // Fetch images associated with this product
          const { data: imgData } = await supabase
            .from('product_images')
            .select('url, alt')
            .eq('product_id', currentProdData.id)
            .order('sort_order', { ascending: true });

          if (!cancelled) {
            if (imgData && imgData.length > 0) {
              mapped.images = imgData.map(img => ({ url: img.url, alt: img.alt || mapped.nom }));
            }
            setProduct(mapped);
          }
        } else {
          setProduct(null);
          setLoadError(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setProduct(null);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [slug, initialProduct, retryKey]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-transparent">
        <Header />
        <div className="mx-auto max-w-[1120px] px-4 pt-24">
          <LoadingState label="Chargement du produit…" />
        </div>
      </div>
    );
  }

  if (!product && loadError) {
    return (
      <div className="min-h-dvh bg-transparent">
        <Header />
        <div className="mx-auto max-w-[1120px] px-4 pt-24 pb-16">
          <Card className="mx-auto max-w-[32rem] p-[var(--space-8)] text-center">
            <div className="mb-[var(--space-4)] flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-[var(--lkv-radius-lg)] bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger)]">
                <Icon name="ExclamationTriangleIcon" size={26} variant="outline" />
              </span>
            </div>
            <h1 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
              Produit introuvable
            </h1>
            <p className="mb-[var(--space-6)] mt-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">
              Impossible de charger ce produit. Il a peut-être été retiré du catalogue.
            </p>
            <div className="flex items-center justify-center gap-[var(--space-3)]">
              <Button onClick={() => setRetryKey((k) => k + 1)}>Réessayer</Button>
              <Link
                href="/boutique"
                className="inline-flex min-h-[var(--control-height-md)] items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-5)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--card-content)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
              >
                Retour à la boutique
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const handleAddToCart = (qty: number = 1) => {
    addToCart({
      id: product.id,
      slug: product.slug,
      name: product.nom,
      brand: product.marque,
      category: product.categorie,
      price_eur: product.prix_cents / 100,
      weight_g: product.poids_g,
      image: product.images[0]?.url ?? '',
      image_alt: product.images[0]?.alt ?? product.nom,
    }, qty);
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 3000);
  };

  const titleWords = product.nom.split(' ');
  const lastWords = titleWords.slice(-2).join(' ');
  const firstWords = titleWords.slice(0, -2).join(' ');

  const COLORS = [
    { id: 'vert', color: 'var(--lkv-forest-600)' },
    { id: 'moutarde', color: 'var(--lkv-warning)' },
    { id: 'noir', color: 'var(--lkv-text-primary)' },
    { id: 'bleu', color: 'var(--lkv-info)' },
    { id: 'terre', color: 'var(--stone-600)' },
  ];

  return (
    <>
      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block">
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent text-[color:var(--lkv-text-primary)]">
          <Header />

          <div className="h-full overflow-y-auto bg-transparent pb-16 pt-20">

            {/* BREADCRUMB */}
            <div className="mx-auto mb-[var(--space-6)] max-w-7xl px-4 sm:px-6 lg:px-8">
              <nav className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">
                <Link href="/" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Accueil</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
                <Link href="/boutique" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Boutique</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
                <Link href="/boutique" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">{product.categorie}</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
                <span className="text-[color:var(--lkv-text-primary)]">{product.nom}</span>
              </nav>
            </div>

            {/* HERO SECTION */}
            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">

                {/* GALLERY (Left) */}
                <div className="col-span-12 flex h-auto flex-col-reverse gap-[var(--space-4)] md:h-[650px] md:flex-row lg:col-span-7">

                  {/* Thumbnails */}
                  <div className="flex w-full flex-shrink-0 flex-col gap-[var(--space-3)] overflow-x-auto pb-1 pt-1 md:w-24 md:overflow-y-auto">
                    {product.images.map((img, i) => (
                      <IconButton
                        key={i}
                        variant={i === activeImage ? 'solid' : 'glass'}
                        aria-label={`Afficher l'image ${i + 1} sur ${product.images.length}`}
                        aria-pressed={i === activeImage}
                        onClick={() => setActiveImage(i)}
                        className={`h-20 w-20 shrink-0 overflow-hidden !rounded-[var(--lkv-radius-md)] p-0 ${i === activeImage ? '' : 'opacity-70 hover:opacity-100'}`}
                      >
                        <img src={img.url} alt={`Miniature ${i + 1}`} className="h-full w-full object-cover mix-blend-multiply opacity-90" />
                      </IconButton>
                    ))}
                  </div>

                  {/* Main Image */}
                  <div className="group relative flex-1 overflow-hidden rounded-[var(--lkv-radius-card)] bg-[color:var(--lkv-success-bg)]">
                    <Badge tone="warn" className="absolute left-[var(--space-4)] top-[var(--space-4)] z-[var(--z-sticky)]">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--lkv-warning)]" />
                      Édition automne
                    </Badge>

                    <AnimatePresence mode="wait">
                      <motion.img
                        key={activeImage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        src={product.images[activeImage]?.url || '/assets/images/no_image.png'}
                        alt={product.images[activeImage]?.alt}
                        className="h-full w-full object-cover mix-blend-multiply"
                      />
                    </AnimatePresence>

                    <IconButton
                      variant="glass"
                      aria-label="Agrandir l'image"
                      className="absolute bottom-[var(--space-4)] right-[var(--space-4)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    >
                      <Icon name="ArrowsPointingOutIcon" size={16} variant="outline" />
                    </IconButton>
                  </div>
                </div>

                {/* PRODUCT INFO (Right) */}
                <div className="flex flex-col justify-center lg:col-span-5">

                  <div className="mb-[var(--space-4)]">
                    <Badge tone="sage" className="mb-[var(--space-4)] font-mono">
                      Le sac essentiel
                    </Badge>
                    <h1 className="mb-[var(--space-3)] font-display text-[length:var(--lkv-text-title-xl)] font-extrabold leading-[var(--leading-tight)] tracking-[var(--lkv-tracking-title)] text-[color:var(--lkv-text-primary)]">
                      {firstWords} <em className="font-serif font-normal italic text-[color:var(--lkv-text-secondary)]">{lastWords}</em>.
                    </h1>
                    <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-muted)]">
                      <span className="flex items-center gap-[var(--space-1)] text-[color:var(--lkv-warning)]"><Icon name="StarIcon" size={12} /> 4.9</span>
                      <span className="h-1 w-1 rounded-full bg-[color:var(--lkv-border-strong)]" />
                      <span>125 avis</span>
                      <span className="h-1 w-1 rounded-full bg-[color:var(--lkv-border-strong)]" />
                      <span>47 testeurs terrain</span>
                    </div>
                  </div>

                  <p className="mb-[var(--space-8)] text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
                    {product.description}
                  </p>

                  {/* VARIANTS */}
                  <div className="mb-[var(--space-10)] space-y-[var(--space-6)]">
                    {/* Coloris */}
                    <div>
                      <div className="mb-[var(--space-3)] flex items-baseline justify-between">
                        <span className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Coloris</span>
                        <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{selectedColor === 'vert' ? 'Vert forêt' : 'Autre'}</span>
                      </div>
                      <div className="flex gap-[var(--space-3)]">
                        {COLORS.slice(0, 4).map(c => (
                          <IconButton
                            key={c.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedColor(c.id)}
                            aria-label={`Coloris ${c.id}`}
                            aria-pressed={selectedColor === c.id}
                            className={`h-8 w-8 transition-transform ${selectedColor === c.id ? 'ring-2 ring-[color:var(--lkv-text-primary)] ring-offset-2 ring-offset-[color:var(--lkv-surface)]' : 'hover:scale-110'}`}
                          >
                            <span className="h-full w-full rounded-full border border-[color:var(--lkv-border)]" style={{ backgroundColor: c.color }} />
                          </IconButton>
                        ))}
                      </div>
                    </div>

                    {/* Volume */}
                    <div>
                      <div className="mb-[var(--space-3)] flex items-baseline justify-between">
                        <span className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Volume</span>
                        <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{selectedVolume} - idéal 3-5 jours</span>
                      </div>
                      <div className="flex flex-wrap gap-[var(--space-2)]">
                        {['30 L', '45 L', '60 L', '75 L'].map(vol => (
                          <Chip key={vol} selected={selectedVolume === vol} onClick={() => setSelectedVolume(vol)}>
                            {vol}
                          </Chip>
                        ))}
                      </div>
                    </div>

                    {/* Sangles */}
                    <div>
                      <div className="mb-[var(--space-3)] flex items-baseline justify-between">
                        <span className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Sangles</span>
                        <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{selectedStrap}</span>
                      </div>
                      <div className="flex flex-wrap gap-[var(--space-2)]">
                        {['Basique', 'Ventrale + poitrine', 'Ventrale + poitrine + porte-piolet'].map(strap => (
                          <Chip key={strap} selected={selectedStrap === strap} onClick={() => setSelectedStrap(strap)}>
                            {strap}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* PRICE & CTA */}
                  <div className="mb-[var(--space-8)] border-t border-[color:var(--lkv-border)] pt-[var(--space-6)]">
                    <div className="mb-[var(--space-5)] flex items-end justify-between">
                      <div className="flex items-baseline gap-[var(--space-2)]">
                        <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">{product.prix_cents > 0 ? `${(product.prix_cents / 100).toFixed(0)} €` : '—'}</span>
                        {product.prix_cents > 0 && <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">- TVA incluse</span>}
                      </div>
                      <div className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-secondary)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--lkv-success)]" />
                        En stock - expédié sous 48 h
                      </div>
                    </div>

                    {owned && (
                      <Card variant="compact" tone="sage" className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                        <span aria-hidden="true">✓</span> Cet article est déjà enregistré dans votre sac / équipement
                      </Card>
                    )}

                    <div className="flex gap-[var(--space-3)]">
                      <Button
                        size="lg"
                        className="flex-1"
                        onClick={() => {
                          addToCart({
                            id: product.id,
                            slug: product.slug,
                            name: product.nom,
                            brand: product.marque,
                            category: product.categorie,
                            price_eur: product.prix_cents / 100,
                            weight_g: product.poids_g,
                            image: product.images[0]?.url,
                          }, 1);
                          setCartAdded(true);
                          setTimeout(() => setCartAdded(false), 2500);
                        }}
                        icon={cartAdded ? <Icon name="CheckCircleIcon" size={18} /> : <Icon name="ShoppingBagIcon" size={18} />}
                      >
                        {cartAdded
                          ? 'Ajouté au panier !'
                          : inCart
                            ? `Dans le panier (${cartQty}) — Ajouter +1`
                            : 'Ajouter au panier'}
                      </Button>

                      <IconButton
                        variant={isFavorite ? 'solid' : 'glass'}
                        size="lg"
                        aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        aria-pressed={isFavorite}
                        onClick={() => setIsFavorite(!isFavorite)}
                        className="h-[52px] w-[52px] shrink-0"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={isFavorite ? 'filled' : 'outline'}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="inline-flex"
                          >
                            <Icon name="HeartIcon" size={20} variant={isFavorite ? "solid" : "outline"} className={isFavorite ? "fill-current" : ""} />
                          </motion.span>
                        </AnimatePresence>
                      </IconButton>
                    </div>
                  </div>

                  {/* TRUST BADGES */}
                  <div className="grid grid-cols-2 gap-[var(--space-3)]">
                    {[
                      { icon: 'ShieldCheckIcon', title: 'Garantie à vie', sub: 'Réparable 1x/an gratuit' },
                      { icon: 'TruckIcon', title: 'Livraison offerte', sub: 'Dès 100€' },
                      { icon: 'ArrowPathIcon', title: 'Retour 30 jours', sub: 'Sans motifs' },
                      { icon: 'GlobeAltIcon', title: '100% Europe', sub: 'Alpes-de-Haute-Provence' },
                    ].map(badge => (
                      <Card key={badge.title} variant="compact" className="flex items-start gap-[var(--space-3)] p-[var(--space-3)]">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-text-secondary)]">
                          <Icon name={badge.icon as any} size={16} variant="outline" />
                        </div>
                        <div>
                          <div className="mb-0.5 text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{badge.title}</div>
                          <div className="text-[length:var(--lkv-text-caption-2)] leading-[var(--leading-tight)] text-[color:var(--lkv-text-muted)]">{badge.sub}</div>
                        </div>
                      </Card>
                    ))}
                  </div>

                </div>
              </div>
            </section>

            {/* FABRICATION SECTION */}
            <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 lg:gap-20">
                <div className="aspect-[4/5] overflow-hidden rounded-[var(--lkv-radius-md)]">
                  <img src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80" alt="Atelier de fabrication" className="h-full w-full object-cover grayscale-[30%]" />
                </div>
                <div>
                  <span className="mb-[var(--space-4)] block font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-caps)] text-[color:var(--lkv-text-muted)]">Fabrication</span>
                  <h2 className="mb-[var(--space-6)] font-display text-[length:var(--lkv-text-title-xl)] font-bold leading-[var(--leading-tight)] text-[color:var(--lkv-text-primary)]">
                    Cousu à <em className="font-serif font-normal italic text-[color:var(--lkv-text-secondary)]">Manosque,</em><br /> par cinq mains.
                  </h2>
                  <p className="mb-[var(--space-12)] max-w-md text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-muted)]">
                    Cinq artisanes travaillent le cuir chaque semaine dans un atelier des Alpes-de-Haute-Provence. Un sac demande six heures de couture, une heure d'huilage, une nuit de séchage.
                  </p>

                  <div className="grid grid-cols-3 gap-[var(--space-6)] border-t border-[color:var(--lkv-border)] pt-[var(--space-6)]">
                    <div>
                      <Metric value="6" unit="h" size="md" />
                      <div className="mt-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Couture</div>
                    </div>
                    <div>
                      <Metric value="1 200" unit="g" size="md" />
                      <div className="mt-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Poids à sec</div>
                    </div>
                    <div>
                      <Metric value="45" unit="L" size="md" />
                      <div className="mt-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Volume utile</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SPECS SECTION */}
            <section className="mx-auto mt-24 max-w-4xl px-4 sm:px-6 lg:px-8">
              <Card className="p-[var(--space-8)] md:p-[var(--space-12)]">
                <h3 className="mb-[var(--space-8)] font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
                  Spécifications <em className="font-serif font-normal italic text-[color:var(--lkv-text-secondary)]">techniques.</em>
                </h3>

                <div className="grid grid-cols-1 gap-x-16 gap-y-[var(--space-1)] text-[length:var(--lkv-text-caption)] md:grid-cols-2">
                  {[
                    { label: 'Volume utile', value: '45 litres' },
                    { label: 'Poids à sec', value: '1,4 kg' },
                    { label: 'Toile principale', value: 'Coton huilé 12 oz' },
                    { label: 'Doublure', value: 'Lin biologique 400 g/m²' },
                    { label: 'Boucles', value: 'Laiton brossé, France' },
                    { label: 'Couture', value: 'Point sellier, fil ciré' },
                    { label: 'Dos', value: 'Ergonomique 4 zones' },
                    { label: 'Ceinture ventrale', value: 'Réglable, amovible' },
                    { label: 'Compartiments', value: '3 - dont 1 rabat + 1 poche sécurisée' },
                    { label: 'Accroches', value: 'Tapis, piolet, gourde' },
                    { label: 'Imperméabilité', value: 'IP54 - pluie fine' },
                    { label: 'Garantie', value: 'À vie - réparable' },
                  ].map(spec => (
                    <div key={spec.label} className="flex items-center justify-between border-b border-[color:var(--lkv-border-subtle)] py-[var(--space-2)] last:border-0">
                      <span className="text-[color:var(--lkv-text-muted)]">{spec.label}</span>
                      <span className="text-right font-medium text-[color:var(--lkv-text-primary)]">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* CROSS SELL */}
            <section className="mx-auto mb-10 mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
              <h3 className="mb-[var(--space-8)] font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
                Ils vont <em className="font-serif font-normal italic text-[color:var(--lkv-text-secondary)]">avec.</em>
              </h3>

              <div className="grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-3">
                {[
                  { label: 'COUCHAGE', title: 'Duvet 3 saisons', price: '240 €', img: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&q=80' },
                  { label: 'HYDRATATION', title: 'Gourde titane 1 L', price: '68 €', img: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=200&q=80' },
                  { label: 'VÊTEMENTS', title: 'Veste 3 couches', price: '212 €', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&q=80' },
                ].map(item => (
                  <Card key={item.title} variant="compact" className="group flex items-center gap-[var(--space-4)]">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-success-bg)]">
                      <img src={item.img} alt={item.title} className="h-full w-full object-cover opacity-90 mix-blend-multiply transition-transform duration-500 group-hover:scale-110" />
                    </div>
                    <div>
                      <div className="mb-0.5 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">{item.label}</div>
                      <div className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{item.title}</div>
                      <div className="mt-0.5 font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{item.price}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

          </div>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="block md:hidden">
        <MobilePageShell background="transparent">
          <div className="px-[var(--space-4)] pt-[var(--space-2)]">
            <PageHeader
              variant="inline"
              back
              backHref="/boutique"
              backLabel="Retour à la boutique"
              title={product.nom}
              actions={
                <IconButton
                  variant={isFavorite ? 'solid' : 'glass'}
                  aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  aria-pressed={isFavorite}
                  onClick={() => setIsFavorite(!isFavorite)}
                >
                  <Icon name="HeartIcon" size={18} variant={isFavorite ? 'solid' : 'outline'} />
                </IconButton>
              }
            />
          </div>

          {/* Gallery */}
          <div className="relative aspect-square w-full overflow-hidden bg-[color:var(--lkv-success-bg)]">
            {/* Image Slider */}
            <div
              id="mobile-gallery"
              onScroll={(e) => {
                const target = e.currentTarget;
                const index = Math.round(target.scrollLeft / target.clientWidth);
                if (index !== activeImage) setActiveImage(index);
              }}
              className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {product.images.map((img, i) => (
                <div key={i} className="flex h-full w-full flex-shrink-0 snap-start items-center justify-center bg-[color:var(--lkv-success-bg)]">
                  <img src={img.url} alt={img.alt || product.nom} className="h-full w-full object-cover mix-blend-multiply" />
                </div>
              ))}
              {product.images.length === 0 && (
                <div className="flex h-full w-full items-center justify-center bg-[color:var(--lkv-success-bg)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                  Aucune image disponible
                </div>
              )}
            </div>

            {/* Paging indicators */}
            {product.images.length > 1 && (
              <div className="absolute bottom-[var(--space-4)] left-1/2 z-[var(--z-sticky)] flex -translate-x-1/2 gap-[6px] rounded-full bg-[color:var(--lkv-overlay-scrim)] px-[10px] py-[4px] backdrop-blur-[var(--blur-sm)]">
                {product.images.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === activeImage ? 'w-4 bg-[color:var(--lkv-text-inverted)]' : 'w-1.5 bg-[color:var(--lkv-text-inverted)] opacity-40'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnails list */}
          {product.images.length > 1 && (
            <div className="flex gap-[var(--space-2)] overflow-x-auto px-[var(--space-4)] py-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {product.images.map((img, i) => (
                <IconButton
                  key={i}
                  variant={i === activeImage ? 'solid' : 'glass'}
                  aria-label={`Afficher l'image ${i + 1} sur ${product.images.length}`}
                  aria-pressed={i === activeImage}
                  onClick={() => {
                    setActiveImage(i);
                    const gallery = document.getElementById('mobile-gallery');
                    if (gallery) {
                      gallery.scrollTo({ left: gallery.clientWidth * i, behavior: 'smooth' });
                    }
                  }}
                  className={`h-12 w-12 shrink-0 overflow-hidden !rounded-[var(--lkv-radius-md)] p-0 ${i === activeImage ? '' : 'opacity-70 hover:opacity-100'}`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover mix-blend-multiply" />
                </IconButton>
              ))}
            </div>
          )}

          {/* Info section */}
          <div className="px-[var(--space-5)] pb-[var(--space-4)] pt-[var(--space-6)]">
            <Badge tone="sage" className="mb-[var(--space-2)] font-mono">
              {product.categorie}
            </Badge>
            <div className="text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-secondary)]">
              Par <span className="font-semibold text-[color:var(--lkv-text-primary)]">{product.marque}</span>
            </div>

            {/* Price & Rating */}
            <div className="mt-[var(--space-4)] flex items-center justify-between border-b border-[color:var(--lkv-border)] pb-[var(--space-4)]">
              <div>
                <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
                  {product.prix_cents > 0 ? `${(product.prix_cents / 100).toFixed(2)} €` : '—'}
                </span>
                <span className="mt-0.5 block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">TVA incluse</span>
              </div>
              
              <div className="flex items-center gap-[6px] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-success-bg)] px-[var(--space-3)] py-[6px] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                <Icon name="StarIcon" size={12} variant="solid" className="text-[color:var(--lkv-warning)]" />
                <span className="font-bold text-[color:var(--lkv-text-primary)]">{product.rating}</span>
                <span>({product.review_count || 12} avis)</span>
              </div>
            </div>
          </div>

          {/* Présence dans les lignées — encart Lignées de kits (Lot 5) */}
          {product.id && (
            <div className="px-[var(--space-5)] py-[var(--space-2)]">
              <ProductLineageCard productId={product.id} />
            </div>
          )}

          {/* Specifications Grid */}
          <div className="px-[var(--space-5)] py-[var(--space-2)]">
            <h3 className="mb-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-primary)]">Caractéristiques</h3>
            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <Card variant="compact" className="p-[var(--space-3)]">
                <div className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Poids</div>
                <div className="mt-0.5 text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {product.poids_g > 0 ? `${(product.poids_g / 1000).toFixed(2)} kg` : '—'}
                </div>
              </Card>
              <Card variant="compact" className="p-[var(--space-3)]">
                <div className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Matière</div>
                <div className="mt-0.5 truncate text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]" title={product.materials || '—'}>
                  {product.materials || 'Non spécifiée'}
                </div>
              </Card>
              <Card variant="compact" className="p-[var(--space-3)]">
                <div className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Dimensions</div>
                <div className="mt-0.5 truncate text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]" title={product.dimensions || '—'}>
                  {product.dimensions || 'Non spécifiées'}
                </div>
              </Card>
              <Card variant="compact" className="p-[var(--space-3)]">
                <div className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Garantie</div>
                <div className="mt-0.5 text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {product.warranty || '2 ans'}
                </div>
              </Card>
            </div>
          </div>

          {/* Dynamic variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="px-[var(--space-5)] py-[var(--space-4)]">
              <h3 className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-primary)]">Options</h3>
              <div className="flex flex-wrap gap-[var(--space-2)]">
                {product.variants.map((v: any, i: number) => (
                  <Chip key={i}>{v.size || v.name || v.sku}</Chip>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="px-[var(--space-5)] pb-[100px] pt-[var(--space-4)]">
            <h3 className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-primary)]">Présentation</h3>
            <p className="m-0 whitespace-pre-line text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
              {product.description}
            </p>
          </div>

          {/* Buy bar */}
          <ProductBuyBar
            price={product.prix_cents / 100}
            isOwned={owned}
            onAddToCart={(qty) => {
              addToCart({
                id: product.id,
                slug: product.slug,
                name: product.nom,
                brand: product.marque,
                category: product.categorie,
                price_eur: product.prix_cents / 100,
                weight_g: product.poids_g,
                image: product.images[0]?.url,
              }, qty);
            }}
          />
        </MobilePageShell>
      </div>
    </>
  );
}
