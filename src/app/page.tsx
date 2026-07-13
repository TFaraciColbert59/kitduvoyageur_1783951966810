'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

// ─── Utility: useInView hook ───────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs?.observe(el);
    return () => obs?.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Data ──────────────────────────────────────────────────────────────────
const POPULAR_KITS = [
  {
    name: 'Kit Islande',
    slug: 'islande-automne',
    tag: 'TREK · AUTOMNE',
    items: 32,
    weight: '8,4 kg',
    price: '1 240 €',
    trust: 94,
    color: '#2A4A5E',
    emoji: '🏔️',
    desc: 'Volcans, geysers, aurores boréales',
  },
  {
    name: 'Kit Japon',
    slug: 'japon-printemps',
    tag: 'URBAIN · CULTURE',
    items: 28,
    weight: '6,2 kg',
    price: '890 €',
    trust: 97,
    color: '#4A2A3A',
    emoji: '🌸',
    desc: 'Temples, cerisiers, mégapoles',
  },
  {
    name: 'Kit Tour du Monde',
    slug: 'tour-du-monde',
    tag: 'LONG COURS · MULTI',
    items: 48,
    weight: '11,8 kg',
    price: '2 100 €',
    trust: 91,
    color: '#2A3A2A',
    emoji: '🌍',
    desc: 'Tous les continents, toutes les saisons',
  },
  {
    name: 'Kit Vanlife',
    slug: 'vanlife-europe',
    tag: 'ROAD TRIP · LIBERTÉ',
    items: 38,
    weight: '14,2 kg',
    price: '1 680 €',
    trust: 89,
    color: '#3A3A2A',
    emoji: '🚐',
    desc: 'Routes, bivouacs, liberté totale',
  },
  {
    name: 'Kit GR20',
    slug: 'gr20-corse',
    tag: 'RANDONNÉE · EXTRÊME',
    items: 24,
    weight: '7,1 kg',
    price: '780 €',
    trust: 96,
    color: '#2A3A4A',
    emoji: '⛰️',
    desc: 'Le sentier le plus difficile d\'Europe',
  },
  {
    name: 'Kit Digital Nomad',
    slug: 'digital-nomad',
    tag: 'TRAVAIL · MOBILITÉ',
    items: 22,
    weight: '5,4 kg',
    price: '1 120 €',
    trust: 93,
    color: '#3A2A4A',
    emoji: '💻',
    desc: 'Travailler depuis n\'importe où',
  },
];

