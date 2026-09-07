import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * Échappe les entités XML pour garantir la validité du flux GPX
 */
export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Génère un export GPX 1.1 conforme aux standards Garmin / OSM
 * - Waypoints pour chaque étape et POI géolocalisé
 * - Track ordonné chronologiquement par jour et index d'étape
 */
export function generateTripGpx(trip: TripFull): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<gpx version="1.1" creator="Le Kit du Voyageur - https://lekitduvoyageur.fr" ' +
      'xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">'
  );

  // 1. Métadonnées du voyage
  lines.push('  <metadata>');
  lines.push(`    <name>${escapeXml(trip.title)}</name>`);
  if (trip.description) {
    lines.push(`    <desc>${escapeXml(trip.description)}</desc>`);
  }
  lines.push(`    <time>${new Date().toISOString()}</time>`);
  lines.push('  </metadata>');

  // 2. Waypoints (Étapes avec coordonnées)
  const sortedSteps = [...(trip.steps || [])].sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number;
    return a.order_index - b.order_index;
  });

  for (const step of sortedSteps) {
    if (typeof step.latitude === 'number' && typeof step.longitude === 'number') {
      lines.push(`  <wpt lat="${step.latitude}" lon="${step.longitude}">`);
      lines.push(`    <name>${escapeXml(step.title)}</name>`);
      if (step.description || step.accommodation_name) {
        const desc = [step.description, step.accommodation_name ? `Hébergement : ${step.accommodation_name}` : '']
          .filter(Boolean)
          .join(' — ');
        lines.push(`    <desc>${escapeXml(desc)}</desc>`);
      }
      lines.push(`    <type>Etape-J${step.day_number}</type>`);
      lines.push('  </wpt>');
    }
  }

  // 3. Waypoints additionnels (POIs)
  for (const poi of trip.pois || []) {
    if (typeof poi.latitude === 'number' && typeof poi.longitude === 'number') {
      lines.push(`  <wpt lat="${poi.latitude}" lon="${poi.longitude}">`);
      lines.push(`    <name>${escapeXml(poi.name)}</name>`);
      if (poi.notes) {
        lines.push(`    <desc>${escapeXml(poi.notes)}</desc>`);
      }
      if (poi.category) {
        lines.push(`    <type>${escapeXml(poi.category)}</type>`);
      }
      lines.push('  </wpt>');
    }
  }

  // 4. Trace (Track) continue
  const trackSteps = sortedSteps.filter(
    s => typeof s.latitude === 'number' && typeof s.longitude === 'number'
  );

  if (trackSteps.length > 0) {
    lines.push('  <trk>');
    lines.push(`    <name>${escapeXml(trip.title)} - Itinéraire complet</name>`);
    lines.push('    <trkseg>');
    for (const s of trackSteps) {
      lines.push(`      <trkpt lat="${s.latitude}" lon="${s.longitude}">`);
      lines.push(`        <name>${escapeXml(s.title)}</name>`);
      if (typeof s.elevation_gain_m === 'number') {
        lines.push(`        <ele>${s.elevation_gain_m}</ele>`);
      }
      lines.push('      </trkpt>');
    }
    lines.push('    </trkseg>');
    lines.push('  </trk>');
  }

  lines.push('</gpx>');
  return lines.join('\n');
}

export type DocumentExpiryStatus = 'valid' | 'warning' | 'expired' | 'none';

export interface DocumentExpiryCheck {
  status: DocumentExpiryStatus;
  daysRemaining: number | null;
  label: string;
}

/**
 * Évalue la validité d'un document de voyage (ex: passeport, visa, assurance).
 * Avertit si expiration dans moins de 180 jours (seuil international de 6 mois pour passeport).
 */
export function checkDocumentExpiry(
  doc: { expires_at: string | null },
  referenceDate: Date = new Date()
): DocumentExpiryCheck {
  if (!doc.expires_at) {
    return {
      status: 'none',
      daysRemaining: null,
      label: 'Aucune échéance requise',
    };
  }

  const expiry = new Date(doc.expires_at);
  const diffMs = expiry.getTime() - referenceDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      status: 'expired',
      daysRemaining: days,
      label: `Expiré depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`,
    };
  }

  if (days <= 180) {
    return {
      status: 'warning',
      daysRemaining: days,
      label: `Expire dans ${days} jour${days > 1 ? 's' : ''} (règle des 6 mois)`,
    };
  }

  return {
    status: 'valid',
    daysRemaining: days,
    label: `Valide (${days} jours restants)`,
  };
}

/**
 * Construit l'URL canonique de partage pour un voyage
 */
export function formatTripShareUrl(
  slug: string,
  shareToken?: string | null,
  origin = ''
): string {
  const base = origin.replace(/\/$/, '');
  const tokenQuery = shareToken ? `?token=${encodeURIComponent(shareToken)}` : '';
  return `${base}/voyages/${slug}${tokenQuery}`;
}

export interface ParsedWaypoint {
  name: string;
  lat: number;
  lon: number;
  ele?: number;
  desc?: string;
  type?: string;
}

export interface ParsedTrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

export interface SuggestedTripStep {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  distance_km?: number;
}

