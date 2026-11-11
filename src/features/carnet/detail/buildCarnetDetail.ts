import { buildDays, buildSummary, toMomentItems } from './days';
import { etapeFromRow } from './editSchemas';
import { formatDateRange, formatElevation, formatKm, toNumber } from './format';
import { buildCarnetPlace } from './place';
import { pickElevationProfile } from './elevationProfile';
import type {
  HikeSessionRow,
  BuildCarnetDetailInput,
  CarnetEtapeDay,
  CarnetDetail,
  CarnetMomentItem,
  CarnetNightItem,
  CarnetParticipant,
  CarnetStatItem,
  CarnetViewerRole,
  CarnetKitVerdictItem,
  KitVerdictType,
} from './types';

const UNTITLED = 'Carnet sans titre';

function buildAuthor(input: BuildCarnetDetailInput) {
  const { author, carnet } = input;
  if (!author) return null;
  return {
    id: author.id,
    name: author.full_name?.trim() || author.handle?.trim() || 'Auteur non renseigné',
    handle: author.handle ?? null,
    avatarUrl: author.avatar_url ?? null,
    trustScore: toNumber(author.trust_score) ?? 0,
  };
}

/**
 * Participants du carnet : l'auteur d'abord (`role: 'author'`), puis les
 * collaborateurs, puis les présents des sorties. Dédoublonné par `userId` :
 * la première occurrence gagne, donc l'auteur garde toujours son rôle et sa
 * position. Aucun liker n'entre ici. Un profil public absent laisse `name` à
 * `null` mais conserve la ligne (initiale du handle à l'affichage).
 */
export function buildParticipants(input: BuildCarnetDetailInput): CarnetParticipant[] {
  const byId = new Map<string, CarnetParticipant>();
  const push = (participant: CarnetParticipant | null) => {
    if (!participant?.userId || byId.has(participant.userId)) return;
    byId.set(participant.userId, participant);
  };

  const authorId = input.author?.id ?? input.carnet.author_id ?? null;
  if (authorId) {
    push({
      userId: authorId,
      name: input.author?.full_name?.trim() || input.author?.handle?.trim() || null,
      handle: input.author?.handle ?? null,
      avatarUrl: input.author?.avatar_url ?? null,
      role: 'author',
    });
  }

  for (const row of input.participants ?? []) {
    if (!row.user_id) continue;
    push({
      userId: row.user_id,
      name: row.profile?.full_name?.trim() || row.profile?.handle?.trim() || null,
      handle: row.profile?.handle ?? null,
      avatarUrl: row.profile?.avatar_url ?? null,
      role: row.source,
    });
  }

  return [...byId.values()];
}

function buildEtapes(input: BuildCarnetDetailInput): CarnetEtapeDay[] {
  /* La nuit d'un jour vient de `carnet_nights` : absente, `overnight` reste nul. */
  const overnightByDay = new Map<number, string>();
  for (const n of input.nights ?? []) {
    if (n.dayNumber && n.name) overnightByDay.set(n.dayNumber, n.name);
  }

  const rawEtapes = input.etapes ?? [];
  if (rawEtapes.length > 0) {
    return rawEtapes.map((e) =>
      etapeFromRow(e, overnightByDay.get(e.jour_numero ?? e.ordre ?? 1) ?? null)
    );
  }

  // Pas d'étapes : les moments donnent les journées, sans récit inventé
  // et sans répartition des totaux (l'ancienne fiche divisait distance et D+).
  const byDay = new Map<number, CarnetMomentItem[]>();
  for (const moment of toMomentItems(input.moments)) {
    const list = byDay.get(moment.dayNumber) ?? [];
    list.push(moment);
    byDay.set(moment.dayNumber, list);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, list]) => {
      const places = list.map((m) => m.place).filter((p): p is string => Boolean(p));
      return {
        id: `moment-day-${dayNumber}`,
        dayNumber,
        label: `JOUR ${dayNumber}`,
        from: places[0] ?? null,
        to: places.length > 1 ? places[places.length - 1] : null,
        note: null,
        distanceKm: null,
        elevationM: null,
        durationText: null,
        weather: null,
        overnight: overnightByDay.get(dayNumber) ?? null,
      };
    });
}

