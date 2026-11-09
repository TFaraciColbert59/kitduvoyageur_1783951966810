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
      if (value.type === 'photo' || value.type === 'video') {
        if (!file) return { ok: false, error: 'Ajoute un fichier.' };
        const expected = value.type === 'photo' ? 'image/' : 'video/';
        if (!file.type.startsWith(expected)) {
          return { ok: false, error: value.type === 'photo' ? 'Choisis une image.' : 'Choisis une vidéo.' };
        }
        if (file.size > MAX_MEDIA_BYTES) return { ok: false, error: 'Le fichier dépasse 25 Mo.' };
        const prepared = value.type === 'photo' ? await stripImageMetadata(file) : file;
        const ext = prepared.type === 'image/png' ? 'png' : value.type === 'video' ? 'mp4' : 'jpg';
        const path = `carnet-moments/${userId}/${carnetId}/${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from('carnet-media').upload(path, prepared, {
          contentType: prepared.type || undefined,
          upsert: false,
        });
        if (upload.error) return { ok: false, error: 'Le fichier n’a pas pu être envoyé.' };
        imageUrl = supabase.storage.from('carnet-media').getPublicUrl(path).data.publicUrl;
      }

      const row = momentInsertRow(value, {
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
