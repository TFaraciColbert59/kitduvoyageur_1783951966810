'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

// ─── HERO SECTION ────────────────────────────────────────────────────────────

function HomeHeroSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <section
      className="relative w-full min-h-screen overflow-hidden bg-[#1C2620] flex items-center"
      aria-label="Accueil — Le Kit du Voyageur"
    >
      {/* Background image */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4"
          alt="Randonneur solitaire face à un panorama montagneux au lever du soleil, sac à dos posé sur un rocher"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(105deg, rgba(28,38,32,0.92) 0%, rgba(28,38,32,0.70) 40%, rgba(28,38,32,0.25) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,38,32,1) 0%, transparent 35%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2.5 mb-8"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-pulse" />
            <span className="text-[10px] font-mono text-white/50 tracking-[0.28em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
              Technologie · Outdoor · IA
            </span>
          </div>

          {/* H1 */}
          <h1
            className="font-display text-white leading-[0.92] tracking-tight mb-7"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(3.2rem, 7.5vw, 6rem)',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s',
            }}
          >
            Votre voyage
            <br />
            commence par
            <br />
            <span style={{ color: '#E4501C' }}>le bon sac.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-white/55 text-base sm:text-lg font-light leading-relaxed max-w-xl mb-10"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s',
            }}
          >
            L&apos;IA qui analyse votre destination, votre style de voyage et votre équipement pour créer le kit parfait. Aucun oubli. Aucun surplus. Juste ce qu&apos;il faut.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap items-center gap-3 mb-8"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s',
            }}
          >
            <Link
              href="/ai-configurator"
              className="inline-flex items-center gap-2.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-7 py-4 rounded-2xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#E4501C]/40"
            >
              <Icon name="SparklesIcon" size={16} variant="outline" />
              Créer mon Kit
            </Link>
            <Link
              href="/kits"
              className="inline-flex items-center gap-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm text-white px-7 py-4 rounded-2xl font-semibold text-sm transition-all duration-200 border border-white/15 hover:border-white/25"
            >
              Découvrir les kits populaires
            </Link>
          </div>

          {/* Technical proof points */}
          <div
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
            style={{
              opacity: mounted ? 1 : 0,
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.45s',
            }}
          >
            {[
              { icon: 'CloudIcon', label: 'Analyse météo' },
              { icon: 'ScaleIcon', label: 'Optimisation du poids' },
              { icon: 'ShieldCheckIcon', label: 'Produits vérifiés' },
              { icon: 'UserCircleIcon', label: 'Adapté à votre profil' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon name={icon as string} size={12} variant="outline" className="text-[#E4501C]" />
                <span className="text-[11px] font-mono text-white/40 tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40" aria-hidden="true">
        <div className="w-px h-10 bg-white/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full bg-white" style={{ height: '40%', animation: 'scrollDown 2s ease-in-out infinite' }} />
        </div>
        <span className="text-[9px] font-mono text-white/30 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>Scroll</span>
      </div>

      <style>{`
        @keyframes scrollDown {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(300%); }
        }
      `}</style>
    </section>
  );
}

// ─── AI CONFIGURATOR DEMO ────────────────────────────────────────────────────

function ConfiguratorSection() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-[#1C2620] py-24 sm:py-32 overflow-hidden" aria-label="Configurateur IA">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                Configurateur IA
              </span>
            </div>
            <h2
              className="font-display text-white leading-tight tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
            >
              Laissez l&apos;IA
              <br />
              préparer votre sac.
            </h2>
            <p className="text-white/50 text-base leading-relaxed mb-8 max-w-md">
              Décrivez votre voyage en quelques secondes. L&apos;IA analyse destination, saison, style et budget pour composer un kit optimisé — pas une simple checklist.
            </p>
            <Link
              href="/ai-configurator"
              className="inline-flex items-center gap-2.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#E4501C]/35"
            >
              <Icon name="SparklesIcon" size={15} variant="outline" />
              Tester maintenant
            </Link>
          </div>

          {/* Right — interactive card */}
          <div
            className="relative"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.97)',
              transition: 'all 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s',
            }}
          >
            <div className="absolute -inset-8 rounded-3xl opacity-20" style={{ background: 'radial-gradient(ellipse at center, #E4501C 0%, transparent 70%)' }} aria-hidden="true" />

            <div className="relative bg-[#243028] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
              {/* Header bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#E4501C]" />
                  <span className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                    Kit.AI · v2.4
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                </div>
              </div>

              {/* Input fields */}
              <div className="p-6 space-y-3">
                {[
                  { label: 'Destination', value: 'Islande', icon: 'MapPinIcon' },
                  { label: 'Dates', value: '12 – 22 octobre', icon: 'CalendarIcon' },
                  { label: 'Style', value: 'Aventure / Trek', icon: 'BoltIcon' },
                  { label: 'Budget', value: '800 €', icon: 'CurrencyEuroIcon' },
                ].map(({ label, value, icon }, i) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/8"
                    style={{
                      opacity: active ? 1 : 0,
                      transform: active ? 'translateX(0)' : 'translateX(-16px)',
                      transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${0.35 + i * 0.08}s`,
                    }}
                  >
                    <Icon name={icon as string} size={14} variant="outline" className="text-white/30 flex-shrink-0" />
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono text-white/30 tracking-wider uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{label}</span>
                      <span className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>{value}</span>
                    </div>
                  </div>
                ))}

                {/* Result card */}
                <div
                  className="mt-4 rounded-2xl overflow-hidden border border-[#E4501C]/30"
                  style={{
                    opacity: active ? 1 : 0,
                    transform: active ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.75s',
                  }}
                >
                  <div className="bg-[#E4501C]/15 px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Résultat généré</p>
                      <p className="font-display font-bold text-white text-base" style={{ fontFamily: 'var(--font-display)' }}>Kit Islande Automne</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#E4501C]/20 rounded-full px-3 py-1.5">
                      <Icon name="SparklesIcon" size={12} variant="outline" className="text-[#E4501C]" />
                      <span className="text-[10px] font-mono text-[#E4501C]" style={{ fontFamily: 'var(--font-mono)' }}>IA</span>
                    </div>
                  </div>
                  <div className="bg-[#1C2620]/60 px-5 py-4 grid grid-cols-4 gap-3">
                    {[
                      { val: '32', unit: 'objets' },
                      { val: '8,4', unit: 'kg' },
                      { val: '1 240', unit: '€' },
                      { val: '94', unit: '/100' },
                    ].map(({ val, unit }) => (
                      <div key={unit} className="text-center">
                        <p className="font-mono font-bold text-white text-lg leading-none" style={{ fontFamily: 'var(--font-mono)' }}>{val}</p>
                        <p className="text-[9px] font-mono text-white/30 tracking-wider mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{unit}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#1C2620]/40 px-5 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>Trust Score</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-20 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#E4501C] rounded-full" style={{ width: '94%' }} />
                      </div>
                      <span className="text-[10px] font-mono text-[#E4501C]" style={{ fontFamily: 'var(--font-mono)' }}>94/100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── BEFORE / AFTER SECTION ──────────────────────────────────────────────────

function BeforeAfterSection() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(true); }, { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const before = [
    '15 onglets ouverts',
    'Listes trouvées sur internet',
    'Achats inutiles',
    'Sac trop lourd',
  ];
  const after = [
    'Votre inventaire personnel',
    'Votre matériel déjà connu',
    'Vos besoins analysés',
    'Votre sac optimisé',
  ];

  return (
    <section ref={ref} className="bg-[#E7E3D6] py-24 sm:py-32" aria-label="Avant / Après">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.28em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
            La différence
          </span>
          <h2
            className="font-display text-[#1C2620] leading-tight tracking-tight mt-3"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
          >
            Elle connaît votre sac.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Before */}
          <div
            className="bg-white/60 border border-[#C8C3B0] rounded-3xl p-8"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateX(0)' : 'translateX(-24px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded-full bg-[#C8C3B0] flex items-center justify-center">
                <Icon name="XMarkIcon" size={12} variant="outline" className="text-[#5C6B5E]" />
              </div>
              <span className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>Avant</span>
            </div>
            <ul className="space-y-3.5">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-[#C8C3B0] mt-0.5 flex-shrink-0 text-base leading-none">✕</span>
                  <span className="text-[#5C6B5E] text-sm leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div
            className="bg-[#1C2620] border border-[#33463C] rounded-3xl p-8"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateX(0)' : 'translateX(24px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded-full bg-[#E4501C]/20 flex items-center justify-center">
                <Icon name="CheckIcon" size={12} variant="outline" className="text-[#E4501C]" />
              </div>
              <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>Après</span>
            </div>
            <ul className="space-y-3.5">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-[#E4501C] mt-0.5 flex-shrink-0 text-base leading-none">✓</span>
                  <span className="text-white/80 text-sm leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── POPULAR KITS ────────────────────────────────────────────────────────────

const KITS_DATA = [
  {
    name: 'Kit Islande',
    tag: 'Volcans & Aurores',
    items: 32,
    weight: '8,4 kg',
    price: '1 240 €',
    img: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae',
    alt: 'Paysage volcanique islandais avec aurore boréale verte et lac de lave',
    slug: 'islande',
  },
  {
    name: 'Kit Japon',
    tag: 'Culture & Randonnée',
    items: 28,
    weight: '6,8 kg',
    price: '890 €',
    img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186',
    alt: 'Mont Fuji enneigé au lever du soleil avec forêt de pins en premier plan',
    slug: 'japon',
  },
  {
    name: 'Kit Tour du Monde',
    tag: 'Nomade · 365 jours',
    items: 47,
    weight: '12,1 kg',
    price: '2 100 €',
    img: 'https://images.unsplash.com/photo-1488085061387-422e29b40080',
    alt: 'Voyageur avec grand sac à dos devant une carte du monde, lumière chaude',
    slug: 'tour-du-monde',
  },
  {
    name: 'Kit Vanlife',
    tag: 'Road Trip · Europe',
    items: 38,
    weight: '9,2 kg',
    price: '1 050 €',
    img: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4',
    alt: 'Van aménagé garé face à un coucher de soleil sur une route de montagne',
    slug: 'vanlife',
  },
  {
    name: 'Kit GR20',
    tag: 'Corse · 15 jours',
    items: 24,
    weight: '7,6 kg',
    price: '780 €',
    img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
    alt: 'Sentier de randonnée alpin avec crêtes rocheuses et ciel bleu profond',
    slug: 'gr20',
  },
  {
    name: 'Kit Digital Nomad',
    tag: 'Travail · Voyage',
    items: 21,
    weight: '5,3 kg',
    price: '650 €',
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f',
    alt: 'Laptop ouvert sur une terrasse avec vue sur une ville étrangère ensoleillée',
    slug: 'digital-nomad',
  },
];

function HomePopularKitsSection() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-[#1C2620] py-24 sm:py-32" aria-label="Kits populaires">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-14">
          <div>
            <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.28em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
              Kits populaires
            </span>
            <h2
              className="font-display text-white leading-tight tracking-tight mt-2"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
            >
              Fiches d&apos;expédition.
            </h2>
          </div>
          <Link href="/kits" className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1.5 flex-shrink-0">
            Voir tous les kits
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {KITS_DATA.map((kit, i) => (
            <Link
              key={kit.slug}
              href={`/kits/${kit.slug}`}
              className="group relative overflow-hidden rounded-2xl bg-[#243028] border border-white/8 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
              style={{
                opacity: active ? 1 : 0,
                transform: active ? 'translateY(0)' : 'translateY(24px)',
                transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 0.07}s`,
              }}
            >
              {/* Image */}
              <div className="relative h-52 overflow-hidden">
                <AppImage
                  src={kit.img}
                  alt={kit.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#243028] via-transparent to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="text-[9px] font-mono text-white/60 tracking-[0.2em] uppercase bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full" style={{ fontFamily: 'var(--font-mono)' }}>
                    {kit.tag}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-display font-bold text-white text-lg mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  {kit.name}
                </h3>
                <div className="flex items-center gap-4 mb-4">
                  {[
                    { val: kit.items, unit: 'objets' },
                    { val: kit.weight, unit: 'poids' },
                    { val: kit.price, unit: 'estimé' },
                  ].map(({ val, unit }) => (
                    <div key={unit}>
                      <p className="font-mono font-semibold text-white text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{val}</p>
                      <p className="text-[9px] font-mono text-white/30 tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>{unit}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[#E4501C] text-xs font-semibold group-hover:gap-2.5 transition-all">
                  Voir le kit
                  <Icon name="ArrowRightIcon" size={12} variant="outline" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── MARKETPLACE SECTION ─────────────────────────────────────────────────────

function MarketplaceSection() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(true); }, { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-[#E7E3D6] py-24 sm:py-32" aria-label="Marketplace intelligente">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(24px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.28em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
              Marketplace intelligente
            </span>
            <h2
              className="font-display text-[#1C2620] leading-tight tracking-tight mt-3 mb-5"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
            >
              Pas besoin de chercher.
              <br />
              <span className="text-[#E4501C]">Nous savons ce qu&apos;il vous manque.</span>
            </h2>
            <p className="text-[#5C6B5E] text-base leading-relaxed mb-8 max-w-md">
              Votre inventaire est analysé. L&apos;IA identifie les manques et vous propose exactement ce dont vous avez besoin — à acheter, louer ou trouver d&apos;occasion.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/boutique" className="inline-flex items-center gap-2 bg-[#1C2620] hover:bg-[#243028] text-white px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200">
                <Icon name="ShoppingBagIcon" size={14} variant="outline" />
                Acheter
              </Link>
              <Link href="/location" className="inline-flex items-center gap-2 bg-white border border-[#C8C3B0] hover:border-[#1C2620] text-[#1C2620] px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200">
                <Icon name="KeyIcon" size={14} variant="outline" />
                Louer
              </Link>
              <Link href="/occasion" className="inline-flex items-center gap-2 bg-white border border-[#C8C3B0] hover:border-[#1C2620] text-[#1C2620] px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200">
                <Icon name="TagIcon" size={14} variant="outline" />
                Occasion
              </Link>
            </div>
          </div>

          {/* Right — inventory card */}
          <div
            className="bg-[#1C2620] rounded-3xl p-7 border border-white/8 shadow-2xl shadow-black/20"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(24px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s',
            }}
          >
            <p className="text-[9px] font-mono text-white/30 tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>Votre inventaire</p>
            <div className="space-y-2.5 mb-6">
              {[
                { label: 'Sac à dos 40L', ok: true },
                { label: 'Veste imperméable', ok: true },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-[#33463C]' : 'bg-white/10'}`}>
                    <Icon name="CheckIcon" size={9} variant="outline" className="text-white" />
                  </div>
                  <span className="text-sm text-white/70">{label}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/8 pt-5">
              <p className="text-[9px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Il vous manque</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Batterie externe 20 000 mAh', price: '49 €' },
                  { label: 'Couche thermique laine mérinos', price: '89 €' },
                  { label: 'Lampe frontale 400 lm', price: '35 €' },
                ].map(({ label, price }) => (
                  <div key={label} className="flex items-center justify-between bg-[#E4501C]/8 border border-[#E4501C]/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[#E4501C] text-sm font-bold leading-none">+</span>
                      <span className="text-sm text-white/70">{label}</span>
                    </div>
                    <span className="text-xs font-mono text-white/40 flex-shrink-0 ml-2" style={{ fontFamily: 'var(--font-mono)' }}>{price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── TRUST SCORE SECTION ─────────────────────────────────────────────────────

function TrustScoreSection() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (circumference * 97) / 100;

  return (
    <section ref={ref} className="bg-[#1C2620] py-24 sm:py-32" aria-label="Trust Score">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — score */}
          <div
            className="flex flex-col items-center lg:items-start"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(24px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.28em] uppercase mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
              Trust Score
            </span>

            {/* Circle */}
            <div className="relative w-40 h-40 mb-8">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke="#E4501C"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={active ? dashOffset : circumference}
                  style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1) 0.3s' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-extrabold text-white text-4xl leading-none" style={{ fontFamily: 'var(--font-display)' }}>97</span>
                <span className="text-[10px] font-mono text-white/30 tracking-wider mt-1" style={{ fontFamily: 'var(--font-mono)' }}>/100</span>
              </div>
            </div>

            <p className="text-white/50 text-sm leading-relaxed text-center lg:text-left max-w-xs">
              Votre profil voyageur devient votre identité de confiance.
            </p>
          </div>

          {/* Right — features */}
          <div
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(24px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s',
            }}
          >
            <h2
              className="font-display text-white leading-tight tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
            >
              Une innovation
              <br />
              qui vous précède.
            </h2>
            <p className="text-white/50 text-base leading-relaxed mb-8 max-w-md">
              Le Trust Score construit votre réputation de voyageur. Il ouvre les portes de la location, de la seconde main et de la communauté.
            </p>
            <div className="space-y-3">
              {[
                { icon: 'KeyIcon', label: 'Location entre particuliers', desc: 'Accédez à du matériel premium' },
                { icon: 'TagIcon', label: 'Seconde main vérifiée', desc: 'Achetez et vendez en confiance' },
                { icon: 'UsersIcon', label: "Communauté d'experts", desc: 'Rejoignez les meilleurs voyageurs' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex items-start gap-4 bg-white/5 rounded-2xl px-5 py-4 border border-white/8">
                  <div className="w-9 h-9 rounded-xl bg-[#E4501C]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name={icon as string} size={16} variant="outline" className="text-[#E4501C]" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-0.5">{label}</p>
                    <p className="text-xs text-white/35">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── VISION SECTION ──────────────────────────────────────────────────────────

function VisionSection() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(true); }, { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#E7E3D6] py-24 sm:py-36" aria-label="Vision">
      {/* Background image */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1501854140801-50d01698950b"
          alt="Vue aérienne d'une forêt de montagne au lever du soleil, brume légère entre les arbres"
          fill
          sizes="100vw"
          className="object-cover object-center opacity-20"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(231,227,214,0.85) 0%, rgba(231,227,214,0.6) 50%, rgba(231,227,214,0.85) 100%)' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div
          style={{
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(32px)',
            transition: 'all 1s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.28em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
            Vision
          </span>
          <h2
            className="font-display text-[#1C2620] leading-tight tracking-tight mt-4 mb-8"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2rem, 5vw, 4rem)' }}
          >
            Le futur du voyage
            <br />
            n&apos;est pas de transporter plus.
            <br />
            <span className="text-[#E4501C]">C&apos;est de savoir exactement</span>
            <br />
            quoi emporter.
          </h2>
          <p className="text-[#5C6B5E] text-lg leading-relaxed max-w-2xl mx-auto mb-12">
            Une technologie née de l&apos;univers outdoor. Construite pour les voyageurs qui refusent le superflu et exigent la précision.
          </p>
          <Link
            href="/ai-configurator"
            className="inline-flex items-center gap-2.5 bg-[#1C2620] hover:bg-[#243028] text-white px-8 py-4 rounded-2xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30"
          >
            <Icon name="SparklesIcon" size={16} variant="outline" />
            Créer mon Kit maintenant
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function HomePageClient() {
  return (
    <main className="min-h-screen">
      <Header />
      <div id="main-content">
        <HomeHeroSection />
        <ConfiguratorSection />
        <BeforeAfterSection />
        <HomePopularKitsSection />
        <MarketplaceSection />
        <TrustScoreSection />
        <VisionSection />
      </div>
      <Footer />
    </main>
  );
}
