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