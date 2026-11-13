'use client';

import React, { useState } from 'react';
import type { HighlightView } from '@/features/highlights';
import { DrawerFrame } from './DrawerFrame';
import {
  bodyStyle,
  buttonStyle,
  chipStyle,
  dangerButtonStyle,
  helperStyle,
  inputStyle,
  labelStyle,
  photoGridStyle,
  photoStyle,
  primaryButtonStyle,
  rowStyle,
  sectionGapStyle,
} from './styles';

export interface HighlightDrawerProps {
  highlight: HighlightView;
  onClose: () => void;
  onVote?: (value: 1 | -1) => void;
  onSave?: () => void;
  onContributeTip?: (body: string) => void;
  onContributePhoto?: (input: {
    url: string;
    caption: string;
    exifStripped: boolean;
    consentPublic: boolean;
  }) => void;
  saved?: boolean;
  feedback?: { tone: 'success' | 'error'; message: string } | null;
  busy?: boolean;
}

const AUDIENCE_LABEL: Record<HighlightView['audience'], string> = {
  private: 'Privé',
  followers: 'Abonnés',
  public: 'Public',
};

const SPORT_LABEL: Record<HighlightView['sport'], string> = {
  hike: 'Randonnée',
  trail: 'Trail',
  mtb: 'VTT',
  road: 'Route',
  gravel: 'Gravel',
  ski: 'Ski',
  other: 'Autre',
};

/**
 * K5.13 / K5.14 / K5.15 — drawer d'un highlight : lire, voter, conseiller,
 * ajouter une photo et enregistrer dans « Mes lieux ». La vue reçue est déjà
 * projetée : une coordonnée ou une photo masquée n'arrive jamais ici.
 */
