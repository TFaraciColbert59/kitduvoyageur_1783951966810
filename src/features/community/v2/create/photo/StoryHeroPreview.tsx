'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Camera,
  CloudSun,
  Compass,
  Heart,
  Link2,
  MoreHorizontal,
  Mountain,
  Palette,
  RotateCw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import type { StoryFormValuesV2, StoryTextLayerV2 } from '../engine/createSchemasV2';
import {
  type PhotoEditorCategory,
  computePhotoStyle,
  computeVignetteOverlayStyle,
} from './photoEditor';
import { CollapsibleHeroPreview } from './CollapsibleHeroPreview';

export interface StoryHeroPreviewProps {
  values: StoryFormValuesV2;
  user: User | null;
  activeSlideIndex: number;
  activeCategory: PhotoEditorCategory | null;
  onSelectCategory: (category: PhotoEditorCategory) => void;
  onTriggerFileInput: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string) => void;
  onUpdateLayer?: (id: string, patch: Partial<StoryTextLayerV2>) => void;
  onRemoveActiveMedia?: () => void;
  collapsed?: boolean;
  onExpand?: () => void;
}

const PREVIEW_FALLBACK_ART = '/assets/images/community-preview-meadow.svg';

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

interface DraggableStoryLayerProps {
  layer: StoryTextLayerV2;
  isSelected: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onUpdate: (patch: Partial<StoryTextLayerV2>) => void;
}

