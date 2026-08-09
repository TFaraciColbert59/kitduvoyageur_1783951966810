import { HikeSession, GPSPosition, HikingStatistics } from '../types';

export class HikeSessionService {
  /**
   * Persist a finished hike session to Supabase backend API.
   */
  public static async saveSession(params: {
    routeId?: string | number | null;
    carnetId?: string | null;
    startedAt: string;
    endedAt: string;
    distanceKm: number;
    durationSeconds: number;
    elevationGainM?: number | null;
    positions: GPSPosition[];
    poiEvents: { poiName: string; reachedAt: string; lat: number; lon: number }[];
  }): Promise<{ sessionId: string }> {
    const res = await fetch('/api/hike-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur de sauvegarde de session');
    }

    return res.json();
  }

  /**
   * Fetch hike sessions for a given carnet.
   */
  public static async getSessionsForCarnet(carnetId: string): Promise<HikeSession[]> {
    const res = await fetch(`/api/hike-sessions?carnetId=${carnetId}`);
    if (!res.ok) return [];
    return res.json();
  }

  /**
   * Generate AI narrative for a hike session.
   */
  public static async generateNarrative(sessionId: string): Promise<{ journal: string; aventure: string; sportive: string }> {
    const res = await fetch(`/api/hike-sessions/${sessionId}/narrative`, { method: 'POST' });
    if (!res.ok) {
      throw new Error('Échec de la génération du récit');
    }
    return res.json();
  }

  /**
   * Fetch aggregated hiking statistics for a user.
   */
  public static async getUserHikingStats(supabaseClient: any, userId: string): Promise<HikingStatistics | null> {
    try {
      const { data, error } = await supabaseClient.rpc('get_user_hiking_stats', {
        p_user_id: userId,
      });

      if (error || !data) return null;

      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw) return null;

      return {
        totalSessions: Number(raw.total_sessions || 0),
        totalDistanceKm: Number(raw.total_distance_km || 0),
        avgDistanceKm: Number(raw.avg_distance_km || 0),
        avgPaceMinPerKm: Number(raw.avg_pace_min_per_km || 0),
        avgElevationGainM: Number(raw.avg_elevation_gain_m || 0),
        favoriteDifficulty: raw.favorite_difficulty || null,
        mostActiveWeekday: raw.most_active_weekday || null,
      };
    } catch {
      return null;
    }
  }
}
