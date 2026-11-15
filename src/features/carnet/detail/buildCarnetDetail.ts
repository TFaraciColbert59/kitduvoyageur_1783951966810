import { buildDays, buildSummary, toMomentItems } from './days';
import { etapeFromRow } from './editSchemas';
import { formatDateRange, formatElevation, formatKm, toNumber } from './format';
import { buildCarnetPlace } from './place';
import { pickElevationProfile } from './elevationProfile';
import { isSessionInCarnetWindow } from './trace';
import {
  isShareableTraceVisibility,
  projectTraceGeometry,
  resolveTraceMasks,
  type TraceViewer,
} from '@/features/compte/server/tracePrivacy';
import {
  ALL_OUTING_METRICS,
  NO_OUTING_METRICS,
  SHARED_SUMMARY_METRICS,
  canExposeElevationProfile,
  intersectMetricVisibility,
  metricVisibilityKeys,
  type OutingMetricVisibility,
} from '@/features/compte/domain/metricVisibility';
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

  /* Jours dérivés : les moments nomment leur jour, les points GPS des sorties
     datent le leur. Aucune valeur n'est inventée quand une source manque. */
  const sessions = input.sessions ?? (hikeSession ? [hikeSession] : []);
  const window = { startDate: carnet.start_date, endDate: carnet.end_date };
  const inWindow = (session: HikeSessionRow) => isSessionInCarnetWindow(session, window);
  const sessionsInWindow = sessions.filter(inWindow);

  /*
   * S6.15 — visibilité effective du carnet pour un lecteur tiers. Un agrégat
   * de carnet ne peut pas être plus permissif que la plus fermée de ses
   * sorties : sinon un total divulguerait la distance, le dénivelé ou la durée
   * qu'une sortie masque. C'est volontairement l'intersection de TOUTES les
   * sorties lues, y compris celles que le lecteur ne peut pas ouvrir : le
   * stock `carnets.distance_km` / `denivele_m` peut les avoir agrégées, donc
   * l'incertitude ferme la métrique.
   *
   * Le propriétaire conserve `ALL` sur ses propres sorties brutes (la map lui
   * donne toutes les clés) ; mais un agrégat qui mélange une sortie masquée
   * d'autrui se ferme aussi pour lui. Son usage propriétaire reste servi par
   * la fiche de sa sortie, pas par un total incertain. Un carnet sans sortie
   * (saisie manuelle) garde le socle agrégé. Une liste de sorties incomplète
   * (limite de lecture) ferme tout : mieux vaut un total absent qu'un total
   * qui ignore une sortie masquée.
   */
  const sessionsComplete = input.sessionsComplete !== false;
  /*
   * Une map absente n'est pas la même chose qu'une map partielle :
   *  - absente et lecteur propriétaire : appel historique, on conserve `ALL`
   *    pour ne pas casser ses statistiques ;
   *  - absente et lecteur tiers : fermé ;
   *  - présente mais sans entrée pour une sortie : fermé, même pour le
   *    propriétaire, car l'appelant a commencé à décrire les politiques et a
   *    omis une sortie.
   */
  const metricVisibilityBySession = input.metricVisibilities;
  const sessionMetricVisibility = (session: HikeSessionRow): OutingMetricVisibility => {
    const explicit = metricVisibilityBySession?.[session.id];
    if (explicit !== undefined) return explicit;
    return metricVisibilityBySession === undefined && viewerRole === 'participant'
      ? ALL_OUTING_METRICS
      : NO_OUTING_METRICS;
  };
  const carnetMetricVisibility: OutingMetricVisibility =
    !sessionsComplete
      ? NO_OUTING_METRICS
      : sessions.length === 0
        ? SHARED_SUMMARY_METRICS
        : intersectMetricVisibility(sessions.map(sessionMetricVisibility));

  const etapes = buildEtapes(input).map((etape) => ({
    ...etape,
    distanceKm: carnetMetricVisibility.distance ? etape.distanceKm : null,
    elevationM: carnetMetricVisibility.elevationGain ? etape.elevationM : null,
    /* `duree_texte` est du texte libre : elle peut porter une distance, un
       dénivelé ou une durée. On ne la garde que si les trois sont publiables. */
    durationText:
      carnetMetricVisibility.distance &&
      carnetMetricVisibility.elevationGain &&
      carnetMetricVisibility.duration
        ? etape.durationText
        : null,
  }));
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
  const statsSession = hikeSession && isRawSession(hikeSession) && inWindow(hikeSession) ? hikeSession : null;
  const rawSessions = sessions.filter(isRawSession);
  const rawSessionsInWindow = sessionsInWindow.filter(isRawSession);
  /*
   * Agrégat scalaire d'un carnet, calculé uniquement sur les sorties dont la
   * politique autorise la métrique. On n'utilise les colonnes du carnet que
   * s'il n'y a aucune sortie (carnet saisi à la main) : sinon elles pourraient
   * contenir une sortie masquée. Une liste incomplète ferme l'agrégat.
   */
  const aggregateMetric = (
    key: 'distance' | 'elevationGain',
    read: (session: HikeSessionRow) => unknown
  ): number | null => {
    if (!sessionsComplete || !carnetMetricVisibility[key]) return null;
    /*
     * Sans map de politiques, un appel historique propriétaire ne peut agréger
     * que ses sorties brutes : les autres lignes n'ont pas été autorisées par
     * `rawSessionIds`. Avec une map, chaque entrée porte le rôle vérifié.
     */
    const sources =
      metricVisibilityBySession === undefined && viewerRole === 'participant'
        ? rawSessionsInWindow
        : sessionsInWindow;
    let total: number | null = null;
    for (const session of sources) {
      if (!sessionMetricVisibility(session)[key]) continue;
      const value = toNumber(read(session));
      if (value === null) continue;
      total = (total ?? 0) + value;
    }
    return total;
  };
  /* Un total enregistré peut agréger des données privées. Le lecteur qui
     possède les sorties du séjour conserve ce total, les autres reçoivent
     les métriques explicitement autorisées pour les sessions concernées. */
  const isOwner = Boolean(input.viewerId && carnet.author_id === input.viewerId);
  const canUseDeclaredTotals =
    sessionsComplete &&
    (sessions.length === 0 ||
      (isOwner &&
        (metricVisibilityBySession === undefined ||
          (rawSessionsInWindow.length === sessions.length &&
            carnetMetricVisibility.distance && carnetMetricVisibility.elevationGain))));
  const carnetMetric = (
    key: 'distance' | 'elevationGain',
    declared: unknown,
    read: (session: HikeSessionRow) => unknown
  ) =>
    (canUseDeclaredTotals ? toNumber(declared) : null) ??
    aggregateMetric(key, read) ??
    (statsSession ? toNumber(read(statsSession)) : null);
  const distanceKm = carnetMetric('distance', carnet.distance_km, (session) => session.distance_km);
  const elevationM = carnetMetric('elevationGain', carnet.denivele_m, (session) => session.elevation_gain_m);
  /*
   * Une sortie partageable mais non brute ne fournit que ses métadonnées
   * agrégées. La politique par métrique décide lesquelles : sans elle, aucune
   * valeur ne sort (fail-closed). Retirer `started_at` avec la durée empêche de
   * recalculer celle-ci ou de replacer la sortie dans un jour par simple
   * lecture.
   */
  const metadataOnlySessions = sessionsInWindow
    .filter(
      (session) =>
        !isRawSession(session) && isShareableTraceVisibility(session.visibility),
    )
    .map((session) => {
      /*
       * Fail-closed : une sortie absente de la map ne retombe plus sur le
       * socle agrégé. Seul `getCarnetDetail`, qui a vérifié chaque rôle, peut
       * fournir une politique ; un appel incomplet ferme la métrique.
       * De plus, si le carnet entier ferme `distance`, `elevationGain` ou
       * `duration` par intersection, aucune sortie non brute ne peut alimenter
       * `summary` avec un sous-total partiel.
       */
      const visibility = sessionMetricVisibility(session);
      const allowDistance = carnetMetricVisibility.distance && visibility.distance;
      const allowElevation = carnetMetricVisibility.elevationGain && visibility.elevationGain;
      const allowDuration = carnetMetricVisibility.duration && visibility.duration;
      return {
        ...session,
        distance_km: allowDistance ? session.distance_km : null,
        elevation_gain_m: allowElevation ? session.elevation_gain_m : null,
        duration_seconds: allowDuration ? session.duration_seconds : null,
        started_at: allowDuration ? session.started_at : null,
        positions_geojson: null,
        positions_timed: null,
      };
    });
  const daySessions = [...rawSessionsInWindow, ...metadataOnlySessions];
  /*
   * Le profil construit depuis `positions_timed` contient les coordonnées
   * brutes du départ et de l'arrivée : il ne peut venir que d'une sortie
   * explicitement autorisée. Pour les autres lecteurs, `enrichCarnetElevation`
   * le reconstruit ensuite depuis la trace déjà projetée — mais seulement si
   * la politique du carnet autorise tout ce que le profil divulgue (distance,
   * altitude, dénivelé, altitude maximale).
   */
  /*
   * Une sortie brute est déjà autorisée par le rôle : son profil est visible.
   * Pour un visiteur, le profil n'est reconstructible que depuis la trace
   * partagée ; il doit alors respecter l'intersection des politiques du carnet
   * (distance, altitude, dénivelé, altitude maximale).
   */
  const elevationProfileVisible =
    rawSessions.length > 0 || canExposeElevationProfile(carnetMetricVisibility);
  const elevationProfile = elevationProfileVisible
    ? pickElevationProfile(rawSessionsInWindow.length > 0 ? rawSessionsInWindow : rawSessions)
    : [];
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
  /*
   * `days` est déjà filtré par `daySessions` : une sortie non brute n'a livré
   * que les métadonnées que sa politique autorise, une sortie privée d'autrui
   * rien du tout. On ne remasque donc pas les jours en bloc — cela priverait le
   * propriétaire de sa propre journée autorisée. `summary` reste la somme de
   * ces jours déjà sûrs.
   */
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
  const canUseHikeSessionTrace = hikeSession ? isRawSession(hikeSession) && inWindow(hikeSession) : false;
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

  /* Nuits du carnet (`carnet_nights`), triées par jour. Aucun repli : les
     anciennes tables `groupe_*` n'existent plus, une nuit absente n'est pas inventée. */
  const nights: CarnetNightItem[] = [...(input.nights ?? [])].sort(
    (x, y) => x.dayNumber - y.dayNumber
  );

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
    isOwner,
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
    /*
     * `true` quand le profil existe potentiellement mais que la politique
     * interdit de le publier. `enrichCarnetElevation` le lit pour ne pas le
     * reconstruire depuis la trace et l'UI peut dire « masqué » au lieu de
     * « aucune mesure ».
     */
    elevationWithheld: !elevationProfileVisible,
    metricVisibility: carnetMetricVisibility,
    metricsMasked:
      metricVisibilityKeys(carnetMetricVisibility).length <
      metricVisibilityKeys(ALL_OUTING_METRICS).length,
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
