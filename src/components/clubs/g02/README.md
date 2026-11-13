# Lot G02 — écrans & API clubs

Ce lot branche les écrans clubs sur le contrat pur `src/features/clubs` (K5.21–K5.23,
S5.07, S5.10, S5.11, S5.13–S5.19). Aucun fichier verrouillé (`ExplorerV2.tsx`,
`SheetContent.tsx`, `useGpsTracker.ts`, `state/*`, `src/features/clubs/*`) n’est modifié.

## Composants (`src/components/clubs/g02`)

| Composant | Fiche | Rôle |
|---|---|---|
| `ClubG02Screen` | toutes | coque d’écran : identité, onglets accessibles, panneau actif |
| `ClubIdentityHeader` | S5.10 | nom, confidentialité, badge club vérifié, compteurs |
| `ClubMembersPanel` | S5.07/S5.10 | membres, demandes, rôles, sourdine, retrait/bannissement, badge Pro |
| `ClubSalonsPanel` | S5.07 | salons, messages, lecture seule, modération, signalement |
| `ClubEventsBoard` | K5.21, S5.13–S5.16 | recherche de sorties, capacité, liste d’attente, lien course |
| `ClubEventDetail` | K5.21/K5.23/S5.14 | fiche sortie, présence consentie, flyer, révisions de tracé |
| `ClubChallengesPanel` | défis | progression, badge, création et inscription |
| `ClubLeaderboard` | S5.11 | podium, tableau, métrique, exclusions sans noms |
| `ClubInvitesPanel` | K5.21/K5.22/S5.19 | liens/QR, quotas, révocation, invitations de trace |
| `ClubActivityMatchingPanel` | S5.17/S5.18 | groupes d’activités et appariement sortie ↔ activité |

Les composants sont contrôlés (`props` + callbacks) : le parent serveur charge les
données et applique `canViewClub` / `canViewClubEvent`. Les composants revalident
néanmoins les décisions sensibles avec le contrat (`listChannelMessagesForViewer`,
`changeMemberRole`, `removeOrBanClubMember`, `challengeProgress`, etc.), de sorte
qu’une donnée oubliée côté serveur ne devient jamais visible par accident.

```tsx
<ClubG02Screen
  club={club}
  memberCount={members.length}
  eventCount={events.length}
  challengeCount={summaries.length}
  viewerMembership={viewerMembership}
  activeSection="events"
  onSectionChange={setSection}
>
  <ClubEventsBoard
    events={events}
    clubsById={new Map([[club.id, club]])}
    memberships={members}
    viewerContext={{ viewerId: user?.id ?? null, viewerClubIds: [club.id] }}
    registrations={registrations}
    currentUserId={user?.id ?? null}
    nowIso={nowIso}
    onRegister={register}
    onCancel={cancel}
  />
</ClubG02Screen>
```

## API (`src/app/api/clubs`)

| Route | Méthodes | Contrat |
|---|---|---|
| `/api/clubs` | `GET`, `POST` | `filterVisibleClubs`, `createClubWithFounder` |
| `/api/clubs/[id]` | `GET`, `PATCH` | `canViewClub`, badge S5.10 |
| `/api/clubs/[id]/members` | `GET`, `POST`, `PATCH` | `requestOrJoinClub`, `reviewJoinRequest`, `changeMemberRole`, `muteClubMember`, `removeOrBanClubMember` |
| `/api/clubs/[id]/salons` | `GET`, `POST` | `listChannelMessagesForViewer`, `postChannelMessage`, `moderateChannelMessage`, `reportChannelMessage` |
| `/api/clubs/[id]/events` | `GET`, `POST` | `searchClubEvents`, `canViewClubEvent` |
| `/api/clubs/[id]/events/[eventId]` | `GET`, `POST` | `registerForClubEvent`, `cancelEventRegistration`, `publishEventRouteRevision`, `syncParticipantRouteRevision`, `buildEventFlyer`, `computeEventAttendanceStats` |
| `/api/clubs/[id]/challenges` | `GET`, `POST` | `createClubChallenge`, `joinChallenge`, `recordActivityInChallenge`, `computeClubChallengeSummary` |
| `/api/clubs/[id]/leaderboard` | `GET` | `buildWeeklyClubLeaderboard` |
| `/api/clubs/events` | `GET` | recherche transverse S5.15/S5.16 |
| `/api/clubs/invites` | `GET`, `POST` | `createInviteLink` |
| `/api/clubs/invites/[token]` | `GET`, `POST`, `DELETE` | `redeemInviteLink`, `revokeInviteLink` |
| `/api/clubs/activity-invites` | `GET`, `POST`, `PATCH` | `inviteFriendToRecordedActivity`, `updateRecordedActivityInvite` |
| `/api/clubs/matching` | `POST` | `matchActivityToClubEvent`, `detachActivityFromEvent`, `detectGroupActivities` |

Toutes les mutations vérifient l’origine (CSRF), toutes les entrées sont validées par
Zod, les réponses sont `Cache-Control: no-store, private`. Les erreurs du contrat
sont traduites en statuts stables (`401`, `403`, `404`, `409`, `410`).

## Base de données

`supabase/migrations/20261113120000_clubs_g02_ui_api.sql` ajoute les colonnes et
tables additives nécessaires (salons, inscriptions, présence, révisions de tracé,
invitations, progression de défi, appariement). RLS activée sur chaque nouvelle
table ; helpers `lkdv_is_club_member` / `lkdv_is_club_moderator` en
`SECURITY DEFINER` avec `search_path` verrouillé et `EXECUTE` retiré à `PUBLIC`.
Le classement lit `lkdv_club_week_activities`, qui ne renvoie que les activités des
membres actifs du club demandé.

## Tests

```bash
npx vitest run src/components/clubs/g02 src/app/api/clubs src/features/clubs
```

Les tests couvrent les projections d’affichage, le filtrage fail-closed des
messages/sorties, les actions de modération, les invitations, le classement, les
défis et les route handlers (statuts, CSRF, mapping).
