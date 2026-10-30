'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { MediaItem, MediaUploader } from './mediaTypes';
import './create-shared.css';

export const MEDIA_PICKER_MAX_BYTES = 50 * 1024 * 1024;
export const MEDIA_PICKER_DEFAULT_ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm';

export interface MediaPickerProps {
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  max?: number;
  accept?: string;
  label?: string;
  hint?: string;
  upload?: MediaUploader;
  disabled?: boolean;
  className?: string;
  /** Nom du champ React Hook Form, pour focaliser l’erreur sur le sélecteur. */
  fieldName?: string;
}

/** Vérifie un fichier contre une liste `accept` (types MIME et extensions). */
export function isAcceptedFile(file: File, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  return tokens.some((token) => {
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    if (token.startsWith('.')) return name.endsWith(token);
    return type === token;
  });
}

let mediaSequence = 0;

/** Construit l’état initial d’un média local, avant upload. */
export function createMediaItem(file: File, index = 0): MediaItem {
  mediaSequence += 1;
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `media-${Date.now()}-${index}-${mediaSequence}`;
  const previewUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : '';
  return {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    previewUrl,
    url: null,
    alt: '',
    cover: false,
    status: 'local',
    progress: 0,
    storageBucket: '',
    storagePath: '',
    file,
  };
}

function statusText(item: MediaItem): string {
  if (item.status === 'uploading') return `Envoi ${Math.round(item.progress)} %`;
  if (item.status === 'uploaded') return 'Envoyé';
  if (item.status === 'error') return 'Échec de l’envoi';
  return 'Prêt';
}

/**
 * Sélecteur de médias partagé par les six formulaires.
 *
 * - glisser-déposer et sélection fichier, aperçu local immédiat ;
 * - texte alternatif par média, couverture unique, réorganisation simple ;
 * - upload contrôlé : sans `upload`, les médias restent locaux ; avec, chaque
 *   fichier est envoyé avec progression, erreur et réessai.
 */
