'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, ImagePlus, Loader2, Star, Trash2, X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import {
  type MediaCropV2,
  type MediaItemV2,
  createMediaItemV2,
} from '../engine/createSchemasV2';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { FieldV2 } from './FieldV2';
import {
  cropImageToRatio,
  deleteMediaObjectsV2,
  moveItem,
  uploadMediaV2,
  validateMediaFile,
  type MediaBucketV2,
  type MediaFileLimitsV2,
} from './media';

const CROP_OPTIONS: { value: MediaCropV2; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '4:5', label: '4:5' },
  { value: '1:1', label: '1:1' },
];

export interface MediaFieldV2Props {
  /** Nom du champ RHF (tableau de `MediaItemV2`). */
  name: string;
  label: string;
  userId: string;
  limits: MediaFileLimitsV2;
  max: number;
  hint?: string;
  bucket?: MediaBucketV2;
  cropOptions?: { value: MediaCropV2; label: string }[];
  /** Texte alternatif par média (Publication#8, Story#20). */
  showAlt?: boolean;
  /** Couverture (premier média) choisissable parmi les médias. */
  showCoverChoice?: boolean;
  /** Durée d'une vidéo lue (story : validation ≤ 60 s). */
  onVideoDuration?: (durationMs: number) => void;
  className?: string;
  /** Libellé du bouton d'ajout (défaut : « Ajouter une photo »). */
  addLabel?: string;
  /**
   * Fichiers fournis par un autre chemin que le sélecteur (caméra directe de la
   * story, capture Capacitor) : traités dès que `nonce` change.
   */
  spawnFiles?: { files: File[]; nonce: number } | null;
}

/**
 * Médias V2 (`Publication#5-8`, `Carnet#2-3`, `03 § 7`) : sélection avec refus
 * immédiat, progression et réessai, réordonnancement au doigt (poignée ⋮⋮),
 * suppression 44 px, recadrage réel (4:5 / 1:1 / original, 9:16 pour la story),
 * texte alternatif et choix de la couverture. Aucun `blob:` n'entre dans un
 * brouillon (seuls les médias déjà téléversés survivent).
 */
