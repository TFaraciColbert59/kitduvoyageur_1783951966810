import { mergeBounds } from './geometry';
import { filterTracksForMode } from './modes';
import type { CompteMapMode, CompteMapPayload, MapBounds } from './types';

export type MapScale = 'globe' | 'massif' | 'sentier';

export interface CameraFocus {
  lng: number;
  lat: number;
}

export interface CameraPose {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export function cameraForScale(scale: MapScale, focus: CameraFocus): CameraPose {
  if (scale === 'globe') {
    return { center: [focus.lng, focus.lat], zoom: 2.2, pitch: 0, bearing: 0 };
  }
  if (scale === 'massif') {
    return { center: [focus.lng, focus.lat], zoom: 8.5, pitch: 30, bearing: -15 };
  }
  return { center: [focus.lng, focus.lat], zoom: 12.8, pitch: 55, bearing: -25 };
}

export function paddingForViewport(
  rect: { width: number; height: number },
  options: { sheetOpen: boolean; mapbig: boolean }
): { top: number; bottom: number; left: number; right: number } {
  if (options.mapbig) return { top: 100, bottom: 84, left: 16, right: 16 };
  if (options.sheetOpen) return { top: 56, bottom: 56, left: 16, right: 16 };
  return { top: 64, bottom: 76, left: 16, right: 16 };
}

export function centerOfBounds(bounds: MapBounds): CameraFocus {
  return {
    lng: (bounds[0] + bounds[2]) / 2,
    lat: (bounds[1] + bounds[3]) / 2,
  };
}

export function fitIntentForMode(
  mode: CompteMapMode,
  data: CompteMapPayload,
  selectedId?: string | null
): { bounds: MapBounds; maxZoom: number } | null {
  if (mode === 'sortie') {
    const track = data.tracks.find((entry) => entry.id === selectedId);
    return track ? { bounds: track.bounds, maxZoom: 14 } : null;
  }
  if (mode === 'prets' || mode === 'compte' || mode === 'reseau') return null;
  if (mode === 'overview' || mode === 'vitrine') {
    // Aperçu large dès l'arrivée : toute l'empreinte (massifs, POI, carnets)
    // détermine le cadrage. Les marqueurs détaillés n'apparaissent qu'en zoomant.
    if (data.bounds) return { bounds: data.bounds, maxZoom: 6.2 };
  }
  if (mode === 'kit' || mode === 'communaute' || mode === 'souvenirs') {
    const visible = filterTracksForMode(data.tracks, mode, selectedId);
    const bounds = mergeBounds(visible.map((track) => track.bounds));
    return bounds ? { bounds, maxZoom: 12 } : null;
  }
  if (data.bounds) return { bounds: data.bounds, maxZoom: 11 };
  return null;
}
