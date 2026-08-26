import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazy Supabase Admin client: constructed on first use so this module can be
// imported during `next build` even when env vars are not yet available.
let _supabaseAdmin: SupabaseClient<any> | null = null;
function getSupabaseAdmin(): SupabaseClient<any> {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseAdmin;
}
const supabaseAdmin = new Proxy({} as SupabaseClient<any>, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseAdmin(), prop, receiver);
  },
});

// Setup Web Push VAPID details if configured
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4028';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    `mailto:notifications@lekitduvoyageur.fr`,
    vapidPublicKey,
    vapidPrivateKey
  );
}

/**
 * POST /api/notifications/process
 * Dépile et traite les envois (emails et push) en attente dans la table notification_deliveries.
 * Peut être appelé par un webhook de base de données, un worker ou un cron job.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Fetch pending deliveries
    const { data: pending, error: fetchError } = (await supabaseAdmin
      .from('notification_deliveries')
      .select(`
        id,
        channel,
        notification_id,
        notifications (
          id,
          user_id,
          type,
          title,
          message,
          link
        )
      `)
      .eq('status', 'pending')
      .limit(10)) as any; // Process 10 items at a time

    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0, message: 'Aucun envoi en attente' });
    }

    const results = [];

    for (const delivery of pending) {
      const notif: any = delivery.notifications;
      if (!notif) {
        // Orphaned delivery, delete or mark failed
        await supabaseAdmin
          .from('notification_deliveries')
          .update({ status: 'failed', error_message: 'Notification orpheline' })
          .eq('id', delivery.id);
        continue;
      }

      // Mark as processing
      await supabaseAdmin
        .from('notification_deliveries')
        .update({ status: 'processing', attempted_at: new Date().toISOString() })
        .eq('id', delivery.id);

      try {
        if (delivery.channel === 'email') {
          // Send transaction email via Resend
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('email')
            .eq('id', notif.user_id)
            .single();

          if (!profile?.email) {
            throw new Error('Adresse email introuvable pour cet utilisateur');
          }

          const apiKey = process.env.RESEND_API_KEY;
          if (!apiKey) {
            // Simulated email in development if no key configured
            if (process.env.NODE_ENV === 'development') {
              console.log(`[SIMULATED EMAIL] To: ${profile.email} | Subject: ${notif.title} | Body: ${notif.message}`);
              await supabaseAdmin
                .from('notification_deliveries')
                .update({
                  status: 'sent',
                  provider_response: { status: 'simulated', info: 'Dev Mode simulated send' }
                })
                .eq('id', delivery.id);
              results.push({ id: delivery.id, status: 'simulated' });
              continue;
            } else {
              throw new Error('Clé API RESEND_API_KEY non configurée');
            }
          }

          // Real Resend API Call
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Le Kit du Voyageur <notifications@lekitduvoyageur.fr>',
              to: profile.email,
              subject: notif.title,
              html: `
                <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 12px; background-color: #ffffff;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 20px; font-weight: 800; color: #17402C; letter-spacing: -0.5px;">Le Kit du Voyageur</span>
                  </div>
                  <h3 style="color: #17402C; font-size: 16px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">${notif.title}</h3>
                  <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">${notif.message}</p>
                  ${notif.link ? `
                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${siteUrl}${notif.link}" style="display: inline-block; background-color: #17402C; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-size: 13px; font-weight: 700; transition: background-color 0.2s;">
                        Voir l'activité
                      </a>
                    </div>
                  ` : ''}
                  <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 24px 0;" />
                  <p style="font-size: 11px; color: #888888; text-align: center; line-height: 1.4; margin: 0;">
                    Vous recevez cet email suite à votre activité communautaire.<br />
                    Vous pouvez modifier vos préférences de notification à tout moment sur votre compte.
                  </p>
                </div>
              `
            })
          });

          const respData = await response.json();
          if (!response.ok) {
            throw new Error(respData.message || 'Erreur API Resend');
          }

          await supabaseAdmin
            .from('notification_deliveries')
            .update({
              status: 'sent',
              provider_response: respData
            })
            .eq('id', delivery.id);

          results.push({ id: delivery.id, status: 'sent' });

        } else if (delivery.channel === 'push') {
          // Web Push sending
          const { data: subscriptions } = await supabaseAdmin
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', notif.user_id);

          if (!subscriptions || subscriptions.length === 0) {
            throw new Error("Aucun abonnement Web Push enregistré pour cet utilisateur");
          }

          if (!vapidPublicKey || !vapidPrivateKey) {
            // Simulated push in dev
            if (process.env.NODE_ENV === 'development') {
              console.log(`[SIMULATED PUSH] Title: ${notif.title} | Message: ${notif.message}`);
              await supabaseAdmin
                .from('notification_deliveries')
                .update({
                  status: 'sent',
                  provider_response: { status: 'simulated', info: 'VAPID keys not configured, simulated' }
                })
                .eq('id', delivery.id);
              results.push({ id: delivery.id, status: 'simulated' });
              continue;
            } else {
              throw new Error('Clés VAPID non configurées');
            }
          }

          const pushPayload = JSON.stringify({
            title: notif.title,
            body: notif.message,
            icon: '/android-chrome-192x192.png',
            data: {
              url: notif.link ? `${siteUrl}${notif.link}` : siteUrl
            }
          });

          let sentCount = 0;
          for (const sub of subscriptions) {
            try {
              await webpush.sendNotification(sub.subscription as any, pushPayload);
              sentCount++;
            } catch (pushErr: any) {
              console.warn('[notifications/process] Single push failed:', pushErr.message);
              // Clean up expired subscriptions (410 Gone or 404 Not Found)
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                await supabaseAdmin
                  .from('push_subscriptions')
                  .delete()
                  .eq('id', sub.id);
              }
            }
          }

          if (sentCount === 0) {
            throw new Error("Échec d'envoi sur tous les appareils abonnés");
          }

          await supabaseAdmin
            .from('notification_deliveries')
            .update({
              status: 'sent',
              provider_response: { success: true, devices_sent: sentCount }
            })
            .eq('id', delivery.id);

          results.push({ id: delivery.id, status: 'sent' });
        }
      } catch (deliveryErr: any) {
        console.error(`[notifications/process] Delivery failed for ID ${delivery.id}:`, deliveryErr.message);
        await supabaseAdmin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            error_message: deliveryErr.message || 'Erreur inconnue'
          })
          .eq('id', delivery.id);

        results.push({ id: delivery.id, status: 'failed', error: deliveryErr.message });
      }
    }

    return NextResponse.json({ processed: pending.length, results });
  } catch (err: any) {
    console.error('[notifications/process] Fatal route error:', err.message || err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