function DraggableStoryLayer({
  layer,
  isSelected,
  stageRef,
  onSelect,
  onUpdate,
}: DraggableStoryLayerProps) {
  const chipRef = useRef<HTMLDivElement | null>(null);
  const [transforming, setTransforming] = useState(false);

  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const transformStateRef = useRef<{
    pointerId: number;
    centerX: number;
    centerY: number;
    startDist: number;
    startAngle: number;
    startScale: number;
    startRotation: number;
  } | null>(null);

  const pinchRef = useRef<{
    startDist: number;
    startAngle: number;
    startScale: number;
    startRotation: number;
  } | null>(null);

  const handleMovePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: layer.x,
      startY: layer.y,
    };
  };

  const handleMovePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const nx = clamp(state.startX + (e.clientX - state.startClientX) / rect.width, 0.14, 0.86);
    const ny = clamp(state.startY + (e.clientY - state.startClientY) / rect.height, 0.18, 0.78);
    onUpdate({ x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) });
  };

  const handleMovePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
    }
  };

  const handleTransformPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const chip = chipRef.current;
    if (!chip) return;
    const box = chip.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const startDist = Math.max(12, Math.hypot(dx, dy));
    const startAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    e.currentTarget.setPointerCapture(e.pointerId);
    transformStateRef.current = {
      pointerId: e.pointerId,
      centerX,
      centerY,
      startDist,
      startAngle,
      startScale: layer.scale ?? 1,
      startRotation: layer.rotation ?? 0,
    };
    setTransforming(true);
  };

  const handleTransformPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = transformStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - state.centerX;
    const dy = e.clientY - state.centerY;
    const dist = Math.max(8, Math.hypot(dx, dy));
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    let deltaAngle = angle - state.startAngle;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    const nextScale = Number(clamp((state.startScale * dist) / state.startDist, 0.6, 2.2).toFixed(2));
    const nextRotation = Math.round(clamp(state.startRotation + deltaAngle, -45, 45));
    onUpdate({ scale: nextScale, rotation: nextRotation });
  };

  const handleTransformPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (transformStateRef.current?.pointerId === e.pointerId) {
      transformStateRef.current = null;
      setTransforming(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2) return;
    e.stopPropagation();
    const t0 = e.touches[0]!;
    const t1 = e.touches[1]!;
    pinchRef.current = {
      startDist: Math.max(12, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)),
      startAngle: (Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * 180) / Math.PI,
      startScale: layer.scale ?? 1,
      startRotation: layer.rotation ?? 0,
    };
    setTransforming(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = pinchRef.current;
    if (!state || e.touches.length !== 2) return;
    e.stopPropagation();
    const t0 = e.touches[0]!;
    const t1 = e.touches[1]!;
    const dist = Math.max(8, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
    const angle = (Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * 180) / Math.PI;
    let deltaAngle = angle - state.startAngle;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    const nextScale = Number(clamp((state.startScale * dist) / state.startDist, 0.6, 2.2).toFixed(2));
    const nextRotation = Math.round(clamp(state.startRotation + deltaAngle, -45, 45));
    onUpdate({ scale: nextScale, rotation: nextRotation });
  };

  const handleTouchEnd = () => {
    if (pinchRef.current) {
      pinchRef.current = null;
      setTransforming(false);
    }
  };

  return (
    <motion.div
      ref={chipRef}
      initial={{ opacity: 0, scale: (layer.scale ?? 1) * 0.9 }}
      animate={{
        opacity: 1,
        scale: layer.scale ?? 1,
        rotate: layer.rotation ?? 0,
      }}
      exit={{ opacity: 0, scale: 0.86 }}
      transition={{ duration: transforming ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={handleMovePointerDown}
      onPointerMove={handleMovePointerMove}
      onPointerUp={handleMovePointerUp}
      onPointerCancel={handleMovePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => e.stopPropagation()}
      className={`lkdv-story-layer-chip is-${layer.style} is-draggable ${isSelected ? 'is-selected' : ''}`}
      data-testid={`story-layer-chip-${layer.id}`}
      style={{
        position: 'absolute',
        left: `${Math.round(layer.x * 100)}%`,
        top: `${Math.round(layer.y * 100)}%`,
        x: '-50%',
        y: '-50%',
      }}
    >
      <span className="lkdv-story-layer-text">{layer.text || 'Ton texte'}</span>
      {isSelected ? (
        <button
          type="button"
          className="lkdv-story-layer-handle"
          aria-label="Redimensionner et pivoter le texte"
          data-testid="story-layer-transform-handle"
          onPointerDown={handleTransformPointerDown}
          onPointerMove={handleTransformPointerMove}
          onPointerUp={handleTransformPointerUp}
          onPointerCancel={handleTransformPointerUp}
          onClick={(e) => e.stopPropagation()}
        >
          <RotateCw size={10} aria-hidden="true" />
        </button>
      ) : null}
      {transforming ? (
        <span className="lkdv-story-layer-hud" aria-hidden="true">
          {(layer.scale ?? 1).toFixed(1)}× · {layer.rotation ?? 0}°
        </span>
      ) : null}
    </motion.div>
  );
}

export function StoryHeroPreview({
  values,
  user,
  activeSlideIndex,
  activeCategory,
  onSelectCategory,
  onTriggerFileInput,
  fileInputRef,
  onFilesSelected,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onRemoveActiveMedia,
  collapsed = false,
  onExpand = () => undefined,
}: StoryHeroPreviewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);

  const closeMenuAnimated = (index: number | null, callback?: () => void) => {
    if (!menuOpen || menuClosing) return;
    setMenuClosing(true);
    setTappedIndex(index);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setMenuOpen(false);
      setMenuClosing(false);
      setTappedIndex(null);
      callback?.();
    }, 240);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(event.target as Node)) {
        closeMenuAnimated(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fermeture animée au clic extérieur
  }, [menuOpen, menuClosing]);

  const mediaList = values.media ?? [];
  const safeIndex = Math.min(Math.max(0, activeSlideIndex), Math.max(0, mediaList.length - 1));
  const activeMedia = mediaList[safeIndex] ?? null;
  const hasMedia = Boolean(activeMedia);
  const isVideo = activeMedia?.type?.startsWith('video/') ?? false;

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const authorName =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    'Toi';
  const avatarUrl = (metadata.avatar_url as string | undefined) ?? null;

  const photoStyle = hasMedia ? computePhotoStyle(activeMedia?.modifiers) : undefined;
  const vignetteStyle = hasMedia
    ? computeVignetteOverlayStyle(activeMedia?.modifiers?.vignette)
    : null;

  const stickers = values.stickers;
  const textLayers = values.textLayers ?? [];
  const segmentsCount = Math.max(1, mediaList.length);
  const resolvedSelectedLayerId = selectedLayerId ?? textLayers[textLayers.length - 1]?.id ?? null;

  const railActions: Array<{
    key: string;
    testId: string;
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    danger?: boolean;
    onPress: () => void;
  }> = [
    {
      key: 'light',
      testId: 'story-menu-light',
      label: 'Lumière',
      icon: <Sun size={15} aria-hidden="true" />,
      active: activeCategory === 'light',
      onPress: () => onSelectCategory('light'),
    },
    {
      key: 'color',
      testId: 'story-menu-color',
      label: 'Couleur',
      icon: <Palette size={15} aria-hidden="true" />,
      active: activeCategory === 'color',
      onPress: () => onSelectCategory('color'),
    },
    {
      key: 'detail',
      testId: 'story-menu-detail',
      label: 'Détails',
      icon: <SlidersHorizontal size={15} aria-hidden="true" />,
      active: activeCategory === 'detail',
      onPress: () => onSelectCategory('detail'),
    },
    {
      key: 'replace',
      testId: 'story-menu-replace',
      label: 'Remplacer',
      icon: <Camera size={15} aria-hidden="true" />,
      onPress: onTriggerFileInput,
    },
    ...(onRemoveActiveMedia
      ? [
          {
            key: 'remove',
            testId: 'story-menu-remove',
            label: 'Supprimer',
            icon: <Trash2 size={15} aria-hidden="true" />,
            danger: true,
            onPress: onRemoveActiveMedia,
          },
        ]
      : []),
  ];

  return (
    <CollapsibleHeroPreview
      collapsed={collapsed}
      onExpand={onExpand}
      title={`${authorName} · Story`}
      subtitle={
        hasMedia
          ? `${mediaList.length} ${mediaList.length > 1 ? 'stories' : isVideo ? 'vidéo' : 'photo'} · 24 h`
          : '24 h'
      }
      avatarUrl={avatarUrl}
      fallbackText={authorName}
      testId="cv2-story-preview"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        tabIndex={-1}
        className="lkdv-hidden-file-input"
        data-testid="story-file-input"
        onChange={onFilesSelected}
      />

      <div className="lkdv-post-preview-card lkdv-post-preview-card--feed lkdv-story-hero-card">
        {/* Barre de progression multi-stories */}
        <div className="lkdv-story-progress-segments" aria-hidden="true">
          {Array.from({ length: segmentsCount }, (_, i) => (
            <span key={i} className="lkdv-story-progress-seg">
              <span
                className="lkdv-story-progress-seg-fill"
                style={{
                  width: i < safeIndex ? '100%' : i === safeIndex ? '55%' : '0%',
                }}
              />
            </span>
          ))}
        </div>

        {/* Pilule auteur compacte (lieu affiché uniquement ici) + menu déroulant ··· */}
        <div className="lkdv-story-hero-top">
          <div className="lkdv-story-author-pill" data-testid="story-author-pill">
            <span className="lkdv-story-author-av">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar
                <img src={avatarUrl} alt="" className="lkdv-story-author-av-img" />
              ) : (
                <span className="lkdv-story-author-av-fallback">{authorName.slice(0, 1)}</span>
              )}
            </span>
            <span className="lkdv-story-author-meta">
              <b>{authorName}</b>
              <small>{stickers?.place?.label || 'à l’instant'}</small>
            </span>
          </div>

          {hasMedia ? (
            <div ref={menuWrapRef} className="lkdv-post-hero-more-wrap">
              <button
                type="button"
                className="lkdv-story-more-pill lkdv-post-hero-more-btn"
                aria-label="Options du média de la story"
                aria-expanded={menuOpen}
                data-testid="story-hero-more-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (menuOpen) {
                    closeMenuAnimated(null);
                  } else {
                    if (closeTimerRef.current !== null) {
                      window.clearTimeout(closeTimerRef.current);
                      closeTimerRef.current = null;
                    }
                    setMenuClosing(false);
                    setTappedIndex(null);
                    setMenuOpen(true);
                  }
                }}
              >
                <MoreHorizontal size={15} />
              </button>

              {menuOpen ? (
                <div
                  className={`lkdv-story-preview-options-rail ${menuClosing ? 'is-closing' : ''}`}
                  role="menu"
                  aria-label="Options du média de la story"
                  data-testid="story-hero-menu"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {railActions.map((item, idx) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      aria-label={item.label}
                      title={item.label}
                      data-testid={item.testId}
                      style={{ '--i': idx } as React.CSSProperties}
                      className={[
                        'lkdv-story-preview-rail-btn',
                        item.active ? 'is-active' : '',
                        item.danger ? 'is-danger' : '',
                        tappedIndex === idx ? 'is-tapped' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => closeMenuAnimated(idx, item.onPress)}
                    >
                      {item.icon}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          ref={stageRef}
          className="lkdv-post-preview-media-box"
          data-testid="story-preview-media-box"
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
            hasMedia
              ? 'Média de la story. Cliquer pour ajouter ou remplacer.'
              : 'Ajouter jusqu’à 20 photos ou vidéos à la story.'
          }
        >
          {hasMedia && activeMedia ? (
            <div className="lkdv-post-preview-img-wrapper">
              {isVideo ? (
                <video
                  src={activeMedia.previewUrl || activeMedia.url}
                  className="lkdv-post-preview-img"
                  style={photoStyle}
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu story
                <img
                  src={activeMedia.previewUrl || activeMedia.url || PREVIEW_FALLBACK_ART}
                  alt="Aperçu story"
                  className="lkdv-post-preview-img"
                  style={photoStyle}
                />
              )}
              {vignetteStyle && <div style={vignetteStyle} />}

              {/* Stickers légers et épurés (sans le lieu, affiché uniquement dans la pastille auteur) */}
              <div className="lkdv-story-hero-stickers" aria-hidden="true">
                <AnimatePresence initial={false}>
                  {stickers?.weatherLabel ? (
                    <motion.span
                      key="st-weather"
                      className="lkdv-story-sticker-pill"
                      initial={{ opacity: 0, y: 5, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <CloudSun size={10} /> {stickers.weatherLabel}
                    </motion.span>
                  ) : null}
                  {stickers?.altitudeM != null ? (
                    <motion.span
                      key="st-alt"
                      className="lkdv-story-sticker-pill"
                      initial={{ opacity: 0, y: 5, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Mountain size={10} /> {stickers.altitudeM} m
                    </motion.span>
                  ) : null}
                  {stickers?.distanceKm != null ? (
                    <motion.span
                      key="st-dist"
                      className="lkdv-story-sticker-pill"
                      initial={{ opacity: 0, y: 5, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Compass size={10} /> {stickers.distanceKm} km
                    </motion.span>
                  ) : null}
                  {stickers?.carnetTitle ? (
                    <motion.span
                      key="st-carnet"
                      className="lkdv-story-sticker-pill is-accent"
                      initial={{ opacity: 0, y: 5, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Sparkles size={10} /> {stickers.carnetTitle}
                      {stickers.carnetDay ? ` · J${stickers.carnetDay}` : ''}
                    </motion.span>
                  ) : null}
                  {stickers?.link?.url ? (
                    <motion.span
                      key="st-link"
                      className="lkdv-story-sticker-pill"
                      initial={{ opacity: 0, y: 5, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link2 size={10} /> {stickers.link.label?.trim() || 'Lien'}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Calques texte directement manipulables (glisser, redimensionner, pivoter) */}
              <AnimatePresence initial={false}>
                {textLayers.map((layer) => (
                  <DraggableStoryLayer
                    key={layer.id}
                    layer={layer}
                    isSelected={resolvedSelectedLayerId === layer.id}
                    stageRef={stageRef}
                    onSelect={() => onSelectLayer?.(layer.id)}
                    onUpdate={(patch) => onUpdateLayer?.(layer.id, patch)}
                  />
                ))}
              </AnimatePresence>
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
                  <Camera size={22} aria-hidden="true" />
                </span>
                <b className="lkdv-post-preview-empty-title">Ajoute ta story</b>
                <span className="lkdv-post-preview-empty-hint">Jusqu’à 20 photos ou vidéos</span>
              </div>
            </div>
          )}

          <div className="lkdv-story-preview-scrim lkdv-story-preview-scrim--top" aria-hidden="true" />
          <div className="lkdv-story-preview-scrim lkdv-story-preview-scrim--bottom" aria-hidden="true" />

          {/* Barre inférieure fidèle au lecteur réel */}
          <div
            className="lkdv-story-preview-ext-dock"
            aria-hidden="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lkdv-story-preview-composer-wrap">
              <span className="lkdv-story-preview-msg-bar">
                <span className="lkdv-story-preview-msg-text">Envoyer un message…</span>
                <span className="lkdv-story-preview-send">
                  <ArrowRight size={10} />
                </span>
              </span>
            </div>
            <div className="lkdv-story-preview-actions">
              <span className="lkdv-story-preview-action-btn">
                <Heart size={12} />
              </span>
              <span className="lkdv-story-preview-action-btn">
                <Share2 size={12} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleHeroPreview>
  );
}

export default StoryHeroPreview;
