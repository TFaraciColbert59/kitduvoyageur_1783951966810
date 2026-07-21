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


const _FEATURES = [
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


const _KITS = [
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
              L&apos;IA compose votre kit optimal en 2 minutes — poids, budget, destination.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/ai-configurator" className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-[#E4501C]/35">
                <Icon name="SparklesIcon" size={16} variant="outline" />
                Configurer mon kit
              </Link>
            </div>

            {/* Reassurance block */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-white/40 text-xs" style={{ fontFamily: 'var(--font-display)' }}>
                🔒 Paiement sécurisé par Stripe | Chiffrement SSL
              </span>
              <div className="flex items-center gap-2 opacity-40">
                {/* Visa */}
                <svg width="34" height="22" viewBox="0 0 34 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Visa">
                  <rect width="34" height="22" rx="3" fill="white" fillOpacity="0.15"/>
                  <text x="5" y="15" fontSize="9" fontWeight="700" fill="white" fontFamily="Arial, sans-serif" letterSpacing="0.5">VISA</text>
                </svg>
                {/* Mastercard */}
                <svg width="34" height="22" viewBox="0 0 34 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
                  <rect width="34" height="22" rx="3" fill="white" fillOpacity="0.15"/>
                  <circle cx="13" cy="11" r="6" fill="white" fillOpacity="0.6"/>
                  <circle cx="21" cy="11" r="6" fill="white" fillOpacity="0.4"/>
                </svg>
                {/* Apple Pay */}
                <svg width="40" height="22" viewBox="0 0 40 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Apple Pay">
                  <rect width="40" height="22" rx="3" fill="white" fillOpacity="0.15"/>
                  <text x="5" y="15" fontSize="8" fontWeight="600" fill="white" fontFamily="Arial, sans-serif" letterSpacing="0.3">Pay</text>
                  <path d="M4 8.5C4.6 7.8 5 6.9 4.9 6C4.1 6.1 3.1 6.6 2.5 7.3C1.9 7.9 1.5 8.8 1.6 9.7C2.4 9.7 3.4 9.2 4 8.5Z" transform="translate(22, 3) scale(0.9)" fill="white"/>
                  <path d="M4.9 9.8C3.7 9.7 2.7 10.5 2.1 10.5C1.5 10.5 0.7 9.8 -0.2 9.8C-1.4 9.8 -2.5 10.5 -3.1 11.6C-4.3 13.8 -3.4 17.1 -2.2 18.9C-1.6 19.8 -0.9 20.8 0 20.8C0.9 20.7 1.2 20.2 2.3 20.2C3.4 20.2 3.7 20.8 4.6 20.7C5.5 20.7 6.1 19.8 6.7 18.9C7.4 17.9 7.7 16.9 7.7 16.9C7.7 16.9 5.8 16.1 5.8 13.9C5.8 12 7.4 11.1 7.4 11.1C6.5 9.8 5.1 9.8 4.9 9.8Z" transform="translate(22, 3) scale(0.45)" fill="white"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Right — destination cards */}
          <div className="lg:col-span-5 hidden lg:grid grid-cols-2 gap-2.5">
            {DESTINATIONS?.map((dest, i) =>
            <Link
              key={dest?.name}
              href={`/pays/${dest?.name?.toLowerCase()}`}
              className={`relative overflow-hidden rounded-2xl group cursor-pointer ${i === 0 ? 'row-span-2' : ''}`}
              style={{ height: i === 0 ? '280px' : '130px' }}>
              
                <AppImage
                src={dest?.img}
                alt={dest?.alt}
                fill
                sizes="(max-width: 1024px) 0px, 200px"
                loading="lazy"
                className="object-cover group-hover:scale-105 transition-transform duration-700" />
              
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <span className="text-[9px] font-mono text-white/60 tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{dest?.tag}</span>
                  <p className="font-display font-700 text-white text-sm leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{dest?.name}</p>
                </div>
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="ArrowRightIcon" size={10} variant="outline" className="text-white" />
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );

}