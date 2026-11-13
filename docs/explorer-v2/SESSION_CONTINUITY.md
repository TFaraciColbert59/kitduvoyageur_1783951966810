# Continuité de séance · Explorer v2

Date : 2026-11-13. Branche de travail : `codex/lkdv-a01-session` (base `5b7c617`).
Fiches : **S1.02** (choix du sport, reprise GPS) et **K6.15** (continuité des
données web/mobile/appareils), chantier **A01**.

## Ce qui manquait réellement

Le parcours existant savait choisir un sport, lancer un suivi GPS local et
afficher un bilan. La fin de séance était déjà mise en file hors ligne
(`5b7c617`). En revanche :

- le client n'appelait **jamais** `/api/explorer/v2/activity/start` : aucune
  séance serveur n'était créée, et le bilan restait local ;
- aucun point GPS n'était persisté localement : un rechargement, un
  verrouillage ou un arrêt du processus perdait le tracé et les métriques ;
- aucune reprise ne restaurait l'identité, l'ordre des points ou le bilan ;
- la file hors ligne ne savait pas rejouer une fin dont la séance n'existait
  pas encore côté serveur.

## Contrat livré

1. **Identité avant le premier point.** `useTransientStart` génère un
   `clientSessionId` (UUID v4) et le transmet à `startActivity`. Le serveur le
   reçoit dans `start_activity_session`, qui reste idempotent :
   - même identité + même contenu ⇒ même `sessionId` (`created=false`) ;
   - même identité + contenu différent ⇒ `409` explicite.
2. **Écriture locale avant synchro.** Chaque point accepté par
   `ActivityTracker` est écrit dans IndexedDB avec une séquence monotone. Les
   points rejetés (précision > 30 m, saut > 100 m, etc.) ne sont ni dessinés ni
   persistés.
3. **Progression idempotente.** La RPC `sync_activity_session` insère les
   points avec `on conflict (session_id, client_seq) do nothing`, puis met à
   jour les seules métriques de la séance (`distance_m`, `elev_gain_m`,
   `moving_s`, `status`, dernière position). Une réponse perdue est rejouée
   sans doublon.
4. **Fin sans perte.** La fin pousse d'abord les derniers points, crée la
   séance si elle n'existe pas encore, transmet l'heure réelle de départ et
   d'arrêt (une reprise hors ligne ne doit pas inventer une durée), puis appelle
   `finish_activity_session_idempotent`. Une séance locale sans jeton reste en
   file avec `unauthenticated` et sera reprise après connexion.
5. **Restitution.** Au montage, l'Explorer relit la séance active (identité,
   points, métriques) ou, à défaut, le dernier bilan de moins de 24 h. Le bilan
   est réaffiché sans nouvelle commande UI ; K6.15 interdit un écran dédié.

## Fichiers

| Rôle | Fichier |
|---|---|
| Base IndexedDB partagée (outbox + séances) | `src/features/explorer-v2/offline/db.ts` |
| Fiche et points locaux, curseurs | `src/features/explorer-v2/activity/localSession.ts` |
| Démarrage, points, fin idempotents | `src/features/explorer-v2/activity/sessionSync.ts` |
| Route de progression | `src/app/api/explorer/v2/activity/points/route.ts` |
| Migration additive | `supabase/migrations/20261113090000_explorer_v2_activity_points_sync.sql` |
| Rollback | `supabase/migrations_down/20261113090000_explorer_v2_activity_points_sync.down.sql` |
| Raccordement | `ExplorerV2.tsx`, `state/store.ts`, `state/types.ts`, `activity/useGpsTracker.ts` |

## Migration : pourquoi elle est nécessaire

`activity_points` n'avait aucune clé fournie par le client. Sans elle, un rejeu
après réponse perdue insère les mêmes points une seconde fois. La migration
ajoute uniquement :

- `activity_points.client_seq integer` (nullable pour l'historique) ;
- un index unique `(session_id, client_seq)` ;
- la RPC `sync_activity_session` (`security definer`, `search_path` verrouillé,
  `execute` réservé à `authenticated`).

Aucune table, policy ou donnée existante n'est supprimée. Les anciens clients
gardent leurs droits d'insertion directe. Version **`20261113090000`**, hors de
la plage `2026111212xxxx` déjà réservée par les branches séance et carnet.

## Ordre de déploiement

1. `20261111120000_explorer_v2_activity_start` (existe déjà sur la branche) ;
2. `20261112120000_explorer_v2_activity_finish_hardening` (existe déjà) ;
3. `20261113090000_explorer_v2_activity_points_sync` (cette tranche), avec
   son down ;
4. seulement ensuite le client qui pousse des points.

Le client local démarre même si la base n'est pas encore migrée ; il garde la
file et réessaie. Aucune migration n'a été appliquée pendant cette session.

## Dépendance avec la branche GPS

La branche GPS A01 (`codex/lkdv-a01-sports`, travaux S1.05 : pauses, rafales
GPS, hors-trace, splits ; `codex/lkdv-a01-autopause` pour le tracker seul)
modifie les mêmes fichiers de couture :

- `src/features/explorer-v2/activity/useGpsTracker.ts` : ajout additif de
  l'option `restored` (rejoue les points déjà acceptés) ;
- `src/features/explorer-v2/ExplorerV2.tsx` : restauration, persistance des
  points, synchro de progression ;
- `src/features/explorer-v2/state/store.ts` et `state/types.ts` : champ
  optionnel `clientSessionId` et 4ᵉ argument optionnel de `startActivity` ;
- `src/features/explorer-v2/sheet/SheetContent.tsx` : texte de départ.

Ces changements sont **additifs et optionnels** : un appel
`startActivity(sport, sessionId, selection)` sans `clientSessionId` garde le
comportement local des tests et des scènes. La fusion doit conserver l'option
`restored` et le filtre `metrics.lastFix === fix` dans le hook GPS. Aucun
capteur, aucune permission et aucun point ne sont simulés par cette tranche.

## Limites honnêtes

- Aucune preuve sur iOS/Android réels : verrouillage, mode avion, arrêt du
  processus et reprise native restent à recetter (dépendance GPS/native).
- Aucune découverte d'une séance live créée sur un **autre** appareil : la
  reprise part de la fiche locale. Choisir la source de capture entre appareils
  relève de la branche GPS/native et n'est pas simulé ici.
- Les séances ouvertes avant cette version n'ont pas de `clientSessionId` :
  elles ne peuvent pas être reprises ni rattachées rétroactivement sans
  fabriquer une identité. Elles restent locales.
- La durée affichée reste calculée sur l'horloge murale ; la durée en mouvement
  (`moving_s`) est persistée. Une horloge système modifiée n'est pas corrigée
  par cette tranche.
- IndexedDB indisponible ⇒ pas de persistance locale ; l'écran ne prétend pas
  le contraire.
- Aucun test, `tsc`, build ni lint n'a été exécuté, conformément à la consigne.
  Les contrôles sont reportés à la fin.
