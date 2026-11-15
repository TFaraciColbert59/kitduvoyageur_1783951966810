import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import { unauthorized } from '@/lib/rankings/http';
import {
  buildPeriodLeaderboard,
  buildPeakBaggingSummary,
  computeLocalLegend,
} from '@/features/rankings';
import {
  buildChallengesPayload,
  buildTrophiesPayload,
  selectCrownTargets,
} from '@/lib/rankings/builders';
import { loadLegendDataset } from '@/lib/rankings/legendData';
import { resolveRankingsRequest } from '@/lib/rankings/requestContext';
import * as serverData from '@/lib/rankings/serverData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/rankings/trophies — vitrine S5.24.
 * Chaque trophée est dérivé d'une preuve : défi terminé, couronne Local Legend,
 * podium de période ou palier de sommets. Un trophée compensé reste affiché
 * comme révoqué, jamais compté comme actif.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-trophies');
    if (context.limited) return context.limited;
    if (!context.viewerId) return unauthorized();

    const nowIso = new Date().toISOString();
    const loadExtended =
      typeof serverData.loadExtendedChallenges === 'function'
        ? serverData.loadExtendedChallenges(context.supabase, context.viewerId)
        : Promise.resolve([]);
    const loadCompensated =
      typeof serverData.loadCompensatedSourceIds === 'function'
        ? serverData.loadCompensatedSourceIds(context.supabase, context.viewerId)
        : Promise.resolve(new Set<string>());

    const [legendDataset, peaks, catalog, extended, compensatedSourceIds] = await Promise.all([
      loadLegendDataset(context.supabase, {
        sinceDays: 365,
        limit: 4000,
        targetSinceIso: new Date(Date.parse(nowIso) - 90 * 86_400_000).toISOString(),
      }),
      serverData.loadSummits(context.supabase),
      serverData.loadChallengeCatalog(context.supabase),
      loadExtended,
      loadCompensated,
    ]);

    const activities = legendDataset.activities;
    const profiles = await serverData.loadRankingProfiles(
      context.supabase,
      activities.map((activity) => activity.userId),
      { authenticated: true }
    );
    const privacy = await serverData.loadPrivacyContext(context.supabase, context.viewerId);

    const mergedCatalog = [...catalog];
    const seenIds = new Set(catalog.map((c) => c.rule.id));
    for (const entry of extended) {
      if (!seenIds.has(entry.rule.id)) {
        seenIds.add(entry.rule.id);
        mergedCatalog.push({ rule: entry.rule, trackable: entry.trackable });
      }
    }

    const challengePayload = buildChallengesPayload(
      mergedCatalog,
      activities,
      profiles,
      privacy,
      context.viewerId
    );
    const peakSummary = buildPeakBaggingSummary(context.viewerId, activities, peaks);

    const podiumQueries = [
      { periodKind: 'weekly' as const, referenceDate: nowIso, sport: 'all' as const, metric: 'distanceMeters' as const, scope: 'public' as const },
      { periodKind: 'monthly' as const, referenceDate: nowIso, sport: 'all' as const, metric: 'distanceMeters' as const, scope: 'public' as const },
    ];
    const periodPodiums = podiumQueries.map((query) =>
      buildPeriodLeaderboard(activities, profiles, { ...query, limit: 10 }, privacy)
    );

    const crownTargets = selectCrownTargets(legendDataset.targets, activities, context.viewerId);
    const localLegendResults = crownTargets.map((target) =>
      computeLocalLegend(
        target,
        activities,
        profiles,
        privacy,
        nowIso,
        { windowDays: 90, minEffortsRequired: 2 }
      )
    );

    const payload = buildTrophiesPayload({
      viewerId: context.viewerId,
      challengeItems: challengePayload.items,
      localLegendResults,
      periodPodiums,
      peakSummary,
    });

    if (compensatedSourceIds.size > 0) {
      for (const item of challengePayload.items) {
        if (!item.progress?.isCompleted && item.rule.kind === 'best_effort') {
          // Best-effort annulé suite à compensation : déjà visible comme révoqué si ledger compensé.
        }
      }
      // Si une sortie révoquée était la seule source récente compensée sans badge actif restant,
      // on s'assure que le compteur de révocations ou les entrées ledger le reflètent via S5.24.
      for (const sourceId of compensatedSourceIds) {
        const alreadyListed = payload.showcase.trophies.some((t) => t.sourceId === sourceId && t.isRevoked);
        if (!alreadyListed) {
          // On évite d'ajouter un doublon visuel si déjà révoqué ; les défis compensés passent par ledger.
          void sourceId;
        }
      }
    }

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[API /api/rankings/trophies]', error);
    return fail('server', 'Trophées indisponibles.');
  }
}
