'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Binoculars,
  Camera,
  Check,
  Compass,
  ExternalLink,
  Feather,
  Flower2,
  Leaf,
  MapPin,
  Mountain,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { SlotLens } from '@/components/compte/drawer/SlotShell';
import type {
  PokedexKingdom,
  PokedexRarity,
} from '@/components/carnet/v2/CarnetPokedexDrawerBody';
import {
  AnimatedNumber,
  CARNET_SPRING,
  StackSlideView,
  StaggerList,
} from '@/components/carnet/v2/CarnetDrawerMotion';
import type {
  GeoJsonFeatureCollection,
  PokedexSpeciesItem,
} from '../../data/unifiedLayersHooks';
import { formatIconicTaxonFr } from '../../poiTaxonomy';

export const POKEDEX_CATEGORY_LENSES: SlotLens[] = [
  { id: 'all', label: 'Tout', icon: <Leaf size={15} aria-hidden="true" /> },
  { id: 'faune', label: 'Faune', icon: <Compass size={15} aria-hidden="true" /> },
  { id: 'flore', label: 'Flore', icon: <Mountain size={15} aria-hidden="true" /> },
];

export type PokedexRarityFilter = 'all' | 'threatened' | 'rare' | 'common';

export interface ExplorerPokedexLensProps {
  species: ReadonlyArray<PokedexSpeciesItem>;
  kingdomFilter: 'all' | 'faune' | 'flore';
  rarityFilter: PokedexRarityFilter;
  selectedTaxonId: number | null;
  loading?: boolean;
  onSelectSpecies: (sp: PokedexSpeciesItem, coords?: [number, number] | null) => void;
  onClearSelection: () => void;
  onFocusCoordinates?: (coords: [number, number], label?: string) => void;
  center: [number, number];
  /** Optional GeoJSON observations collection to resolve exact coordinates on card tap. */
  observationsGeojson?: GeoJsonFeatureCollection | null;
  /** Optional set of taxon IDs already observed by the user (shows emerald "Observé ✓" badge). */
  observedTaxonIds?: ReadonlySet<number>;
  /** Optional hook to persist a field sighting captured in the Explorer observe modal. */
  onObservationSubmitted?: (payload: {
    taxonId: number;
    commonName: string;
    scientificName: string;
    place: string;
    note: string;
    file: File | null;
    coords: [number, number];
  }) => void | Promise<void>;
}

const RARITY_STYLES: Record<
  PokedexRarity,
  { bg: string; color: string; border: string; holo: boolean }
> = {
  Commun: {
    bg: 'rgba(23, 64, 44, 0.1)',
    color: '#17402c',
    border: 'rgba(23, 64, 44, 0.16)',
    holo: false,
  },
  'Peu commun': {
    bg: 'rgba(37, 99, 235, 0.1)',
    color: '#1d4ed8',
    border: 'rgba(37, 99, 235, 0.24)',
    holo: false,
  },
  Rare: {
    bg: 'rgba(180, 83, 9, 0.12)',
    color: '#b45309',
    border: 'rgba(217, 119, 6, 0.34)',
    holo: true,
  },
  Mythique: {
    bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.18), rgba(147, 51, 234, 0.16))',
    color: '#7e22ce',
    border: 'rgba(147, 51, 234, 0.38)',
    holo: true,
  },
};

const CLOSE_BTN_STYLE: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '0.5px solid rgba(23, 64, 44, 0.18)',
  background: 'rgba(255, 255, 255, 0.88)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  color: '#172b24',
  display: 'inline-grid',
  placeItems: 'center',
  padding: 0,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(23, 43, 36, 0.08)',
};

const OBSERVE_PILL_STYLE: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background:
    'linear-gradient(180deg, rgba(150, 186, 142, 0.28), rgba(150, 186, 142, 0.14)), linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.68))',
  border: '0.5px solid rgba(23, 64, 44, 0.24)',
  color: '#17402c',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(23, 43, 36, 0.08)',
};

