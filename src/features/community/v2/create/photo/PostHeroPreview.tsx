'use client';

import React from 'react';
import type { User } from '@supabase/supabase-js';
import { Camera, ChevronDown, MoreHorizontal } from 'lucide-react';
import type { PostFormValuesV2 } from '../engine/createSchemasV2';
import { PhotoEditorPill } from './PhotoEditorPill';
import {
  type PhotoEditorCategory,
  computePhotoStyle,
  computeVignetteOverlayStyle,
} from './photoEditor';

export interface PostHeroPreviewProps {
  values: PostFormValuesV2;
  user: User | null;
  activePhotoIndex: number;
  activeCategory: PhotoEditorCategory | null;
  onSelectCategory: (category: PhotoEditorCategory) => void;
  onTriggerFileInput: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  collapsed?: boolean;
  onExpand?: () => void;
  className?: string;
}

const PREVIEW_FALLBACK_ART = '/assets/images/community-preview-meadow.svg';

/**
 * Aperçu vivant du Post aligné sur la carte communautaire (`/communaute`) :
 * - Pilule auteur en verre dépoli en haut à gauche + bouton `···` en haut à droite
 * - Pilule verre 3 icônes (éditeur photo) en bas à droite
 * - Pour Billet / Question / Événement, l'image reste facultative
 * - Au scroll, se replie en pilule condensée de 35 px max
 */
export function PostHeroPreview({
  values,
  user,
  activePhotoIndex,
  activeCategory,
  onSelectCategory,
  onTriggerFileInput,
  fileInputRef,
  onFilesSelected,
  collapsed = false,
  onExpand,
  className = '',
}: PostHeroPreviewProps) {
  const mediaList = values.media ?? [];
  const safeIndex = Math.min(Math.max(0, activePhotoIndex), Math.max(0, mediaList.length - 1));
  const activeMedia = mediaList[safeIndex];
  const hasPhotos = mediaList.length > 0 && Boolean(activeMedia);
  const isTextFormat = values.format === 'billet' || values.format === 'question' || values.format === 'event';

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const authorName =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    'Toi';
  const avatarUrl = (metadata.avatar_url as string | undefined) ?? null;

  const photoStyle = hasPhotos ? computePhotoStyle(activeMedia?.modifiers) : undefined;
  const vignetteStyle = hasPhotos
    ? computeVignetteOverlayStyle(activeMedia?.modifiers?.vignette)
    : null;

  return (
    <div
      className={`lkdv-cv2c-post-hero-preview ${collapsed ? 'is-collapsed' : ''} ${className}`.trim()}
      data-testid="post-hero-preview"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        className="lkdv-hidden-file-input"
        data-testid="post-file-input"
        onChange={onFilesSelected}
      />

      <div className="lkdv-post-collapsed-slot" aria-hidden={!collapsed}>
        <button
          type="button"
          className="lkdv-post-collapsed-pill"
          onClick={onExpand}
          tabIndex={collapsed ? 0 : -1}
          aria-label="Déplier l’aperçu de la publication"
        >
          <span className="lkdv-post-collapsed-av">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar
              <img src={avatarUrl} alt="" />
            ) : (
              authorName.slice(0, 1)
            )}
          </span>
          <span className="lkdv-post-collapsed-txt">
            <b>{values.title || authorName}</b>
            <small>
              {hasPhotos ? `${mediaList.length} photo${mediaList.length > 1 ? 's' : ''}` : values.format}
            </small>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="lkdv-post-expanded-slot" aria-hidden={collapsed}>
        <div className="lkdv-post-preview-card lkdv-post-preview-card--feed">
          {/* Pilule auteur en verre dépoli en haut à gauche + bouton options en haut à droite (identique à /communaute) */}
          <div className="lkdv-post-hero-top">
            <div className="lkdv-post-hero-author-pill">
              <span className="lkdv-post-preview-av">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- avatar
                  <img src={avatarUrl} alt="" className="lkdv-post-preview-av-img" />
                ) : (
                  <span className="lkdv-post-preview-av-fallback">{authorName.slice(0, 1)}</span>
                )}
              </span>
              <span className="lkdv-post-hero-author-meta">
                <b>{authorName}</b>
                <small>{values.location || 'Ma position'} · à l’instant</small>
              </span>
            </div>
            <span className="lkdv-post-hero-more-pill" aria-hidden="true">
              {hasPhotos && mediaList.length > 1 ? (
                <span className="lkdv-post-hero-count">{safeIndex + 1}/{mediaList.length}</span>
              ) : (
                <MoreHorizontal size={18} />
              )}
            </span>
          </div>

          {isTextFormat && !hasPhotos ? (
            <div className="lkdv-post-text-preview-box">
              {values.title ? <b className="lkdv-post-text-preview-title">{values.title}</b> : null}
              <p className="lkdv-post-text-preview-body">
                {values.content?.trim() ||
                  (values.format === 'question'
                    ? 'Pose ta question à la communauté…'
                    : values.format === 'event'
                      ? 'Annonce ta sortie ou ton événement…'
                      : 'Écris ton billet…')}
              </p>
              <button
                type="button"
                className="lkdv-post-optional-photo-chip"
                onClick={onTriggerFileInput}
              >
                <Camera size={13} aria-hidden="true" /> Photo (optionnel)
              </button>
            </div>
          ) : (
            <div
              className="lkdv-post-preview-media-box"
              data-testid="post-preview-media-box"
              onClick={onTriggerFileInput}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTriggerFileInput();
                }
              }}
              aria-label={
                hasPhotos
                  ? `Photo ${safeIndex + 1} de la publication. Cliquer pour changer ou ajouter des photos.`
                  : 'Ajouter une photo à la publication. Cliquer pour ouvrir la galerie.'
              }
            >
              {hasPhotos && activeMedia ? (
                <div className="lkdv-post-preview-img-wrapper">
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu photo locale */}
                  <img
                    src={activeMedia.previewUrl || activeMedia.url || PREVIEW_FALLBACK_ART}
                    alt={activeMedia.alt || values.title || 'Aperçu photo'}
                    className="lkdv-post-preview-img"
                    style={photoStyle}
                    data-testid="post-preview-active-image"
                  />
                  {vignetteStyle && <div style={vignetteStyle} />}
                </div>
              ) : (
                <div className="lkdv-post-preview-empty">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fond d'attente */}
                  <img
                    src={PREVIEW_FALLBACK_ART}
                    alt=""
                    className="lkdv-post-preview-empty-bg"
                    aria-hidden="true"
                  />
                  <div className="lkdv-post-preview-empty-overlay">
                    <span className="lkdv-post-preview-empty-icon">
                      <Camera size={24} aria-hidden="true" />
                    </span>
                    <b className="lkdv-post-preview-empty-title">Ajoute ta photo</b>
                    <span className="lkdv-post-preview-empty-hint">
                      Touche ici pour sélectionner jusqu’à 15 photos
                    </span>
                  </div>
                </div>
              )}

              {hasPhotos ? (
                <PhotoEditorPill activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
              ) : null}
            </div>
          )}

          {hasPhotos && (values.title || values.content) ? (
            <div className="lkdv-post-preview-caption">
              {values.title ? <b className="lkdv-post-preview-caption-title">{values.title}</b> : null}
              {values.content ? <p className="lkdv-post-preview-caption-text">{values.content}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PostHeroPreview;
