import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize Supabase Admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET or POST /api/notifications/digest
 * Déclenche l'agrégation des digests de notifications d'activité.
 * Généralement appelé périodiquement (ex: toutes les 24 heures) par un service de cron.
 */
export async function POST(req: NextRequest) {
  return handleDigest();
}

export async function GET(req: NextRequest) {
  return handleDigest();
}

async function handleDigest() {
  try {
    // Call stored procedure to aggregate unread items into digests
    const { data: digestCount, error } = await supabaseAdmin
      .rpc('send_digests');

    if (error) throw error;

    // Trigger queue processor to immediately send the newly queued digest emails
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4028';
      // Execute non-blocking process request
      fetch(`${siteUrl}/api/notifications/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.warn('[notifications/digest] Async process trigger warn:', err.message));
    } catch (triggerErr) {
      // Ignore background trigger errors
    }

    return NextResponse.json({
      success: true,
      digests_created: digestCount || 0,
      message: `${digestCount || 0} digest(s) d'activité généré(s) et mis en file d'envoi.`
    });
  } catch (err: any) {
    console.error('[notifications/digest] Error:', err.message || err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
