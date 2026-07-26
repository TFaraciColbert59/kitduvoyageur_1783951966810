'use client';

import React, { useState } from 'react';
import Link from 'next/link';


const FOOTER_COLS = [
  {
    title: 'Découvrir',
    links: [
      { label: 'Aventures', href: '/explorer' },
      { label: 'Refuges', href: '/explorer' },
      { label: 'Guides', href: '/guides' },
      { label: 'Communauté', href: '/communaute' },
    ],
  },
  {
    title: 'Boutique',
    links: [
      { label: 'Le sac', href: '/boutique' },
      { label: 'Bivouac', href: '/boutique' },
      { label: 'Vêtements', href: '/boutique' },
      { label: 'Livres & cartes', href: '/boutique' },
    ],
  },
  {
    title: 'Maison',
    links: [
      { label: 'Notre méthode', href: '/guides' },
      { label: 'Ateliers', href: '/evenements' },
      { label: 'Emploi', href: '/contact' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

export default function NewFooterSection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <footer
      style={{ background: '#0E1512' }}
      role="contentinfo"
    >
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-16 pb-12 sm:pt-20 sm:pb-16">

        {/* Top: Brand tagline */}
        <div
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            paddingBottom: '48px',
            marginBottom: '48px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              lineHeight: '1.1',
              letterSpacing: '-0.04em',
              color: '#FFFFFF',
              maxWidth: '600px',
            }}
          >
            Ce que vous emportez,{' '}
            <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.45)' }}>c&apos;est votre voyage.</em>
          </h2>
        </div>

        {/* Grid: newsletter + nav cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

          {/* Newsletter */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#4A6355',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              Recevez le journal
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(231,227,214,0.45)',
                fontFamily: 'var(--font-sans)',
                lineHeight: '1.6',
                marginBottom: '16px',
              }}
            >
              Un essai par saison. Refuges, sentiers, matériel. Rien d&apos;autre.
            </p>

            {submitted ? (
              <p style={{ fontSize: '13px', color: '#6B8A7A', fontFamily: 'var(--font-sans)' }}>
                ✓ Vous êtes inscrit.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.fr"
                  required
                  className="flex-1 min-w-0 outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-sans)',
                  }}
                  aria-label="Votre adresse email"
                />
                <button
                  type="submit"
                  className="flex-shrink-0 font-semibold transition-all duration-200 hover:opacity-90"
                  style={{
                    background: '#33463C',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  S&apos;abonner
                </button>
              </form>
            )}
          </div>

          {/* Nav columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#4A6355',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                }}
              >
                {col.title}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{
                        fontSize: '14px',
                        color: 'rgba(231,227,214,0.45)',
                        fontFamily: 'var(--font-sans)',
                        transition: 'color 200ms',
                      }}
                      className="hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p
            style={{
              fontSize: '12px',
              color: 'rgba(231,227,214,0.25)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            © 2026 Le Kit du Voyageur · Grenoble, France
          </p>
          <div className="flex items-center gap-4">
            {[
              { label: 'Mentions', href: '/mentions-legales' },
              { label: 'Confidentialité', href: '/politique-confidentialite' },
              { label: 'Cookies', href: '/cookies' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  fontSize: '12px',
                  color: 'rgba(231,227,214,0.25)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'color 200ms',
                }}
                className="hover:text-white/50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