export interface ParsedTripGpx {
  isValid: boolean;
  title: string;
  description: string;
  waypoints: ParsedWaypoint[];
  trackPoints: ParsedTrackPoint[];
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  suggestedSteps: SuggestedTripStep[];
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse un fichier GPX 1.1 universellement (Node.js et navigateur)
 * Extrait les métadonnées, waypoints, points de trace, calcule distance et dénivelés,
 * et génère des étapes de voyage directement exploitables.
 */
export function parseTripGpx(xmlString: string): ParsedTripGpx {
  const emptyResult: ParsedTripGpx = {
    isValid: false,
    title: '',
    description: '',
    waypoints: [],
    trackPoints: [],
    totalDistanceKm: 0,
    totalElevationGainM: 0,
    totalElevationLossM: 0,
    suggestedSteps: [],
  };

  if (!xmlString || typeof xmlString !== 'string' || !xmlString.includes('<gpx')) {
    return emptyResult;
  }

  try {
    // 1. Extraction du Titre
    const metaMatch = xmlString.match(/<metadata>([\s\S]*?)<\/metadata>/i);
    const metaContent = metaMatch ? metaMatch[1] : xmlString;

    const titleMatch =
      metaContent.match(/<name>(.*?)<\/name>/i) ||
      xmlString.match(/<trk>[\s\S]*?<name>(.*?)<\/name>/i) ||
      xmlString.match(/<name>(.*?)<\/name>/i);
    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim() : 'Tracé GPX importé';

    // 2. Extraction de la Description
    const descMatch =
      metaContent.match(/<desc>([\s\S]*?)<\/desc>/i) ||
      xmlString.match(/<trk>[\s\S]*?<desc>([\s\S]*?)<\/desc>/i);
    const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim() : '';

    // 3. Extraction des Waypoints (<wpt>)
    const waypoints: ParsedWaypoint[] = [];
    const wptRegex = /<wpt\s+[^>]*?lat="([^"]+)"[^>]*?lon="([^"]+)"[^>]*?>([\s\S]*?)<\/wpt>/gi;
    let wptMatch: RegExpExecArray | null;

    while ((wptMatch = wptRegex.exec(xmlString)) !== null) {
      const lat = parseFloat(wptMatch[1]);
      const lon = parseFloat(wptMatch[2]);
      const body = wptMatch[3];

      const nameM = body.match(/<name>(.*?)<\/name>/i);
      const descM = body.match(/<desc>(.*?)<\/desc>/i);
      const typeM = body.match(/<type>(.*?)<\/type>/i);
      const eleM = body.match(/<ele>(.*?)<\/ele>/i);

      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push({
          name: nameM ? nameM[1].trim() : `Point ${waypoints.length + 1}`,
          lat,
          lon,
          desc: descM ? descM[1].trim() : undefined,
          type: typeM ? typeM[1].trim() : undefined,
          ele: eleM ? parseFloat(eleM[1]) : undefined,
        });
      }
    }

    // 4. Extraction des Trackpoints (<trkpt>)
    const trackPoints: ParsedTrackPoint[] = [];
    const trkptRegex = /<trkpt\s+[^>]*?lat="([^"]+)"[^>]*?lon="([^"]+)"[^>]*?>([\s\S]*?)<\/trkpt>/gi;
    let trkMatch: RegExpExecArray | null;

    while ((trkMatch = trkptRegex.exec(xmlString)) !== null) {
      const lat = parseFloat(trkMatch[1]);
      const lon = parseFloat(trkMatch[2]);
      const body = trkMatch[3];

      const eleM = body.match(/<ele>(.*?)<\/ele>/i);
      const timeM = body.match(/<time>(.*?)<\/time>/i);

      if (!isNaN(lat) && !isNaN(lon)) {
        trackPoints.push({
          lat,
          lon,
          ele: eleM ? parseFloat(eleM[1]) : undefined,
          time: timeM ? timeM[1].trim() : undefined,
        });
      }
    }

    // 5. Calcul des Métriques (Distance cumulée, D+, D-)
    let totalDistanceKm = 0;
    let totalElevationGainM = 0;
    let totalElevationLossM = 0;

    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1];
      const curr = trackPoints[i];

      totalDistanceKm += haversineDistanceKm(prev.lat, prev.lon, curr.lat, curr.lon);

      if (typeof prev.ele === 'number' && typeof curr.ele === 'number') {
        const diff = curr.ele - prev.ele;
        if (diff > 0) {
          totalElevationGainM += diff;
        } else {
          totalElevationLossM += Math.abs(diff);
        }
      }
    }

    // Arrondi propre
    totalDistanceKm = Math.round(totalDistanceKm * 100) / 100;
    totalElevationGainM = Math.round(totalElevationGainM);
    totalElevationLossM = Math.round(totalElevationLossM);

    // 6. Génération des étapes suggérées
    const suggestedSteps: SuggestedTripStep[] = [];

    if (waypoints.length > 0) {
      waypoints.forEach((wpt) => {
        suggestedSteps.push({
          title: wpt.name,
          description: wpt.desc,
          latitude: wpt.lat,
          longitude: wpt.lon,
        });
      });
    } else if (trackPoints.length > 0) {
      // Si pas de waypoints explicites, créer une étape de départ et une étape d'arrivée
      suggestedSteps.push({
        title: `${title} - Départ`,
        latitude: trackPoints[0].lat,
        longitude: trackPoints[0].lon,
        elevation_gain_m: totalElevationGainM,
        distance_km: totalDistanceKm,
      });

      if (trackPoints.length > 1) {
        const last = trackPoints[trackPoints.length - 1];
        suggestedSteps.push({
          title: `${title} - Arrivée`,
          latitude: last.lat,
          longitude: last.lon,
        });
      }
    }

    return {
      isValid: true,
      title,
      description,
      waypoints,
      trackPoints,
      totalDistanceKm,
      totalElevationGainM,
      totalElevationLossM,
      suggestedSteps,
    };
  } catch (err) {
    console.warn('[GPX] Erreur de parsing GPX:', err);
    return emptyResult;
  }
}

