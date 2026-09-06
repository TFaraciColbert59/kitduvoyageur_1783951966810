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

