import 'server-only';

import type { FxRate } from '../engine/currency';
import type { CompasPendingInvite } from '../engine/team';
import { assessDanger, mergeDangerIntoVerdict, type DangerAssessment } from '../engine/danger';
import { adviseKit, type KitAdvice } from '../engine/kitRules';
import { parseRoutePois, poiLabel, type RoutePoi } from '../engine/routePois';
import { getEurRate } from './rates';

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
import { relevantAffiliateLinks } from '../engine/affiliates';
import { getOfficialAlerts } from './officialAlerts';
import { getRouteElevation } from './elevation';
import type { ElevationProfile } from '../engine/elevation';
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
  /** Profil d'altitude réel du tracé (null : pas de tracé ou source injoignable). */
  elevation: ElevationProfile | null;
  /** Pays de destination (ISO 3166-1 alpha-2), null s'il n'est pas renseigné. */
  countryCode: string | null;
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
  /** Taux EUR → devise du voyage (null si le voyage est en euros ou taux indisponible). */
  fx: FxRate | null;
  /** Danger en trois axes, chaque signal sourcé et daté. */
  danger: DangerAssessment;
  /** Conseils de kit selon la météo et le parcours, chacun avec sa donnée source. */
  kitAdvice: KitAdvice[];
  /** Points OpenStreetMap à moins de 1 km du tracé choisi (vide sans parcours du catalogue). */
  routePois: RoutePoi[];
  /** Météo Open-Meteo des jours du voyage et calendrier 6 semaines (null si indisponible). */
  weather: CompasWeather | null;
  /** Parcours du catalogue choisi pour le voyage. */
  route: { id: number | null; name: string | null };
  /** Point de départ (première étape géolocalisée), pour chercher autour. */
  origin: { lat: number; lon: number } | null;
  /** Invitations envoyées, en attente de réponse (accès au voyage après acceptation). */
  pendingInvites: CompasPendingInvite[];
  /** Préremplissage : jamais lancé, déjà écrit, ou annulé (ne se relance pas seul). */
  autofill: 'none' | 'done' | 'undone';
  /** Conseils du spécialiste (IA) laissés par le préremplissage. */
  autofillNotes?: string[];
  /** Durée voulue quand la date de départ n'est pas choisie (« 20 jours »). */
  plannedDays?: number | null;
  /** Destination retrouvée sur la carte (Dis-le). */
  anchorName?: string | null;
}

const TIME_ZONE = 'Europe/Paris';
const SHOP_MODES = new Set(['achat', 'location', 'occasion', 'enchere']);

async function loadRoutePois(client: SupabaseClient, routeId: number): Promise<RoutePoi[]> {
  try {
    const { data, error } = await client.rpc('compas_route_pois', {
      p_route_id: routeId,
      p_radius_m: 1000,
    });
    return error ? [] : parseRoutePois(data);
  } catch {
    return [];
  }
}

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
  // Équipage du groupe ET personnes ajoutées au voyage depuis le Compas
  // (trip_collaborators) : une même personne n'apparaît qu'une fois.
  const base = crew.map((m) => ({
    userId: m.userId,
    name: m.fullName,
    avatarUrl: m.avatarUrl,
    role: m.role,
  }));
  for (const c of trip.collaborators ?? []) {
    if (base.some((m) => m.userId === c.user_id)) continue;
    base.push({
      userId: c.user_id,
      name: c.profile?.full_name ?? c.profile?.username ?? null,
      avatarUrl: c.profile?.avatar_url ?? null,
      role: String(c.role),
    });
  }
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

