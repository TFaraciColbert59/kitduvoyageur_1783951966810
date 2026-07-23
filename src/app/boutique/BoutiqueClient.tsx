'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { addToCart } from '@/lib/cart';

const PRODUCTS = [
  {
    id: 'sac-45l',
    slug: 'sac-45l-toile-ciree',
    category: 'PORTAGE',
    badge: 'NOUVEAUTÉ · LE SAC ESSENTIEL',
    name: 'Le sac 45 L',
    nameItalic: 'toile cirée.',
    description: 'Trois compartiments, une bandoulière ventrale, un point d\'accroche pour tapis de sol. Fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.',
    price: 340,
    originalPrice: 395,
    discount: '-14 %',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    alt: 'Sac à dos 45L en toile cirée verte, fabriqué dans les Alpes-de-Haute-Provence',
    featured: true,
    weightG: 1200,
    brand: 'Le Kit du Voyageur',
  },
  {
    id: 'duvet-3-saisons',
    slug: 'duvet-3-saisons',
    category: 'COUCHAGE',
    name: 'Duvet en plumes',
    nameItalic: 'trois saisons.',
    description: 'Duvet en plumes d\'oie, garnissage 650 cuin. Compressible, léger, chaud jusqu\'à -10°C.',
    price: 248,
    originalPrice: null,
    discount: null,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    alt: 'Duvet en plumes trois saisons vert, léger et compressible pour le bivouac',
    featured: false,
    weightG: 800,
    brand: 'Le Kit du Voyageur',
  },
  {
    id: 'tente-2p',
    slug: 'tente-legere-2-places',
    category: 'COUCHAGE',
    name: 'Tente légère',
    nameItalic: 'deux places.',
    description: 'Tente ultra-légère 2 places, double paroi, montage en 3 minutes.',
    price: 418,
    originalPrice: null,
    discount: null,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    alt: 'Tente légère deux places orange montée en pleine nature',
    featured: false,
    weightG: 1100,
    brand: 'Le Kit du Voyageur',
  },
  {
    id: 'gourde-titane',
    slug: 'gourde-titane-1l',
    category: 'HYDRATATION',
    badge: 'NOUVEAU',
    name: 'Gourde titane',
    nameItalic: '1 L.',
    description: 'Gourde en titane pur, isotherme 12h. Indestructible, légère, sans goût.',
    price: 68,
    originalPrice: null,
    discount: null,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
    alt: 'Gourde en titane 1 litre verte, légère et indestructible',
    featured: false,
    weightG: 180,
    brand: 'Le Kit du Voyageur',
  },
  {
    id: 'veste-3-couches',
    slug: 'veste-3-couches',
    category: 'VÊTEMENTS',
    name: 'Veste 3 couches',
    nameItalic: 'toutes saisons.',
    description: 'Veste imperméable 3 couches, respirante, légère. Coutures soudées, capuche ajustable.',
    price: 312,
    originalPrice: null,
    discount: null,
    image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&q=80',
    alt: 'Veste 3 couches verte imperméable pour toutes les saisons',
    featured: false,
    weightG: 450,
    brand: 'Le Kit du Voyageur',
  },
  {
    id: 'lampe-frontale',
    slug: 'lampe-frontale-350lm',
    category: 'ÉCLAIRAGE',
    name: 'Lampe frontale',
    nameItalic: '350 lumens.',
    description: 'Autonomie 45h, batterie rechargeable USB-C. Souvent oubliée, jamais regrettée.',
    price: 84,
    originalPrice: null,
    discount: null,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    alt: 'Lampe frontale 350 lumens rechargeable pour la randonnée nocturne',
    featured: false,
    weightG: 95,
    brand: 'Le Kit du Voyageur',
  },
];

const CATEGORIES = ['Tous', 'PORTAGE', 'COUCHAGE', 'HYDRATATION', 'VÊTEMENTS', 'ÉCLAIRAGE'];

