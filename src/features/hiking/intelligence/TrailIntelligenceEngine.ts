/**
 * A4 — Façade d'intelligence des sentiers (migration du prototype).
 *
 * Le prototype était route-level, non déterministe (`Math.random()`) et
 * sans persistance. La migration conserve une façade rétrocompatible pour
 * les appelants existants (moyennes observées, propositions de validation
 * humaine) et ajoute une entrée par segment qui délègue au moteur pur A4
 * `aggregateCollective` quand des passages sont fournis.
 *
 * Aucun appel à `Math.random()` : les identifiants anonymisés et les
 * propositions sont dérivés par hash stable des entrées.
 */
import { HikeSession, GPSPosition, Trail } from '../types';
import {
  aggregateCollective,
  type AggregateOptions,
  type CollectiveAggregate,
  type CollectivePassage,
} from '@/features/adventure-intelligence/domain/collectiveIntelligence';

export interface AnonymizedHikeSample {
  routeId: string | number;
  anonymizedSessionId: string;
  totalDistanceKm: number;
  durationSeconds: number;
  averagePaceMinPerKm: number;
  elevationGainM?: number;
  slowZonesCount: number;
  gpsWeakPointsCount: number;
}

export interface TrailIntelligenceReport {
  routeId: string | number;
  sampleCount: number;
  confidenceScorePercent: number;
  observedAverageDurationMinutes: number;
  observedAveragePaceMinPerKm: number;
  observedDifficulty: 'Facile' | 'Modéré' | 'Difficile' | 'Expert';
  slowZonesCount: number;
  gpsQualityScorePercent: number;
  proposedCorrections: TrailIntelligenceProposal[];
  /** Agrégats collectifs A4, présents seulement si des passages sont fournis. */
  collectiveAggregates?: CollectiveAggregate[];
}

export interface TrailIntelligenceProposal {
  id: string;
  routeId: string | number;
  type: 'DIFFICULTY_CORRECTION' | 'DURATION_ADJUSTMENT' | 'GPS_DEADZONE_WARNING' | 'HAZARD_ALERT';
  field: string;
  currentOfficialValue: any;
  proposedObservedValue: any;
  confidenceScorePercent: number;
  sampleSize: number;
  status: 'pending_review' | 'approved' | 'rejected';
  createdAt: string;
}

export interface TrailIntelligenceOptions {
  /** Instant de référence des propositions (défaut : maintenant). */
  now?: string;
  /** Passages collectifs à déléguer au moteur pur A4. */
  passages?: CollectivePassage[];
}

