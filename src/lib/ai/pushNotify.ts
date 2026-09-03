import 'server-only';
import webpush from 'web-push';
import { getServiceSupabase } from './serviceClient';

/**
 * Notification web-push (Chantier C — « Votre carnet est prêt »).
 * Best-effort absolue : VAPID absentes, abonnements vides ou envois échoués
 * → false, JAMAIS de throw (le récit est déjà en base de toute façon).
 * Clés VAPID : NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 */

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url?: string }
): Promise<boolean> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn('[ai/pushNotify] VAPID non configurées — notification ignorée');
    return false;
  }

  const supabase = getServiceSupabase();
  if (!supabase) return false;

  let subscriptions: { subscription: unknown }[] = [];
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);
    if (error) {
      console.error('[ai/pushNotify] lecture push_subscriptions:', error.message);
      return false;
    }
    subscriptions = data ?? [];
  } catch (err) {
    console.error('[ai/pushNotify] lecture abonnements a échoué:', err instanceof Error ? err.message : err);
    return false;
  }

  if (subscriptions.length === 0) return false;

  webpush.setVapidDetails('mailto:contact@lekitduvoyageur.com', publicKey, privateKey);
  const payload = JSON.stringify(notification);

  let delivered = 0;
  for (const { subscription } of subscriptions) {
    try {
      await webpush.sendNotification(subscription as Parameters<typeof webpush.sendNotification>[0], payload);
      delivered += 1;
    } catch (err) {
      // Abonnement expiré (410 Gone) ou envoi échoué : on tente les suivants.
      console.error('[ai/pushNotify] envoi a échoué:', err instanceof Error ? err.message : err);
    }
  }

  return delivered > 0;
}
