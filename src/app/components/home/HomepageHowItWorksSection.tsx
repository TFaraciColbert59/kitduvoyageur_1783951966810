'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const JOURNEY_STEPS = [
  {
    step: '01',
    label: 'Catalogue',
    title: 'Six objets.',
    img: 'https://img.rocket.new/generatedImages/rocket_gen_img_1370bed92-1783680161245.png',
    alt: 'Sac à dos technique vert',
    href: '/boutique',
    bg: '#EDEAE0',
  },
  {
    step: '02',
    label: 'Produit',
    title: 'Sac 45 l.',
    img: 'https://img.rocket.new/generatedImages/rocket_gen_img_17b4a31a9-1783680161528.png',
    alt: 'Tente légère ultralight',
    href: '/kits',
    bg: '#E0DDD0',
  },
  {
    step: '03',
    label: 'Assistant',
    title: 'Composer ton sac.',
    img: 'https://img.rocket.new/generatedImages/rocket_gen_img_13d6ec110-1783680160804.png',
    alt: 'Interface configurateur IA avec kit personnalisé',
    href: '/ai-configurator',
    bg: '#2D5A3D',
    dark: true,
    highlight: true,
  },
  {
    step: '04',
    label: 'Commande',
    title: '636 €.',
    img: 'https://images.unsplash.com/photo-1721633616585-3f6c10c491fe?w=400&q=80',
    alt: 'Équipement complet soigneusement emballé prêt à l\'envoi',
    href: '/panier',
    bg: '#C8D9CE',
  },
  {
    step: '05',
    label: 'Terrain',
    title: 'Presque prêt.',
    img: 'https://images.unsplash.com/photo-1431965400057-a84b80cfdbff?w=400&q=80',
    alt: 'Randonneur équipé sur un sentier de montagne',
    href: '/pays',
    bg: '#9BBBA8',
  },
];

export default function HomepageHowItWorksSection() {
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
      aria-labelledby="journey-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 md:mb-14 gap-4">
          <h2
            id="journey-heading"
            className="text-section-title text-[#1A1F1C]"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            Le parcours{' '}
            <em className="not-italic" style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(26,31,28,0.4)' }}>
              d&apos;achat.
            </em>
          </h2>
          <p
            className="text-sm text-[#6B7568] max-w-xs leading-relaxed"
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.5s ease 0.2s',
            }}
          >
            5 écrans repensés. Cliquez sur le premier et suivez le fil.
          </p>
        </div>

        {/* Steps — horizontal scroll on mobile */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
          {JOURNEY_STEPS.map((step, i) => (
            <Link
              key={step.step}
              href={step.href}
              className="group flex-shrink-0 w-48 md:w-auto block rounded-xl overflow-hidden transition-all hover:-translate-y-1"
              style={{
                background: step.bg,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
                transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s`,
              }}
              aria-label={`Étape ${step.step} — ${step.title}`}
            >
              {/* Image */}
              <div className="relative h-40 overflow-hidden">
                <AppImage
                  src={step.img}
                  alt={step.alt}
                  fill
                  sizes="200px"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* Text */}
              <div className="p-4">
                <p
                  className="text-[9px] uppercase tracking-[0.18em] mb-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: step.dark ? 'rgba(245,243,238,0.45)' : 'rgba(26,31,28,0.4)',
                  }}
                >
                  {step.step} · {step.label}
                </p>
                <p
                  className="text-sm font-display font-700 leading-snug"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    color: step.dark ? '#F5F2E8' : '#1A1F1C',
                  }}
                >
                  {step.title}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Footnote */}
        <p
          className="mt-6 text-xs text-[#6B7568] text-center md:text-left"
          style={{
            fontFamily: 'var(--font-mono)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.5s ease 0.5s',
          }}
        >
          Tout compris — en continuant au prochain kit.
        </p>
      </div>
    </section>
  );
}