/** Hash FNV-1a 32 bits — déterministe, aucun aléa. */
function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class TrailIntelligenceEngine {
  /**
   * Strip all PII (user ID, exact personal timestamps) to produce an anonymized telemetry sample.
   * L'identifiant anonymisé est un hash stable des entrées : deux appels identiques
   * produisent le même identifiant, sans jamais contenir l'identité d'origine.
   */
  public static anonymizeHikeSession(session: HikeSession): AnonymizedHikeSample {
    const rawPos = session.positions || [];
    let slowZonesCount = 0;
    let gpsWeakPointsCount = 0;

    // Detect slow movement zones (< 1 km/h) and weak GPS signals
    for (const p of rawPos) {
      if (p.speed != null && p.speed < 0.28) {
        slowZonesCount++;
      }
      if (p.accuracy != null && p.accuracy > 35) {
        gpsWeakPointsCount++;
      }
    }

    const averagePaceMinPerKm = session.distanceKm > 0 ? session.durationSeconds / 60.0 / session.distanceKm : 0;

    return {
      routeId: session.routeId || 'unknown',
      anonymizedSessionId: `anon-${stableHash(
        `${session.id}|${session.userId}|${session.startedAt}`
      )}`,
      totalDistanceKm: session.distanceKm,
      durationSeconds: session.durationSeconds,
      averagePaceMinPerKm: Math.round(averagePaceMinPerKm * 10) / 10,
      elevationGainM: session.elevationGainM || 0,
      slowZonesCount,
      gpsWeakPointsCount,
    };
  }

  /**
   * Entrée par segment (A4) : agrège les passages d'un segment avec le moteur
   * pur et retourne l'agrégat publié du segment demandé (ou null).
   */
  public static processSegmentAggregates(
    segmentId: number,
    passages: CollectivePassage[],
    options: AggregateOptions = {}
  ): CollectiveAggregate | null {
    const aggregates = aggregateCollective(passages, options);
    return aggregates.find((aggregate) => aggregate.segmentId === segmentId) ?? null;
  }

  /**
   * Process a collection of anonymized samples to generate a Trail Intelligence Report.
   * Lorsque `options.passages` est fourni, délègue aussi au moteur A4 et expose
   * les agrégats collectifs correspondants.
   */
  public static processTrailTelemetry(
    routeId: string | number,
    officialTrail: Trail | null,
    samples: AnonymizedHikeSample[],
    options: TrailIntelligenceOptions = {}
  ): TrailIntelligenceReport {
    const now = options.now ?? new Date().toISOString();
    const sampleCount = samples.length;
    const collectiveAggregates =
      options.passages && options.passages.length > 0
        ? aggregateCollective(options.passages, { now })
        : undefined;

    if (sampleCount === 0) {
      return {
        routeId,
        sampleCount: 0,
        confidenceScorePercent: 0,
        observedAverageDurationMinutes: 0,
        observedAveragePaceMinPerKm: 0,
        observedDifficulty: (officialTrail?.difficulty as any) || 'Modéré',
        slowZonesCount: 0,
        gpsQualityScorePercent: 100,
        proposedCorrections: [],
        ...(collectiveAggregates ? { collectiveAggregates } : {}),
      };
    }

    // Calculate aggregated averages
    const totalDurationSec = samples.reduce((acc, s) => acc + s.durationSeconds, 0);
    const avgDurationMin = Math.round(totalDurationSec / sampleCount / 60);

    const totalPace = samples.reduce((acc, s) => acc + s.averagePaceMinPerKm, 0);
    const avgPace = Math.round((totalPace / sampleCount) * 10) / 10;

    const totalSlowZones = samples.reduce((acc, s) => acc + s.slowZonesCount, 0);
    const totalGpsWeak = samples.reduce((acc, s) => acc + s.gpsWeakPointsCount, 0);

    // Calculate confidence score based on sample size (saturated at 100 samples)
    const confidenceScorePercent = Math.min(99, Math.round((sampleCount / 50.0) * 100));

    // Determine observed difficulty based on pace and elevation
    let observedDifficulty: TrailIntelligenceReport['observedDifficulty'] = 'Facile';
    if (avgPace > 22) observedDifficulty = 'Expert';
    else if (avgPace > 17) observedDifficulty = 'Difficile';
    else if (avgPace > 13) observedDifficulty = 'Modéré';

    const gpsQualityScorePercent = Math.max(20, Math.round(100 - (totalGpsWeak / (sampleCount * 10)) * 100));

    // Generate human-validation proposals if observed values diverge significantly from official data
    const proposedCorrections: TrailIntelligenceProposal[] = [];

    if (officialTrail && officialTrail.duration_hours != null) {
      const officialMin = officialTrail.duration_hours * 60;
      if (Math.abs(avgDurationMin - officialMin) > 30 && sampleCount >= 5) {
        const proposedObservedValue = Math.round((avgDurationMin / 60) * 10) / 10;
        proposedCorrections.push({
          id: `prop-dur-${routeId}-${stableHash(
            `${routeId}|DURATION_ADJUSTMENT|${proposedObservedValue}|${sampleCount}`
          )}`,
          routeId,
          type: 'DURATION_ADJUSTMENT',
          field: 'duration_hours',
          currentOfficialValue: officialTrail.duration_hours,
          proposedObservedValue,
          confidenceScorePercent,
          sampleSize: sampleCount,
          status: 'pending_review',
          createdAt: now,
        });
      }
    }

    if (officialTrail && officialTrail.difficulty && officialTrail.difficulty !== observedDifficulty && sampleCount >= 10) {
      proposedCorrections.push({
        id: `prop-diff-${routeId}-${stableHash(
          `${routeId}|DIFFICULTY_CORRECTION|${observedDifficulty}|${sampleCount}`
        )}`,
        routeId,
        type: 'DIFFICULTY_CORRECTION',
        field: 'difficulty',
        currentOfficialValue: officialTrail.difficulty,
        proposedObservedValue: observedDifficulty,
        confidenceScorePercent,
        sampleSize: sampleCount,
        status: 'pending_review',
        createdAt: now,
      });
    }

    return {
      routeId,
      sampleCount,
      confidenceScorePercent,
      observedAverageDurationMinutes: avgDurationMin,
      observedAveragePaceMinPerKm: avgPace,
      observedDifficulty,
      slowZonesCount: totalSlowZones,
      gpsQualityScorePercent,
      proposedCorrections,
      ...(collectiveAggregates ? { collectiveAggregates } : {}),
    };
  }
}
