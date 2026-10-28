'use client';

import React, { useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useObjectUrl } from './fields';

export const MAX_MEDIA = 10;
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

/** Médias acceptés (image ou vidéo, 50 Mo max, 10 au total) ; renvoie aussi le motif de refus. */
export function acceptMedia(
  current: File[],
  incoming: File[],
  max = MAX_MEDIA,
): { files: File[]; error: string | null } {
  let error: string | null = null;
  const next = [...current];
  for (const file of incoming) {
    if (!/^(image|video)\//.test(file.type)) {
      error = 'Format non supporté : photos et vidéos seulement.';
      continue;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      error = 'Média trop volumineux (50 Mo max).';
      continue;
    }
    if (next.length >= max) {
      error = `${max} médias maximum.`;
      break;
    }
    next.push(file);
  }
  return { files: next, error };
}

/** Déplace l'élément `from` vers `to` (indices bornés) sans muter la liste. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const target = Math.max(0, Math.min(to, list.length - 1));
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(target, 0, item as T);
  return copy;
}

function Preview({ file, className }: { file: File; className?: string }) {
  const url = useObjectUrl(file);
  if (!url) return <span className={className} />;
  if (file.type.startsWith('video/')) {
    return <video className={className} src={url} muted playsInline preload="metadata" aria-label={file.name} />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
  return <img className={className} src={url} alt="" />;
}

export function MediaTray({
  files,
  onChange,
  onError,
  max = MAX_MEDIA,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  onError?: (message: string | null) => void;
  max?: number;
}) {
  const [selected, setSelected] = useState(0);
  const cameraId = useId();
  const galleryId = useId();
  const moreId = useId();
  const safe = Math.max(0, Math.min(selected, files.length - 1));

  const add = (incoming: File[]) => {
    // Limite à 1 (story) : le nouveau média remplace l'ancien au lieu d'être refusé.
    const result = acceptMedia(max === 1 ? [] : files, incoming, max);
    onError?.(result.error);
    onChange(result.files);
    if (result.files.length > (max === 1 ? 0 : files.length)) setSelected(max === 1 ? 0 : files.length);
  };

  if (files.length === 0) {
    return (
      <div className="lkdv-wz-drop">
        <label className="lkdv-wz-drop-btn" htmlFor={cameraId}>
          <Icon name="camera" size={24} aria-hidden="true" />
          Caméra
        </label>
        <label className="lkdv-wz-drop-btn" htmlFor={galleryId}>
          <Icon name="image-plus" size={24} aria-hidden="true" />
          Galerie
        </label>
        <input
          id={cameraId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => add(Array.from(event.target.files ?? []))}
        />
        <input
          id={galleryId}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,video/webm"
          className="sr-only"
          onChange={(event) => add(Array.from(event.target.files ?? []))}
        />
        <p>Jusqu’à {max} photos ou vidéos</p>
      </div>
    );
  }

  const current = files[safe] as File;

  return (
    <div className="lkdv-wz-media">
      <div className="lkdv-wz-hero">
        <Preview file={current} />
        {safe === 0 ? <span className="lkdv-wz-badge">Couverture</span> : null}
      </div>

      <ul className="lkdv-wz-strip" aria-label="Médias sélectionnés">
        {files.map((file, index) => (
          <li key={`${file.name}-${file.size}-${index}`}>
            <button
              type="button"
              className="lkdv-wz-thumb"
              aria-pressed={index === safe}
              aria-label={`Média ${index + 1} sur ${files.length}`}
              onClick={() => setSelected(index)}
            >
              <Preview file={file} />
            </button>
          </li>
        ))}
        {files.length < max ? (
          <li>
            <label className="lkdv-wz-thumb lkdv-wz-thumb--add" htmlFor={moreId} aria-label="Ajouter des médias">
              <Icon name="plus" size={18} aria-hidden="true" />
            </label>
            <input
              id={moreId}
              type="file"
              multiple
              accept="image/*,video/mp4,video/quicktime,video/webm"
              className="sr-only"
              onChange={(event) => add(Array.from(event.target.files ?? []))}
            />
          </li>
        ) : null}
      </ul>

      <div className="lkdv-wz-tools" role="group" aria-label="Actions sur le média sélectionné">
        <button
          type="button"
          aria-label="Avancer d’une place"
          disabled={safe === 0}
          onClick={() => {
            onChange(moveItem(files, safe, safe - 1));
            setSelected(safe - 1);
          }}
        >
          <Icon name="arrow-left" size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Reculer d’une place"
          disabled={safe === files.length - 1}
          onClick={() => {
            onChange(moveItem(files, safe, safe + 1));
            setSelected(safe + 1);
          }}
        >
          <Icon name="arrow-right" size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Retirer ce média"
          onClick={() => {
            onChange(files.filter((_, index) => index !== safe));
            setSelected(Math.max(0, safe - 1));
          }}
        >
          <Icon name="x" size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
