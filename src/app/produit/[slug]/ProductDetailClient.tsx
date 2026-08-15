'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { addToCart } from '@/lib/cart';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
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
      <div className="min-h-screen bg-[#EBE8DD]">
        <Header />
        <div className="pt-24 max-w-7xl mx-auto px-4 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!product && loadError) {
    return (
      <div className="min-h-screen bg-[#EBE8DD]">
        <Header />
        <div className="pt-24 pb-16 max-w-7xl mx-auto px-4">
          <div className="bg-white border border-[#E8E4D8] rounded-[2rem] max-w-lg mx-auto p-10 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="font-display font-800 text-2xl text-[#1C2620] mb-2">Produit introuvable</h1>
            <p className="text-sm text-[#5C6B5E] mb-6">
              Impossible de charger ce produit. Il a peut-être été retiré du catalogue.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="px-5 py-2.5 bg-[#17402C] text-white rounded-full text-xs font-700 hover:bg-[#0F2B1D] transition-colors"
              >
                Réessayer
              </button>
              <Link
                href="/boutique"
                className="px-5 py-2.5 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] rounded-full text-xs font-600 transition-colors"
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
      priceEur: product.prix_cents / 100,
      weightG: product.poids_g,
      image: product.images[0]?.url ?? '',
      imageAlt: product.images[0]?.alt ?? product.nom,
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
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#EBE8DD] text-[#1C2620] font-sans selection:bg-[#17402C]/20">
          <Header />

          <main id="main-content" className="pt-24 pb-16">

            {/* BREADCRUMB */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
              <nav className="flex items-center gap-2 text-[11px] text-[#5C6B5E] font-medium tracking-wide">
                <Link href="/" className="hover:text-[#1C2620] transition-colors">Accueil</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
                <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">Boutique</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
                <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">{product.categorie}</Link>
                <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
                <span className="text-[#1C2620]">{product.nom}</span>
              </nav>
            </div>

            {/* HERO SECTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

                {/* GALLERY (Left) */}
                <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4 h-auto md:h-[650px]">

                  {/* Thumbnails */}
                  <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto w-full md:w-24 flex-shrink-0 scrollbar-hide py-1">
                    {product.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={`relative w-20 md:w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 bg-[#E3DFD2] ${i === activeImage ? 'border-[#1C2620] shadow-sm' : 'border-transparent hover:border-[#1C2620]/30'}`}
                      >
                        <img src={img.url} alt={`Miniature ${i+1}`} className="w-full h-full object-cover mix-blend-multiply opacity-90" />
                      </button>
                    ))}
                  </div>

                  {/* Main Image */}
                  <div className="relative flex-1 rounded-3xl overflow-hidden bg-[#E3DFD2] border border-[#DBD6C6] group">
                    <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur text-[10px] font-semibold text-[#1C2620] px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
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
                        src={product.images[activeImage]?.url || 'https://via.placeholder.com/400x300?text=No+Image'}
                        alt={product.images[activeImage]?.alt}
                        className="w-full h-full object-cover mix-blend-multiply"
                      />
                    </AnimatePresence>

                    <button className="absolute bottom-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-[#1C2620] shadow-sm hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100">
                      <Icon name="ArrowsPointingOutIcon" size={16} variant="outline" />
                    </button>
                  </div>
                </div>

                {/* PRODUCT INFO (Right) */}
                <div className="lg:col-span-5 flex flex-col justify-center">

                  <div className="mb-4">
                    <span className="inline-block bg-[#D3DFD7] text-[#2D5A3D] text-[9px] font-mono tracking-[0.2em] uppercase px-2.5 py-1 rounded-full mb-4">
                      Le sac essentiel
                    </span>
                    <h1 className="font-display font-800 text-4xl lg:text-[44px] leading-[1.1] text-[#1C2620] tracking-tight mb-3">
                      {firstWords} <em className="font-serif italic font-normal text-[#5C6B5E]">{lastWords}</em>.
                    </h1>
                    <div className="flex items-center gap-2 text-xs font-medium text-[#5C6B5E]">
                      <span className="flex items-center gap-1 text-[#B5652D]"><Icon name="StarIcon" size={12} /> 4.9</span>
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

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAddToCart()}
                        className={`flex-1 py-4 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2 ${cartAdded ? 'bg-emerald-600 text-white' : 'bg-[#1C2620] hover:bg-[#2A3830] text-white'}`}
                      >
                        {cartAdded ? (
                          <><Icon name="CheckCircleIcon" size={18} /> Ajouté</>
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
                <div className="aspect-[4/5] rounded-[2rem] overflow-hidden">
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
            <section className="mt-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-[#E8E4D8]">
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
                  <div key={item.title} className="bg-white rounded-2xl p-3 pr-5 flex items-center gap-4 shadow-sm border border-[#E8E4D8] hover:border-[#1C2620] transition-colors cursor-pointer group">
                    <div className="w-16 h-16 rounded-xl bg-[#EBE8DD] overflow-hidden flex-shrink-0">
                      <img src={item.img} alt={item.title} className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div>
                      <div className="text-[8px] font-mono tracking-widest text-[#5C6B5E] uppercase mb-0.5">{item.label}</div>
                      <div className="text-xs font-bold text-[#1C2620]">{item.title}</div>
                      <div className="text-xs text-[#1C2620] mt-0.5">{item.price}</div>
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
        <MobilePageShell>
          {/* Gallery */}
          <div className="relative w-full aspect-square bg-[#E8E4D8] overflow-hidden">
            {/* Back button */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <Link href="/boutique" className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-[#1C2620] shadow-sm">
                <Icon name="ChevronLeftIcon" size={18} variant="outline" />
              </Link>
            </div>

            {/* Favorite button */}
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className="absolute top-4 right-4 z-20 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-[#1C2620] shadow-sm"
            >
              <Icon name="HeartIcon" size={18} variant={isFavorite ? "solid" : "outline"} className={isFavorite ? "text-red-500" : ""} />
            </button>

            {/* Image Slider */}
            <div 
              className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide" 
              id="mobile-gallery"
              onScroll={(e) => {
                const target = e.currentTarget;
                const index = Math.round(target.scrollLeft / target.clientWidth);
                if (index !== activeImage) setActiveImage(index);
              }}
            >
              {product.images.map((img, i) => (
                <div key={i} className="w-full h-full flex-shrink-0 snap-start flex items-center justify-center bg-[#E3DFD2]">
                  <img src={img.url} alt={img.alt || product.nom} className="w-full h-full object-cover mix-blend-multiply" />
                </div>
              ))}
              {product.images.length === 0 && (
                <div className="w-full h-full flex items-center justify-center bg-[#E3DFD2] text-sm text-[#5C6B5E]">
                  Aucune image disponible
                </div>
              )}
            </div>

            {/* Paging indicators */}
            {product.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/10 backdrop-blur px-2.5 py-1 rounded-full">
                {product.images.map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${i === activeImage ? 'w-4 bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnails list */}
          {product.images.length > 1 && (
            <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide bg-[#F5F2E9]">
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
                  className={`w-12 h-12 rounded-xl overflow-hidden border-2 flex-shrink-0 bg-[#E3DFD2] ${i === activeImage ? 'border-[#1C2620]' : 'border-transparent'}`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover mix-blend-multiply" />
                </button>
              ))}
            </div>
          )}

          {/* Info section */}
          <div className="px-5 pt-6 pb-4">
            <span className="inline-block bg-[#D3DFD7] text-[#2C5A3D] text-[9px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full mb-2">
              {product.categorie}
            </span>
            <h1 className="font-display font-800 text-2xl text-[#0B1F17] leading-tight">
              {product.nom}
            </h1>
            <div className="text-xs text-[#5C6B5E] mt-1 font-medium">
              Par <span className="font-semibold text-[#1C2620]">{product.marque}</span>
            </div>

            {/* Price & Rating */}
            <div className="flex items-center justify-between mt-4 pb-4 border-b border-[#E8E4D8]">
              <div>
                <span className="text-2xl font-bold text-[#17402C]">
                  {product.prix_cents > 0 ? `${(product.prix_cents / 100).toFixed(2)} €` : '—'}
                </span>
                <span className="text-[10px] text-[#8B978F] block">TVA incluse</span>
              </div>
              
              <div className="flex items-center gap-1.5 text-xs text-[#5C6B5E] bg-[#F4F1EA] px-2.5 py-1.5 rounded-xl">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#A8C8A0" stroke="#A8C8A0">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="font-bold text-[#1C2620]">{product.rating}</span>
                <span>({product.review_count || 12} avis)</span>
              </div>
            </div>
          </div>

          {/* Specifications Accordion/Grid */}
          <div className="px-5 py-2">
            <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-wider mb-3">Caractéristiques</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F4F1EA] p-3 rounded-2xl">
                <div className="text-[10px] uppercase text-[#6B7A72] tracking-wider">Poids</div>
                <div className="text-sm font-semibold text-[#0B1F17] mt-0.5">
                  {product.poids_g > 0 ? `${(product.poids_g / 1000).toFixed(2)} kg` : '—'}
                </div>
              </div>
              <div className="bg-[#F4F1EA] p-3 rounded-2xl">
                <div className="text-[10px] uppercase text-[#6B7A72] tracking-wider">Matière</div>
                <div className="text-sm font-semibold text-[#0B1F17] mt-0.5 truncate" title={product.materials || '—'}>
                  {product.materials || 'Non spécifiée'}
                </div>
              </div>
              <div className="bg-[#F4F1EA] p-3 rounded-2xl">
                <div className="text-[10px] uppercase text-[#6B7A72] tracking-wider">Dimensions</div>
                <div className="text-sm font-semibold text-[#0B1F17] mt-0.5 truncate" title={product.dimensions || '—'}>
                  {product.dimensions || 'Non spécifiées'}
                </div>
              </div>
              <div className="bg-[#F4F1EA] p-3 rounded-2xl">
                <div className="text-[10px] uppercase text-[#6B7A72] tracking-wider">Garantie</div>
                <div className="text-sm font-semibold text-[#0B1F17] mt-0.5">
                  {product.warranty || '2 ans'}
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-wider mb-2">Options</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: any, i: number) => (
                  <button
                    key={i}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border bg-white border-[#E8E4D8] text-[#1C2620]"
                  >
                    {v.size || v.name || v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="px-5 py-4 pb-24">
            <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-wider mb-2">Présentation</h3>
            <p className="text-sm text-[#384A42] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {/* Buy bar */}
          <ProductBuyBar
            price={product.prix_cents / 100}
            onAddToCart={(qty) => {
              handleAddToCart(qty);
            }}
          />
        </MobilePageShell>
      </div>
    </>
  );
}