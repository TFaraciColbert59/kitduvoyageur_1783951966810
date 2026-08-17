'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LkvIcon from '@/components/ui/LkvIcon';
import Icon from '@/components/ui/AppIcon';
import { FOREGROUND_900, FOREGROUND_800, SAGE_100, STONE_100 } from '@/lib/designTokens';
import { shadow } from '@/lib/styleHelpers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { addToCart } from '@/lib/cart';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useEquipment } from '@/hooks/useEquipment';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import ProductBuyBar from '@/components/produit/ProductBuyBar';

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
function mapToProduct(data: Record<string, unknown>): Product {
  const name = (data.name as string) || 'Produit';
  const image = (data.image as string) || 'https://via.placeholder.com/400x300?text=No+Image';
  return {
    id: data.id as string,
    slug: data.slug as string,
    nom: name,
    marque: (data.brand as string) || 'Le Kit du Voyageur',
    categorie: (data.category_main as string) || (data.category as string) || 'Équipement',
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
      <div style={{ minHeight: '100vh', background: STONE_100 }}>
        <Header />
        <div style={{ paddingTop: '6rem', maxWidth: '1120px', margin: '0 auto', paddingLeft: '1rem', paddingRight: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ width: '2rem', height: '2rem', borderWidth: '2px', borderColor: FOREGROUND_900, borderTopColor: 'transparent', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!product && loadError) {
    return (
      <div style={{ minHeight: '100vh', background: STONE_100 }}>
        <Header />
        <div style={{ paddingTop: '6rem', paddingBottom: '4rem', maxWidth: '1120px', margin: '0 auto', paddingLeft: '1rem', paddingRight: '1rem' }}>
          <div style={{ background: 'white', border: `1px solid ${STONE_100}`, borderRadius: '2rem', maxWidth: '32rem', margin: '0 auto', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontFamily: 'display', fontWeight: 800, fontSize: '2rem', color: FOREGROUND_900, marginBottom: '0.5rem' }}>Produit introuvable</h1>
            <p style={{ fontSize: '0.875rem', color: '#5C6B5E', marginBottom: '1.5rem' }}>
              Impossible de charger ce produit. Il a peut-être été retiré du catalogue.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', background: FOREGROUND_900, color: 'white', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Réessayer
              </button>
              <Link
                href="/boutique"
                style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', border: `1px solid ${STONE_100}`, color: '#5C6B5E', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Retour à la boutique
              </Link>
            </div>
          </div>
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
    { id: 'vert', color: '#445749' },
    { id: 'moutarde', color: '#B89B60' },
    { id: 'noir', color: '#2B302C' },
    { id: 'bleu', color: '#A1B2BA' },
    { id: 'terre', color: '#8B6D5C' },
  ];

  return (
    <>
      {/* ── DESKTOP VIEW ── */}
      <div >
        <div style={{ minHeight: '100vh', background: STONE_100, color: FOREGROUND_900, fontFamily: 'sans-serif', userSelect: 'text' }}>
          <Header />

          <main id="main-content" className="pt-24 pb-16">

            {/* BREADCRUMB */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
              <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', color: '#5C6B5E', fontWeight: 500, letterSpacing: '0.05em' }}>
                <Link href="/" style={{ cursor: 'pointer' }}>Accueil</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" style={{ opacity: 0.5 }} />
                <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">Boutique</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" style={{ opacity: 0.5 }} />
                <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">{product.categorie}</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" style={{ opacity: 0.5 }} />
                <span style={{ color: FOREGROUND_900 }}>{product.nom}</span>
              </nav>
            </div>

            {/* HERO SECTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

                {/* GALLERY (Left) */}
                <div className="col-span-12 lg:col-span-7 flex flex-col-reverse md:flex-row gap-4 h-auto md:h-[650px]">

                  {/* Thumbnails */}
                  <div className="flex flex-col gap-3 overflow-x-auto md:overflow-y-auto w-full md:w-24 flex-shrink-0 pt-1 pb-1">
                    {product.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        style={{ position: 'relative', width: '5rem', height: '5rem', aspectRatio: '1 / 1', borderRadius: '0.5rem', overflow: 'hidden', borderWidth: '2px', background: SAGE_100, borderColor: i === activeImage ? FOREGROUND_900 : 'transparent', boxShadow: i === activeImage ? shadow(1) : 'none', cursor: 'pointer' }}
                      >
                        <img src={img.url} alt={`Miniature ${i+1}`} className="w-full h-full object-cover mix-blend-multiply opacity-90" />
                      </button>
                    ))}
                  </div>

                  {/* Main Image */}
                  <div className="group" style={{ position: 'relative', flex: 1, borderRadius: '1.5rem', overflow: 'hidden', background: SAGE_100, border: `1px solid ${STONE_100}` }}>
                    <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', fontSize: '0.625rem', fontWeight: '600', color: FOREGROUND_900, paddingLeft: '0.75rem', paddingRight: '0.75rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', borderRadius: '9999px', boxShadow: shadow(1), display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span className="w-1.5 h-1.5 bg-[#B5652D] rounded-full"></span>
                      Édition automne
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.img
                        key={activeImage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        src={product.images[activeImage]?.url || '/assets/images/no_image.png'}
                        alt={product.images[activeImage]?.alt}
                        className="w-full h-full object-cover mix-blend-multiply"
                      />
                    </AnimatePresence>

                    <button className="absolute bottom-4 right-4 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:scale-105 transition-opacity duration-200 opacity-0 group-hover:opacity-100 transform" style={{ color: FOREGROUND_900, boxShadow: shadow(1) }}>
                      <Icon name="ArrowsPointingOutIcon" size={16} variant="outline" />
                    </button>
                  </div>
                </div>

                {/* PRODUCT INFO (Right) */}
                <div className="flex flex-col justify-center lg:col-span-5">

                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ display: 'inline-block', background: '#D3DFD7', color: '#2D5A3D', fontSize: '0.5625rem', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', paddingLeft: '0.625rem', paddingRight: '0.625rem', paddingTop: '0.25rem', paddingBottom: '0.25rem', borderRadius: '9999px', marginBottom: '1rem' }}>
                      Le sac essentiel
                    </span>
                    <h1 className="font-display font-extrabold text-2xl lg:text-[44px] leading-[1.1] tracking-[-0.02em] mb-3" style={{ color: FOREGROUND_900 }}>
                      {firstWords} <em style={{ fontFamily: 'serif', fontStyle: 'italic', fontWeight: 'normal', color: '#5C6B5E' }}>{lastWords}</em>.
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 500, color: '#5C6B5E' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#B5652D' }}><Icon name="StarIcon" size={12} /> 4.9</span>
                      <span className="w-1 h-1 bg-[#C8C3B0] rounded-full"></span>
                      <span>125 avis</span>
                      <span className="w-1 h-1 bg-[#C8C3B0] rounded-full"></span>
                      <span>47 testeurs terrain</span>
                    </div>
                  </div>

                  <p className="text-sm text-[#4A574C] leading-relaxed mb-8">
                    {product.description}
                  </p>

                  {/* VARIANTS */}
                  <div className="space-y-6 mb-10">
                    {/* Coloris */}
                    <div>
                      <div className="flex justify-between items-baseline mb-3">
                        <span className="text-xs font-semibold text-[#1C2620]">Coloris</span>
                        <span className="text-xs text-[#5C6B5E]">{selectedColor === 'vert' ? 'Vert forêt' : 'Autre'}</span>
                      </div>
                      <div className="flex gap-3">
                        {COLORS.slice(0, 4).map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedColor(c.id)}
                            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedColor === c.id ? 'ring-2 ring-offset-2 ring-offset-[#EBE8DD] ring-[#1C2620]' : 'hover:scale-110'}`}
                          >
                            <span className="w-full h-full rounded-full border border-black/10" style={{ backgroundColor: c.color }}></span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Volume */}
                    <div>
                      <div className="flex justify-between items-baseline mb-3">
                        <span className="text-xs font-semibold text-[#1C2620]">Volume</span>
                        <span className="text-xs text-[#5C6B5E]">{selectedVolume} - idéal 3-5 jours</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {['30 L', '45 L', '60 L', '75 L'].map(vol => (
                          <button
                            key={vol}
                            onClick={() => setSelectedVolume(vol)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${selectedVolume === vol ? 'bg-[#1C2620] text-white border-[#1C2620]' : 'bg-white border-[#C8C3B0] text-[#1C2620] hover:border-[#1C2620]'}`}
                          >
                            {vol}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sangles */}
                    <div>
                      <div className="flex justify-between items-baseline mb-3">
                        <span className="text-xs font-semibold text-[#1C2620]">Sangles</span>
                        <span className="text-xs text-[#5C6B5E]">{selectedStrap}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {['Basique', 'Ventrale + poitrine', 'Ventrale + poitrine + porte-piolet'].map(strap => (
                          <button
                            key={strap}
                            onClick={() => setSelectedStrap(strap)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${selectedStrap === strap ? 'bg-[#1C2620] text-white border-[#1C2620]' : 'bg-white border-[#C8C3B0] text-[#1C2620] hover:border-[#1C2620]'}`}
                          >
                            {strap}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* PRICE & CTA */}
                  <div className="border-t border-[#C8C3B0] pt-6 mb-8">
                    <div className="flex justify-between items-end mb-5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display font-800 text-[28px] text-[#1C2620]">{product.prix_cents > 0 ? `${(product.prix_cents / 100).toFixed(0)} €` : '—'}</span>
                        {product.prix_cents > 0 && <span className="text-xs text-[#5C6B5E]">- TVA incluse</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#2D5A3D]">
                        <span className="w-1.5 h-1.5 bg-[#2D5A3D] rounded-full"></span>
                        En stock - expédié sous 48 h
                      </div>
                    </div>

                    {owned && (
                      <div className="mb-4 px-4 py-2.5 rounded-2xl bg-[#E1EBDD] border border-[#A9C6B0] text-xs font-bold text-[#17402C] flex items-center gap-2">
                        <span>✓</span> Cet article est déjà enregistré dans votre sac / équipement
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
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
                        className={`flex-1 py-4 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                          inCart
                            ? 'bg-[#17402C] text-white ring-2 ring-[#17402C]/30'
                            : 'bg-[#17402C] hover:bg-[#0B1F17] text-white'
                        }`}
                      >
                        {cartAdded ? (
                          <><Icon name="CheckCircleIcon" size={18} /> Ajouté au panier !</>
                        ) : inCart ? (
                          <><Icon name="ShoppingBagIcon" size={18} /> ✓ Dans le panier ({cartQty}) — Ajouter +1</>
                        ) : (
                          <><Icon name="ShoppingBagIcon" size={18} /> Ajouter au panier</>
                        )}
                      </button>

                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => setIsFavorite(!isFavorite)}
                        className={`w-[52px] h-[52px] rounded-full border flex items-center justify-center transition-colors flex-shrink-0 relative overflow-hidden ${isFavorite ? 'border-[#17402C] bg-[#17402C]/10 text-[#17402C]' : 'border-[#C8C3B0] bg-white hover:bg-[#E3DFD2] text-[#1C2620]'}`}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={isFavorite ? 'filled' : 'outline'}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Icon name="HeartIcon" size={20} variant={isFavorite ? "solid" : "outline"} className={isFavorite ? "fill-current" : ""} />
                          </motion.div>
                        </AnimatePresence>
                      </motion.button>
                    </div>
                  </div>

                  {/* TRUST BADGES */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: 'ShieldCheckIcon', title: 'Garantie à vie', sub: 'Réparable 1x/an gratuit' },
                      { icon: 'TruckIcon', title: 'Livraison offerte', sub: 'Dès 100€' },
                      { icon: 'ArrowPathIcon', title: 'Retour 30 jours', sub: 'Sans motifs' },
                      { icon: 'GlobeAltIcon', title: '100% Europe', sub: 'Alpes-de-Haute-Provence' },
                    ].map(badge => (
                      <div key={badge.title} className="bg-white/50 border border-[#C8C3B0]/50 rounded-2xl p-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E3DFD2] flex items-center justify-center flex-shrink-0 text-[#2D5A3D]">
                          <Icon name={badge.icon as any} size={16} variant="outline" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#1C2620] mb-0.5">{badge.title}</div>
                          <div className="text-[9px] text-[#5C6B5E] leading-tight">{badge.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </section>

            {/* FABRICATION SECTION */}
            <section className="mt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-20 items-center">
                <div className="aspect-[4/5] rounded-[0.75rem] overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80" alt="Atelier de fabrication" className="w-full h-full object-cover grayscale-[30%]" />
                </div>
                <div>
                  <span className="text-[9px] font-mono tracking-[0.2em] text-[#5C6B5E] uppercase mb-4 block">Fabrication</span>
                  <h2 className="font-display font-800 text-[32px] md:text-[40px] leading-[1.1] text-[#1C2620] mb-6">
                    Cousu à <em className="font-serif italic text-[#2D5A3D] font-normal">Manosque,</em><br /> par cinq mains.
                  </h2>
                  <p className="text-sm text-[#5C6B5E] leading-relaxed mb-12 max-w-md">
                    Cinq artisanes travaillent le cuir chaque semaine dans un atelier des Alpes-de-Haute-Provence. Un sac demande six heures de couture, une heure d'huilage, une nuit de séchage.
                  </p>

                  <div className="grid grid-cols-3 gap-6 border-t border-[#C8C3B0] pt-6">
                    <div>
                      <div className="font-display font-800 text-2xl text-[#1C2620] mb-1">6 <em className="font-serif italic font-normal">h</em></div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-[#5C6B5E]">Couture</div>
                    </div>
                    <div>
                      <div className="font-display font-800 text-2xl text-[#1C2620] mb-1">1 200 <em className="font-serif italic font-normal">g</em></div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-[#5C6B5E]">Poids à sec</div>
                    </div>
                    <div>
                      <div className="font-display font-800 text-2xl text-[#1C2620] mb-1">45 <em className="font-serif italic font-normal">L</em></div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-[#5C6B5E]">Volume utile</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SPECS SECTION */}
            <section className="mt-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 bg-white rounded-[0.75rem] p-8 md:p-12 shadow-sm border border-[#E8E4D8] active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
              <h3 className="font-display font-800 text-2xl mb-8">Spécifications <em className="font-serif italic font-normal text-[#2D5A3D]">techniques.</em></h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 text-xs">
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
                  <div key={spec.label} className="flex justify-between items-center py-2 border-b border-[#EBE8DD] last:border-0 md:last:border-b">
                    <span className="text-[#5C6B5E]">{spec.label}</span>
                    <span className="font-medium text-[#1C2620] text-right">{spec.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* CROSS SELL */}
            <section className="mt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
              <h3 className="font-display font-800 text-2xl mb-8">Ils vont <em className="font-serif italic font-normal text-[#2D5A3D]">avec.</em></h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'COUCHAGE', title: 'Duvet 3 saisons', price: '240 €', img: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&q=80' },
                  { label: 'HYDRATATION', title: 'Gourde titane 1 L', price: '68 €', img: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=200&q=80' },
                  { label: 'VÊTEMENTS', title: 'Veste 3 couches', price: '212 €', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&q=80' },
                ].map(item => (
                  <div key={item.title} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '0.75rem 1.25rem 0.75rem 0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #E8E4D8', cursor: 'pointer' }} className="hover:border-[#1C2620] transition-colors group">
                    <div style={{ width: '4rem', height: '4rem', borderRadius: '0.75rem', backgroundColor: '#EBE8DD', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={item.img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply', opacity: 0.9 }} className="group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.5rem', fontFamily: 'monospace', letterSpacing: '0.1em', color: '#5C6B5E', textTransform: 'uppercase', marginBottom: '0.125rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1C2620' }}>{item.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#1C2620', marginTop: '0.125rem' }}>{item.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </main>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="block md:hidden">
        <MobilePageShell background={STONE_100}>
          {/* Gallery */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: SAGE_100, overflow: 'hidden' }}>
            {/* Back button */}
            <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 20, display: 'flex', gap: '8px' }}>
              <Link href="/boutique" style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: FOREGROUND_900, boxShadow: shadow(2), textDecoration: 'none' }}>
                <LkvIcon name="chevron-left" size={18} />
              </Link>
            </div>

            {/* Favorite button */}
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 20, width: '36px', height: '36px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: FOREGROUND_900, boxShadow: shadow(2), cursor: 'pointer' }}
            >
              <LkvIcon name="heart" size={18} color={isFavorite ? '#EF4444' : 'inherit'} />
            </button>

            {/* Image Slider */}
            <div 
              id="mobile-gallery"
              onScroll={(e) => {
                const target = e.currentTarget;
                const index = Math.round(target.scrollLeft / target.clientWidth);
                if (index !== activeImage) setActiveImage(index);
              }}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
              }}
            >
              {product.images.map((img, i) => (
                <div key={i} style={{ width: '100%', height: '100%', flexShrink: 0, scrollSnapAlign: 'start', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E3DFD2' }}>
                  <img src={img.url} alt={img.alt || product.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply' }} />
                </div>
              ))}
              {product.images.length === 0 && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E3DFD2', fontSize: '13px', color: '#6B7A72' }}>
                  Aucune image disponible
                </div>
              )}
            </div>

            {/* Paging indicators */}
            {product.images.length > 1 && (
              <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', zIndex: 10, background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '999px' }}>
                {product.images.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: i === activeImage ? '16px' : '6px',
                      height: '6px',
                      borderRadius: '999px',
                      background: i === activeImage ? '#fff' : 'rgba(255,255,255,0.4)',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnails list */}
          {product.images.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', overflowX: 'auto', background: '#F5F2E9', scrollbarWidth: 'none' }}>
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveImage(i);
                    const gallery = document.getElementById('mobile-gallery');
                    if (gallery) {
                      gallery.scrollTo({ left: gallery.clientWidth * i, behavior: 'smooth' });
                    }
                  }}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid',
                    borderColor: i === activeImage ? '#0B1F17' : 'transparent',
                    flexShrink: 0,
                    background: '#E3DFD2',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply' }} />
                </button>
              ))}
            </div>
          )}

          {/* Info section */}
          <div style={{ padding: '24px 20px 16px' }}>
            <span style={{ display: 'inline-block', background: SAGE_100, border: '1px solid rgba(11,31,23,0.06)', color: FOREGROUND_800, fontSize: '10px', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 10px', borderRadius: '999px', marginBottom: '8px', fontWeight: 500 }}>
              {product.categorie}
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: FOREGROUND_900, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {product.nom}
            </h1>
            <div style={{ fontSize: '12px', color: '#6B7A72', marginTop: '4px', fontWeight: 500 }}>
              Par <span style={{ fontWeight: 600, color: '#0B1F17' }}>{product.marque}</span>
            </div>

            {/* Price & Rating */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(11,31,23,0.06)' }}>
              <div>
                <span style={{ fontSize: '24px', fontWeight: 700, color: FOREGROUND_800 }}>
                  {product.prix_cents > 0 ? `${(product.prix_cents / 100).toFixed(2)} €` : '—'}
                </span>
                <span style={{ fontSize: '10px', color: '#6B7A72', display: 'block', marginTop: '2px' }}>TVA incluse</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7A72', background: SAGE_100, padding: '6px 12px', borderRadius: '12px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={FOREGROUND_800} stroke={FOREGROUND_800}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span style={{ fontWeight: 700, color: '#0B1F17' }}>{product.rating}</span>
                <span>({product.review_count || 12} avis)</span>
              </div>
            </div>
          </div>

          {/* Specifications Grid */}
          <div style={{ padding: '8px 20px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#0B1F17', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Caractéristiques</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: STONE_100, border: '1px solid rgba(11,31,23,0.06)', padding: '12px', borderRadius: '16px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B7A72', letterSpacing: '0.05em' }}>Poids</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0B1F17', marginTop: '2px' }}>
                  {product.poids_g > 0 ? `${(product.poids_g / 1000).toFixed(2)} kg` : '—'}
                </div>
              </div>
              <div style={{ background: STONE_100, border: '1px solid rgba(11,31,23,0.06)', padding: '12px', borderRadius: '16px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B7A72', letterSpacing: '0.05em' }}>Matière</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0B1F17', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={product.materials || '—'}>
                  {product.materials || 'Non spécifiée'}
                </div>
              </div>
              <div style={{ background: STONE_100, border: '1px solid rgba(11,31,23,0.06)', padding: '12px', borderRadius: '16px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B7A72', letterSpacing: '0.05em' }}>Dimensions</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0B1F17', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={product.dimensions || '—'}>
                  {product.dimensions || 'Non spécifiées'}
                </div>
              </div>
              <div style={{ background: STONE_100, border: '1px solid rgba(11,31,23,0.06)', padding: '12px', borderRadius: '16px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B7A72', letterSpacing: '0.05em' }}>Garantie</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0B1F17', marginTop: '2px' }}>
                  {product.warranty || '2 ans'}
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic variants */}
          {product.variants && product.variants.length > 0 && (
            <div style={{ padding: '16px 20px' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#0B1F17', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Options</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {product.variants.map((v: any, i: number) => (
                  <button
                    key={i}
                    style={{ padding: '8px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, border: `1px solid ${SAGE_100}`, background: STONE_100, color: FOREGROUND_900, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {v.size || v.name || v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ padding: '16px 20px 100px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: FOREGROUND_900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Présentation</h3>
            <p style={{ fontSize: '14px', color: '#384A42', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
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