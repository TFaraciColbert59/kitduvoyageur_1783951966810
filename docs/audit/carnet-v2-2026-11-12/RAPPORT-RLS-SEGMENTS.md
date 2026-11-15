# Carnet v2 — correction RLS des lignes brutes et frontières de segments

Date : 2026-11-12 · Worktree : `lkdv-p01-trace` · Base : `5f11edf`

Périmètre : les deux constats de la revue restés ouverts — lecture directe des
lignes brutes de `hike_sessions` et perte des frontières de segments dans les
jours du carnet. Aucun réseau, aucun build global, aucune délégation, aucune
reproduction offensive.

## 1. Lignes brutes : la table n'est plus lisible par le partage

### Ce qui était ouvert

- `hike_sessions_select_owner_or_public_carnet` (phase 8) rendait toutes les
  sorties d'un carnet public, y compris celles dont
  `hike_sessions.visibility = 'private'` ;
- `hike_sessions_select_shared_carnet` (20261112090000) élargissait la même
  lecture brute aux sorties `collective_anonymized` d'un carnet `friends` ;
- la fiche masquait la trace en TypeScript, mais un SELECT PostgREST direct
  contournait ce masquage et lisait `positions_geojson`, `positions_timed`,
  `notes`, `weather`, etc.

### Correction

Migration `supabase/migrations/20261112121000_carnet_v2_trace_raw_guard.sql` :

- suppression des deux policies de lecture par carnet ;
- création de `hike_sessions_select_owner_or_participant`, réservée à
  `authenticated`, qui n'autorise que :
  - `user_id = auth.uid()` (propriétaire),
  - ou une ligne `hike_session_participants` pour le lecteur (participant
    inscrit).

Le partage masqué reste servi par la fiche carnet :
`getCarnetDetail` vérifie d'abord l'accès au carnet avec le client utilisateur,
puis lit les sorties avec le client `service_role` et applique
`tracePrivacy`/`buildCarnetDetail` avant de rendre la trace. Sans clé service,
le code retombe sur le client utilisateur : le partage se dégrade, il ne
s'ouvre pas.

`GET /api/hike-sessions/[id]` ne sélectionne que des métadonnées sûres ; il
vérifie désormais explicitement l'autorisation (propriétaire, participant,
sortie publique, abonné vérifié, ou sortie collective d'un carnet visible)
avant de répondre. Une sortie privée d'un carnet public renvoie 404.

### Tests

- `supabase/tests/database/phase8_rls_access.test.sql` : la session privée
  `d2` du carnet public n'est plus visible par le tiers B (0 ligne) ; la
  policy attendue est `hike_sessions_select_owner_or_participant`.
- `supabase/tests/database/phase8_rls_trace_guard.test.sql` (nouveau, 7
  assertions) : anonyme = 0 ligne, tiers = 0, propriétaire = ses 3 sorties,
  participant = sa seule sortie privée, abonné = 0 ligne brute, policy
  historique absente.
- `src/features/carnet/detail/__tests__/getCarnetDetail.test.ts` : un
  participant à une sortie garde la trace complète de *cette* sortie mais reste
  `visitor` pour le carnet ; le participant d'une autre sortie ne reçoit pas la
  trace de la sortie exposée.
- `src/app/api/hike-sessions/[id]/__tests__/route.test.ts` : 404 pour une
  sortie privée avec un visiteur, 404 pour `friends` non suivi et pour une
  collective dont le carnet n'est pas visible, 200 pour le propriétaire, le
  participant, l'abonné et la collective visible.

## 2. Frontières de segments dans les jours

`buildDays` utilisait `parsePositions`, qui aplatit les `MultiLineString` :
une seule sortie contenant deux morceaux (coupure GPS, zone masquée) était
rendue comme un seul segment et le vide était recousu.

Correction dans `src/features/carnet/detail/days.ts` :

- `geometryPointSegments` utilise `parseTraceSegments` et conserve chaque
  morceau ;
- les points sont répartis par jour **morceau par morceau** ; chaque morceau
  d'un jour devient un `DayRun` distinct ;
- `points` reste la concaténation pour les statistiques, `segments` porte les
  morceaux séparés pour la carte ;
- la distance est toujours la somme des morceaux, jamais le saut qui les
  sépare.

Test ajouté dans `src/features/carnet/detail/__tests__/days.test.ts` : une
seule `MultiLineString` de deux morceaux produit deux `segments`, quatre
points, et une distance sans le pont entre les morceaux.

Limite assumée : `positions_timed` est un tableau plat sans métadonnée de
frontière ; quand il est présent, il reste un seul morceau. La correction
couvre la géométrie `positions_geojson`, qui porte les frontières réelles.

## 3. Vérifications exécutées

- `npx tsc --noEmit -p .` : passe.
- Tests ciblés (sans réseau, configuration Vitest locale équivalente, cache
  dans le worktree) :
  `src/features/carnet/detail/__tests__`, `src/components/carnet/v2/__tests__`,
  `src/components/carnet/profile/__tests__`, `src/features/compte/server/__tests__`,
  `src/app/api/hike-sessions/[id]/__tests__` :
  **39 fichiers, 408 tests passés**.
- ESLint ciblé : 0 erreur, 2 avertissements préexistants (`carnet` inutilisé
  dans `buildCarnetDetail`, `KitVerdictType` inutilisé dans
  `getCarnetDetail`).

## 4. Limites

1. **Aucune base, aucun pgTAP exécuté** : la migration et les tests SQL sont
   écrits mais non appliqués. À valider sur une copie avant production, avec
   `supabase/migrations_down/20261112121000_carnet_v2_trace_raw_guard.down.sql`.
2. **Aucun build global ni rendu MapLibre réel** : les composants sont testés
   en jsdom ; la carte WebGL n'a pas été ouverte.
3. **`loadOutingDetail`** reste réservé au propriétaire/participant par la RLS ;
   le drawer du Compte n'est pas un chemin de partage public.
4. **Auteur/collaborateur du carnet** : seul le propriétaire de la sortie ou
   un participant inscrit voit la trace complète. Un auteur/collaborateur qui
   n'a pas participé reçoit les masques début/fin pour une sortie partageable,
   et la trace entièrement masquée pour une sortie privée.
5. **Activité réseau** : `reseau.ts` lit encore `hike_sessions` avec le client
   utilisateur pour compter l'activité des personnes suivies. La nouvelle RLS
   lui rendra 0 ligne pour autrui. Si le produit veut garder ce compteur, il
   faut un RPC de métadonnées (`user_id`, `started_at`) plutôt qu'une policy
   de table, qui exposerait aussi les coordonnées.

## Mise à jour — 2026-11-12 (service_role et RLS du participant)

La version de cette migration est renumérotée en **`20261112121000`** pour ne
plus entrer en collision avec `20261112120000_explorer_v2_activity_finish_hardening.sql`
de la branche `a01-session`. Le down et les références suivent.

La fuite résiduelle dans `days`/`segments`/`elevationProfile` et les droits
d'écriture/live du participant de sortie sont traités dans
`RAPPORT-SERVICE-ROLE-ET-RLS.md` : autorisation par sortie (`rawSessionIds`),
migration `20261112122000_carnet_v2_participant_scope`, tests du chemin
`service_role` et garde-fou sur les versions dupliquées. **Aucune migration
n'a été appliquée et le registre de production n'a pas été vérifié.**
