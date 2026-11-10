'use client';

import { useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import {
  momentInsertRow,
  momentItemFromRow,
  validateMomentInput,
  type MomentInput,
} from './createMoment';
import type { CarnetMomentItem } from './types';

/** 25 Mo : au-delà, le téléversement est refusé avant tout appel réseau. */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;


export type MediaKind = 'photo' | 'video' | 'voice';

/** Seau de stockage : les images restent dans `carnet-media`, vidéo et voix ont le leur. */
export function bucketFor(type: MediaKind): 'carnet-media' | 'carnet-moments-media' {
  return type === 'photo' ? 'carnet-media' : 'carnet-moments-media';
}

export function extensionOf(type: MediaKind, mime: string): string {
  if (type === 'photo') return mime === 'image/png' ? 'png' : 'jpg';
  if (type === 'video') return mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4';
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Vérifie le fichier avant tout appel réseau (type, présence, taille). */
export function mediaPlan(
  type: MediaKind,
  file: File | null
): { ok: true; file: File } | { ok: false; error: string } {
  if (!file) {
    return { ok: false, error: type === 'voice' ? 'Enregistre ta note vocale.' : 'Ajoute un fichier.' };
  }
  const expected = type === 'photo' ? 'image/' : type === 'video' ? 'video/' : 'audio/';
  if (!file.type.startsWith(expected)) {
    return {
      ok: false,
      error: type === 'photo' ? 'Choisis une image.' : type === 'video' ? 'Choisis une vidéo.' : 'Enregistrement invalide.',
    };
  }
  /* `carnet-media` plafonne les images à 10 Mo (migration 20261021093000). */
  const max = type === 'photo' ? MAX_PHOTO_BYTES : MAX_MEDIA_BYTES;
  if (file.size > max) return { ok: false, error: `Le fichier dépasse ${max / (1024 * 1024)} Mo.` };
  return { ok: true, file };
}

export interface UseCarnetEditsOptions {
  carnetId: string;
  userId: string | null;
  authorName: string | null;
  onIsland?: (message: string, undo?: () => void, subtitle?: string) => void;
  onMomentAdded: (moment: CarnetMomentItem) => void;
  onMomentRemoved: (momentId: string) => void;
}

export type CreateMomentResult = { ok: true; moment: CarnetMomentItem } | { ok: false; error: string };

/**
 * Écritures du mode modification. Le droit d'écrire est celui de la base
 * (`carnet_moments_participant_manage`, RLS) : le client ne s'arroge rien, il
 * valide l'entrée (zod), écrit, puis propose d'annuler par l'île.
 */
export function useCarnetEdits({
  carnetId,
  userId,
  authorName,
  onIsland,
  onMomentAdded,
  onMomentRemoved,
}: UseCarnetEditsOptions) {
  const supabase = useMemo(() => createClient(), []);

  const removeMoment = useCallback(
    async (momentId: string): Promise<boolean> => {
      const { error } = await supabase
        .from('carnet_moments')
        .delete()
        .eq('id', momentId)
        .eq('carnet_id', carnetId);
      if (error) return false;
      onMomentRemoved(momentId);
      return true;
    },
    [carnetId, onMomentRemoved, supabase]
  );

  const createMoment = useCallback(
    async (input: unknown, file?: File | null): Promise<CreateMomentResult> => {
      if (!userId) return { ok: false, error: 'Connexion requise.' };
      const checked = validateMomentInput(input);
      if (!checked.ok) return checked;
      const value: MomentInput = checked.value;

      let imageUrl: string | null = null;
      let audioUrl: string | undefined;
      if (value.type === 'photo' || value.type === 'video' || value.type === 'voice') {
        const media = mediaPlan(value.type, file ?? null);
        if (!media.ok) return media;
        const prepared = value.type === 'photo' ? await stripImageMetadata(media.file) : media.file;
        const ext = extensionOf(value.type, prepared.type);
        /* Le premier segment du chemin est l'identifiant de la personne : c'est
           ce que vérifient les politiques de stockage (`carnet_media_insert_owner`
           et `carnet_moments_media_insert_owner`). */
        const path = `${userId}/carnet-moments/${carnetId}/${crypto.randomUUID()}.${ext}`;
        const bucket = bucketFor(value.type);
        const upload = await supabase.storage.from(bucket).upload(path, prepared, {
          contentType: prepared.type || undefined,
          upsert: false,
        });
        if (upload.error) return { ok: false, error: 'Le fichier n’a pas pu être envoyé.' };
        const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        if (value.type === 'voice') audioUrl = publicUrl;
        else imageUrl = publicUrl;
      }

      const finalValue: MomentInput =
        value.type === 'voice' && audioUrl ? { ...value, audioUrl } : value;
      const row = momentInsertRow(finalValue, {
        carnetId,
        userId,
        authorName,
        imageUrl,
        now: new Date(),
      });

      let result = await supabase.from('carnet_moments').insert(row).select('id').single();
      if (result.error?.code === '42703') {
        /* Migration 20261109100001 pas encore appliquée : le moment s'écrit
           sans son type (déduit à la relecture), jamais refusé pour autant. */
        const { moment_type: _type, moment_meta: _meta, ...legacy } = row;
        void _type;
        void _meta;
        result = await supabase.from('carnet_moments').insert(legacy).select('id').single();
      }
      if (result.error || !result.data) {
        return { ok: false, error: 'Le moment n’a pas pu être ajouté.' };
      }

      const id = String((result.data as { id: string }).id);
      const moment = momentItemFromRow(id, row);
      onMomentAdded(moment);
      onIsland?.(
        'Moment ajouté',
        () => {
          void removeMoment(id);
        },
        `${value.place} · J${value.day}`
      );
      return { ok: true, moment };
    },
    [authorName, carnetId, onIsland, onMomentAdded, removeMoment, supabase, userId]
  );

  return { createMoment, removeMoment };
}
