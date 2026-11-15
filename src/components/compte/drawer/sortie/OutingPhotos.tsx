'use client';

import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, MapPin, Share2, Shield, Trash2, Video, X } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { MediaSharingTab } from '@/components/media-sharing/MediaSharingHub';
import type { OutingPhoto } from '@/features/compte/server/sorties';
import { DrawerEmpty, DrawerError } from '../shell/DrawerShell';

export interface OutingPhotosProps {
  photos: OutingPhoto[];
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (photoId: string) => void;
  onOpenMediaHub?: (tab: MediaSharingTab) => void;
  /** `hike_session_photos` illisible : ce n'est pas « aucune photo ». */
  unavailable?: boolean;
  onRetry?: () => void;
}

function isVideoMedia(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

export function OutingPhotos({
  photos,
  canEdit,
  uploading,
  onUpload,
  onDelete,
  onOpenMediaHub,
  unavailable = false,
  onRetry,
}: OutingPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<OutingPhoto | null>(null);

  return (
    <div className="lkdv-sortie-pane">
      <div className="lkdv-sortie-photos-head">
        <div>
          <b>{photos.length > 0 ? `${photos.length} média${photos.length > 1 ? 's' : ''}` : 'Photos & vidéos'}</b>
          <span>La première photo sert de couverture (S1.21 : photo & vidéo).</span>
        </div>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              className="lkdv-sortie-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = '';
              }}
            />
            <ActionPill
              tone="primary"
              label="Ajouter photo ou vidéo"
              icon={<ImagePlus />}
              busy={uploading}
              onClick={() => inputRef.current?.click()}
            />
          </>
        ) : null}
      </div>

      {onOpenMediaHub ? (
        <div className="lkdv-apill-row" style={{ flexWrap: 'wrap' }}>
          <ActionPill
            label="Galerie géolocalisée (K5.06)"
            icon={<MapPin />}
            text="Galerie sur tracé"
            onClick={() => onOpenMediaHub('gallery')}
          />
          <ActionPill
            label="Partage externe & sticker (K5.27 / S5.25)"
            icon={<Share2 />}
            text="Carte & sticker"
            onClick={() => onOpenMediaHub('share')}
          />
          <ActionPill
            label="Aperçu protégé révocable (K5.28)"
            icon={<Shield />}
            text="Aperçu révocable"
            onClick={() => onOpenMediaHub('preview')}
          />
        </div>
      ) : null}

      {unavailable && photos.length === 0 ? (
        <DrawerError
          onRetry={onRetry}
          label="Photos momentanément indisponibles."
        />
      ) : photos.length === 0 ? (
        <DrawerEmpty
          title="Aucune photo pour cette sortie"
          action={
            canEdit ? (
              <ActionPill label="Choisir une photo" icon={<Camera />} onClick={() => inputRef.current?.click()} />
            ) : undefined
          }
        />
      ) : (
        <div className="lkdv-sortie-photo-grid">
          {photos.map((photo, index) => {
            const isVideo = isVideoMedia(photo.url);
            return (
              <button
                key={photo.id}
                type="button"
                className="lkdv-sortie-photo"
                onClick={() => setActive(photo)}
                aria-label={photo.caption || `${isVideo ? 'Vidéo' : 'Photo'} ${index + 1}`}
              >
                {isVideo ? (
                  <video src={photo.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={photo.url} alt={photo.caption || ''} loading="lazy" />
                )}
                {isVideo ? (
                  <span className="lkdv-sortie-cover" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Video size={11} aria-hidden="true" /> Vidéo
                  </span>
                ) : index === 0 ? (
                  <span className="lkdv-sortie-cover">Couverture</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {active ? (
        <div className="lkdv-sortie-lightbox" role="dialog" aria-modal="true" aria-label={active.caption || 'Photo'}>
          <button type="button" className="lkdv-sortie-lightbox-close" onClick={() => setActive(null)} aria-label="Fermer">
            <X size={18} aria-hidden="true" />
          </button>
          {isVideoMedia(active.url) ? (
            <video src={active.url} controls playsInline style={{ maxWidth: '100%', maxHeight: '72vh' }} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={active.url} alt={active.caption || ''} />
          )}
          <div className="lkdv-sortie-lightbox-bar">
            <span>{active.caption || 'Photo de la sortie'}</span>
            {canEdit ? (
              <button
                type="button"
                className="lkdv-sortie-lightbox-delete"
                onClick={() => {
                  onDelete(active.id);
                  setActive(null);
                }}
              >
                <Trash2 size={15} aria-hidden="true" /> Supprimer
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default OutingPhotos;
