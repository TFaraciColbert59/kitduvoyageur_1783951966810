import { routeLines } from '@/features/explorer-v2/geo/track';
import type { HubAdventureData } from '../server/getHubAdventureData';
import { rainLabel, weatherLabel } from '@/features/materiel/services/getWeather';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';

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

export interface CockpitData {
  key: string;
  title: string;
  location: string | null;
  today: number | null;
  dayCount: number | null;
  weather: {
    temperature: number;
    condition: string;
    place: string | null;
    rain: string | null;
    days: { date: string; day: string; low: number; high: number; condition: string }[];
  } | null;
  budget: {
    spent: { currency: string; amount: number }[];
    planned: { currency: string; amount: number } | null;
    expenses: { id: string; title: string; amount: number; currency: string }[];
  } | null;
  route: Coordinate[][];
  distance: number | null;
  elevation: number | null;
  steps: CockpitStep[];
  notes: { id: string; title: string | null; content: string; day: number | null }[];
  kit: { id: string; title: string; amount: number; packed: boolean }[];
  documents: { id: string; title: string; category: string; expiration: string | null }[] | null;
  people: { id: string; name: string | null; role: string }[];
  peopleCount: number | null;
  pending: number;
  trip: boolean;
  collective: boolean;
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
    condition: weatherLabel(current.weathercode),
    rain: rainLabel(current.precipPct, current.precipMm),
    place: forecast.locationLabel,
    days: forecast.days.map((day) => ({
      date: day.date, day: day.day, low: day.tempMinC, high: day.tempMaxC,
      condition: weatherLabel(day.weathercode),
    })),
  } : null;

  const amounts = new Map<string, number>();
  const expenses: NonNullable<CockpitData['budget']>['expenses'] = [];
  if (trip?.permissions.canManageBudget) {
    for (const row of trip.expenses) {
      if (row.is_planned || !Number.isFinite(Number(row.amount))) continue;
      const amount = Number(row.amount);
      amounts.set(row.currency, (amounts.get(row.currency) ?? 0) + amount);
      if (expenses.length < 8) expenses.push({ id: row.id, title: row.title, amount, currency: row.currency });
    }
  }

  const people = new Map<string, CockpitData['people'][number]>();
  if (trip) people.set(trip.user_id, { id: trip.user_id, name: null, role: 'Responsable' });
  for (const member of trip?.collaborators ?? []) {
    const role = member.user_id === trip?.user_id || member.role === 'owner' ? 'Responsable' : 'Collaborateur';
    people.set(member.user_id, { id: member.user_id, name: member.profile?.full_name ?? member.profile?.username ?? null, role });
  }
  for (const member of group?.members ?? []) {
    if (member.status !== 'active' && !people.has(member.userId)) continue;
    const saved = people.get(member.userId);
    people.set(member.userId, { id: member.userId, name: member.fullName ?? saved?.name ?? null, role: saved?.role ?? 'Participant' });
  }

  // Les créations de parcours et Compas utilisent les mêmes coordonnées enregistrées.
  // Ne joint pas les tronçons discontinus et ne transforme pas les repères en trace.
  const route = routeLines(hiking?.routeGeojson).slice(0, 20).map((line) => {
    const stride = Math.max(1, Math.ceil(line.length / 180));
    return line.filter((_, index) => index % stride === 0 || index === line.length - 1)
      .map(([lng, lat]): Coordinate => [lng, lat]);
  });

  return {
    key: trip?.id ?? (adventure.nature === 'collectif' ? adventure.id : 'possession'),
    title: trip?.title ?? data.groupLabel ?? 'Mes aventures',
    location: trip?.destination_name ?? null,
    today: trip?.status === 'active' ? phase?.dayIndex ?? null : null,
    dayCount: phase?.totalDays ?? steps.at(-1)?.day ?? null,
    weather, route, steps,
    distance: hiking?.distanceKm ?? null,
    elevation: hiking?.elevationGainM ?? null,
    budget: trip?.permissions.canManageBudget ? {
      spent: Array.from(amounts, ([currency, amount]) => ({ amount, currency })),
      planned: trip.estimated_budget == null ? null : { currency: trip.budget_currency, amount: Number(trip.estimated_budget) },
      expenses,
    } : null,
    notes: (trip?.notes ?? []).slice(0, 8).map(({ id, title, content, day_number }) =>
      ({ id, title, content: content.slice(0, 500), day: day_number })),
    kit: (trip?.items ?? []).map(({ id, item_name, quantity, is_packed }) =>
      ({ id, title: item_name, amount: quantity, packed: is_packed })),
    documents: trip?.permissions.canViewDocuments ? trip.documents.map(({ id, title, category, expires_at }) =>
      ({ id, title, category, expiration: expires_at })) : null,
    people: Array.from(people.values()),
    peopleCount: trip || group ? Math.max(people.size, group?.memberCount ?? 0) : null,
    pending: group?.pendingInvites ?? data.pendingInvites,
    trip: Boolean(trip),
    collective: adventure.nature === 'collectif',
  };
}
