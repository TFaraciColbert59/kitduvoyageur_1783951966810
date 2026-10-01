import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';
import {
  getActiveProviderMode,
  type ProviderCredentialMode,
} from '@/features/booking/server/providerCredentials';
import type { TripFull } from '@/features/trips/types/trip.types';
import {
  buildCompasModel,
  type CompasBookingInput,
  type CompasInput,
  type CompasInventoryInput,
  type CompasItemInput,
  type CompasMemberInput,
  type CompasModel,
  type CompasWeatherDayInput,
} from '../engine/compasModel';
import { readCompasMeta } from '../engine/meta';
import { getCompasWeather, type CompasWeather } from './weather';

/**
 * Compas — chargeur serveur unique.
 *
 * Source de vérité : l'aventure active du hub (déjà mise en cache par React
 * `cache`). Le Compas n'ouvre que trois lectures supplémentaires, toutes
 * limitées à l'utilisateur ou au voyage : son inventaire, les réservations du
 * voyage et le catalogue actif de la boutique. Aucune donnée n'est inventée :
 * une lecture qui échoue renvoie une liste vide et l'écran l'assume.
 */

export interface CompasShopProduct {
  id: string;
  slug: string | null;
  /** Mode de transaction réel de la boutique : achat, location, occasion, enchère. */
  mode: 'achat' | 'location' | 'occasion' | 'enchere' | null;
  name: string;
  brand: string | null;
  category: string | null;
  weightG: number | null;
  priceEur: number | null;
  pricePerDay: number | null;
  rating: number | null;
  reviewCount: number | null;
  image: string | null;
  imageAlt: string | null;
}

export interface CompasPoint {
  id: string;
  lat: number;
  lon: number;
  label: string;
  category: string | null;
  kind: 'step' | 'poi';
}

export interface CompasItineraryStep {
  id: string;
  day: number;
  title: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  accommodation: string | null;
}

export interface CompasData {
  model: CompasModel;
  /** Étapes réelles du voyage, dans l'ordre. */
  itinerary: CompasItineraryStep[];
  /** Réservations réelles du voyage. */
  bookings: CompasBookingInput[];
  routeGeojson: Record<string, unknown> | null;
  points: CompasPoint[];
  inventory: CompasInventoryInput[];
  shop: CompasShopProduct[];
  affiliateLinks: Array<{
    id: string;
    label: string;
    category: string | null;
    partner: string | null;
    url: string;
  }>;
  canEdit: boolean;
  viewerId: string | null;
  /** Mode réel des fournisseurs de réservation (`disabled` tant que les clés manquent). */
  providers: { routestack: ProviderCredentialMode; viator: ProviderCredentialMode };
  /** Météo Open-Meteo des jours du voyage et calendrier 6 semaines (null si indisponible). */
  weather: CompasWeather | null;
  /** Parcours du catalogue choisi pour le voyage. */
  route: { id: number | null; name: string | null };
  /** Point de départ (première étape géolocalisée), pour chercher autour. */
  origin: { lat: number; lon: number } | null;
}

const TIME_ZONE = 'Europe/Paris';
const SHOP_MODES = new Set(['achat', 'location', 'occasion', 'enchere']);

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** Prévisions des jours du voyage → entrée du modèle (jamais de valeur comblée). */
function toWeatherInput(weather: CompasWeather | null): CompasWeatherDayInput[] {
  if (!weather) return [];
  const out: CompasWeatherDayInput[] = [];
  for (const d of weather.tripDays) {
    const f = d.forecast;
    if (!f || f.tMin == null || f.tMax == null || f.precipPct == null || f.code == null) continue;
    out.push({
      date: f.date,
      tempMinC: f.tMin,
      tempMaxC: f.tMax,
      precipPct: f.precipPct,
      weathercode: f.code,
    });
  }
  return out;
}

function toItems(trip: TripFull): CompasItemInput[] {
  return (trip.items ?? []).map((it) => ({
    id: it.id,
    name: it.item_name,
    category: it.category,
    quantity: Number(it.quantity) || 1,
    weightGrams: num(it.weight_grams),
    isPacked: Boolean(it.is_packed),
    isVital: Boolean(it.is_vital) || it.priority === 'vital',
    isWorn: Boolean(it.is_worn),
    isConsumable: Boolean(it.is_consumable),
    ownership: it.ownership ?? null,
    ownerId: it.owner_id ?? null,
    inventoryItemId: it.inventory_item_id,
    shopProductId: it.shop_product_id ?? null,
    condition: it.condition ?? null,
    reason: it.reason ?? null,
    purchaseState: it.purchase_state ?? null,
  }));
}

