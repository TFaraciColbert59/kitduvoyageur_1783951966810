'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const PRODUCTS = [
  {
    name: 'Kit Islande Trekking',
    tag: 'Kit complet',
    items: 22,
    weight: '7.8 kg',
    price: 'À partir de 749€',
    img: 'https://img.rocket.new/generatedImages/rocket_gen_img_1370bed92-1783680161245.png',
    alt: 'Kit de trekking complet avec sac à dos, tente légère et équipement haute montagne',
    href: '/kits',
    badge: 'Populaire',
  },
  {
    name: 'Kit Bivouac France',
    tag: 'Kit léger',
    items: 15,
    weight: '5.2 kg',
    price: 'À partir de 399€',
    img: 'https://img.rocket.new/generatedImages/rocket_gen_img_17b4a31a9-1783680161528.png',
    alt: 'Équipement bivouac léger avec tente ultralight et sac de couchage compact',
    href: '/kits',
    badge: 'Nouveau',
  },
  {
    name: 'Kit Désert & Chaleur',
    tag: 'Kit spécialisé',
    items: 18,
    weight: '5.9 kg',
    price: 'À partir de 549€',
    img: 'https://img.rocket.new/generatedImages/rocket_gen_img_13d6ec110-1783680160804.png',
    alt: 'Kit désert avec protection solaire, gourde filtrante et équipement bivouac',
    href: '/kits',
    badge: null,
  },
];

export default function HomepageFeaturedProductsSection() {
  return (
    <section className="py-20" style={{ background: '#1C2620' }} aria-labelledby="products-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              — Kits & Produits
            </p>
            <h2
              id="products-heading"
              className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Prêt à partir
              <br />
              <span style={{ color: '#E4501C' }}>dès aujourd&apos;hui.</span>
            </h2>
          </div>
          <Link href="/boutique" className="hidden md:flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            Voir tous les produits
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PRODUCTS?.map((product) => (
            <Link
              key={product?.name}
              href={product?.href}
              className="group rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="relative h-52 overflow-hidden">
                <AppImage
                  src={product?.img}
                  alt={product?.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  loading="lazy"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {product?.badge && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold" style={{ background: '#E4501C', color: 'white', fontFamily: 'var(--font-mono)' }}>
                    {product?.badge}
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="text-[10px] font-mono text-white/35 tracking-widest uppercase mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>{product?.tag}</p>
                <h3 className="font-semibold text-white text-base mb-3">{product?.name}</h3>
                <div className="flex items-center gap-4 text-xs text-white/40 mb-4">
                  <span>{product?.items} articles</span>
                  <span>{product?.weight}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-white/80 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{product?.price}</span>
                  <span className="flex items-center gap-1 text-xs text-[#E4501C] font-medium">
                    Voir le kit
                    <Icon name="ArrowRightIcon" size={12} variant="outline" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
