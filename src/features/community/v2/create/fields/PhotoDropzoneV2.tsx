'use client';

import React, { useCallback, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';

export interface ExtractedPhotoMeta {
  takenAt?: Date;
  latitude?: number;
  longitude?: number;
}

export interface PhotoDropzoneResult {
  file: File;
  meta: ExtractedPhotoMeta;
}

export interface PhotoDropzoneV2Props {
  label?: string;
  hint?: string;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  onFilesReady: (results: PhotoDropzoneResult[]) => void | Promise<void>;
}

async function readPhotoMeta(file: File): Promise<ExtractedPhotoMeta> {
  try {
    const parsed = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude']);
    if (!parsed) return {};
    const rawDate = parsed.DateTimeOriginal ?? parsed.CreateDate;
    const takenAt = rawDate instanceof Date && !Number.isNaN(rawDate.getTime()) ? rawDate : undefined;
    const latitude = typeof parsed.latitude === 'number' && Number.isFinite(parsed.latitude) ? parsed.latitude : undefined;
    const longitude = typeof parsed.longitude === 'number' && Number.isFinite(parsed.longitude) ? parsed.longitude : undefined;
    return { takenAt, latitude, longitude };
  } catch {
    return {};
  }
}

async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 350_000) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB: 1.4,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
    });
  } catch {
    return file;
  }
}

/**
 * Zone de dépôt photo tactile (`react-dropzone`) avec compression client
 * (`browser-image-compression`) et lecture EXIF (`exifr`) avant envoi.
 */
export function PhotoDropzoneV2({
  label = 'Déposer ou choisir des photos',
  hint = 'JPG, PNG, WebP · Compression auto & lecture date/GPS',
  multiple = true,
  maxFiles = 10,
  disabled = false,
  onFilesReady,
}: PhotoDropzoneV2Props) {
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      setBusy(true);
      try {
        const results: PhotoDropzoneResult[] = [];
        for (const raw of accepted.slice(0, maxFiles)) {
          const [meta, file] = await Promise.all([readPhotoMeta(raw), compressPhoto(raw)]);
          results.push({ file, meta });
        }
        await onFilesReady(results);
      } finally {
        setBusy(false);
      }
    },
    [maxFiles, onFilesReady],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    multiple,
    maxFiles,
    disabled: disabled || busy,
  });

  return (
    <div
      {...getRootProps()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 92,
        padding: '14px 16px',
        borderRadius: 18,
        border: isDragActive ? '1.5px solid var(--lkv-secondary)' : '1.5px dashed var(--cv2-field-border)',
        background: isDragActive ? 'var(--lkv-secondary-subtle)' : 'var(--cv2-field-bg)',
        textAlign: 'center',
        cursor: disabled || busy ? 'wait' : 'pointer',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <input {...getInputProps()} aria-label={label} />
      {busy ? <Loader2 size={20} className="lkdv-cv2c-spin" aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
      <strong style={{ font: '600 13px/1.25 var(--font-sans)', color: 'var(--lkv-text-primary)' }}>{label}</strong>
      <span style={{ font: '400 11px/1.3 var(--font-sans)', color: 'var(--lkv-text-secondary)' }}>{hint}</span>
    </div>
  );
}
