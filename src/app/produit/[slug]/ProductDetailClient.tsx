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
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [cartAdded, setCartAdded] = useState(false);
  const [selectedColor, setSelectedColor] = useState('vert');
  const [selectedVolume, setSelectedVolume] = useState('45 L');
  const [selectedStrap, setSelectedStrap] = useState('Ventrale + poitrine');
  const [isFavorite, setIsFavorite] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('shop_products')
          .select('*')
          .eq('slug', slug)
          .single();
        
        if (data && !error) {
          setProduct({
            id: data.id,
            slug: data.slug,
            nom: data.name,
            marque: data.brand ?? 'Marque',
            categorie: data.category_main ?? data.category ?? 'Équipement',
            description: data.description_why ?? "Trois compartiments, une bandoulière ventrale, un point d'accroche pour tapis de sol. Coton huilé 12 oz, fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.",
            prix_cents: Math.round(Number(data.price_eur ?? 340) * 100),
            poids_g: data.weight_g ?? 1200,
            images: [
              { url: data.image ?? 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: data.name },
              { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Détail 1' },
              { url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', alt: 'Détail 2' },
              { url: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80', alt: 'Détail 3' },
              { url: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80', alt: 'Détail 4' }
            ],
            tags: [],
          });
        } else {
          // Fallback matching mockup
          setProduct({
            id: slug,
            slug,
            nom: 'Sac 45 L toile cirée',
            marque: 'Le Kit du Voyageur',
            categorie: 'Portage',
            description: "Trois compartiments, une bandoulière ventrale, un point d'accroche pour tapis de sol. Coton huilé 12 oz, fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.",
            prix_cents: 34000,
            poids_g: 1200,
            images: [
              { url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Sac 45 L toile cirée' },
              { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Détail' },
              { url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', alt: 'Détail 2' },
              { url: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80', alt: 'Détail 3' },
              { url: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80', alt: 'Détail 4' }
            ],
            tags: [],
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

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

  if (!product) return null;

  const handleAddToCart = () => {
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
    });
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 3000);
  };

  const titleWords = product.nom.split(' ');
  const lastWords = titleWords.slice(-2).join(' ');
  const firstWords = titleWords.slice(0, -2).join(' ');

  return (
    <div className="min-h-screen bg-[#EBE8DD] text-[#1C2620] font-sans selection:bg-[#E4501C]/20">
      <Header />
      
      <main id="main-content" className="pt-24 pb-16">
        
        {/* BREADCRUMB */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <nav className="flex items-center gap-2 text-[11px] text-[#5C6B5E] font-medium tracking-wide">
            <Link href="/" className="hover:text-[#1C2620] transition-colors">Accueil</Link>
            <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
            <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">Boutique</Link>
            <Icon name="ChevronRightIcon" size={10} variant="outline" className="opacity-50" />
            <Link href="/catalogue" className="hover:text-[#1C2620] transition-colors">{product.categorie}</Link>
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
                    src={product.images[activeImage]?.url}
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
                    {[
                      { id: 'vert', color: '#445749' },
                      { id: 'moutarde', color: '#B89B60' },
                      { id: 'noir', color: '#2B302C' },
                      { id: 'bleu', color: '#A1B2BA' },
                    ].map(c => (
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
                    <span className="font-display font-800 text-[28px] text-[#1C2620]">{(product.prix_cents / 100).toFixed(0)} €</span>
                    <span className="text-xs text-[#5C6B5E]">- TVA incluse</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#2D5A3D]">
                    <span className="w-1.5 h-1.5 bg-[#2D5A3D] rounded-full"></span>
                    En stock - expédié sous 48 h
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddToCart}
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
                    className={`w-[52px] h-[52px] rounded-full border flex items-center justify-center transition-colors flex-shrink-0 relative overflow-hidden ${isFavorite ? 'border-[#E4501C] bg-[#E4501C]/10 text-[#E4501C]' : 'border-[#C8C3B0] bg-white hover:bg-[#E3DFD2] text-[#1C2620]'}`}
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
  );
}