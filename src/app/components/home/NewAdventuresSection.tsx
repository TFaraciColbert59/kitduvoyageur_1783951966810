'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const ADVENTURES = [
  {
    slug: 'chartreuse-sentier-balcons',
    title: 'Chartreuse',
    subtitle: 'sentier des balcons',
    meta: '4 jours · 68 km',
    tags: ['+ 6 km', 'Niveau pratiqué', 'Guide Raphi'],
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=85',
    alt: 'Vue aérienne du massif de la Chartreuse avec sentiers de randonnée et forêts denses',
    span: 'lg:col-span-1',
    featured: false,
  },
  {
    slug: 'bivouac-etoile-vercors',
    title: 'Bivouac étoilé',
    subtitle: 'Vercors',
    meta: '2 nuits',
    tags: ['Plateau haut', 'Tente incluse'],
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=85',
    alt: 'Tente de bivouac sous un ciel étoilé dans le Vercors avec voie lactée visible',
    span: 'lg:col-span-1',
    featured: true,
  },
  {
    slug: 'kayak-serre-poncon',
    title: 'Kayak',
    subtitle: 'Serre-Ponçon',
    meta: '1 jour',
    tags: ['Lac glaciaire', 'Débutants OK'],
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=85',
    alt: 'Kayakiste sur le lac de Serre-Ponçon avec montagnes enneigées en arrière-plan',
    span: 'lg:col-span-1',
    featured: false,
  },
];

export default function NewAdventuresSection() {
  return (
    <section
      className="py-20 sm:py-24 lg:py-32"
      style={{ background: 'var(--background)' }}
      aria-labelledby="adventures-title"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 lg:mb-16">
          <div>
            <h2
              id="adventures-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
                lineHeight: '1.05',
                letterSpacing: '-0.035em',
                color: '#1C2620',
              }}
            >
              Trois façons
              <br />
              de se <em style={{ fontStyle: 'italic', color: '#4A6355' }}>perdre.</em>
            </h2>
          </div>
          <p
            style={{
              color: '#6B8A7A',
              fontSize: '15px',
              lineHeight: '1.65',
              maxWidth: '340px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Trois cartes qui suivent la même règle : même d&apos;équipement, plus de silence. Choisissez celle qui vous ressemble aujourd&apos;hui.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {ADVENTURES?.map((adv) => (
            <Link
              key={adv?.slug}
              href={`/explorer`}
              className={`group relative overflow-hidden block ${adv?.span}`}
              style={{
                borderRadius: '20px',
                aspectRatio: '4/5',
              }}
              aria-label={`Découvrir ${adv?.title} ${adv?.subtitle}`}
            >
              {/* Image */}
              <AppImage
                src={adv?.image}
                alt={adv?.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {/* Gradient overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(14,21,18,0.85) 0%, rgba(14,21,18,0.3) 50%, rgba(14,21,18,0.05) 100%)',
                }}
                aria-hidden="true"
              />

              {/* Featured badge */}
              {adv?.featured && (
                <div
                  className="absolute top-4 right-4 flex items-center justify-center"
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'rgba(231,227,214,0.15)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                  }}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </div>
              )}

              {/* Meta badge */}
              <div
                className="absolute top-4 left-4"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: '999px',
                  padding: '5px 12px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                  {adv?.meta}
                </span>
              </div>

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 'clamp(1.3rem, 2.5vw, 1.6rem)',
                    color: '#FFFFFF',
                    lineHeight: '1.15',
                    marginBottom: '4px',
                  }}
                >
                  {adv?.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
                    color: 'rgba(255,255,255,0.65)',
                    fontStyle: 'italic',
                    lineHeight: '1.2',
                    marginBottom: '12px',
                  }}
                >
                  {adv?.subtitle}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {adv?.tags?.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '11px',
                        color: 'rgba(231,227,214,0.7)',
                        fontFamily: 'var(--font-sans)',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
