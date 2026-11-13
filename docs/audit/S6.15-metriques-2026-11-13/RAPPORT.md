# S6.15 — Masquage par métrique des sorties

**Chantier** : P01 · Confidentialité et règles de publication
**Fiche source** : `LKDV_Lancement_Autonome 2/fiches/Strava/S6.15.md` (révision de référence `571142e`), lue en lecture seule.
**Registre** : `S6.15` — `ecart_cible`, complexité 5/5, priorité P0.
**Date** : 2026-11-13.
**Portée tenue** : projection serveur des métriques d'effort d'une sortie, métadonnées de trace comprises, sur la fiche du drawer et l'export GPX. Aucune métrique n'est inventée, aucun droit n'est simulé, aucune migration n'est appliquée.

## 1. Ce que la fiche demande

- Rendre la visibilité **indépendante** des données d'effort publiées : fréquence cardiaque, allure, puissance et autres statistiques.
- Emplacement : fiche sortie → Partager → choisir les métriques affichées, en drawer ou sous-drawer.
- Vérifier la matrice propriétaire / invité / tiers, la révocation et l'effet sur les exports et aperçus.
- Fournir des fixtures de traces masquées et documenter les dépendances de persistance.

## 2. Contrat existant constaté

| Élément | Constat | Conséquence |
| --- | --- | --- |
| Visibilité de sortie | `hike_sessions.visibility` n'accepte que `private` et `collective_anonymized` (`20260911131000_a1_private_activity_observations.sql:30-36`). | Un partage explicite existe déjà ; il ne porte que sur la trace et le socle agrégé. |
| Rôles de lecture | `owner`, `participant` inscrit, `follower` vérifié par `user_follows`, sinon `visitor` (`src/features/compte/server/sorties.ts`). | La politique de métriques réutilise ces rôles, sans déduire un droit de la seule visibilité. |
| Trace partagée | `tracePrivacy` masque début/fin ou tout ; `loadOutingDetail` vide `points` pour un tiers (`loadOutingDetail`). | Le masquage géométrique est déjà centralisé ; S6.15 ajoute le masquage des valeurs. |
| Métriques exposées | `km`, `dplus`, `maxAlt`, `durationS` étaient toujours servis ; l'allure et le temps en mouvement étaient recalculés **côté client** (`OutingTrace.tsx`). | Une métrique masquée restait dérivable dans le navigateur. |
| FC / puissance / cadence / calories | Aucune colonne ni aucun champ dans `hike_sessions` / `SessionRow`. | Les champs sont ajoutés au contrat avec `null` ; aucune valeur n'est fabriquée. |
| Politique persistée | Aucune colonne ni table de choix par métrique. | Le choix du propriétaire exige une migration ; elle n'est pas appliquée ici. |
| Export | `buildGpx` sérialise `traceSegments` (`buildGpx`) ; le GPX ne porte que `<ele>` et `<time>`. | Retirer ces métadonnées des segments suffit à fermer l'export. |

## 3. Décision de conception

### 3.1 Une politique pure, fail-closed

`src/features/compte/domain/metricVisibility.ts` définit :

- une liste fermée de clés `distance`, `elevation`, `elevationGain`, `maxAltitude`, `duration`, `pace`, `movingTime`, `heartRate`, `power`, `cadence`, `calories` ;
- `parseMetricVisibility()` qui n'accorde que `=== true` ; toute clé absente, valeur « truthy », tableau ou objet inconnu retombe à `false` ;
- `resolveOutingMetricVisibility()` :
  - `owner` et `participant` : toutes les métriques ;
  - `visitor` sur `private` ou visibilité inconnue : **aucune** ;
  - `visitor` sur `public` / `collective_anonymized`, ou `follower` vérifié sur `friends` / `followers` : socle agrégé déjà publié, soit distance, profil, dénivelé, altitude max et durée ; allure, temps en mouvement et données biométriques restent masqués ;
  - une politique persistée fournie remplace le socle ; partielle, elle ferme tout ce qu'elle ne déclare pas.
