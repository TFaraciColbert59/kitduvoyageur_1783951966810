'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const PRODUCT = {
  badge: 'Édition exclusive',
  volume: '45 L',
  headline: ['45 L,', 'toile cirée,', 'rien de superflu.'],
  desc: 'Conçu pour les aventuriers qui ne veulent ni compromis ni superflu. Fabriqué à Grenoble depuis trois générations, en cotonnage 12 oz traité à la cire naturelle.',
  specs: [
    { label: 'Volume', val: '45 litres' },
    { label: 'Poids', val: '1,6 kg' },
    { label: 'Matière', val: 'Coton huile 12 oz' },
    { label: 'Avis', val: '★ 4,8' },
  ],
  price: '340 €',
  img: 'https://img.rocket.new/generatedImages/rocket_gen_img_1370bed92-1783680161245.png',
  imgAlt: 'Sac à dos 45L toile cirée vert kaki avec lanières cuir, style bushcraft outdoor',
  href: '/kits',
  background: '#B5AA88',
};

export default function HomepageFeaturedProductsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-28"
      style={{ background: '#F5F2E8' }}
      aria-labelledby="product-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">

          {/* Left — product image on warm sand background */}
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: PRODUCT.background,
              aspectRatio: '4/5',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(-24px)',
              transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Badge */}
            <div className="absolute top-5 left-5 z-10">
              <span
                className="px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase font-semibold rounded-full"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(26,31,28,0.12)',
                  color: 'rgba(26,31,28,0.75)',
                  border: '1px solid rgba(26,31,28,0.1)',
                }}
              >
                {PRODUCT.badge}
              </span>
            </div>

            <AppImage
              src={PRODUCT.img}
              alt={PRODUCT.imgAlt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              loading="lazy"
              className="object-contain object-center p-8"
            />
          </div>

          {/* Right — text content */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(24px)',
              transition: 'opacity 0.8s ease 0.1s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s',
            }}
          >
            <p className="label-eyebrow mb-4">— Kit du Voyageur</p>

            {/* Editorial headline */}
            <h2
              id="product-heading"
              className="text-[#1A1F1C] mb-6"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
                lineHeight: '1.0',
                letterSpacing: '-0.04em',
              }}
            >
              {PRODUCT.headline[0]}
              <br />
              <em className="not-italic" style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(26,31,28,0.5)' }}>
                {PRODUCT.headline[1]}
              </em>
              <br />
              {PRODUCT.headline[2]}
            </h2>

            <p className="text-[#6B7568] text-sm leading-relaxed mb-8 max-w-sm">
              {PRODUCT.desc}
            </p>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {PRODUCT.specs.map((s) => (
                <div
                  key={s.label}
                  className="p-4 rounded-xl"
                  style={{ background: '#EDEAE0', border: '1px solid #DDD9CC' }}
                >
                  <p
                    className="text-sm font-semibold text-[#1A1F1C] mb-0.5"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {s.val}
                  </p>
                  <p className="text-[10px] text-[#6B7568] uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Price + CTAs */}
            <div className="flex items-center gap-4 mb-6">
              <span
                className="text-3xl font-bold text-[#1A1F1C]"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              >
                {PRODUCT.price}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link href={PRODUCT.href} className="btn-primary flex-1 sm:flex-none justify-center">
                Ajouter au kit
              </Link>
              <Link
                href={`${PRODUCT.href}#details`}
                className="btn-ghost"
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