const OBSERVED_BADGE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 7px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.01em',
  background: 'rgba(14, 143, 91, 0.14)',
  color: '#0e6b44',
  border: '0.5px solid rgba(14, 143, 91, 0.32)',
  whiteSpace: 'nowrap',
};

const MAP_FOCUS_PILL_STYLE: React.CSSProperties = {
  height: 34,
  padding: '0 13px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  background: 'rgba(255, 255, 255, 0.88)',
  border: '0.5px solid rgba(23, 64, 44, 0.2)',
  color: '#172b24',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(23, 43, 36, 0.06)',
};

const OBSERVATION_TAGS = [
  'En groupe',
  'En vol',
  'Au repos',
  'Traces / Empreintes',
  'Chant / Cri',
  'En fleur',
] as const;

const INDIVIDUAL_COUNTS = ['1 individu', '2–5', 'Harde / Colonie'] as const;

/** Capitalizes the first character of French common species names cleanly. */
export function formatSpeciesCommonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLocaleUpperCase('fr-FR') + trimmed.slice(1);
}

/**
 * Client-safe HTTPS URL validator matching `@/lib/explorer/edgeCache#sanitizeHttpsUrl`
 * without pulling `node:crypto` into the browser bundle.
 */
function sanitizeHttpsUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  if (trimmed.startsWith('//')) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function classifyRarityBucket(sp: PokedexSpeciesItem): Exclude<PokedexRarityFilter, 'all'> {
  if (sp.threatened) return 'threatened';
  if (sp.endemic || sp.observationCount <= 10) return 'rare';
  return 'common';
}

function resolveCanonicalRarity(sp: PokedexSpeciesItem): PokedexRarity {
  if (sp.threatened) return 'Mythique';
  if (sp.endemic || sp.observationCount <= 10) return 'Rare';
  if (sp.observationCount <= 40) return 'Peu commun';
  return 'Commun';
}

function toCanonicalKingdom(kingdom: PokedexSpeciesItem['kingdom']): PokedexKingdom {
  if (kingdom === 'faune') return 'faune';
  if (kingdom === 'flore') return 'flore';
  return 'geologie';
}

function kingdomLabel(kingdom: PokedexSpeciesItem['kingdom']): string {
  if (kingdom === 'faune') return 'Faune';
  if (kingdom === 'flore') return 'Flore';
  if (kingdom === 'fungi') return 'Fungi';
  return 'Milieu';
}

function kingdomIcon(kingdom: PokedexKingdom, size = 14) {
  if (kingdom === 'faune') return <Feather size={size} aria-hidden="true" />;
  if (kingdom === 'flore') return <Flower2 size={size} aria-hidden="true" />;
  return <Mountain size={size} aria-hidden="true" />;
}

function formatDexNumber(index: number): string {
  return `#${String(index + 1).padStart(3, '0')}`;
}

function computeSpeciesMetrics(sp: PokedexSpeciesItem): {
  rarete: number;
  presence: number;
  statut: number;
} {
  const rarete = sp.threatened
    ? 96
    : sp.endemic
      ? 84
      : sp.observationCount <= 10
        ? 76
        : sp.observationCount <= 40
          ? 48
          : 24;
  const presence = Math.max(
    12,
    Math.min(100, Math.round(Math.log10(Math.max(1, sp.observationCount) + 1) * 42)),
  );
  const statut = sp.threatened ? 92 : sp.endemic ? 78 : 35;
  return { rarete, presence, statut };
}

