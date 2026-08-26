'use client';

import React, { useState, useEffect, useRef } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const TESTIMONIALS = [
  {
    id: '1',
    name: 'Camille R.',
    role: 'GR20 Corse — 15 jours',
    quote: 'Le configurateur m\'a économisé 3,2 kg. J\'ai terminé le GR20 sans blessure aux genoux pour la première fois.',
    weightSaved: '−3 200 g',
    rating: 5,
    avatar: 'https://img.rocket.new/generatedImages/rocket_gen_img_1246d41fb-1764802362452.png',
    avatarAlt: 'Femme blonde souriante en tenue de randonnée',
  },
  {
    id: '2',
    name: 'Théo M.',
    role: 'Tour d\'Europe — 4 mois',
    quote: 'Le kit Vanlife est exactement ce dont j\'avais besoin. Rien de trop, rien d\'oublié. La fiche Islande m\'a sauvé la mise.',
    weightSaved: '−1 850 g',
    rating: 5,
    avatar: 'https://img.rocket.new/generatedImages/rocket_gen_img_195df3f46-1767622236015.png',
    avatarAlt: 'Homme brun barbu souriant, air décontracté',
  },
  {
    id: '3',
    name: 'Amara D.',
    role: 'Mont Blanc — Été 2025',
    quote: 'J\'avais peur d\'oublier l\'essentiel pour mon premier 4000m. La liste IA était parfaite, et le service client a répondu à toutes mes questions.',
    weightSaved: '−2 600 g',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1718693942549-a462ba40a378?w=80&q=80',
    avatarAlt: 'Femme souriante, fond extérieur lumineux',
  },
];

const PRESS_MENTIONS = [
  { outlet: 'Outdoor Magazine', quote: '« La référence pour préparer son kit de randonnée avec l\'IA »', logo: '🏔️' },
  { outlet: 'Le Monde Aventure', quote: '« Révolutionne la préparation du voyageur moderne »', logo: '🌍' },
  { outlet: 'Trail Running FR', quote: '« Outil indispensable avant chaque expédition »', logo: '🏃' },
  { outlet: 'Bivouac.com', quote: '« Sélection produit irréprochable, IA bluffante »', logo: '⛺' },
];

export default function HomepagePressTestimonialsSection() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef?.current) observer?.observe(sectionRef?.current);
    return () => observer?.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-28"
      style={{ background: '#F5F2E8' }}
      aria-labelledby="social-proof-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="mb-12 md:mb-16">
          <p className="label-eyebrow mb-4">— Témoignages</p>
          <h2
            id="social-proof-heading"
            className="text-section-title text-[#1A1F1C]"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            Ils ont préparé leur aventure
            <br />
            <em className="not-italic" style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(26,31,28,0.45)' }}>
              avec Le Kit du Voyageur.
            </em>
          </h2>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {TESTIMONIALS.map((t, idx) => (
            <article
              key={t.id}
              className="premium-card p-6 flex flex-col"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.6s ease ${idx * 0.12}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${idx * 0.12}s`,
              }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4" aria-label={`Note: ${t.rating}/5`}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Icon key={i} name="StarIcon" size={13} variant="solid" className="text-[#17402C]" />
                ))}
              </div>

              {/* Trip tag */}
              <span
                className="inline-block text-[10px] px-2.5 py-1 rounded-full mb-3 self-start"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: '#EBF2EC',
                  color: '#17402C',
                  border: '1px solid rgba(23,64,44,0.2)',
                  letterSpacing: '0.04em',
                }}
              >
                {t.role}
              </span>

              {/* Quote */}
              <blockquote className="text-[#1A1F1C] text-sm leading-relaxed flex-1 italic mb-5" style={{ color: '#3D4840' }}>
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Weight saved */}
              <div
                className="flex items-center gap-2 mb-4 p-3 rounded-lg"
                style={{ background: '#EBF2EC', border: '1px solid rgba(23,64,44,0.15)' }}
              >
                <Icon name="ScaleIcon" size={13} variant="outline" className="text-[#17402C] flex-shrink-0" />
                <span
                  className="text-xs font-bold"
                  style={{ color: '#17402C', fontFamily: 'var(--font-mono)' }}
                >
                  {t.weightSaved} économisés
                </span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-[#DDD9CC]">
                  <AppImage
                    src={t.avatar}
                    alt={t.avatarAlt}
                    width={36}
                    height={36}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1F1C] text-sm">{t.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Icon name="CheckBadgeIcon" size={10} variant="solid" className="text-[#17402C]" />
                    <span className="text-[10px] text-[#6B7568]" style={{ fontFamily: 'var(--font-mono)' }}>Achat vérifié</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Press mentions */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#FFFFFF',
            border: '1px solid #DDD9CC',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s ease 0.4s',
          }}
        >
          <p className="text-center label-eyebrow-muted mb-8">— Ils parlent de nous</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {PRESS_MENTIONS.map((press) => (
              <div key={press.outlet} className="text-center">
                <div className="text-3xl mb-3" aria-hidden="true">{press.logo}</div>
                <p className="text-xs font-semibold text-[#1A1F1C] mb-2">{press.outlet}</p>
                <p className="text-[11px] text-[#6B7568] italic leading-relaxed">{press.quote}</p>
              </div>
            ))}
          </div>

          {/* Aggregate rating */}
          <div className="flex items-center justify-center gap-3 mt-8 pt-6 border-t border-[#DDD9CC]">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon key={i} name="StarIcon" size={14} variant="solid" className="text-[#17402C]" />
              ))}
            </div>
            <span className="font-bold text-[#1A1F1C] text-sm" style={{ fontFamily: 'var(--font-mono)' }}>4.8 / 5</span>
            <span className="text-[#6B7568] text-xs">· 12 847 kits configurés</span>
          </div>
        </div>
      </div>
    </section>
  );
}
