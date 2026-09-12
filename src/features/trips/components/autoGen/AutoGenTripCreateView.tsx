'use client';

import React, { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AutoGenTripView } from './AutoGenTripView';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';
import type { TripBrief } from '@/features/trips/schemas/autoGen.schema';
import { createTripFromAutogenIntent } from '@/features/trips/server/createTripFromAutogenIntent';
import { tripSectionHref } from '../../registry/tripSectionRegistry';
import { useActiveAdventure } from '@/features/hub/context/ActiveAdventureContext';

export interface AutoGenTripCreateViewProps {
  initialBriefInput?: string;
}

const MIN_BRIEF_LENGTH = 10;

/**
 * Message utilisateur stable par statut de la commande Phase 3 — jamais de
 * détail technique exposé à l'écran.
 */
function messageForStatus(status: number, retryAfterS?: number): string {
  switch (status) {
    case 400:
      return 'Le brief ou les propositions sont incomplets — complétez la phrase puis réessayez.';
    case 401:
      return 'Connectez-vous pour créer un voyage.';
    case 403:
      return 'Vous n’avez pas les droits nécessaires pour créer ce voyage.';
    case 409:
      return 'Une génération est déjà en cours — réessayez dans un instant.';
    case 429: {
      const delay = retryAfterS && retryAfterS > 0 ? ` (${Math.ceil(retryAfterS / 60)} min)` : '';
      return `Quota de génération atteint${delay} — réessayez plus tard.`;
    }
    case 503:
      return 'Le service de génération est momentanément indisponible — réessayez plus tard.';
    default:
      return 'La création du voyage a échoué — réessayez.';
  }
}

/**
 * Mode « Génération IA » du hub — brief → pipeline déterministe 12 couches →
 * commande serveur canonique `createTripFromAutogenIntent` : le voyage réel est
 * créé avec son plan Adventure, son parcours réel navigable (si géométrie BDD
 * valide), son kit, son budget prévisionnel et sa checklist, puis l'utilisateur
 * est redirigé vers l'aperçu RÉEL du voyage (aucun écran parallèle).
 */
export function AutoGenTripCreateView({ initialBriefInput = '' }: AutoGenTripCreateViewProps) {
  const router = useRouter();
  const { setActiveAdventure } = useActiveAdventure();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Idempotence : la même clé/corrélation est conservée tant qu'aucun voyage
  // n'a été créé — une reprise après interruption rejoue la même chaîne.
  const idempotencyKeyRef = useRef<string | null>(null);
  const correlationIdRef = useRef<string | null>(null);

  const handleComplete = async (tripData: {
    layers: Record<string, Proposal<any>>;
    brief?: TripBrief | null;
  }) => {
    setError(null);

    const rawInput = (tripData.brief?.rawInput ?? '').trim() || initialBriefInput.trim();
    if (rawInput.length < MIN_BRIEF_LENGTH) {
      setError('Décrivez votre voyage en une phrase (10 caractères minimum) puis régénérez.');
      return;
    }

    setIsSaving(true);
    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      if (!correlationIdRef.current) {
        correlationIdRef.current = crypto.randomUUID();
      }

      const res = await createTripFromAutogenIntent({
        rawInput,
        brief: tripData.brief ?? null,
        layers: tripData.layers,
        correlationId: correlationIdRef.current,
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (res.ok) {
        // Le voyage créé devient l'aventure active du Hub, puis redirection
        // vers l'aperçu réel — jamais un écran de succès parallèle.
        await setActiveAdventure({
          nature: 'sortie',
          id: res.slug,
          slug: res.slug,
          title: res.title,
        });
        startTransition(() => {
          router.push(tripSectionHref(res.slug, 'overview'));
          router.refresh();
        });
        return;
      }

      setError(messageForStatus(res.status, res.retryAfterS));
      setIsSaving(false);
    } catch (err) {
      console.error('[LKDV autogen] création du voyage en échec:', err);
      setError('La création du voyage a échoué — réessayez.');
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      {error && (
        <p
          role="alert"
          className="mx-4 mt-2 p-3 rounded-xl glass tone-danger border text-[var(--lkv-danger)] text-xs font-semibold"
        >
          {error}
        </p>
      )}
      <AutoGenTripView initialBriefInput={initialBriefInput} onCompleteTrip={handleComplete} />
      {isSaving && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="glass p-6 rounded-[var(--lkv-radius-card)] flex items-center gap-3">
            <span className="w-6 h-6 rounded-full border-2 border-[var(--lkv-primary)] border-t-transparent animate-spin" />
            <span className="text-sm font-semibold text-[var(--lkv-text-primary)]">
              Création du voyage…
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutoGenTripCreateView;
