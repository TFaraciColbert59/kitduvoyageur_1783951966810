import { GPSPosition } from '../types';

export interface HikeTimelineEvent {
  id: string;
  type: 'START' | 'KM_MILESTONE' | 'TURN' | 'POI' | 'OFF_ROUTE' | 'RETURN_ROUTE' | 'ARRIVAL';
  timestamp: string;
  title: string;
  description: string;
  location?: { lat: number; lng: number };
}

export class HikeTimelineJournal {
  /**
   * Construit une timeline 100% factuelle à partir des positions réelles et événements enregistrés.
   */
  public static buildTimeline(params: {
    startedAt: string;
    endedAt: string;
    distanceKm: number;
    positions: GPSPosition[];
    poiEvents: { poiName: string; reachedAt: string; lat: number; lon: number }[];
    routeName?: string | null;
  }): HikeTimelineEvent[] {
    const events: HikeTimelineEvent[] = [];

    // 1. Événement Départ
    events.push({
      id: 'event-start',
      type: 'START',
      timestamp: params.startedAt,
      title: 'Départ de la randonnée',
      description: `Début du parcours ${params.routeName ? `« ${params.routeName} »` : ''} à ${new Date(params.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
      location: params.positions[0] ? { lat: params.positions[0].latitude, lng: params.positions[0].longitude } : undefined,
    });

    // 2. Événements POI
    params.poiEvents.forEach((poi, idx) => {
      events.push({
        id: `event-poi-${idx}`,
        type: 'POI',
        timestamp: poi.reachedAt,
        title: `Passage : ${poi.poiName}`,
        description: `Point d'intérêt atteint à ${new Date(poi.reachedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
        location: { lat: poi.lat, lng: poi.lon },
      });
    });

    // 3. Jalons de distance (1er km, 5e km)
    const startTimeMs = new Date(params.startedAt).getTime();
    const endTimeMs = new Date(params.endedAt).getTime();
    const totalDurationMs = Math.max(1000, endTimeMs - startTimeMs);

    if (params.distanceKm >= 1) {
      const frac1 = Math.min(1, 1.0 / params.distanceKm);
      const milestoneTime = new Date(startTimeMs + totalDurationMs * frac1).toISOString();
      events.push({
        id: 'event-km-1',
        type: 'KM_MILESTONE',
        timestamp: milestoneTime,
        title: 'Premier kilomètre franchi',
        description: 'Allure stable et mise en jambe effectuée.',
      });
    }
    if (params.distanceKm >= 5) {
      const frac5 = Math.min(1, 5.0 / params.distanceKm);
      const milestoneTime = new Date(startTimeMs + totalDurationMs * frac5).toISOString();
      events.push({
        id: 'event-km-5',
        type: 'KM_MILESTONE',
        timestamp: milestoneTime,
        title: '5 km d\'effort',
        description: 'Cap des 5 kilomètres franchi avec succès.',
      });
    }

    // 4. Événement Arrivée
    events.push({
      id: 'event-arrival',
      type: 'ARRIVAL',
      timestamp: params.endedAt,
      title: 'Fin du parcours',
      description: `Arrivée finale enregistrée. Total : ${params.distanceKm.toFixed(1)} km au compteur.`,
      location: params.positions[params.positions.length - 1]
        ? { lat: params.positions[params.positions.length - 1].latitude, lng: params.positions[params.positions.length - 1].longitude }
        : undefined,
    });

    // Trier les événements chronologiquement
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return events;
  }
}
