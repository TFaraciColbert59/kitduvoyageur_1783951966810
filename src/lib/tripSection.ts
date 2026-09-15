import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug } from '@/lib/queries-trips';
import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';
import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * Y2 — Charge le voyage pour une page de section du hub (après le layout,
 * qui a déjà validé l'accès : les pages rechargent pour passer le TripFull
 * en props des vues clientes). notFound si inaccessible.
 *
 * P2 (C-18/C-20) — déduplication par requête : si le slug demandé est celui
 * de l'aventure active déjà chargée par le layout (React cache partagé), le
 * TripFull est réutilisé en mémoire — un seul chargement des tables filles
 * par rendu, au lieu de deux. Slug hors aventure active (surfaces
 * historiques) : chemin de chargement original, inchangé.
 */
export const loadTripSection = cache(async (slug: string): Promise<TripFull> => {
  const data = await getHubAdventureData();
  if (data.trip?.slug === slug) return data.trip;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const trip = await getTripBySlug(slug, user?.id);
  if (!trip) notFound();
  return trip;
});