export default function BoutiqueClient() {
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [addedId, setAddedId] = useState<string | null>(null);

  const filtered = activeCategory === 'Tous'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === activeCategory);

  const featured = PRODUCTS[0];

  const handleAddToCart = (product: typeof PRODUCTS[0]) => {
    addToCart({
      id: product.id,
      slug: product.slug,
      name: `${product.name} ${product.nameItalic}`,
      priceEur: product.price,
      image: product.image,
      imageAlt: product.alt,
      quantity: 1,
      weightG: product.weightG,
      brand: product.brand,
      category: product.category,
    });
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1500);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F3EE' }}>
      <Header />

      {/* Hero / Featured product */}
      <section className="pt-14 md:pt-14 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Text */}
            <div className="flex flex-col justify-center py-16 lg:py-20 pr-0 lg:pr-16">
              {/* Overline */}
              <p
                className="mb-5 text-[#4A6355]"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}
              >
                {featured.badge}
              </p>
              {/* H1 */}
              <h1 className="mb-5" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0E1512' }}>
                Six objets,{' '}
                <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                  rien de plus.
                </em>
              </h1>
              <p className="text-[#4A6355] leading-relaxed mb-8" style={{ fontSize: '0.9375rem', maxWidth: '420px' }}>
                Testé six semaines minimum sur le terrain. Ce qui reste, on le garde. Ce qui casse retourne d&apos;où ça vient.
              </p>

              {/* Featured product card */}
              <div className="border border-[#E0DDD0] p-6" style={{ borderRadius: '2px' }}>
                <p
                  className="mb-1 text-[#4A6355]"
                  style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                >
                  {featured.category}
                </p>
                <h2 className="mb-2" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', color: '#0E1512' }}>
                  {featured.name}{' '}
                  <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                    {featured.nameItalic}
                  </em>
                </h2>
                <p className="text-sm text-[#4A6355] mb-4 leading-relaxed">{featured.description}</p>
                <div className="flex items-center gap-3 mb-5">
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.125rem', fontWeight: 600, color: '#0E1512' }}>{featured.price} €</span>
                  {featured.originalPrice && (
                    <span style={{ fontSize: '0.875rem', color: '#9AAD9E', textDecoration: 'line-through' }}>{featured.originalPrice} €</span>
                  )}
                  {featured.discount && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', backgroundColor: '#1C2620', color: '#FFFFFF', padding: '0.125rem 0.375rem', borderRadius: '2px' }}>
                      {featured.discount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/produit/${featured.slug}`}
                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-[#1C2620] border border-[#1C2620] hover:bg-[#1C2620] hover:text-white transition-all duration-150"
                    style={{ borderRadius: '2px', minHeight: '44px' }}
                  >
                    Découvrir le sac
                  </Link>
                  <button
                    onClick={() => handleAddToCart(featured)}
                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all duration-150"
                    style={{ borderRadius: '2px', minHeight: '44px' }}
                  >
                    {addedId === featured.id ? '✓ Ajouté' : 'Ajouter au panier'}
                  </button>
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="hidden lg:block bg-[#EBF0EB] overflow-hidden" style={{ minHeight: '500px' }}>
              <img
                src={featured.image}
                alt={featured.alt}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          {/* Section heading */}
          <div className="flex items-end justify-between mb-10">
            <h2 style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
              Le{' '}
              <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                reste
              </em>{' '}
              du kit.
            </h2>
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-4 py-2 text-xs font-semibold transition-all duration-150"
                style={{
                  borderRadius: '2px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  border: activeCategory === cat ? '1.5px solid #1C2620' : '1.5px solid #E0DDD0',
                  backgroundColor: activeCategory === cat ? '#1C2620' : 'transparent',
                  color: activeCategory === cat ? '#FFFFFF' : '#4A6355',
                  fontFamily: '"General Sans", "DM Sans", sans-serif',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E0DDD0]">
            {filtered.map((product) => (
              <div key={product.id} className="bg-white group">
                {/* Image */}
                <div className="aspect-square overflow-hidden bg-[#EBF0EB]">
                  <img
                    src={product.image}
                    alt={product.alt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                {/* Info */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className="text-[#4A6355]"
                      style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                    >
                      {product.category}
                    </p>
                    {product.badge && (
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', backgroundColor: '#EBF0EB', color: '#1C2620', padding: '0.125rem 0.375rem', borderRadius: '2px', textTransform: 'uppercase' }}>
                        {product.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="mb-1" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em', color: '#0E1512' }}>
                    {product.name}{' '}
                    <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                      {product.nameItalic}
                    </em>
                  </h3>
                  <p className="text-xs text-[#4A6355] mb-3 leading-relaxed line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#0E1512' }}>{product.price} €</span>
                      {product.originalPrice && (
                        <span style={{ fontSize: '0.8125rem', color: '#9AAD9E', textDecoration: 'line-through' }}>{product.originalPrice} €</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all duration-150"
                      style={{ borderRadius: '2px', minHeight: '36px' }}
                    >
                      {addedId === product.id ? '✓' : '+ Panier'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Configurateur card */}
            <Link
              href="/configurateur"
              className="bg-[#1C2620] group flex flex-col p-6 hover:bg-[#243028] transition-colors duration-150"
              style={{ minHeight: '300px' }}
            >
              <p
                className="text-[#6B8A7A] mb-auto"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
              >
                ASSISTANT
              </p>
              <div>
                <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Composer{' '}
                  <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                    votre sac.
                  </em>
                </p>
                <p className="mt-2 text-sm text-[#6B8A7A]">4 questions · résultat sur mesure</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Brand tagline */}
      <section className="py-16 bg-white border-t border-[#E0DDD0]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <p
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', color: '#0E1512', lineHeight: 1.3 }}
          >
            Ce que vous emportez, c&apos;est votre voyage.
          </p>
          <p className="mt-4 text-xs text-[#4A6355] tracking-wider">
            Grenoble, France · Fabriqué en Europe · Réparable à vie
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
