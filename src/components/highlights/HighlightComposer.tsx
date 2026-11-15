'use client';

import React, { useState } from 'react';
import type { Audience, HighlightKind, Sport } from '@/features/highlights';
import { DrawerFrame } from './DrawerFrame';
import {
  bodyStyle,
  buttonStyle,
  helperStyle,
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  sectionGapStyle,
} from './styles';

export interface HighlightDraft {
  kind: HighlightKind;
  title: string;
  description: string;
  sport: Sport;
  audience: Audience;
  areaLabel: string;
  hideExactLocation: boolean;
  hidePhotos: boolean;
  allowContributions: boolean;
}

export interface HighlightComposerProps {
  kind: HighlightKind;
  targetLabel: string;
  defaultArea: string;
  /** Vrai si le parent possède une position exacte à joindre au brouillon. */
  hasLocation: boolean;
  onClose: () => void;
  onSubmit: (draft: HighlightDraft) => void;
  feedback?: { tone: 'success' | 'error'; message: string } | null;
  busy?: boolean;
}

const SPORTS: Array<{ value: Sport; label: string }> = [
  { value: 'hike', label: 'Randonnée' },
  { value: 'trail', label: 'Trail' },
  { value: 'mtb', label: 'VTT' },
  { value: 'road', label: 'Route' },
  { value: 'gravel', label: 'Gravel' },
  { value: 'ski', label: 'Ski' },
  { value: 'other', label: 'Autre' },
];

/**
 * K5.13 — « ⋯ → recommander ce lieu ». Le composant ne reçoit et ne rend
 * aucune coordonnée : le parent joint la position au brouillon, et la case
 * « masquer la position exacte » reste le choix par défaut sans point.
 */
export function HighlightComposer({
  kind,
  targetLabel,
  defaultArea,
  hasLocation,
  onClose,
  onSubmit,
  feedback = null,
  busy = false,
}: HighlightComposerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState<Sport>('hike');
  const [audience, setAudience] = useState<Audience>('public');
  const [areaLabel, setAreaLabel] = useState(defaultArea);
  const [hideExactLocation, setHideExactLocation] = useState(!hasLocation);
  const [hidePhotos, setHidePhotos] = useState(false);
  const [allowContributions, setAllowContributions] = useState(true);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      kind,
      title: title.trim(),
      description: description.trim(),
      sport,
      audience,
      areaLabel: areaLabel.trim(),
      hideExactLocation: hasLocation ? hideExactLocation : true,
      hidePhotos,
      allowContributions,
    });
  };

  return (
    <DrawerFrame
      eyebrow={kind === 'segment' ? 'Recommander ce tronçon' : 'Recommander ce lieu'}
      title={targetLabel}
      subtitle={
        hasLocation
          ? 'Une position exacte est disponible.'
          : 'Aucune position exacte : le secteur suffit.'
      }
      onClose={onClose}
      testId="highlight-composer"
    >
      <form onSubmit={submit} style={sectionGapStyle}>
        {feedback ? (
          <p
            role="status"
            style={{
              ...helperStyle,
              color: feedback.tone === 'error' ? 'var(--lkv-danger)' : 'var(--lkv-success)',
            }}
          >
            {feedback.message}
          </p>
        ) : null}

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={labelStyle}>Titre</span>
          <input
            style={inputStyle}
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Belvédère, passage, point d’eau…"
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={labelStyle}>Secteur</span>
          <input
            style={inputStyle}
            value={areaLabel}
            maxLength={120}
            onChange={(event) => setAreaLabel(event.target.value)}
            placeholder="Massif, commune, vallée…"
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={labelStyle}>Pourquoi le recommander</span>
          <textarea
            style={{ ...inputStyle, minHeight: 88 }}
            value={description}
            maxLength={600}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ce qui rend le lieu ou le tronçon utile aux autres."
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>Sport</span>
            <select
              style={{ ...inputStyle, minHeight: 44 }}
              value={sport}
              onChange={(event) => setSport(event.target.value as Sport)}
            >
              {SPORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>Audience</span>
            <select
              style={{ ...inputStyle, minHeight: 44 }}
              value={audience}
              onChange={(event) => setAudience(event.target.value as Audience)}
            >
              <option value="private">Privé</option>
              <option value="followers">Abonnés</option>
              <option value="public">Public</option>
            </select>
          </label>
        </div>

        <label style={helperStyle}>
          <input
            type="checkbox"
            checked={hideExactLocation}
            disabled={!hasLocation}
            onChange={(event) => setHideExactLocation(event.target.checked)}
          />{' '}
          Masquer la position exacte (le secteur reste affiché).
        </label>
        <label style={helperStyle}>
          <input
            type="checkbox"
            checked={hidePhotos}
            onChange={(event) => setHidePhotos(event.target.checked)}
          />{' '}
          Masquer les photos pour les autres.
        </label>
        <label style={helperStyle}>
          <input
            type="checkbox"
            checked={allowContributions}
            onChange={(event) => setAllowContributions(event.target.checked)}
          />{' '}
          Autoriser les conseils et photos de la communauté.
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            style={primaryButtonStyle}
            disabled={busy || title.trim().length < 3 || areaLabel.trim().length === 0}
          >
            Publier le highlight
          </button>
          <button type="button" style={buttonStyle} onClick={onClose}>
            Annuler
          </button>
        </div>
        <p style={bodyStyle}>Le brouillon reste modifiable ; rien n’est publié avant validation.</p>
      </form>
    </DrawerFrame>
  );
}