function resolveSpeciesCoords(
  sp: PokedexSpeciesItem,
  geojson: GeoJsonFeatureCollection | null | undefined,
): [number, number] | null {
  const maybeCoords = (sp as { coordinates?: unknown }).coordinates;
  if (
    Array.isArray(maybeCoords) &&
    maybeCoords.length >= 2 &&
    typeof maybeCoords[0] === 'number' &&
    typeof maybeCoords[1] === 'number' &&
    Number.isFinite(maybeCoords[0]) &&
    Number.isFinite(maybeCoords[1])
  ) {
    return [maybeCoords[0], maybeCoords[1]];
  }

  if (geojson?.features) {
    for (const feat of geojson.features) {
      const featTaxonId = feat.properties?.taxonId;
      if (featTaxonId === sp.taxonId) {
        const coords = feat.geometry?.coordinates;
        if (
          Array.isArray(coords) &&
          coords.length >= 2 &&
          Number.isFinite(coords[0]) &&
          Number.isFinite(coords[1])
        ) {
          return [coords[0], coords[1]];
        }
      }
    }
  }

  return null;
}

interface ExplorerPokedexHoloCardProps {
  species: PokedexSpeciesItem;
  dexNumber: string;
  isObserved?: boolean;
  onSelect: () => void;
}

function ExplorerPokedexHoloCard({
  species,
  dexNumber,
  isObserved = false,
  onSelect,
}: ExplorerPokedexHoloCardProps) {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 260, damping: 24 });
  const springY = useSpring(mouseY, { stiffness: 260, damping: 24 });
  const rotateX = useTransform(springY, [0, 1], [6, -6]);
  const rotateY = useTransform(springX, [0, 1], [-6, 6]);

  const rarity = resolveCanonicalRarity(species);
  const rStyle = RARITY_STYLES[rarity];
  const safePhotoUrl = sanitizeHttpsUrl(species.photoUrl);
  const canonicalKingdom = toCanonicalKingdom(species.kingdom);
  const displayName = formatSpeciesCommonName(species.commonName);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const resetPointer = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.button
      ref={cardRef}
      type="button"
      className={`lkdv-carnet-pokedex-card is-discovered${rStyle.holo ? ' is-holo' : ''}`}
      style={{
        borderColor: rStyle.border,
        rotateX,
        rotateY,
        transformPerspective: 700,
      }}
      whileTap={{ scale: 0.965 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      onClick={onSelect}
      aria-label={`${displayName} (${species.scientificName})${isObserved ? ' — Observé' : ''}`}
    >
      {rStyle.holo ? (
        <span className="lkdv-carnet-pokedex-holo-sheen" aria-hidden="true" />
      ) : null}

      <div className="lkdv-carnet-pokedex-card-head">
        <span className="lkdv-carnet-pokedex-num">{dexNumber}</span>
        {isObserved ? (
          <span style={OBSERVED_BADGE_STYLE}>Observé ✓</span>
        ) : (
          <span style={{ color: '#17402c', opacity: 0.72, display: 'inline-flex' }}>
            {kingdomIcon(canonicalKingdom, 13)}
          </span>
        )}
      </div>

      <div className="lkdv-carnet-pokedex-thumb">
        {safePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safePhotoUrl} alt={displayName} loading="lazy" />
        ) : (
          <span className="lkdv-carnet-pokedex-thumb-icon">
            {kingdomIcon(canonicalKingdom, 22)}
          </span>
        )}
      </div>

      <div className="lkdv-carnet-pokedex-card-body">
        <b>{displayName}</b>
        <small>{species.scientificName}</small>
        <div className="lkdv-carnet-pokedex-foot">
          <span
            className="lkdv-carnet-pokedex-rarity"
            style={{ background: rStyle.bg, color: rStyle.color }}
          >
            {rarity}
          </span>
          <span className="lkdv-carnet-pokedex-obs">{species.observationCount} obs.</span>
        </div>
      </div>
    </motion.button>
  );
}

interface PokedexObservePortalModalProps {
  species: PokedexSpeciesItem;
  center: [number, number];
  onClose: () => void;
  onSubmit?: ExplorerPokedexLensProps['onObservationSubmitted'];
}

