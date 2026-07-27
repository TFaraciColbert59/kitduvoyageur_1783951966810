'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import AppImage from '@/components/ui/AppImage';
import { useParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  distance: string;
}

interface AdventureDetail {
  slug: string;
  title: string;
  titleItalic: string;
  subtitle: string;
  region: string;
  country: string;
  altitude: string;
  duration: string;
  distance: string;
  elevation: string;
  difficulty: number;
  difficultyLabel: string;
  category: string;
  tags: string[];
  heroImage: string;
  heroAlt: string;
  description: string;
  features: { icon: string; label: string; value: string }[];
  itinerary: ItineraryDay[];
  gallery: { src: string; alt: string }[];
  price: number;
  rating: number;
  reviews: number;
  maxGuests: number;
  included: string[];
  extras: { label: string; price: number }[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ADVENTURES_DATA: Record<string, AdventureDetail> = {
  'cabane-grand-vaneau': {
    slug: 'cabane-grand-vaneau',
    title: 'Cabane du',
    titleItalic: 'Grand Vaneau',
    subtitle: 'Refuge non-gardé · 4 personnes · Coup de cœur',
    region: 'Saint-Pierre-d\'Entremont',
    country: 'Chartreuse',
    altitude: '1 620 m d\'altitude',
    duration: '3 jours',
    distance: '27,4 km',
    elevation: '+1 620 m',
    difficulty: 3,
    difficultyLabel: '3/5',
    category: 'Refuge',
    tags: ['Refuge non-gardé', 'Autonomie', 'Coup de cœur'],
    heroImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=85',
    heroAlt: 'Vue aérienne de la Chartreuse avec forêts denses et falaises calcaires au coucher du soleil',
    description: 'Perchée à l\'extrémité du plateau du Grand Som, la cabane veille sur la vallée d\'Entremont. Aucun accès en voiture — quatre heures de marche depuis le col du Cucheron. À l\'arrivée, un poêle en fonte, quatre matelas, une réserve de bois. Le silence, ensuite, s\'occupe du reste.',
    features: [
      { icon: '🏠', label: 'Type', value: 'Refuge non-gardé · Autonomie totale · réservation obligatoire' },
      { icon: '🛏', label: 'Capacité', value: '4 matelas · poêle · Duvets non fournis · bois en réserve' },
      { icon: '⚡', label: 'Énergie', value: 'Sans électricité · Lampe frontale recommandée' },
      { icon: '🎒', label: 'Kit fourni', value: 'Cartes · trousse de secours · guide' },
      { icon: '⏱', label: 'Accès', value: '4 h de marche · Sentier balisé depuis le col du Cucheron' },
      { icon: '🦅', label: 'Faune', value: 'Faune protégée · Bouquetins, tétras-lyres, gypaètes' },
    ],
    itinerary: [
      {
        day: 1,
        title: 'Cucheron → Grand Vaneau',
        description: 'Départ 14 h. Montée en forêt jusqu\'au replat des Alpettes, puis crête aérienne jusqu\'à la cabane. Arrivée avant la nuit.',
        distance: '8,4 km',
      },
      {
        day: 2,
        title: 'Boucle du Grand Som',
        description: 'Sommet à l\'aube. Descente par la Voie du Château. Retour cabane en fin d\'après-midi. Le point d\'orgue.',
        distance: '14,6 km',
      },
      {
        day: 3,
        title: 'Descente au bourg',
        description: 'Départ 9 h. Descente par le sentier ancien des charbonniers. Fin à Saint-Pierre-d\'Entremont, retour transfert inclus.',
        distance: '4,4 km',
      },
    ],
    gallery: [
      { src: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Randonneur sur un sentier de crête avec vue panoramique sur les Alpes' },
      { src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', alt: 'Panorama alpin avec sommets enneigés et ciel bleu' },
      { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', alt: 'Vue aérienne des forêts de Chartreuse au coucher du soleil' },
      { src: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', alt: 'Tente de bivouac sur un plateau herbeux avec vue sur les falaises' },
    ],
    price: 248,
    rating: 4.9,
    reviews: 214,
    maxGuests: 4,
    included: ['Kit piste', 'Transfert retour'],
    extras: [{ label: 'Frais de service', price: 28 }],
  },
  'sentier-balcons-chartreuse': {
    slug: 'sentier-balcons-chartreuse',
    title: 'Sentier des',
    titleItalic: 'Balcons',
    subtitle: 'Traversée intégrale · Chartreuse',
    region: 'Chartreuse',
    country: 'France',
    altitude: '1 900 m max',
    duration: '4 jours',
    distance: '68 km',
    elevation: '+3 200 m',
    difficulty: 4,
    difficultyLabel: '4/5',
    category: 'Trekking',
    tags: ['Trekking', 'Bivouac', 'Chartreuse'],
    heroImage: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1920&q=85',
    heroAlt: 'Randonneur sur un sentier de crête avec vue panoramique sur les Alpes françaises',
    description: 'La traversée complète du massif de la Chartreuse par les crêtes, de Saint-Pierre-de-Chartreuse à Grenoble. Quatre jours en autonomie, des bivouacs en altitude, des vues à couper le souffle sur les Alpes.',
    features: [
      { icon: '⛺', label: 'Hébergement', value: 'Bivouac en autonomie · emplacements balisés' },
      { icon: '🎒', label: 'Portage', value: 'Sac 45L recommandé · 5 jours de nourriture' },
      { icon: '🗺', label: 'Balisage', value: 'GR9 · Balisage rouge et blanc' },
      { icon: '💧', label: 'Eau', value: 'Sources régulières · purification recommandée' },
      { icon: '⏱', label: 'Niveau', value: 'Intermédiaire · bonne condition physique requise' },
      { icon: '🦅', label: 'Faune', value: 'Chamois, bouquetins, vautours fauves' },
    ],
    itinerary: [
      { day: 1, title: 'Saint-Pierre → Charmant Som', description: 'Montée progressive par les forêts de hêtres. Premier bivouac au sommet avec vue 360°.', distance: '16 km' },
      { day: 2, title: 'Charmant Som → Chamechaude', description: 'Traversée des crêtes nord. Point culminant du massif à 2 082 m.', distance: '18 km' },
      { day: 3, title: 'Chamechaude → Dent de Crolles', description: 'Descente en forêt, remontée sur la Dent de Crolles. Bivouac avec vue sur Grenoble.', distance: '20 km' },
      { day: 4, title: 'Dent de Crolles → Grenoble', description: 'Descente finale par le sentier des Petites Roches. Arrivée en ville.', distance: '14 km' },
    ],
    gallery: [
      { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', alt: 'Vue aérienne des forêts de Chartreuse' },
      { src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', alt: 'Panorama alpin depuis les crêtes' },
      { src: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', alt: 'Bivouac en altitude' },
      { src: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Sentier de crête en Chartreuse' },
    ],
    price: 0,
    rating: 4.8,
    reviews: 89,
    maxGuests: 6,
    included: ['Cartes topographiques', 'Guide PDF'],
    extras: [],
  },
};

// Fallback for unknown slugs
function getFallbackAdventure(slug: string): AdventureDetail {
  return {
    slug,
    title: 'Aventure',
    titleItalic: slug.replace(/-/g, ' '),
    subtitle: 'Détail de l\'aventure',
    region: 'France',
    country: 'France',
    altitude: '—',
    duration: '—',
    distance: '—',
    elevation: '—',
    difficulty: 3,
    difficultyLabel: '3/5',
    category: 'Trekking',
    tags: ['Trekking'],
    heroImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=85',
    heroAlt: 'Paysage de montagne',
    description: 'Détails de cette aventure à venir.',
    features: [],
    itinerary: [],
    gallery: [],
    price: 0,
    rating: 4.5,
    reviews: 0,
    maxGuests: 4,
    included: [],
    extras: [],
  };
}

// ─── Difficulty dots ──────────────────────────────────────────────────────────

function _DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((d) => (
        <div
          key={d}
          className="w-2 h-2 rounded-full"
          style={{ background: d <= level ? '#E7E3D6' : 'rgba(231,227,214,0.2)' }}
        />
      ))}
    </div>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ adventure }: { adventure: AdventureDetail }) {
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [guests, setGuests] = useState(2);
  const nights = 3;

  const subtotal = adventure.price * nights;
  const extrasTotal = adventure.extras.reduce((s, e) => s + e.price, 0);
  const total = subtotal + extrasTotal;

  return (
    <div
      className="sticky"
      style={{
        top: '88px',
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
      }}
    >
      {/* Price header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '2rem',
              color: '#1C2620',
              lineHeight: '1',
            }}
          >
            {adventure.price > 0 ? `${adventure.price} €` : 'Gratuit'}
            {adventure.price > 0 && (
              <span style={{ fontSize: '14px', fontWeight: 400, color: '#6B7280', fontFamily: 'var(--font-sans)' }}> /nuit</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p style={{ fontSize: '13px', color: '#1C2620', fontFamily: 'var(--font-sans)' }}>
            <span style={{ color: '#1C2620' }}>★ {adventure.rating}</span>
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{adventure.reviews} séjours</p>
        </div>
      </div>

      {/* Date inputs */}
      {adventure.price > 0 && (
        <div
          className="mb-4"
          style={{
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <div className="grid grid-cols-2">
            <div style={{ padding: '12px 14px', borderRight: '1px solid rgba(0,0,0,0.08)' }}>
              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Arrivée</p>
              <input
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                className="w-full outline-none"
                style={{ fontSize: '13px', color: '#1C2620', fontFamily: 'var(--font-sans)', background: 'transparent' }}
              />
            </div>
            <div style={{ padding: '12px 14px' }}>
              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Départ</p>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full outline-none"
                style={{ fontSize: '13px', color: '#1C2620', fontFamily: 'var(--font-sans)', background: 'transparent' }}
              />
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Voyageurs</p>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: '13px', color: '#1C2620', fontFamily: 'var(--font-sans)' }}>{guests} adulte{guests > 1 ? 's' : ''} · pas d&apos;enfant</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ border: '1px solid rgba(0,0,0,0.12)', fontSize: '14px', color: '#1C2620' }}
                >
                  −
                </button>
                <span style={{ fontSize: '13px', color: '#1C2620', fontFamily: 'var(--font-sans)', minWidth: '16px', textAlign: 'center' }}>{guests}</span>
                <button
                  onClick={() => setGuests(Math.min(adventure.maxGuests, guests + 1))}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ border: '1px solid rgba(0,0,0,0.12)', fontSize: '14px', color: '#1C2620' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price breakdown */}
      {adventure.price > 0 && (
        <div className="mb-5 space-y-2">
          <div className="flex justify-between">
            <p style={{ fontSize: '13px', color: '#374151', fontFamily: 'var(--font-sans)' }}>{adventure.price} € × {nights} nuits</p>
            <p style={{ fontSize: '13px', color: '#1C2620', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{subtotal} €</p>
          </div>
          {adventure.included.map((item) => (
            <div key={item} className="flex justify-between">
              <p style={{ fontSize: '13px', color: '#374151', fontFamily: 'var(--font-sans)' }}>{item}</p>
              <p style={{ fontSize: '13px', color: '#059669', fontFamily: 'var(--font-sans)' }}>Inclus</p>
            </div>
          ))}
          {adventure.extras.map((extra) => (
            <div key={extra.label} className="flex justify-between">
              <p style={{ fontSize: '13px', color: '#374151', fontFamily: 'var(--font-sans)' }}>{extra.label}</p>
              <p style={{ fontSize: '13px', color: '#1C2620', fontFamily: 'var(--font-sans)' }}>{extra.price} €</p>
            </div>
          ))}
          <div
            className="flex justify-between pt-3"
            style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
          >
            <p style={{ fontSize: '14px', color: '#1C2620', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>Total</p>
            <p style={{ fontSize: '14px', color: '#1C2620', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{total} €</p>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        className="w-full font-semibold transition-all duration-200 hover:opacity-90"
        style={{
          background: '#1C2620',
          color: '#FFFFFF',
          borderRadius: '10px',
          padding: '14px',
          fontSize: '14px',
          fontFamily: 'var(--font-sans)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {adventure.price > 0 ? 'Réserver' : 'Télécharger le guide'}
      </button>

      {adventure.price > 0 && (
        <p style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'var(--font-sans)', textAlign: 'center', marginTop: '10px' }}>
          Vous ne payez que 24 h avant l&apos;arrivée
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AventureDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const adventure = ADVENTURES_DATA[slug] || getFallbackAdventure(slug);
  const [_galleryOpen, setGalleryOpen] = useState(false);

  return (
    <>
      <Header />
      <main style={{ background: '#F5F2EC', minHeight: '100vh' }}>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden" style={{ height: 'clamp(400px, 55vw, 640px)' }}>
          {/* Background image */}
          <AppImage
            src={adventure.heroImage}
            alt={adventure.heroAlt}
            fill
            className="object-cover"
            priority
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(14,21,18,0.3) 0%, rgba(14,21,18,0.2) 40%, rgba(14,21,18,0.75) 80%, rgba(14,21,18,0.92) 100%)',
            }}
          />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {/* Top: breadcrumb + actions */}
            <div className="max-w-7xl mx-auto w-full px-5 sm:px-8 lg:px-12 xl:px-16 pt-24 flex items-start justify-between">
              {/* Breadcrumb */}
              <nav>
                <ol
                  className="flex items-center gap-2"
                  style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.5)', letterSpacing: '0.08em' }}
                >
                  <li><Link href="/" className="hover:text-white/70 transition-colors">Accueil</Link></li>
                  <li style={{ color: 'rgba(231,227,214,0.2)' }}>›</li>
                  <li><Link href="/aventures" className="hover:text-white/70 transition-colors">Aventures</Link></li>
                  <li style={{ color: 'rgba(231,227,214,0.2)' }}>›</li>
                  <li style={{ color: 'rgba(231,227,214,0.7)' }}>{adventure.title} {adventure.titleItalic}</li>
                </ol>
              </nav>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {['🏠', '🖨', '♡'].map((icon, i) => (
                  <button
                    key={i}
                    className="w-9 h-9 flex items-center justify-center transition-all hover:scale-105"
                    style={{
                      background: 'rgba(14,21,18,0.6)',
                      border: '1px solid rgba(231,227,214,0.15)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(8px)',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                    aria-label={['Accueil', 'Imprimer', 'Sauvegarder'][i]}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom: title + stats */}
            <div className="max-w-7xl mx-auto w-full px-5 sm:px-8 lg:px-12 xl:px-16 pb-10">
              {/* Tags */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {adventure.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs"
                    style={{
                      background: 'rgba(14,21,18,0.6)',
                      border: '1px solid rgba(231,227,214,0.15)',
                      borderRadius: '6px',
                      color: 'rgba(231,227,214,0.8)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.05em',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Title */}
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'clamp(2.2rem, 5vw, 4rem)',
                  lineHeight: '1.0',
                  letterSpacing: '-0.04em',
                  color: '#FFFFFF',
                  marginBottom: '10px',
                }}
              >
                {adventure.title}{' '}
                <em style={{ fontStyle: 'italic' }}>{adventure.titleItalic}</em>
              </h1>

              {/* Location */}
              <div className="flex items-center gap-4 mb-8 flex-wrap">
                <p style={{ fontSize: '13px', color: 'rgba(231,227,214,0.6)', fontFamily: 'var(--font-sans)' }}>
                  📍 {adventure.region} · {adventure.country}
                </p>
                <span style={{ color: 'rgba(231,227,214,0.2)' }}>·</span>
                <p style={{ fontSize: '13px', color: 'rgba(231,227,214,0.6)', fontFamily: 'var(--font-sans)' }}>
                  ▲ {adventure.altitude}
                </p>
                <span style={{ color: 'rgba(231,227,214,0.2)' }}>·</span>
                <p style={{ fontSize: '13px', color: 'rgba(231,227,214,0.6)', fontFamily: 'var(--font-sans)' }}>
                  ★ {adventure.rating} · {adventure.reviews} séjours
                </p>
              </div>

              {/* Stats bar */}
              <div className="flex items-end gap-8 flex-wrap">
                {[
                  { label: 'Distance', value: adventure.distance },
                  { label: 'Dénivelé', value: adventure.elevation },
                  { label: 'Difficulté', value: adventure.difficultyLabel, isDots: true },
                ].map((stat, i) => (
                  <React.Fragment key={stat.label}>
                    {i > 0 && <div style={{ width: '1px', height: '40px', background: 'rgba(231,227,214,0.15)' }} />}
                    <div>
                      <p
                        style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(231,227,214,0.4)',
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        {stat.label}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)',
                          color: '#FFFFFF',
                          lineHeight: '1',
                        }}
                      >
                        {stat.value.includes('km') ? (
                          <>
                            {stat.value.replace(' km', '')} <span style={{ fontSize: '0.6em', fontStyle: 'italic', fontWeight: 400 }}>km</span>
                          </>
                        ) : stat.value.includes('m') && !stat.value.includes('/') ? (
                          <>
                            {stat.value.replace(' m', '')} <span style={{ fontSize: '0.6em', fontStyle: 'italic', fontWeight: 400 }}>m</span>
                          </>
                        ) : (
                          stat.value
                        )}
                      </p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── BODY ── */}
        <div
          className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-12 sm:py-16"
          style={{ background: '#F5F2EC' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">

            {/* ── LEFT COLUMN ── */}
            <div className="lg:col-span-2 space-y-12">

              {/* Description */}
              <div>
                <p
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: '#4A6355',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    marginBottom: '16px',
                  }}
                >
                  L&apos;aventure
                </p>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                    lineHeight: '1.15',
                    letterSpacing: '-0.03em',
                    color: '#1C2620',
                    marginBottom: '16px',
                  }}
                >
                  Un refuge de <em style={{ fontStyle: 'italic' }}>pierre sèche</em>{' '}
                  où le silence commence.
                </h2>
                <p
                  style={{
                    fontSize: '15px',
                    color: '#374151',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: '1.75',
                    maxWidth: '560px',
                  }}
                >
                  {adventure.description}
                </p>
              </div>

              {/* Features grid */}
              {adventure.features.length > 0 && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  style={{
                    borderTop: '1px solid rgba(28,38,32,0.08)',
                    paddingTop: '32px',
                  }}
                >
                  {adventure.features.map((feat) => (
                    <div key={feat.label} className="flex items-start gap-3">
                      <span style={{ fontSize: '18px', lineHeight: '1', marginTop: '2px' }}>{feat.icon}</span>
                      <div>
                        <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: '2px' }}>{feat.label}</p>
                        <p style={{ fontSize: '13px', color: '#374151', fontFamily: 'var(--font-sans)', lineHeight: '1.5' }}>{feat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Itinerary */}
              {adventure.itinerary.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(28,38,32,0.08)', paddingTop: '40px' }}>
                  <p
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: '#4A6355',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}
                  >
                    L&apos;itinéraire
                  </p>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
                      color: '#1C2620',
                      marginBottom: '32px',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {adventure.duration}
                  </h3>

                  <div className="space-y-0">
                    {adventure.itinerary.map((day, i) => (
                      <div
                        key={day.day}
                        className="flex gap-6"
                        style={{
                          paddingBottom: i < adventure.itinerary.length - 1 ? '32px' : '0',
                          borderBottom: i < adventure.itinerary.length - 1 ? '1px solid rgba(28,38,32,0.06)' : 'none',
                          marginBottom: i < adventure.itinerary.length - 1 ? '32px' : '0',
                        }}
                      >
                        {/* Day number */}
                        <div className="flex-shrink-0">
                          <p
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontWeight: 800,
                              fontSize: 'clamp(2rem, 4vw, 3rem)',
                              color: 'rgba(28,38,32,0.12)',
                              lineHeight: '1',
                              letterSpacing: '-0.04em',
                              fontStyle: 'italic',
                              minWidth: '60px',
                            }}
                          >
                            j.{day.day}
                          </p>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <h4
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontWeight: 600,
                                fontSize: '15px',
                                color: '#1C2620',
                                marginBottom: '6px',
                              }}
                            >
                              {day.title}
                            </h4>
                            <div className="text-right flex-shrink-0">
                              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Distance</p>
                              <p style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#1C2620' }}>{day.distance}</p>
                            </div>
                          </div>
                          <p style={{ fontSize: '13px', color: '#6B7280', fontFamily: 'var(--font-sans)', lineHeight: '1.65' }}>
                            {day.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gallery */}
              {adventure.gallery.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(28,38,32,0.08)', paddingTop: '40px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
                      color: '#1C2620',
                      marginBottom: '24px',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Les <em style={{ fontStyle: 'italic' }}>lieux,</em> en images
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {adventure.gallery.map((img, i) => (
                      <div
                        key={i}
                        className={`relative overflow-hidden cursor-pointer group ${i === adventure.gallery.length - 1 ? 'relative' : ''}`}
                        style={{ borderRadius: '10px', aspectRatio: '4/3' }}
                        onClick={() => setGalleryOpen(true)}
                      >
                        <AppImage
                          src={img.src}
                          alt={img.alt}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                        {i === adventure.gallery.length - 1 && (
                          <div
                            className="absolute inset-0 flex items-end justify-end p-3"
                            style={{ background: 'rgba(14,21,18,0.4)' }}
                          >
                            <span
                              className="px-2.5 py-1"
                              style={{
                                background: 'rgba(14,21,18,0.8)',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: 'rgba(231,227,214,0.8)',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              + {adventure.reviews} photos
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kit CTA */}
              <div
                style={{
                  borderTop: '1px solid rgba(28,38,32,0.08)',
                  paddingTop: '40px',
                }}
              >
                <div
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                  style={{
                    background: '#1C2620',
                    borderRadius: '14px',
                    padding: '24px 28px',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '6px' }}>Kit recommandé</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: '#FFFFFF', marginBottom: '4px' }}>
                      Composez votre kit pour cette aventure.
                    </p>
                    <p style={{ fontSize: '13px', color: 'rgba(231,227,214,0.5)', fontFamily: 'var(--font-sans)' }}>
                      4 questions · Kit optimisé pour {adventure.duration}
                    </p>
                  </div>
                  <Link
                    href="/ai-configurator"
                    className="flex-shrink-0 font-semibold transition-all duration-200 hover:opacity-90"
                    style={{
                      background: '#E7E3D6',
                      color: '#1C2620',
                      borderRadius: '10px',
                      padding: '12px 22px',
                      fontSize: '13px',
                      fontFamily: 'var(--font-sans)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Configurer →
                  </Link>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Booking card ── */}
            <div className="lg:col-span-1">
              <BookingCard adventure={adventure} />
            </div>
          </div>
        </div>

        {/* ── MOBILE BOTTOM SHEET ── */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: '#1C2620',
            borderTop: '1px solid rgba(231,227,214,0.1)',
            padding: '16px 20px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Tags */}
            <div className="flex gap-2">
              {adventure.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs"
                  style={{
                    background: 'rgba(231,227,214,0.08)',
                    border: '1px solid rgba(231,227,214,0.12)',
                    borderRadius: '5px',
                    color: 'rgba(231,227,214,0.6)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Price + CTA */}
            <div className="flex items-center gap-3">
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: '#FFFFFF', lineHeight: '1' }}>
                  {adventure.price > 0 ? `${adventure.price} €` : 'Gratuit'}
                  {adventure.price > 0 && <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(231,227,214,0.5)', fontFamily: 'var(--font-sans)' }}> /nuit</span>}
                </p>
              </div>
              <button
                className="font-semibold transition-all duration-200 hover:opacity-90"
                style={{
                  background: '#E7E3D6',
                  color: '#1C2620',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {adventure.price > 0 ? 'Réserver' : 'Guide PDF'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:hidden" style={{ height: '80px' }} />

        <NewFooterSection />
      </main>
    </>
  );
}
