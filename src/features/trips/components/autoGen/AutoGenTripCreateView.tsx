'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AutoGenTripView } from './AutoGenTripView';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';
import type { TripBrief } from '@/features/trips/schemas/autoGen.schema';
import { createTripAction } from '@/app/voyages/actions';
import { tripSectionHref } from '../../registry/tripSectionRegistry';
import { useActiveAdventure } from '@/features/hub/context/ActiveAdventureContext';

export interface AutoGenTripCreateViewProps {
  initialBriefInput?: string;
}

function cleanDestinationName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 2 ? name.slice(0, 150) : null;
}

/**
 * Mode "Génération IA" du hub — réintégration de la suite autoGen :
 * brief → pipeline déterministe 12 couches → propositions verrouillables,
 * puis CRÉATION RÉELLE du voyage (createTripAction), activation du cookie
 * d'aventure active et navigation vers l'aperçu du hub.
 */
export function AutoGenTripCreateView({ initialBriefInput = '' }: AutoGenTripCreateViewProps) {
  const router = useRouter();
  const { setActiveAdventure } = useActiveAdventure();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleComplete = async (tripData: {
    layers: Record<string, Proposal<any>>;
    brief?: TripBrief | null;
  }) => {
    setError(null);
    setIsSaving(true);
    try {
      const brief = tripData.brief;
      const dest = brief?.destinations?.value?.[0] ?? null;
      const days = brief?.duration?.value?.days ?? null;
      const destLabel = dest ? (dest.region || dest.country) : 'Aventure générée';
      const title =
        brief && days
          ? `${destLabel} — ${days} j`
          : destLabel;
      const input = {
        title,
        destination_name: dest ? destLabel : null,
        destination_country_code: dest?.country?.length === 2 ? dest.country.toUpperCase() : null,
        description: `Générée par le pipeline IA LKDV (blueprint déterministe).`,
      };
      const res = await createTripAction(input);
      if (res?.slug) {
        await setActiveAdventure({
          nature: 'sortie',
          id: res.slug,
          slug: res.slug,
          title,
        });
        startTransition(() => {
          router.push(tripSectionHref(res.slug, 'overview'));
          router.refresh();
        });
      } else {
        setError('La création du voyage a échoué — réessayez.');
        setIsSaving(false);
      }
    } catch {
      setError('La création du voyage a échoué — réessayez.');
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      {error && (
        <p role="alert" className="mx-4 mt-2 p-3 rounded-xl glass tone-danger border text-[var(--lkv-danger)] text-xs font-semibold">
          {error}
        </p>
      )}
      <AutoGenTripView initialBriefInput={initialBriefInput} onCompleteTrip={handleComplete} />
      {isSaving && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm" aria-live="polite">
          <div className="glass p-6 rounded-[var(--lkv-radius-card)] flex items-center gap-3">
            <span className="w-6 h-6 rounded-full border-2 border-[var(--lkv-primary)] border-t-transparent animate-spin" />
            <span className="text-sm font-semibold text-[var(--lkv-text-primary)]">Création du voyage…</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutoGenTripCreateView;
