'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const STATS = [
  { value: '47', suffix: '+', label: 'Refuges partenaires' },
  { value: '1,4', suffix: 'kg', label: 'Sac de base à vie' },
  { value: '6', suffix: 'sem.', label: 'Test terrain minimum' },
  { value: '100', suffix: '%', label: 'Fabriqué en Europe' },
];

export default function NewPromiseSection() {
  return (
    <section
      className="py-20 sm:py-24 lg:py-32"
      style={{ background: '#1C2620' }}
      aria-labelledby="promise-title"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: Text content */}
          <div>
            <p
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#6B8A7A',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '20px',
              }}
            >
              Notre promesse
            </p>

            <h2
              id="promise-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(2.4rem, 5vw, 4rem)',
                lineHeight: '1.05',
                letterSpacing: '-0.04em',
                color: '#FFFFFF',
                marginBottom: '24px',
              }}
            >
              Un sac. Une carte.
              <br />
              Le <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)' }}>reste</em> vient de
              <br />
              vous.
            </h2>

            <p
              style={{
                color: 'rgba(231,227,214,0.55)',
                fontSize: '16px',
                lineHeight: '1.7',
                maxWidth: '440px',
                marginBottom: '40px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Nous testons chaque objet en conditions réelles pendant six semaines minimum. Ceux qui restent trouvent leur place dans le kit. Les autres retournent d&apos;où ils viennent.
            </p>

            <Link
              href="/guides"
              className="inline-flex items-center gap-2.5 font-medium transition-all duration-200 hover:gap-3.5"
              style={{
                color: 'rgba(231,227,214,0.8)',
                fontSize: '15px',
                fontFamily: 'var(--font-sans)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.04)',
                marginBottom: '48px',
              }}
            >
              Lire notre méthode
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-8">
              {STATS?.map((stat) => (
                <div key={stat?.label}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
                      lineHeight: '1',
                      color: '#FFFFFF',
                      letterSpacing: '-0.03em',
                      marginBottom: '6px',
                    }}
                  >
                    {stat?.value}
                    <span
                      style={{
                        fontSize: '0.55em',
                        fontStyle: 'italic',
                        color: 'rgba(255,255,255,0.5)',
                        marginLeft: '2px',
                      }}
                    >
                      {stat?.suffix}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: '#6B8A7A',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {stat?.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Image */}
          <div className="relative">
            <div
              className="relative overflow-hidden"
              style={{
                borderRadius: '20px',
                aspectRatio: '4/5',
              }}
            >
              <AppImage
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=85"
                alt="Randonneur sur un sentier de montagne dans la Chartreuse avec vue panoramique sur les vallées"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              {/* Subtle gradient on image */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(28,38,32,0.5) 0%, transparent 50%)',
                }}
                aria-hidden="true"
              />
              {/* Caption */}
              <div
                className="absolute bottom-5 left-5 right-5"
                style={{
                  background: 'rgba(14,21,18,0.6)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                }}
              >
                <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#6B8A7A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '3px' }}>Reportage</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', fontFamily: 'var(--font-sans)' }}>Trois jours dans la Chartreuse</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
