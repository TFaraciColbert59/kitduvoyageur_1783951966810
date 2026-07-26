'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import AppImage from '@/components/ui/AppImage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Adventure {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  country: string;
  duration: string;
  distance: string;
  elevation: string;
  difficulty: number;
  category: string;
  tags: string[];
  image: string;
  alt: string;
  featured: boolean;
  price: number;
  rating: number;
  reviews: number;
  description: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ADVENTURES: Adventure[] = [
  {
    slug: 'cabane-grand-vaneau',
    title: 'Cabane du Grand Vaneau',
    subtitle: 'Refuge non-gardé · Coup de cœur',
    region: 'Massif de la Chartreuse',
    country: 'France',
    duration: '3 jours',
    distance: '27,4 km',
    elevation: '+1 620 m',
    difficulty: 3,
    category: 'Refuge',
    tags: ['Refuge', 'Autonomie', 'Chartreuse'],
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85',
    alt: 'Vue aérienne de la Chartreuse avec forêts denses et falaises calcaires au coucher du soleil',
    featured: true,
    price: 248,
    rating: 4.9,
    reviews: 214,
    description: 'Perchée à l\'extrémité du plateau du Grand Som, la cabane veille sur la vallée d\'Entremont.',
  },
  {
    slug: 'sentier-balcons-chartreuse',
    title: 'Sentier des Balcons',
    subtitle: 'Traversée intégrale',
    region: 'Chartreuse',
    country: 'France',
    duration: '4 jours',
    distance: '68 km',
    elevation: '+3 200 m',
    difficulty: 4,
    category: 'Trekking',
    tags: ['Trekking', 'Bivouac', 'Chartreuse'],
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=85',
    alt: 'Randonneur sur un sentier de crête avec vue panoramique sur les Alpes françaises',
    featured: true,
    price: 0,
    rating: 4.8,
    reviews: 89,
    description: 'La traversée complète du massif de la Chartreuse par les crêtes, de Saint-Pierre-de-Chartreuse à Grenoble.',
  },
  {
    slug: 'bivouac-vercors',
    title: 'Bivouac Vercors',
    subtitle: 'Nuit sous les étoiles',
    region: 'Vercors',
    country: 'France',
    duration: '2 jours',
    distance: '32 km',
    elevation: '+1 100 m',
    difficulty: 2,
    category: 'Bivouac',
    tags: ['Bivouac', 'Vercors', 'Débutant'],
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=85',
    alt: 'Tente de bivouac installée sur un plateau herbeux du Vercors avec vue sur les falaises',
    featured: false,
    price: 0,
    rating: 4.7,
    reviews: 56,
    description: 'Un premier bivouac en autonomie sur les hauts plateaux du Vercors, entre forêts et falaises.',
  },
  {
    slug: 'kayak-ardeche',
    title: 'Gorges de l\'Ardèche',
    subtitle: 'Descente en kayak',
    region: 'Ardèche',
    country: 'France',
    duration: '2 jours',
    distance: '30 km',
    elevation: '—',
    difficulty: 2,
    category: 'Kayak',
    tags: ['Kayak', 'Eau vive', 'Ardèche'],
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=85',
    alt: 'Kayakiste naviguant dans les gorges de l\'Ardèche entre falaises calcaires et eau turquoise',
    featured: false,
    price: 0,
    rating: 4.6,
    reviews: 43,
    description: 'La descente classique des gorges de l\'Ardèche en kayak, avec bivouac sur les plages de galets.',
  },
  {
    slug: 'tour-mont-blanc',
    title: 'Tour du Mont-Blanc',
    subtitle: 'Le classique des classiques',
    region: 'Alpes',
    country: 'France / Italie / Suisse',
    duration: '11 jours',
    distance: '170 km',
    elevation: '+10 000 m',
    difficulty: 5,
    category: 'Trekking',
    tags: ['Trekking', 'Alpes', 'International'],
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=85',
    alt: 'Panorama du Mont-Blanc enneigé depuis un col alpin avec ciel bleu et glaciers',
    featured: true,
    price: 0,
    rating: 5.0,
    reviews: 312,
    description: 'Le tour mythique du toit de l\'Europe. 170 km, trois pays, des refuges légendaires.',
  },
  {
    slug: 'laugavegur-islande',
    title: 'Laugavegur Trail',
    subtitle: 'Islande sauvage',
    region: 'Hautes Terres',
    country: 'Islande',
    duration: '5 jours',
    distance: '55 km',
    elevation: '+2 100 m',
    difficulty: 3,
    category: 'Trekking',
    tags: ['Islande', 'Volcans', 'Autonomie'],
    image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=1200&q=85',
    alt: 'Paysage volcanique islandais avec vapeurs géothermiques, montagnes colorées et sentier de trekking',
    featured: false,
    price: 0,
    rating: 4.9,
    reviews: 156,
    description: 'Paysages lunaires entre volcans, geysers et champs de lave. Une aventure en autonomie complète.',
  },
];

const CATEGORIES = ['Toutes', 'Trekking', 'Refuge', 'Bivouac', 'Kayak'];
const DIFFICULTIES = ['Toutes', '1', '2', '3', '4', '5'];

// ─── Difficulty dots ──────────────────────────────────────────────────────────

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((d) => (
        <div
          key={d}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: d <= level ? '#E7E3D6' : 'rgba(231,227,214,0.2)' }}
        />
      ))}
    </div>
  );
}

