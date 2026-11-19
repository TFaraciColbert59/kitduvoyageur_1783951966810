'use client';

import React, { useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { createMediaItemV2, type ClubFormValuesV2 } from '../engine/createSchemasV2';
import {
  cropImageToRatio,
  IMAGE_LIMITS,
  uploadMediaV2,
  validateMediaFile,
} from '../fields/media';
import { toast } from 'sonner';
import './ClubHeroEditorV2.css';

/**
 * ClubHeroEditorV2 — réplique fidèle de la carte principale du haut de la page
 * Club (`ClubLiquidGlassV8` / `/clubs/sentiers-pour-tous`), avec emblème, nom,
 * ancrage et description directement modifiables au clic.
 */
export function ClubHeroEditorV2({ user }: { user: User | null }) {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const locInputRef = useRef<HTMLInputElement | null>(null);
  const descInputRef = useRef<HTMLInputElement | null>(null);
  const [optimisticAvatar, setOptimisticAvatar] = useState<string | null>(null);

  const avatarUrl =
    optimisticAvatar ?? values.avatar[0]?.previewUrl ?? values.avatar[0]?.url ?? '';
  const nameText = values.name.trim();

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateMediaFile(file, IMAGE_LIMITS);
    if (err) {
      toast.error(err.message);
      return;
    }
    const cropped = await cropImageToRatio(file, '1:1');
    const previewUrl = URL.createObjectURL(cropped);
    setOptimisticAvatar(previewUrl);
    const item = createMediaItemV2({
      name: cropped.name,
      type: cropped.type,
      size: cropped.size,
      previewUrl,
      status: user?.id ? 'uploading' : 'local',
      crop: '1:1',
    });
    form.setValue('avatar', [item], { shouldDirty: true, shouldValidate: true });
    if (!user?.id) return;
    try {
      const uploaded = await uploadMediaV2(cropped, {
        userId: user.id,
        bucket: 'carnet-media',
      });
      form.setValue(
        'avatar',
        [
          {
            ...item,
            url: uploaded.url,
            storageBucket: uploaded.bucket,
            storagePath: uploaded.path,
            status: 'uploaded',
            progress: 100,
          },
        ],
        { shouldDirty: true, shouldValidate: true },
      );
      toast.success('Emblème du club mis à jour');
    } catch {
      toast.error('Échec du téléversement de l’emblème');
    }
  };

  return (
    <div
      className="lkdv-cv2c-club-ig-editor"
      role="region"
      aria-label="En-tête du club"
    >
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleAvatarPick}
      />

      {/* Pilule sélecteur de nom du club en haut (identique à « Sentiers pour Tous ▾ ») */}
      <div className="lkdv-cv2c-club-top-bar">
        <div
          className="lkdv-cv2c-club-top-pill"
          onClick={() => nameInputRef.current?.focus()}
        >
          <input
            ref={nameInputRef}
            id="cv2c-name"
            type="text"
            className="lkdv-cv2c-club-top-name-input"
            value={values.name}
            maxLength={60}
            placeholder="Sentiers pour Tous"
            aria-label="Nom du club"
            size={Math.max(12, (values.name || 'Sentiers pour Tous').length)}
            onChange={(e) =>
              form.setValue('name', e.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <span className="lkdv-cv2c-club-top-chev" aria-hidden="true">
            ▾
          </span>
        </div>
      </div>

      <div className="lkdv-cv2c-club-card-inner">
        {/* 1. Header : Emblème carré arrondi 66x66 + Sceau + 3 stats */}
        <div className="lkdv-cv2c-club-ig-header">
          <button
            type="button"
            className="lkdv-cv2c-club-emblem-btn"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Choisir l’emblème du club"
          >
            <span className="lkdv-cv2c-club-emblem-inner">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- emblème club
                <img src={avatarUrl} alt={nameText || 'Emblème du club'} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- couverture par défaut
                <img
                  src="/assets/images/community-preview-meadow.svg"
                  alt=""
                />
              )}
            </span>
            <span className="lkdv-cv2c-club-seal" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
              </svg>
            </span>
          </button>

          <div className="lkdv-cv2c-club-stats" role="group" aria-label="Statistiques du club">
            <div className="lkdv-cv2c-club-stat">
              <b>0</b>
              <span>publications</span>
            </div>
            <div className="lkdv-cv2c-club-stat">
              <b>1</b>
              <span>membre</span>
            </div>
            <div className="lkdv-cv2c-club-stat">
              <b>0</b>
              <span>sorties</span>
            </div>
          </div>
        </div>

        {/* 2. Bio : Zone · 0 sorties · 0 km · 0 km D+ & Description éditables au clic */}
        <div className="lkdv-cv2c-club-bio">
          <div className="lkdv-cv2c-club-loc-row" onClick={() => locInputRef.current?.focus()}>
            <input
              ref={locInputRef}
              type="text"
              className="lkdv-cv2c-club-loc-input"
              value={values.locationLabel}
              maxLength={80}
              placeholder="Lyon"
              aria-label="Zone du club"
              size={Math.max(5, (values.locationLabel || 'Lyon').length)}
              onChange={(e) =>
                form.setValue('locationLabel', e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <span>· 0 sorties · 0 km · 0 km D+</span>
          </div>

          <input
            ref={descInputRef}
            type="text"
            className="lkdv-cv2c-club-desc-input"
            value={values.description}
            maxLength={1500}
            placeholder="Randonner quel que soit son corps : joëlette, fauteuil tout-terrain…"
            aria-label="Description du club"
            onChange={(e) =>
              form.setValue('description', e.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
