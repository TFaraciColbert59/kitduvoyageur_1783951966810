import type { LkvEvent } from '../types';

export interface ActivityFeedItem {
  id: string;
  eventId: string;
  actorId: string;
  headline: string;
  badge: string;
  url: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export function handleActivityFeedEvent(event: LkvEvent): ActivityFeedItem | null {
  const meta = event.metadata || {};

  switch (event.event_type) {
    case 'trip.created':
      return {
        id: `act-${event.id}`,
        eventId: event.id,
        actorId: event.actor_id,
        headline: `a préparé une nouvelle expédition « ${meta.title || 'Voyage'} »`,
        badge: 'Nouvelle aventure',
        url: meta.slug ? `/voyages/${meta.slug}` : `/voyages`,
        timestamp: event.created_at,
        metadata: meta,
      };

    case 'trip.completed':
      return {
        id: `act-${event.id}`,
        eventId: event.id,
        actorId: event.actor_id,
        headline: `a terminé l’expédition « ${meta.tripTitle || 'Voyage'} » (${meta.totalKm || 0} km parcourus)`,
        badge: 'Expédition terminée',
        url: meta.slug ? `/voyages/${meta.slug}` : `/voyages`,
        timestamp: event.created_at,
        metadata: meta,
      };

    case 'crew.joined':
      return {
        id: `act-${event.id}`,
        eventId: event.id,
        actorId: event.actor_id,
        headline: `a rejoint l’équipage « ${meta.crewName || 'Équipage'} »`,
        badge: 'Équipage',
        url: event.crew_id ? `/groupes/${event.crew_id}` : '/groupes',
        timestamp: event.created_at,
        metadata: meta,
      };

    case 'place.reviewed':
      return {
        id: `act-${event.id}`,
        eventId: event.id,
        actorId: event.actor_id,
        headline: `a partagé un avis vérifié sur « ${meta.placeName || 'Lieu'} »`,
        badge: 'Avis sentinelle',
        url: meta.slug ? `/lieux/${meta.slug}` : '/lieux',
        timestamp: event.created_at,
        metadata: meta,
      };

    case 'carnet.published':
      return {
        id: `act-${event.id}`,
        eventId: event.id,
        actorId: event.actor_id,
        headline: `a publié son carnet de voyage « ${meta.title || 'Récit'} »`,
        badge: 'Carnet d’expédition',
        url: `/carnets/${event.entity_id}`,
        timestamp: event.created_at,
        metadata: meta,
      };

    default:
      return {
        id: `act-${event.id}`,
        eventId: event.id,
        actorId: event.actor_id,
        headline: `a partagé une activité (${event.event_type})`,
        badge: 'Activité',
        url: '/',
        timestamp: event.created_at,
        metadata: meta,
      };
  }
}
