import { createServiceClient } from '@/lib/api/serviceClient';

/**
 * Émet une notification d'activité quand le trigger SQL n'est pas encore
 * déployé sur l'environnement. Le client service_role est utilisé après
 * vérification de l'appelant par la route.
 */
export async function emitFollowerNotification(input: {
  actorId: string;
  targetId: string;
  requested: boolean;
}): Promise<void> {
  if (!input.actorId || !input.targetId || input.actorId === input.targetId) return;
  const client = createServiceClient();
  if (!client) return;
  const { error } = await client.from('notifications').insert({
    user_id: input.targetId,
    actor_id: input.actorId,
    type: input.requested ? 'follow_request' : 'new_follower',
    group: 'social',
    title: input.requested ? 'Demande d’abonnement' : 'Nouvel abonné',
    message: input.requested
      ? 'Un voyageur souhaite suivre ton profil privé.'
      : 'Un voyageur a commencé à te suivre.',
    related_type: 'profile',
    related_id: input.actorId,
    link: `/profil/${input.actorId}`,
  });
  if (error) {
    console.error('[activityNotifications] follow', error.message);
  }
}
