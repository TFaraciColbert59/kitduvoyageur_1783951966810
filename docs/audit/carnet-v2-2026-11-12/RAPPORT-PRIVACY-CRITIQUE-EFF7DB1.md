# Carnet v2 — revue privacy critique de `eff7db1` : corrections et limites

Date : 2026-11-12 · Worktree : `lkdv-p01-trace` · Commit revu : `eff7db1`
Revue source : `work/lkdv-p01-privacy-critical-review.jsonl`

Périmètre : constats critiques et élevés F1 à F4, puis constats sensibles
vérifiés F5, F6 et F8. F7 est traité comme une limite de déploiement, pas comme
un correctif SQL.

## 0. État de la session

- **Aucune migration appliquée**, ni en production, ni sur une base locale.
- **Aucun test, pgTAP, Vitest, lint ou build exécuté** : Tony reporte les suites
  et la revue à la fin. Les commandes de contrôle sont documentées dans
  `CONTROLES-SQL-PRIVACY-CRITIQUE.sql`.
- **Aucun accès production, aucun réseau hors modèle, aucun commit, aucune
  délégation.**
- Les migrations `20261112121000` et `20261112122000` étaient locales et non
  déployées : elles sont corrigées sur place pour que la chaîne soit sûre dès
  qu'elle est appliquée. Si l'une d'elles avait déjà été appliquée quelque part,
  les nouveaux `DROP/CREATE` ne seraient pas rejoués : il faudrait un
  forward-fix explicite (voir §4).

## 1. Corrections par constat

### F1 — Critique — auto-promotion dans `carnet_collaborators`

**Cause.** La policy historique `carnet_collab_manage` (`FOR ALL TO
authenticated USING/WITH CHECK user_id = auth.uid()`) permettait à tout
utilisateur authentifié d'insérer sa propre ligne avec n'importe quel
`carnet_id` et n'importe quel rôle, ou de promouvoir sa ligne `viewer`. Comme
`is_carnet_editor` fait confiance à cette table, l'attaquant devenait éditeur
de n'importe quel carnet et lisait les positions live exactes.

**Correction** — `supabase/migrations/20261112122000_carnet_v2_participant_scope.sql` :

- suppression de `carnet_collab_manage` ;
- suppression des deux lectures publiques historiques
  `carnet_collab_read` et `"Public read carnet_collaborators"` ;
- `INSERT` réservé à l'auteur du carnet (`carnet_collaborators_author_insert`) ;
- `UPDATE` réservé à l'auteur (`carnet_collaborators_author_update`) ;
- `DELETE` réservé à l'auteur (`carnet_collaborators_author_delete`) ;
- `carnet_collaborators_read_scoped` reste l'unique policy de lecture.

Conséquence : un tiers ne peut plus s'auto-insérer, un `viewer` ne peut plus se
promouvoir, et `is_carnet_editor` ne repose plus sur une table auto-modifiable.

### F2 — Élevé — `auth_manage_carnet_moments`

**Cause.** Cette policy `FOR ALL TO authenticated USING/WITH CHECK auth.uid() =
auteur_id` autorisait tout authentifié à écrire un moment dans n'importe quel
carnet dont il connaissait l'UUID, sans contrôle du carnet. Elle se cumulait
avec `carnet_moments_editor_manage` et rendait cette dernière inopérante. Le cas
6 du test pgTAP ajouté par `eff7db1` devait donc échouer.

**Correction** — même migration :

```sql
drop policy if exists auth_manage_carnet_moments on public.carnet_moments;
```

Seule `carnet_moments_editor_manage` (éditeur du carnet) autorise désormais
l'écriture.

### F3 — Élevé — cycle RLS `hike_sessions` / `hike_session_participants`

**Cause.** `hike_sessions_select_owner_or_participant` interroge
`hike_session_participants`, dont la policy `hike_participants_owner_write`
était `FOR ALL` : elle s'appliquait aussi au `SELECT` et interrogeait
`hike_sessions`. PostgreSQL détecte la récursion (`42P17`) et refuse les
lectures.

**Correction** — `supabase/migrations/20261112121000_carnet_v2_trace_raw_guard.sql` :

- suppression de `hike_participants_owner_write` ;
- remplacement par trois policies de commande, sans `SELECT` implicite :
  `hike_participants_owner_insert`, `_update`, `_delete` ;
- la lecture des participants reste portée par `hike_participants_select`, qui
  appelle `can_view_hike_session` en `SECURITY DEFINER`, sans récursion.

