import { GPSPosition, WeatherSnapshot, POI } from '../types';

export type HikingEventType =
  | 'START'
  | 'PHOTO'
  | 'VIDEO'
  | 'VOICE_NOTE'
  | 'TEXT_NOTE'
  | 'POI'
  | 'SUMMIT'
  | 'BREAK'
  | 'WEATHER'
  | 'ALERT'
  | 'WAYPOINT'
  | 'FINISH';

export interface HikingJournalEvent {
  id: string;
  type: HikingEventType;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitudeM?: number | null;
  distanceKm: number;
  title: string;
  description?: string;
  mediaUrl?: string;
  weather?: WeatherSnapshot | null;
  identifiedSpecies?: unknown[];
  isAutomatic: boolean;
}

export class JournalEventBuilder {
  /**
   * Build START hike event.
   */
  public static createStartEvent(pos: GPSPosition, weather?: WeatherSnapshot | null): HikingJournalEvent {
    return {
      id: `evt-start-${Date.now()}`,
      type: 'START',
      timestamp: new Date(pos.timestamp).toISOString(),
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitudeM: pos.altitude != null ? Math.round(pos.altitude) : null,
      distanceKm: 0,
      title: '🥾 Départ de la randonnée',
      description: 'Début de la trace GPS',
      weather: weather || null,
      isAutomatic: true,
    };
  }

  /**
   * Build FINISH hike event.
   */
  public static createFinishEvent(
    pos: GPSPosition,
    totalDistanceKm: number,
    durationSeconds: number,
    weather?: WeatherSnapshot | null
  ): HikingJournalEvent {
    const mins = Math.round(durationSeconds / 60);
    return {
      id: `evt-finish-${Date.now()}`,
      type: 'FINISH',
      timestamp: new Date().toISOString(),
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitudeM: pos.altitude != null ? Math.round(pos.altitude) : null,
      distanceKm: totalDistanceKm,
      title: '🏁 Fin de la randonnée',
      description: `Parcours de ${totalDistanceKm.toFixed(1)} km effectué en ${mins} min.`,
      weather: weather || null,
      isAutomatic: true,
    };
  }

  /**
   * Build POI or SUMMIT reached event.
   */
  public static createPoiEvent(
    pos: GPSPosition,
    poi: POI,
    currentDistanceKm: number,
    weather?: WeatherSnapshot | null
  ): HikingJournalEvent {
    const isSummit = poi.category === 'peak' || poi.category === 'summit';
    return {
      id: `evt-poi-${Date.now()}`,
      type: isSummit ? 'SUMMIT' : 'POI',
      timestamp: new Date().toISOString(),
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitudeM: pos.altitude != null ? Math.round(pos.altitude) : null,
      distanceKm: currentDistanceKm,
      title: isSummit ? `🏔️ Sommet atteint : ${poi.name}` : `📍 Point d'intérêt : ${poi.name}`,
      description: poi.category ? `Catégorie : ${poi.category}` : undefined,
      weather: weather || null,
      isAutomatic: true,
    };
  }

  /**
   * Build BREAK / Pause event.
   */
  public static createBreakEvent(pos: GPSPosition, currentDistanceKm: number): HikingJournalEvent {
    return {
      id: `evt-break-${Date.now()}`,
      type: 'BREAK',
      timestamp: new Date().toISOString(),
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitudeM: pos.altitude != null ? Math.round(pos.altitude) : null,
      distanceKm: currentDistanceKm,
      title: '⏸️ Pause sur le parcours',
      description: 'Halte et repos',
      isAutomatic: true,
    };
  }

  /**
   * Build Manual Photo / Note event.
   */
  public static createMediaEvent(
    type: 'PHOTO' | 'VIDEO' | 'VOICE_NOTE' | 'TEXT_NOTE',
    pos: GPSPosition,
    currentDistanceKm: number,
    mediaUrl?: string,
    note?: string,
    speciesInfo?: unknown[],
    weather?: WeatherSnapshot | null
  ): HikingJournalEvent {
    const titleMap: Record<string, string> = {
      PHOTO: '📸 Photo capturée',
      VIDEO: '🎥 Vidéo capturée',
      VOICE_NOTE: '🎙️ Note vocale',
      TEXT_NOTE: '📝 Note de carnet',
    };

    return {
      id: `evt-media-${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitudeM: pos.altitude != null ? Math.round(pos.altitude) : null,
      distanceKm: currentDistanceKm,
      title: titleMap[type] || 'Moment capturé',
      description: note || undefined,
      mediaUrl,
      identifiedSpecies: speciesInfo,
      weather: weather || null,
      isAutomatic: false,
    };
  }
}
