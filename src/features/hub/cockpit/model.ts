import { routeLines } from '@/features/explorer-v2/geo/track';
import type { HubAdventureData } from '../server/getHubAdventureData';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { CarnetKitItemRow } from '@/features/carnet/detail/types';
import { rainLabel, weatherLabel } from '@/features/materiel/services/getWeather';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { currentCockpitDay } from './day';

export type Coordinate = [longitude: number, latitude: number];

export interface CockpitStep {
  id: string;
  title: string;
  day: number;
  time: string | null;
  place: string | null;
  distance: number | null;
  elevation: number | null;
  description: string | null;
  coordinate: Coordinate | null;
}

export interface CockpitWeatherDay {
  date: string;
  day: string;
  low: number | null;
  high: number | null;
  condition: string | null;
  wind?: number | null;
  rain?: number | null;
  hours?: { time: string; temperature: number | null; wind: number | null; rain: number | null }[];
}

export interface CockpitReservation {
  id: string;
  title: string;
  status: 'À réserver' | 'En attente' | 'À vérifier';
  due: string | null;
  when?: string | null;
  stepId?: string;
  partnerSlug?: string;
}

export interface CockpitExpense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  date?: string | null;
  planned?: boolean;
  category?: string | null;
  payer?: string | null;
}

export interface CockpitData {
  key: string;
  title: string;
  location: string | null;
  today: number | null;
  dayCount: number | null;
  startDate?: string | null;
  weatherPoint?: Coordinate | null;
  weather: {
    temperature: number;
    weatherCode?: number;
    condition: string;
    place: string | null;
    rain: string | null;
    days: CockpitWeatherDay[];
    observedAt?: string;
    source?: string;
  } | null;
  budget: {
    planned: { currency: string; amount: number } | null;
    expenses: CockpitExpense[];
  } | null;
  route: Coordinate[][];
  clubRouteUpdates?: {
    eventId: string;
    title: string;
    revision: number;
    adoptedRevision: number | null;
    decisionPending: boolean;
  }[];
  distance: number | null;
  elevation: number | null;
  steps: CockpitStep[];
  notes: { id: string; title: string | null; content: string; day: number | null }[];
  kit: { id: string; title: string; amount: number; packed: boolean; day?: number | null }[];
  documents: { id: string; title: string; category: string; expiration: string | null }[] | null;
  people: { id: string; name: string | null; role: string; avatar?: string | null; handle?: string | null }[];
  peopleCount: number | null;
  pending: number;
  trip: boolean;
  collective: boolean;
  confirmedParticipant?: boolean;
  canEdit?: boolean;
  unavailableSections?: TripFull['unavailableSections'];
  carnetUnavailable?: boolean;
  carnetKitItems?: CarnetKitItemRow[];
  canCreateCarnet?: boolean;
  reservations?: CockpitReservation[] | null;
  carnet?: { id: string; editable: boolean; moments: { id: string; title: string; day: number | null; time?: string | null; media?: string | null; audio?: string | null; type?: string | null }[] } | null;
  kitId?: string | null;
  kitName?: string | null;
}

function coordinate(lng: number | null, lat: number | null): Coordinate | null {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? [lng, lat]
    : null;
}

