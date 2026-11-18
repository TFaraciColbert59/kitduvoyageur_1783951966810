'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Camera, ChevronDown, Compass, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react';
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
  onRemoveActivePhoto?: () => void;
  onPassToStory?: () => void;
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
  onRemoveActivePhoto,
  onPassToStory,
  collapsed = false,
  onExpand,
  className = '',
}: PostHeroPreviewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const mediaList = values.media ?? [];
  const safeIndex = Math.min(Math.max(0, activePhotoIndex), Math.max(0, mediaList.length - 1));
  const activeMedia = mediaList[safeIndex];
  const hasPhotos = mediaList.length > 0 && Boolean(activeMedia);
  const isTextFormat = values.format === 'billet' || values.format === 'question' || values.format === 'event';

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const formatEventChipDate = (iso?: string) => {
    if (!iso) return '';
    const parsed = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

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

  const smoothTransition = {
    duration: 0.82,
    ease: [0.22, 0.61, 0.36, 1] as const,
  };

  return (
    <motion.div
      className={`lkdv-cv2c-post-hero-preview ${collapsed ? 'is-collapsed' : ''} ${className}`.trim()}
      data-testid="post-hero-preview"
      initial={false}
      animate={{ height: collapsed ? 35 : 'auto' }}
      transition={smoothTransition}
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

      <motion.div
        className="lkdv-post-collapsed-slot"
        aria-hidden={!collapsed}
        initial={false}
        animate={{
          opacity: collapsed ? 1 : 0,
          y: collapsed ? 0 : -4,
        }}
        transition={smoothTransition}
        style={{ pointerEvents: collapsed ? 'auto' : 'none' }}
      >
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
            <b>{values.title || values.linkedEventTitle || authorName}</b>
            <small>
              {hasPhotos
                ? `${mediaList.length} photo${mediaList.length > 1 ? 's' : ''}`
                : values.format === 'event'
                  ? 'Événement'
                  : values.format === 'question'
                    ? 'Question'
                    : values.format === 'billet'
                      ? 'Billet'
                      : 'Photo'}
            </small>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </motion.div>

      <motion.div
        className="lkdv-post-expanded-slot"
        aria-hidden={collapsed}
        initial={false}
        animate={{
          opacity: collapsed ? 0 : 1,
          y: collapsed ? -6 : 0,
          scale: collapsed ? 0.99 : 1,
        }}
        transition={smoothTransition}
        style={{ pointerEvents: collapsed ? 'none' : 'auto' }}
      >
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
            <div ref={menuWrapRef} className="lkdv-post-hero-more-wrap">
              {hasPhotos && mediaList.length > 1 ? (
                <span className="lkdv-post-hero-more-pill lkdv-post-hero-more-pill--count" aria-hidden="true">
                  <span className="lkdv-post-hero-count">{safeIndex + 1}/{mediaList.length}</span>
                </span>
              ) : null}
              <button
                type="button"
                className="lkdv-post-hero-more-pill lkdv-post-hero-more-btn"
                aria-label="Options de la photo"
                aria-expanded={menuOpen}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
              >
                <MoreHorizontal size={18} />
              </button>
              <AnimatePresence>
                {menuOpen ? (
                  <motion.div
                    className="lkdv-post-hero-menu"
                    role="menu"
                    initial={{ opacity: 0, scale: 0.92, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasPhotos && onRemoveActivePhoto ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="lkdv-post-hero-menu-item is-danger"
                        onClick={() => {
                          setMenuOpen(false);
                          onRemoveActivePhoto();
                        }}
                      >
                        <Trash2 size={15} className="lkdv-post-hero-menu-ico" aria-hidden="true" />
                        <span>Retirer la photo</span>
                      </button>
                    ) : null}
                    {hasPhotos && onPassToStory ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="lkdv-post-hero-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          onPassToStory();
                        }}
                      >
                        <Sparkles size={15} className="lkdv-post-hero-menu-ico" aria-hidden="true" />
                        <span>Passer en Story</span>
                      </button>
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {isTextFormat && !hasPhotos ? (
            <div className="lkdv-post-text-preview-box">
              {values.format === 'event' && (values.eventDate || values.linkedEventTitle) ? (
                <div className="lkdv-post-event-chips">
                  {values.eventDate ? (
                    <span className="lkdv-post-event-chip">
                      <CalendarDays size={12} aria-hidden="true" />
                      {formatEventChipDate(values.eventDate)}
                    </span>
                  ) : null}
                  {values.linkedEventId ? (
                    <span className="lkdv-post-event-chip is-sortie">
                      <Compass size={12} aria-hidden="true" />
                      {values.linkedEventTitle || 'Sortie rattachée'}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {values.title || values.linkedEventTitle ? (
                <b className="lkdv-post-text-preview-title">{values.title || values.linkedEventTitle}</b>
              ) : null}
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
      </motion.div>
    </motion.div>
  );
}

export default PostHeroPreview;
