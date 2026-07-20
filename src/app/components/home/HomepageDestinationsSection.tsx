'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const DESTINATIONS = [
  { name: 'Islande', tag: 'Volcans & aurores', img: 'https://images.unsplash.com/photo-1721633616585-3f6c10c491fe', alt: 'Aurore boréale verte au-dessus d\'un paysage volcanique islandais enneigé', href: '/pays/is' },
  { name: 'Népal', tag: 'Trekking himalaya', img: 'https://images.unsplash.com/photo-1643437177212-1af76d04434f', alt: 'Chaîne himalayenne enneigée avec village de montagne au premier plan', href: '/pays/np' },
  { name: 'Patagonie', tag: 'Alpinisme', img: 'https://img.rocket.new/generatedImages/rocket_gen_img_14566789d-1772251928133.png', alt: 'Torres del Paine avec lacs turquoise et glaciers en Patagonie chilienne', href: '/pays/cl' },
  { name: 'Maroc', tag: 'Désert & Atlas', img: 'https://images.unsplash.com/photo-1728408828574-70a460530093', alt: 'Dunes de sable rouge du Sahara au coucher du soleil', href: '/pays/ma' },
  { name: 'Norvège', tag: 'Fjords & randonnée', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', alt: 'Fjord norvégien avec montagnes enneigées reflétées dans l\'eau calme', href: '/pays/no' },
  { name: 'Nouvelle-Zélande', tag: 'Great Walks', img: 'https://images.unsplash.com/photo-1469521669194-babb45599def', alt: 'Paysage de Nouvelle-Zélande avec montagnes vertes et lac turquoise', href: '/pays/nz' },
];

export default function HomepageDestinationsSection() {
  return (
    <section className="py-20" style={{ background: 'var(--dark-bg)' }} aria-labelledby="destinations-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              — Destinations
            </p>
            <h2
              id="destinations-heading"
              className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Chaque destination,
              <br />
              <span style={{ color: '#E4501C' }}>son kit parfait.</span>
            </h2>
          </div>
          <Link href="/pays" className="hidden md:flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            Voir toutes les destinations
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {DESTINATIONS?.map((dest, i) => (
            <Link
              key={dest?.name}
              href={dest?.href}
              className={`relative overflow-hidden rounded-2xl group ${i === 0 ? 'md:row-span-2' : ''}`}
              style={{ height: i === 0 ? undefined : '180px', minHeight: i === 0 ? '380px' : undefined }}
            >
              <AppImage
                src={dest?.img}
                alt={dest?.alt}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                loading={i < 2 ? 'eager' : 'lazy'}
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[9px] font-mono text-white/55 tracking-widest uppercase mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{dest?.tag}</p>
                <p className="font-display font-700 text-white text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{dest?.name}</p>
              </div>
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="ArrowRightIcon" size={12} variant="outline" className="text-white" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center md:hidden">
          <Link href="/pays" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            Voir toutes les destinations
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>
      </div>
    </section>
  );
}