export function buildCockpit(data: HubAdventureData): CockpitData {
  const { trip, hiking, group, adventure } = data;
  const phase = trip ? getTripPhaseDetails(trip) : null;
  const steps = (trip?.steps ?? []).map((step) => ({
    id: step.id,
    title: step.title,
    day: step.day_number,
    time: /^\d{2}:\d{2}/.test(step.start_time ?? '') ? step.start_time!.slice(0, 5) : null,
    place: step.location_name,
    distance: step.distance_km,
    elevation: step.elevation_gain_m,
    description: step.description,
    coordinate: coordinate(step.longitude, step.latitude),
    order: step.order_index,
  })).sort((a, b) => a.day - b.day || a.order - b.order);
  const forecast = hiking?.weather;
  const current = forecast?.current;
  const weather = forecast && current && Number.isFinite(current.tempC) ? {
    temperature: current.tempC,
    weatherCode: current.weathercode,
    condition: weatherLabel(current.weathercode),
    rain: rainLabel(current.precipPct, current.precipMm),
    place: forecast.locationLabel,
    days: forecast.days.map((day) => ({
      date: day.date, day: day.day, low: day.tempMinC, high: day.tempMaxC,
      condition: weatherLabel(day.weathercode),
    })),
  } : null;

  const expenses: NonNullable<CockpitData['budget']>['expenses'] = [];
  if (trip?.permissions.canManageBudget) {
    for (const row of trip.expenses.slice().sort((a, b) =>
      (b.expense_date ?? '').localeCompare(a.expense_date ?? '') || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))) {
      if (row.amount == null || !Number.isFinite(Number(row.amount))) continue;
      const amount = Number(row.amount);
      expenses.push({
        id: row.id, title: row.title, amount, currency: row.currency,
        date: row.expense_date, planned: row.is_planned, category: row.category, payer: row.payer?.full_name,
      });
    }
  }

  const people = new Map<string, CockpitData['people'][number]>();
  if (trip) people.set(trip.user_id, { id: trip.user_id, name: null, role: 'Responsable' });
  if (trip?.confirmed_participant) {
    const { userId } = trip.confirmed_participant;
    people.set(userId, { id: userId, name: null, role: 'Participant' });
  }
  for (const member of trip?.collaborators ?? []) {
    const role = member.user_id === trip?.user_id || member.role === 'owner' ? 'Responsable' : 'Collaborateur';
    people.set(member.user_id, {
      id: member.user_id, name: member.profile?.full_name ?? member.profile?.username ?? null, role,
      avatar: member.profile?.avatar_url, handle: member.profile?.username,
    });
  }
  for (const member of group?.members ?? []) {
    if (member.status !== 'active') continue;
    const saved = people.get(member.userId);
    people.set(member.userId, {
      id: member.userId, name: member.fullName ?? saved?.name ?? null, role: saved?.role ?? 'Participant',
      avatar: member.avatarUrl ?? saved?.avatar, handle: saved?.handle,
    });
  }

  // Les créations de parcours et Compas utilisent les mêmes coordonnées enregistrées.
  // Ne joint pas les tronçons discontinus et ne transforme pas les repères en trace.
  const route = routeLines(hiking?.routeGeojson).slice(0, 20).map((line) => {
    const stride = Math.max(1, Math.ceil(line.length / 180));
    return line.filter((_, index) => index % stride === 0 || index === line.length - 1)
      .map(([lng, lat]): Coordinate => [lng, lat]);
  });

  const dayCount = phase?.totalDays ?? steps.at(-1)?.day ?? null;
  return {
    key: trip?.id ?? (adventure.nature === 'collectif' ? adventure.id : 'possession'),
    title: trip?.title ?? data.groupLabel ?? 'Mes aventures',
    location: trip?.destination_name ?? null,
    today: trip ? currentCockpitDay(trip.start_date, dayCount) : null,
    dayCount,
    startDate: trip?.start_date,
    weather, route, steps,
    weatherPoint: hiking?.coords ? coordinate(hiking.coords.lon, hiking.coords.lat) :
      hiking?.weather?.point ? coordinate(hiking.weather.point.lon, hiking.weather.point.lat) : steps.find((step) => step.coordinate)?.coordinate,
    distance: hiking?.distanceKm ?? null,
    elevation: hiking?.elevationGainM ?? null,
    budget: trip?.permissions.canManageBudget ? {
      planned: trip.estimated_budget == null ? null : { currency: trip.budget_currency, amount: Number(trip.estimated_budget) },
      expenses,
    } : null,
    notes: (trip?.notes ?? []).map(({ id, title, content, day_number }) =>
      ({ id, title, content: content.slice(0, 500), day: day_number })),
    kit: (trip?.items ?? []).map(({ id, item_name, quantity, is_packed, day_number }) =>
      ({ id, title: item_name, amount: quantity, packed: is_packed, day: day_number })),
    documents: trip?.permissions.canViewDocuments ? trip.documents.map(({ id, title, category, expires_at }) =>
      ({ id, title, category, expiration: expires_at })) : null,
    people: Array.from(people.values()),
    peopleCount: (trip || group) && !trip?.confirmed_participant ? Math.max(people.size, group?.memberCount ?? 0) : null,
    confirmedParticipant: Boolean(trip?.confirmed_participant),
    pending: group?.pendingInvites ?? data.pendingInvites,
    trip: Boolean(trip),
    collective: adventure.nature === 'collectif',
    canEdit: trip?.permissions.canEdit,
    unavailableSections: trip?.unavailableSections,
    kitId: trip?.kit_id,
  };
}