Le down de `121210` restaure l'ancienne policy `FOR ALL` **après** avoir retiré
la policy de `hike_sessions` qui créait le cycle ; il est explicitement documenté
comme non neutre.

### F4 — Élevé conditionnel — lectures publiques `USING (true)`

**Cause.** `20260728160000_fix_permissive_rls_policies.sql` a recréé
`public_read_carnet_moments` et `public_read_carnet_kit_items` en
`FOR SELECT TO public USING (true)`. `20260911550000_phase8_rls_hardening.sql`
ne supprimait que les variantes `seed_*`. Sur une base reconstruite depuis les
migrations, `anon` lisait donc tous les moments et tout le kit, y compris ceux
d'un carnet privé. Le baseline de production ne contient pas ces policies : la
divergence dépend de l'état réel de la base.

**Correction** — `20261112122000` :

```sql
drop policy if exists public_read_carnet_moments on public.carnet_moments;
drop policy if exists public_read_carnet_kit_items on public.carnet_kit_items;
drop policy if exists seed_public_read_carnet_moments on public.carnet_moments;
drop policy if exists seed_public_read_carnet_kit_items on public.carnet_kit_items;
```

Les policies scopées restent l'autorité :
`carnet_moments_read_scoped`, `carnet_kit_items_read_scoped` et
`carnet_kit_items_select`. Un carnet public reste lisible par `anon` via ces
policies ; un carnet privé ne l'est plus. Comme
`carnet_collaborators_read_scoped`, `carnet_moments_read_scoped` et
`carnet_kit_items_read_scoped` ne vivaient que dans le baseline et non dans la
chaîne de migrations, `121220` les recrée explicitement pour qu'un replay
complet ne perde pas la lecture scopée.

### F5 — Moyen — une sortie privée d'autrui masquait la trace autorisée

**Cause.** `getCarnetDetail` choisissait `traceSession` parmi **toutes** les
sorties, puis calculait le masque. Une sortie privée plus récente, non autorisée,
pouvait donc imposer `private` et rendre `trace = null`, alors que le lecteur
était participant d'une sortie plus ancienne autorisée.

**Correction** — `src/features/carnet/detail/getCarnetDetail.ts` :

- calcul de la visibilité effective par sortie
  (`mostRestrictiveTraceVisibility(carnet.visibility, session.visibility)`) ;
- priorité à la trace brute autorisée du lecteur (`rawSessionIds`), pour qu'un
  participant ne voie pas sa propre trace remplacée par une sortie partageable
  plus récente appartenant à quelqu'un d'autre ;
- à défaut, `traceSession` n'est choisi que parmi :
  - les sorties explicitement partageables (`public`, `collective_anonymized`) ;
  - les sorties `friends`/`followers` dont le propriétaire est réellement suivi ;
- une sortie privée non autorisée ne décide plus du masque ;
- si une trace existe mais qu'aucune sortie autorisée ne peut la porter,
  `traceWithheld` conserve l'état « trace non partageable » sans dessiner de
  coordonnées.

### F6 — Moyen — `follower` accordé sur le carnet, pas sur le propriétaire de la trace

**Cause.** La fiche vérifiait `user_follows` entre le lecteur et l'auteur du
carnet, alors que la route `GET /api/hike-sessions/[id]` la vérifie avec le
propriétaire de la sortie. De plus, un auteur/collaborateur de carnet recevait
`follower` sans aucune relation vérifiée dès que la visibilité n'était pas
`private`.

**Correction** — même fichier :

- la relation est lue pour les propriétaires des sorties candidates
  (`user_follows.following_id`) ;
- `traceViewer` n'est `follower` que si `traceSession.user_id` est réellement
  suivi ;
- le rôle d'éditeur du carnet ne suffit plus à obtenir `follower` sur la trace
  d'un autre propriétaire ;
- un éditeur non participant reste `visitor` : masques début/fin pour une sortie
  publique, tout masqué pour `friends`.

### F7 — Moyen — renumérotation `20261112120000` → `20261112121000`

Aucune nouvelle renumérotation n'est faite. La version `20261112121000` reste
celle du dépôt, et la vérification locale statique ne trouve aucun doublon
(431 fichiers `up`, 73 `down`). Le registre de production n'a pas été lu : il
faut vérifier `supabase_migrations.schema_migrations` avant toute application.
Si `20261112120000` est déjà une migration carnet en production, il faut une
réconciliation explicite, pas un doublon. Si `20261112122000` est déjà appliquée
avant cette correction, les nouveaux `DROP/CREATE` ne seront pas rejoués : un
forward-fix est nécessaire.

