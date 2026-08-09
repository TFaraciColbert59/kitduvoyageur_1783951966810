import { HikeSession, GPSPosition } from '../types';

export interface HikerProfileStats {
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  totalDistanceKm: number;
  avgDistanceKm: number;
  maxDistanceKm: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  totalElevationGainM: number;
  avgSpeedKmH: number;
  totalPoisVisited: number;
  levelTitle: 'Débutant' | 'Régulier' | 'Confirmé' | 'Aventurier' | 'Expert';
  levelDescription: string;
}

export class HikerProfileService {
  /**
   * Calcule le profil et les statistiques réelles d'un voyageur à partir de ses sessions Supabase.
   */
  public static computeProfile(sessions: HikeSession[]): HikerProfileStats {
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        abandonedSessions: 0,
        totalDistanceKm: 0,
        avgDistanceKm: 0,
        maxDistanceKm: 0,
        totalDurationSeconds: 0,
        avgDurationSeconds: 0,
        totalElevationGainM: 0,
        avgSpeedKmH: 0,
        totalPoisVisited: 0,
        levelTitle: 'Débutant',
        levelDescription: 'Prêt pour ta première aventure outdoor !',
      };
    }

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.endedAt != null).length;
    const abandonedSessions = totalSessions - completedSessions;

    let totalDistanceKm = 0;
    let maxDistanceKm = 0;
    let totalDurationSeconds = 0;
    let totalElevationGainM = 0;
    let totalPoisVisited = 0;

    for (const s of sessions) {
      const dist = Number(s.distanceKm || 0);
      const dur = Number(s.durationSeconds || 0);
      const elev = Number(s.elevationGainM || 0);
      const poisCount = Array.isArray(s.poiEvents) ? s.poiEvents.length : 0;

      totalDistanceKm += dist;
      if (dist > maxDistanceKm) maxDistanceKm = dist;
      totalDurationSeconds += dur;
      totalElevationGainM += elev;
      totalPoisVisited += poisCount;
    }

    const avgDistanceKm = totalSessions > 0 ? totalDistanceKm / totalSessions : 0;
    const avgDurationSeconds = totalSessions > 0 ? totalDurationSeconds / totalSessions : 0;
    const avgSpeedKmH = totalDurationSeconds > 0 ? (totalDistanceKm / (totalDurationSeconds / 3600)) : 0;

    // Détermination objective du niveau du randonneur
    let levelTitle: 'Débutant' | 'Régulier' | 'Confirmé' | 'Aventurier' | 'Expert' = 'Débutant';
    let levelDescription = 'Premières randonnées et découverte des sentiers.';

    if (totalSessions >= 30 && avgDistanceKm >= 15) {
      levelTitle = 'Expert';
      levelDescription = 'Maîtrise complète des grands itinéraires et dénivelés soutenus.';
    } else if (totalSessions >= 15 && (avgDistanceKm >= 10 || totalElevationGainM >= 2000)) {
      levelTitle = 'Aventurier';
      levelDescription = 'Habitué aux sorties longues et aux terrains variés.';
    } else if (totalSessions >= 8 && avgDistanceKm >= 7) {
      levelTitle = 'Confirmé';
      levelDescription = 'Pratique régulière et gestion autonome de l\'effort.';
    } else if (totalSessions >= 3) {
      levelTitle = 'Régulier';
      levelDescription = 'Randonneur actif en progression constante.';
    }

    return {
      totalSessions,
      completedSessions,
      abandonedSessions,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      avgDistanceKm: Number(avgDistanceKm.toFixed(1)),
      maxDistanceKm: Number(maxDistanceKm.toFixed(1)),
      totalDurationSeconds,
      avgDurationSeconds: Math.round(avgDurationSeconds),
      totalElevationGainM: Math.round(totalElevationGainM),
      avgSpeedKmH: Number(avgSpeedKmH.toFixed(1)),
      totalPoisVisited,
      levelTitle,
      levelDescription,
    };
  }
}
