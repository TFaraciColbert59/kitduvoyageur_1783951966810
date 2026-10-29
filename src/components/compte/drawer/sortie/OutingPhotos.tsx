'use client';

import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingPhoto } from '@/features/compte/server/sorties';
import { DrawerEmpty } from '../shell/DrawerShell';

export interface OutingPhotosProps {
  photos: OutingPhoto[];
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (photoId: string) => void;
}

export function OutingPhotos({ photos, canEdit, uploading, onUpload, onDelete }: OutingPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<OutingPhoto | null>(null);

  return (
    <div className="lkdv-sortie-pane">
      <div className="lkdv-sortie-photos-head">
        <div>
          <b>{photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'Photos'}</b>
          <span>La première photo sert de couverture.</span>
        </div>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="lkdv-sortie-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = '';
              }}
            />
            <ActionPill
              tone="primary"
              label="Ajouter une photo"
              icon={<ImagePlus />}
              busy={uploading}
              onClick={() => inputRef.current?.click()}
            />
          </>
        ) : null}
      </div>

      {photos.length === 0 ? (
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
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="lkdv-sortie-photo"
              onClick={() => setActive(photo)}
              aria-label={photo.caption || `Photo ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption || ''} loading="lazy" />
              {index === 0 ? <span className="lkdv-sortie-cover">Couverture</span> : null}
            </button>
          ))}
        </div>
      )}

      {active ? (
        <div className="lkdv-sortie-lightbox" role="dialog" aria-modal="true" aria-label={active.caption || 'Photo'}>
          <button type="button" className="lkdv-sortie-lightbox-close" onClick={() => setActive(null)} aria-label="Fermer">
            <X size={18} aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.url} alt={active.caption || ''} />
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