function PokedexObservePortalModal({
  species,
  center,
  onClose,
  onSubmit,
}: PokedexObservePortalModalProps) {
  const displayName = formatSpeciesCommonName(species.commonName);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [place, setPlace] = useState('');
  const [caption, setCaption] = useState(displayName);
  const [latin, setLatin] = useState(species.scientificName);
  const [speciesFile, setSpeciesFile] = useState<File | null>(null);
  const [countLabel, setCountLabel] = useState<string>(INDIVIDUAL_COUNTS[0]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const previewUrl = useMemo(
    () => (speciesFile ? URL.createObjectURL(speciesFile) : null),
    [speciesFile],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!caption.trim() || submitting) return;
    setSubmitting(true);
    try {
      const noteParts = [
        selectedTag ? `${selectedTag} (${countLabel})` : countLabel !== INDIVIDUAL_COUNTS[0] ? countLabel : null,
        note.trim() || null,
      ].filter(Boolean);

      await onSubmit?.({
        taxonId: species.taxonId,
        commonName: formatSpeciesCommonName(caption),
        scientificName: latin.trim() || species.scientificName,
        place: place.trim(),
        note: noteParts.join(' · '),
        file: speciesFile,
        coords: center,
      });
      setSaved(true);
      window.setTimeout(() => {
        onClose();
      }, 650);
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const hasValidCenter = Number.isFinite(center[0]) && Number.isFinite(center[1]);
  const fieldInputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 12,
    border: '0.5px solid rgba(23, 64, 44, 0.18)',
    background: 'rgba(255, 255, 255, 0.92)',
    padding: '9px 11px',
    fontSize: 13,
    color: '#172b24',
    outline: 'none',
    boxSizing: 'border-box',
  };
  const fieldLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#3f5349',
    marginBottom: 5,
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Observer ${displayName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(11, 31, 23, 0.34)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '16px 12px calc(12px + var(--safe-bottom, 0px))',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={CARNET_SPRING}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '86dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 24,
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(251, 250, 246, 0.95))',
          border: '0.5px solid rgba(23, 64, 44, 0.16)',
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 22px 48px rgba(11, 31, 23, 0.24)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px 10px',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.1)',
          }}
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={CLOSE_BTN_STYLE}
          >
            <X size={15} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: '#0e6b44',
                letterSpacing: '0.02em',
                marginBottom: 1,
              }}
            >
              Observation terrain · Explorer
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#172b24',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                fontStyle: 'italic',
                color: '#56665d',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {species.scientificName}
            </div>
          </div>
        </div>

        <div
          style={{
            overflowY: 'auto',
            padding: '14px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => setSpeciesFile(e.target.files?.[0] ?? null)}
          />

          {previewUrl ? (
            <div
              style={{
                position: 'relative',
                borderRadius: 16,
                overflow: 'hidden',
                border: '0.5px solid rgba(23, 64, 44, 0.18)',
                background: '#eef3ef',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`Aperçu photo — ${displayName}`}
                style={{
                  width: '100%',
                  height: 164,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 8,
                  bottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 999,
                    border: '0.5px solid rgba(255, 255, 255, 0.5)',
                    background: 'rgba(15, 36, 26, 0.72)',
                    color: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={12} aria-hidden="true" />
                  <span>Changer</span>
                </button>
                <button
                  type="button"
                  aria-label="Retirer la photo"
                  onClick={() => setSpeciesFile(null)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    border: '0.5px solid rgba(255, 255, 255, 0.45)',
                    background: 'rgba(153, 27, 27, 0.84)',
                    color: '#ffffff',
                    display: 'inline-grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                borderRadius: 16,
                border: '1px dashed rgba(23, 64, 44, 0.24)',
                background:
                  'linear-gradient(180deg, rgba(150, 186, 142, 0.14), rgba(255, 255, 255, 0.82))',
                padding: '18px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  background: 'rgba(23, 64, 44, 0.1)',
                  color: '#17402c',
                  display: 'inline-grid',
                  placeItems: 'center',
                }}
              >
                <Camera size={18} aria-hidden="true" />
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#172b24',
                  lineHeight: 1.25,
                }}
              >
                Ajoute ta photo
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: '#56665d',
                  lineHeight: 1.35,
                }}
              >
                Touche ici pour choisir une photo (optionnel)
              </span>
            </button>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div>
              <label htmlFor="xp20-obs-count" style={fieldLabelStyle}>
                Effectif
              </label>
              <select
                id="xp20-obs-count"
                value={countLabel}
                onChange={(e) => setCountLabel(e.target.value)}
                style={fieldInputStyle}
              >
                {INDIVIDUAL_COUNTS.map((cnt) => (
                  <option key={cnt} value={cnt}>
                    {cnt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="xp20-obs-tag" style={fieldLabelStyle}>
                Comportement
              </label>
              <select
                id="xp20-obs-tag"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                style={fieldInputStyle}
              >
                <option value="">Choisir…</option>
                {OBSERVATION_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 5,
              }}
            >
              <label
                htmlFor="xp20-obs-place"
                style={{ fontSize: 11, fontWeight: 700, color: '#3f5349' }}
              >
                Lieu d’observation
              </label>
              {hasValidCenter ? (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#56665d',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <MapPin size={10} aria-hidden="true" />
                  {center[1].toFixed(4)}, {center[0].toFixed(4)}
                </span>
              ) : null}
            </div>
            <input
              id="xp20-obs-place"
              type="text"
              maxLength={100}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Col, sommet, sentier, refuge…"
              style={fieldInputStyle}
            />
          </div>

          <div>
            <label htmlFor="xp20-obs-name" style={fieldLabelStyle}>
              Espèce observée
            </label>
            <input
              id="xp20-obs-name"
              type="text"
              maxLength={120}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={fieldInputStyle}
            />
          </div>

          <input type="hidden" value={latin} onChange={(e) => setLatin(e.target.value)} />

          <div>
            <label htmlFor="xp20-obs-note" style={fieldLabelStyle}>
              Note de terrain (optionnel)
            </label>
            <textarea
              id="xp20-obs-note"
              rows={2}
              maxLength={240}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Conditions, altitude, habitat…"
              style={{ ...fieldInputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 14px 12px',
            borderTop: '0.5px solid rgba(23, 64, 44, 0.08)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: '#56665d' }}>
            {speciesFile ? 'Photo jointe' : 'Photo facultative'}
          </span>
          <button
            type="button"
            disabled={!caption.trim() || submitting || saved}
            onClick={() => {
              void handleSave();
            }}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 999,
              border: '0.5px solid rgba(23, 64, 44, 0.25)',
              background: 'linear-gradient(180deg, #1f543a, #17402c)',
              color: '#fbfaf6',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: !caption.trim() || submitting ? 'not-allowed' : 'pointer',
              opacity: !caption.trim() || submitting ? 0.55 : 1,
              boxShadow: '0 4px 12px rgba(23, 64, 44, 0.24)',
            }}
          >
            {saved ? (
              <>
                <Check size={14} aria-hidden="true" />
                <span>Enregistré</span>
              </>
            ) : (
              <>
                <Binoculars size={14} aria-hidden="true" />
                <span>{submitting ? 'Enregistrement…' : 'Enregistrer'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

export function ExplorerPokedexLens({
  species,
  kingdomFilter,
  rarityFilter,
  selectedTaxonId,
  loading = false,
  onSelectSpecies,
  onClearSelection,
  onFocusCoordinates,
  center,
  observationsGeojson,
  observedTaxonIds,
  onObservationSubmitted,
}: ExplorerPokedexLensProps) {
  const [captureSpecies, setCaptureSpecies] = useState<PokedexSpeciesItem | null>(null);
  const [localObservedIds, setLocalObservedIds] = useState<ReadonlySet<number>>(() => new Set());

  const isTaxonObserved = (taxonId: number) =>
    Boolean(observedTaxonIds?.has(taxonId) || localObservedIds.has(taxonId));

  const filteredSpecies = useMemo(() => {
    return species.filter((sp) => {
      if (kingdomFilter === 'faune' && sp.kingdom !== 'faune') return false;
      if (kingdomFilter === 'flore' && sp.kingdom !== 'flore') return false;
      if (rarityFilter !== 'all' && classifyRarityBucket(sp) !== rarityFilter) {
        return false;
      }
      return true;
    });
  }, [species, kingdomFilter, rarityFilter]);

  const selectedIndex = useMemo(() => {
    if (selectedTaxonId === null) return -1;
    return species.findIndex((sp) => sp.taxonId === selectedTaxonId);
  }, [species, selectedTaxonId]);

  const selectedSpecies = selectedIndex >= 0 ? species[selectedIndex] : null;

  if (selectedSpecies) {
    const rarity = resolveCanonicalRarity(selectedSpecies);
    const rStyle = RARITY_STYLES[rarity];
    const safePhotoUrl = sanitizeHttpsUrl(selectedSpecies.photoUrl);
    const safeWikiUrl = sanitizeHttpsUrl(selectedSpecies.wikipediaUrl);
    const canonicalKingdom = toCanonicalKingdom(selectedSpecies.kingdom);
    const metrics = computeSpeciesMetrics(selectedSpecies);
    const dexNumber = formatDexNumber(selectedIndex);
    const displayName = formatSpeciesCommonName(selectedSpecies.commonName);
    const detailCoords = resolveSpeciesCoords(selectedSpecies, observationsGeojson);
    const isSelectedObserved = isTaxonObserved(selectedSpecies.taxonId);

    return (
      <>
        <StackSlideView stackKey={`pokedex-species-${selectedSpecies.taxonId}`}>
          <div className="lkdv-carnet-pokedex-detail" style={{ paddingBottom: 92 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                aria-label="Fermer"
                onClick={onClearSelection}
                style={CLOSE_BTN_STYLE}
              >
                <X size={15} aria-hidden="true" />
              </button>
              <span className="lkdv-carnet-pokedex-num">{dexNumber}</span>
            </div>

            <div className="lkdv-carnet-pokedex-hero" style={{ borderColor: rStyle.border }}>
              <div className="lkdv-carnet-pokedex-hero-top">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    className="lkdv-carnet-pokedex-rarity"
                    style={{ background: rStyle.bg, color: rStyle.color, marginTop: 0 }}
                  >
                    <Sparkles size={10} aria-hidden="true" />
                    <span>{rarity}</span>
                  </span>
                  {isSelectedObserved ? (
                    <span style={OBSERVED_BADGE_STYLE}>Observé ✓</span>
                  ) : null}
                </div>
                {safeWikiUrl ? (
                  <a
                    href={safeWikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Wikipédia — ${displayName}`}
                    className="lkdv-carnet-pokedex-wiki"
                    style={{
                      width: 30,
                      height: 30,
                      padding: 0,
                      justifyContent: 'center',
                    }}
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : null}
              </div>

              {safePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={safePhotoUrl}
                  alt={displayName}
                  className="lkdv-carnet-pokedex-hero-img"
                  style={{ maxHeight: 156, objectFit: 'cover' }}
                />
              ) : (
                <div className="lkdv-carnet-pokedex-silhouette">
                  {kingdomIcon(canonicalKingdom, 36)}
                </div>
              )}

              <div className="lkdv-carnet-pokedex-title">
                <b>{displayName}</b>
                <i>{selectedSpecies.scientificName}</i>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={OBSERVE_PILL_STYLE}
                  onClick={() => setCaptureSpecies(selectedSpecies)}
                >
                  <Binoculars size={13} aria-hidden="true" />
                  <span>J&apos;ai observé</span>
                </button>
                {detailCoords && onFocusCoordinates ? (
                  <button
                    type="button"
                    style={MAP_FOCUS_PILL_STYLE}
                    onClick={() => onFocusCoordinates(detailCoords, displayName)}
                  >
                    <MapPin size={13} aria-hidden="true" />
                    <span>Voir sur la carte</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="lkdv-carnet-kpi-grid-3">
              <div className="lkdv-carnet-kpi-mini">
                <small>Règne</small>
                <b style={{ fontSize: 12 }}>{kingdomLabel(selectedSpecies.kingdom)}</b>
              </div>
              <div className="lkdv-carnet-kpi-mini">
                <small>Groupe</small>
                <b
                  style={{
                    fontSize: 11.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {formatIconicTaxonFr(selectedSpecies.iconicTaxon)}
                </b>
              </div>
              <div className="lkdv-carnet-kpi-mini">
                <small>Observations</small>
                <b style={{ fontSize: 12.5 }}>
                  <AnimatedNumber value={selectedSpecies.observationCount} />
                </b>
              </div>
            </div>

            <div className="lkdv-carnet-chart-card">
              <div className="lkdv-carnet-kit-bars">
                {(
                  [
                    ['Rareté', metrics.rarete, '#7e22ce'],
                    ['Présence', metrics.presence, '#17402c'],
                    ['Statut', metrics.statut, '#1d4ed8'],
                  ] as const
                ).map(([label, val, color]) => (
                  <div key={label} className="lkdv-carnet-kit-bar-row">
                    <span className="lkdv-carnet-kit-bar-label">{label}</span>
                    <div className="lkdv-carnet-kit-bar-track">
                      <motion.div
                        className="lkdv-carnet-kit-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${val}%` }}
                        transition={CARNET_SPRING}
                        style={{ background: color }}
                      />
                    </div>
                    <span className="lkdv-carnet-kit-bar-val">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </StackSlideView>

        {captureSpecies ? (
          <PokedexObservePortalModal
            species={captureSpecies}
            center={center}
            onClose={() => setCaptureSpecies(null)}
            onSubmit={async (payload) => {
              await onObservationSubmitted?.(payload);
              setLocalObservedIds((prev) => {
                const next = new Set(prev);
                next.add(payload.taxonId);
                return next;
              });
            }}
          />
        ) : null}
      </>
    );
  }

  if (loading && filteredSpecies.length === 0) {
    return (
      <div className="lkdv-carnet-pokedex-grid" style={{ paddingBottom: 72 }} aria-busy="true">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="lkdv-carnet-pokedex-card"
            style={{ minHeight: 164 }}
          >
            <div className="lkdv-carnet-pokedex-thumb xp20-shimmer" />
            <div
              className="xp20-shimmer"
              style={{
                height: 12,
                width: '72%',
                borderRadius: 6,
              }}
            />
            <div
              className="xp20-shimmer"
              style={{
                height: 10,
                width: '48%',
                borderRadius: 6,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (filteredSpecies.length === 0) {
    return (
      <div
        className="club-glass-card"
        style={{
          padding: '22px 16px',
          borderRadius: 20,
          background: 'rgba(255, 255, 255, 0.8)',
          border: '0.5px solid rgba(23, 64, 44, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: 'rgba(23, 64, 44, 0.08)',
            color: '#17402c',
            display: 'inline-grid',
            placeItems: 'center',
          }}
        >
          <Leaf size={18} aria-hidden="true" />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#172b24' }}>
          Aucune espèce recensée ici
        </span>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 64 }}>
      <StaggerList className="lkdv-carnet-pokedex-grid">
        {filteredSpecies.map((sp, idx) => (
          <ExplorerPokedexHoloCard
            key={sp.taxonId}
            species={sp}
            dexNumber={formatDexNumber(idx)}
            isObserved={isTaxonObserved(sp.taxonId)}
            onSelect={() => {
              const coords = resolveSpeciesCoords(sp, observationsGeojson);
              onSelectSpecies(sp, coords);
              if (coords && onFocusCoordinates && onSelectSpecies.length < 2) {
                onFocusCoordinates(coords, formatSpeciesCommonName(sp.commonName));
              }
            }}
          />
        ))}
      </StaggerList>
    </div>
  );
}
