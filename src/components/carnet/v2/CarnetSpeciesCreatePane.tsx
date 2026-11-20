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
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { PokedexApiSpecies } from '@/app/api/pokedex/species/route';
import { CARNET_SPRING } from './CarnetDrawerMotion';

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
}: CarnetSpeciesCreatePaneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PokedexApiSpecies[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<PokedexApiSpecies | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [countLabel, setCountLabel] = useState<string>('1 individu');
  const [loading, setLoading] = useState(false);

  const filePreviewUrl = useMemo(
    () => (speciesFile ? URL.createObjectURL(speciesFile) : null),
    [speciesFile],
  );

  useEffect(
    () => () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    },
    [filePreviewUrl],
  );

  useEffect(() => {
    const q = (searchQuery.trim() || caption.trim()).slice(0, 48);
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const url = q
        ? `/api/pokedex/species?q=${encodeURIComponent(q)}`
        : '/api/pokedex/species';
      fetch(url)
        .then((res) => res.json())
        .then((data: { species?: PokedexApiSpecies[] }) => {
          if (!cancelled && Array.isArray(data.species)) {
            setSuggestions(data.species.slice(0, 8));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, caption]);

  const previewPhoto = filePreviewUrl ?? selectedSpecies?.imageUrl ?? null;

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
          {selectedSpecies ? (
            <span className="lkdv-carnet-species-preview-rarity">
              <Sparkles size={10} /> {selectedSpecies.rarity}
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

      {/* 2. Recherche iNaturalist + Carrousel de sélection rapide */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          Identifier sur iNaturalist {loading ? '· recherche…' : ''}
        </span>
        <div className="lkdv-carnet-pokedex-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Bouquetin, Chamois, Edelweiss, Gypaète…"
          />
        </div>
        {suggestions.length > 0 ? (
          <div className="lkdv-carnet-species-rail">
            {suggestions.map((sp) => {
              const active =
                selectedSpecies?.taxonId === sp.taxonId ||
                (latin && latin.toLowerCase() === sp.latin.toLowerCase());
              return (
                <button
                  key={sp.taxonId}
                  type="button"
                  className={`lkdv-carnet-species-chip-card${active ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedSpecies(sp);
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
                    {active ? (
                      <span className="lkdv-carnet-species-chip-check">
                        <Check size={11} />
                      </span>
                    ) : null}
                  </div>
                  <b>{sp.name}</b>
                  <small>{sp.latin}</small>
                </button>
              );
            })}
          </div>
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
