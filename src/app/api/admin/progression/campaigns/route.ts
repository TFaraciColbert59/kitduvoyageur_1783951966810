import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { computeCampaignParticipationMetrics } from '@/features/rankings/challenges';
import type { CampaignEligibilityRule, SportCategory } from '@/features/rankings/types';
import {
  loadPrivacyContext,
  loadRankingActivities,
  loadRankingProfiles,
} from '@/lib/rankings/serverData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateCampaignSchema = z.object({
  title: z.string().trim().min(2).max(120),
  sponsorId: z.string().trim().min(1).max(80).default('partner'),
  sponsorName: z.string().trim().min(2).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  allowedSports: z
    .array(z.enum(['all', 'hiking', 'trail_running', 'running', 'cycling', 'gravel', 'mtb']))
    .min(1)
    .default(['all']),
  minDistanceMeters: z.number().int().min(0).max(500_000).nullable().optional(),
  minElevationGainMeters: z.number().int().min(0).max(20_000).nullable().optional(),
  requiresPublicVisibility: z.boolean().default(true),
});

interface CampaignRow {
  campaign_id: string;
  sponsor_id: string;
  sponsor_name: string;
  title: string;
  starts_at: string;
  ends_at: string;
  allowed_sports: string[] | null;
  min_distance_meters: number | null;
  min_elevation_gain_meters: number | null;
  requires_public_visibility: boolean | null;
  created_at: string;
}

async function requireAdmin(scope: string) {
  const supabase = await createClient();
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
  if (adminError || !isAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Accès interdit : administrateurs uniquement' },
        { status: 403 }
      ),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Authentification requise' }, { status: 401 }),
    };
  }

  const limited = await enforceRateLimit(user.id, {
    scope,
    limit: 60,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return { ok: false as const, response: limited };

  return { ok: true as const, supabase, user };
}

/**
 * GET /api/admin/progression/campaigns — S6.26 : campagnes sponsorisées B2B.
 * Retourne exclusivement des agrégats anonymes (`computeCampaignParticipationMetrics`),
 * jamais de liste nominative de participants (`C-PRIV`).
 */
export async function GET() {
  try {
    const auth = await requireAdmin('admin-progression-campaigns-read');
    if (!auth.ok) return auth.response;

    const reader = getServiceSupabase() ?? auth.supabase;
    const { data: rows, error } = await reader
      .from('g03_campaigns')
      .select(
        'campaign_id,sponsor_id,sponsor_name,title,starts_at,ends_at,allowed_sports,min_distance_meters,min_elevation_gain_meters,requires_public_visibility,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ success: true, campaigns: [] });
    }

    const campaignRows = (rows ?? []) as CampaignRow[];
    if (campaignRows.length === 0) {
      return NextResponse.json({ success: true, campaigns: [] });
    }

    const activities = await loadRankingActivities(reader, { sinceDays: 365, limit: 4000 });
    const profiles = await loadRankingProfiles(
      reader,
      activities.map((a) => a.userId),
      { authenticated: true }
    );
    const privacy = await loadPrivacyContext(reader, auth.user.id);

    const campaigns = campaignRows.map((row) => {
      const rule = {
        campaignId: row.campaign_id,
        sponsorId: row.sponsor_id,
        sponsorName: row.sponsor_name,
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        allowedSports: ((row.allowed_sports ?? ['all']) as SportCategory[]),
        minDistanceMeters: row.min_distance_meters ?? undefined,
        minElevationGainMeters: row.min_elevation_gain_meters ?? undefined,
        requiresPublicVisibility: row.requires_public_visibility ?? true,
      } as CampaignEligibilityRule;
      const metrics = computeCampaignParticipationMetrics(rule, activities, profiles, privacy);
      return {
        ...rule,
        metrics,
      };
    });

    const res = NextResponse.json({ success: true, campaigns });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[admin/progression/campaigns GET]', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin('admin-progression-campaigns-write');
    if (!auth.ok) return auth.response;

    const parsed = CreateCampaignSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success || Date.parse(parsed.data.endsAt) <= Date.parse(parsed.data.startsAt)) {
      return NextResponse.json({ error: 'Paramètres de campagne invalides' }, { status: 400 });
    }

    const campaignId = `camp_${randomUUID()}`;
    const writer = getServiceSupabase() ?? auth.supabase;
    const { error } = await writer.from('g03_campaigns').insert({
      campaign_id: campaignId,
      sponsor_id: parsed.data.sponsorId,
      sponsor_name: parsed.data.sponsorName,
      title: parsed.data.title,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      allowed_sports: parsed.data.allowedSports,
      min_distance_meters: parsed.data.minDistanceMeters ?? null,
      min_elevation_gain_meters: parsed.data.minElevationGainMeters ?? null,
      requires_public_visibility: parsed.data.requiresPublicVisibility,
      created_by: auth.user.id,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Impossible d’enregistrer la campagne partenaire' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, campaignId }, { status: 201 });
  } catch (err) {
    console.error('[admin/progression/campaigns POST]', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
