'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { getAllCountries, type Country } from '@/lib/countries';

const CountryGlobe = dynamic(
  () => import('@/components/pays/CountryGlobe'),
  { ssr: false }
);

const ALL_COUNTRIES = getAllCountries();

const CONTINENTS = ['Tous', 'Europe', 'Asie', 'Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Océanie'];

const CONTINENT_EMOJIS: Record<string, string> = {
  'Tous': '🌍',
  'Europe': '🏔️',
  'Asie': '🗺️',
  'Afrique': '🦁',
  'Amérique du Nord': '🦅',
  'Amérique du Sud': '🌿',
  'Océanie': '🌊',
};

const GLASS_TOP = 'rgba(11,31,23,0.75)';
const GLASS_BORDER = 'rgba(255,255,255,0.08)';

const glassSx: React.CSSProperties = {
  background: GLASS_TOP,
  backdropFilter: 'blur(24px) saturate(1.5)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
  border: `1px solid ${GLASS_BORDER}`,
};

const DANGER_DOTS: Record<string, string> = {
  low: '#2D6A4F',
  medium: '#D97706',
  high: '#DC2626',
};

const DANGER_LABELS: Record<string, string> = {
  low: 'Sûr',
  medium: 'Vigilance',
  high: 'Risqué',
};

const ALL_TAGS = Array.from(new Set(ALL_COUNTRIES.flatMap((c) => c.tags))).sort();

// ─── Country Card ─────────────────────────────────────────────────────────────

function CountryCard({ country }: { country: ReturnType<typeof getAllCountries>[0] }) {
  const danger = DANGER_CONFIG[country.danger_level] || DANGER_CONFIG.medium;

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
  const danger = DANGER_CONFIG[country.danger_level] || DANGER_CONFIG.medium;

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
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('Tous');
  const [dangerFilter, setDangerFilter] = useState<string>('Tous');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [focusCode, setFocusCode] = useState<string | undefined>(undefined);
  const [webglSupported, setWebglSupported] = useState(true);

  // WebGL detection
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (!gl) setWebglSupported(false);
    }
  }, []);

  const handleCountryClick = useCallback(
    (code: string) => router.push(`/pays/${code.toLowerCase()}`),
    [router]
  );

  // Search → focus camera
  useEffect(() => {
    if (!search || search.length < 2) { setFocusCode(undefined); return; }
    const match = ALL_COUNTRIES.find(
      (c) =>
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.capital.toLowerCase().includes(search.toLowerCase())
    );
    setFocusCode(match?.code.toLowerCase() ?? undefined);
  }, [search]);

  const filtered = useMemo(() => {
    return ALL_COUNTRIES.filter((c) => {
      const matchSearch =
        !search ||
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.capital.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchContinent = continent === 'Tous' || c.continent === continent;
      const matchDanger = dangerFilter === 'Tous' || c.danger_level === dangerFilter;
      const matchTag = tagFilter === '' || c.tags.includes(tagFilter);
      return matchSearch && matchContinent && matchDanger && matchTag;
    });
  }, [search, continent, dangerFilter, tagFilter]);

  const hasActiveFilters = search || continent !== 'Tous' || dangerFilter !== 'Tous' || tagFilter;

  const resetFilters = () => {
    setSearch('');
    setContinent('Tous');
    setDangerFilter('Tous');
    setTagFilter('');
  };

  return (
    <>
      {/* Header fixe au-dessus du globe */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, pointerEvents: 'auto' }}>
        <Header />
      </div>

    <div style={{ width: '100vw', height: '100dvh', background: '#0B1F17', overflow: 'hidden', position: 'relative' }}>
      {/* ── Shared globe (desktop + mobile) ── */}
      {webglSupported ? (
        <>
          <div className="hidden md:block" style={{ position: 'absolute', inset: 0 }}>
            <CountryGlobe
              countries={filtered.slice(0, 180)}
              onCountryClick={handleCountryClick}
              focusCode={focusCode}
              fullscreen
            />
          </div>
          <div className="md:hidden" style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)', fontSize: '14px',
            padding: '20px', textAlign: 'center',
          }}>
            🌍 Globe 3D disponible sur ordinateur
          </div>
        </>
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)', fontSize: '14px',
          padding: '20px', textAlign: 'center',
        }}>
          🌍 Globe 3D non disponible sur cet appareil
        </div>
      )}

      {/* ── Glass top bar: search + filters ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '16px 20px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 88px)',
        background: 'linear-gradient(180deg, rgba(11,31,23,0.9) 0%, rgba(11,31,23,0.4) 70%, transparent 100%)',
        zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {/* Search row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          ...glassSx,
          borderRadius: '14px', padding: '4px 12px 4px 16px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un pays, une capitale..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: '14px', fontWeight: 400,
              padding: '8px 0',
            }}
            onFocus={(e) => e.target.style.outline = 'none'}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>
              ✕
            </button>
          )}
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>
            {filtered.length}
          </span>
        </div>

        {/* Filter pills row */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {/* Continent pills */}
          {CONTINENTS.map((c) => (
            <button
              key={c}
              onClick={() => setContinent(c)}
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: continent === c ? 600 : 400,
                whiteSpace: 'nowrap',
                border: `1px solid ${continent === c ? 'rgba(255,255,255,0.2)' : GLASS_BORDER}`,
                background: continent === c ? 'rgba(255,255,255,0.15)' : GLASS_TOP,
                backdropFilter: 'blur(16px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
                color: continent === c ? '#fff' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {CONTINENT_EMOJIS[c]} {c}
            </button>
          ))}

          {/* Danger filter */}
          <select
            value={dangerFilter}
            onChange={(e) => setDangerFilter(e.target.value)}
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 500,
              border: `1px solid ${GLASS_BORDER}`,
              background: GLASS_TOP,
              backdropFilter: 'blur(16px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              flexShrink: 0,
              outline: 'none',
            }}
          >
            <option value="Tous" style={{ background: '#1C2620' }}>🟡 Sécurité</option>
            <option value="low" style={{ background: '#1C2620' }}>🟢 Sûr</option>
            <option value="medium" style={{ background: '#1C2620' }}>🟡 Vigilance</option>
            <option value="high" style={{ background: '#1C2620' }}>🔴 Risqué</option>
          </select>

          {/* Tag filter */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 500,
              border: `1px solid ${GLASS_BORDER}`,
              background: GLASS_TOP,
              backdropFilter: 'blur(16px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              flexShrink: 0,
              outline: 'none',
            }}
          >
            <option value="" style={{ background: '#1C2620' }}>🏷️ Activité</option>
            {ALL_TAGS.map((tag) => (
              <option key={tag} value={tag} style={{ background: '#1C2620' }}>{tag}</option>
            ))}
          </select>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                padding: '5px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              ✕ Réinitialiser
            </button>
          )}

        </div>
      </div>

      {/* ── Glass bottom bar: legend + safety dots ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        background: 'linear-gradient(0deg, rgba(11,31,23,0.9) 0%, rgba(11,31,23,0.3) 70%, transparent 100%)',
        zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {Object.entries(DANGER_DOTS).map(([level, color]) => (
            <span key={level} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block' }} />
              {DANGER_LABELS[level]}
            </span>
          ))}
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace, monospace' }}>
          {filtered.length} pays · Cliquer pour explorer
        </span>
      </div>

    </div>
    </>
  );
}