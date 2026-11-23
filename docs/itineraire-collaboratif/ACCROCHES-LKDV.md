# Points d'accroche LKDV pour /compas/itineraire (cartographie du 22/11/2026)

C5 = src/features/compas/v5 · CE = src/features/compas/engine

## Compas v5
- `C5/Island.tsx:19` Island({toast, prep, running, t, onDismiss, ...}) ; `IslandToast {message; tone?: 'bad'; sub?; undo?}`.
- `C5/V5Sheet.tsx:15` V5Sheet() sans props, piloté par `useV5()` et le registre `C5/drawers/index.ts:16 DRAWERS` (day, nous, budget, sac, prevoir, verifs, meteo, menu). Contrat `drawers/types.ts:14 V5DrawerDef {space, tabs(api), title(api), subtitle(api), Body}`. Pas de crans : les 3 hauteurs sont dans le tiroir classique `CompasSheet` (`Detent`).
- `C5/ui/primitives.tsx` : Grp, Cap, Fi, Li, PBtn, MBtn, Chip, Switch, Stepper, Flow, Pic, Credit, Bar, Avi.
- `C5/context.tsx` V5Api {data, extras, ctl, t, locale, canEdit, solo, people, space, tab, day, openSpace, closeSpace, setTab, announce, prefs}.
- Tiroir Voyage : hors DRAWERS, rendu par `LegacyHost.tsx` ; `VOYAGE_FLOWS = ['activite','parcours','quand','preferences']` (CompasV5Screen.tsx:34, onglet→flux l.106-107). Onglet « Parcours » = `components/CompasOuFlows.tsx` (`RouteEditor` ~l.290).
- « Dis-le » : `C5/useDisLe.ts:15 useDisLe(ctl, onRoute)` → compasInterpretAction, planApplication, ctl.run.

## Lecture de phrase
- `CE/request.ts:83 understandRequest(text, today, precisions={}, locale='fr')` → {lines, activity, say, empty}. `CE/intent.ts:961 parseIntentRules`. Actions : set_destination{place,trail?}, set_origin, set_distance{km}, set_activity (COMPAS_ACTIVITIES intent.ts:84)… Pas d'action « boucle » (forme déduite dans itinerary.ts).

## Tracé du Compas (routeDraft)
- `CE/itinerary.ts:654 planItinerary(input)` → {shape 'base'|'traverse'|'loop', start, stages, distinct}.
- `RouteDraft = RouteRevision` (`src/features/adventure-prep/routeRevision.ts:83-99`) : {id, version, sport 'marche'|'route'|'gravel'|'vtt'|'enduro', engine, savedAt, points[{id,lat,lon,kind}], geometry, sections[{id, mode 'routed'|'manual', fromIndex, toIndex, geometry, distanceKm, durationMin, provider}], distanceKm, durationMin, provider, warnings}. Stocké dans `trips.metadata.compas.routeDraft`.
- Écrivain unique : `compasSaveRouteDraftAction` (`src/features/compas/server/compasActions.ts:1779`, zod `routeDraftSchema` l.1717, requireEditor + updateTripMetadata). Effaceur : `compasApplyRouteAction` l.1658. Lecteur : `readRouteDraft(metadata)` routeRevision.ts:758. Éditeur : `src/features/compas/components/RouteEditor.tsx:154`.

## Moteurs
- `C5/engine/stayOptions.ts:107 rankStayOptions(input)` · `CE/crew.ts:129 crewPace(members)` → {slowest, known, total}.
- `src/features/routes/analysis/difficulty.ts:112 analyzeDifficulty` (score 0-100, niveau 1-5, factors) · `fire.ts:179 analyzeFireAlerts`.
- Effort : `src/features/adventure-intelligence/domain/effortScore.ts:1289 computeEffortScore` ; `prediction.ts:217 predictRoute` ; `groupIntelligence.ts:395 buildGroupPlan`, `:751 simulateGroupPredictionV2`.
- Météo : `compas/server/weather.ts getCompasWeather` (MET Norway + NASA POWER). Vérifs : `C5/model/trip.ts` readiness, `CE/danger.ts assessDanger`.
- `CE/tripContext.ts` buildTripContext / tripContextFromRow → {days, nights, dated, startDate, endDate, hours, party, destination{name,countryCode,anchor}, activity}.

