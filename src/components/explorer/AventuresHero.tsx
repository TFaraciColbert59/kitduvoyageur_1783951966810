'use client';

import React from 'react';

const CATEGORIES = ['Tout', 'Refuge', 'Itinéraire', 'Bivouac', 'Escalade', 'Multi-jours'];

interface AventuresHeroProps {
  activeCategory?: string;
  onCategoryChange?: (cat: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  totalTrailsCount?: number;
}

export default function AventuresHero({
  activeCategory = 'Tout',
  onCategoryChange,
  searchQuery = '',
  onSearchChange,
  totalTrailsCount = 48,
}: AventuresHeroProps) {
  return (
    <div style={{ padding: '12px 16px 16px', background: '#FBFAF6' }}>
      <div
        style={{
          fontSize: '10px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#6B7A72',
          fontWeight: 500,
        }}
      >
        {totalTrailsCount} itinéraires · Chartreuse & Vercors
      </div>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
          margin: '4px 0 10px',
        }}
      >
        Où voulez-vous
        <br />
        <em
          style={{
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            color: '#17402C',
            fontWeight: 400,
          }}
        >
          dormir ce soir ?
        </em>
      </h1>
      {/* Search pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          background: '#F4F1EA',
          border: '1px solid rgba(11,31,23,0.08)',
          borderRadius: '999px',
          color: '#6B7A72',
          fontSize: '13px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher massif, sentier, refuge..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#1C2620',
            fontSize: '13px',
            fontFamily: 'inherit',
          }}
        />
        {searchQuery ? (
          <button
            onClick={() => onSearchChange?.('')}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              color: '#6B7A72',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Effacer la recherche"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </div>
        )}
      </div>
      {/* Category chips */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          padding: '12px 0 4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange?.(cat)}
              style={{
                padding: '8px 14px',
                borderRadius: '999px',
                background: isActive ? '#17402C' : '#FBFAF6',
                border: `1px solid ${isActive ? '#17402C' : 'rgba(11,31,23,0.06)'}`,
                color: isActive ? '#fff' : '#384A42',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 150ms ease',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