// ─── Adventure Card ───────────────────────────────────────────────────────────

function AdventureCard({ adv, featured }: { adv: Adventure; featured?: boolean }) {
  return (
    <Link
      href={`/aventures/${adv.slug}`}
      className={`group relative overflow-hidden block ${featured ? 'lg:col-span-2' : ''}`}
      style={{ borderRadius: '16px' }}
    >
      {/* Image */}
      <div
        className="relative overflow-hidden"
        style={{ height: featured ? 'clamp(340px, 40vw, 520px)' : 'clamp(260px, 28vw, 380px)' }}
      >
        <AppImage
          src={adv.image}
          alt={adv.alt}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes={featured ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 100vw, 33vw'}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(14,21,18,0.92) 0%, rgba(14,21,18,0.4) 50%, transparent 100%)',
          }}
        />

        {/* Tags top-left */}
        <div className="absolute top-4 left-4 flex gap-2">
          {adv.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 text-xs font-medium"
              style={{
                background: 'rgba(14,21,18,0.7)',
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

        {/* Rating top-right */}
        <div
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1"
          style={{
            background: 'rgba(14,21,18,0.7)',
            border: '1px solid rgba(231,227,214,0.15)',
            borderRadius: '6px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ color: '#E7E3D6', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>★ {adv.rating}</span>
          <span style={{ color: 'rgba(231,227,214,0.4)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{adv.reviews}</span>
        </div>

        {/* Content bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
          {/* Region */}
          <p
            className="mb-1"
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'rgba(231,227,214,0.5)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            {adv.region} · {adv.country}
          </p>

          {/* Title */}
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: featured ? 'clamp(1.5rem, 2.5vw, 2rem)' : 'clamp(1.2rem, 2vw, 1.5rem)',
              lineHeight: '1.1',
              color: '#FFFFFF',
              marginBottom: '4px',
            }}
          >
            {adv.title}
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: 'rgba(231,227,214,0.55)',
              fontFamily: 'var(--font-sans)',
              fontStyle: 'italic',
              marginBottom: '12px',
            }}
          >
            {adv.subtitle}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Distance</p>
              <p style={{ fontSize: '14px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#E7E3D6' }}>{adv.distance}</p>
            </div>
            <div style={{ width: '1px', height: '28px', background: 'rgba(231,227,214,0.15)' }} />
            <div>
              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Dénivelé</p>
              <p style={{ fontSize: '14px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#E7E3D6' }}>{adv.elevation}</p>
            </div>
            <div style={{ width: '1px', height: '28px', background: 'rgba(231,227,214,0.15)' }} />
            <div>
              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Difficulté</p>
              <DifficultyDots level={adv.difficulty} />
            </div>
            <div style={{ width: '1px', height: '28px', background: 'rgba(231,227,214,0.15)' }} />
            <div>
              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Durée</p>
              <p style={{ fontSize: '14px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#E7E3D6' }}>{adv.duration}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AventuresPage() {
  const [activeCategory, setActiveCategory] = useState('Toutes');
  const [activeDifficulty, setActiveDifficulty] = useState('Toutes');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return ADVENTURES.filter((a) => {
      const matchCat = activeCategory === 'Toutes' || a.category === activeCategory;
      const matchDiff = activeDifficulty === 'Toutes' || a.difficulty === parseInt(activeDifficulty);
      const matchSearch =
        search === '' ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.region.toLowerCase().includes(search.toLowerCase()) ||
        a.country.toLowerCase().includes(search.toLowerCase()) ||
        a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchDiff && matchSearch;
    });
  }, [activeCategory, activeDifficulty, search]);

  return (
    <>
      <Header />
      <main style={{ background: 'var(--background)', minHeight: '100vh' }}>

        {/* ── HERO ── */}
        <section
          className="relative overflow-hidden"
          style={{ paddingTop: '120px', paddingBottom: '80px' }}
        >
          {/* Background image */}
          <div className="absolute inset-0">
            <AppImage
              src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80"
              alt="Vue panoramique des Alpes françaises avec sommets enneigés et forêts de conifères"
              fill
              className="object-cover"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(14,21,18,0.7) 0%, rgba(14,21,18,0.5) 50%, rgba(14,21,18,0.85) 100%)',
              }}
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
            {/* Breadcrumb */}
            <nav className="mb-10">
              <ol className="flex items-center gap-2" style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.4)', letterSpacing: '0.08em' }}>
                <li><a href="/" className="hover:text-white/70 transition-colors">Accueil</a></li>
                <li style={{ color: 'rgba(231,227,214,0.2)' }}>›</li>
                <li style={{ color: 'rgba(231,227,214,0.7)' }}>Aventures</li>
              </ol>
            </nav>

            {/* Eyebrow */}
            <p
              className="mb-4"
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'rgba(231,227,214,0.5)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Les aventures
            </p>

            {/* Title */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                lineHeight: '1.0',
                letterSpacing: '-0.04em',
                color: '#FFFFFF',
                maxWidth: '700px',
                marginBottom: '20px',
              }}
            >
              Là où la carte{' '}
              <em style={{ fontStyle: 'italic', color: 'rgba(231,227,214,0.5)' }}>se termine.</em>
            </h1>

            <p
              style={{
                fontSize: 'clamp(1rem, 1.5vw, 1.15rem)',
                color: 'rgba(231,227,214,0.6)',
                fontFamily: 'var(--font-sans)',
                lineHeight: '1.6',
                maxWidth: '520px',
                marginBottom: '40px',
              }}
            >
              Des itinéraires sélectionnés pour leur caractère, leur silence et leur exigence. Chaque aventure est accompagnée d&apos;un kit optimisé.
            </p>

            {/* Stats */}
            <div className="flex items-center gap-8 flex-wrap">
              {[
                { value: `${ADVENTURES.length}`, label: 'aventures' },
                { value: '3', label: 'massifs' },
                { value: '4', label: 'pays' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
                      color: '#FFFFFF',
                      lineHeight: '1',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'rgba(231,227,214,0.4)',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FILTERS ── */}
        <section
          style={{
            background: 'var(--background)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            position: 'sticky',
            top: '64px',
            zIndex: 30,
          }}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    color: '#E7E3D6',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
              </div>

              {/* Category filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="transition-all duration-200"
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.05em',
                      border: activeCategory === cat ? '1px solid rgba(231,227,214,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      background: activeCategory === cat ? 'rgba(231,227,214,0.1)' : 'transparent',
                      color: activeCategory === cat ? '#E7E3D6' : 'rgba(231,227,214,0.4)',
                      cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Count */}
              <p
                className="sm:ml-auto"
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'rgba(231,227,214,0.3)',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                }}
              >
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </section>

        {/* ── GRID ── */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-12 sm:py-16">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'rgba(231,227,214,0.3)' }}>
                Aucune aventure trouvée.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filtered.map((adv, i) => (
                <AdventureCard
                  key={adv.slug}
                  adv={adv}
                  featured={adv.featured && i === 0}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── CTA CONFIGURATEUR ── */}
        <section
          className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pb-16 sm:pb-20"
        >
          <div
            className="relative overflow-hidden"
            style={{
              background: '#1C2620',
              borderRadius: '20px',
              padding: 'clamp(40px, 5vw, 64px)',
            }}
          >
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div>
                <p
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'rgba(231,227,214,0.4)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '12px',
                  }}
                >
                  Configurateur IA
                </p>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
                    lineHeight: '1.1',
                    letterSpacing: '-0.03em',
                    color: '#FFFFFF',
                    marginBottom: '12px',
                  }}
                >
                  Composez votre kit{' '}
                  <em style={{ fontStyle: 'italic', color: 'rgba(231,227,214,0.45)' }}>pour cette aventure.</em>
                </h2>
                <p style={{ fontSize: '15px', color: 'rgba(231,227,214,0.5)', fontFamily: 'var(--font-sans)', lineHeight: '1.6', maxWidth: '480px' }}>
                  4 questions. Un kit optimisé pour votre destination, votre durée et votre style.
                </p>
              </div>
              <Link
                href="/ai-configurator"
                className="flex-shrink-0 font-semibold transition-all duration-200 hover:opacity-90"
                style={{
                  background: '#E7E3D6',
                  color: '#1C2620',
                  borderRadius: '12px',
                  padding: '14px 28px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                }}
              >
                Composer mon kit →
              </Link>
            </div>
          </div>
        </section>

        <NewFooterSection />
      </main>
    </>
  );
}