// ─── Hero Section ──────────────────────────────────────────────────────────
function HeroSection() {
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#1C2620]">
      {/* Background: topographic SVG pattern + gradient */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cpath d='M200 50 Q300 100 350 200 Q300 300 200 350 Q100 300 50 200 Q100 100 200 50Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M200 80 Q280 120 320 200 Q280 280 200 320 Q120 280 80 200 Q120 120 200 80Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M200 110 Q260 140 290 200 Q260 260 200 290 Q140 260 110 200 Q140 140 200 110Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M200 140 Q240 160 260 200 Q240 240 200 260 Q160 240 140 200 Q160 160 200 140Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '400px 400px',
          transform: mounted ? `translateY(${scrollY * 0.15}px)` : 'none',
        }}
      />
      {/* Atmospheric gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1C2620] via-[#243028] to-[#1a1f1c]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1C2620] via-transparent to-transparent" />
      {/* Accent glow */}
      <div
        className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #E4501C 0%, transparent 70%)' }}
      />
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-pulse" />
                <span
                  className="text-[10px] font-mono text-white/50 tracking-[0.2em] uppercase"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Intelligence artificielle · Équipement outdoor
                </span>
              </div>
            </div>

            {/* H1 */}
            <h1
              className="text-hero text-white mb-6 leading-[0.95]"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Votre voyage
              <br />
              <span className="text-[#E4501C]">commence</span>
              <br />
              par le bon sac.
            </h1>

            {/* Subtitle */}
            <p className="text-white/55 text-lg leading-relaxed mb-10 max-w-lg">
              L&apos;IA qui analyse votre destination, votre style de voyage et votre équipement pour créer le kit parfait.{' '}
              <span className="text-white/80">Aucun oubli. Aucun surplus. Juste ce qu&apos;il faut.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Link
                href="/ai-configurator"
                className="group flex items-center justify-center gap-2.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#E4501C]/30"
              >
                <Icon name="SparklesIcon" size={18} variant="outline" />
                Créer mon Kit
                <Icon name="ArrowRightIcon" size={16} variant="outline" className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/kits"
                className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/14 border border-white/12 text-white/80 hover:text-white px-8 py-4 rounded-2xl font-medium text-base transition-all duration-200"
              >
                Découvrir les kits populaires
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { icon: 'CloudIcon', label: 'Analyse météo' },
                { icon: 'ScaleIcon', label: 'Optimisation du poids' },
                { icon: 'ShieldCheckIcon', label: 'Produits vérifiés' },
                { icon: 'UserCircleIcon', label: 'Adapté à votre profil' },
              ]?.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon name={icon} size={13} variant="outline" className="text-[#E4501C]" />
                  <span
                    className="text-[11px] font-mono text-white/45 tracking-wide"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Visual card */}
          <div className="relative hidden lg:block">
            {/* Main card */}
            <div className="relative bg-[#243028] border border-white/10 rounded-3xl p-8 shadow-2xl">
              {/* Card header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p
                    className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-1"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Kit généré · Islande
                  </p>
                  <h3
                    className="text-white font-display font-700 text-xl"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                  >
                    Kit Islande Automne
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#E4501C]/15 border border-[#E4501C]/20 flex items-center justify-center">
                  <span className="text-2xl">🏔️</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { value: '32', label: 'objets' },
                  { value: '8,4 kg', label: 'poids total' },
                  { value: '1 240 €', label: 'budget estimé' },
                ]?.map(({ value, label }) => (
                  <div key={label} className="bg-[#1C2620] rounded-xl p-3 text-center">
                    <p
                      className="text-white font-mono font-bold text-lg leading-none mb-1"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {value}
                    </p>
                    <p
                      className="text-white/35 text-[10px] font-mono tracking-wide"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Trust score */}
              <div className="flex items-center gap-4 bg-[#1C2620] rounded-xl p-4">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <circle
                      cx="28" cy="28" r="22" fill="none"
                      stroke="#E4501C" strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 22 * 0.94} ${2 * Math.PI * 22}`}
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono font-bold text-sm"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    94
                  </span>
                </div>
                <div>
                  <p
                    className="text-[10px] font-mono text-white/35 tracking-[0.15em] uppercase mb-0.5"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Trust Score
                  </p>
                  <p className="text-white/70 text-sm">Kit optimisé pour votre profil</p>
                </div>
              </div>

              {/* Items preview */}
              <div className="mt-5 space-y-2">
                {[
                  { name: 'Sac à dos 40L Osprey', cat: 'Portage', check: true },
                  { name: 'Veste Gore-Tex imperméable', cat: 'Protection', check: true },
                  { name: 'Couche thermique Merino', cat: 'Textile', check: true },
                  { name: '+ 29 autres objets', cat: '', check: false },
                ]?.map(({ name, cat, check }, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${check ? 'bg-[#E4501C]/20 border border-[#E4501C]/40' : 'bg-white/5 border border-white/10'}`}>
                      {check && <div className="w-1.5 h-1.5 rounded-full bg-[#E4501C]" />}
                    </div>
                    <span className="text-white/65 text-sm flex-1">{name}</span>
                    {cat && (
                      <span
                        className="text-[9px] font-mono text-white/25 tracking-wide"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {cat}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-[#E4501C] text-white rounded-2xl px-4 py-2 shadow-lg shadow-[#E4501C]/30">
              <p
                className="text-[10px] font-mono tracking-[0.15em] uppercase"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                IA · Généré en 8s
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <div className="scroll-line-track">
          <div className="scroll-line-fill h-1/2" />
        </div>
        <span
          className="text-[9px] font-mono text-white/40 tracking-[0.2em] uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Scroll
        </span>
      </div>
    </section>
  );
}

// ─── AI Configurator Section ───────────────────────────────────────────────
function ConfiguratorSection() {
  const { ref, visible } = useInView();
  const [activeField, setActiveField] = useState<string | null>(null);

  const fields = [
    { key: 'destination', label: 'Destination', value: 'Islande', icon: 'MapPinIcon' },
    { key: 'dates', label: 'Dates', value: '12 – 22 octobre', icon: 'CalendarIcon' },
    { key: 'style', label: 'Style de voyage', value: 'Aventure / Trek', icon: 'BoltIcon' },
    { key: 'budget', label: 'Budget', value: '800 €', icon: 'BanknotesIcon' },
  ];

  return (
    <section ref={ref} className="py-28 bg-[#E7E3D6] relative overflow-hidden">
      {/* Topo background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cellipse cx='300' cy='300' rx='250' ry='200' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3Cellipse cx='300' cy='300' rx='200' ry='160' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3Cellipse cx='300' cy='300' rx='150' ry='120' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3Cellipse cx='300' cy='300' rx='100' ry='80' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '600px 600px',
          backgroundPosition: 'right center',
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div
          className={`mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <p
            className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Configurateur IA
          </p>
          <h2
            className="text-section-title text-[#1C2620] max-w-xl"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
          >
            Laissez l&apos;IA préparer votre sac.
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Interactive form demo */}
          <div
            className={`transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="bg-white border border-[#C8C3B0] rounded-3xl p-8 shadow-sm">
              <div className="space-y-4 mb-8">
                {fields?.map(({ key, label, value, icon }) => (
                  <div
                    key={key}
                    onClick={() => setActiveField(activeField === key ? null : key)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      activeField === key
                        ? 'border-[#E4501C] bg-[#E4501C]/5 shadow-sm'
                        : 'border-[#C8C3B0] bg-[#EDEAE0] hover:border-[#E4501C]/40'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activeField === key ? 'bg-[#E4501C]/15' : 'bg-[#D4CFBF]'}`}>
                      <Icon name={icon} size={18} variant="outline" className={activeField === key ? 'text-[#E4501C]' : 'text-[#5C6B5E]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.15em] uppercase mb-0.5"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {label}
                      </p>
                      <p className="text-[#1C2620] font-semibold text-sm truncate">{value}</p>
                    </div>
                    <Icon name="ChevronRightIcon" size={14} variant="outline" className={`text-[#5C6B5E] transition-transform ${activeField === key ? 'rotate-90' : ''}`} />
                  </div>
                ))}
              </div>

              <Link
                href="/ai-configurator"
                className="w-full flex items-center justify-center gap-2.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white py-4 rounded-2xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#E4501C]/30"
              >
                <Icon name="SparklesIcon" size={16} variant="outline" />
                Générer mon kit personnalisé
              </Link>
            </div>
          </div>

          {/* Right: Result card */}
          <div
            className={`transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="bg-[#1C2620] rounded-3xl p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#E4501C] animate-pulse" />
                <span
                  className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Résultat généré · 8 secondes
                </span>
              </div>

              <h3
                className="text-2xl font-display font-700 text-white mb-6"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
              >
                Kit Islande Automne
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { v: '32', l: 'objets' },
                  { v: '8,4 kg', l: 'poids total' },
                  { v: '1 240 €', l: 'budget estimé' },
                  { v: '94/100', l: 'Trust Score' },
                ]?.map(({ v, l }) => (
                  <div key={l} className="bg-white/6 rounded-2xl p-4">
                    <p
                      className="text-white font-mono font-bold text-xl mb-0.5"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {v}
                    </p>
                    <p
                      className="text-white/35 text-[10px] font-mono tracking-wide uppercase"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {l}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-white/50 text-sm leading-relaxed mb-6">
                L&apos;IA a analysé les conditions météo d&apos;octobre en Islande, votre profil aventure et votre budget pour sélectionner les 32 objets essentiels.
              </p>

              <div className="flex items-center gap-2 text-[#E4501C]">
                <Icon name="ArrowRightIcon" size={14} variant="outline" />
                <span className="text-sm font-medium">Pas une checklist. Un équipement optimisé.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Before / After Section ────────────────────────────────────────────────
function BeforeAfterSection() {
  const { ref, visible } = useInView();

  const before = [
    '15 onglets ouverts',
    'Listes trouvées sur internet',
    'Achats inutiles et doublons',
    'Sac trop lourd, stress au départ',
  ];

  const after = [
    'Votre inventaire personnel centralisé',
    'Votre matériel déjà connu et répertorié',
    'Vos besoins analysés par destination',
    'Votre sac optimisé, rien de trop',
  ];

  return (
    <section ref={ref} className="py-28 bg-[#1C2620] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cpath d='M0 150 Q75 50 150 150 Q225 250 300 150' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M0 100 Q75 0 150 100 Q225 200 300 100' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M0 200 Q75 100 150 200 Q225 300 300 200' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '300px 300px',
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div
          className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <p
            className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            La différence
          </p>
          <h2
            className="text-section-title text-white"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
          >
            Elle connaît votre sac.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Before */}
          <div
            className={`bg-white/4 border border-white/8 rounded-3xl p-8 transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
                <span className="text-white/40 text-sm font-bold">✕</span>
              </div>
              <p
                className="text-[11px] font-mono text-white/30 tracking-[0.2em] uppercase"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Avant
              </p>
            </div>
            <ul className="space-y-4">
              {before?.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-white/20 text-lg leading-none mt-0.5 flex-shrink-0">✕</span>
                  <span className="text-white/45 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div
            className={`bg-[#E4501C]/8 border border-[#E4501C]/20 rounded-3xl p-8 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center">
                <span className="text-[#E4501C] text-sm font-bold">✓</span>
              </div>
              <p
                className="text-[11px] font-mono text-[#E4501C]/70 tracking-[0.2em] uppercase"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Avec Le Kit du Voyageur
              </p>
            </div>
            <ul className="space-y-4">
              {after?.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-[#E4501C] text-lg leading-none mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-white/75 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Popular Kits Section ──────────────────────────────────────────────────
function PopularKitsSection() {
  const { ref, visible } = useInView();

  return (
    <section ref={ref} className="py-28 bg-[#E7E3D6] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div>
            <p
              className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Kits populaires
            </p>
            <h2
              className="text-section-title text-[#1C2620]"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
            >
              Fiches d&apos;expédition.
            </h2>
          </div>
          <Link
            href="/kits"
            className="flex items-center gap-2 text-sm font-medium text-[#E4501C] hover:text-[#cc3d10] transition-colors flex-shrink-0"
          >
            Voir tous les kits
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        {/* Grid — bento style: 2 large + 4 small */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {POPULAR_KITS?.map((kit, i) => (
            <div
              key={kit?.slug}
              className={`group relative rounded-3xl overflow-hidden border border-[#C8C3B0] hover:border-[#E4501C]/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 cursor-pointer ${i === 0 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${kit?.color} 0%, #1C2620 100%)`,
                transitionDelay: `${i * 60}ms`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.6s ease ${i * 60}ms, transform 0.6s ease ${i * 60}ms, box-shadow 0.3s ease, border-color 0.3s ease`,
              }}
            >
              {/* Topo overlay */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ccircle cx='100' cy='100' r='80' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='100' cy='100' r='60' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='100' cy='100' r='40' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
                  backgroundSize: '200px 200px',
                  backgroundPosition: 'right bottom',
                }}
              />

              <div className="relative p-7">
                {/* Tag */}
                <p
                  className="text-[9px] font-mono text-white/35 tracking-[0.2em] uppercase mb-4"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {kit?.tag}
                </p>

                {/* Emoji + Name */}
                <div className="flex items-start justify-between mb-3">
                  <h3
                    className="text-white font-display font-700 text-xl leading-tight"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                  >
                    {kit?.name}
                  </h3>
                  <span className="text-3xl ml-3 flex-shrink-0">{kit?.emoji}</span>
                </div>

                <p className="text-white/45 text-sm mb-6 leading-relaxed">{kit?.desc}</p>

                {/* Data row */}
                <div className="flex items-center gap-4 mb-6">
                  {[
                    { v: `${kit?.items}`, l: 'objets' },
                    { v: kit?.weight, l: 'poids' },
                    { v: kit?.price, l: 'budget' },
                  ]?.map(({ v, l }) => (
                    <div key={l}>
                      <p
                        className="text-white font-mono font-bold text-sm"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {v}
                      </p>
                      <p
                        className="text-white/30 text-[9px] font-mono tracking-wide uppercase"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {l}
                      </p>
                    </div>
                  ))}
                  <div className="ml-auto">
                    <div className="flex items-center gap-1.5 bg-white/8 rounded-full px-2.5 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E4501C]" />
                      <span
                        className="text-[10px] font-mono text-white/60"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {kit?.trust}/100
                      </span>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/kits/${kit?.slug}`}
                  className="flex items-center justify-between w-full bg-white/8 hover:bg-white/16 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-white/70 hover:text-white text-sm font-medium transition-all duration-200 group-hover:bg-white/12"
                >
                  Voir le kit
                  <Icon name="ArrowRightIcon" size={14} variant="outline" className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Marketplace Section ───────────────────────────────────────────────────
function MarketplaceSection() {
  const { ref, visible } = useInView();

  return (
    <section ref={ref} className="py-28 bg-[#1C2620] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div
            className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <p
              className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-4"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Marketplace intelligente
            </p>
            <h2
              className="text-section-title text-white mb-6"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
            >
              Pas besoin de chercher.
            </h2>
            <p className="text-white/50 text-lg leading-relaxed mb-8">
              Nous savons exactement ce qu&apos;il vous manque. L&apos;IA compare votre inventaire avec votre kit cible et identifie les écarts.
            </p>

            {/* Options */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Acheter neuf', icon: 'ShoppingBagIcon', primary: true },
                { label: 'Louer', icon: 'KeyIcon', primary: false },
                { label: 'Trouver d\'occasion', icon: 'TagIcon', primary: false },
              ]?.map(({ label, icon, primary }) => (
                <Link
                  key={label}
                  href="/boutique"
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    primary
                      ? 'bg-[#E4501C] text-white hover:bg-[#cc3d10] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#E4501C]/30'
                      : 'bg-white/8 border border-white/10 text-white/70 hover:text-white hover:bg-white/14'
                  }`}
                >
                  <Icon name={icon} size={15} variant="outline" />
                  {label}
                </Link>
              ))}
            </div>

            <p className="mt-6 text-white/25 text-xs leading-relaxed">
              Vision circulaire · Économie de partage · Matériel vérifié
            </p>
          </div>

          {/* Right: Inventory card */}
          <div
            className={`transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="bg-[#243028] border border-white/8 rounded-3xl p-8">
              {/* Have */}
              <div className="mb-6">
                <p
                  className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-4"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Votre inventaire
                </p>
                <div className="space-y-3">
                  {[
                    { name: 'Sac à dos 40L', brand: 'Osprey Atmos' },
                    { name: 'Veste imperméable', brand: 'Arc\'teryx Beta' },
                  ]?.map(({ name, brand }) => (
                    <div key={name} className="flex items-center gap-3 bg-white/4 rounded-xl px-4 py-3">
                      <div className="w-5 h-5 rounded-full bg-[#E4501C]/20 border border-[#E4501C]/40 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[#E4501C]" />
                      </div>
                      <div>
                        <p className="text-white/80 text-sm font-medium">{name}</p>
                        <p
                          className="text-white/30 text-[10px] font-mono"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {brand}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/8" />
                <span
                  className="text-[10px] font-mono text-white/20 tracking-[0.2em] uppercase"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Il vous manque
                </span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* Missing */}
              <div className="space-y-3">
                {[
                  { name: 'Batterie externe 20 000 mAh', price: '49 €' },
                  { name: 'Couche thermique Merino', price: '89 €' },
                  { name: 'Lampe frontale 350 lm', price: '35 €' },
                ]?.map(({ name, price }) => (
                  <div key={name} className="flex items-center gap-3 bg-[#E4501C]/6 border border-[#E4501C]/15 rounded-xl px-4 py-3">
                    <span className="text-[#E4501C] text-base flex-shrink-0">+</span>
                    <p className="text-white/70 text-sm flex-1">{name}</p>
                    <span
                      className="text-[#E4501C] text-sm font-mono font-bold"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {price}
                    </span>
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

// ─── Trust Score Section ───────────────────────────────────────────────────
function TrustScoreSection() {
  const { ref, visible } = useInView();
  const circumference = 2 * Math.PI * 70;

  return (
    <section ref={ref} className="py-28 bg-[#E7E3D6] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div
            className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <p
              className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Trust Score
            </p>
            <h2
              className="text-section-title text-[#1C2620] mb-4"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
            >
              Votre identité de confiance.
            </h2>
            <p className="text-[#5C6B5E] text-lg max-w-xl mx-auto leading-relaxed">
              Votre profil voyageur devient votre passeport dans l&apos;écosystème. Plus vous voyagez, plus votre score grandit.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-center">
            {/* Score circle */}
            <div
              className={`flex flex-col items-center transition-all duration-700 delay-100 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            >
              <div className="relative w-44 h-44">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="#C8C3B0" strokeWidth="6" />
                  <circle
                    cx="80" cy="80" r="70" fill="none"
                    stroke="#E4501C" strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference * 0.97} ${circumference}`}
                    style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-[#1C2620] font-mono font-bold text-4xl leading-none"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    97
                  </span>
                  <span
                    className="text-[#5C6B5E] text-[10px] font-mono tracking-[0.15em] uppercase mt-1"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    /100
                  </span>
                </div>
              </div>
              <p className="text-[#5C6B5E] text-sm mt-4 text-center">Voyageur Expert</p>
            </div>

            {/* Features */}
            <div
              className={`md:col-span-2 space-y-4 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
            >
              {[
                {
                  icon: 'StarIcon',
                  title: 'Réputation vérifiée',
                  desc: 'Chaque voyage, chaque avis, chaque échange construit votre profil.',
                },
                {
                  icon: 'KeyIcon',
                  title: 'Accès location & seconde main',
                  desc: 'Un score élevé débloque les meilleures offres de la communauté.',
                },
                {
                  icon: 'UsersIcon',
                  title: 'Communauté de confiance',
                  desc: 'Rejoignez des voyageurs vérifiés pour des expéditions partagées.',
                },
              ]?.map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 bg-white border border-[#C8C3B0] rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[#E4501C]/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={icon} size={18} variant="outline" className="text-[#E4501C]" />
                  </div>
                  <div>
                    <p className="text-[#1C2620] font-semibold text-sm mb-1">{title}</p>
                    <p className="text-[#5C6B5E] text-sm leading-relaxed">{desc}</p>
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

// ─── Vision Section ────────────────────────────────────────────────────────
function VisionSection() {
  const { ref, visible } = useInView();

  return (
    <section ref={ref} className="py-32 bg-[#1C2620] relative overflow-hidden">
      {/* Background layers */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Cpath d='M400 50 Q700 200 750 400 Q700 600 400 750 Q100 600 50 400 Q100 200 400 50Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M400 120 Q650 250 690 400 Q650 550 400 680 Q150 550 110 400 Q150 250 400 120Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M400 190 Q600 300 630 400 Q600 500 400 610 Q200 500 170 400 Q200 300 400 190Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '800px 800px',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #E4501C 0%, transparent 70%)' }}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <div
          className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          <p
            className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-8"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Notre vision
          </p>

          <h2
            className="text-white mb-8 leading-[1.05]"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              letterSpacing: '-0.03em',
            }}
          >
            Le futur du voyage
            <br />
            n&apos;est pas de transporter plus.
            <br />
            <span className="text-[#E4501C]">C&apos;est de savoir exactement</span>
            <br />
            quoi emporter.
          </h2>

          <p className="text-white/40 text-lg leading-relaxed max-w-2xl mx-auto mb-12">
            Une technologie née de l&apos;univers outdoor. Une intelligence construite pour les voyageurs qui refusent le superflu. Une plateforme qui grandit avec vous.
          </p>

          {/* Data points */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-14">
            {[
              { v: '500+', l: 'Produits vérifiés' },
              { v: '120+', l: 'Destinations' },
              { v: '12k+', l: 'Voyageurs actifs' },
              { v: '98%', l: 'Satisfaction' },
            ]?.map(({ v, l }) => (
              <div key={l} className="text-center">
                <p
                  className="text-white font-mono font-bold text-3xl mb-1"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {v}
                </p>
                <p
                  className="text-white/30 text-[10px] font-mono tracking-[0.15em] uppercase"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {l}
                </p>
              </div>
            ))}
          </div>

          <Link
            href="/ai-configurator"
            className="inline-flex items-center gap-3 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-10 py-5 rounded-2xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#E4501C]/30"
          >
            <Icon name="SparklesIcon" size={18} variant="outline" />
            Commencer mon premier kit
            <Icon name="ArrowRightIcon" size={16} variant="outline" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Homepage Footer ───────────────────────────────────────────────────────
function HomepageFooter() {
  const footerLinks = {
    Explorer: [
      { label: 'Destinations', href: '/pays' },
      { label: 'Guides terrain', href: '/guides' },
      { label: 'Copilote IA', href: '/copilote' },
      { label: 'Outils', href: '/outils' },
    ],
    Marketplace: [
      { label: 'Boutique', href: '/boutique' },
      { label: 'Location', href: '/location' },
      { label: 'Occasion', href: '/occasion' },
      { label: 'Enchères', href: '/encheres' },
    ],
    Kits: [
      { label: 'Kits populaires', href: '/kits' },
      { label: 'Configurateur IA', href: '/ai-configurator' },
      { label: 'Catalogue', href: '/catalogue' },
    ],
    Communauté: [
      { label: 'Forum', href: '/communaute' },
      { label: 'Carnets', href: '/carnets' },
      { label: 'Clubs', href: '/clubs' },
      { label: 'Créateurs', href: '/createurs' },
    ],
    'À propos': [
      { label: 'Notre vision', href: '#vision' },
      { label: 'Pass Voyageur', href: '/abonnements' },
      { label: 'Pro & Marques', href: '/pro' },
    ],
    Support: [
      { label: 'Aide', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Confidentialité', href: '#' },
    ],
  };

  return (
    <footer className="bg-[#1C2620] border-t border-white/6" role="contentinfo">
      {/* CTA band */}
      <div className="border-b border-white/6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <AppLogo size={32} />
            <div>
              <p
                className="text-[9px] font-mono text-white/30 tracking-[0.2em] uppercase"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Le Kit du
              </p>
              <p
                className="font-display font-800 text-white text-lg tracking-tight leading-none"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                VOYAGEUR
              </p>
            </div>
          </div>
          <Link
            href="/ai-configurator"
            className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-[#E4501C]/30"
          >
            <Icon name="SparklesIcon" size={15} variant="outline" />
            Créer mon Kit
          </Link>
        </div>
      </div>
      {/* Links grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
          {Object.entries(footerLinks)?.map(([title, links]) => (
            <div key={title}>
              <p
                className="text-[10px] font-mono text-white/25 tracking-[0.2em] uppercase mb-4"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {title}
              </p>
              <ul className="space-y-2.5">
                {links?.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-xs text-white/40 hover:text-white/80 transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom bar */}
      <div className="border-t border-white/6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">
            © 2026 Le Kit du Voyageur · Tous droits réservés
          </p>
          <div className="flex items-center gap-4 text-[10px] font-mono text-white/20" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>FR</span>
            <span>·</span>
            <span>EN</span>
            <span>·</span>
            <Icon name="ShieldCheckIcon" size={11} variant="outline" />
            <span>Paiement sécurisé</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <ConfiguratorSection />
      <BeforeAfterSection />
      <PopularKitsSection />
      <MarketplaceSection />
      <TrustScoreSection />
      <VisionSection />
      <HomepageFooter />
    </main>
  );
}
