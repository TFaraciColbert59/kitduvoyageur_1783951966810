# TRIBU Phase 7 — Partage de position live — Design Spec (lot 2)

Date : 2026-09-13 · Branche : `chantier/tribu-live` · Plan : `docs/superpowers/plans/2026-09-13-tribu-phase7-position-live.md`

## 1. Goal

Permettre aux membres d'un groupe de **partager volontairement leur position** pendant une sortie, et de voir celles des autres membres du même groupe sur la carte (`UnifiedExplorerMap`), avec les garanties TRIBU-R4/R6 :

| Exigence | Mise en œuvre |
|---|---|
| Désactivé par défaut | Aucune donnée sans démarrage explicite de session + opt-in individuel "Partager ma position" |
| Opt-in explicite par sortie | **Session live** démarrée manuellement depuis `/hub/groupe` (jamais automatique) |
| Jamais silencieux | Indicateur permanent dans le hub **et** sur la carte tant que le partage est actif ; badge « Partage actif » |
| Arrêt à un tap | « Arrêter le partage » (soi) sur chaque surface ; « Clôturer la session » (organisateur) |
| Expiration automatique | Pings à `expires_at = +15 min` ; session bornée (1-72 h) ; cron `expire-live-positions` (TRIBU-R6) |
| Zéro historique | Une seule position par (session, membre) — la dernière ; arrêt/expiration = **suppression** de la ligne |

## 2. Modèle de données

### M12 — `group_live_sessions`

```sql
id uuid PK, group_id uuid FK cascade, started_by uuid FK set null,
started_at timestamptz default now(), expires_at timestamptz NOT NULL,
stopped_at timestamptz NULL  -- NULL = session ouverte
CHECK (expires_at > started_at)
CHECK (expires_at <= started_at + interval '72 hours')
UNIQUE partiel (group_id) WHERE stopped_at IS NULL  -- une session ouverte par groupe
```

RLS :
- SELECT : `is_group_member(group_id, auth.uid())`.
- INSERT : `started_by = auth.uid()` + membre actif + `expires_at` borné (l'app calcule ; la contrainte borne).
- UPDATE (`stopped_at`) : `started_by = auth.uid()` OU `manage_members`.
- DELETE : service uniquement (aucune policy) — les sessions restent comme trace minimale (pas de position).

### M13 — `group_live_positions`

```sql
session_id uuid FK cascade, user_id uuid FK cascade, lat/lng double precision NOT NULL,
accuracy_m numeric NULL, heading numeric NULL,
updated_at timestamptz default now(), expires_at timestamptz NOT NULL,
PRIMARY KEY (session_id, user_id)
CHECK (lat between -90 and 90), CHECK (lng between -180 and 180)
```

RLS :
- SELECT : membre actif du groupe de la session **ET** session ouverte non expirée **ET** position non expirée (`expires_at > now()`). Jamais public, jamais hors groupe.
- INSERT/UPDATE (upsert) : `user_id = auth.uid()` + membre actif + session ouverte non expirée.
- DELETE : `user_id = auth.uid()` OU `manage_members` (arrêt/clôture). Le cron purge via service_role.

## 3. Serveur (actions)

`src/features/tribu/actions/livePosition.ts` :
- `startLiveSession({ groupId, durationHours })` → ferme les sessions expirées du groupe, refuse si une session ouverte existe, insère (`expires_at = now + duration`, 1-72 h), retourne la session.
- `stopLiveSession({ sessionId })` → `stopped_at = now()` (auteur ou `manage_members`), supprime les positions de la session.
- `sharePosition({ sessionId, lat, lng, accuracyM, heading })` → upsert `(session_id, user_id)` avec `expires_at = now + 15 min` ; refuse si session fermée/expirée.
- `stopSharingPosition({ sessionId })` → delete sa ligne.
- `getLiveState(groupId)` → session ouverte + ma position partagée (booléen) + positions des membres (nom via `public_profiles`, RLS filtre).

**Toutes les actions retournent des erreurs visibles** (jamais d'échec silencieux) : le hook affiche et coupe le partage en cas d'erreur répétée.

## 4. Client

### Hook `useLivePositionSharing`
- Props : `{ sessionId, enabled }`.
- `watchPosition` (haute précision désactivée pour la batterie? `enableHighAccuracy: true` uniquement au premier fix, puis `maximumAge` large), ping throttlé **45 s** via `sharePosition`, arrêt sur : toggle off, `visibilitychange` caché prolongé (> 2 min → stop + bandeau), erreur RLS/droits, démontage.
- En cas d'échec de ping : compteur d'échecs, bandeau « Partage interrompu » et arrêt automatique après 3 échecs (jamais de faux « actif »).
- Haptique léger au démarrage/arrêt.

### Hub (`/hub/groupe`)
- `LiveSharePanel` (desktop + mobile) :
  - Aucune session : bouton « Démarrer une sortie live » + copie de consentement claire (« Votre position ne sera visible que par les membres de ce groupe, pendant la session ») + durée (2 h / 8 h / 24 h).
  - Session ouverte : **indicateur permanent** « Sortie live — partage actif » + compte à rebours + nombre de membres qui partagent ; toggle « Partager ma position » ; « Arrêter mon partage » ; organisateur : « Clôturer la session ».
- L'indicateur reste visible tant que la session est ouverte, même si l'utilisateur ne partage pas.

### Carte (`UnifiedExplorerMap`)
- Nouvelle prop `memberPositions?: Array<{ userId, name, lat, lng }>` : source + couche de marqueurs avatars (Liquid Glass, initiale du prénom), visible uniquement pour les membres (données déjà filtrées par RLS).
- `ExplorerClient` : si l'aventure active est un collectif avec session live ouverte → fetch `getLiveState`, abonnement Realtime `group_live_positions` (canal `group-live-{id}`), refetch au changement + toutes les 60 s ; badge « Positions du groupe actives » + bouton « Arrêter mon partage » (1 tap) sur la carte.

## 5. Cron

`GET /api/cron/expire-live-positions` (CRON_SECRET, service) :
1. `delete group_live_positions where expires_at < now()` ;
2. `update group_live_sessions set stopped_at = now() where stopped_at is null and expires_at < now()`.
Retourne `{ positions, sessions }`.

## 6. Tests & preuves

- pgTAP `tribu_live.test.sql` : RLS lecture (membre oui / non-membre non / expirée non), écriture self-only, upsert, delete self/manage, contraintes lat/lng/durée, session unique ouverte.
- Vitest : actions (gate session ouverte/expirée, bornes durée, upsert payload, expiry +15 min, erreurs visibles) ; helper countdown ; composant `LiveSharePanel` (consentement, indicateur, actions).
- Cron : 401/503, purge sélective, test anti-TOCTOU.
- Garde design H-D85 + `silent-failure-hunter` (aucune fuite ni faux état « actif »).
- e2e : le panneau n'apparaît qu'avec une session ; arrêt à un tap.

## 7. DoD Phase 7

- [ ] Aucun partage par défaut ; aucun ping sans opt-in ; indicateur permanent ; arrêt 1 tap ; expiration ≤ 15 min par ping ; purge cron.
- [ ] Position lisible uniquement par les membres du groupe dont la session est ouverte et non expirée (pgTAP).
- [ ] Zéro historique (une ligne par membre et par session, supprimée à l'arrêt).
- [ ] `tsc`/`lint`/`vitest`/`build` verts + harnais DB vert ; migration prod appliquée ; merge `--no-ff` + push.
