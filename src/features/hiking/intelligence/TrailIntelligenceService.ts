import { HikeSession, Trail } from '../types';
import { TrailIntelligenceEngine, TrailIntelligenceReport, AnonymizedHikeSample } from './TrailIntelligenceEngine';

export class TrailIntelligenceService {
  /**
   * Submit an anonymized hike telemetry sample to the collective intelligence network.
   */
  public static async submitAnonymizedTelemetry(session: HikeSession): Promise<{ success: boolean }> {
    const sample = TrailIntelligenceEngine.anonymizeHikeSession(session);

    try {
      const res = await fetch('/api/trail-intelligence/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sample),
      });
      return { success: res.ok };
    } catch (err) {
      console.warn('[TrailIntelligenceService] Telemetry submission failed silently:', err);
      return { success: false };
    }
  }

  /**
   * Fetch aggregated Trail Intelligence Report for a route.
   */
  public static async getReportForRoute(routeId: string | number, officialTrail: Trail | null): Promise<TrailIntelligenceReport> {
    try {
      const res = await fetch(`/api/trail-intelligence/reports?routeId=${routeId}`);
      if (!res.ok) throw new Error();
      const samples: AnonymizedHikeSample[] = await res.json();
      return TrailIntelligenceEngine.processTrailTelemetry(routeId, officialTrail, samples);
    } catch {
      // Fallback calculation with empty samples
      return TrailIntelligenceEngine.processTrailTelemetry(routeId, officialTrail, []);
    }
  }
}