export function MediaPicker({
  value,
  onChange,
  max = 10,
  accept = MEDIA_PICKER_DEFAULT_ACCEPT,
  label = 'Photos ou vidéos',
  hint,
  upload,
  disabled = false,
  className = '',
  fieldName,
}: MediaPickerProps) {
  const itemsRef = useRef(value);
  const [dragOver, setDragOver] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);

  useEffect(() => {
    itemsRef.current = value;
  }, [value]);

  const commit = useCallback(
    (next: MediaItem[]) => {
      const normalized = next.map((item, index) => ({ ...item, cover: index === 0 }));
      itemsRef.current = normalized;
      onChange(normalized);
    },
    [onChange],
  );

  const patch = useCallback(
    (id: string, changes: Partial<MediaItem>) => {
      const next = itemsRef.current.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      );
      commit(next);
    },
    [commit],
  );

  const uploadItem = useCallback(
    async (item: MediaItem) => {
      if (!upload || !item.file) return;
      patch(item.id, { status: 'uploading', progress: 0, error: undefined });
      try {
        const result = await upload(item.file, (percent) => {
          patch(item.id, { progress: Math.max(0, Math.min(100, percent)) });
        });
        const uploaded =
          typeof result === 'string' ? { url: result } : result;
        patch(item.id, {
          status: 'uploaded',
          url: uploaded.url,
          storageBucket: uploaded.bucket ?? '',
          storagePath: uploaded.path ?? '',
          progress: 100,
          error: undefined,
        });
      } catch (error) {
        patch(item.id, {
          status: 'error',
          error: error instanceof Error && error.message ? error.message : 'Envoi impossible.',
        });
      }
    },
    [patch, upload],
  );

  const addFiles = useCallback(
    (files: ArrayLike<File> | null | undefined) => {
      if (disabled || !files) return;
      const incoming = Array.from(files);
      if (incoming.length === 0) return;
      const slots = Math.max(0, max - itemsRef.current.length);
      const problems: string[] = [];
      if (incoming.length > slots) {
        problems.push(`Tu peux ajouter ${max} média${max > 1 ? 's' : ''} maximum.`);
      }
      const accepted: MediaItem[] = [];
      incoming.slice(0, slots).forEach((file, index) => {
        if (!isAcceptedFile(file, accept)) {
          problems.push(`Format non accepté : ${file.name}.`);
          return;
        }
        if (file.size > MEDIA_PICKER_MAX_BYTES) {
          problems.push(`${file.name} dépasse 50 Mo.`);
          return;
        }
        accepted.push(createMediaItem(file, index));
      });
      setRejection(problems.length ? problems.join(' ') : null);
      if (accepted.length === 0) return;

      if (!itemsRef.current.some((item) => item.cover) && accepted[0]) {
        accepted[0] = { ...accepted[0], cover: true };
      }
      commit([...itemsRef.current, ...accepted]);
      accepted.forEach((item) => {
        if (upload) void uploadItem(item);
      });
    },
    [accept, commit, disabled, max, upload, uploadItem],
  );

  const moveBy = (id: string, delta: number) => {
    const list = [...itemsRef.current];
    const from = list.findIndex((item) => item.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    commit(list);
  };

  const moveBefore = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const list = [...itemsRef.current];
    const from = list.findIndex((item) => item.id === sourceId);
    const to = list.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    commit(list);
  };

  const remove = (id: string) => {
    const target = itemsRef.current.find((item) => item.id === id);
    if (target?.previewUrl.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(target.previewUrl);
    }
    const next = itemsRef.current.filter((item) => item.id !== id);
    if (next.length > 0 && !next.some((item) => item.cover)) next[0] = { ...next[0], cover: true };
    commit(next);
  };

  return (
    <div
      className={`lkdv-media-picker ${className}`.trim()}
      data-testid="media-picker"
      data-field={fieldName}
    >
      <label
        className={`lkdv-media-dropzone${dragOver ? ' is-over' : ''}`}
        data-testid="media-dropzone"
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          event.stopPropagation();
          setDragOver(false);
          addFiles(event.dataTransfer?.files);
        }}
      >
        <input
          id={fieldName}
          type="file"
          multiple={max > 1}
          accept={accept}
          disabled={disabled}
          className="sr-only"
          aria-label={max > 1 ? 'Choisir des fichiers' : 'Choisir un fichier'}
          onChange={(event) => {
            addFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />
        <div className="lkdv-media-dropzone-text">
          <b>{label}</b>
          <span>{hint ?? 'Touche le cadre pour ajouter une photo ou une vidéo.'}</span>
        </div>
        <span className="lkdv-media-plus" aria-hidden="true">+</span>
      </label>

      {value.length > 0 ? (
        <div className="lkdv-media-contact-head">
          <span>{value.length}/{max} média{max > 1 ? 's' : ''}</span>
          <span>{value.find((item) => item.cover)?.name ?? 'Aucune couverture'}</span>
        </div>
      ) : null}

      {rejection ? (
        <p className="lkdv-media-error" role="alert">
          {rejection}
        </p>
      ) : null}

      {value.length > 0 ? (
        <ul className="lkdv-media-list" aria-label="Médias sélectionnés">
          {value.map((item, index) => (
            <li
              key={item.id}
              className="lkdv-media-item"
              data-testid="media-item"
              data-status={item.status}
              title="Double-clique pour retirer"
              onDoubleClick={(event) => { event.preventDefault(); if (!disabled) remove(item.id); }}
              draggable={!disabled}
              onDragStart={(event) => {
                draggedIdRef.current = item.id;
                event.dataTransfer?.setData('text/plain', item.id);
              }}
              onDragOver={(event) => {
                if (!draggedIdRef.current) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                const source = draggedIdRef.current || event.dataTransfer?.getData('text/plain');
                if (!source) return;
                event.preventDefault();
                event.stopPropagation();
                draggedIdRef.current = null;
                moveBefore(source, item.id);
              }}
              onDragEnd={() => {
                draggedIdRef.current = null;
              }}
            >
              <div className="lkdv-media-thumb">
                {item.type.startsWith('video/') ? (
                  <video
                    data-testid="media-preview"
                    src={item.previewUrl || item.url || ''}
                    controls
                    muted
                    playsInline
                    width={66}
                    height={66}
                    preload="metadata"
                  />
                ) : (
                  <img
                    data-testid="media-preview"
                    src={item.previewUrl || item.url || ''}
                    alt={item.alt}
                    width={66}
                    height={66}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                {item.cover ? <span className="lkdv-media-cover-badge">Couverture</span> : null}
              </div>
              <div className="lkdv-media-fields">
                <b className="lkdv-media-name">{item.name}</b>
                <label className="lkdv-media-caption">
                  <span>Texte de l’image</span>
                  <input
                    type="text"
                    value={item.alt}
                    maxLength={200}
                    disabled={disabled}
                    aria-label={`Texte pour ${item.name}`}
                    placeholder="Décris cette image…"
                    onChange={(event) => patch(item.id, { alt: event.target.value })}
                  />
                </label>
                <div className="lkdv-media-actions">
                  <button
                    type="button"
                    className="lkdv-media-icon"
                    aria-label={`Monter ${item.name}`}
                    disabled={disabled || index === 0}
                    onClick={() => moveBy(item.id, -1)}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="lkdv-media-icon"
                    aria-label={`Descendre ${item.name}`}
                    disabled={disabled || index === value.length - 1}
                    onClick={() => moveBy(item.id, 1)}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="lkdv-media-icon lkdv-media-trash"
                    aria-label={`Supprimer ${item.name}`}
                    disabled={disabled}
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                {item.status === 'uploading' ? (
                  <div
                    className="lkdv-media-progress"
                    role="progressbar"
                    aria-label={`Envoi de ${item.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress)}
                  >
                    <span style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                  </div>
                ) : null}
                <p className="lkdv-media-state" data-testid="media-status">
                  {statusText(item)}
                </p>
                {item.status === 'error' ? (
                  <div className="lkdv-media-retry">
                    {item.error ? <span role="alert">{item.error}</span> : null}
                    {item.file ? (
                      <button
                        type="button"
                        aria-label={`Réessayer ${item.name}`}
                        disabled={disabled}
                        onClick={() => void uploadItem(item)}
                      >
                        Réessayer
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="lkdv-media-count" aria-live="polite">
        {value.length}/{max} média{max > 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default MediaPicker;
