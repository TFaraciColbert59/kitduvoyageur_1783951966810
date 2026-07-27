'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const FEATURED = [
  {
    name: 'Chartreuse',
    subtitle: 'Sentier des balcons',
    tag: 'À pied · GR',
    tagDetail: 'Isère · Rhône-Alpes · Débutant',
    img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80',
    alt: 'Forêt dense de Chartreuse avec lumière émeraude filtrant entre les arbres',
    href: '/pays/fr',
    highlight: true,
  },
  {
    name: 'Bivouac Anatolien',
    subtitle: 'Volcans',
    tag: 'Bivouac · Trek',
    tagDetail: 'Turquie · Cappadoce · Interméd.',
    img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    alt: 'Campement de nuit sous ciel étoilé au-dessus d\'un paysage volcanique',
    href: '/pays/tr',
    highlight: false,
  },
  {
    name: 'Esprit Savo-Royale',
    subtitle: 'Hautes-Alpes',
    tag: 'Alpinisme · 3000m',
    tagDetail: 'France · Savoie · Confirmé',
    img: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&q=80',
    alt: 'Lac de montagne turquoise entouré de sommets enneigés dans les Alpes',
    href: '/pays/fr',
    highlight: false,
  },
];

export default function HomepageDestinationsSection() {
  return (
    <section
      className="py-20 md:py-28"
      style={{ background: '#F5F2E8' }}
      aria-labelledby="destinations-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 md:mb-14 gap-4">
          <div>
            <motion.h2
              id="destinations-heading"
              className="text-section-title text-[#1A1F1C]"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              Trois façons
              <br />
              de se{' '}
              <em
                className="not-italic"
                style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(26,31,28,0.5)' }}
              >
                perdre.
              </em>
            </motion.h2>
          </div>
          <motion.p
            className="text-sm text-[#6B7568] max-w-xs leading-relaxed"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Des terrains choisis pour leur caractère. Chaque itinéraire, un kit composé sur mesure par notre IA.
          </motion.p>
        </div>

        {/* Cards grid — 3 columns on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {FEATURED.map((dest, i) => (
            <motion.div
              key={dest.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={dest.href}
                className="group relative overflow-hidden rounded-xl block focus-visible:outline-none focus-visible:ring-2"
                style={{ height: i === 0 ? '420px' : '280px' }}
                aria-label={`Explorer ${dest.name}`}
              >
                {/* Image */}
                <AppImage
                  src={dest.img}
                  alt={dest.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, rgba(26,31,28,0.05) 30%, rgba(26,31,28,0.72) 100%)' }}
                />

                {/* Tag pill top-left */}
                <div className="absolute top-4 left-4">
                  <span
                    className="px-2.5 py-1 rounded-full text-[9px] tracking-[0.15em] uppercase text-white/80"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      fontFamily: 'var(--font-mono)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {dest.tag}
                  </span>
                </div>

                {/* Arrow hover */}
                <div
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                  aria-hidden="true"
                >
                  <Icon name="ArrowRightIcon" size={14} variant="outline" className="text-white" />
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p
                    className="text-[9px] uppercase tracking-[0.18em] text-white/50 mb-1"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {dest.tagDetail}
                  </p>
                  <p
                    className="font-display font-700 text-white leading-tight"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: i === 0 ? '1.25rem' : '1rem',
                    }}
                  >
                    {dest.name}
                  </p>
                  <p className="text-white/55 text-xs mt-0.5">{dest.subtitle}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View all link */}
        <div className="mt-8 flex justify-center md:justify-start">
          <Link
            href="/pays"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#2D5A3D] hover:text-[#1A1F1C] transition-colors"
          >
            Explorer toutes les destinations
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>
      </div>
    </section>
  );
}