## Carte
- `C5/map/LiveMap.tsx:208 LiveMap(props)` (props l.55). `src/features/hub/webgl/WebGLArbiter.ts:28` singleton : acquire(holder)/release, holders 'camp-map'|'bag-scene' (à étendre).

## HUB
- `/hub/itineraire` = `src/app/hub/[section]/page.tsx` (branche itineraire ~l.186) → ItineraryPlannerClient / ItineraryMobileExperience. Cockpit `features/hub/cockpit/HubCockpit.tsx` (liens /hub/itineraire?jour=N l.854/940/1592), `HubCockpitMap.tsx:51`.
- `summarizeWorkspaceForHub` existe (`route-collab/integrations.ts:89`) mais n'est pas lu par le HUB.
- Checklist : section `checklist` (table `trip_checklist_items`, TripChecklistView / ChecklistMobileExperience). Résumé : `features/hub/server/preparationSummary.ts`.

## Explorer
- « Préparer avec ce tracé » : ABSENT dans `features/explorer-v2`. `app/compas/page.tsx:53` lit seulement {nouvelle, etape, v5}.

## Clubs
- Tables club_event_route_revisions/_sync/_decisions ; RPC publish_club_event_route, save_event_route_state, get_club_event_route_trace ; API `src/app/api/clubs/[id]/events/[eventId]/route.ts` (publish_route, sync_route, decide_route) ; UI `src/app/sorties/[id]/ClubEventRouteProposal.tsx`. Pont : `integrations.ts toClubRouteRevisionSnapshot`.

## Budget / Kit / Sorties
- Budget : `src/app/voyages/budget-actions.ts` (addExpenseAction…), `src/lib/queries-trip-budget.ts`, tiroir `C5/drawers/budget.tsx`.
- Kit : `src/lib/queries-trip-kit.ts:53 getTripKitDetails(slug, userId?)`, addTripItem…, `features/trips/server/createKitForTrip.ts`.
- Sorties : `POST /api/hike-sessions` (`src/app/api/hike-sessions/route.ts:214`) ; suivi `api/live-tracking/*` ; contacts `features/live-tracking/safetyContacts.ts`.
- Carnet : `CarnetDrawerV2.tsx:855` « Reprendre dans le Compas » (/compas?nouvelle=1&etape=ou&carnetId=…, carnetId non lu).

## Équipe
- `trip_collaborators` (role enum owner|editor|viewer), `trip_invitations` (editor|viewer), `src/features/compas/server/invitationActions.ts`. SQL `can_read_trip(uuid)`, `can_edit_trip(uuid)`.
- Realtime Broadcast : un seul usage, `src/features/messaging/hooks/useRealtimeMessaging.ts:28-81`.

## Compte / Admin
- Effort : `src/components/compte/overlay/EffortSubDrawers.tsx`, `CompteOverlayHost.tsx`.
- Admin : `src/app/admin/page.tsx` (modération/audit en constantes en dur), tables `admin_audit_log`, `moderation_queue`, `comment_reports`.

## Tiroir de l'itinéraire : ce qui est réutilisé du Compas v5 (état du 22/11/2026)
- Contenant : `ExplorerSheet` reste le conteneur du tiroir. `V5Sheet` ne prend aucune prop (il est piloté par `useV5()` et le registre `DRAWERS`, donc lié au voyage du Compas) : il ne peut pas porter l'atelier d'itinéraire. On y a ajouté, sans changer les autres écrans, `threeDetents` (aperçu, moitié par défaut, plein) et le bandeau `summary` (tuiles chiffrées).
- Matière : les lignes (`Li` → `RouteRow`), groupes (`Grp`), puces (`Chip`), boutons (`PBtn`), interrupteur et légendes (`Cap`) viennent de `v5/ui/primitives.tsx`, sous la portée `V5Scope` (`.v5 .rcw-v5`, `display: contents`). `v5.css` est importé par l'espace de travail.
- Îlot : `IslandNote` (`v5/Island.tsx`) porte l'annonce unique de l'itinéraire ; `Island` du Compas partage son corps (`IslandNoteBody`).
- Non réutilisé : `Flow` (capsule d'icônes, l'itinéraire garde la capsule d'onglets de l'Explorer avec libellés accessibles) et les `DRAWERS` du Compas.
