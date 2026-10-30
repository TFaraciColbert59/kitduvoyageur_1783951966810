'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import './place-search.css';

interface GeocodeMatch {
  id: string;
  name: string;
  context: string;
  country: string;
  lat: number;
  lon: number;
}

export interface PlaceSearchProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  id?: string;
  disabled?: boolean;
  /** Lieu choisi dans la liste, avec ses coordonnées (ex. recentrer une carte). */
  onPick?: (place: { label: string; lat: number; lon: number }) => void;
}

function labelFor(match: GeocodeMatch): string {
  const context = match.context?.trim();
  return context && context !== match.name ? `${match.name}, ${context}` : match.name;
}

/** Recherche d'adresse réelle, via la route géocodage serveur LKDV. */
export function PlaceSearch({ label, value, onChange, placeholder = 'Adresse, ville, lieu-dit…', hint, id, disabled, onPick }: PlaceSearchProps) {
  const autoId = useId();
  const inputId = id ?? `place-${autoId}`;
  const [query, setQuery] = useState(value);
  const [matches, setMatches] = useState<GeocodeMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [openUp, setOpenUp] = useState(false);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || (selectedRef.current && q === value)) {
      setMatches([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=6`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || payload.status === 'unavailable') {
          setMatches([]);
          setError('Recherche indisponible pour le moment.');
          return;
        }
        setMatches(Array.isArray(payload.matches) ? payload.matches.slice(0, 6) : []);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError('Recherche indisponible.');
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  const positionList = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setOpenUp(rect.bottom > window.innerHeight - 260);
  };

  const select = (match: GeocodeMatch) => {
    const next = labelFor(match);
    selectedRef.current = true;
    setQuery(next);
    onChange(next);
    if (Number.isFinite(match.lat) && Number.isFinite(match.lon)) onPick?.({ label: next, lat: match.lat, lon: match.lon });
    setMatches([]);
    setOpen(false);
  };

  return (
    <div className="lkdv-place-search">
      <label className="lkdv-form-label" htmlFor={inputId}>{label}</label>
      <div className="lkdv-place-input">
        <MapPin size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
          aria-controls={`${inputId}-list`}
          onChange={(event) => {
            selectedRef.current = false;
            setQuery(event.target.value);
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => { positionList(); setOpen(matches.length > 0); }}
          onPointerDown={positionList}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        />
        {loading ? <Loader2 size={14} className="lkdv-place-spin" aria-label="Recherche" /> : null}
      </div>
      {hint ? <span className="lkdv-form-hint">{hint}</span> : null}
      {open && matches.length > 0 ? (
        <ul id={`${inputId}-list`} className="lkdv-place-list" role="listbox" data-up={openUp ? 'true' : 'false'}>
          {matches.map((match) => (
            <li key={match.id} role="option" aria-selected="false">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => select(match)}>
                <MapPin size={12} aria-hidden="true" />
                <span><b>{match.name}</b><small>{[match.context, match.country].filter(Boolean).join(' · ')}</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <span className="lkdv-form-error-inline" role="alert">{error}</span> : null}
    </div>
  );
}

export default PlaceSearch;