### F8 — Faible — builder fail-open sans `rawSessionIds`

**Cause.** `buildCarnetDetail` retombait sur « toutes les sorties pour un
non-visiteur » quand `rawSessionIds` était absent. Aujourd'hui
`getCarnetDetail` le fournit toujours, mais un futur appelant `service_role`
aurait rouvert les points, statistiques et profil.

**Correction** — `src/features/carnet/detail/buildCarnetDetail.ts` :

- `rawSessionIds` absent vaut désormais liste vide (fail-closed) ;
- `statsSession`, `rawSessions`, `daySessions`, `elevationProfile` et
  `canUseHikeSessionTrace` ne utilisent que les sorties explicitement
  autorisées ;
- les tests du builder qui fournissaient une sortie sans liste ont été mis à
  jour pour passer la liste, et un test vérifie le refus par défaut.

## 2. Droits après migration — matrice

| Table / opération | `anon` | Authentifié non éditeur | Participant de sortie | Auteur / éditeur | `service_role` |
|---|---|---|---|---|---|
| `carnets` lecture | public via `can_view_carnet` | public, `friends` suivi, participant | `can_view_carnet` | tout | bypass RLS |
| `carnet_collaborators` lecture | lignes d'un carnet public via `carnet_collaborators_read_scoped` | idem + sa propre ligne | idem | tout | bypass RLS |
| `carnet_collaborators` écriture | refus | refus | refus | INSERT/UPDATE/DELETE | bypass RLS |
| `carnet_moments` lecture | carnet public via `carnet_moments_read_scoped` | carnet public ou auteur | **pas de lecture garantie sur un carnet privé** (policy existante) | tout | bypass RLS |
| `carnet_moments` écriture | refus | refus | refus | `is_carnet_editor` | bypass RLS |
| `carnet_kit_items` lecture | carnet public via `carnet_kit_items_read_scoped` | public, `friends` suivi, participant via `carnet_kit_items_select` | `can_view_carnet` | tout | bypass RLS |
| `carnet_kit_items` écriture | refus | refus | refus | `is_carnet_editor` | bypass RLS |
| `hike_sessions` lecture brute | refus | refus (sauf `public`/`followers` via route, pas via RLS) | sa sortie | ses sorties | bypass RLS |
| `hike_sessions` écriture | refus | refus | refus | propriétaire | bypass RLS |
| `hike_session_participants` lecture | refus | selon `can_view_hike_session` | sa ligne / sortie visible | toutes ses sorties | bypass RLS |
| `hike_session_participants` écriture | refus | refus | refus | propriétaire (INSERT/UPDATE/DELETE séparés) | bypass RLS |
| `carnet_live_positions` lecture | refus | refus | sa propre ligne | toutes les lignes | bypass RLS |
| `carnet_live_positions` écriture | refus | refus | sa propre ligne | tout | bypass RLS |
| `is_carnet_editor` / `is_carnet_participant` | exécutable mais `auth.uid()` nul ⇒ faux | résultat réel | lecture seule | éditeur / lecture | bypass RLS |

## 3. Fichiers modifiés

- `supabase/migrations/20261112121000_carnet_v2_trace_raw_guard.sql`
- `supabase/migrations_down/20261112121000_carnet_v2_trace_raw_guard.down.sql`
- `supabase/migrations/20261112122000_carnet_v2_participant_scope.sql`
- `supabase/migrations_down/20261112122000_carnet_v2_participant_scope.down.sql`
- `src/features/carnet/detail/getCarnetDetail.ts`
- `src/features/carnet/detail/buildCarnetDetail.ts`
- `src/features/carnet/detail/types.ts`
- `src/features/carnet/detail/__tests__/getCarnetDetail.test.ts`
- `src/features/carnet/detail/__tests__/buildCarnetDetail.test.ts`
- `supabase/tests/database/carnet_v2_participant_scope.test.sql`
- `docs/audit/carnet-v2-2026-11-12/CONTROLES-SQL-PRIVACY-CRITIQUE.sql`

## 4. Limites et points à décider

1. **Rien n'a été exécuté.** Les corrections SQL sont statiques. Il faut jouer
   `CONTROLES-SQL-PRIVACY-CRITIQUE.sql` sur une copie, puis les tests pgTAP,
   avant toute production.
