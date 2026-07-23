'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const PRODUCTS = [
  {
    id: 'sac',
    category: 'PORTAGE · LE SAC ESSENTIEL',
    name: 'Le sac 45 L',
    nameItalic: 'toile cirée.',
    description: 'Trois compartiments, une bandoulière ventrale, un point d\'accroche pour tapis de sol. Fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.',
    price: 340,
    originalPrice: 395,
    discount: '-14 %',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    alt: 'Sac à dos 45L en toile cirée verte, fabriqué dans les Alpes-de-Haute-Provence',
    href: '/boutique',
    featured: true,
  },
];

const GRID_PRODUCTS = [
  {
    id: 'duvet',
    category: 'COUCHAGE',
    name: 'Duvet en plumes',
    nameItalic: 'trois saisons.',
    price: 248,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    alt: 'Duvet en plumes trois saisons vert, léger et compressible pour le bivouac',
    href: '/boutique',
  },
  {
    id: 'tente',
    category: 'COUCHAGE',
    name: 'Tente légère',
    nameItalic: 'deux places.',
    price: 418,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    alt: 'Tente légère deux places orange montée en pleine nature',
    href: '/boutique',
  },
  {
    id: 'gourde',
    category: 'HYDRATATION',
    name: 'Gourde titane',
    nameItalic: '1 L.',
    price: 68,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80',
    alt: 'Gourde en titane 1 litre verte, légère et indestructible',
    href: '/boutique',
  },
  {
    id: 'veste',
    category: 'VÊTEMENTS',
    name: 'Veste 3 couches',
    nameItalic: 'toutes saisons.',
    price: 312,
    image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80',
    alt: 'Veste 3 couches verte imperméable pour toutes les saisons',
    href: '/boutique',
  },
  {
    id: 'frontale',
    category: 'ÉCLAIRAGE',
    name: 'Lampe frontale',
    nameItalic: '350 lumens.',
    price: 84,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    alt: 'Lampe frontale 350 lumens rechargeable pour la randonnée nocturne',
    href: '/boutique',
  },
  {
    id: 'configurateur',
    category: 'ASSISTANT',
    name: 'Composer',
    nameItalic: 'votre sac.',
    price: null,
    image: null,
    alt: '',
    href: '/configurateur',
    isAssistant: true,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F3EE' }}>
      <Header />

      {/* Hero Section */}
      <section className="pt-14 md:pt-14">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[calc(100vh-56px)]">
            {/* Left — text */}
            <div className="flex flex-col justify-center py-16 lg:py-24 pr-0 lg:pr-16">
              {/* Overline */}
              <p
                className="mb-6 text-[#4A6355]"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}
              >
                NOUVEAUTÉ · LE SAC ESSENTIEL
              </p>

              {/* H1 */}
              <h1 className="mb-6" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0E1512' }}>
                Six objets,{' '}
                <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                  rien de plus.
                </em>
              </h1>

              {/* Body */}
              <p className="mb-8 text-[#4A6355] leading-relaxed" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', maxWidth: '440px' }}>
                Testé six semaines minimum sur le terrain. Ce qui reste, on le garde. Ce qui casse retourne d&apos;où ça vient.
              </p>

              {/* Featured product */}
              <div className="mb-8 pb-8 border-b border-[#E0DDD0]">
                <p
                  className="mb-1 text-[#4A6355]"
                  style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                >
                  PORTAGE
                </p>
                <h2 className="mb-2" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.02em', color: '#0E1512' }}>
                  Le sac 45 L{' '}
                  <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                    toile cirée.
                  </em>
                </h2>
                <p className="text-sm text-[#4A6355] mb-4 leading-relaxed" style={{ maxWidth: '400px' }}>
                  Trois compartiments, une bandoulière ventrale, un point d&apos;accroche pour tapis de sol. Fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.
                </p>
                {/* Price */}
                <div className="flex items-center gap-3 mb-5">
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.25rem', fontWeight: 600, color: '#0E1512' }}>340 €</span>
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.875rem', color: '#9AAD9E', textDecoration: 'line-through' }}>395 €</span>
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', backgroundColor: '#1C2620', color: '#FFFFFF', padding: '0.125rem 0.375rem', borderRadius: '2px' }}>
                    -14 %
                  </span>
                </div>
                {/* CTAs */}
                <div className="flex items-center gap-3">
                  <Link
                    href="/boutique"
                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-[#1C2620] border border-[#1C2620] hover:bg-[#1C2620] hover:text-white transition-all duration-150"
                    style={{ borderRadius: '2px', minHeight: '44px' }}
                  >
                    Découvrir le sac
                  </Link>
                  <button
                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all duration-150"
                    style={{ borderRadius: '2px', minHeight: '44px' }}
                  >
                    Ajouter au panier
                  </button>
                </div>
              </div>
            </div>

            {/* Right — image */}
            <div className="hidden lg:flex items-center justify-center bg-[#EBF0EB] relative overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&q=85"
                alt="Sac à dos 45L en toile cirée verte, fabriqué dans les Alpes-de-Haute-Provence"
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product Grid Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          {/* Section heading */}
          <h2 className="mb-12" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
            Le{' '}
            <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
              reste
            </em>{' '}
            du kit.
          </h2>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#E0DDD0]">
            {GRID_PRODUCTS.map((product) => (
              <Link
                key={product.id}
                href={product.href}
                className={`group block bg-white p-6 hover:bg-[#F5F3EE] transition-colors duration-150 ${product.isAssistant ? 'bg-[#1C2620] hover:bg-[#243028]' : ''}`}
              >
                {product.isAssistant ? (
                  <div className="flex flex-col h-full min-h-[200px] justify-between">
                    <p
                      className="text-[#6B8A7A]"
                      style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                    >
                      {product.category}
                    </p>
                    <div>
                      <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                        {product.name}{' '}
                        <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                          {product.nameItalic}
                        </em>
                      </p>
                      <p className="mt-2 text-sm text-[#6B8A7A]">4 questions · résultat sur mesure</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Product image */}
                    <div className="aspect-square mb-4 overflow-hidden bg-[#EBF0EB]">
                      <img
                        src={product.image!}
                        alt={product.alt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <p
                      className="mb-1 text-[#4A6355]"
                      style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                    >
                      {product.category}
                    </p>
                    <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#0E1512', letterSpacing: '-0.01em' }}>
                      {product.name}{' '}
                      <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                        {product.nameItalic}
                      </em>
                    </p>
                    {product.price && (
                      <p className="mt-1" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: '#0E1512' }}>
                        {product.price} €
                      </p>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Method Section */}
      <section className="py-20" style={{ backgroundColor: '#F5F3EE' }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <div className="aspect-[4/3] overflow-hidden bg-[#EBF0EB]">
              <img
                src="https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?w=800&q=80"
                alt="Atelier de fabrication avec machine à coudre JUKI et outils artisanaux"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Text */}
            <div>
              <p
                className="mb-4 text-[#4A6355]"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}
              >
                NOTRE MÉTHODE
              </p>
              <h2 className="mb-5" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
                Six semaines en{' '}
                <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
                  Chartreuse.
                </em>
              </h2>
              <p className="text-[#4A6355] leading-relaxed mb-6" style={{ fontSize: '1rem' }}>
                Chaque objet passe six semaines dans le sac de trois testeurs. On note ce qui casse, ce qui use, ce qui étonne. Puis on décide.
              </p>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1C2620] hover:text-[#4A6355] transition-colors"
              >
                Lire notre méthode
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tagline Section */}
      <section className="py-20 bg-[#0E1512]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <p
            className="mb-4 text-white"
            style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}
          >
            Ce que vous emportez,{' '}
            <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: '#9AAD9E' }}>
              c&apos;est votre voyage.
            </em>
          </p>
          <p className="text-[#4A6355] text-sm tracking-wider mt-6">
            Grenoble, France · Fabriqué en Europe · Réparable à vie
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