- `projectOutingMetrics()` : toute métrique masquée devient `null`, jamais `0` ; `NaN` et `Infinity` ne sortent jamais.
- `projectTraceMetrics()` : retire `elevationM` si le profil, le dénivelé ou l'altitude max est masqué ; retire `timestamp` si la durée, l'allure ou le temps en mouvement est masqué ; ferme aussi d'éventuels champs FC/puissance/cadence/calories.
- `movingTimeSeconds()` et `averagePaceMinPerKm()` sont calculés **côté serveur** ; le client ne les redérive plus.

### 3.2 Pourquoi le socle agrégé reste visible

`collective_anonymized` et `public` sont des actes de partage explicites déjà présents dans le contrat. Refuser ces valeurs aurait cassé une fiche partagée existante sans nouvel accord du propriétaire. La politique ferme donc les métriques que le contrat ne publiait pas explicitement (allure, temps en mouvement, biométrie) et laisse le socle agrégé. Ce n'est pas un droit simulé : c'est la portée déjà autorisée par la visibilité existante.

### 3.3 Couplages assumés

- **Altimétrie** : si `maxAltitude` est masquée, le profil et le dénivelé sont retirés des points, sinon l'altitude max serait dérivable. Inversement, masquer le profil retire les altitudes même si `dplus` reste visible.
- **Temps** : si `movingTime` est masquée, les horodatages de trace sont retirés, sinon le temps en mouvement et l'allure seraient dérivables. Le GPX d'un tiers n'a donc plus de `<time>`.
- **Allure** : elle est calculée serveur, puis `null` si masquée. Le client ne refait jamais `durée / distance`.
- **Limite d'inférence** : si `distance` et `duration` sont toutes deux visibles, une allure moyenne reste mathématiquement calculable par un consommateur déterminé, même si `pace` est `false`. L'API ne la publie pas et l'UI ne l'affiche pas. Supprimer cette inférence exigerait de masquer aussi `distance` ou `duration` ; ce choix n'a pas été pris ici pour ne pas casser la visibilité indépendante demandée par la fiche. C'est documenté comme limite, pas comme garantie.

## 4. Implémentation livrée

### 4.1 Domaine

- `src/features/compte/domain/metricVisibility.ts` (nouveau) : contrats, résolution, projection scalaire et projection des métadonnées de trace.
- `src/features/compte/domain/__tests__/metricVisibility.test.ts` (nouveau) : défauts, rôles, politiques partielles, valeurs non finies, métadonnées, calculs.

### 4.2 Serveur

- `src/features/compte/server/sorties.ts` :
  - `OutingDetail` expose `km`, `dplus`, `maxAlt`, `durationS` **nullables**, `paceMinPerKm`, `movingTimeS`, `heartRateBpm`, `powerW`, `cadenceRpm`, `caloriesKcal`, `metricVisibility`, `metricsMasked` ;
  - `loadOutingDetail()` résout la politique après vérification réelle du rôle, projette les scalaires et les métadonnées de trace ;
  - `loadOutingDetail(..., { metricPolicy })` accepte une politique **déjà lue dans un stockage de confiance** ; le chemin de production n'en passe pas encore, la migration reste la condition du choix utilisateur ;
  - `startedAt` / `endedAt` sont retirés si la durée est masquée, pour ne pas laisser calculer la durée ;
  - `points` et `traceSegments` sont projetés avant de sortir ; l'export GPX hérite donc des `<ele>` / `<time>` autorisés, et `buildGpx` re-projette par défense en profondeur.
- `src/features/compte/server/__tests__/sorties.test.ts` : assertions propriétaire, visiteur privé, visiteur d'une sortie partageable, politique stricte et GPX masqué.

### 4.3 Surface Sortie