export function buildCarnetDetail(input: BuildCarnetDetailInput): CarnetDetail {
  const { carnet, hikeSession } = input;
  /* Totaux du carnet : somme de TOUTES les sorties (un carnet de quatre jours porte
     quatre sorties, la plus récente seule n'en est qu'un quart), à défaut le total
     déclaré sur le carnet. Jamais la dernière sortie prise pour le tout. */
  const allSessions = input.sessions ?? (hikeSession ? [hikeSession] : []);
  /* Fenêtre du séjour : une sortie datée hors de [start_date, end_date] n'est
     pas une sortie du carnet (seed de démo, sortie rattachée après coup). Elle
     ne nourrit ni les totaux ni le tracé ; sans dates, on garde tout. */
  const windowStart = carnet.start_date?.trim() || null;
  const windowEnd = carnet.end_date?.trim() || null;
  const sessionsInWindow =
    windowStart && windowEnd
      ? allSessions.filter((session) => {
          const at = typeof session.started_at === 'string' ? session.started_at.slice(0, 10) : '';
          return /^\d{4}-\d{2}-\d{2}$/.test(at) && at >= windowStart && at <= windowEnd;
        })
      : allSessions;
  const sumOf = (pick: (session: HikeSessionRow) => number | null, rows = sessionsInWindow): number | null => {
    const values = rows.map(pick).filter((v): v is number => v !== null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
  };
  /* Le carnet déclare son parcours (distance, D+) : ces valeurs font foi et
     couvrent les journées sans relevé GPS. À défaut seulement, on somme les
     sorties datées dans le séjour. Une sortie hors séjour ne compte jamais. */
  const distanceKm = toNumber(carnet.distance_km) ?? sumOf((s) => toNumber(s.distance_km));
  const elevationM = toNumber(carnet.denivele_m) ?? sumOf((s) => toNumber(s.elevation_gain_m));
  const moments = toMomentItems(input.moments);
  const etapes = buildEtapes(input);

  /* Jours dérivés : les moments nomment leur jour, les points GPS des sorties
     datent le leur. Aucune valeur n'est inventée quand une source manque. */
  const sessions = input.sessions ?? (hikeSession ? [hikeSession] : []);
  /* Profil d'altitude : sorties du séjour d'abord, sinon la sortie rattachée
     (même repli que la trace) pour que le dénivelé s'affiche dès qu'il existe. */
  const elevationProfile = pickElevationProfile(
    sessionsInWindow.length > 0 ? sessionsInWindow : sessions
  );
  const builtDays = buildDays({
    moments: input.moments,
    sessions,
    startDate: carnet.start_date ?? null,
  });
  /* Une sortie GPS datée hors du séjour (seed de démo, sortie rattachée après
     coup) créait des jours J211/J212 sans aucun moment. Le carnet a des dates
     de début et de fin : un jour hors de cette fenêtre n'appartient pas à la
     fiche. Les moments réels restent dans leur jour. */
  const start = carnet.start_date ? new Date(`${carnet.start_date}T12:00:00Z`) : null;
  const end = carnet.end_date ? new Date(`${carnet.end_date}T12:00:00Z`) : null;
  const spanDays =
    start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
      : null;
  const days = spanDays
    ? builtDays.filter((day) => (day.dayNumber ?? day.index) <= spanDays)
    : builtDays;
  const summary = buildSummary(days);

  const stats: CarnetStatItem[] = [];
  const distanceLabel = formatKm(distanceKm);
  if (distanceLabel) stats.push({ key: 'distance', label: 'DISTANCE', value: distanceLabel });
  const elevationLabel = formatElevation(elevationM);
  if (elevationLabel) stats.push({ key: 'elevation', label: 'DÉNIVELÉ +', value: elevationLabel });
  if (etapes.length > 0) stats.push({ key: 'days', label: 'JOURS', value: String(etapes.length) });

  const kitWeight = input.kitItems.reduce<number | null>((total, item) => {
    const grams = toNumber(item.poids_g);
    if (grams === null || grams <= 0) return total;
    return (total ?? 0) + grams;
  }, null);

  /* La trace affichée est celle de la sortie la plus récente qui en porte une
     dans la fenêtre du séjour (`pickCarnetTrace` côté lecteur). Le repli sur la
     sortie passée seule (`hikeSession`) reste possible pour les appelants
     historiques, mais jamais si elle est datée hors du séjour : la carte reste
     alors vide, honnêtement. */
  const sessionTrace = hikeSession?.positions_geojson ?? null;
  const sessionAt =
    typeof hikeSession?.started_at === 'string' ? hikeSession.started_at.slice(0, 10) : '';
  const sessionInWindow =
    !windowStart || !windowEnd
      ? true
      : /^\d{4}-\d{2}-\d{2}$/.test(sessionAt) && sessionAt >= windowStart && sessionAt <= windowEnd;
  const trace = input.trace ?? (sessionInWindow ? sessionTrace : null);

  /* Nuits du carnet (`carnet_nights`), triées par jour. Aucun repli : les
     anciennes tables `groupe_*` n'existent plus, une nuit absente n'est pas inventée. */
  const nights: CarnetNightItem[] = [...(input.nights ?? [])].sort(
    (x, y) => x.dayNumber - y.dayNumber
  );

  const viewerRole: CarnetViewerRole =
    input.viewerRole ??
    (input.viewerId && carnet.author_id === input.viewerId ? 'participant' : 'visitor');
  const budget = viewerRole === 'visitor' ? null : (input.budget ?? null);

  const kitVerdicts: Record<string, CarnetKitVerdictItem> = { ...(input.kitVerdicts ?? {}) };
  for (const k of input.kitItems ?? []) {
    const verdict = (k.verdict ?? k.verdict_status ?? null) as KitVerdictType | null;
    if (verdict && !kitVerdicts[k.id]) {
      kitVerdicts[k.id] = {
        itemId: k.id,
        verdict,
        verdictNote: k.verdict_note ?? k.verdict_notes ?? null,
        joursUtilises: k.jours_utilises ?? [],
      };
    }
  }

  return {
    id: carnet.id,
    title: carnet.title?.trim() || carnet.destination?.trim() || UNTITLED,
    destination: carnet.destination?.trim() || null,
    description: carnet.description?.trim() || null,
    coverImage: carnet.cover_image?.trim() || null,
    coverImageAlt: carnet.cover_image_alt?.trim() || null,
    startDate: carnet.start_date ?? null,
    endDate: carnet.end_date ?? null,
    dateRange: formatDateRange(carnet.start_date, carnet.end_date),
    visibility: carnet.visibility ?? 'public',
    isPublic: (carnet.visibility ?? 'public') === 'public',
    verified: carnet.verified === true,
    isOwner: Boolean(input.viewerId && carnet.author_id && input.viewerId === carnet.author_id),
    author: buildAuthor(input),
    participants: buildParticipants(input),
    stats,
    engagement: {
      likes: input.counts?.likes ?? toNumber(carnet.likes_count) ?? 0,
      comments: input.counts?.comments ?? toNumber(carnet.comments_count) ?? 0,
      views: toNumber(carnet.views_count) ?? 0,
      liked: input.liked,
      favorited: input.favorited,
    },
    likers: (input.likers ?? []).map((liker) => ({
      id: liker.user_id,
      name: liker.profile?.full_name?.trim() || liker.profile?.handle?.trim() || 'Auteur',
      handle: liker.profile?.handle ?? null,
      avatarUrl: liker.profile?.avatar_url ?? null,
      reaction: liker.reaction ?? 'like',
    })),
    moments,
    photoMoments: moments.filter((m) => Boolean(m.imageUrl)),
    days,
    etapes,
    summary,
    kit: {
      totalWeightG: kitWeight,
      items: (input.kitItems ?? []).map((k) => ({
        id: k.id,
        name: k.nom?.trim() || 'Élément sans nom',
        detail: k.detail?.trim() || null,
        weightG: toNumber(k.poids_g),
        color: k.couleur_tag ?? null,
        verdict: ((k.verdict ?? k.verdict_status ?? null) as KitVerdictType) || null,
        verdictNote: k.verdict_note ?? k.verdict_notes ?? null,
        joursUtilises: k.jours_utilises ?? [],
      })),
    },
    trace,
    elevationProfile,
    place: buildCarnetPlace(carnet, trace),
    distanceKm,
    elevationM,
    viewerRole,
    nights,
    dayReactions: input.dayReactions ?? {},
    momentEngagement: input.momentEngagement ?? {},
    kitVerdicts,
    livePosition: input.livePosition ?? null,
    publicZone: input.publicZone ?? null,
    budget,
    liveSharing: Boolean(carnet.live_sharing),
  };
}