function toMembers(
  trip: TripFull,
  crew: Array<{ userId: string; role: string; fullName: string | null; avatarUrl: string | null }>
): CompasMemberInput[] {
  const profiles = new Map((trip.member_profiles ?? []).map((p) => [p.user_id, p]));
  const base =
    crew.length > 0
      ? crew.map((m) => ({
          userId: m.userId,
          name: m.fullName,
          avatarUrl: m.avatarUrl,
          role: m.role,
        }))
      : (trip.collaborators ?? []).map((c) => ({
          userId: c.user_id,
          name: c.profile?.full_name ?? c.profile?.username ?? null,
          avatarUrl: c.profile?.avatar_url ?? null,
          role: String(c.role),
        }));
  if (!base.some((m) => m.userId === trip.user_id)) {
    base.unshift({ userId: trip.user_id, name: null, avatarUrl: null, role: 'owner' });
  }
  return base.map((m) => {
    const p = profiles.get(m.userId);
    return {
      userId: m.userId,
      name: m.name ?? 'Membre',
      avatarUrl: m.avatarUrl,
      role: m.role,
      maxCarryKg: num(p?.max_carry_kg),
      flatSpeedKmh: num(p?.flat_speed_kmh),
      experienceLevel: p?.experience_level ?? null,
      calibrationLevel: p?.calibration_level ?? null,
    };
  });
}

async function loadInventory(
  client: SupabaseClient,
  userId: string | null
): Promise<CompasInventoryInput[]> {
  if (!userId) return [];
  try {
    const { data, error } = await client
      .from('product_ownership')
      .select(
        'id, name, brand, category, weight_g, condition, is_lent, maintenance_due_at, expiry_date, quantity'
      )
      .eq('user_id', userId)
      .order('category', { ascending: true })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: str(r.name) ?? 'Objet',
      brand: str(r.brand),
      category: str(r.category),
      weightG: num(r.weight_g),
      condition: str(r.condition),
      isLent: r.is_lent === true,
      maintenanceDueAt: str(r.maintenance_due_at),
      expiryDate: str(r.expiry_date),
      quantity: num(r.quantity) ?? 1,
    }));
  } catch {
    console.warn('[compas] inventaire indisponible');
    return [];
  }
}

async function loadBookings(client: SupabaseClient, tripId: string): Promise<CompasBookingInput[]> {
  try {
    const { data, error } = await client
      .from('bookings')
      .select('id, vertical, provider, status, amount_eur')
      .eq('trip_id', tripId)
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      vertical: String(r.vertical ?? ''),
      provider: String(r.provider ?? ''),
      status: String(r.status ?? ''),
      amountEur: num(r.amount_eur),
    }));
  } catch {
    console.warn('[compas] réservations indisponibles');
    return [];
  }
}

async function loadShop(client: SupabaseClient): Promise<CompasShopProduct[]> {
  try {
    const { data, error } = await client
      .from('shop_products')
      .select(
        'id, slug, name, brand, category_main, category, weight_g, weight_grams, price_eur, price_per_day, rating, review_count, image, image_alt, transaction_type'
      )
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('score_kdv', { ascending: false, nullsFirst: false })
      .limit(300);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      slug: str(r.slug),
      mode: SHOP_MODES.has(String(r.transaction_type))
        ? (String(r.transaction_type) as CompasShopProduct['mode'])
        : null,
      name: str(r.name) ?? 'Produit',
      brand: str(r.brand),
      category: str(r.category_main) ?? str(r.category),
      weightG: num(r.weight_g) ?? num(r.weight_grams),
      priceEur: num(r.price_eur),
      pricePerDay: num(r.price_per_day),
      rating: num(r.rating),
      reviewCount: num(r.review_count),
      image: str(r.image),
      imageAlt: str(r.image_alt),
    }));
  } catch {
    console.warn('[compas] catalogue indisponible');
    return [];
  }
}

