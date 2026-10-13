import type { InventoryStatus } from '@/features/materiel/domain/inventory';
import 'server-only';
import { MAX_NOTES } from '../engine/advice';
import { originOf, partySizeOf, shortHoursOf, tripLengthDays } from '../engine/tripContext';

import { currencyOfCountry, type FxRate } from '../engine/currency';
import type { BudgetFxData } from '../engine/budgetFx';
import type { CompasPendingInvite } from '../engine/team';
import { assessDanger, mergeDangerIntoVerdict, type DangerAssessment } from '../engine/danger';
import type { AlertsStatus } from '../engine/officialAlerts';
import { adviseKit, type KitAdvice, type KitContext } from '../engine/kitRules';
import { buildKitContext, datesWithoutForecast, kitAltitude } from '../engine/kitContext';
import { parseRoutePois, poiLabel, type RoutePoi } from '../engine/routePois';
import { getBudgetFx, getEurRate } from './rates';
import { readTraveller } from './traveller';
import { entryRequirement } from './entryRequirements';
import { abroadForReader, notesForReader, type AbroadFrom, type PapersFacts } from '../engine/papers';
import { readerFormalities, type ReaderFormalities } from '../engine/formalities';
import { withoutStoredFormalities } from '../engine/storedFormalities';
import type { TravellerContext } from '../engine/traveller';

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
import { geojsonLatLon, trackKey } from '../engine/track';
import { resolveProjectContext, type ProjectContext } from '../engine/projectContext';
import { readProfile, tripBasis } from './compasServer';
import { retryParts, staleParts, unionParts, type AutofillPart, type ProjectBasis } from '../engine/dependencies';
import { relevantAffiliateLinks } from '../engine/affiliates';
import { getOfficialAlerts } from './officialAlerts';
import { getRouteElevation, pointsAltitudeRange } from './elevation';
import type { ElevationProfile } from '../engine/elevation';
import { destinationZone, getClimateNormals, getCompasWeather, knownZoneAt, type CompasWeather } from './weather';
import { readAiProposed } from '../engine/aiNotice';
import { aiEnabled } from '@/lib/ai/aiMode';
import { keepTrialEnabled } from '@/features/demo/keepTrial';

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
  /** Distance estimée (aucun routeur n'a pu la mesurer, plan 1.5) : l'écran le dit. */
  distanceEstimated?: boolean;
  /**
   * Qui a mesuré la distance (`geoapify`, `valhalla`, `estimation`…), quand le voyage
   * le dit : « Powered by Geoapify » ne s'affiche que près de ce qu'il a mesuré.
   */
  distanceSource?: string | null;
  elevationGainM: number | null;
  accommodation: string | null;
  /**
   * Étape proposée par l'IA (sa position est ensuite vérifiée sur la carte), pas calculée par
   * le Compas : l'écran le dit en texte (PLAN-100 5.3). Absent : non.
   */
  aiProposed?: boolean;
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
  /**
   * Le budget aussi dans la devise de la personne qui regarde (son profil voyageur, jamais
   * celle d'un autre membre du voyage) et dans celle du pays de destination, avec taux, date
   * et source (PLAN-100 4.2, 4.6). Calculé à chaque affichage, jamais stocké ; absent (écran
   * plus ancien, tests) ou null : le budget reste dans la devise du voyage.
   */
  budgetFx?: BudgetFxData | null;
  /** Danger en trois axes, chaque signal sourcé et daté. */
  danger: DangerAssessment;
  /**
   * Ce que le Compas a pu lire des alertes officielles (Meteoalarm) pour ce voyage ;
   * absent : écran plus ancien, non lues. Sert à citer la source (Sources).
   */
  alertsStatus?: AlertsStatus;
  /** Instant où le flux d'alertes a été lu (ISO), affiché avec l'avertissement de Meteoalarm ; null sans lecture. */
  alertsReadAt?: string | null;
  /** Conseils de kit selon la météo et le parcours, chacun avec sa donnée source. */
  kitAdvice: KitAdvice[];
  /**
   * Ce que les conseils de kit savent du lieu en plus de la prévision (normales
   * climatiques des jours sans prévision, latitude, altitude). Absent : écran plus ancien.
   */
  kitContext?: KitContext;
  /** Points OpenStreetMap à moins de 1 km du tracé choisi (vide sans parcours du catalogue). */
  routePois: RoutePoi[];
  /** Météo MET Norway des jours du voyage et calendrier 6 semaines (null si indisponible). */
  weather: CompasWeather | null;
  /** Parcours du catalogue choisi pour le voyage. */
  route: { id: number | null; name: string | null };
  /**
   * Coordonnées de la première étape géolocalisée (météo, recherches autour), PAS le
   * lieu de départ du voyageur : celui-ci est `originName` / `originSaid`.
   */
  origin: { lat: number; lon: number } | null;
  /**
   * Fuseau IANA de la destination (première étape géolocalisée, sinon le lieu
   * retrouvé sur la carte), calculé ici : tz-lookup n'entre jamais dans le
   * navigateur. Absent (écran plus ancien, tests) : Paris, sans mention.
   */
  zone?: string;
  /**
   * Fuseau IANA du point de départ de CHAQUE jour (clé : numéro du jour), null quand il ne se retrouve
   * pas ou que le jour n'a pas de point. Un itinéraire peut traverser des fuseaux : `zone` (première
   * étape) ne vaut que pour elle. Absent (écran plus ancien, tests) : aucun fuseau de jour connu, donc la
   * lumière du jour n'est pas calculée plutôt que devinée avec `zone`.
   */
  dayZones?: Record<number, string | null>;
  /** Invitations envoyées, en attente de réponse (accès au voyage après acceptation). */
  pendingInvites: CompasPendingInvite[];
  /** Préremplissage : jamais lancé, déjà écrit, ou annulé (ne se relance pas seul). */
  autofill: 'none' | 'done' | 'undone';
  /** Conseils du spécialiste (IA) laissés par le préremplissage. */
  autofillNotes?: string[];
  /**
  /**
   * Les formalités d'entrée (visa, ESTA) de la personne qui regarde, calculées ici avec SON profil
   * et affichées à part du budget : jamais rangées sur le voyage (elles diraient sa nationalité).
   * Null ou absent : rien à chiffrer pour elle.
   */
  formalities?: ReaderFormalities | null;
  /**
   * Interrupteur de l'IA du site (`AI_MODE`, plan 1.7) à l'affichage : faux ou absent, l'écran ne
   * parle pas d'IA (ni mention, ni bouton « Expliquer avec l'IA »). PLAN-100 5.3.
   */
  aiOn?: boolean;
  /**
   * Essai sans compte à qui on propose de le garder (PLAN-100 2.3) : session anonyme ET
   * `NEXT_PUBLIC_KEEP_TRIAL=on`. Faux ou absent, l'écran n'en parle pas.
   */
  keepTrial?: boolean;
  /** Durée voulue quand la date de départ n'est pas choisie (« 20 jours »). */
  plannedDays?: number | null;
  /** Points autour des étapes : recherche en cours ou faite (rempli côté écran). */
  stagePoisDone?: boolean;
  /** Phrase du Compas vide pas encore appliquée (reprise à l'ouverture). */
  startSay?: string | null;
  /** Destination retrouvée sur la carte (Dis-le). */
  anchorName?: string | null;
  /** Nom du lieu de départ dit (« depuis Lyon »), retrouvé sur la carte ; null sans départ dit. */
  originName?: string | null;
  /**
   * Le départ dit tel que rangé (point déjà arrondi à ~1 km, rien de plus fin ici) :
   * « Annuler » le rétablit à l'identique sans le rechercher à nouveau.
   */
  originSaid?: { name: string; lat: number; lon: number; countryCode: string | null } | null;
  /** Contexte projet résolu (projet > sélection > profil > défaut), avec la source de chaque valeur. */
  context?: ProjectContext;
  /** Parties du préremplissage dépassées par un changement du projet (à réadapter). */
  autofillStale?: AutofillPart[];
}