- `src/components/compte/drawer/sortie/OutingSummary.tsx` : tuiles null-safe, « Masqué » pour une métrique fermée, note discrète, profil altimétrique conditionnel.
- `src/components/compte/drawer/sortie/OutingTrace.tsx` : plus aucun recalcul d'allure ou de temps en mouvement ; altitudes, pente, durée et allure respectent `metricVisibility` ; lignes FC/puissance/cadence/calories rendues uniquement si une valeur réelle et visible existe.
- `src/components/compte/drawer/sortie/shared.tsx` : helpers `outingMetricVisible`, `metricDisplay`, `shareableOutingText`.
- `src/components/compte/drawer/sortie/SortieDrawer.tsx` : le texte de partage n'inclut que les métriques visibles ; l'URL reste servie par la projection serveur.
- `src/components/compte/drawer/sortie/__tests__/states.test.tsx` : fixture à jour, absence d'allure masquée, texte de partage filtré.

## 5. Chemins couverts et non couverts

### Couverts

- `GET /api/compte/sorties/[id]` → `loadOutingDetail` : DTO projeté.
- `GET /api/compte/sorties/[id]/gpx` → `loadOutingDetail` puis `buildGpx` : pas d'altitude ni d'heure masquées.
- Drawer Sortie : résumé, trace, profil, texte de partage.

### Non couverts, à coordonner

- `GET /api/hike-sessions/[id]` : renvoie encore les colonnes agrégées (`distance_km`, `duration_seconds`, `elevation_gain_m`, `max_altitude_m`) aux lecteurs autorisés d'un carnet partagé. Ces valeurs correspondent au socle agrégé par défaut, donc aucun écart avec la politique actuelle ; en revanche, une politique persistée devra y être branchée pour que le masquage soit complet. Ce fichier n'a pas été modifié pour ne pas toucher un chemin actif de l'Explorer.
- `getCarnetDetail` / `buildCarnetDetail` : les statistiques de carnet viennent des colonnes du carnet ou d'une sortie brute autorisée ; aucune métrique d'une sortie d'autrui n'est exposée. À revoir si une politique persistée doit aussi masquer les agrégats du carnet.
- Aucun aperçu public de sortie n'existe aujourd'hui : `Partager` partage l'URL du drawer, pas une page publique. La sélection de métriques persistée n'a donc pas de surface de destination à brancher avant la migration.

## 6. Migration à coordonner (non créée, non appliquée)

La fiche demande de choisir les métriques affichées. Sans stockage serveur, un choix local serait un droit simulé : il ne changerait pas ce que reçoit un tiers. La migration suivante est donc **proposée**, pas écrite dans `supabase/migrations`.

### Contrat proposé

Table dédiée plutôt que nouvelle colonne sur `hike_sessions` :

```sql
create table public.outing_share_metrics (
  session_id uuid primary key references public.hike_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visibility jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint outing_share_metrics_object check (jsonb_typeof(visibility) = 'object')
);
```

La validation des clés et des booléens reste applicative : `zod` strict à l'écriture, puis `parseMetricVisibility()` à la lecture. Une contrainte `jsonb` ne doit pas être présentée comme équivalente à cette liste fermée. L'important est que la lecture soit **service_role uniquement** après autorisation, et l'écriture **propriétaire uniquement**.

### RLS et grants

- `select` : propriétaire de la session uniquement (le partage passe par `service_role` après contrôle).
- `insert` / `update` / `delete` : `auth.uid() = user_id` **et** existence d'une ligne `hike_sessions` avec `user_id = auth.uid()`.
- `grant select, insert, update, delete on public.outing_share_metrics to authenticated;`
- Aucun `select` à `anon`.
- Vérifier `can_view_carnet`, `hike_sessions_select_owner_or_participant` et les policies de carnet avant d'étendre quoi que ce soit.

### Version et retour arrière

