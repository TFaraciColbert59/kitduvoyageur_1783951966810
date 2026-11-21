'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Binoculars,
  Camera,
  Check,
  Feather,
  Flower2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { PokedexApiSpecies } from '@/app/api/pokedex/species/route';
import { CARNET_SPRING } from './CarnetDrawerMotion';

export interface DiscoveredSpeciesItem {
  id: string;
  name: string;
  latin: string;
  imageUrl?: string | null;
  kingdom?: 'faune' | 'flore' | 'geologie';
  rarity?: string;
}

const OBSERVATION_TAGS = [
  'En groupe',
  'En vol',
  'Au repos',
  'Traces / Empreintes',
  'Chant / Cri',
  'En fleur',
] as const;

const INDIVIDUAL_COUNTS = ['1 individu', '2–5', 'Harde / Colonie'] as const;

interface CarnetSpeciesCreatePaneProps {
  day: number;
  place: string;
  onPlaceChange: (next: string) => void;
  caption: string;
  onCaptionChange: (next: string) => void;
  latin: string;
  onLatinChange: (next: string) => void;
  speciesFile: File | null;
  onSpeciesFileChange: (file: File | null) => void;
  note: string;
  onNoteChange: (next: string) => void;
  discoveredSpecies?: DiscoveredSpeciesItem[];
  nearbyLat?: number | null;
  nearbyLng?: number | null;
  onValidateDiscovery?: (
    species: PokedexApiSpecies,
    file: File,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function CarnetSpeciesCreatePane({
  day,
  place,
  onPlaceChange,
  caption,
  onCaptionChange,
  latin,
  onLatinChange,
  speciesFile,
  onSpeciesFileChange,
  note,
  onNoteChange,
  discoveredSpecies = [],
  nearbyLat = null,
  nearbyLng = null,
  onValidateDiscovery,
}: CarnetSpeciesCreatePaneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const validationFileRef = useRef<HTMLInputElement | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PokedexApiSpecies[]>([]);
  const [pendingSpecies, setPendingSpecies] = useState<PokedexApiSpecies | null>(null);
  const [validationFile, setValidationFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sessionValidated, setSessionValidated] = useState<DiscoveredSpeciesItem[]>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<DiscoveredSpeciesItem | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [countLabel, setCountLabel] = useState<string>('1 individu');
  const [loading, setLoading] = useState(false);

  const filePreviewUrl = useMemo(
    () => (speciesFile ? URL.createObjectURL(speciesFile) : null),
    [speciesFile],
  );
  const validationPreviewUrl = useMemo(
    () => (validationFile ? URL.createObjectURL(validationFile) : null),
    [validationFile],
  );

  useEffect(
    () => () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    },
    [filePreviewUrl],
  );
  useEffect(
    () => () => {
      if (validationPreviewUrl) URL.revokeObjectURL(validationPreviewUrl);
    },
    [validationPreviewUrl],
  );

  const discoveredList = useMemo(() => {
    const seen = new Set<string>();
    const out: DiscoveredSpeciesItem[] = [];
    for (const item of [...sessionValidated, ...discoveredSpecies]) {
      const key = (item.latin || item.name).trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [sessionValidated, discoveredSpecies]);

  useEffect(() => {
    if (!discoverOpen) return;
    const q = searchQuery.trim().slice(0, 48);
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (
        typeof nearbyLat === 'number' &&
        typeof nearbyLng === 'number' &&
        Number.isFinite(nearbyLat) &&
        Number.isFinite(nearbyLng)
      ) {
        params.set('lat', String(nearbyLat));
        params.set('lng', String(nearbyLng));
      }
      if (q) params.set('q', q);
      const qs = params.toString();
      const url = qs ? `/api/pokedex/species?${qs}` : '/api/pokedex/species';
      fetch(url)
        .then((res) => res.json())
        .then((data: { species?: PokedexApiSpecies[] }) => {
          if (!cancelled && Array.isArray(data.species)) {
            setSuggestions(data.species.slice(0, 12));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [discoverOpen, searchQuery, nearbyLat, nearbyLng]);

  const previewPhoto = filePreviewUrl ?? selectedDiscovered?.imageUrl ?? null;

  const isCurrentSpeciesDiscovered = useMemo(() => {
    const c = caption.trim().toLowerCase();
    const l = latin.trim().toLowerCase();
    if (!c && !l) return false;
    return discoveredList.some(
      (d) =>
        (l && d.latin.toLowerCase() === l) ||
        (c && d.name.toLowerCase() === c),
    );
  }, [caption, latin, discoveredList]);

  const handleValidateNewSpecies = async () => {
    if (!pendingSpecies || !validationFile || validating) return;
    setValidating(true);
    setValidationError(null);
    if (onValidateDiscovery) {
      const res = await onValidateDiscovery(pendingSpecies, validationFile);
      if (!res.ok) {
        setValidating(false);
        setValidationError(res.error || 'Validation impossible pour le moment.');
        return;
      }
    }
    const newItem: DiscoveredSpeciesItem = {
      id: `inat-${pendingSpecies.taxonId}`,
      name: pendingSpecies.name,
      latin: pendingSpecies.latin,
      imageUrl: validationPreviewUrl ?? pendingSpecies.imageUrl,
      kingdom: pendingSpecies.kingdom,
      rarity: pendingSpecies.rarity,
    };
    setSessionValidated((prev) => [newItem, ...prev]);
    setSelectedDiscovered(newItem);
    onCaptionChange(pendingSpecies.name);
    onLatinChange(pendingSpecies.latin);
    setPendingSpecies(null);
    setValidationFile(null);
    setDiscoverOpen(false);
    setValidating(false);
  };

  const applyTag = (tag: string) => {
    const nextTag = selectedTag === tag ? null : tag;
    setSelectedTag(nextTag);
    if (nextTag && !note.includes(nextTag)) {
      onNoteChange(note.trim() ? `${note.trim()} · ${nextTag}` : `${nextTag} (${countLabel})`);
    }
  };

  return (
    <div className="lkdv-cv2c-pane">
      {/* 1. Aperçu Carte Pokédex en direct */}
      <motion.div
        layout
        transition={CARNET_SPRING}
        className="lkdv-carnet-species-preview"
      >
        <div className="lkdv-carnet-species-preview-media">
          {previewPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewPhoto} alt={caption || 'Espèce'} />
          ) : (
            <div className="lkdv-carnet-species-preview-empty">
              <Binoculars size={26} aria-hidden="true" />
              <span>Aperçu Pokédex</span>
            </div>
          )}
          <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
          {selectedDiscovered?.rarity ? (
            <span className="lkdv-carnet-species-preview-rarity">
              <Sparkles size={10} /> {selectedDiscovered.rarity}
            </span>
          ) : null}
        </div>

        <div className="lkdv-carnet-species-preview-body">
          <div className="lkdv-carnet-species-preview-title">
            <b>{caption.trim() || 'Nom de l’espèce…'}</b>
            <i>{latin.trim() || 'Nom scientifique'}</i>
          </div>
          <div className="lkdv-carnet-species-preview-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => onSpeciesFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 32, padding: '0 10px', fontSize: 11.5 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={13} />
              <span>{speciesFile ? 'Changer photo' : 'Ajouter photo'}</span>
            </button>
            {speciesFile ? (
              <button
                type="button"
                className="lkdv-carnet-comment-del"
                aria-label="Retirer la photo"
                onClick={() => onSpeciesFileChange(null)}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* 2. Espèces déjà découvertes + case "+" en pointillé en premier */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          Mes espèces découvertes ({discoveredList.length})
        </span>
        <div className="lkdv-carnet-species-rail">
          <button
            type="button"
            className="lkdv-carnet-species-chip-card is-add-slot"
            onClick={() => {
              setDiscoverOpen((v) => !v);
              setValidationError(null);
            }}
            aria-label="Découvrir et valider une espèce à proximité"
          >
            <span className="lkdv-carnet-species-add-plus">
              <Plus size={18} aria-hidden="true" />
            </span>
            <b>Découvrir</b>
            <small>À proximité</small>
          </button>

          {discoveredList.map((sp) => {
            const active =
              selectedDiscovered?.id === sp.id ||
              (latin && sp.latin && latin.toLowerCase() === sp.latin.toLowerCase()) ||
              (caption && caption.toLowerCase() === sp.name.toLowerCase());
            return (
              <button
                key={sp.id}
                type="button"
                className={`lkdv-carnet-species-chip-card${active ? ' is-active' : ''}`}
                onClick={() => {
                  setSelectedDiscovered(sp);
                  onCaptionChange(sp.name);
                  onLatinChange(sp.latin);
                }}
              >
                <div className="lkdv-carnet-species-chip-img">
                  {sp.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sp.imageUrl} alt="" loading="lazy" />
                  ) : sp.kingdom === 'flore' ? (
                    <Flower2 size={18} />
                  ) : (
                    <Feather size={18} />
                  )}
                  <span className="lkdv-carnet-species-chip-check" title="Espèce validée">
                    <Check size={11} />
                  </span>
                </div>
                <b>{sp.name}</b>
                <small>{sp.latin || 'Validée'}</small>
              </button>
            );
          })}
        </div>

        {discoverOpen ? (
          <div className="lkdv-carnet-species-discover-box">
            <div className="lkdv-carnet-species-discover-head">
              <span>
                Espèces vues à proximité {loading ? '· recherche…' : ''}
              </span>
              <button
                type="button"
                className="lkdv-carnet-comment-del"
                aria-label="Fermer"
                onClick={() => setDiscoverOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <div className="lkdv-carnet-pokedex-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher à proximité (Bouquetin, Chamois…)"
              />
            </div>

            {suggestions.length > 0 ? (
              <div className="lkdv-carnet-species-rail">
                {suggestions.map((sp) => {
                  const alreadyValidated = discoveredList.some(
                    (d) =>
                      (d.latin && d.latin.toLowerCase() === sp.latin.toLowerCase()) ||
                      d.name.toLowerCase() === sp.name.toLowerCase(),
                  );
                  const isPicked = pendingSpecies?.taxonId === sp.taxonId;
                  return (
                    <button
                      key={sp.taxonId}
                      type="button"
                      className={`lkdv-carnet-species-chip-card${isPicked ? ' is-active' : ''}`}
                      onClick={() => {
                        if (alreadyValidated) {
                          const existing = discoveredList.find(
                            (d) =>
                              (d.latin && d.latin.toLowerCase() === sp.latin.toLowerCase()) ||
                              d.name.toLowerCase() === sp.name.toLowerCase(),
                          );
                          if (existing) setSelectedDiscovered(existing);
                          onCaptionChange(sp.name);
                          onLatinChange(sp.latin);
                          setDiscoverOpen(false);
                          return;
                        }
                        setPendingSpecies(sp);
                        setValidationError(null);
                      }}
                    >
                      <div className="lkdv-carnet-species-chip-img">
                        {sp.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sp.imageUrl} alt="" loading="lazy" />
                        ) : sp.kingdom === 'flore' ? (
                          <Flower2 size={18} />
                        ) : (
                          <Feather size={18} />
                        )}
                        {alreadyValidated || isPicked ? (
                          <span className="lkdv-carnet-species-chip-check">
                            <Check size={11} />
                          </span>
                        ) : null}
                      </div>
                      <b>{sp.name}</b>
                      <small>{alreadyValidated ? 'Déjà validée' : sp.latin}</small>
                    </button>
                  );
                })}
              </div>
            ) : !loading ? (
              <small style={{ fontSize: 11.5, color: 'var(--label2, #56665d)' }}>
                Aucune espèce trouvée à proximité pour cette recherche.
              </small>
            ) : null}

            <div
              className={`lkdv-carnet-species-proof-box${validationFile ? ' is-ready' : ''}`}
            >
              <input
                ref={validationFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => {
                  setValidationFile(e.target.files?.[0] ?? null);
                  setValidationError(null);
                }}
              />
              {validationPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={validationPreviewUrl}
                  alt="Preuve photo"
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <Camera size={20} style={{ color: '#1b4332', flexShrink: 0 }} aria-hidden="true" />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                  {pendingSpecies
                    ? `Preuve photo obligatoire · ${pendingSpecies.name}`
                    : 'Preuve photo obligatoire'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--label2, #56665d)' }}>
                  {validationFile
                    ? 'Photo prête — clique sur Valider pour la débloquer partout.'
                    : 'Prends ou choisis une photo de ton observation pour valider.'}
                </div>
              </div>
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ height: 32, padding: '0 10px', fontSize: 11.5, flexShrink: 0 }}
                onClick={() => validationFileRef.current?.click()}
              >
                <Camera size={13} />
                <span>{validationFile ? 'Changer' : 'Photo'}</span>
              </button>
            </div>

            {validationError ? (
              <p role="alert" style={{ margin: 0, fontSize: 11.5, color: '#b91c1c' }}>
                {validationError}
              </p>
            ) : null}

            <button
              type="button"
              className="lkdv-carnet-btn-primary"
              disabled={!pendingSpecies || !validationFile || validating}
              onClick={() => void handleValidateNewSpecies()}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Check size={14} aria-hidden="true" />
              <span>
                {validating
                  ? 'Validation en cours…'
                  : 'Valider cette espèce avec la photo'}
              </span>
            </button>
          </div>
        ) : !isCurrentSpeciesDiscovered && caption.trim() && !speciesFile ? (
          <small style={{ fontSize: 11, color: '#92400e', marginTop: 4, display: 'block' }}>
            Nouvelle espèce : ajoute une photo ci-dessus pour la valider dans ton Pokédex.
          </small>
        ) : null}
      </div>

      {/* 3. Champs Espèce & Nom scientifique */}
      <div className="lkdv-cv2c-row-2">
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Espèce observée</span>
          <input
            type="text"
            className="lkdv-cv2-input"
            value={caption}
            maxLength={80}
            placeholder="Bouquetin des Alpes…"
            onChange={(e) => onCaptionChange(e.target.value)}
          />
        </div>
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Nom scientifique</span>
          <input
            type="text"
            className="lkdv-cv2-input"
            value={latin}
            maxLength={80}
            placeholder="Capra ibex…"
            onChange={(e) => onLatinChange(e.target.value)}
          />
        </div>
      </div>

      {/* 4. Nombre & Contexte d'observation */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Effectif & Comportement</span>
        <div className="lkdv-carnet-filter-rail">
          {INDIVIDUAL_COUNTS.map((cnt) => (
            <button
              key={cnt}
              type="button"
              className={`lkdv-carnet-filter-pill${countLabel === cnt ? ' is-active' : ''}`}
              onClick={() => setCountLabel(cnt)}
            >
              {countLabel === cnt ? <span className="lkdv-carnet-filter-pill-bg" /> : null}
              <span className="lkdv-carnet-filter-pill-label">{cnt}</span>
            </button>
          ))}
        </div>
        <div className="lkdv-carnet-filter-rail">
          {OBSERVATION_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`lkdv-carnet-filter-pill${selectedTag === tag ? ' is-active' : ''}`}
              onClick={() => applyTag(tag)}
            >
              {selectedTag === tag ? <span className="lkdv-carnet-filter-pill-bg" /> : null}
              <span className="lkdv-carnet-filter-pill-label">{tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Lieu & Note de terrain */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
          Lieu d’observation (Jour {day})
        </span>
        <input
          type="text"
          className="lkdv-cv2-input"
          value={place}
          maxLength={80}
          placeholder="Col, crête, alpage…"
          onChange={(e) => onPlaceChange(e.target.value)}
        />
      </div>

      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Note de terrain</span>
        <textarea
          className="lkdv-cv2-input"
          rows={2}
          value={note}
          maxLength={240}
          placeholder="Conditions, comportement, altitude…"
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>
    </div>
  );
}
