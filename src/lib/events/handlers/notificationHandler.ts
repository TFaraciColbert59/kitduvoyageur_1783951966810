import type { LkvEvent } from '../types';

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  link: string;
  actorId: string;
  entityId: string;
}

export function handleNotificationEvent(event: LkvEvent): NotificationPayload | null {
  const meta = event.metadata || {};

  switch (event.event_type) {
    case 'crew.joined':
      return {
        type: 'crew_join',
        title: 'Nouvel équipier dans le groupe',
        message: `${meta.memberName || 'Un explorateur'} a rejoint l'équipage ${meta.crewName || ''}.`,
        link: event.crew_id ? `/groupes/${event.crew_id}` : '/groupes',
        actorId: event.actor_id,
        entityId: event.entity_id,
      };

    case 'trip.phase_changed':
      return {
        type: 'trip_phase',
        title: 'Changement de phase d’expédition',
        message: `L'expédition est maintenant en phase « ${meta.to || 'Nouvelle phase'} ».`,
        link: `/voyages/${meta.slug || event.entity_id}`,
        actorId: event.actor_id,
        entityId: event.entity_id,
      };

    case 'comment.created':
      return {
        type: 'comment',
        title: 'Nouveau message reçu',
        message: `${meta.authorName || 'Un voyageur'} a commenté votre aventure.`,
        link: meta.link || '/',
        actorId: event.actor_id,
        entityId: event.entity_id,
      };

    default:
      return null;
  }
}