- Nouvelle version, sans réutiliser les timestamps existants : `20261113090000_outing_share_metrics.sql`.
- Rollback : `supabase/migrations_down/20261113090000_outing_share_metrics.down.sql` (`drop table`).
- Avant production : inventaire des lecteurs/écrivains (`loadOutingDetail`, `buildGpx`, `/api/hike-sessions/[id]`, `getCarnetDetail`), validation sur copie, advisors, test propriétaire / participant / tiers / invité.
- Invalidation : `SortieDrawer` invalide déjà `['sortie', id]` ; le GPX est `Cache-Control: no-store`. Si un cache d'aperçu ou un lien signé est ajouté, il devra être purgé à chaque changement de politique.

### Branchement futur

1. Lire la politique dans `loadOutingDetail` avec le client `service_role` **après** la vérification de rôle, puis la passer à `resolveOutingMetricVisibility({ viewer, visibility, policy })`.
2. Faire de même dans `/api/hike-sessions/[id]` si cette route doit servir une politique différente du socle.
3. Ajouter le sous-drawer « Partager » : cases à cocher pour les clés connues, défaut fermé, aperçu des valeurs réellement visibles, écriture `zod` stricte, invalidation des caches.
4. Tester propriétaire, abonné, invité, tiers bloqué, politique partielle, révocation.

## 7. Tests écrits, non exécutés

Conformément à la consigne, **aucun test, aucune suite, aucun build, aucun lint et aucun `tsc` n'a été exécuté**. Les commandes à lancer à la fin sont :

```bash
npx vitest run src/features/compte/domain/__tests__/metricVisibility.test.ts
npx vitest run src/features/compte/server/__tests__/sorties.test.ts
npx vitest run src/components/compte/drawer/sortie/__tests__/states.test.tsx
npx tsc --noEmit -p .
```

Les fixtures sont synthétiques : aucun réseau, aucune base, aucune donnée réelle.

## 8. Limites et preuves manquantes

1. **Aucune preuve d'exécution** : le code et les tests sont écrits, pas rejoués. Le prochain passage doit fournir la sortie Vitest et `tsc`.
2. **Aucune source FC / puissance / cadence / calories** : les champs existent au contrat et restent `null`. Une preuve appareil exigerait un connecteur réel, hors de cette tranche.
3. **Pas de sélection persistée** : le sous-drawer de choix n'est pas livré ; il dépend de la migration ci-dessus. Le serveur applique le socle fail-closed et l'UI ne peut pas élargir ce que le serveur refuse.
4. **Pas de page publique de partage** : le lien du drawer reste la surface existante. La révocation d'un lien public ne peut pas être testée ici.
5. **Inférence d'allure** : voir §3.3 ; à trancher avant de promettre une confidentialité absolue sur l'allure.
6. **`/api/hike-sessions/[id]`** : non modifié pour éviter un fichier actif de l'Explorer ; à brancher avec la politique persistée.
7. **Aucun commit, aucune production, aucun réseau externe, aucune délégation** : conformément à la consigne.

## 9. Fichiers touchés

- `src/features/compte/domain/metricVisibility.ts` (nouveau)
- `src/features/compte/domain/__tests__/metricVisibility.test.ts` (nouveau)
- `src/features/compte/server/sorties.ts`
- `src/features/compte/server/__tests__/sorties.test.ts`
- `src/components/compte/drawer/sortie/OutingSummary.tsx`
- `src/components/compte/drawer/sortie/OutingTrace.tsx`
- `src/components/compte/drawer/sortie/SortieDrawer.tsx`
- `src/components/compte/drawer/sortie/shared.tsx`
- `src/components/compte/drawer/sortie/__tests__/states.test.tsx`
- `docs/audit/S6.15-metriques-2026-11-13/RAPPORT.md` (ce rapport)

Aucun fichier de `src/features/explorer-v2`, `src/components/explorer` ou `src/app/explorer` n'a été ouvert en écriture.
