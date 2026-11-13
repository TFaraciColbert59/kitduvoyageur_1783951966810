import { buildDays, buildSummary, toMomentItems } from './days';
import { formatDateRange, formatElevation, formatKm, toNumber } from './format';
import { buildCarnetPlace } from './place';
import { pickElevationProfile } from './elevationProfile';
import {
  isShareableTraceVisibility,
  projectTraceGeometry,
  resolveTraceMasks,
  type TraceViewer,
} from '@/features/compte/server/tracePrivacy';
import { SHARED_SUMMARY_METRICS } from '@/features/compte/domain/metricVisibility';
import type {
  BuildCarnetDetailInput,
  CarnetEtapeDay,
  CarnetDetail,
  CarnetMomentItem,
  CarnetNightItem,
  CarnetParticipant,
  CarnetStatItem,
  CarnetViewerRole,
  CarnetKitVerdictItem,
  HikeSessionRow,
  KitVerdictType,
} from './types';

const UNTITLED = 'Carnet sans titre';

function buildAuthor(input: BuildCarnetDetailInput) {
  const { author } = input;
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
  const overnightByDay = new Map<number, string>();
  for (const h of input.hebergements ?? []) {
    const day = h.apres_jour_numero;
    if (day && h.nom) overnightByDay.set(day, h.nom);
  }

  const rawEtapes = input.etapes ?? [];
  if (rawEtapes.length > 0) {
    return rawEtapes.map((e) => {
      const dayNumber = e.jour_numero ?? e.ordre ?? 1;
      const dateLabel = e.date_etape
        ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
            new Date(`${e.date_etape}T12:00:00Z`)
          )
        : null;
      return {
        id: e.id,
        dayNumber,
        label: dateLabel ? `JOUR ${dayNumber} · ${dateLabel}` : `JOUR ${dayNumber}`,
        from: e.lieu_depart?.trim() || null,
        to: e.lieu_arrivee?.trim() || null,
        note: e.recit?.trim() || null,
        distanceKm: toNumber(e.distance_km),
        elevationM: toNumber(e.denivele_m),
        durationText: e.duree_texte?.trim() || null,
        weather:
          [
            e.meteo?.trim(),
            e.temperature_c !== null && e.temperature_c !== undefined
              ? `${e.temperature_c} °C`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        overnight: overnightByDay.get(dayNumber) ?? null,
      };
    });
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
  const viewerRole: CarnetViewerRole =
    input.viewerRole ??
    (input.viewerId && carnet.author_id === input.viewerId ? 'participant' : 'visitor');
  const isVisitor = viewerRole === 'visitor';
  /*
   * Le rôle de trace est distinct du rôle de fiche : un participant à la sortie
   * qui porte le tracé garde sa trace complète sans devenir participant du
   * carnet (jours, budget). L'appelant fournit `traceViewer` après vérification
   * réelle de la relation ou de la participation ; sans lui, on retombe sur le
   * rôle de fiche.
   */
  const traceViewer: TraceViewer = input.traceViewer ?? (isVisitor ? 'visitor' : 'participant');
  const needsTraceProjection =
    traceViewer === 'follower' || traceViewer === 'visitor';
  const moments = toMomentItems(input.moments);
  const etapes = buildEtapes(input);

  /* Jours dérivés : les moments nomment leur jour, les points GPS des sorties
     datent le leur. Aucune valeur n'est inventée quand une source manque. */
  const sessions = input.sessions ?? (hikeSession ? [hikeSession] : []);
  /*
   * Autorisation PAR SORTIE. Le client `service_role` lit toutes les lignes du
   * carnet après contrôle d'accès, mais seules celles dont le lecteur est
   * propriétaire ou participant inscrit peuvent alimenter les points GPS, les
   * statistiques et le profil altimétrique. Une sortie privée d'autrui est
   * entièrement écartée ; une sortie explicitement partageable mais non
   * autorisée ne fournit que ses métadonnées agrégées (date, durée), jamais ses
   * coordonnées.
   *
   * `rawSessionIds` est fail-closed : absent, il vaut liste vide. Un futur
   * appelant qui oublierait la liste ne rouvre donc pas les points GPS, les
   * statistiques ni le profil d'une sortie d'autrui (F8).
   */
  const rawSessionIds = new Set(input.rawSessionIds ?? []);
  const isRawSession = (session: HikeSessionRow) => rawSessionIds.has(session.id);
  const statsSession = hikeSession && isRawSession(hikeSession) ? hikeSession : null;
  const distanceKm = toNumber(statsSession?.distance_km) ?? toNumber(carnet.distance_km);
  const elevationM = toNumber(statsSession?.elevation_gain_m) ?? toNumber(carnet.denivele_m);
  const rawSessions = sessions.filter(isRawSession);
  /*
   * Une sortie partageable mais non brute ne fournit que ses métadonnées
   * agrégées. La politique par métrique décide lesquelles : sans elle, le socle
   * agrégé par défaut s'applique, jamais une valeur supplémentaire. Retirer
   * `started_at` avec la durée empêche de recalculer celle-ci ou de replacer la
   * sortie dans un jour par simple lecture.
   */
  const metadataOnlySessions = sessions
    .filter(
      (session) =>
        !isRawSession(session) && isShareableTraceVisibility(session.visibility),
    )
    .map((session) => {
      const visibility =
        input.metricVisibilities?.[session.id] ?? SHARED_SUMMARY_METRICS;
      return {
        ...session,
        distance_km: visibility.distance ? session.distance_km : null,
        elevation_gain_m: visibility.elevationGain ? session.elevation_gain_m : null,
        duration_seconds: visibility.duration ? session.duration_seconds : null,
        started_at: visibility.duration ? session.started_at : null,
        positions_geojson: null,
        positions_timed: null,
      };
    });
  const daySessions = [...rawSessions, ...metadataOnlySessions];
  /*
   * Le profil construit depuis `positions_timed` contient les coordonnées
   * brutes du départ et de l'arrivée : il ne peut venir que d'une sortie
   * explicitement autorisée. Pour les autres lecteurs, `enrichCarnetElevation`
   * le reconstruit ensuite depuis la trace déjà projetée.
   */
  const elevationProfile = pickElevationProfile(rawSessions);
  const builtDays = buildDays({
    moments: input.moments,
    sessions: daySessions,
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
     (`pickCarnetTrace`), pas forcément celle qui donne les statistiques. Pour
     un visiteur, elle passe par la politique unique de partage : la visibilité
     effective est la plus restrictive du carnet et de la sortie, puis début et
     fin sont masqués — ou toute la trace si elle n'est pas explicitement
     partageable. La projection est calculée une seule fois pour exposer aussi
     son état (masquée, totalement masquée, erreur). */
  const canUseHikeSessionTrace = hikeSession ? rawSessionIds.has(hikeSession.id) : false;
  const rawTrace =
    input.trace ?? (canUseHikeSessionTrace ? (hikeSession?.positions_geojson ?? null) : null);
  const traceVisibility = input.traceVisibility ?? carnet.visibility;
  const projectedTrace =
    needsTraceProjection && rawTrace !== null && rawTrace !== undefined
      ? projectTraceGeometry(
          rawTrace,
          resolveTraceMasks({ viewer: traceViewer, visibility: traceVisibility })
        )
      : null;
  const trace = needsTraceProjection ? (projectedTrace?.geometry ?? null) : rawTrace;
  const traceWithheld = input.traceWithheld === true;
  const traceMasked = projectedTrace?.masked ?? traceWithheld;
  const traceFullyMasked = projectedTrace?.fullyMasked ?? traceWithheld;
  const traceError = projectedTrace?.error ?? null;
  /*
   * Les points de jour sont déjà filtrés par `daySessions` : une sortie non
   * autorisée n'a livré ni point ni segment. Plus de masquage global par
   * `isVisitor`, qui privait aussi le participant de sa propre trace.
   */
  const viewerDays = days;

  const nights: CarnetNightItem[] =
    input.nights && input.nights.length > 0
      ? input.nights
      : (input.hebergements ?? []).map((h) => ({
          id: h.id,
          dayNumber: h.apres_jour_numero ?? 1,
          name: h.nom?.trim() || 'Hébergement',
          type: (['refuge', 'gite', 'bivouac', 'hotel', 'camping', 'autre'].includes(
            (h as { type_hebergement?: string | null }).type_hebergement ?? ''
          )
            ? (h as { type_hebergement?: string | null }).type_hebergement
            : 'refuge') as CarnetNightItem['type'],
          altitudeM: toNumber(h.altitude_m),
          infos: h.prix_note || h.note || null,
          lat: null,
          lng: null,
          mapRefugeId: null,
        }));

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
    days: viewerDays,
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
    traceMasked,
    traceFullyMasked,
    traceError,
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
