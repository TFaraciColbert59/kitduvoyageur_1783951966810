import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fail, ok } from '@/lib/api/respond';
import { buildChallengesPayload } from '@/lib/rankings/builders';
import { resolveRankingsRequest } from '@/lib/rankings/requestContext';
import { unauthorized } from '@/lib/rankings/http';
import * as serverData from '@/lib/rankings/serverData';
import type { VirtualRaceRegistration } from '@/features/rankings/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CreatePrivateSchema = z.object({
  action: z.literal('create_private'),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  sport: z.enum(['all', 'hiking', 'trail_running', 'running', 'cycling', 'gravel', 'mtb']).default('all'),
  criterion: z
    .enum(['distance_meters', 'elevation_gain_meters', 'duration_sec', 'activity_count'])
    .default('distance_meters'),
  targetValue: z.number().finite().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(24).optional(),
  durationDays: z.number().int().min(1).max(90).default(14),
  invitedHandles: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});

const AcceptBestEffortSchema = z.object({
  action: z.literal('accept_best_effort'),
  sport: z.enum(['all', 'hiking', 'trail_running', 'running', 'cycling', 'gravel', 'mtb']).default('running'),
  targetDistanceMeters: z.number().finite().positive().max(200_000),
  targetDurationSec: z.number().int().positive().max(864_000),
  improvementPct: z.number().finite().min(0.5).max(25).default(3),
});

const RaceRegistrationSchema = z.object({
  action: z.enum(['register_race', 'withdraw_race']),
  raceId: z.string().trim().min(1).max(120),
});

const PostSchema = z.discriminatedUnion('action', [
  CreatePrivateSchema,
  AcceptBestEffortSchema,
  RaceRegistrationSchema,
]);

function defaultUnitForCriterion(criterion: string): string {
  switch (criterion) {
    case 'distance_meters':
      return 'm';
    case 'elevation_gain_meters':
      return 'm D+';
    case 'duration_sec':
      return 's';
    default:
      return 'sorties';
  }
}

/**
 * GET /api/rankings/challenges
 * Catalogue des défis (publics, sponsorisés, privés S5.21, meilleur effort S5.22,
 * courses virtuelles S5.23) + progression du spectateur + propositions meilleur effort.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-challenges');
    if (context.limited) return context.limited;

    const loadExtended =
      typeof serverData.loadExtendedChallenges === 'function'
        ? serverData.loadExtendedChallenges(context.supabase, context.viewerId)
        : Promise.resolve([]);
    const loadRaceRegs =
      typeof serverData.loadVirtualRaceRegistrations === 'function'
        ? serverData.loadVirtualRaceRegistrations(context.supabase, context.viewerId)
        : Promise.resolve(new Map<string, VirtualRaceRegistration>());

    const [catalog, extended, activities, raceRegistrations] = await Promise.all([
      serverData.loadChallengeCatalog(context.supabase),
      loadExtended,
      serverData.loadRankingActivities(context.supabase, { sinceDays: 365, limit: 3000 }),
      loadRaceRegs,
    ]);
    const profiles = await serverData.loadRankingProfiles(
      context.supabase,
      activities.map((activity) => activity.userId),
      { authenticated: Boolean(context.viewerId) }
    );
    const privacy = await serverData.loadPrivacyContext(context.supabase, context.viewerId);

    const registrationUrls = new Map<string, string | null>();
    const merged = [...catalog];
    const seenIds = new Set(catalog.map((c) => c.rule.id));
    for (const entry of extended) {
      if (entry.registrationUrl) registrationUrls.set(entry.rule.id, entry.registrationUrl);
      if (!seenIds.has(entry.rule.id)) {
        seenIds.add(entry.rule.id);
        merged.push({ rule: entry.rule, trackable: entry.trackable });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: buildChallengesPayload(merged, activities, profiles, privacy, context.viewerId, {
          registrationUrls,
          raceRegistrations,
          includeBestEffortProposals: true,
        }),
      },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('[API /api/rankings/challenges]', error);
    return fail('server', 'Défis indisponibles.');
  }
}

/**
 * POST /api/rankings/challenges
 * Actions interactives G03 :
 * - `create_private` (S5.21) : créer un défi privé entre amis sur invitation
 * - `accept_best_effort` (S5.22) : fixer un objectif de meilleur effort personnalisé
 * - `register_race` / `withdraw_race` (S5.23) : s'inscrire ou se désinscrire d'une course virtuelle
 */
