import type { Carte3DTrail, Carte3DWaypoint } from '../types';
import { buildElevationProfile } from './elevationEngine';
import { HikeEngine } from '@/features/hiking/engine/HikeEngine';

/**
 * Parser GPX haute-fidélité pour la Carte 3D vivante.
 * Compatible avec les fichiers GPX 1.0 et 1.1 générés par Garmin, Strava, Komoot, LKDV.
 */

export interface GPXParseResult {
  success: boolean;
  trail?: Carte3DTrail;
  error?: string;
}

export function parseGPXStringToTrail(gpxXml: string, fallbackName = 'Tracé GPX Importé'): GPXParseResult {
  if (!gpxXml || typeof gpxXml !== 'string' || gpxXml.trim().length === 0) {
    return { success: false, error: 'Contenu GPX vide.' };
  }

  try {
    if (typeof DOMParser === 'undefined') {
      return { success: false, error: 'DOMParser non disponible dans cet environnement.' };
    }
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxXml, 'application/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      return { success: false, error: 'Format GPX invalide ou fichier XML corrompu.' };
    }

    // Nom et description
    const nameEl =
      xmlDoc.querySelector('trk > name') ||
      xmlDoc.querySelector('metadata > name') ||
      xmlDoc.querySelector('gpx > name');
    const descEl =
      xmlDoc.querySelector('trk > desc') ||
      xmlDoc.querySelector('metadata > desc') ||
      xmlDoc.querySelector('gpx > desc');
    const name = nameEl?.textContent?.trim() || fallbackName;
    const description = descEl?.textContent?.trim() || undefined;

    // Coordonnées du tracé (<trkpt> ou <rtept>)
    const ptNodes = xmlDoc.querySelectorAll('trkpt, rtept');
    if (ptNodes.length === 0) {
      return { success: false, error: 'Aucun point de trace (<trkpt> ou <rtept>) trouvé dans le fichier GPX.' };
    }

    const coordinates: [number, number, number?][] = [];
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    ptNodes.forEach((node) => {
      const latAttr = node.getAttribute('lat');
      const lonAttr = node.getAttribute('lon');
      if (!latAttr || !lonAttr) return;

      const lat = parseFloat(latAttr);
      const lon = parseFloat(lonAttr);
      if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

      const eleEl = node.querySelector('ele');
      const ele = eleEl ? parseFloat(eleEl.textContent || '') : undefined;
      const validEle = ele != null && !isNaN(ele) ? Math.round(ele) : undefined;

      coordinates.push(validEle !== undefined ? [lon, lat, validEle] : [lon, lat]);

      if (lon < minLng) minLng = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLng) maxLng = lon;
      if (lat > maxLat) maxLat = lat;
    });

    if (coordinates.length < 2) {
      return { success: false, error: 'Le tracé GPX doit contenir au moins 2 coordonnées valides.' };
    }

    // Waypoints (<wpt>)
    const wptNodes = xmlDoc.querySelectorAll('wpt');
    const waypoints: Carte3DWaypoint[] = [];

    wptNodes.forEach((node, index) => {
      const latAttr = node.getAttribute('lat');
      const lonAttr = node.getAttribute('lon');
      if (!latAttr || !lonAttr) return;

      const lat = parseFloat(latAttr);
      const lon = parseFloat(lonAttr);
      if (isNaN(lat) || isNaN(lon)) return;

      const wptName = node.querySelector('name')?.textContent?.trim() || `Point d'intérêt ${index + 1}`;
      const wptDesc = node.querySelector('desc')?.textContent?.trim();
      const wptEle = node.querySelector('ele');
      const altitudeM = wptEle ? parseFloat(wptEle.textContent || '0') : 1000;
      const sym = (node.querySelector('sym')?.textContent || '').toLowerCase();
      const type = (node.querySelector('type')?.textContent || '').toLowerCase();

      let category: Carte3DWaypoint['category'] = 'viewpoint';
      const lowerName = wptName.toLowerCase();
      if (
        sym.includes('summit') ||
        sym.includes('peak') ||
        type.includes('summit') ||
        type.includes('peak') ||
        lowerName.includes('sommet') ||
        lowerName.includes('mont') ||
        lowerName.includes('aiguille') ||
        lowerName.includes('pic') ||
        lowerName.includes('cime')
      ) {
        category = 'summit';
      } else if (
        sym.includes('lodge') ||
        sym.includes('refuge') ||
        type.includes('refuge') ||
        type.includes('lodge') ||
        lowerName.includes('refuge') ||
        lowerName.includes('cabane') ||
        lowerName.includes('gite') ||
        lowerName.includes('rifugio')
      ) {
        category = 'refuge';
      } else if (
        sym.includes('water') ||
        sym.includes('spring') ||
        type.includes('water') ||
        type.includes('spring') ||
        lowerName.includes('eau') ||
        lowerName.includes('source') ||
        lowerName.includes('fontaine')
      ) {
        category = 'water';
      } else if (sym.includes('pass') || lowerName.includes('col') || lowerName.includes('breche') || lowerName.includes('brèche')) {
        category = 'pass';
      }

      waypoints.push({
        id: `wpt-${index + 1}`,
        name: wptName,
        category,
        lat,
        lng: lon,
        altitudeM: Math.round(altitudeM),
        distanceKm: 0, // Sera indexé lors du mapping au tracé
        details: wptDesc,
      });
    });

    const elevationResult = buildElevationProfile(coordinates);

    // Indexation précise de chaque waypoint le long du tracé
    for (const wpt of waypoints) {
      let bestDistKm = 0;
      let minDistance = Infinity;

      for (const pt of elevationResult.elevationProfile) {
        const d = HikeEngine.calculateDistanceKm(wpt.lat, wpt.lng, pt.coord[1], pt.coord[0]);
        if (d < minDistance) {
          minDistance = d;
          bestDistKm = pt.distanceKm;
          if (wpt.altitudeM === 0 || wpt.altitudeM === 1000) {
            wpt.altitudeM = pt.elevationM;
          }
        }
      }
      wpt.distanceKm = Math.round(bestDistKm * 100) / 100;
    }

    // Si aucun waypoint n'était présent dans le GPX, détection automatique des sommets majeurs
    if (waypoints.length === 0 && elevationResult.elevationProfile.length >= 5) {
      const profile = elevationResult.elevationProfile;
      for (let i = 2; i < profile.length - 2; i++) {
        const current = profile[i];
        const isPeak =
          current.elevationM > profile[i - 1].elevationM &&
          current.elevationM > profile[i - 2].elevationM &&
          current.elevationM > profile[i + 1].elevationM &&
          current.elevationM > profile[i + 2].elevationM &&
          current.elevationM > elevationResult.minElevationM + 60;

        if (isPeak) {
          waypoints.push({
            id: `auto-summit-${i}`,
            name:
              current.elevationM === elevationResult.maxElevationM
                ? 'Point Culminant'
                : `Sommet ${current.elevationM}m`,
            category: 'summit',
            lat: current.coord[1],
            lng: current.coord[0],
            altitudeM: current.elevationM,
            distanceKm: current.distanceKm,
            details: `Point culminant local à ${current.elevationM} m d'altitude.`,
          });
          i += 4;
        }
      }
    }

    waypoints.sort((a, b) => a.distanceKm - b.distanceKm);

    // Bbox avec marge minimale
    const padLng = Math.max(0.01, (maxLng - minLng) * 0.08);
    const padLat = Math.max(0.01, (maxLat - minLat) * 0.08);
    const bounds: [number, number, number, number] = [
      minLng - padLng,
      minLat - padLat,
      maxLng + padLng,
      maxLat + padLat,
    ];

    const trail: Carte3DTrail = {
      id: `gpx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      massif: 'Personnalisé',
      country: 'Monde',
      distanceKm: elevationResult.distanceKm,
      elevationGainM: elevationResult.elevationGainM,
      elevationLossM: elevationResult.elevationLossM,
      minElevationM: elevationResult.minElevationM,
      maxElevationM: elevationResult.maxElevationM,
      estimatedDurationHours: elevationResult.estimatedDurationHours,
      bounds,
      coordinates,
      elevationProfile: elevationResult.elevationProfile,
      waypoints,
      description,
      isCustomGpx: true,
    };

    return { success: true, trail };
  } catch (err) {
    return {
      success: false,
      error: `Erreur lors de l'analyse du fichier GPX: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
