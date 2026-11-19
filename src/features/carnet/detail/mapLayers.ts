/**
 * Couches de la carte du bas selon le tiroir actif (spec 01 § 1.3, maquette
 * `activeLayer` / `refreshMap`) : Fil → moments, Route → étapes ou nuits, Sac →
 * moments « objet du kit », Équipage → position seule. Fonctions pures : aucune
 * coordonnée n'est inventée, un point sans coordonnée réelle est simplement absent.
 */
import { isMomentType } from './momentTypes';
import type { CarnetDay, CarnetDetail, CarnetMomentItem } from './types';

export type MapSlot = 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage' | 'account';
export interface MapContext {
  slot: MapSlot;
  lensId: string;
}

export interface CarnetMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'start' | 'end' | 'moment' | 'poi' | 'night' | 'scrub';
  badge?: string;
  day?: number;
  /** Rôle d'accessibilité : un marqueur cliquable ouvre son objet. */
  momentId?: string;
}

export interface MapLayerSelection {
  markers: CarnetMapMarker[];
  /** Position en direct (participant) ou zone floue (visiteur) visibles. */
  showLive: boolean;
  /** Le tiroir est ouvert : carte en « mode contexte ». */
  contextMode: boolean;
}

const dayOf = (day: CarnetDay): number => day.dayNumber ?? day.index;

function minutesOf(time: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Position d'un moment : le point GPS du jour le plus proche de son heure ;
 * sans heure exploitable, répartition par rang dans le jour. `null` sans trace.
 */
export function momentPosition(
  day: CarnetDay | undefined,
  moment: CarnetMomentItem,
  rank: number,
  count: number
): { lat: number; lng: number } | null {
  const points = day?.points ?? [];
  if (points.length < 2) return null;
  const wanted = minutesOf(moment.time);
  if (wanted !== null) {
    let best = -1;
    let bestGap = Infinity;
    points.forEach((point, index) => {
      const at = new Date(point.at);
      if (Number.isNaN(at.getTime())) return;
      const gap = Math.abs(at.getUTCHours() * 60 + at.getUTCMinutes() - wanted);
      if (gap < bestGap) {
        bestGap = gap;
        best = index;
      }
    });
    if (best >= 0 && bestGap <= 90) return { lat: points[best].lat, lng: points[best].lng };
  }
  const index = Math.min(points.length - 1, Math.round(((rank + 0.5) / Math.max(1, count)) * (points.length - 1)));
  return { lat: points[index].lat, lng: points[index].lng };
}

function lensAllows(lensId: string, moment: CarnetMomentItem): boolean {
  const type = isMomentType(moment.type) ? moment.type : null;
  if (lensId === 'medias') return type === 'photo' || type === 'video';
  if (lensId === 'rencontres') return type === 'meet';
  if (lensId === 'nature') return type === 'species';
  return true;
}

export function selectMapLayers(input: {
  detail: Pick<CarnetDetail, 'days' | 'etapes' | 'nights' | 'moments'>;
  activeDay: number;
  context: MapContext | null;
  scrub?: { lat: number; lng: number } | null;
}): MapLayerSelection {
  const { detail, activeDay, context, scrub } = input;
  const markers: CarnetMapMarker[] = [];
  const slot = context?.slot ?? 'closed';
  const lensId = context?.lensId ?? '';
  const days = detail.days
    .filter((d) => d.points.length >= 2)
    .filter((d) => activeDay <= 0 || dayOf(d) === activeDay)
    .sort((a, b) => dayOf(a) - dayOf(b));

  /* Départ / arrivée : du jour affiché, sinon du carnet entier. */
  if (slot === 'closed' && days.length > 0) {
    const first = days[0].points[0];
    const lastDay = days[days.length - 1];
    const last = lastDay.points[lastDay.points.length - 1];
    markers.push({ id: 'trace-start', lat: first.lat, lng: first.lng, title: 'Départ', type: 'start' });
    if (Math.abs(first.lat - last.lat) + Math.abs(first.lng - last.lng) > 1e-4) {
      markers.push({ id: 'trace-end', lat: last.lat, lng: last.lng, title: 'Arrivée', type: 'end' });
    }
  }

  /* Moments : fermé (jour affiché), Fil (selon la lentille), Sac (objets du kit). */
  const wantMoments = (slot === 'closed' && activeDay > 0) || slot === 'fil' || slot === 'sac';
  if (wantMoments) {
    for (const day of days) {
      const number = dayOf(day);
      const ofDay = detail.moments.filter((m) => m.dayNumber === number);
      ofDay.forEach((moment, rank) => {
        if (slot === 'sac' && moment.type !== 'kit') return;
        if (slot === 'fil' && !lensAllows(lensId, moment)) return;
        const position = momentPosition(day, moment, rank, ofDay.length);
        if (!position) return;
        markers.push({
          id: `moment-${moment.id}`,
          lat: position.lat,
          lng: position.lng,
          title: [moment.place, moment.time].filter(Boolean).join(', ') || 'Moment',
          type: 'moment',
          day: number,
          momentId: moment.id,
        });
      });
    }
  }

  /* Étapes (Route sauf Météo) ou nuits (Route › Nuit, et carnet entier fermé). */
  const wantNights = (slot === 'route' && lensId === 'nuits') || (slot === 'closed' && activeDay <= 0);
  const wantEtapes = slot === 'route' && lensId !== 'nuits' && lensId !== 'meteo';
  if (wantNights) {
    for (const night of detail.nights ?? []) {
      if (activeDay > 0 && night.dayNumber !== activeDay) continue;
      if (night.lat == null || night.lng == null) continue;
      markers.push({
        id: `night-${night.id}`,
        lat: night.lat,
        lng: night.lng,
        title: night.name,
        type: 'night',
        badge: `N${night.dayNumber}`,
        day: night.dayNumber,
      });
    }
  }
  if (wantEtapes) {
    for (const day of days) {
      const number = dayOf(day);
      const etape = detail.etapes.find((e) => e.dayNumber === number);
      const first = day.points[0];
      const last = day.points[day.points.length - 1];
      markers.push({
        id: `poi-${number}-from`,
        lat: first.lat,
        lng: first.lng,
        title: etape?.from ?? `Départ J${number}`,
        type: 'poi',
        day: number,
      });
      markers.push({
        id: `poi-${number}-to`,
        lat: last.lat,
        lng: last.lng,
        title: etape?.to ?? `Arrivée J${number}`,
        type: 'poi',
        day: number,
      });
    }
  }

  if (scrub) {
    markers.push({ id: 'scrub', lat: scrub.lat, lng: scrub.lng, title: 'Point du profil', type: 'scrub' });
  }

  return {
    markers,
    showLive: slot !== 'sac',
    contextMode: context !== null,
  };
}

export interface DayTrace {
  day: number;
  coordinates: Array<[number, number]>;
}

/** Une trace par jour (≥ 2 points réels) ; vide si aucun jour ne porte de point. */
export function buildDayTraces(days: CarnetDay[]): DayTrace[] {
  return days
    .filter((d) => d.points.length >= 2)
    .map((d) => ({
      day: dayOf(d),
      coordinates: d.points.map((p): [number, number] => [p.lng, p.lat]),
    }))
    .sort((a, b) => a.day - b.day);
}