export async function POST(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-challenges-write');
    if (context.limited) return context.limited;
    if (!context.viewerId) return unauthorized();

    const parsed = PostSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail('bad_request', 'Requête de défi invalide.');
    }

    const now = new Date();
    const startsAt = now.toISOString();

    if (parsed.data.action === 'create_private') {
      const normalizedHandles = parsed.data.invitedHandles
        .map((h) => h.replace(/^@+/, '').trim())
        .filter(Boolean);

      const invitedIds = new Set<string>([context.viewerId]);
      if (normalizedHandles.length > 0) {
        const { data: matched } = await context.supabase
          .from('public_profiles')
          .select('id,username')
          .in('username', normalizedHandles)
          .limit(20);
        for (const row of (matched ?? []) as Array<{ id?: string }>) {
          if (typeof row.id === 'string') invitedIds.add(row.id);
        }
      }

      const id = `priv_${randomUUID()}`;
      const endsAt = new Date(
        now.getTime() + parsed.data.durationDays * 86_400_000
      ).toISOString();
      const unit = parsed.data.unit || defaultUnitForCriterion(parsed.data.criterion);

      const { error } = await context.supabase.from('g03_challenges').insert({
        id,
        version: 1,
        kind: 'private_invite',
        title: parsed.data.title,
        description:
          parsed.data.description ||
          'Défi privé entre amis · visible uniquement des personnes invitées.',
        sport: parsed.data.sport,
        criterion: parsed.data.criterion,
        target_value: parsed.data.targetValue,
        unit,
        starts_at: startsAt,
        ends_at: endsAt,
        reward_badge_id: `badge:${id}`,
        reward_title: parsed.data.title,
        reward_points: 40,
        created_by: context.viewerId,
        invited_user_ids: Array.from(invitedIds),
      });

      if (error) return fail('server', 'Impossible de créer le défi privé.');
      return ok({ id, invitedCount: invitedIds.size }, 201);
    }

    if (parsed.data.action === 'accept_best_effort') {
      const kmLabel =
        parsed.data.targetDistanceMeters >= 1000
          ? `${(parsed.data.targetDistanceMeters / 1000).toFixed(parsed.data.targetDistanceMeters % 1000 === 0 ? 0 : 1)} km`
          : `${parsed.data.targetDistanceMeters} m`;
      const mins = Math.floor(parsed.data.targetDurationSec / 60);
      const secs = parsed.data.targetDurationSec % 60;
      const targetTimeLabel = `${mins}:${String(secs).padStart(2, '0')}`;
      const id = `be_${randomUUID()}`;
      const endsAt = new Date(now.getTime() + 30 * 86_400_000).toISOString();

      const { error } = await context.supabase.from('g03_challenges').insert({
        id,
        version: 1,
        kind: 'best_effort',
        title: `Meilleur effort ${kmLabel} (-${parsed.data.improvementPct}%)`,
        description: `Objectif personnel calculé sur ton record : passer sous ${targetTimeLabel} sur ${kmLabel}.`,
        sport: parsed.data.sport,
        criterion: 'best_effort_time',
        target_value: parsed.data.targetDistanceMeters,
        unit: 'm',
        starts_at: startsAt,
        ends_at: endsAt,
        reward_badge_id: `badge:${id}`,
        reward_title: `Record ${kmLabel} (${targetTimeLabel})`,
        reward_points: 50,
        created_by: context.viewerId,
        max_duration_sec: parsed.data.targetDurationSec,
      });

      if (error) return fail('server', 'Impossible d’enregistrer l’objectif de meilleur effort.');
      return ok({ id }, 201);
    }

    // S5.23 : register_race / withdraw_race
    const { data: raceRow, error: raceError } = await context.supabase
      .from('g03_challenges')
      .select('id,kind,partner_available')
      .eq('id', parsed.data.raceId)
      .maybeSingle();

    if (raceError || !raceRow || (raceRow as { kind?: string }).kind !== 'virtual_race') {
      return fail('not_found', 'Course virtuelle introuvable.');
    }
    if (
      parsed.data.action === 'register_race' &&
      (raceRow as { partner_available?: boolean | null }).partner_available === false
    ) {
      return fail(
        'conflict',
        'Partenaire temporairement indisponible pour les inscriptions.'
      );
    }

    const nextStatus = parsed.data.action === 'register_race' ? 'registered' : 'withdrawn';
    const { error: regError } = await context.supabase
      .from('g03_virtual_race_registrations')
      .upsert(
        {
          challenge_id: parsed.data.raceId,
          user_id: context.viewerId,
          status: nextStatus,
          registered_at: startsAt,
          updated_at: startsAt,
        },
        { onConflict: 'challenge_id,user_id' }
      );

    if (regError) return fail('server', 'Impossible de mettre à jour l’inscription.');
    return ok({ raceId: parsed.data.raceId, status: nextStatus });
  } catch (error) {
    console.error('[API /api/rankings/challenges POST]', error);
    return fail('server', 'Action défi impossible.');
  }
}
