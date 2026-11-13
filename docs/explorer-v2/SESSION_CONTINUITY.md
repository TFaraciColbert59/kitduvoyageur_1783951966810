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

## Reprise du tracé, du hors-trace et des splits

L'intégration GPS/séances (commit `03b9537`) a ajouté trois éléments additifs :

1. **Itinéraire restauré.** La copie figée de l'itinéraire est écrite dans le
   magasin IndexedDB `session_routes` (base v3), séparément de la fiche de
   séance et des points. Elle n'est réécrite qu'au départ, au chargement de la
   géométrie ou en cas d'indisponibilité, jamais à chaque point. Une séance
   restaurée retrouve donc son hors-trace même hors ligne.
2. **Coupures de tracé.** Chaque point accepté porte, quand c'est utile,
   `breakBefore` (pause manuelle, reprise après pause automatique, trou GPS,
   reprise après rejet) et `drawn: false` (point capturé pendant une pause
   automatique, rejoué par le tracker mais non dessiné). Le tracé restauré ne
   relie plus deux points séparés par une pause par une corde droite.
3. **Métriques du premier rendu.** Le tracker rejoue les points avec le profil
   de pause du sport **avant** le rejeu, puis republie distance, D+, durée en
   mouvement, splits, splits impériaux et tours. L'interface n'affiche plus
   « découpe non disponible » en attendant le premier fix. Republier les
   métriques rejouées évite aussi de conserver un cumul de fiche supérieur aux
   points réellement persistés, puis de recompter le segment perdu au fix
   suivant.

Les anciennes fiches restent lisibles : `LocalSessionRecord` garde sa version 1
et la copie d'itinéraire est optionnelle. Les anciens points, sans
`breakBefore`/`drawn`, restent dessinés en un seul segment : on ne fabrique pas
une coupure qui n'a pas été persistée.

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
- Les points écrits avant l'intégration n'ont pas `breakBefore`/`drawn` : leur
  tracé restauré reste continu, et les points de pause automatique déjà
  enregistrés ne peuvent pas être distingués après coup.
- Une séance ouverte avant l'ajout de `session_routes`, ou dont l'écriture de
  la copie d'itinéraire n'avait pas encore abouti avant un rechargement, reste
  en suivi libre après restauration : aucune géométrie n'est inventée.
- La base IndexedDB passe de la version 2 à la version 3. La migration est
  additive et conserve les séances, mais un onglet resté sur un ancien bundle
  ne peut plus ouvrir une base plus récente (`VersionError`) : sa persistance
  locale s'arrête jusqu'au rechargement de l'application, sans effacer les
  données.
- Les points de pause automatique sont persistés et synchronisés pour que le
  rejeu soit exact ; ils ne sont ni dessinés ni comptés, mais ils augmentent le
  volume local et réseau. Un futur filtre pourra les exclure de l'envoi si leur
  seule utilité est la reprise locale.
- Le bilan restauré porte désormais sa route, mais la carte du bilan ne
  l'utilise pas encore : le hors-trace n'a de sens que pendant la séance.
- Le rejeu utilise les horodatages de mesure persistés, pas l'horodatage
  monotone de réception (`receivedAt`) : une correction de saut d'horloge
  appliquée en direct peut donc ne pas être reproduite à l'identique.
- Un rejet GPS survenu juste avant le rechargement n'est pas persisté : seuls
  les points acceptés le sont. Si le point suivant reste sous les seuils de
  plausibilité, le rejeu peut donc le relier au dernier point accepté.
- Si le réglage de pause automatique a changé entre la séance et le
  rechargement, le rejeu utilise le réglage courant. Les points et la trace
  restent exacts, mais l'état `autoPaused` reconstruit peut différer jusqu'au
  prochain fix.
- Aucun test, `tsc`, build ni lint n'a été exécuté, conformément à la consigne.
  Les contrôles sont reportés à la fin.
