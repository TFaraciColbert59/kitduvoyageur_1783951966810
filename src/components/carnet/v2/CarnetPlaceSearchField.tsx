'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import type { GeocodeMatch } from '@/features/adventure-prep/geocodeService';

export interface CarnetPlaceSearchFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/**
 * Champ lieu avec autocomplétion réelle (/api/geocode) + géolocalisation inverse GPS.
 */
export function CarnetPlaceSearchField({
  label,
  value,
  onChange,
  placeholder = 'Rechercher un col, sommet, refuge, ville…',
}: CarnetPlaceSearchFieldProps) {
  const [matches, setMatches] = useState<GeocodeMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=6`)
        .then((res) => res.json())
        .then((data: { matches?: GeocodeMatch[] }) => {
          if (!cancelled && Array.isArray(data.matches)) {
            setMatches(data.matches);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, open]);

  const handleLocate = () => {
    if (locating || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/geocode?lat=${encodeURIComponent(String(pos.coords.latitude))}&lon=${encodeURIComponent(String(pos.coords.longitude))}`,
          );
          const data = (await res.json()) as { matches?: GeocodeMatch[] };
          const best = data.matches?.[0];
          if (best) {
            skipNextFetchRef.current = true;
            onChange(best.context ? `${best.name}, ${best.context}` : best.name);
            setOpen(false);
          }
        } catch {
          // silencieux
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 6000 },
    );
  };

  return (
    <div className="lkdv-cv2-field" style={{ position: 'relative' }}>
      <span className="lkdv-cv2-field-label">
        <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
        {label} {loading ? '· recherche…' : ''}
      </span>
      <div className="lkdv-carnet-pokedex-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={value}
          maxLength={100}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
        />
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          title="Utiliser ma position actuelle"
          aria-label="Utiliser ma position actuelle"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 999,
            border: 0,
            background: 'rgba(27, 67, 50, 0.08)',
            color: '#1b4332',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <LocateFixed size={13} className={locating ? 'animate-spin' : undefined} />
        </button>
      </div>
      {open && matches.length > 0 ? (
        <div
          role="listbox"
          aria-label="Suggestions de lieux"
          style={{
            marginTop: 6,
            borderRadius: 16,
            border: '1px solid rgba(27, 67, 50, 0.14)',
            background: 'rgba(255, 255, 255, 0.96)',
            boxShadow: '0 10px 26px rgba(15, 23, 42, 0.1)',
            overflow: 'hidden',
            maxHeight: 196,
            overflowY: 'auto',
          }}
        >
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                skipNextFetchRef.current = true;
                onChange(m.context ? `${m.name}, ${m.context}` : m.name);
                setMatches([]);
                setOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px',
                border: 0,
                borderBottom: '1px solid rgba(27, 67, 50, 0.08)',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <MapPin size={13} style={{ color: '#1b4332', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.name}
                </div>
                {m.context || m.country ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--label2, #56665d)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {[m.context, m.country].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