export function HighlightDrawer({
  highlight,
  onClose,
  onVote,
  onSave,
  onContributeTip,
  onContributePhoto,
  saved = false,
  feedback = null,
  busy = false,
}: HighlightDrawerProps) {
  const [composer, setComposer] = useState<'none' | 'tip' | 'photo'>('none');
  const [tip, setTip] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [exifStripped, setExifStripped] = useState(false);
  const [consentPublic, setConsentPublic] = useState(true);

  const submitTip = (event: React.FormEvent) => {
    event.preventDefault();
    if (tip.trim().length < 3 || !onContributeTip) return;
    onContributeTip(tip.trim());
    setTip('');
    setComposer('none');
  };

  const submitPhoto = (event: React.FormEvent) => {
    event.preventDefault();
    if (!photoUrl.trim() || !exifStripped || !onContributePhoto) return;
    onContributePhoto({
      url: photoUrl.trim(),
      caption: photoCaption.trim(),
      exifStripped,
      consentPublic,
    });
    setPhotoUrl('');
    setPhotoCaption('');
    setExifStripped(false);
    setComposer('none');
  };

  return (
    <DrawerFrame
      eyebrow={`${SPORT_LABEL[highlight.sport]} · ${AUDIENCE_LABEL[highlight.audience]}`}
      title={highlight.title}
      subtitle={highlight.areaLabel}
      onClose={onClose}
      testId="highlight-drawer"
    >
      <div style={sectionGapStyle}>
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

        {highlight.locationHidden ? (
          <p style={chipStyle} data-testid="highlight-location-hidden">
            🔒 Position exacte masquée · {highlight.areaLabel}
          </p>
        ) : null}

        {highlight.description ? <p style={bodyStyle}>{highlight.description}</p> : null}

        {highlight.photos.length > 0 ? (
          <div style={photoGridStyle} aria-label="Galerie du highlight">
            {highlight.photos.map((photo) => (
              <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'Photo du highlight'}
                  style={photoStyle}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        ) : highlight.photosHidden ? (
          <p style={chipStyle} data-testid="highlight-photos-hidden">
            🔒 Photos masquées par l’auteur
          </p>
        ) : (
          <p style={helperStyle}>Aucune photo pour ce highlight.</p>
        )}

        <div style={rowStyle}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={buttonStyle}
              aria-pressed={highlight.myVote === 1}
              onClick={() => onVote?.(1)}
              disabled={busy || !onVote}
            >
              👍 {highlight.upvotes}
            </button>
            <button
              type="button"
              style={buttonStyle}
              aria-pressed={highlight.myVote === -1}
              onClick={() => onVote?.(-1)}
              disabled={busy || !onVote}
            >
              👎 {highlight.downvotes}
            </button>
          </div>
          <span style={helperStyle} aria-live="polite">
            {highlight.score > 0 ? `+${highlight.score}` : highlight.score} vote
            {Math.abs(highlight.score) > 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={saved ? primaryButtonStyle : buttonStyle}
            onClick={onSave}
            disabled={busy || !onSave}
            data-testid="highlight-save"
          >
            {saved ? '✓ Enregistré dans Mes lieux' : 'Enregistrer dans Mes lieux'}
          </button>
          {highlight.canContribute ? (
            <>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setComposer(composer === 'tip' ? 'none' : 'tip')}
              >
                Ajouter un conseil
              </button>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setComposer(composer === 'photo' ? 'none' : 'photo')}
              >
                Ajouter une photo
              </button>
            </>
          ) : null}
        </div>

        {composer === 'tip' ? (
          <form onSubmit={submitTip} style={{ display: 'grid', gap: 8 }}>
            <label style={labelStyle} htmlFor="highlight-tip">
              Ton conseil
            </label>
            <textarea
              id="highlight-tip"
              style={{ ...inputStyle, minHeight: 88 }}
              value={tip}
              maxLength={500}
              onChange={(event) => setTip(event.target.value)}
              placeholder="Passage boueux, fontaine, point de vue…"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={primaryButtonStyle} disabled={tip.trim().length < 3}>
                Publier le conseil
              </button>
              <button type="button" style={buttonStyle} onClick={() => setComposer('none')}>
                Annuler
              </button>
            </div>
          </form>
        ) : null}

        {composer === 'photo' ? (
          <form onSubmit={submitPhoto} style={{ display: 'grid', gap: 8 }}>
            <label style={labelStyle} htmlFor="highlight-photo-url">
              Adresse de la photo
            </label>
            <input
              id="highlight-photo-url"
              style={inputStyle}
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
            <input
              aria-label="Légende de la photo"
              style={inputStyle}
              value={photoCaption}
              maxLength={160}
              onChange={(event) => setPhotoCaption(event.target.value)}
              placeholder="Légende (facultatif)"
            />
            <label style={helperStyle}>
              <input
                type="checkbox"
                checked={exifStripped}
                onChange={(event) => setExifStripped(event.target.checked)}
              />{' '}
              J’ai retiré les métadonnées GPS de la photo (obligatoire).
            </label>
            <label style={helperStyle}>
              <input
                type="checkbox"
                checked={consentPublic}
                onChange={(event) => setConsentPublic(event.target.checked)}
              />{' '}
              J’accepte qu’elle soit visible selon l’audience du highlight.
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={!photoUrl.trim() || !exifStripped}
              >
                Publier la photo
              </button>
              <button type="button" style={buttonStyle} onClick={() => setComposer('none')}>
                Annuler
              </button>
            </div>
          </form>
        ) : null}

        <section aria-label="Conseils de la communauté">
          <p style={labelStyle}>Conseils ({highlight.tips.length})</p>
          {highlight.tips.length === 0 ? (
            <p style={helperStyle}>Aucun conseil pour l’instant.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {highlight.tips.map((item) => (
                <li key={item.id} style={rowStyle}>
                  <div>
                    <p style={{ ...bodyStyle, marginBottom: 2 }}>{item.body}</p>
                    <p style={helperStyle}>
                      {item.authorName ?? 'Voyageur'} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!highlight.canContribute ? (
          <p style={helperStyle}>Les contributions sont fermées pour ce highlight.</p>
        ) : null}
        {highlight.audience === 'private' ? (
          <p style={{ ...helperStyle, color: dangerButtonStyle.color }}>
            Ce highlight est privé : il n’apparaît ni dans le fil public ni dans les guides.
          </p>
        ) : null}
      </div>
    </DrawerFrame>
  );
}
