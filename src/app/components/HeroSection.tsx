'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const DESTINATIONS = [
{ name: 'Népal', tag: 'Trekking', img: "https://images.unsplash.com/photo-1643437177212-1af76d04434f", alt: 'Chaîne himalayenne enneigée avec village de montagne au premier plan, ciel bleu profond', color: '#3E6B7A' },
{ name: 'Patagonie', tag: 'Alpinisme', img: "https://img.rocket.new/generatedImages/rocket_gen_img_14566789d-1772251928133.png", alt: 'Torres del Paine avec lacs turquoise et glaciers en Patagonie chilienne', color: '#33463C' },
{ name: 'Islande', tag: 'Volcans', img: "https://images.unsplash.com/photo-1721633616585-3f6c10c491fe", alt: 'Aurore boréale verte au-dessus d\'un paysage volcanique islandais enneigé', color: '#B5652D' },
{ name: 'Sahara', tag: 'Désert', img: "https://images.unsplash.com/photo-1728408828574-70a460530093", alt: 'Dunes de sable rouge du Sahara au coucher du soleil avec caravane de chameaux', color: '#E4501C' }];


const STATS = [
{ value: '12 847', label: 'Kits configurés', icon: 'SparklesIcon' },
{ value: '94', label: 'Destinations', icon: 'GlobeAltIcon' },
{ value: '4.9', label: 'Note moyenne', icon: 'StarIcon' },
{ value: '48h', label: 'Livraison express', icon: 'BoltIcon' }];


const FEATURES = [
{
  icon: 'SparklesIcon',
  title: 'Configurateur IA',
  desc: 'Décrivez votre voyage, l\'IA compose votre kit optimal en 2 minutes — poids, budget, destination.',
  href: '/ai-configurator',
  cta: 'Configurer mon kit',
  accent: '#E4501C'
},
{
  icon: 'GlobeAltIcon',
  title: 'Pages Pays',
  desc: 'Fiches détaillées pour 94 destinations : météo, visa, équipement recommandé, niveau de danger.',
  href: '/pays',
  cta: 'Explorer les pays',
  accent: '#3E6B7A'
},
{
  icon: 'ChatBubbleLeftRightIcon',
  title: 'Copilote IA',
  desc: 'Votre assistant voyage intelligent, disponible 24h/24 pour répondre à toutes vos questions terrain.',
  href: '/copilote',
  cta: 'Parler au copilote',
  accent: '#33463C'
}];


const KITS = [
{
  name: 'Kit Népal Trekking',
  tag: 'Best-seller',
  items: 24,
  weight: '8.4 kg',
  price: '899€',
  img: "https://img.rocket.new/generatedImages/rocket_gen_img_1370bed92-1783680161245.png",
  alt: 'Kit de trekking complet avec sac à dos, tente légère et équipement haute montagne',
  rating: 4.9,
  reviews: 312
},
{
  name: 'Kit Patagonie Hiver',
  tag: 'Nouveau',
  items: 31,
  weight: '11.2 kg',
  price: '1 249€',
  img: "https://img.rocket.new/generatedImages/rocket_gen_img_17b4a31a9-1783680161528.png",
  alt: 'Équipement alpinisme hivernal avec vêtements techniques et matériel de sécurité',
  rating: 4.8,
  reviews: 87
},
{
  name: 'Kit Sahara Désert',
  tag: 'Populaire',
  items: 19,
  weight: '6.1 kg',
  price: '649€',
  img: "https://img.rocket.new/generatedImages/rocket_gen_img_13d6ec110-1783680160804.png",
  alt: 'Kit désert avec protection solaire, gourde filtrante et équipement bivouac',
  rating: 4.7,
  reviews: 198
}];


