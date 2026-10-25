import { notFound } from 'next/navigation';
import { getTripBySlug } from '@/lib/queries-trips';
import { tripSectionRegistry, tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import { TripSwitchBootstrap } from '@/features/hub/components/TripSwitchBootstrap';

export const dynamic = 'force-dynamic';

/**
 * Étape 2 — Shim des anciennes sections /voyages/[slug]/<segment>. L'interface
 * vit désormais dans /hub/<segment> : l'aventure devient active et l'URL
 * bascule vers la section hub correspondante (team → groupe).
 */
export default async function LegacyTripSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  const trip = await getTripBySlug(slug);
  if (!trip) notFound();

  const tripDef = tripSectionRegistry.find((s) => s.segment === section && s.segment !== '');
  if (!tripDef) notFound();

  const target = tripSectionHref(trip.slug, tripDef.id);

  return (
    <TripSwitchBootstrap
      adventure={{ nature: 'sortie', id: trip.id, slug: trip.slug, title: trip.title }}
      target={target}
    />
  );
}
