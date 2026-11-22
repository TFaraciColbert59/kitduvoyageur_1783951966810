'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useClubDialog } from './useClubDialog';

export function normalizeSearchText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, value]);
  return debounced;
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // ignore storage errors
    }
    return initialValue;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota/private mode errors
    }
  }, [key, state]);

  return [state, setState];
}

export const MASSIF_COORDS: Record<string, [number, number]> = {
  'mont-blanc': [6.8694, 45.9237],
  chamonix: [6.8694, 45.9237],
  alpes: [6.1294, 45.8992],
  ecrins: [6.365, 44.922],
  vercors: [5.534, 45.063],
  chartreuse: [5.804, 45.352],
  belledonne: [6.03, 45.22],
  pyrenees: [0.105, 42.846],
  neouvielle: [0.146, 42.838],
  mercantour: [7.266, 44.132],
  queyras: [6.837, 44.745],
  vanoise: [6.762, 45.402],
  beaufortain: [6.565, 45.702],
  aravis: [6.462, 45.897],
  vosges: [7.012, 48.036],
  jura: [6.028, 46.519],
  corse: [9.064, 42.299],
  auvergne: [2.815, 45.545],
};

export function resolveMassifCoords(massif: string, fallbackLat = 45.764, fallbackLng = 4.835): { lat: number; lng: number } {
  const norm = normalizeSearchText(massif);
  for (const [key, [lng, lat]] of Object.entries(MASSIF_COORDS)) {
    if (norm.includes(key)) {
      return { lat, lng };
    }
  }
  return { lat: fallbackLat, lng: fallbackLng };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface ClubEmptyCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function ClubEmptyCard({ icon, title, description, actions }: ClubEmptyCardProps) {
  return (
    <div className="lkdv-carnet-empty-card club-empty-card" data-testid="club-empty-card">
      <div className="club-empty-ico" aria-hidden="true">
        {icon}
      </div>
      <b>{title}</b>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="club-empty-actions">{actions}</div> : null}
    </div>
  );
}

export interface ClubPeekAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

export interface ClubEntityPeekProps {
  open: boolean;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  monogram?: string;
  actions: ClubPeekAction[];
  onClose: () => void;
}

export function ClubEntityPeek({
  open,
  title,
  subtitle,
  imageUrl,
  monogram,
  actions,
  onClose,
}: ClubEntityPeekProps) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 160);
  }, [closing, onClose]);

  const dialogRef = useClubDialog(open, requestClose);

  if (!open) return null;

  return (
    <div
      className={`lkdv-peek club-entity-peek${closing ? ' closing' : ''}`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        className="lkdv-peek-box"
        role="dialog"
        aria-modal="true"
        aria-label={`Aperçu ${title}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lkdv-peek-preview">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="lkdv-peek-fallback">{monogram || title.slice(0, 2).toUpperCase()}</span>
          )}
          <div className="lkdv-peek-meta">
            <b>{title}</b>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </div>
        <div className="lkdv-peek-menu" role="group" aria-label={`Actions sur ${title}`}>
          {actions.map((act) => (
            <button
              key={act.id}
              type="button"
              className={act.danger ? 'is-danger' : undefined}
              onClick={() => {
                act.onSelect();
                requestClose();
              }}
            >
              <span>{act.label}</span>
              {act.icon}
            </button>
          ))}
          <button type="button" onClick={requestClose}>
            <span>Fermer</span>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function useLongPressPeek(onTrigger: () => void, delayMs = 460) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button === 2) return;
      triggeredRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = window.setTimeout(() => {
        triggeredRef.current = true;
        onTrigger();
      }, delayMs);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      if (dx > 8 || dy > 8) {
        clear();
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      onTrigger();
    },
  };

  return { handlers, wasLongPress: () => triggeredRef.current };
}
