'use client';

import React from 'react';
import Link from 'next/link';

const FOOTER_COLS = [
  {
    title: 'BOUTIQUE',
    links: [
      { label: 'Le sac', href: '/boutique' },
      { label: 'Bivouac', href: '/boutique' },
      { label: 'Vêtements', href: '/boutique' },
      { label: 'Configurateur', href: '/configurateur' },
    ],
  },
  {
    title: 'MAISON',
    links: [
      { label: 'Notre méthode', href: '/blog' },
      { label: 'Ateliers', href: '/blog' },
      { label: 'Testeurs', href: '/blog' },
    ],
  },
  {
    title: 'SERVICE',
    links: [
      { label: 'Livraison', href: '/contact' },
      { label: 'Retours', href: '/contact' },
      { label: 'Garantie à vie', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#0E1512] text-white" role="contentinfo" suppressHydrationWarning>
      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="block mb-6" aria-label="Le Kit du Voyageur">
              <span
                className="text-white"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 600 }}
              >
                Le Kit du Voyageur
              </span>
            </Link>
            <p
              className="text-[#6B8A7A] leading-relaxed mb-6"
              style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontSize: '1rem' }}
            >
              Ce que vous emportez,<br />
              <em>c&apos;est votre voyage.</em>
            </p>
            <p className="text-xs text-[#4A6355] tracking-wider">
              Grenoble, France · Fabriqué en Europe · Réparable à vie
            </p>
          </div>

          {/* Nav cols */}
          {FOOTER_COLS?.map((col) => (
            <div key={col?.title}>
              <p
                className="text-white mb-5"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em' }}
              >
                {col?.title}
              </p>
              <ul className="space-y-3">
                {col?.links?.map((link) => (
                  <li key={link?.label}>
                    <Link
                      href={link?.href}
                      className="text-sm text-[#6B8A7A] hover:text-white transition-colors duration-150"
                    >
                      {link?.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#4A6355]">
            © 2026 Le Kit du Voyageur ·{' '}
            <Link href="/politique-confidentialite" className="hover:text-[#6B8A7A] transition-colors">Confidentialité</Link>
            {' '}·{' '}
            <Link href="/cgu" className="hover:text-[#6B8A7A] transition-colors">CGU</Link>
            {' '}·{' '}
            <Link href="/cgv" className="hover:text-[#6B8A7A] transition-colors">CGV</Link>
            {' '}·{' '}
            <Link href="/mentions-legales" className="hover:text-[#6B8A7A] transition-colors">Mentions légales</Link>
          </p>
          <div className="flex items-center gap-4 text-xs text-[#4A6355]">
            <span>Paiement sécurisé</span>
            <span>·</span>
            <span>Livraison CO₂ compensée</span>
          </div>
        </div>
      </div>
    </footer>
  );
}