'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Link from 'next/link';
import { getAllCountries } from '@/lib/countries';
import AppImage from '@/components/ui/AppImage';

const ALL_COUNTRIES = getAllCountries();

function getFlagEmoji(code: string): string {
  const codePoints = code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const continents = ['Tous', 'Europe', 'Asie', 'Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Océanie'];

const dangerConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  low: { label: 'Sûr', color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.2)' },
  medium: { label: 'Vigilance', color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)' },
  high: { label: 'Risqué', color: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' },
};

const FEATURED = ALL_COUNTRIES.filter((c) => c.published).slice(0, 4);
const PAGE_SIZE = 60;

// ─── Country Card ─────────────────────────────────────────────────────────────

function CountryCard({ country }: { country: ReturnType<typeof getAllCountries>[0] }) {
  const danger = dangerConfig[country.danger_level] || dangerConfig.medium;

  return (
    <Link
      href={`/pays/${country.code.toLowerCase()}`}
      className="group block"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DA',
        borderRadius: '16px',
        padding: '20px',
        transition: 'all 0.25s ease',
        boxShadow: '0 1px 3px rgba(28,38,32,0.04)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,38,32,0.2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(28,38,32,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E4DA'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(28,38,32,0.04)'; }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label={`Drapeau ${country.nom}`}>
            {getFlagEmoji(country.code)}
          </span>
          <div>
            <h3
              style={{
                fontFamily: 'Georgia, serif',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#1C2620',
                lineHeight: '1.2',
                marginBottom: '2px',
              }}
            >
              {country.nom}
            </h3>
            <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#8A8578', letterSpacing: '0.08em' }}>
              {country.capital}
            </p>
          </div>
        </div>
        <span
          className="px-2 py-1 text-xs font-medium flex-shrink-0"
          style={{
            background: danger.bg,
            color: danger.color,
            border: `1px solid ${danger.border}`,
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
          }}
        >
          {danger.label}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: '11px', color: '#8A8578', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          Meilleure saison
        </p>
        <p style={{ fontSize: '11px', color: '#5C6B5E', fontFamily: 'var(--font-sans)' }}>
          {country.meilleure_saison}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {country.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5"
            style={{
              background: '#F5F2EC',
              border: '1px solid #E8E4DA',
              borderRadius: '5px',
              fontSize: '10px',
              color: '#8A8578',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {!country.published && (
        <div
          className="mt-3 px-2.5 py-1.5"
          style={{
            background: 'rgba(217,119,6,0.06)',
            border: '1px solid rgba(217,119,6,0.15)',
            borderRadius: '6px',
          }}
        >
          <p style={{ fontSize: '10px', color: '#D97706', fontFamily: 'var(--font-mono)' }}>⚠ En cours de vérification</p>
        </div>
      )}
    </Link>
  );
}

// ─── Featured Card ────────────────────────────────────────────────────────────

const COUNTRY_IMAGES: Record<string, { src: string; alt: string }> = {
  JP: { src: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80', alt: 'Mont Fuji enneigé reflété dans un lac japonais au lever du soleil' },
  NP: { src: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Panorama de l\'Himalaya avec les sommets enneigés du Népal' },
  IS: { src: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80', alt: 'Paysage volcanique islandais avec vapeurs géothermiques et montagnes colorées' },
  NO: { src: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80', alt: 'Fjord norvégien avec montagnes enneigées et reflets dans l\'eau calme' },
  NZ: { src: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&q=80', alt: 'Paysage verdoyant de Nouvelle-Zélande avec collines et ciel dramatique' },
  MA: { src: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=800&q=80', alt: 'Médina de Marrakech avec ses ruelles colorées et architecture traditionnelle' },
  IN: { src: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80', alt: 'Taj Mahal au lever du soleil avec ses reflets dans le bassin d\'eau' },
  PT: { src: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80', alt: 'Lisbonne avec ses toits de tuiles oranges et le Tage en arrière-plan' },
  SE: { src: 'https://images.unsplash.com/photo-1509356843151-3e7d96241e11?w=800&q=80', alt: 'Forêt suédoise automnale avec lac et reflets dorés' },
  MH: { src: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80', alt: 'Atoll des Îles Marshall avec lagon turquoise et plage de sable blanc' },
};

function FeaturedCountryCard({ country }: { country: ReturnType<typeof getAllCountries>[0] }) {
  const img = COUNTRY_IMAGES[country.code.toUpperCase()];
  const danger = dangerConfig[country.danger_level] || dangerConfig.medium;

  return (
    <Link
      href={`/pays/${country.code.toLowerCase()}`}
      className="group relative overflow-hidden block"
      style={{ borderRadius: '16px', height: '260px' }}
    >
      {img ? (
        <>
          <AppImage
            src={img.src}
            alt={img.alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(14,21,18,0.88) 0%, rgba(14,21,18,0.25) 60%, transparent 100%)' }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: '#1C2620' }}
        >
          <span className="text-6xl">{getFlagEmoji(country.code)}</span>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex justify-between items-start">
          <span className="text-3xl">{getFlagEmoji(country.code)}</span>
          <span
            className="px-2 py-1"
            style={{
              background: 'rgba(14,21,18,0.7)',
              border: '1px solid rgba(231,227,214,0.15)',
              borderRadius: '6px',
              fontSize: '10px',
              color: danger.color,
              fontFamily: 'var(--font-mono)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {danger.label}
          </span>
        </div>

        <div>
          <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {country.continent}
          </p>
          <h3
            style={{
              fontFamily: 'Georgia, serif',
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: '1.3rem',
              color: '#FFFFFF',
              lineHeight: '1.1',
              marginBottom: '6px',
            }}
          >
            {country.nom}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {country.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5"
                style={{
                  background: 'rgba(14,21,18,0.6)',
                  border: '1px solid rgba(231,227,214,0.12)',
                  borderRadius: '5px',
                  fontSize: '10px',
                  color: 'rgba(231,227,214,0.7)',
                  fontFamily: 'var(--font-mono)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaysPage() {
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('Tous');
  const [dangerFilter, setDangerFilter] = useState('Tous');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return ALL_COUNTRIES.filter((c) => {
      const matchSearch =
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.capital.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchContinent = continent === 'Tous' || c.continent === continent;
      const matchDanger = dangerFilter === 'Tous' || c.danger_level === dangerFilter;
      return matchSearch && matchContinent && matchDanger;
    });
  }, [search, continent, dangerFilter]);

  useEffect(() => { setPage(1); }, [search, continent, dangerFilter]);

  const displayItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < filtered.length;

  return (
    <>
      <Header />
      <main style={{ background: '#F5F2EC', minHeight: '100vh' }}>

        {/* ── HERO — fond vert foncé ── */}
        <section
          className="relative overflow-hidden"
          style={{ background: '#1C2620', paddingTop: '120px', paddingBottom: '80px' }}
        >
          {/* Grain texture */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '128px' }} />
          {/* Background photo overlay */}
          <div className="absolute inset-0">
            <AppImage
              src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80"
              alt="Vue aérienne d'une chaîne de montagnes enneigées avec nuages et ciel bleu"
              fill
              className="object-cover opacity-20"
              priority
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(28,38,32,0.7) 0%, rgba(28,38,32,0.85) 100%)' }} />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
            {/* Breadcrumb */}
            <nav className="mb-10">
              <ol className="flex items-center gap-2" style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.4)', letterSpacing: '0.08em' }}>
                <li><a href="/" className="hover:text-white/70 transition-colors">Accueil</a></li>
                <li style={{ color: 'rgba(231,227,214,0.2)' }}>›</li>
                <li style={{ color: 'rgba(231,227,214,0.7)' }}>Fiches pays</li>
              </ol>
            </nav>

            {/* Eyebrow mono */}
            <p
              className="mb-4"
              style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#E4501C', letterSpacing: '0.2em', textTransform: 'uppercase' }}
            >
              · Destinations
            </p>

            <h1
              style={{
                fontFamily: 'Georgia, serif',
                fontWeight: 800,
                fontStyle: 'italic',
                fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                lineHeight: '1.0',
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                maxWidth: '700px',
                marginBottom: '20px',
              }}
            >
              Le monde,{' '}
              <em style={{ fontStyle: 'normal', color: 'rgba(231,227,214,0.45)' }}>pays par pays.</em>
            </h1>

            <p
              style={{
                fontSize: 'clamp(1rem, 1.5vw, 1.1rem)',
                color: 'rgba(231,227,214,0.6)',
                fontFamily: 'var(--font-sans)',
                lineHeight: '1.6',
                maxWidth: '520px',
                marginBottom: '48px',
              }}
            >
              {ALL_COUNTRIES.length} fiches pays avec informations pratiques, météo, visa, santé et équipement recommandé.
            </p>

            {/* Stats */}
            <div className="flex items-center gap-10 flex-wrap">
              {[
                { value: `${ALL_COUNTRIES.length}`, label: 'pays' },
                { value: `${ALL_COUNTRIES.filter(c => c.danger_level === 'low').length}`, label: 'destinations sûres' },
                { value: `${ALL_COUNTRIES.filter(c => c.published).length}`, label: 'fiches vérifiées' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: '#FFFFFF', lineHeight: '1', letterSpacing: '-0.03em' }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURED — fond crème ── */}
        {FEATURED.length > 0 && (
          <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-14 sm:py-16">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#E4501C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  · Destinations phares
                </p>
                <h2
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontWeight: 800,
                    fontStyle: 'italic',
                    fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                    color: '#1C2620',
                    lineHeight: '1.1',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Les incontournables.
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURED.map((country) => (
                <FeaturedCountryCard key={country.code} country={country} />
              ))}
            </div>
          </section>
        )}

        {/* ── FILTERS — fond crème sticky ── */}
        <section
          style={{
            background: '#F5F2EC',
            borderTop: '1px solid #E8E4DA',
            borderBottom: '1px solid #E8E4DA',
            position: 'sticky',
            top: '64px',
            zIndex: 30,
          }}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher un pays…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="outline-none"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E8E4DA',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    color: '#1C2620',
                    fontFamily: 'var(--font-sans)',
                    width: '220px',
                    boxShadow: '0 1px 3px rgba(28,38,32,0.04)',
                  }}
                />
              </div>

              {/* Continent */}
              <div className="flex items-center gap-2 flex-wrap">
                {continents.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    onClick={() => setContinent(c)}
                    className="transition-all duration-200"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                      border: continent === c ? '1px solid #1C2620' : '1px solid #E8E4DA',
                      background: continent === c ? '#1C2620' : '#FFFFFF',
                      color: continent === c ? '#FFFFFF' : '#5C6B5E',
                      cursor: 'pointer',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Danger filter */}
              <div className="flex items-center gap-2">
                {['Tous', 'low', 'medium', 'high'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDangerFilter(d)}
                    className="transition-all duration-200"
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      border: dangerFilter === d ? '1px solid #1C2620' : '1px solid #E8E4DA',
                      background: dangerFilter === d ? '#1C2620' : '#FFFFFF',
                      color: dangerFilter === d ? '#FFFFFF' : '#8A8578',
                      cursor: 'pointer',
                    }}
                  >
                    {d === 'Tous' ? 'Tous' : dangerConfig[d]?.label}
                  </button>
                ))}
              </div>

              {/* Count */}
              <p
                className="sm:ml-auto"
                style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#8A8578', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}
              >
                {filtered.length} pays
              </p>
            </div>
          </div>
        </section>

        {/* ── GRID — fond crème ── */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10 sm:py-12">
          {displayItems.length === 0 ? (
            <div className="text-center py-24">
              <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.5rem', color: '#8A8578' }}>
                Aucun pays trouvé.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayItems.map((country) => (
                <CountryCard key={country.code} country={country} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="font-medium transition-all duration-200 hover:bg-[#1C2620] hover:text-white"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E4DA',
                  borderRadius: '12px',
                  padding: '12px 28px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  color: '#5C6B5E',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(28,38,32,0.04)',
                }}
              >
                Voir plus · {filtered.length - displayItems.length} pays restants
              </button>
            </div>
          )}
        </section>

        {/* ── CTA CONFIGURATEUR ── */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pb-16 sm:pb-20">
          <div
            className="relative overflow-hidden"
            style={{ background: '#1C2620', borderRadius: '20px', padding: 'clamp(40px, 5vw, 64px)' }}
          >
            {/* Grain */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '128px' }} />
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div>
                <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#E4501C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }}>
                  · Kit sur mesure
                </p>
                <h2
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontWeight: 800,
                    fontStyle: 'italic',
                    fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
                    lineHeight: '1.1',
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                    marginBottom: '12px',
                  }}
                >
                  Composez votre kit{' '}
                  <em style={{ fontStyle: 'normal', color: 'rgba(231,227,214,0.4)' }}>pour cette destination.</em>
                </h2>
                <p style={{ fontSize: '15px', color: 'rgba(231,227,214,0.5)', fontFamily: 'var(--font-sans)', lineHeight: '1.6', maxWidth: '480px' }}>
                  4 questions. Un kit optimisé pour votre pays, votre durée et votre saison.
                </p>
              </div>
              <Link
                href="/ai-configurator"
                className="flex-shrink-0 font-semibold transition-all duration-200 hover:opacity-90"
                style={{ background: '#E7E3D6', color: '#1C2620', borderRadius: '12px', padding: '14px 28px', fontSize: '14px', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}
              >
                Configurer mon kit →
              </Link>
            </div>
          </div>
        </section>

        <NewFooterSection />
      </main>
    </>
  );
}