/** Repli tant que la destination n'est pas placée sur la carte. */
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
    if (!f || f.tMin == null || f.tMax == null || f.code == null) continue;
    out.push({
      date: f.date,
      tempMinC: f.tMin,
      tempMaxC: f.tMax,
      precipPct: f.precipPct,
      precipMm: f.precipMm,
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
      // Provenance de chaque valeur : une moyenne de population n'est pas une donnée de la personne.
      profileSources:
        p?.sources && typeof p.sources === 'object' && !Array.isArray(p.sources) ? p.sources : null,
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
        'id, name, brand, category, weight_g, condition, is_lent, status, maintenance_due_at, expiry_date, quantity'
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
      inventoryStatus: r.status as InventoryStatus,
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

  const [inventory, bookings, shop, pendingInvites, profile, traveller] = await Promise.all([
    loadInventory(client, viewerId),
    loadBookings(client, trip.id),
    loadShop(client),
    loadPendingInvites(client, trip.id),
    readProfile(client as never, viewerId),
    // Sa propre devise, par la RLS de la personne ; jamais pour un essai sans compte.
    readTraveller(client, user?.is_anonymous === true ? null : viewerId),
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
    // Une dépense « Formalités » rangée par une préparation d'avant ce verrou dit la nationalité du
    // lanceur : retirée de l'affichage tant qu'elle est planifiée et intacte (la ligne du lecteur,
    // `formalities`, la remplace) ; réglée ou retouchée, elle compte comme les autres, ici comme dans
    // `/voyages` (même filtre à la lecture du voyage, `lib/queries-trips.ts`).
    expenses: withoutStoredFormalities(trip.expenses ?? [])
      .map((e) => ({
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
  // Lever et coucher du soleil, et « aujourd'hui » de la météo : à l'heure de la
  // destination (tz-lookup, côté serveur seulement), plus à celle de Paris.
  const zone = destinationZone(firstGeoPoint(input.steps) ?? anchorPoint(trip.metadata), TIME_ZONE);
  input.timeZone = zone;

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
  // Tracé réel : la route du catalogue ou le tracé préparé (routé entre les étapes), tant que les étapes n'ont
  // pas bougé. Seul son profil est une altitude MESURÉE du parcours : des lignes droites entre les étapes
  // survolent un massif (tunnel de Chamonix à Courmayeur) ou manquent un sommet qui n'est pas une étape.
  const realTrack = hub.hiking?.routeGeojson ?? preparedTrack(trip.metadata, draft.route.coords);
  const trackCoords = geojsonLatLon(realTrack);
  const hasRealTrack = trackCoords.length >= 2;
  // Tout ce qui ne dépend que du brouillon part en même temps : chaque action
  // du Compas recharge cette page, une chaîne d'attentes la rendait lente.
  // Normales NASA POWER du lieu (gardées 30 jours) : froid, pluie, chaleur au-delà de la prévision.
  const kitPoint = origin ?? anchorPoint(trip.metadata);
  const hasDates = plans.some((d) => d.date != null) || Boolean(trip.start_date);
  const [weather, routePois, officialAlerts, elevation, fx, climateNormals, placesAltitude, budgetFx] = await Promise.all([
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
      timeZone: zone,
    }),
    routeId != null ? loadRoutePois(client, routeId) : Promise.resolve([]),
    getOfficialAlerts({
      point: origin,
      from: trip.start_date ?? null,
      to: trip.end_date ?? trip.start_date ?? null,
      timeZone: zone,
    }),
    // Le tracé ne dépend pas de la météo : le brouillon suffit. Sans tracé réel, le profil des lignes droites
    // entre les étapes ne sert qu'à l'affichage (jamais au kit).
    getRouteElevation(hasRealTrack ? trackCoords : draft.route.coords),
    getEurRate(input.trip.budgetCurrency ?? 'EUR'),
    kitPoint && hasDates ? getClimateNormals(kitPoint.lat, kitPoint.lon) : Promise.resolve(null),
    // Altitude de secours du kit : sans tracé réel, le relief des lieux du voyage (jamais une valeur par pays).
    pointsAltitudeRange(points.filter((p) => p.kind === 'step')),
    getBudgetFx({
      tripCurrency: input.trip.budgetCurrency ?? 'EUR',
      traveller: traveller.currency,
      // La devise du pays de destination (ISO 4217) : null quand la liste n'en donne pas.
      destination: currencyOfCountry(trip.destination_country_code),
    }),
  ]);
  input.weather = toWeatherInput(weather);

  const estimatedIds = new Set(
    (trip.steps ?? []).filter((s) => distanceSource(s.metadata) === 'estimation').map((s) => s.id)
  );
  const sourceOfStep = new Map((trip.steps ?? []).map((s) => [s.id, distanceSource(s.metadata)]));
  // Étapes que l'IA a proposées (marque posée à l'écriture par la préparation, PLAN-100 5.3).
  const aiProposedIds = new Set((trip.steps ?? []).filter((s) => readAiProposed(s.metadata)).map((s) => s.id));
  const itinerary: CompasItineraryStep[] = [...input.steps]
    .sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex)
    .map((s) => ({
      id: s.id,
      day: s.dayNumber,
      title: s.title,
      distanceKm: s.distanceKm,
      distanceEstimated: estimatedIds.has(s.id),
      distanceSource: sourceOfStep.get(s.id) ?? null,
      elevationGainM: s.elevationGainM,
      accommodation: s.accommodationName,
      ...(aiProposedIds.has(s.id) ? { aiProposed: true } : {}),
    }));

  const waterOnRoute = routePois.filter((p) => p.category === 'water').length;
  const waterPointsCount =
    routeId != null && routePois.length ? waterOnRoute : input.waterPointsCount;

  const baseModel = input.weather.length ? buildCompasModel(input) : draft;
  const tripForecasts = (weather?.tripDays ?? []).map((d) => ({
    day: d.day,
    date: d.date,
    forecast: d.forecast,
  }));
  const kitContext = buildKitContext({
    lat: kitPoint?.lat ?? null,
    // Profil d'un tracé réel d'abord ; sans lui, le relief des lieux, retenu comme un plancher.
    ...kitAltitude({
      route: hasRealTrack ? elevation : null,
      placesMaxM: placesAltitude?.maxM ?? null,
      placesMinM: placesAltitude?.minM ?? null,
    }),
    activity: trip.primary_activity ?? null,
    normals: climateNormals,
    dates: datesWithoutForecast({
      dayPlans: baseModel.route.dayPlans,
      forecasts: tripForecasts,
      startDate: trip.start_date ?? null,
      endDate: trip.end_date ?? null,
    }),
  });
  const danger = assessDanger({
    dayPlans: baseModel.route.dayPlans,
    forecasts: (weather?.tripDays ?? []).map((d) => ({
      day: d.day,
      date: d.date,
      forecast: d.forecast,
    })),
    // Europe : services nationaux via Meteoalarm ; ailleurs ou zone non reconnue, l'axe le dit.
    alerts: officialAlerts.alerts,
    alertsStatus: officialAlerts.status,
  });

  return {
    model: { ...baseModel, verdict: mergeDangerIntoVerdict(baseModel.verdict, danger) },
    danger,
    alertsStatus: officialAlerts.status,
    alertsReadAt: officialAlerts.readAt ?? null,
    kitAdvice: adviseKit({
      lines: baseModel.kit.lines,
      forecasts: tripForecasts,
      dayPlans: baseModel.route.dayPlans,
      waterPointsCount,
      context: kitContext,
    }),
    kitContext,
    routePois,
    itinerary,
    bookings,
    routeGeojson: realTrack,
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
    budgetFx,
    weather,
    route: { id: routeId, name: hub.hiking?.routeName ?? null },
    origin,
    zone,
    dayZones: Object.fromEntries(
      plans.map((d) => [d.day, d.lat != null && d.lon != null ? knownZoneAt(d.lat, d.lon) : null])
    ),
    pendingInvites,
    autofill: autofillState(trip.metadata),
    aiOn: aiEnabled(),
    keepTrial: user?.is_anonymous === true && keepTrialEnabled(),
    // La ligne « Papiers » est celle de CE lecteur (son profil), jamais celle du propriétaire.
    autofillNotes: autofillNotes(trip.metadata, traveller, trip.destination_country_code, viewerId),
    // Ses formalités d'entrée, calculées avec SON profil, à part du budget (jamais rangées).
    formalities: readerFormalitiesOf(
      trip.metadata,
      traveller,
      trip.destination_country_code,
      partySizeOf(num(trip.party_size), members.length),
      viewerId
    ),
    ...compasPlan(trip.metadata),
    autofillStale: autofillStale(trip),
    context: resolveProjectContext({
      activity: trip.primary_activity ?? null,
      days: baseModel.dates.days ?? compasPlan(trip.metadata).plannedDays,
      hours: shortHoursOf(
        baseModel.dates.days ?? compasPlan(trip.metadata).plannedDays,
        compasMeta.durationHours
      ),
      // Même groupe que l'écran et la préparation : party_size, sinon les membres.
      partySize: partySizeOf(num(trip.party_size), members.length),
      month: trip.start_date ? Number(String(trip.start_date).slice(5, 7)) : null,
      // Hiver selon l'hémisphère : latitude du départ, sinon du lieu retrouvé sur la carte.
      lat: origin?.lat ?? anchorPoint(trip.metadata)?.lat ?? null,
      maxAltitudeM: elevation?.maxM ?? null,
      project: compasMeta.preferences,
      profile,
    }),
  };
}

/** Première étape géolocalisée, dans l'ordre du voyage. */
function firstGeoPoint(steps: CompasInput['steps']): { lat: number; lon: number } | null {
  const s = [...steps]
    .sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex)
    .find((x) => x.lat != null && x.lon != null);
  return s ? { lat: s.lat as number, lon: s.lon as number } : null;
}

/** Destination retrouvée sur la carte (Dis-le), quand aucune étape n'est placée. */
function anchorPoint(metadata: unknown): { lat: number; lon: number } | null {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const a = compas && typeof compas === 'object' ? (compas as Record<string, unknown>).anchor : null;
  if (!a || typeof a !== 'object') return null;
  const lat = num((a as Record<string, unknown>).lat);
  const lon = num((a as Record<string, unknown>).lon);
  return lat != null && lon != null ? { lat, lon } : null;
}

function autofillStale(trip: TripFull): AutofillPart[] {
  const compas =
    trip.metadata && typeof trip.metadata === 'object' ? (trip.metadata as Record<string, unknown>).compas : null;
  const run = compas && typeof compas === 'object' ? (compas as Record<string, unknown>).autofill : null;
  const basis = run && typeof run === 'object' ? (run as Record<string, unknown>).basis : null;
  if (!basis || typeof basis !== 'object' || !(run as Record<string, unknown>).runId) return [];
  const changed = staleParts(
    basis as Partial<ProjectBasis>,
    tripBasis(
      {
        start_date: trip.start_date,
        end_date: trip.end_date,
        destination_name: trip.destination_name,
        party_size: trip.party_size ?? null,
        metadata: (trip.metadata ?? null) as Record<string, unknown> | null,
      },
      trip.primary_activity ?? null
    )
  );
  // Itinéraire de secours : retenté à l'ouverture (au plus quelques fois).
  return unionParts(changed, retryParts((run as Record<string, unknown>).stagesFallback));
}

/**
 * Tracé réel de l'itinéraire préparé (routes, chemins), tant que les étapes
 * n'ont pas bougé depuis : sinon null, la carte relie les étapes.
 */
/** La source de la distance d'une étape (`metadata.distance.source`), ou null. */
function distanceSource(metadata: unknown): string | null {
  const d = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).distance : null;
  const source = d && typeof d === 'object' ? (d as Record<string, unknown>).source : null;
  return typeof source === 'string' ? source : null;
}

function preparedTrack(metadata: unknown, coords: Array<[number, number]>): Record<string, unknown> | null {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const t = compas && typeof compas === 'object' ? (compas as Record<string, unknown>).track : null;
  if (!t || typeof t !== 'object') return null;
  const { key, geojson } = t as { key?: unknown; geojson?: unknown };
  if (typeof key !== 'string' || !geojson || typeof geojson !== 'object') return null;
  return key === trackKey(coords.map(([lat, lon]) => ({ lat, lon }))) ? (geojson as Record<string, unknown>) : null;
}

function autofillState(metadata: unknown): CompasData['autofill'] {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const run =
    compas && typeof compas === 'object' ? (compas as Record<string, unknown>).autofill : null;
  if (!run || typeof run !== 'object') return 'none';
  return (run as Record<string, unknown>).runId ? 'done' : 'undone';
}

function autofillNotes(
  metadata: unknown,
  reader: TravellerContext,
  destinationCode: string | null | undefined,
  viewerId: string | null
): string[] {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const run =
    compas && typeof compas === 'object' ? (compas as Record<string, unknown>).autofill : null;
  const notes = run && typeof run === 'object' ? (run as Record<string, unknown>).notes : null;
  if (!Array.isArray(notes)) return [];
  const stored = notes.filter((n): n is string => typeof n === 'string');
  // VIE PRIVÉE : le voyage ne garde pas la ligne « Papiers » d'une nationalité (lisible par les
  // collaborateurs, et par tous pour un voyage public) ; elle se calcule ici, avec le profil de la
  // personne qui regarde (sans profil : la ligne neutre).
  const facts = papersFacts(compas as Record<string, unknown> | null, destinationCode);
  // « À l'étranger » ne vaut que pour le lanceur quand le départ est son domicile ou sa position.
  return notesForReader(stored, facts, reader, entryRequirement, viewerId).slice(0, MAX_NOTES);
}

/**
 * Les formalités d'entrée du lecteur (visa, ESTA), pour un voyage préparé seulement : la préparation
 * annulée ou jamais lancée n'a écrit aucun budget. Pays et départ : ceux que le voyage a rangés
 * (`papersFacts`) ; le profil est celui du lecteur.
 */
function readerFormalitiesOf(
  metadata: unknown,
  reader: TravellerContext,
  destinationCode: string | null | undefined,
  party: number,
  viewerId: string | null
): ReaderFormalities | null {
  if (autofillState(metadata) !== 'done') return null;
  const compas =
    metadata && typeof metadata === 'object' ? ((metadata as Record<string, unknown>).compas as Record<string, unknown> | null) : null;
  const facts = papersFacts(compas && typeof compas === 'object' ? compas : null, destinationCode);
  if (!facts) return null;
  // Le départ du lanceur (domicile, position) n'est connu que de lui : pour un collaborateur, « on ne sait pas ».
  return readerFormalities({
    countryCode: facts.countryCode,
    abroad: abroadForReader(facts, viewerId),
    party,
    reader,
    find: entryRequirement,
  });
}

/**
 * Le pays et le départ de la ligne « Papiers » rangés avec le préremplissage ; pour un voyage
 * préparé avant, le pays du lieu retrouvé sur la carte, sinon celui de la destination du voyage.
 */
function papersFacts(compas: Record<string, unknown> | null, destinationCode?: string | null): PapersFacts | null {
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
  const code = (v: unknown) => (typeof v === 'string' && /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null);
  const name = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
  const saved = obj(obj(compas?.autofill)?.papers);
  if (saved) {
    const countryCode = code(saved.countryCode);
    if (countryCode) {
      const from: AbroadFrom | undefined =
        saved.abroadFrom === 'dit' || saved.abroadFrom === 'domicile' || saved.abroadFrom === 'gps' ? saved.abroadFrom : undefined;
      const by = typeof saved.launchedBy === 'string' && saved.launchedBy ? saved.launchedBy : undefined;
      return {
        countryCode,
        country: name(saved.country),
        abroad: typeof saved.abroad === 'boolean' ? saved.abroad : null,
        ...(from ? { abroadFrom: from } : {}),
        ...(from && from !== 'dit' && by ? { launchedBy: by } : {}),
      };
    }
  }
  const anchor = obj(compas?.anchor);
  const fromAnchor = code(anchor?.countryCode);
  if (fromAnchor) return { countryCode: fromAnchor, country: name(anchor?.country), abroad: null };
  const fromTrip = code(destinationCode);
  return fromTrip ? { countryCode: fromTrip, country: null, abroad: null } : null;
}

/** Exporté pour les tests : ce que le voyage a rangé et que l'écran relit (durée voulue, lieux, phrase). */
export function compasPlan(metadata: unknown): {
  plannedDays: number | null;
  anchorName: string | null;
  originName: string | null;
  originSaid: NonNullable<CompasData['originSaid']> | null;
  startSay: string | null;
} {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const c = compas && typeof compas === 'object' ? (compas as Record<string, unknown>) : {};
  const anchor = c.anchor && typeof c.anchor === 'object' ? (c.anchor as Record<string, unknown>) : null;
  const origin = originOf(c.origin);
  return {
    plannedDays: tripLengthDays(null, null, c.planned_days),
    anchorName: typeof anchor?.name === 'string' ? anchor.name : null,
    originName: origin?.name ?? null,
    originSaid: origin
      ? { name: origin.name, lat: origin.lat, lon: origin.lon, countryCode: origin.countryCode }
      : null,
    startSay: typeof c.start_say === 'string' && c.start_say.trim() ? c.start_say.trim().slice(0, 280) : null,
  };
}
