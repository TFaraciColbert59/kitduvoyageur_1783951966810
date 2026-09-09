import { PointsEauBlock, PointsPassageBlock, CtaRandonneeBlock, MeteoBlock, ParcoursBlock } from './HikingBlocks';
import { ReservationsBlock } from './TravelBlocks';
import { TripMetricsBlock } from './TripMetricsBlock';
import { SettlementsBlock } from './SettlementsBlock';
import { JournalApercuBlock } from './JournalApercuBlock';
import GroupeBloc from './GroupeBloc';
import type { WidgetCatalogDef } from '../../registry/widgetCatalog';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { HubCrewBlock, HubHikingContext } from '../../server/getHubAdventureData';

/**
 * H-ACT §5 — Rendu des blocs d'aperçu sélectionnés par le catalogue central.
 * Chaque bloc est un composant serveur (liens uniquement, zéro état client).
 */

export interface OverviewBlocksProps {
  blocks: WidgetCatalogDef[];
  trip: TripFull;
  group: HubCrewBlock | null;
  hiking: HubHikingContext | null;
  /** Stats serveur (budget réel) — requises par le bloc métriques. */
  stats?: TripStats;
}

export function OverviewBlocks({ blocks, trip, group, hiking, stats }: OverviewBlocksProps) {
  const slug = trip.slug;
  return (
    <>
      {blocks.map((block) => {
        switch (block.id) {
          case 'cta-randonnee-active':
            return <CtaRandonneeBlock key={block.id} hiking={hiking} slug={slug} />;
          case 'parcours-apercu':
            return <ParcoursBlock key={block.id} hiking={hiking} slug={slug} />;
          case 'meteo-rando':
            return <MeteoBlock key={block.id} hiking={hiking} />;
          case 'points-passage':
            return <PointsPassageBlock key={block.id} pois={trip.pois ?? []} slug={slug} />;
          case 'points-eau':
            return <PointsEauBlock key={block.id} count={hiking?.waterPointsCount ?? 0} />;
          case 'reservations':
            return (
              <ReservationsBlock
                key={block.id}
                steps={trip.steps ?? []}
                documentsCount={trip.documents?.length ?? 0}
                slug={slug}
              />
            );
          case 'metriques-voyage':
            return stats ? (
              <TripMetricsBlock key={block.id} trip={trip} stats={stats} slug={slug} />
            ) : null;
          case 'dettes-groupe':
            return <SettlementsBlock key={block.id} trip={trip} slug={slug} />;
          case 'journal-apercu':
            return <JournalApercuBlock key={block.id} trip={trip} slug={slug} />;
          case 'groupe-bloc':
            return <GroupeBloc key={block.id} trip={trip} group={group} />;
          default:
            return null;
        }
      })}
    </>
  );
}
