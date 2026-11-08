'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LocateFixed, Mountain, Play, Ruler, CloudSun, Link2, MapPin, Pause, RotateCcw } from 'lucide-react';
import StoriesViewer from '@/components/communaute/StoriesViewer';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type {
  MediaItemV2,
  StoryStickersV2,
  StoryTextLayerV2,
} from '../engine/createSchemasV2';

export interface StoryStageV2Props {
  media: MediaItemV2 | null;
  textLayers: StoryTextLayerV2[];
  stickers: StoryStickersV2;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<StoryTextLayerV2>) => void;
  trimStartMs: number | null;
  trimEndMs: number | null;
  playing: boolean;
  onTogglePlaying: () => void;
  /** Affiche le dock de composition (Galerie / Caméra / aperçu). */
  onGallery?: () => void;
  onCamera?: () => void;
}

interface TransformState {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.9;
const MAX_SCALE = 2.6;
const MAX_PAN = 140;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Scène 9:16 de l'éditeur de story (`Story#2-5`) : le média est rendu par le
 * **visualiseur existant** en mode composition (`StoriesViewer compose`), les
 * calques de l'éditeur (textes déplaçables, stickers voyage) sont posés dessus.
 *
 * - cadrage : glisser à un doigt, pincer à deux doigts (échelle) ;
 * - textes : glisser, pincer pour redimensionner et pivoter ;
 * - le dock de composition est le dock du visualiseur.
 */
export function StoryStageV2({
  media,
  textLayers,
  stickers,
  selectedLayerId,
  onSelectLayer,
  onChangeLayer,
  trimStartMs,
  trimEndMs,
  playing,
  onTogglePlaying,
  onGallery,
  onCamera,
}: StoryStageV2Props) {
  const { haptic } = useHapticFeedback();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<TransformState>({ scale: 1, x: 0, y: 0 });
  const mediaGesture = useRef<Map<number, { x: number; y: number }>>(new Map());
  const mediaOrigin = useRef<{ transform: TransformState; distance: number; center: { x: number; y: number } } | null>(null);
  const layerGesture = useRef<Map<number, { x: number; y: number }>>(new Map());
  const layerOrigin = useRef<{
    id: string;
    scale: number;
    rotation: number;
    distance: number;
    angle: number;
    start: { x: number; y: number };
  } | null>(null);

  const mediaUrl = media ? media.previewUrl || media.url : '';
  const mediaType = media?.type.startsWith('video/') ? 'video' : 'image';

  const stickerChips = useMemo(() => {
    const chips: React.ReactNode[] = [];
    if (stickers.place?.label) {
      chips.push(
        <span key="place" className="lkdv-cv2c-story-sticker">
          <MapPin size={12} aria-hidden="true" />
          {stickers.place.label}
        </span>,
      );
    }
    if (stickers.altitudeM != null) {
      chips.push(
        <span key="altitude" className="lkdv-cv2c-story-sticker">
          <Mountain size={12} aria-hidden="true" />
          {stickers.altitudeM} m
        </span>,
      );
    }
    if (stickers.weatherLabel) {
      chips.push(
        <span key="weather" className="lkdv-cv2c-story-sticker">
          <CloudSun size={12} aria-hidden="true" />
          {stickers.weatherLabel}
        </span>,
      );
    }
    if (stickers.distanceKm != null) {
      chips.push(
        <span key="distance" className="lkdv-cv2c-story-sticker">
          <Ruler size={12} aria-hidden="true" />
          {stickers.distanceKm} km
        </span>,
      );
    }
    if (stickers.link?.url) {
      chips.push(
        <span key="link" className="lkdv-cv2c-story-sticker">
          <Link2 size={12} aria-hidden="true" />
          {stickers.link.label || 'Lien'}
        </span>,
      );
    }
    if (stickers.carnetId) {
      chips.push(
        <span key="carnet" className="lkdv-cv2c-story-sticker">
          <MapPin size={12} aria-hidden="true" />
          {stickers.carnetTitle || 'Carnet lié'}
        </span>,
      );
    }
    return chips;
  }, [stickers]);

  // ── Cadrage du média (glisser/pincer) ────────────────────────────────────
  const onStagePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-cv2c-layer]')) return;
    mediaGesture.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (mediaGesture.current.size === 1) {
      mediaOrigin.current = {
        transform,
        distance: 0,
        center: { x: event.clientX, y: event.clientY },
      };
    } else if (mediaGesture.current.size === 2) {
      const points = [...mediaGesture.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      mediaOrigin.current = {
        transform,
        distance,
        center: {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2,
        },
      };
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture optionnelle */
    }
  }, [transform]);

  const onStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const current = mediaGesture.current.get(event.pointerId);
    if (!current) return;
    mediaGesture.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const origin = mediaOrigin.current;
    if (!origin) return;
    if (mediaGesture.current.size === 1) {
      const deltaX = event.clientX - current.x;
      const deltaY = event.clientY - current.y;
      setTransform({
        scale: origin.transform.scale,
        x: clamp(origin.transform.x + deltaX, -MAX_PAN, MAX_PAN),
        y: clamp(origin.transform.y + deltaY, -MAX_PAN, MAX_PAN),
      });
    } else if (mediaGesture.current.size === 2) {
      const points = [...mediaGesture.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (origin.distance > 0 && distance > 0) {
        setTransform({
          scale: clamp((origin.transform.scale * distance) / origin.distance, MIN_SCALE, MAX_SCALE),
          x: origin.transform.x,
          y: origin.transform.y,
        });
      }
    }
  }, []);

  const onStagePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    mediaGesture.current.delete(event.pointerId);
    if (mediaGesture.current.size === 0) mediaOrigin.current = null;
  }, []);

  // ── Calques texte (glisser, pincer, pivoter) ─────────────────────────────
  const onLayerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, layer: StoryTextLayerV2) => {
      event.stopPropagation();
      onSelectLayer(layer.id);
      layerGesture.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const stage = stageRef.current?.getBoundingClientRect();
      if (layerGesture.current.size === 1 && stage) {
        layerOrigin.current = {
          id: layer.id,
          scale: layer.scale,
          rotation: layer.rotation,
          distance: 0,
          angle: 0,
          start: { x: event.clientX, y: event.clientY },
        };
      } else if (layerGesture.current.size === 2) {
        const points = [...layerGesture.current.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const angle = (Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * 180) / Math.PI;
        layerOrigin.current = {
          id: layer.id,
          scale: layer.scale,
          rotation: layer.rotation,
          distance,
          angle,
          start: { x: points[0].x, y: points[0].y },
        };
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture optionnelle */
      }
    },
    [onSelectLayer],
  );

  const onLayerPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = layerGesture.current.get(event.pointerId);
      const origin = layerOrigin.current;
      if (!current || !origin) return;
      layerGesture.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const layer = textLayers.find((entry) => entry.id === origin.id);
      if (!layer) return;
      if (layerGesture.current.size === 1) {
        const stage = stageRef.current?.getBoundingClientRect();
        if (!stage) return;
        const deltaX = (event.clientX - current.x) / stage.width;
        const deltaY = (event.clientY - current.y) / stage.height;
        onChangeLayer(origin.id, {
          x: clamp(layer.x + deltaX, 0.04, 0.96),
          y: clamp(layer.y + deltaY, 0.04, 0.96),
        });
      } else if (layerGesture.current.size === 2 && origin.distance > 0) {
        const points = [...layerGesture.current.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const angle = (Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * 180) / Math.PI;
        onChangeLayer(origin.id, {
          scale: clamp((origin.scale * distance) / origin.distance, 0.6, 2.4),
          rotation: clamp(origin.rotation + angle - origin.angle, -45, 45),
        });
      }
    },
    [onChangeLayer, textLayers],
  );

  const onLayerPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    layerGesture.current.delete(event.pointerId);
    if (layerGesture.current.size === 0) layerOrigin.current = null;
  }, []);

  const dock = (
    <>
      {onGallery ? (
        <button type="button" onClick={onGallery} aria-label="Choisir dans la galerie">
          Galerie
        </button>
      ) : null}
      {onCamera ? (
        <button type="button" onClick={onCamera} aria-label="Prendre une photo">
          Caméra
        </button>
      ) : null}
      {mediaType === 'video' ? (
        <button type="button" onClick={onTogglePlaying} aria-pressed={playing} aria-label={playing ? 'Mettre en pause l’extrait' : 'Lire l’extrait'}>
          {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          {playing ? 'Pause' : 'Lire'}
        </button>
      ) : null}
      {transform.scale !== 1 || transform.x !== 0 || transform.y !== 0 ? (
        <button
          type="button"
          onClick={() => {
            setTransform({ scale: 1, x: 0, y: 0 });
            haptic('selection');
          }}
          aria-label="Recentrer le média"
        >
          <RotateCcw size={13} aria-hidden="true" />
          Recentrer
        </button>
      ) : null}
    </>
  );

  const layers = (
    <>
      {textLayers.map((layer) => (
        <div
          key={layer.id}
          className={`lkdv-cv2c-story-layer lkdv-cv2c-story-layer-text${selectedLayerId === layer.id ? ' is-selected' : ''}`}
          data-style={layer.style}
          data-cv2c-layer={layer.id}
          role="button"
          tabIndex={0}
          aria-label={`Texte : ${layer.text || 'vide'}. Glisse pour déplacer, pince pour redimensionner.`}
          style={{
            left: `${layer.x * 100}%`,
            top: `${layer.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
            fontSize: '17px',
            fontWeight: 600,
          }}
          onPointerDown={(event) => onLayerPointerDown(event, layer)}
          onPointerMove={onLayerPointerMove}
          onPointerUp={onLayerPointerEnd}
          onPointerCancel={onLayerPointerEnd}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectLayer(layer.id);
            }
          }}
        >
          {layer.text || 'Texte'}
        </div>
      ))}
      {stickerChips.length > 0 ? (
        <div className="lkdv-cv2c-story-stickers" data-cv2c-layer="stickers">
          {stickerChips}
        </div>
      ) : null}
      <span className="lkdv-cv2c-sr-only" aria-live="polite">
        {media ? 'Média prêt' : 'Aucun média sélectionné'}
        {textLayers.length > 0 ? `, ${textLayers.length} texte${textLayers.length > 1 ? 's' : ''}` : ''}
      </span>
    </>
  );

  return (
    <div
      ref={stageRef}
      className="lkdv-cv2c-story-stage"
      data-hscroll
      data-testid="cv2-story-stage"
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerEnd}
      onPointerCancel={onStagePointerEnd}
    >
      <StoriesViewer
        users={[]}
        startUser={0}
        onClose={() => undefined}
        compose={{
          media: mediaUrl ? { url: mediaUrl, mediaType, durationMs: media?.durationMs } : null,
          trimStartMs,
          trimEndMs,
          layers,
          dock,
          playing,
          mediaTransform: transform,
        }}
      />
      {!media && !onGallery ? (
        <div className="lkdv-cv2c-story-empty">
          <LocateFixed size={18} aria-hidden="true" />
          <p>Choisis une photo ou une vidéo pour composer ta story.</p>
        </div>
      ) : null}
    </div>
  );
}

export default StoryStageV2;