export function MediaFieldV2({
  name,
  label,
  userId,
  limits,
  max,
  hint,
  bucket = 'carnet-media',
  cropOptions = CROP_OPTIONS,
  showAlt = true,
  showCoverChoice = false,
  onVideoDuration,
  className,
  addLabel,
  spawnFiles = null,
}: MediaFieldV2Props) {
  const form = useFormContext();
  const { haptic } = useHapticFeedback();
  const raw = form.watch(name) as MediaItemV2[] | undefined;
  const items = Array.isArray(raw) ? raw : [];
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef(new Map<string, File>());
  const urlsRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const urls = urlsRef.current;
    return () => {
      mountedRef.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.length = 0;
    };
  }, []);

  const setItems = useCallback(
    (next: MediaItemV2[]) => {
      form.setValue(name, next, { shouldDirty: true, shouldValidate: true });
    },
    [form, name],
  );

  const patchItem = useCallback(
    (id: string, patch: Partial<MediaItemV2>) => {
      const current = (form.getValues(name) as MediaItemV2[] | undefined) ?? [];
      setItems(current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [form, name, setItems],
  );

  const uploadOne = useCallback(
    async (item: MediaItemV2, file: File, crop: MediaCropV2) => {
      try {
        patchItem(item.id, { status: 'uploading', progress: 4, error: undefined, crop });
        const prepared = file.type.startsWith('video/')
          ? file
          : await cropImageToRatio(file, crop);
        patchItem(item.id, { progress: 14 });
        const uploaded = await uploadMediaV2(prepared, {
          userId,
          bucket,
          storyId: item.id,
          onProgress: (percent) => {
            if (!mountedRef.current) return;
            patchItem(item.id, { progress: Math.max(14, percent) });
          },
        });
        if (!mountedRef.current) return;
        patchItem(item.id, {
          status: 'uploaded',
          progress: 100,
          url: uploaded.url,
          storageBucket: uploaded.bucket,
          storagePath: uploaded.path,
          size: prepared.size,
          type: prepared.type || item.type,
        });
      } catch (error) {
        if (!mountedRef.current) return;
        patchItem(item.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Envoi du média impossible.',
        });
      } finally {
        if (mountedRef.current) setUploading((value) => Math.max(0, value - 1));
      }
    },
    [bucket, patchItem, userId],
  );

  const onFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const current = (form.getValues(name) as MediaItemV2[] | undefined) ?? [];
      const room = max - current.length;
      if (room <= 0) {
        setNotice(`Tu peux ajouter ${max} média${max > 1 ? 's' : ''} maximum.`);
        return;
      }
      const accepted: MediaItemV2[] = [];
      const nextFiles: File[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        const validation = validateMediaFile(file, limits);
        if (!validation.ok) {
          setNotice(validation.message ?? 'Média refusé.');
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        urlsRef.current.push(previewUrl);
        const item = createMediaItemV2({
          name: file.name,
          type: file.type,
          size: file.size,
          previewUrl,
          status: 'uploading',
          progress: 2,
          crop: cropOptions[0]?.value ?? 'original',
          cover: showCoverChoice && current.length === 0 && accepted.length === 0,
        });
        accepted.push(item);
        nextFiles.push(file);
        filesRef.current.set(item.id, file);
        if (file.type.startsWith('video/')) {
          const probe = document.createElement('video');
          probe.preload = 'metadata';
          probe.src = previewUrl;
          probe.onloadedmetadata = () => {
            if (Number.isFinite(probe.duration)) onVideoDuration?.(Math.round(probe.duration * 1000));
            probe.removeAttribute('src');
          };
        }
      }
      if (accepted.length === 0) return;
      setNotice(null);
      haptic('light');
      const next = [...current, ...accepted];
      setItems(next);
      setUploading((value) => value + accepted.length);
      accepted.forEach((item, index) => {
        const file = nextFiles[index];
        if (file) void uploadOne(item, file, item.crop);
      });
    },
    [cropOptions, form, haptic, limits, max, name, onVideoDuration, setItems, showCoverChoice, uploadOne],
  );

  // Fichiers venus de la caméra directe (ou d'une capture native).
  const handledSpawnNonce = useRef(-1);
  useEffect(() => {
    if (!spawnFiles || spawnFiles.nonce === handledSpawnNonce.current) return;
    handledSpawnNonce.current = spawnFiles.nonce;
    if (spawnFiles.files.length === 0) return;
    onFiles(spawnFiles.files);
  }, [onFiles, spawnFiles]);

  const retry = useCallback(
    (item: MediaItemV2) => {
      const file = filesRef.current.get(item.id);
      if (!file) {
        setNotice('Ce média n’est plus disponible : retire-le et choisis-le à nouveau.');
        return;
      }
      setUploading((value) => value + 1);
      void uploadOne(item, file, item.crop);
    },
    [uploadOne],
  );

  const changeCrop = useCallback(
    (item: MediaItemV2, crop: MediaCropV2) => {
      const file = filesRef.current.get(item.id);
      if (item.status === 'uploaded' && file) {
        const previous = item.storagePath
          ? [{ bucket: item.storageBucket as MediaBucketV2, path: item.storagePath }]
          : [];
        setUploading((value) => value + 1);
        void uploadOne(item, file, crop).then(() => {
          void deleteMediaObjectsV2(previous);
        });
        return;
      }
      patchItem(item.id, { crop });
    },
    [patchItem, uploadOne],
  );

  const remove = useCallback(
    (item: MediaItemV2) => {
      const current = (form.getValues(name) as MediaItemV2[] | undefined) ?? [];
      setItems(current.filter((entry) => entry.id !== item.id));
      filesRef.current.delete(item.id);
      if (item.storagePath) {
        void deleteMediaObjectsV2([{ bucket: item.storageBucket as MediaBucketV2, path: item.storagePath }]);
      }
      if (selectedId === item.id) setSelectedId(null);
      haptic('selection');
    },
    [form, haptic, name, selectedId, setItems],
  );

  // Réordonnancement au doigt : la tuile suit le doigt, l'ordre est réécrit au vol.
  useEffect(() => {
    if (!dragId) return;
    const onMove = (event: PointerEvent) => {
      const target = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((element) => element instanceof HTMLElement && element.closest('[data-media-id]')) as
        | HTMLElement
        | null;
      const holder = target?.closest<HTMLElement>('[data-media-id]');
      const overId = holder?.dataset.mediaId;
      if (!overId || overId === dragId) return;
      const current = (form.getValues(name) as MediaItemV2[] | undefined) ?? [];
      const from = current.findIndex((item) => item.id === dragId);
      const to = current.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0) return;
      setItems(moveItem(current, from, to));
      haptic('selection');
    };
    const onUp = () => setDragId(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragId, form, haptic, name, setItems]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const progress = items.length
    ? Math.round(
        items.reduce((total, item) => total + (item.status === 'uploaded' ? 100 : item.progress), 0) /
          items.length,
      )
    : 100;

  return (
    <FieldV2 name={name} label={label} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="lkdv-cv2c-media">
          <div className="lkdv-cv2c-media-head">
            <span className="lkdv-cv2-field-hint">
              {items.length} / {max}
            </span>
            {uploading > 0 ? (
              <span className="lkdv-cv2-field-hint" aria-live="polite">
                Envoi… {progress} %
              </span>
            ) : null}
          </div>
          {items.length > 0 ? (
            <div className="lkdv-cv2-media-grid lkdv-cv2c-media-grid" data-hscroll aria-describedby={describedBy}>
              {items.map((item) => (
                <figure
                  key={item.id}
                  className={`lkdv-cv2-media-item${item.cover && showCoverChoice ? ' is-cover' : ''}`}
                  data-media-id={item.id}
                >
                  {item.previewUrl || item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL Storage
                    <img src={item.previewUrl || item.url} alt={item.alt || ''} draggable={false} />
                  ) : (
                    <span className="lkdv-cv2c-media-empty" aria-hidden="true">
                      {item.type.startsWith('video/') ? 'Vidéo' : 'Photo'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="lkdv-cv2-media-handle"
                    aria-label={`Déplacer ${item.name || 'le média'}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setDragId(item.id);
                      haptic('medium');
                    }}
                    data-dragging={dragId === item.id ? 'true' : undefined}
                  >
                    <GripVertical aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="lkdv-cv2-media-remove"
                    aria-label={`Supprimer ${item.name || 'le média'}`}
                    onClick={() => remove(item)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                  {item.status === 'uploading' ? (
                    <span className="lkdv-cv2-media-progress" aria-hidden="true">
                      <i style={{ width: `${Math.max(3, item.progress)}%` }} />
                    </span>
                  ) : null}
                  {item.status === 'error' ? (
                    <button
                      type="button"
                      className="lkdv-cv2c-media-error"
                      onClick={() => retry(item)}
                      aria-label={`Réessayer l’envoi de ${item.name || 'ce média'}`}
                    >
                      Réessayer
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="lkdv-cv2c-media-open"
                    aria-label={`Modifier ${item.name || 'ce média'}`}
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  />
                  {item.cover && showCoverChoice ? (
                    <span className="lkdv-cv2c-media-cover" aria-hidden="true">
                      <Star size={11} /> Couverture
                    </span>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : null}

          {selected ? (
            <div className="lkdv-cv2c-media-edit">
              <div className="lkdv-cv2c-media-edit-head">
                <b>Réglages du média</b>
                <button
                  type="button"
                  className="lkdv-cv2c-icon-btn"
                  aria-label="Fermer les réglages du média"
                  onClick={() => setSelectedId(null)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              {!selected.type.startsWith('video/') && cropOptions.length > 0 ? (
                <div className="lkdv-cv2c-crop-row">
                  <span className="lkdv-cv2-field-label">Recadrage</span>
                  <div className="lkdv-cv2-seg lkdv-cv2c-seg" role="group" aria-label="Recadrage du média">
                    {cropOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected.crop === option.value}
                        onClick={() => changeCrop(selected, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={`lkdv-cv2-crop lkdv-cv2c-crop-preview lkdv-cv2-crop--${selected.crop === '1:1' ? 'square' : selected.crop === '9:16' ? 'story' : 'wide'}`}>
                {selected.previewUrl || selected.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL Storage
                  <img src={selected.previewUrl || selected.url} alt="" />
                ) : null}
                <svg className="lkdv-cv2-crop-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="33.33" y1="0" x2="33.33" y2="100" />
                  <line x1="66.66" y1="0" x2="66.66" y2="100" />
                  <line x1="0" y1="33.33" x2="100" y2="33.33" />
                  <line x1="0" y1="66.66" x2="100" y2="66.66" />
                </svg>
              </div>
              {showAlt ? (
                <div className="lkdv-cv2-field">
                  <label className="lkdv-cv2-field-label" htmlFor={`cv2c-alt-${selected.id}`}>
                    Texte de l’image
                  </label>
                  <input
                    id={`cv2c-alt-${selected.id}`}
                    type="text"
                    maxLength={200}
                    className="lkdv-cv2-input"
                    value={selected.alt}
                    placeholder="Décris cette image…"
                    onChange={(event) => {
                      const current = (form.getValues(name) as MediaItemV2[] | undefined) ?? [];
                      setItems(current.map((entry) => (entry.id === selected.id ? { ...entry, alt: event.target.value } : entry)));
                    }}
                  />
                  {!selected.alt.trim() ? (
                    <p className="lkdv-cv2-field-hint">Un texte alternatif aide les personnes malvoyantes.</p>
                  ) : null}
                </div>
              ) : null}
              {showCoverChoice ? (
                <button
                  type="button"
                  className="lkdv-cv2-chip lkdv-cv2-chip--lg"
                  aria-pressed={selected.cover}
                  onClick={() => {
                    const current = (form.getValues(name) as MediaItemV2[] | undefined) ?? [];
                    setItems(current.map((entry) => ({ ...entry, cover: entry.id === selected.id })));
                    haptic('selection');
                  }}
                >
                  <Star size={14} aria-hidden="true" />
                  {selected.cover ? 'Couverture du carnet' : 'Choisir comme couverture'}
                </button>
              ) : null}
            </div>
          ) : null}

          {items.length < max ? (
            <>
              <input
                ref={inputRef}
                id={id}
                type="file"
                accept={limits.allowVideo ? 'image/*,video/mp4,video/quicktime,video/webm' : 'image/*'}
                multiple={max > 1}
                className="lkdv-cv2c-sr-only"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                onChange={(event) => {
                  onFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                className="lkdv-cv2c-add-media"
                onClick={() => inputRef.current?.click()}
              >
                {uploading > 0 ? (
                  <Loader2 size={16} className="lkdv-cv2c-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus size={16} aria-hidden="true" />
                )}
                {addLabel ?? (limits.allowVideo ? 'Ajouter une photo ou une vidéo' : 'Ajouter une photo')}
              </button>
            </>
          ) : null}
          {notice ? (
            <p className="lkdv-cv2-field-error" role="alert">
              {notice}
            </p>
          ) : null}
        </div>
      )}
    </FieldV2>
  );
}

export default MediaFieldV2;
