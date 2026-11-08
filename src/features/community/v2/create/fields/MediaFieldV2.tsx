'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, ImagePlus, Loader2, Trash2 } from 'lucide-react';
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
  /** Champ obligatoire : affiche « * » et `aria-required` (maquette `.fl i *`). */
  required?: boolean;
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
   * Masque le bouton d'ajout : le choix du fichier passe par un autre contrôle
   * (les deux pilules Galerie / Caméra de la story, maquette L2890).
   */
  hideAdd?: boolean;
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
  required = false,
  bucket = 'carnet-media',
  cropOptions = CROP_OPTIONS,
  showAlt = true,
  showCoverChoice = false,
  onVideoDuration,
  className,
  addLabel,
  hideAdd = false,
  spawnFiles = null,
}: MediaFieldV2Props) {
  const form = useFormContext();
  const { haptic } = useHapticFeedback();
  const raw = form.watch(name) as MediaItemV2[] | undefined;
  const items = Array.isArray(raw) ? raw : [];
  const [notice, setNotice] = useState<string | null>(null);
  const [altOpenId, setAltOpenId] = useState<string | null>(null);
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
      let base = current;
      if (max === 1 && current.length === 1) {
        // Un seul média : choisir à nouveau remplace l'ancien (pas de blocage).
        const previous = current[0];
        if (previous.storagePath) {
          void deleteMediaObjectsV2([
            { bucket: previous.storageBucket as MediaBucketV2, path: previous.storagePath },
          ]);
        }
        filesRef.current.delete(previous.id);
        base = [];
        setItems(base);
      }
      const room = max - base.length;
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
          cover: showCoverChoice && base.length === 0 && accepted.length === 0,
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
      const next = [...base, ...accepted];
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
      if (altOpenId === item.id) setAltOpenId(null);
      haptic('selection');
    },
    [altOpenId, form, haptic, name, setItems],
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

  const progress = items.length
    ? Math.round(
        items.reduce((total, item) => total + (item.status === 'uploaded' ? 100 : item.progress), 0) /
          items.length,
      )
    : 100;

  return (
    <FieldV2
      name={name}
      label={label}
      hint={hint}
      className={className}
      required={required}
      /* Compteur de la maquette pour les listes (« 1 / 10 », HTML L2821) ;
         inutile pour un média unique (avatar, bannière, couverture). */
      counter={max > 1 ? { value: items.length, max } : null}
    >
      {({ id, describedBy, invalid }) => (
        <div className="lkdv-cv2c-media">
          {items.length > 0 ? (
            <ul className="lkdv-cv2c-medialist" data-hscroll aria-describedby={describedBy}>
              {items.map((item, index) => {
                const video = item.type.startsWith('video/');
                const altOpen = altOpenId === item.id;
                return (
                  <li
                    key={item.id}
                    className="lkdv-cv2c-medialist-row"
                    data-media-id={item.id}
                    data-status={item.status}
                  >
                    <button
                      type="button"
                      className="lkdv-cv2c-medialist-grip"
                      aria-label={`Déplacer le média ${index + 1}. Flèches haut et bas pour réordonner.`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        setDragId(item.id);
                        haptic('medium');
                      }}
                      data-dragging={dragId === item.id ? 'true' : undefined}
                    >
                      <GripVertical size={15} aria-hidden="true" />
                    </button>
                    <span className="lkdv-cv2c-medialist-thumb">
                      {item.previewUrl || item.url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL Storage
                        <img src={item.previewUrl || item.url} alt="" draggable={false} />
                      ) : (
                        <span className="lkdv-cv2c-media-empty" aria-hidden="true">
                          {video ? 'Vidéo' : 'Photo'}
                        </span>
                      )}
                      {index === 0 && showCoverChoice ? (
                        <em className="lkdv-cv2c-medialist-cover">Couverture</em>
                      ) : null}
                      {item.status === 'uploading' ? (
                        <i
                          className="lkdv-cv2c-medialist-progress"
                          style={{ width: `${Math.max(4, item.progress)}%` }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span className="lkdv-cv2c-medialist-info">
                      <b>Média {index + 1}</b>
                      <small>
                        {item.status === 'uploaded'
                          ? 'Envoyé'
                          : item.status === 'error'
                            ? 'Échec de l’envoi'
                            : `Envoi ${Math.max(0, Math.min(100, item.progress))} %`}
                      </small>
                      <span className="lkdv-cv2c-medialist-actions">
                        {item.status === 'error' ? (
                          <button type="button" className="lkdv-cv2c-linkbtn" onClick={() => retry(item)}>
                            Réessayer
                          </button>
                        ) : null}
                        {showAlt ? (
                          <button
                            type="button"
                            className="lkdv-cv2c-linkbtn"
                            aria-expanded={altOpen}
                            aria-controls={`cv2c-alt-${item.id}`}
                            onClick={() => setAltOpenId(altOpen ? null : item.id)}
                          >
                            {item.alt ? 'Texte alternatif ✓' : 'Décrire l’image'}
                          </button>
                        ) : null}
                        {showCoverChoice ? (
                          <button
                            type="button"
                            className="lkdv-cv2c-linkbtn"
                            aria-pressed={item.cover}
                            onClick={() => {
                              const current = (form.getValues(name) as MediaItemV2[] | undefined) ?? [];
                              setItems(
                                current.map((entry) => ({ ...entry, cover: entry.id === item.id })),
                              );
                              haptic('selection');
                            }}
                          >
                            {item.cover ? 'Couverture ✓' : 'Choisir comme couverture'}
                          </button>
                        ) : null}
                      </span>
                      {!video && cropOptions.length > 1 ? (
                        <span
                          className="lkdv-cv2c-medialist-crop"
                          role="group"
                          aria-label={`Recadrage du média ${index + 1}`}
                        >
                          {cropOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={item.crop === option.value}
                              onClick={() => changeCrop(item, option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="lkdv-cv2c-medialist-del"
                      aria-label={`Supprimer le média ${index + 1}`}
                      onClick={() => remove(item)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                    {altOpen ? (
                      <span className="lkdv-cv2c-medialist-alt">
                        <label className="lkdv-cv2-field-label" htmlFor={`cv2c-alt-${item.id}`}>
                          Texte alternatif
                        </label>
                        <input
                          id={`cv2c-alt-${item.id}`}
                          type="text"
                          maxLength={200}
                          className="lkdv-cv2-input"
                          value={item.alt}
                          placeholder="Décris cette image…"
                          onChange={(event) => patchItem(item.id, { alt: event.target.value })}
                        />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

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
          {!hideAdd && items.length < max ? (
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
          ) : null}
          {uploading > 0 ? (
            <p className="lkdv-cv2-field-hint" aria-live="polite">
              Envoi des médias… {progress} %
            </p>
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
