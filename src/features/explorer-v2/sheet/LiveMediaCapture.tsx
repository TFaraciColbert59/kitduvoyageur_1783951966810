'use client';

import React, { useRef } from 'react';
import { XpEyebrow, XpRow, XpRows } from './blocks';
import type { SheetContext } from './context';

/**
 * K5.05 — Capture photo/vidéo pendant le suivi en direct sans interrompre
 * l'enregistrement GPS. Aucune position n'est inventée si le GPS est refusé.
 */
export function LiveMediaCapture({ ctx }: { ctx: SheetContext }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activity = ctx.state.activity;
  if (!activity) return null;

  const captured = activity.capturedMedia ?? [];

  const handleFile = (file: File) => {
    const canLocate = ctx.state.locationPermission === 'granted' && ctx.me !== null;
    const isVideo = file.type.startsWith('video/');
    const nowMs = Date.now();
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : null;

    ctx.state.addCapturedMedia({
      id: `live-${nowMs}`,
      label: file.name,
      kind: isVideo ? 'video' : 'photo',
      capturedAt: new Date(nowMs).toISOString(),
      elapsedSeconds: Math.max(0, Math.round((nowMs - activity.startedAt) / 1000)),
      lat: canLocate && ctx.me ? ctx.me.lat : null,
      lng: canLocate && ctx.me ? ctx.me.lng : null,
      previewUrl,
    });
  };

  return (
    <>
      <XpEyebrow>Journal photo en direct (K5.05)</XpEyebrow>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <XpRows>
        <XpRow
          icon="cam"
          title="Ajouter une photo ou vidéo sur le tracé"
          sub={
            captured.length > 0
              ? `${captured.length} média${captured.length > 1 ? 's' : ''} horodaté${captured.length > 1 ? 's' : ''} sur la séance`
              : 'Horodatage et géolocalisation auto si GPS autorisé (EXIF retirés au partage)'
          }
          badge={{ label: 'Capturer', tone: 'good' }}
          onClick={() => inputRef.current?.click()}
        />
        {captured.slice(0, 3).map((media) => (
          <XpRow
            key={media.id}
            icon={media.kind === 'video' ? 'video' : 'image'}
            title={media.label}
            sub={`+${Math.round(media.elapsedSeconds)} s${
              media.lat !== null && media.lat !== undefined
                ? ` · ${media.lat.toFixed(4)}, ${media.lng?.toFixed(4)}`
                : ' · sans coordonnées'
            }`}
          />
        ))}
      </XpRows>
    </>
  );
}