export default function HeroSection() {
  // Removed scroll-based parallax — it caused a state update on every scroll event
  // which triggered re-renders and hurt INP/CLS. CSS-only parallax via transform is used instead.

  return (
    <section
      className="relative w-full min-h-screen overflow-hidden bg-[#1C2620] flex items-end"
      aria-label="Section héros — Kit du Voyageur">
      
      {/* Full-bleed background — CSS parallax via will-change */}
      <div
        className="absolute inset-0 w-full"
        aria-hidden="true">
        
        <AppImage
          src="https://images.unsplash.com/photo-1431965400057-a84b80cfdbff"
          alt="Forêt de conifères vue du ciel, lumière dorée traversant la cime des arbres, atmosphère brumeuse"
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center" />
        
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(28,38,32,0.72) 0%, rgba(28,38,32,0.45) 45%, rgba(28,38,32,0.15) 100%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-64" style={{ background: 'linear-gradient(to top, #1C2620, transparent)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          {/* Left — headline */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-pulse" />
              <span className="text-[10px] font-mono text-white/50 tracking-[0.25em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                Expédition 2026 · IA-Powered
              </span>
            </div>

            <h1 className="font-display font-800 text-white leading-[0.95] tracking-tight mb-6" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(3rem, 7vw, 5.5rem)' }}>
              L&apos;équipement
              <br />
              <span style={{ color: '#E4501C' }}>intelligent</span>
              <br />
              pour chaque
              <br />
              aventure.
            </h1>

            <p className="text-white/55 text-base sm:text-lg font-light leading-relaxed max-w-lg mb-8">
              L&apos;IA compose votre kit optimal en 2 minutes — poids, budget, destination. 12 847 voyageurs équipés.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/ai-configurator" className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-[#E4501C]/35">
                <Icon name="SparklesIcon" size={16} variant="outline" />
                Configurer mon kit
              </Link>
              <Link href="/catalogue" className="flex items-center gap-2 border border-white/20 text-white/80 hover:text-white hover:border-white/40 hover:bg-white/5 px-6 py-3.5 rounded-xl font-medium text-sm transition-all">
                Voir le catalogue
                <Icon name="ArrowRightIcon" size={14} variant="outline" />
              </Link>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-6 mt-10">
              {STATS.map((stat) =>
              <div key={stat.label} className="flex items-center gap-2">
                  <Icon name={stat.icon as string} size={14} variant="outline" className="text-[#E4501C]" />
                  <div>
                    <span className="font-mono font-700 text-white text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</span>
                    <span className="text-white/35 text-xs ml-1.5">{stat.label}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right — destination cards */}
          <div className="lg:col-span-5 hidden lg:grid grid-cols-2 gap-2.5">
            {DESTINATIONS.map((dest, i) =>
            <Link
              key={dest.name}
              href={`/pays/${dest.name.toLowerCase()}`}
              className={`relative overflow-hidden rounded-2xl group cursor-pointer ${i === 0 ? 'row-span-2' : ''}`}
              style={{ height: i === 0 ? '280px' : '130px' }}>
              
                <AppImage
                src={dest.img}
                alt={dest.alt}
                fill
                sizes="(max-width: 1024px) 0px, 200px"
                loading="lazy"
                className="object-cover group-hover:scale-105 transition-transform duration-700" />
              
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <span className="text-[9px] font-mono text-white/60 tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{dest.tag}</span>
                  <p className="font-display font-700 text-white text-sm leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{dest.name}</p>
                </div>
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="ArrowRightIcon" size={10} variant="outline" className="text-white" />
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>);

}

// ─── Features Section ──────────────────────────────────────────────────────────
export function FeaturesSection() {
  return (
    <section className="bg-[#E7E3D6] py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Fonctionnalités clés</p>
            <h2 className="font-display font-800 text-[#1C2620] text-3xl sm:text-4xl tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Tout pour votre<br />prochaine expédition.
            </h2>
          </div>
          <Link href="/catalogue" className="text-sm font-medium text-[#1C2620]/60 hover:text-[#1C2620] flex items-center gap-1.5 transition-colors">
            Voir tout <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((feat, i) =>
          <div
            key={feat.title}
            className={`relative rounded-2xl overflow-hidden p-7 flex flex-col justify-between min-h-[260px] ${
            i === 0 ? 'md:col-span-1 md:row-span-1' : ''}`
            }
            style={{ background: i === 0 ? '#1C2620' : i === 1 ? '#33463C' : '#243028' }}>
            
              <div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${feat.accent}25` }}>
                  <Icon name={feat.icon as string} size={20} variant="outline" style={{ color: feat.accent }} />
                </div>
                <h3 className="font-display font-700 text-white text-xl mb-2.5" style={{ fontFamily: 'var(--font-display)' }}>{feat.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feat.desc}</p>
              </div>
              <Link
              href={feat.href}
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium transition-all"
              style={{ color: feat.accent }}>
              
                {feat.cta}
                <Icon name="ArrowRightIcon" size={13} variant="outline" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>);

}

// ─── Popular Kits Section ──────────────────────────────────────────────────────
export function PopularKitsSection() {
  return (
    <section className="bg-[#EDEAE0] py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Kits populaires</p>
            <h2 className="font-display font-800 text-[#1C2620] text-3xl sm:text-4xl tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Prêts à partir.
            </h2>
          </div>
          <Link href="/kits" className="text-sm font-medium text-[#1C2620]/60 hover:text-[#1C2620] flex items-center gap-1.5 transition-colors">
            Tous les kits <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {KITS.map((kit) =>
          <Link key={kit.name} href="/kits" className="group bg-[#E7E3D6] rounded-2xl overflow-hidden border border-[#C8C3B0] hover:border-[#E4501C]/40 hover:shadow-lg hover:shadow-[#1C2620]/10 transition-all">
              <div className="relative h-48 overflow-hidden">
                <AppImage
                src={kit.img}
                alt={kit.alt}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500" />
              
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-mono font-600 px-2 py-1 rounded-full bg-[#E4501C] text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                    {kit.tag}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-display font-700 text-[#1C2620] text-base mb-3" style={{ fontFamily: 'var(--font-display)' }}>{kit.name}</h3>
                <div className="flex items-center gap-3 text-xs text-[#5C6B5E] mb-4">
                  <span className="flex items-center gap-1"><Icon name="CubeIcon" size={11} variant="outline" />{kit.items} articles</span>
                  <span className="flex items-center gap-1"><Icon name="ScaleIcon" size={11} variant="outline" />{kit.weight}</span>
                  <span className="flex items-center gap-1"><Icon name="StarIcon" size={11} variant="solid" className="text-amber-500" />{kit.rating} ({kit.reviews})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-700 text-[#E4501C] text-lg" style={{ fontFamily: 'var(--font-mono)' }}>{kit.price}</span>
                  <span className="text-xs font-medium text-[#1C2620]/50 group-hover:text-[#E4501C] transition-colors flex items-center gap-1">
                    Voir le kit <Icon name="ArrowRightIcon" size={12} variant="outline" />
                  </span>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>);

}

// ─── Social Proof Section ──────────────────────────────────────────────────────
export function SocialProofSection() {
  const REVIEWS = [
  { name: 'Marie L.', dest: 'Népal 2025', text: 'Le configurateur IA a composé un kit parfait pour mon trek. Rien de superflu, rien d\'oublié.', rating: 5, avatar: 'ML' },
  { name: 'Thomas B.', dest: 'Patagonie 2025', text: 'La fiche pays Patagonie est incroyablement détaillée. J\'ai économisé des heures de recherche.', rating: 5, avatar: 'TB' },
  { name: 'Camille R.', dest: 'Islande 2026', text: 'Le copilote IA a répondu à toutes mes questions sur les conditions météo. Service exceptionnel.', rating: 5, avatar: 'CR' }];


  return (
    <section className="bg-[#1C2620] py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Ils nous font confiance</p>
          <h2 className="font-display font-800 text-white text-3xl sm:text-4xl tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            12 847 voyageurs équipés.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {REVIEWS.map((review) =>
          <div key={review.name} className="bg-white/5 border border-white/8 rounded-2xl p-6">
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: review.rating }).map((_, i) =>
              <Icon key={i} name="StarIcon" size={13} variant="solid" className="text-amber-400" />
              )}
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-5">&ldquo;{review.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E4501C]/20 flex items-center justify-center">
                  <span className="font-mono text-xs font-700 text-[#E4501C]" style={{ fontFamily: 'var(--font-mono)' }}>{review.avatar}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{review.name}</p>
                  <p className="text-xs text-white/35">{review.dest}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>);

}