export async function getCompasData(): Promise<CompasData | null> {
  const hub = await getHubAdventureData();
  const trip = hub.trip;
  if (!trip) return null;

  const client = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await client.auth.getUser();
  const viewerId = user?.id ?? null;

  const [inventory, bookings, shop] = await Promise.all([
    loadInventory(client, viewerId),
    loadBookings(client, trip.id),
    loadShop(client),
  ]);

  const members = toMembers(trip, hub.group?.members ?? []);
  const compasMeta = readCompasMeta(trip.metadata);
  const input: CompasInput = {
    trip: {
      id: trip.id,
      slug: trip.slug,
      title: trip.title,
      destinationName: trip.destination_name,
      startDate: trip.start_date,
      endDate: trip.end_date,
      primaryActivity: trip.primary_activity ?? null,
      estimatedBudget: num(trip.estimated_budget),
      budgetCurrency: trip.budget_currency ?? 'EUR',
      partySize: num(trip.party_size),
      ownerId: trip.user_id,
      durationHours: compasMeta.durationHours,
      preferences: compasMeta.preferences,
    },
    steps: (trip.steps ?? []).map((s) => ({
      id: s.id,
      dayNumber: Number(s.day_number) || 1,
      orderIndex: Number(s.order_index) || 0,
      title: s.title,
      locationName: s.location_name,
      lat: num(s.latitude),
      lon: num(s.longitude),
      distanceKm: num(s.distance_km),
      elevationGainM: num(s.elevation_gain_m),
      elevationLossM: num(s.elevation_loss_m),
      accommodationName: s.accommodation_name,
      transportMode: s.transport_mode ?? null,
      startTime: s.start_time ?? null,
    })),
    items: toItems(trip),
    members,
    expenses: (trip.expenses ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      amount: num(e.amount) ?? 0,
      category: e.category,
      isPlanned: Boolean(e.is_planned),
      payerId: e.payer_id,
      splitType: e.split_type,
    })),
    inventory,
    bookings,
    // Rempli plus bas avec la prévision des VRAIS jours du voyage : la météo du
    // hub couvre aujourd'hui + 5 jours, pas les dates de la sortie.
    weather: [],
    routeDurationMin: hub.hiking?.durationMin ?? null,
    routeHasGeometry: Boolean(hub.hiking?.routeGeojson),
    waterPointsCount: hub.hiking?.waterPointsCount ?? null,
    viewerId,
    now: new Date(),
    timeZone: TIME_ZONE,
  };

  const points: CompasPoint[] = [
    ...(trip.steps ?? [])
      .filter((s) => num(s.latitude) != null && num(s.longitude) != null)
      .map((s) => ({
        id: `s-${s.id}`,
        lat: Number(s.latitude),
        lon: Number(s.longitude),
        label: s.title,
        category: s.accommodation_name ? 'stay' : 'step',
        kind: 'step' as const,
      })),
    ...(trip.pois ?? [])
      .filter((p) => num(p.latitude) != null && num(p.longitude) != null)
      .map((p) => ({
        id: `p-${p.id}`,
        lat: Number(p.latitude),
        lon: Number(p.longitude),
        label: p.name,
        category: p.category,
        kind: 'poi' as const,
      })),
  ];

  // 1er passage : jours de marche datés et géolocalisés ; 2e : avec leur météo.
  const draft = buildCompasModel(input);
  const plans = draft.route.dayPlans;
  const firstGeo = plans.find((d) => d.lat != null && d.lon != null);
  const firstPoint = points.find((p) => p.kind === 'step') ?? points[0];
  const origin = firstGeo
    ? { lat: firstGeo.lat as number, lon: firstGeo.lon as number }
    : firstPoint
      ? { lat: firstPoint.lat, lon: firstPoint.lon }
      : null;
  const weather = await getCompasWeather({
    origin,
    tripDays: plans
      .filter((d) => d.date != null && d.lat != null && d.lon != null)
      .map((d) => ({
        day: d.day,
        date: d.date as string,
        lat: d.lat as number,
        lon: d.lon as number,
      })),
    timeZone: TIME_ZONE,
  });
  input.weather = toWeatherInput(weather);

  const itinerary: CompasItineraryStep[] = [...input.steps]
    .sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex)
    .map((s) => ({
      id: s.id,
      day: s.dayNumber,
      title: s.title,
      distanceKm: s.distanceKm,
      elevationGainM: s.elevationGainM,
      accommodation: s.accommodationName,
    }));

  const routeId = compasMeta.routeId ?? num(hub.hiking?.routeId);

  return {
    model: input.weather.length ? buildCompasModel(input) : draft,
    itinerary,
    bookings,
    routeGeojson: hub.hiking?.routeGeojson ?? null,
    points,
    inventory,
    shop,
    affiliateLinks: (hub.affiliateLinks ?? []).map((l) => ({
      id: l.id,
      label: l.title,
      category: l.category ?? null,
      partner: l.partner?.name ?? null,
      url: `/go/${encodeURIComponent(l.slug)}`,
    })),
    canEdit: Boolean(trip.permissions?.canEdit),
    viewerId,
    providers: getActiveProviderMode(),
    weather,
    route: { id: routeId, name: hub.hiking?.routeName ?? null },
    origin,
  };
}
