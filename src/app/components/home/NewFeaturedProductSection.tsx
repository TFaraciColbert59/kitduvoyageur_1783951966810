'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const SPECS = [
  { label: 'Volume', value: '45 litres' },
  { label: 'Poids à sec', value: '1,4 kg' },
  { label: 'Toile', value: 'Coton huilé 12 oz' },
  { label: 'Garantie', value: 'À vie' },
];

export default function NewFeaturedProductSection() {
  return (
    <section
      className="py-20 sm:py-24 lg:py-32"
      style={{ background: 'var(--background)' }}
      aria-labelledby="product-title"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: Product image */}
          <div className="relative">
            {/* Edition badge */}
            <div
              className="absolute top-5 left-5 z-10"
              style={{
                background: 'rgba(231,227,214,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(28,38,32,0.12)',
                borderRadius: '999px',
                padding: '6px 14px',
              }}
            >
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#4A6355', letterSpacing: '0.1em' }}>
                ✦ Édition automne
              </span>
            </div>

            <div
              className="relative overflow-hidden"
              style={{
                borderRadius: '24px',
                background: '#E0DDD0',
                aspectRatio: '4/5',
              }}
            >
              <AppImage
                src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&q=85"
                alt="Sac à dos 45 litres en toile cirée couleur kaki, édition automne Le Kit du Voyageur, posé sur fond neutre"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
          </div>

          {/* Right: Product info */}
          <div>
            <p
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#6B8A7A',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              Le sac essentiel
            </p>

            <h2
              id="product-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
                lineHeight: '1.1',
                letterSpacing: '-0.035em',
                color: '#1C2620',
                marginBottom: '20px',
              }}
            >
              45 L, <em style={{ fontStyle: 'italic', color: '#4A6355' }}>toile cirée,</em>
              <br />
              rien de superflu.
            </h2>

            <p
              style={{
                color: '#6B8A7A',
                fontSize: '16px',
                lineHeight: '1.7',
                maxWidth: '420px',
                marginBottom: '36px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Trois compartiments, une bandoulière ventrale, un point d&apos;accroche pour tapis de sol. Fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.
            </p>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-10">
              {SPECS?.map((spec) => (
                <div key={spec?.label}>
                  <p
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: '#9AAD9E',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                    }}
                  >
                    {spec?.label}
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1C2620',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {spec?.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Price */}
            <div
              style={{
                borderTop: '1px solid rgba(28,38,32,0.1)',
                paddingTop: '24px',
                marginBottom: '28px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '2.5rem',
                  color: '#1C2620',
                  lineHeight: '1',
                  letterSpacing: '-0.03em',
                }}
              >
                340 €
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/boutique"
                className="inline-flex items-center gap-2 font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{
                  background: '#1C2620',
                  color: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 4px 16px rgba(28,38,32,0.2)',
                }}
              >
                Ajouter au sac
              </Link>
              <Link
                href="/boutique"
                className="inline-flex items-center gap-2 font-medium transition-all duration-200 hover:text-[#1C2620]"
                style={{
                  color: '#4A6355',
                  fontSize: '15px',
                  fontFamily: 'var(--font-sans)',
                  padding: '14px 20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(28,38,32,0.15)',
                }}
              >
                Voir la fiche
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
