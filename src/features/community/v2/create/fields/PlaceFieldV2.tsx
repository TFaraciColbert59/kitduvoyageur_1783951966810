'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';

interface GeocodeMatch {
  id: string;
  name: string;
  context: string;
  country: string;
  lat: number;
  lon: number;
}

function labelFor(match: GeocodeMatch): string {
  const context = match.context?.trim();
  return context && context !== match.name ? `${match.name}, ${context}` : match.name;
}

export interface PlaceFieldV2Props {
  /** Champ du libellé du lieu. */
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Champs de coordonnées à renseigner quand un lieu est choisi ou « Ma position ». */
  latName?: string;
  lngName?: string;
  /** Affiche « Ma position » (géolocalisation device). */
  allowCurrentPosition?: boolean;
  onPick?: (place: { label: string; lat: number; lng: number }) => void;
  className?: string;
}

/**
 * Lieu V2 : recherche d'adresse réelle (`/api/geocode`) et « Ma position »
 * (`Publication#10`, `Carnet#7`). Les coordonnées du lieu choisi sont stockées
 * dans les champs `latName`/`lngName` — jamais une position implicite.
 */
export function PlaceFieldV2({
  name,
  label,
  placeholder = 'Lac Blanc, Chamonix…',
  hint,
  latName,
  lngName,
  allowCurrentPosition = true,
  onPick,
  className,
}: PlaceFieldV2Props) {
  const autoId = useId();
  const fieldId = `cv2c-${name}`;
  const labelId = `${fieldId}-label`;
  const listId = `${autoId}-list`;
  const form = useFormContext();
  const value = (form.watch(name) as string | undefined) ?? '';
  const [query, setQuery] = useState(value);
  const [matches, setMatches] = useState<GeocodeMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedRef = useRef(false);

  useEffect(() => setQuery(value), [value]);
  useEffect(() => () => abortRef.current?.abort(), []);

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
      setNotice(null);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=6`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || payload.status === 'unavailable') {
          setMatches([]);
          setNotice('Recherche indisponible pour le moment.');
          return;
        }
        setMatches(Array.isArray(payload.matches) ? payload.matches.slice(0, 6) : []);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setNotice('Recherche indisponible.');
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  const applyPlace = (place: { label: string; lat: number; lng: number }) => {
    form.setValue(name, place.label, { shouldDirty: true, shouldValidate: true });
    if (latName) form.setValue(latName, place.lat, { shouldDirty: true });
    if (lngName) form.setValue(lngName, place.lng, { shouldDirty: true });
    onPick?.(place);
  };

  const select = (match: GeocodeMatch) => {
    selectedRef.current = true;
    const next = labelFor(match);
    setQuery(next);
    applyPlace({ label: next, lat: match.lat, lng: match.lon });
    setMatches([]);
    setOpen(false);
  };

  const applyCurrentPosition = async () => {
    let cancelled = false;
    setGeoState('loading');
    setNotice(null);
    try {
      const position = await getCurrentGeoPosition({ enableHighAccuracy: true, timeout: 10_000 });
      if (cancelled) return;
      const place = {
        label: value.trim() || 'Ma position',
        lat: position.latitude,
        lng: position.longitude,
      };
      applyPlace(place);
      setGeoState('idle');
    } catch {
      if (cancelled) return;
      setGeoState('error');
      setNotice('Position indisponible. Autorise la géolocalisation puis réessaie.');
    }
  };

  return (
    <div className={['lkdv-cv2-field', className].filter(Boolean).join(' ')}>
      <label id={labelId} htmlFor={fieldId} className="lkdv-cv2-field-label">
        {label}
      </label>
      <div className="lkdv-cv2c-place-row">
        <div className="lkdv-cv2c-place">
          <MapPin size={16} aria-hidden="true" />
          <input
            id={fieldId}
            type="text"
            role="combobox"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open && matches.length > 0}
            aria-controls={listId}
            className="lkdv-cv2-input"
            onChange={(event) => {
              selectedRef.current = false;
              setQuery(event.target.value);
              form.setValue(name, event.target.value, { shouldDirty: true });
              setOpen(true);
            }}
            onFocus={() => setOpen(matches.length > 0)}
            onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          />
          {loading ? <Loader2 size={15} className="lkdv-cv2c-spin" aria-label="Recherche" /> : null}
        </div>
        {allowCurrentPosition ? (
          <button
            type="button"
            className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-geo-btn"
            onClick={() => void applyCurrentPosition()}
            disabled={geoState === 'loading'}
            aria-label="Utiliser ma position"
          >
            {geoState === 'loading' ? (
              <Loader2 size={15} className="lkdv-cv2c-spin" aria-hidden="true" />
            ) : (
              <LocateFixed size={15} aria-hidden="true" />
            )}
            Ma position
          </button>
        ) : null}
      </div>
      {open && matches.length > 0 ? (
        <ul id={listId} className="lkdv-cv2c-place-list" role="listbox" aria-label="Lieux trouvés">
          {matches.map((match) => (
            <li key={match.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => select(match)}>
                <MapPin size={13} aria-hidden="true" />
                <span>
                  <b>{match.name}</b>
                  <small>{[match.context, match.country].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hint ? <p className="lkdv-cv2-field-hint">{hint}</p> : null}
      {notice ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          {notice}
        </p>
      ) : null}
      {geoState === 'error' ? null : (
        <span className="lkdv-cv2c-sr-only" aria-live="polite">
          {value ? `Lieu : ${value}` : ''}
        </span>
      )}
    </div>
  );
}