2. **Registre de production inconnu (F7).** Vérifier les versions
   `20261112120000`, `20261112121000` et `20261112122000` avant application.
3. **Migrations déjà appliquées ailleurs.** `121210` et `121220` ont été
   modifiées sur place parce qu'elles sont locales et non déployées. Si une base
   les a déjà appliquées, ces modifications ne seront pas rejouées : créer un
   forward-fix de même contenu, ou rejouer le SQL de durcissement, puis
   revérifier les policies.
4. **Les down ne sont pas neutres.** Le down de `121210` réouvre la lecture
   brute des sorties ; celui de `121220` restaure l'auto-promotion, l'écriture
   des moments par tout authentifié et les lectures publiques. Ils ne doivent
   servir qu'avec un revert applicatif et une décision explicite.
5. **`service_role` contourne la RLS.** La fiche et la route lisent des lignes
   brutes avec ce client après contrôle applicatif. Une régression du filtre
   `rawSessionIds` ou de `traceCandidates` reste le risque principal. Les tests
   Vitest couvrent la logique, pas la RLS.
6. **Lecture des moments d'un carnet privé par un participant.** La policy
   `carnet_moments_read_scoped` ne connaît que `public` et l'auteur. Un
   participant de sortie peut lire la ligne `carnets` mais pas forcément les
   moments d'un carnet privé. C'est un écart produit antérieur, non corrigé ici
   car l'élargir changerait la surface de lecture ; à décider explicitement.
7. **Collaborateurs : auteur seul.** Un collaborateur ne peut plus se retirer
   lui-même ni inviter un autre collaborateur. C'est le prix de F1 ; si le
   produit veut l'auto-retrait, ajouter une policy `DELETE` limitée à
   `user_id = auth.uid()` (sans toucher aux rôles).
8. **Collaborateurs d'un carnet public.** `carnet_collaborators_read_scoped`
   laisse `anon` lire les lignes d'un carnet public (identifiants et rôles).
   C'est cohérent avec un carnet public, mais à confirmer produit.
9. **Lignes héritées de l'ancienne policy.** La migration ne purge pas les
   lignes `carnet_collaborators` déjà auto-insérées avant son application, ni
   les moments écrits sous `auth_manage_carnet_moments`. `is_carnet_editor`
   continue de faire confiance aux lignes existantes : il faut les auditer
   manuellement (voir section 10 du fichier SQL) et supprimer uniquement les
   lignes non légitimes.
10. **Moment / kit publics.** `anon` peut toujours lire les moments et le kit
    d'un **carnet public** via les policies scopées. F4 ne ferme que les carnets
    privés et les policies `USING (true)`.
11. **Aucun test pgTAP exécuté.** Le plan du test
    `carnet_v2_participant_scope.test.sql` passe à 17 cas ; le cas 6 (F2), les
    cas 12 à 15 (F1) et 16 à 17 (F4) restent à confirmer sur PostgreSQL réel.
12. **Aucun build, lint ou tsc exécuté.** Les imports et types ont été relus
    statiquement ; la validation finale appartient à Tony.

## 5. Contrôles SQL à jouer plus tard

Le fichier `CONTROLES-SQL-PRIVACY-CRITIQUE.sql` contient :

1. l'inventaire des policies sensibles et la liste des policies interdites ;
2. les expressions réellement déployées (`pg_get_expr`) ;
3. les helpers `SECURITY DEFINER` et leur `search_path` ;
4. le registre `supabase_migrations.schema_migrations` (F7) ;
5. le test de non-régression du cycle RLS (`42P17`) ;
6. la simulation d'auto-promotion collaborateur (F1, transaction annulée) ;
7. la simulation d'écriture de moment par un non-éditeur (F2) ;
8. la lecture `anon` d'un carnet privé (F4) ;
9. la recherche de policies `USING (true)` résiduelles.

Après application, les suites à lancer sont celles que Tony a reportées :

```bash
npx vitest run \
  src/features/carnet/detail/__tests__ \
  "src/app/api/hike-sessions/[id]/__tests__"
npx tsc --noEmit -p .
```

et, sur une base jetable :

```bash
pg_prove -d "$DATABASE_URL" supabase/tests/database/carnet_v2_participant_scope.test.sql
pg_prove -d "$DATABASE_URL" supabase/tests/database/phase8_rls_trace_guard.test.sql
```