async function loadPendingInvites(
  client: SupabaseClient,
  tripId: string
): Promise<CompasPendingInvite[]> {
  try {
    const { data, error } = await client
      .from('trip_invitations')
      .select('id, invitee_id, role, created_at')
      .eq('trip_id', tripId)
      .eq('status', 'pending')
      .not('invitee_id', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50);
    if (error || !data?.length) return [];
    const rows = data as Array<{ id: string; invitee_id: string; role: string; created_at: string }>;
    const { data: profiles } = await client
      .from('public_profiles')
      .select('id, full_name, avatar_url')
      .in(
        'id',
        rows.map((r) => r.invitee_id)
      );
    const byId = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map(
        (p) => [p.id, p]
      )
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.invitee_id,
      name: byId.get(r.invitee_id)?.full_name?.trim() || 'Voyageur',
      avatarUrl: byId.get(r.invitee_id)?.avatar_url ?? null,
      role: r.role === 'editor' ? 'editor' : 'viewer',
      createdAt: r.created_at,
    }));
  } catch {
    console.warn('[compas] invitations indisponibles');
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

  const [inventory, bookings, shop, pendingInvites] = await Promise.all([
    loadInventory(client, viewerId),
    loadBookings(client, trip.id),
    loadShop(client),
    loadPendingInvites(client, trip.id),
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
  const routeId = compasMeta.routeId ?? num(hub.hiking?.routeId);
  // Tout ce qui ne dépend que du brouillon part en même temps : chaque action
  // du Compas recharge cette page, une chaîne d'attentes la rendait lente.
  const [weather, routePois, officialAlerts, elevation, fx] = await Promise.all([
    getCompasWeather({
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
    }),
    routeId != null ? loadRoutePois(client, routeId) : Promise.resolve([]),
    getOfficialAlerts({
      point: origin,
      from: trip.start_date ?? null,
      to: trip.end_date ?? trip.start_date ?? null,
    }),
    // Le tracé ne dépend pas de la météo : le brouillon suffit.
    getRouteElevation(draft.route.coords),
    getEurRate(input.trip.budgetCurrency ?? 'EUR'),
  ]);
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

  const waterOnRoute = routePois.filter((p) => p.category === 'water').length;
  const waterPointsCount =
    routeId != null && routePois.length ? waterOnRoute : input.waterPointsCount;

  const baseModel = input.weather.length ? buildCompasModel(input) : draft;
  const danger = assessDanger({
    dayPlans: baseModel.route.dayPlans,
    forecasts: (weather?.tripDays ?? []).map((d) => ({
      day: d.day,
      date: d.date,
      forecast: d.forecast,
    })),
    // France : Météo-France via Meteoalarm ; ailleurs, l'axe le dit.
    alerts: officialAlerts.alerts,
    alertsStatus: officialAlerts.status,
  });

  return {
    model: { ...baseModel, verdict: mergeDangerIntoVerdict(baseModel.verdict, danger) },
    danger,
    kitAdvice: adviseKit({
      lines: baseModel.kit.lines,
      forecasts: (weather?.tripDays ?? []).map((d) => ({
        day: d.day,
        date: d.date,
        forecast: d.forecast,
      })),
      dayPlans: baseModel.route.dayPlans,
      waterPointsCount,
    }),
    routePois,
    itinerary,
    bookings,
    routeGeojson: hub.hiking?.routeGeojson ?? null,
    elevation,
    countryCode: trip.destination_country_code
      ? String(trip.destination_country_code).toLowerCase()
      : null,
    points: [
      ...points,
      ...routePois.map((p) => ({
        id: `r-${p.id}`,
        lat: p.lat,
        lon: p.lon,
        label: poiLabel(p),
        category: p.category,
        kind: 'poi' as const,
      })),
    ],
    inventory,
    shop,
    affiliateLinks: relevantAffiliateLinks(
      hub.affiliateLinks ?? [],
      trip.destination_country_code
    ).map((l) => ({
      id: l.id,
      label: l.title,
      category: l.category ?? null,
      partner: l.partner?.name ?? null,
      url: `/go/${encodeURIComponent(l.slug)}`,
    })),
    canEdit: Boolean(trip.permissions?.canEdit),
    viewerId,
    providers: getActiveProviderMode(),
    fx,
    weather,
    route: { id: routeId, name: hub.hiking?.routeName ?? null },
    origin,
    pendingInvites,
    autofill: autofillState(trip.metadata),
    autofillNotes: autofillNotes(trip.metadata),
    ...compasPlan(trip.metadata),
  };
}

function autofillState(metadata: unknown): CompasData['autofill'] {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const run =
    compas && typeof compas === 'object' ? (compas as Record<string, unknown>).autofill : null;
  if (!run || typeof run !== 'object') return 'none';
  return (run as Record<string, unknown>).runId ? 'done' : 'undone';
}

function autofillNotes(metadata: unknown): string[] {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const run =
    compas && typeof compas === 'object' ? (compas as Record<string, unknown>).autofill : null;
  const notes = run && typeof run === 'object' ? (run as Record<string, unknown>).notes : null;
  return Array.isArray(notes)
    ? notes.filter((n): n is string => typeof n === 'string').slice(0, 6)
    : [];
}

function compasPlan(metadata: unknown): { plannedDays: number | null; anchorName: string | null } {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const c = compas && typeof compas === 'object' ? (compas as Record<string, unknown>) : {};
  const days = Number(c.planned_days);
  const anchor = c.anchor && typeof c.anchor === 'object' ? (c.anchor as Record<string, unknown>) : null;
  return {
    plannedDays: Number.isInteger(days) && days >= 1 ? days : null,
    anchorName: typeof anchor?.name === 'string' ? anchor.name : null,
  };
}
