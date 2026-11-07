# P1 — La couche de données réelle : preuves

Chantier Kit Studio · branche `chantier/kit-studio-finition` · 2026-11-07
Projet Supabase : `icxyvwzfjbflcbqukpfz` (rôle `postgres` pour les migrations)
Agent : DeepSeek Harness (`deepseek-v4.1-flash`), coéquipier `p1-data`

Ce document ne contient que des sorties réelles : commandes exécutées et retours bruts
(console, MCP Supabase). Aucun chiffre n'est estimé. `docs/kit-studio/RAPPORT-CHANTIER.md`
est tenu par le Lead et n'a pas été modifié.

---

## 0. Lecture la plus raisonnable — écarts assumés (à valider par le Lead / Tony)

1. **`inventory_guard` bloque la classification de 5 objets engagés.** Le script du bundle
   `20261104010000_gear_taxonomy.sql` fait un `UPDATE product_ownership SET function_id = …`
   sur tout l'inventaire. Un trigger préexistant (migration antérieure à ce chantier) interdit
   toute modification autre que `status/is_lent/updated_at/search_vector` dès que
   `status ∈ (en_pret, en_location, vendu)` — 5 lignes `en_pret` sont concernées en base.
   Le premier test à blanc a donc échoué (sortie brute §1.1). **Décision : restreindre
   l'UPDATE aux lignes non engagées** (`and status not in ('en_pret','en_location','vendu')`).
   Les 5 objets engagés restent non classés et apparaissent dans la vue `gear_function_review`,
   conformément à son objet. Aucune donnée existante n'est modifiée hors de ce périmètre.
2. **Glyphes et accessoires des pièces ONE.** `one_pieces` n'a ni colonne glyphe ni colonne
   accessoire. Correspondance fixe par pièce (`ONE_GL`, `ONE_ACC` dans
   `server/getStudioData.ts`), documentée : châssis → `v_harness_mesh`, couvercle →
   `v_lid_std`, poche avant → `v_front_zip`, poches latérales → `v_sides_std`, porte-piolet →
   `axe`, poches de ceinture → `v_hip_wide`, porte-gourde → `bottle` (+ accessoires `axe`,
   `sbottle`). Les 9 pièces semées du bundle sont couvertes exactement.
3. **`user.bodyKg` = 72.** `user_profiles` n'a aucune colonne de poids (vérifié
   `information_schema` le 2026-11-07). La valeur de référence (72 kg) est utilisée, comme
   prévu par `spec/data-model.md` quand la donnée manque.
4. **Champs de kit sans source en base : jours, départ, cabine, fantômes, plan food.**
   Aucun lien `voyage → kit` n'existe dans le schéma actuel. La forme est produite avec les
   défauts documentés : `days = 1`, `start = ''`, `ctx = description du kit`, `cabin` absent,
   `ghosts = []`, `food = null`. `Item.trips = 0` (aucun compteur de sorties par objet).
5. **Zones d'un objet = `gear_functions.default_zone` uniquement.** Les « zones compatibles »
   de la référence ne sont pas modélisées ; absent → `['main']`. Une seule zone par objet
   en production (honnête par rapport à la base, à enrichir en base si besoin).
6. **Familles.** Le libellé `gear_functions.family` est mappé sur les slugs de la référence ;
   `Portage` et `Voyage` sont ajoutés à la table d'affichage du registre. Les six onglets de
   `FamilyCapsule` restent inchangés (structure d'écran) ; une fonction non classée va dans
   la famille explicite **« autre »**, jamais dans une famille existante au hasard.
7. **Couleurs de scène des objets.** `Item.color` (clé de matière) n'a pas de source en base :
   couleur fixe par famille, choisie dans `RAW_MATERIALS` (aucune couleur nouvelle).
8. **État local vs données serveur.** En production, le kit sauvegardé en `localStorage`
   n'est réutilisé que s'il est compatible avec les kits du registre serveur
   (`compatibleWithRegistry`) ; sinon l'état est reconstruit depuis la base. En démonstration,
   le comportement existant est inchangé.
9. **Aucune écriture réseau quand il n'y a pas de données serveur.** Le handler d'écriture
   n'est installé que si `studioData().sync` existe. Tests, démo et hors-ligne restent
   strictement locaux.
10. **Un compte sans kit n'est pas géré en P1** (la création de kit relève d'une autre phase) :
    la page repasse en repli local explicite (`kits.length === 0 → null`) au lieu d'afficher
    un studio vide ou des données factices présentées comme réelles.
11. **Versions de migration.** `apply_migration` a enregistré ses propres versions :
    `20261107123212` (gear_taxonomy) et `20261107123239` (lkdv_one_studio). Les fichiers du
    dépôt portent **exactement** ces versions. Le contenu fonctionnel est celui du bundle ;
    seuls les commentaires diffèrent du texte stocké dans `supabase_migrations.statements`
    (mêmes instructions SQL, à la garde du point 1 près).
12. **Build `npm run build` : OOM environnemental, pas une régression P1.** La machine (8 Go)
    manque de mémoire pour le worker Node de lint/typage du build, qui atteint son plafond de
    tas par défaut (2 Go). Reproduit à l'identique sur le commit de base `d706212` (sans
    aucune modification P1) : voir §8.5. Avec `NODE_OPTIONS=--max-old-space-size=4096`, le
    build de la branche est vert (exit 0). Aucun fichier de configuration n'a été modifié.

---

## 1. Migrations

### 1.1 Test à blanc — tentative 1 : refus du trigger préexistant

Transaction `begin; <les deux scripts sans leurs begin/commit> rollback;` via
`mcp__supabase__execute_sql`. Sortie brute :

```
Error: {"error":{"name":"HttpException","message":"Failed to run sql query:
ERROR:  55000: Objet engagé ou vendu: modification interdite
CONTEXT:  PL/pgSQL function inventory_guard() line 18 at RAISE
"}}
```

Cause : l'`UPDATE public.product_ownership SET function_id = …` touche 5 lignes
`status = 'en_pret'`, immuables pour tout champ non ignoré (trigger `inventory_guard`,
antérieur au chantier). Correction : `and status not in ('en_pret','en_location','vendu')`
dans le script (voir §0.1), puis nouveau test à blanc complet.

### 1.2 Test à blanc — tentative 2 : OK (transaction annulée)

```
$ begin; <20261104010000_gear_taxonomy + 20261105010000_lkdv_one_studio, sans begin/commit> rollback;

[{"obj":"gear_functions","n":"43"},
 {"obj":"one_colorways","n":"4"},
 {"obj":"one_pieces","n":"9"},
 {"obj":"one_owned_pieces","n":"0"},
 {"obj":"one_bag_configs","n":"0"},
 {"obj":"one_preorders","n":"0"},
 {"obj":"product_ownership_cols_new","n":"4"},
 {"obj":"materiel_kit_items_cols_new","n":"5"}]
```

Les deux scripts passent en une transaction, les 43 fonctions, 4 coloris et 9 pièces sont
semés, les 4+5 colonnes sont créées ; rien n'est persisté (rollback).

### 1.3 Application réelle

Deux appels `mcp__supabase__apply_migration`, dans l'ordre du bundle :

```
apply_migration(name="gear_taxonomy",   …) → {"success":true}
apply_migration(name="lkdv_one_studio", …) → {"success":true}
```

### 1.4 Versions réellement enregistrées

```
$ select version, name from supabase_migrations.schema_migrations where version in ('20261107123212','20261107123239');

[{"version":"20261107123212","name":"gear_taxonomy"},
 {"version":"20261107123239","name":"lkdv_one_studio"}]
```

Fichiers copiés dans le dépôt avec ces versions exactes :

- `supabase/migrations/20261107123212_gear_taxonomy.sql`
- `supabase/migrations/20261107123239_lkdv_one_studio.sql`

### 1.5 Schéma, RLS et seeds vérifiés après application

```
$ select 'supabase_migrations' … union all select 'seeds' … union all select 'rls_active' …

[{"controle":"supabase_migrations","valeur":"20261107123212 gear_taxonomy | 20261107123239 lkdv_one_studio"},
 {"controle":"seeds","valeur":"gear_functions=43, one_colorways=4, one_pieces=9, one_owned_pieces=0, one_bag_configs=0, one_preorders=0"},
 {"controle":"rls_active","valeur":"gear_functions=true, one_bag_configs=true, one_colorways=true, one_owned_pieces=true, one_pieces=true, one_preorders=true"},
 {"controle":"policies","valeur":"gear_functions.gear_functions_lecture(SELECT), one_bag_configs.one_configs_all(ALL), one_colorways.one_colorways_read(SELECT), one_owned_pieces.one_owned_select(SELECT), one_pieces.one_pieces_read(SELECT), one_preorders.one_preorders_insert(INSERT), one_preorders.one_preorders_select(SELECT)"},
 {"controle":"colonnes_ajoutees","valeur":"product_ownership=4, materiel_kit_items=5"},
 {"controle":"vue_revue","valeur":"gear_function_review existe=1"},
 {"controle":"rpc","valeur":"one_place_preorder existe=1, execute authenticated=true, execute anon=false"}]
```

Catalogue semé (9 pièces, prix en centimes) :

```
$ select id, label_fr, price_cents, attach_points, host, part, volume_l from public.one_pieces order by sort;

[{"id":"chassis","label_fr":"Châssis ONE","price_cents":18900,"attach_points":4,"host":null,"part":"harness","volume_l":null},
 {"id":"corps:b28","label_fr":"Corps 28 L","price_cents":11900,"attach_points":6,"host":null,"part":"body","volume_l":"28.0"},
 {"id":"corps:b42","label_fr":"Corps 42 L","price_cents":14900,"attach_points":8,"host":null,"part":"body","volume_l":"42.0"},
 {"id":"mod:lid","label_fr":"Couvercle","price_cents":4900,"attach_points":2,"host":"corps","part":"lid","volume_l":"4.0"},
 {"id":"mod:front","label_fr":"Poche avant","price_cents":3900,"attach_points":2,"host":"corps","part":"front","volume_l":"3.0"},
 {"id":"mod:sides","label_fr":"Poches latérales","price_cents":3500,"attach_points":2,"host":"corps","part":"sides","volume_l":"2.0"},
 {"id":"mod:tool","label_fr":"Porte-piolet et bâtons","price_cents":1500,"attach_points":1,"host":"corps","part":"front","volume_l":null},
 {"id":"mod:hipp","label_fr":"Poches de ceinture","price_cents":2900,"attach_points":2,"host":"chassis","part":"hip","volume_l":"0.8"},
 {"id":"mod:flask","label_fr":"Porte-gourde de bretelle","price_cents":1900,"attach_points":1,"host":"chassis","part":"harness","volume_l":"0.5"}]
```

Classement des inventaires existants (effet du `lkdv_classify_gear`) :

```
$ select 'product_ownership' as table_name,
         count(*) filter (where function_id is not null) as classes,
         count(*) filter (where function_id is null) as a_classer,
         count(*) filter (where function_id is null and status in ('en_pret','en_location','vendu')) as bloques_par_guard
  from public.product_ownership
  union all select 'materiel_kit_items', count(*) filter (where function_id is not null),
         count(*) filter (where function_id is null), null from public.materiel_kit_items;

[{"table_name":"product_ownership","classes":442,"a_classer":78,"bloques_par_guard":5},
 {"table_name":"materiel_kit_items","classes":1218,"a_classer":175,"bloques_par_guard":null}]

$ select source, count(*) as a_revoir from public.gear_function_review group by source order by source;

[{"source":"materiel_kit_items","a_revoir":175},{"source":"product_ownership","a_revoir":78}]
```

442 objets possédés classés (sur 520), 1218 lignes de kit classées (sur 1393). Les 5 lignes
`en_pret` bloquées par le trigger sont parmi les 78 restants ; la vue `gear_function_review`
les expose (253 lignes au total) pour une passe IA/revue ultérieure.

### 1.6 Rollbacks

Créés dans `supabase/migrations_down/` :

- `20261107123212_gear_taxonomy.down.sql` (**n'existait pas dans le bundle** ; ordre :
  vue → index → colonnes ajoutées (`product_ownership` puis `materiel_kit_items`) → fonction
  de classement → table `gear_functions`) ;
- `20261107123239_lkdv_one_studio.down.sql` (repris du bundle, en-tête versionné).

Test à blanc des deux rollbacks (transaction annulée, rien n'est persisté) :

```
$ begin; <les deux .down.sql> … select …; rollback;

[{"controle":"tables_restantes","n":0},
 {"controle":"colonnes_function_restantes","n":0},
 {"controle":"vue_restante","n":0},
 {"controle":"fonction_restante","n":0}]
```

Vérification après le rollback de test (la transaction a bien été annulée) :

```
gear_functions=43, one_pieces=9, one_colorways=4
```

### 1.7 Advisors Supabase (sécurité) — avant / après

`mcp__supabase__get_advisors(type="security")` avant application puis après. Comparaison des
lint (nom, niveau, nombre de findings) :

| lint | niveau | avant | après | évolution |
| --- | --- | ---: | ---: | --- |
| `anon_security_definer_function_executable` | WARN | 17 | 17 | = |
| `auth_allow_anonymous_sign_ins` | WARN | 1 | 1 | = |
| `auth_leaked_password_protection` | WARN | 1 | 1 | = |
| `auth_users_exposed` | ERROR | 1 | 1 | = |
| `authenticated_security_definer_function_executable` | WARN | 69 | **70** | +1 (voir ci-dessous) |
| `extension_in_public` | WARN | 3 | 3 | = |
| `function_search_path_mutable` | WARN | 1 | 1 | = |
| `materialized_view_in_api` | WARN | 7 | 7 | = |
| `rls_disabled_in_public` | ERROR | 1 | 1 | = (`spatial_ref_sys` uniquement) |
| `rls_enabled_no_policy` | INFO | 41 | 41 | = |
| `security_definer_view` | ERROR | 2 | 2 | = |

- **Aucune nouvelle alerte ERROR.** L'alerte connue `spatial_ref_sys` (RLS désactivée, table
  PostGIS préexistante) reste la seule de son type.
- **+1 WARN attendu et inhérent** : `one_place_preorder` est une fonction `SECURITY DEFINER`
  exécutable par `authenticated` — c'est exactement le contrat de la RPC (précommande
  authentifiée, `EXECUTE` retiré à `public` et `anon`, vérifié en §1.5). Le linter signale
  toute fonction `SECURITY DEFINER` ouverte à `authenticated` ; c'est le prix du contrat, pas
  un défaut de la migration.

---

## 2. Preuve de recalcul serveur — le total de la précommande

Un utilisateur réel de `public.user_profiles` est simulé (claims JWT + rôle `authenticated`),
la RPC est appelée, puis tout est annulé par `ROLLBACK` (aucune ligne réelle créée).

```
$ begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub','d5451f35-db9f-4575-9114-6d3b79550bbc','role','authenticated')::text, true);
  do $$ … one_place_preorder(
       '[{"piece_id":"corps:b28","colorway_id":"foret"},
         {"piece_id":"mod:hipp","colorway_id":"foret"}]', 'P1 preuve', true) … $$;
  do $$ … one_place_preorder('[{"piece_id":"mod:inconnu","colorway_id":"foret"}]', 'P1 refus', true) … $$;
  select …; rollback;

{"preorder_id":"5b0a32c5-4e9c-44f7-bf69-1d5effad6a06",
 "total_cents_recalcule":"14800",
 "items":"[{\"piece_id\": \"corps:b28\", \"colorway_id\": \"foret\"}, {\"piece_id\": \"mod:hipp\", \"colorway_id\": \"foret\"}]",
 "one_owned_preordered":"2",
 "refus_piece_inconnue":"P0001 | unknown_piece_or_colorway"}
```

Lecture : `11900 (corps 28 L) + 2900 (poches de ceinture) = 14800` centimes = **148 €**,
total calculé par la RPC à partir de `one_pieces.price_cents` — le client n'envoie que des
`piece_id`/`colorway_id`, aucun prix, aucun total (`placePreorderSchema` est `.strict()` et
refuse un champ `totalCents` : test §5). La pièce inconnue est refusée par la base
(`unknown_piece_or_colorway`). Les 2 lignes `one_owned_pieces` en état `preordered` sont
également créées par la RPC dans la transaction.

Après `ROLLBACK` :

```
$ select 'one_preorders' t, count(*) n from public.one_preorders
  union all select 'one_owned_pieces', count(*) from public.one_owned_pieces
  union all select 'one_bag_configs', count(*) from public.one_bag_configs;

[{"t":"one_preorders","n":0},{"t":"one_owned_pieces","n":0},{"t":"one_bag_configs","n":0}]
```

---

## 3. Preuve d'isolation RLS (auth.uid())

Deux utilisateurs simulés A et B. A écrit une configuration et précommande ; B ne voit rien
et ne peut pas écrire pour A. Aucune écriture directe dans `one_owned_pieces` n'est possible
(cette table est écrite par la RPC). Transaction annulée à la fin.

```
$ begin; set local role authenticated;
  -- A
  insert into one_bag_configs(user_id, corps_id, modules, colors) values ('d5451f35-…','corps:b28','{lid}','{"body":"#2D482A"}');
  insert into one_owned_pieces …   -- doit échouer (aucune policy INSERT)
  select one_place_preorder('[{"piece_id":"corps:b42","colorway_id":"nuit"}]','RLS A',true);
  -- B
  select set_config('request.jwt.claims', json_build_object('sub','3612c45b-…','role','authenticated')::text, true);
  select count(*) from one_bag_configs / one_preorders / one_owned_pieces;
  insert into one_bag_configs(user_id => 'd5451f35-…') …  -- doit échouer
  select …; rollback;

{"a_insert_direct_one_owned_pieces":"42501 | new row violates row-level security policy for table \"one_owned_pieces\"",
 "a_configs_count":"1",
 "b_configs_visibles":"0",
 "b_preorders_visibles":"0",
 "b_owned_visibles":"0",
 "b_ecriture_pour_a":"42501 | new row violates row-level security policy for table \"one_bag_configs\""}
```

Isolation vérifiée sur les trois tables neuves porteuses de données utilisateur
(`one_bag_configs`, `one_preorders`, `one_owned_pieces`) ; `one_pieces`/`one_colorways` sont
en lecture publique des lignes actives, `gear_functions` en lecture publique (référentiel).

---

## 4. Couche de données — `server/getStudioData.ts`

### 4.1 Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/features/kit-studio/domain/studioData.ts` | Registre runtime injectable ; défaut = constantes de démonstration (fixtures + hors-ligne) ; `setStudioData`/`resetStudioData`/`isDemoStudioData` ; contexte d'écriture `sync` |
| `src/features/kit-studio/server/getStudioData.ts` | Lecture serveur (`import 'server-only'`) + mapping pur exporté pour les tests ; défauts documentés |
| `src/features/kit-studio/domain/state.ts` | `createInitialState`/`getItem`/`liveKit` lisent le registre ; cache d'index par identité d'`items` |
| `src/features/kit-studio/domain/{packing,parts,attach,order}.ts` | Lisent `studioData().items/one/colorways` au lieu des constantes |
| `src/features/kit-studio/store/partOption.ts`, `ui/cards/cardsData.ts`, `ui/sheets/{BagSheet,OrderSheet,ItemSheet}.tsx` | Idem (coloris, catalogue ONE, familles) |

Aucune forme d'interface n'a changé : les types (`Item`, `Kit`, `OneSpec`, `ConfigSet`, …)
sont ceux de `domain/catalog.ts` ; seules les valeurs viennent de la base.

### 4.2 Correspondance ligne à ligne avec `spec/data-model.md`

| Champ du moteur | Source implémentée | Règle / défaut |
| --- | --- | --- |
| `Item.id` | `product_ownership.id` (uuid, tel quel) + `materiel_kit_items.id` pour les lignes de kit sans `product_ownership_id` | lien profond `#id` inchangé |
| `Item.n`, `fam` | `name`, `gear_functions.family` via `function_id` | libellé → slug ; sinon famille « autre » |
| `Item.fn`, `sh`, `gl` | `gear_functions.id`, `shape_kind`, `shape_kind` (glyphe) | non classé : `fn='other'`, `sh='box'`, `gl='box'` |
| `Item.g`, `L` | `weight_g`, `volume_ml / 1000` | volume absent : **0,6 L** ; poids absent : 0 |
| `Item.z` | `gear_functions.default_zone` | absent : `['main']` (une seule zone modélisée) |
| `Item.state`, `lentTo`, `until` | `is_lent` (+ `materiel_loans` non lue en P1) | `is_lent` → `'lent'` ; `lentTo/until` non exposés (aucun prêt lié dans l'inventaire actuel) |
| `Item.care`, `expired` | `maintenance_due_at`, `expiry_date` | dates ISO telles quelles |
| `Item.vital` | `gear_functions.is_vital_default` | `vital: 1` si vrai |
| `Item.price` | `price_cents / 100` | absent : pas de prix |
| `Item.color` | couleur de scène par famille (clé `RAW_MATERIALS`) | pas de source en base |
| `Kit` | `materiel_kits` | `days=1`, `start=''`, `ctx=description` (pas de lien voyage) |
| `Kit.packed`, `slots` | `materiel_kit_items.zone`, `slot`, `load_order` | `load_order` = index dans la zone |
| `Kit.lineage` | `forked_from`, `generation`, `field_proven_count` | vocabulaire « lignée » conservé côté UI |
| `Kit.bag`, `cfg` | `one_bag_configs.corps_id`, `modules`, `colors` | absent : préréglage Forêt (couvercle + poche avant + poches latérales) |
| `one`, `colorways` | `one_pieces`, `one_colorways` | prix centimes ÷ 100 ; glyphes/accessoires par pièce (§0.2) |
| `owned`, `ordered` | `one_owned_pieces.state` | `owned` → `own`, `preordered` → `order` ; coloris inconnu ignoré |
| `user.bodyKg` | `user_profiles` | aucune colonne : **72 kg** |

### 4.3 Tests de mapping (aucun réseau)

```
$ npx vitest run src/features/kit-studio/__tests__/getStudioData.test.ts

 ✓ src/features/kit-studio/__tests__/getStudioData.test.ts (12 tests)

 12 tests : hex→matière, colorways, objets (fonction/glyphe/famille/zones/poids/volume/prix/
 lent/vital), catalogue ONE (prix, points, glyphes, accessoires), config absente = préréglage
 Forêt, config enregistrée (hex → matières, modules → formes), kits (zone/slot/ordre, ids
 résolus, lignée), pièces possédées/précommandées, familles, `getStudioData` (kit demandé en
 tête, contexte d'écriture, kit le plus récent par défaut, erreur de lecture explicite).
```

Le client Supabase est un faux en mémoire (`__tests__/helpers/fakeDb.ts`) : les tests ne
dépendent ni du réseau ni de la base.

---

## 5. Actions serveur — `server/actions.ts`

| Action | Validation zod | Contrôles | Écriture |
| --- | --- | --- | --- |
| `saveBagConfig` | `kitId` uuid, `corpsId` `corps:b28\|b42`, `modules` ⊆ 6 modules, `colors` clés limitées + hex, `.strict()` | session requise ; kit appartient à `user_id` ; corps et modules présents dans `one_pieces` actif | upsert `one_bag_configs` (`onConflict user_id,kit_id`) |
| `saveKitItemPlacement` | `kitId` uuid, `itemId` uuid, `zone` nullable, `slot` nullable, `loadOrder` 0..1000, `.strict()` | session ; kit possédé ; ligne de kit retrouvée par `id` ou `product_ownership_id` ; sinon création de la ligne à partir de `product_ownership` | update/insert `materiel_kit_items` (`zone`, `slot`, `load_order`) |
| `placePreorder` | `items` 1..20 `{pieceId, colorwayId}`, `label ≤ 24`, `notify` bool, `.strict()` — **aucun prix/total accepté** | session ; pièce/coloris validés par la RPC en base | RPC `one_place_preorder` ; total relu dans `one_preorders` |

Les schémas vivent dans `server/studioSchemas.ts`, les services testables (client injecté)
dans `server/studioService.ts`. Aucune entrée n'est écrite sans passer par zod.

```
$ npx vitest run src/features/kit-studio/__tests__/studioActions.test.ts

 ✓ src/features/kit-studio/__tests__/studioActions.test.ts (16 tests)

 16 tests : entrée valide acceptée ; refus corps/couleur hex/clé de couleur/module/kitId
 invalides ; placement invalide (zone, uuid, ordre négatif, champ inconnu) ; précommande vide,
 pièce inconnue, total client refusé ; non-propriétaire refusé sans écriture ; pièce hors
 catalogue refusée ; upsert sans doublon ; update zone/slot/ordre ; création de ligne de kit ;
 objet introuvable ; RPC appelée sans total et total relu en base ; refus
 `unknown_piece_or_colorway` ; total manquant ; actions (session requise, session absente,
 précommande → total serveur).
```

---

## 6. Wiring UI (optimiste, 600 ms, retour arrière, HUD)

- `src/app/kit-studio/page.tsx` : **Server Component async**, `export const dynamic =
  'force-dynamic'`. Lit `createClient()` + `auth.getUser()`, puis
  `getStudioData(user.id)` ; sans session / sans kit / base indisponible → `null`
  (repli local, aucun crash). La donnée est passée à `KitStudioClient`.
- `ui/KitStudioClient.tsx` : prop `initialData?: StudioData | null`. Au montage, si
  `initialData` : `setStudioData(initialData)` **avant** `hydrate()`, puis installation du
  handler d'écriture serveur (`setStudioSyncHandler(createStudioSyncHandler())`) ;
  démontage : handler retiré + `flush()`. Nouveau HUD : bouton
  **« Non enregistré · réessaie »** (rendu seulement si `sync === 'error'`), couleurs en
  variables `--lkv-*`, cible ≥ 44 px.
- `store/kitStore.ts` : `SAVE_DELAY_MS = 600` (ex-300, remplacé). Sauvegarde différée
  regroupée : miroir local (`kitRepository`) puis handler serveur ; en cas d'échec
  (réseau/RLS/refus), **retour arrière** à `lastSaved`, `sync = 'error'`, HUD ; `retry()`
  rejoue l'état optimiste échoué. `hydrate()` ne réutilise l'état local que s'il est
  compatible avec le registre.
- `ui/studioSyncClient.ts` : le handler ne pousse que les différences
  (`domain/syncDiff.ts`) — configuration d'apparence (corps/modules/couleurs), placements
  (zone/emplacement/ordre) et précommandes — via les actions zod. Un changement de kit
  courant (`switchKit`) n'écrit **aucun** contenu (sinon les objets du kit A fuiteraient dans
  le kit B) : seules les précommandes, indépendantes du kit, restent diffusées. Un kit absent
  du contexte serveur n'est pas persisté (kit local).
- Règle `CLAUDE.md` §2 respectée : aucune requête de données dans les Client Components ;
  toute lecture est faite par la page serveur.

```
$ npx vitest run src/features/kit-studio/__tests__/studioSync.test.ts

 ✓ src/features/kit-studio/__tests__/studioSync.test.ts (10 tests)

 10 tests : aucun changement = aucune écriture ; changement de kit = aucune écriture de
 contenu (pas de fuite du kit A vers le kit B) ; corps/couleurs → saveBagConfig ; modules
 déduits de la configuration ; rangement → placement (zone/slot/ordre) ; nouvelle
 précommande ; sauvegarde locale à 600 ms sans handler (aucun réseau) ; échec serveur →
 annulation + sync=error puis « réessaie » rejoue ; flush ; hydratation : un état local de
 démonstration n'est pas réutilisé quand la base fournit d'autres kits.
```

---

## 7. Retrait des constantes de démonstration du chemin de production

Recherche des imports de **données** (`ITEMS`, `KITS`, `COLORWAYS`, `ONE`, `DEFAULT_CONFIG`)
dans le code de production du studio, hors `domain/catalog.ts` (fixtures) et hors tests :

```
$ grep -rn "ITEMS\|\bKITS\b\|COLORWAYS\|\bONE\b\|DEFAULT_CONFIG" src/features/kit-studio \
    --include=*.ts --include=*.tsx \
  | grep -v "__tests__" | grep -v "domain/catalog.ts" | grep -v "domain/studioData.ts" \
  | grep -v "components/KitStudioView.tsx" | grep -v "scene/BagScene.tsx" \
  | grep -E "import .*from|from '.*catalog'"
(sortie vide)
```

`KitStudioView.tsx` et `scene/BagScene.tsx` sont les fichiers du second studio, supprimés en
P3 : ils sont exclus de cette vérification (périmètre P3), aucun fichier de production
survivant n'importe plus ces constantes pour de la donnée.
Restent statiques et légitimes : les **types**, `BAGS` (géométrie/capacités des 2 corps),
`FAMILIES` (libellés des 6 onglets), `MODULE_IDS`, `ZONE_NAMES`, `ANCHORS`, `ALTERNATIVES`
(catalogue d'achat/location), les matières/finitions/accessoires — ce ne sont pas des
données de démonstration mais des référentiels de structure.
`domain/studioData.ts` importe les constantes : c'est le jeu de démonstration, explicitement
conservé comme fixtures de test et repli hors-ligne.

---

## 8. Portes de qualité (sorties réelles)

### 8.1 `node scripts/verify/hub_no_mockup.mjs`

```
$ node scripts/verify/hub_no_mockup.mjs
=== VÉRIFICATION ANTI-MAQUETTE HUB & STUDIO (L2-4) ===

✓ SUCCÈS : Aucune contamination de maquette dans src/features/hub ou kit-studio.

(exit 0)
```

### 8.2 `npx tsc --noEmit -p .`

```
$ npx tsc --noEmit -p .
(exit 0, aucune sortie)
```

### 8.3 `npm run lint`

```
$ npm run lint
(exit 0 — 582 avertissements, 0 erreur ; identique au compte P0 : aucune nouvelle alerte)
info  - Need to disable some ESLint rules? Learn more here:
        https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
```

### 8.4 `npx vitest run src/features/kit-studio src/features/hub`

```
$ npx vitest run src/features/kit-studio src/features/hub

 Test Files  47 passed (47)
      Tests  469 passed (469)
   Duration  4.05s

```

414 verts au départ (P0) + 38 tests P1 de la couche de données + 13 tests du correctif
« pas de démonstration sur le chemin de production » + 4 tests C-03 = 469. Aucun seuil forcé,
aucun golden régénéré. Détail des 38 tests de la couche de données :
`getStudioData.test.ts` (12), `studioActions.test.ts` (16+1 C-03), `studioSync.test.ts` (10) ;
détail des 13 tests du correctif : `studioMode.test.ts` (8), `studioOffline.test.ts` (4),
`route.test.tsx` (+1). Une seule adaptation de test existant, expliquée au §10.4.

### 8.5 `npm run build`

**Constat honnête :** exécuté tel quel sur cette machine (8 Go), le build meurt en OOM dans
le worker Node de lint/typage (`FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory`, plafond de tas par défaut 2 Go), après
`✓ Compiled successfully`. Ce n'est pas une régression P1 : **reproduit à l'identique sur le
commit de base `d706212` sans aucune modification**, dans un worktree séparé :

```
# commit de base d706212 (worktree /tmp/lkdv-base-p1), npm run build
✓ Compiled successfully in 47s
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
Next.js build worker exited with code: null and signal: SIGABRT
BASE_BUILD_EXIT=1
```

Deuxième tentative de `npm run build` telle quelle, après le commit P1 (machine toujours
sous pression mémoire) : même OOM au même endroit (`Compiled successfully in 9.8s` puis
`FATAL ERROR: Ineffective mark-compacts near heap limit`). Le constat est donc reproductible
et **indépendant du code P1** (il se produit aussi sur `d706212`).

Build de la branche, même machine, tas élargi (`NODE_OPTIONS=--max-old-space-size=4096`,
aucun fichier de configuration modifié — `package.json`, `next.config.mjs` et `tsconfig.json`
intacts) :

```
$ NODE_OPTIONS=--max-old-space-size=4096 npm run build
✓ Compiled successfully in 17.4s (relancé après le dernier correctif)
 ...
 ✓ Generating static pages (58/58)
 ...
 Route (app)                                        Size  First Load JS
 ├ ƒ /kit-studio                                 41.4 kB         177 kB
 ...
ƒ  (Dynamic)  server-rendered on demand

BUILD_EXIT=0
```

`/kit-studio` passe de statique à **dynamique** (`ƒ`) : c'est le comportement voulu par la
page serveur (`force-dynamic`, session + RLS). Les 58 autres pages restent générées (59 au
P0, moins la page devenue dynamique).

---

## 9. Reste ouvert, risques et décisions qui remontent

1. **Pas de parcours navigateur authentifié exécuté en P1.** Les écritures sont prouvées en
   base (§2, §3) et par tests à client injecté (§4, §5) ; le parcours de bout en bout en
   session réelle relève des portes E2E (P3/P6). `docs/kit-studio/P1-PREUVES.md` ne prétend
   pas l'avoir mesuré.
2. **Fraîcheur local/serveur non arbitrée.** En production, le miroir `localStorage` est
   réutilisé s'il est compatible (mêmes kits) ; si un autre appareil a modifié le kit, le
   local peut masquer la version serveur jusqu'à la prochaine hydratation incompatible. Un
   arbitrage horodaté (`updated_at`) est à faire en P3.
3. **5 objets `en_pret` non classés** (trigger `inventory_guard`, §0.1) : visibles dans
   `gear_function_review` ; la revue/IA de classement est hors P1.
4. **Champs sans source en base** (jours de kit, départ, cabine, fantômes, plan food,
   `trips`, prêt `lentTo/until`, poids du corps) : défauts documentés §0.4/§0.3. À enrichir
   côté schéma si le produit en a besoin (décision produit, pas P1).
5. **Création de kit absente** : un compte sans kit retombe sur le repli local ; la création
   de kit n'était pas dans le périmètre P1.
6. **`saveBagConfig` ne valide pas les hexadécimaux contre le catalogue de coloris** (format
   seulement) : la configuration est cosmétique ; les couleurs de commande passent, elles,
   uniquement par des `colorway_id` validés en base.
7. **Build** : l'OOM du build par défaut est environnemental (§8.5) ; si la CI de Tony
   dispose de plus de mémoire, la commande `npm run build` passera telle quelle. À défaut,
   `NODE_OPTIONS=--max-old-space-size=4096` suffit et ne modifie aucun fichier.
8. **Écart de forme des statements enregistrés** : `supabase_migrations.statements` contient
   le texte envoyé (commentaires différents du fichier du dépôt), instructions identiques.


---

## 10. Correctif revue Lead — pas de démonstration sur le chemin de production

Défaut signalé : `loadStudioData()` renvoyait `null` sans session, sans kit ou sur erreur base,
et `KitStudioClient` reprenait alors le jeu de démonstration + `localStorage` : un visiteur
anonyme (et a fortiori un compte sans kit) voyait des kits/inventaire factices. Corrigé par un
commit séparé `fix(kit-studio): P1 — pas de démonstration sur le chemin de production`.

### 10.1 Comportement retenu (règle unique, testée)

`resolveStudioPageState()` (`src/features/kit-studio/server/studioMode.ts`, pur, injectable)
décide de l'état de la page dans cet ordre :

| Requête | État | Donnée affichée |
| --- | --- | --- |
| `?debug=1` **explicite** | `debug` | jeu de démonstration + stockage local (comme la maquette), **bandeau permanent « Mode démo · données fictives »** ; session non lue |
| pas de session (ou session illisible) | `login` | **redirection** `redirect('/connexion?next=%2Fkit-studio')` — convention du dépôt (`/inscription` et `/connexion` lisent `next` via `safeNextPath`) ; aucun studio anonyme |
| session + 0 kit | `empty` | état vide serveur `StudioEmptyState` : message + CTA « Créer mon premier kit » vers `/hub?studio=1` (seule UI de création de kit existante aujourd'hui, `POST /api/kit-studio/configuration` ; en P3 ce lien pointera vers le studio survivant) ; mention « aucune donnée de démonstration » |
| session + base indisponible | `unavailable` | état d'erreur serveur `StudioUnavailable` : « Studio indisponible » + « Réessayer » (relance du rendu serveur). Côté client, **repli autorisé uniquement sur le cache serveur réel déjà synchronisé** (`services/studioOffline.ts`, clé `lkdv-kit-studio:server-data:v1`, bandeau « Hors ligne · dernière donnée synchronisée ») ; sans cache valide → erreur, jamais la démo |
| session + kit(s) | `studio` | données réelles `getStudioData`, écritures synchronisées |

Garde-fous supplémentaires :
- `KitStudioClient` exige un `mode` explicite (`debug | server | offline`) : plus de valeur par
  défaut implicite vers la démo.
- En `server`/`offline`, l'écran **n'est pas monté avant l'hydratation** du store avec la
  donnée réelle (`aria-busy` shell vide) : aucun rendu intermédiaire de démonstration, y
  compris au premier paint SSR/client.
- Le cache de données serveur n'est alimenté qu'en mode `server` (jamais en debug).
- `?debug=1` est le seul chemin qui appelle encore `setStudioData(null)` (jeu de démo).

### 10.2 Fichiers du correctif

| Fichier | Changement |
| --- | --- |
| `src/app/kit-studio/page.tsx` | `searchParams` + `resolveStudioPageState` ; branches debug / redirect connexion / état vide / indisponible / studio |
| `src/features/kit-studio/server/studioMode.ts` | **nouveau** : `studioModeFromParam` + `resolveStudioPageState` (purs, testables sans navigateur) |
| `src/features/kit-studio/services/studioOffline.ts` | **nouveau** : cache localStorage de la dernière donnée serveur réelle (validation structurelle, pas de démo) |
| `src/features/kit-studio/ui/StudioEmptyState.tsx` | **nouveau** : état vide serveur + CTA création de kit |
| `src/features/kit-studio/ui/StudioUnavailable.tsx` | **nouveau** : « indisponible » + « Réessayer », ou studio hors-ligne si cache réel |
| `src/features/kit-studio/ui/KitStudioClient.tsx` | mode explicite, bandeaux démo/hors-ligne, gating avant hydratation, cache alimenté en mode serveur |
| `src/features/kit-studio/__tests__/studioMode.test.ts`, `studioOffline.test.ts` | **nouveaux** tests (12) |
| `src/features/kit-studio/__tests__/route.test.tsx` | +1 test (gating production) et adaptation des 4 rendus existants (§10.4) |
| `docs/kit-studio/P1-PREUVES.md` | cette section |

### 10.3 Tests (sorties réelles)

```
$ npx vitest run src/features/kit-studio/__tests__/studioMode.test.ts
 ✓ src/features/kit-studio/__tests__/studioMode.test.ts (8 tests)

 8 tests : seul ?debug=1 ouvre la démo ; undefined/'0'/''/'true'/'2' et paramètres répétés
 → production ; ?debug=1 ne lit pas la session ; sans session → login avec retour ; session
 illisible → login (jamais la démo) ; compte avec kit → données réelles ; compte sans kit →
 état vide ; base indisponible → état unavailable.

$ npx vitest run src/features/kit-studio/__tests__/studioOffline.test.ts
 ✓ src/features/kit-studio/__tests__/studioOffline.test.ts (4 tests)

 4 tests : aller-retour avec horodatage ; absence de cache → null ; cache corrompu/incomplet
 ignoré ; clear.

$ npx vitest run src/features/kit-studio/__tests__/route.test.tsx
 ✓ src/features/kit-studio/__tests__/route.test.tsx (6 tests)

 +1 test : en mode serveur, chargement local suspendu → aucun scène/bandeau de démo avant
 l'hydratation réelle (shell `data-mode="server" aria-busy="true"`).

$ npx vitest run src/features/kit-studio src/features/hub

 Test Files  47 passed (47)
      Tests  469 passed (469)
   Duration  4.05s
```

### 10.4 Adaptation d'un test existant (justifiée, sans masquer de régression)

`route.test.tsx` montait `<KitStudioClient />` sans mode. Le composant exige désormais un mode
explicite ; les 4 rendus existants sont passés à `<KitStudioClient mode="debug" />`, qui est
**exactement** le comportement antérieur (démo + stockage local) : les assertions (scène,
ouverture auto, Échap) et le nombre de tests sont inchangés. Aucun autre test existant modifié.

### 10.5 Vérification grep : plus de repli démo hors mode debug/test

```
$ grep -rn "KitStudioClient" src --include=*.ts --include=*.tsx | grep -v "__tests__"
src/app/kit-studio/page.tsx:50:      return <KitStudioClient mode="debug" />;
src/app/kit-studio/page.tsx:58:      return <KitStudioClient mode="server" initialData={state.data} />;
src/features/kit-studio/ui/StudioUnavailable.tsx:28:    return <KitStudioClient mode="offline" initialData={cached.data} />;

$ grep -rn "createInitialState(" src --include=*.ts --include=*.tsx | grep -v "__tests__"
src/features/kit-studio/domain/state.ts:36:export function createInitialState(kitId?: KitId): KitState {
src/features/kit-studio/services/kitRepository.ts:49:    const base = createInitialState();
src/features/kit-studio/store/kitStore.ts:102:  const initial = createInitialState();
src/features/kit-studio/store/kitStore.ts:136:      const kit = usable ? saved : createInitialState();

$ grep -rln "DEMO_STUDIO_DATA|ITEMS|KITS|COLORWAYS|DEFAULT_CONFIG|FAMILIES" \
    src/features/kit-studio --include=*.ts --include=*.tsx \
  | grep -v "__tests__" | grep -v "domain/catalog.ts" | grep -v "domain/studioData.ts" \
  | grep -v "components/KitStudioView.tsx" | grep -v "scene/BagScene.tsx"
src/features/kit-studio/ui/cards/ModeCapsule.tsx   ← faux positif : `const ITEMS` local (libellés
                                                     des modes Contenu/Apparence, aucune donnée)
src/features/kit-studio/domain/types.ts            ← faux positif : commentaire de contrat
```

Lecture : `createInitialState` n'est appelé que (a) à la création du store, (b) par
`kitRepository.migrate` (état local v0), (c) par `hydrate` ; ces trois chemins ne sont montés
que par `KitStudioClient`, lui-même rendu uniquement en mode `debug` (démo assumée), `server`
(registre = données réelles) ou `offline` (registre = cache serveur réel). Aucun autre fichier
de production ne retombe sur les constantes de démonstration.

### 10.6 Portes après correctif

```
$ node scripts/verify/hub_no_mockup.mjs
✓ SUCCÈS : Aucune contamination de maquette dans src/features/hub ou kit-studio.   (exit 0)

$ npx tsc --noEmit -p .
(exit 0, aucune sortie)

$ npm run lint
(exit 0 — 582 avertissements, 0 erreur ; identique à P0, aucune nouvelle alerte)

$ npx vitest run src/features/kit-studio src/features/hub
 Test Files  47 passed (47)
      Tests  469 passed (469)

$ NODE_OPTIONS=--max-old-space-size=4096 npm run build
✓ Compiled successfully in 17.2s
 ✓ Generating static pages (58/58)
├ ƒ /kit-studio                                 42.5 kB         182 kB
BUILD_EXIT=0
```

(Le OOM du build avec le tas par défaut est environnemental et préexistant, démontré au §8.5
sur le commit de base : aucune régression P1.)

### 10.7 Risques restants du correctif

1. `?debug=1` reste accessible publiquement par construction (c'est le mode demandé, comme la
   maquette de référence) : il est annoncé par un bandeau permanent et ne lit jamais la
   session ni la base.
2. Le cache hors-ligne peut être daté (autre appareil, base indisponible) : bandeau « Hors
   ligne · dernière donnée synchronisée » ; l'arbitrage horodaté fin local/serveur reste à
   faire en P3 (§9.2).
3. La redirection de connexion utilise `?next=` (convention `/connexion` + `safeNextPath`) :
   un visiteur anonyme quitte le studio, il ne le voit pas en lecture seule.


---

## 11. Règle C-03 — poids inconnu = null, JAMAIS 0

### 11.1 Constat (deux violations corrigées)

1. `server/studioService.ts` (insertion d'une ligne de kit) : `weight_g: item.weight_g ?? 0`
   transformait un objet non pesé en objet à 0 g en base.
2. `server/getStudioData.ts` (construction des items) : `g: weightG ?? 0` écrasait `null` ;
   `domain/totals.ts:101` et `:152` testent pourtant `(it.g … ) == null` pour compter les
   « objets non pesés » (`unknown++`), compteur qui ne pouvait donc jamais se déclencher sur
   les vraies données.

### 11.2 Corrections

| Fichier | Correction |
| --- | --- |
| `server/studioService.ts` | `weight_g: item.weight_g ?? null` à l'insertion (la colonne est nullable ; un non pesé reste non pesé) |
| `server/getStudioData.ts` | `g: weightG` sans `?? 0` (poids `null` conservé pour l'inventaire **et** pour les lignes de kit sans `product_ownership`) |
| `domain/catalog.ts` | `Item.g` élargi de `number` à `number \| null` (le domaine gérait déjà `null` à l'exécution ; le type dit désormais la vérité) |
| `domain/totals.ts` | `effG` restructuré (`const g = item.g ; if (g == null) return 0`) : le poids effectif reste 0 pour les sommes, mais `totals().unknown` continue de compter l'objet à part (jamais « 0 g » silencieux) |
| `domain/swap.ts` | `addPlanned` conserve `g: a.g` (une alternative non pesée reste `null`, plus de cast `as number`) |
| `materiel_kit_items` | `KitItemRow.weight_g` est transporté tel quel dans le mapping (aucun `?? 0`) ; un objet de kit non pesé arrive `g: null` |

### 11.3 Tests de non-régression (sorties réelles)

```
$ npx vitest run src/features/kit-studio/__tests__/studioWeight.test.ts
 ✓ src/features/kit-studio/__tests__/studioWeight.test.ts (3 tests)

 3 tests : l’objet non pesé reste null dans le registre/état ; le bilan le compte dans
 `unknown` (=1) et ne l’additionne pas (`weightByZone.main` = 0 g effectif) ; le même objet
 pesé à 1 200 g rentre dans la somme et n’est plus « inconnu ».

$ npx vitest run src/features/kit-studio/__tests__/studioActions.test.ts
 ✓ src/features/kit-studio/__tests__/studioActions.test.ts (17 tests)

 +1 test : insertion d’une ligne de kit pour un objet possédé sans weight_g → `weight_g: null`
 (et explicitement ≠ 0).

$ npx vitest run src/features/kit-studio/__tests__/getStudioData.test.ts
 ✓ src/features/kit-studio/__tests__/getStudioData.test.ts (12 tests)

 Fixtures adaptées (pas la logique) : objet possédé sans `weight_g` → `g: null` ; ligne de kit
 sans `weight_g` → `g: null`.

$ npx vitest run src/features/kit-studio src/features/hub
 Test Files  47 passed (47)
      Tests  469 passed (469)
```

### 11.4 Vérification grep

```
$ grep -rn "weight_g ?? 0\|weight_g: .*?? 0\|g: .*?? 0" \
    src/features/kit-studio/server src/features/kit-studio/domain src/features/kit-studio/services
(srcie vide — aucun poids inconnu converti en 0 restant)
```

Les seuls `?? 0` restants du mapping concernent des champs non concernés par C-03 (prix,
points d'attache, quantités), jamais un poids.

### 11.5 Portes après correctif C-03

```
$ npx tsc --noEmit -p .                     (exit 0, aucune sortie)
$ npm run lint                              (exit 0 — 582 avertissements, 0 erreur)
$ npx vitest run src/features/kit-studio src/features/hub
 Test Files  47 passed (47)
      Tests  469 passed (469)
$ NODE_OPTIONS=--max-old-space-size=4096 npm run build
✓ Compiled successfully in 17.2s · ✓ Generating static pages (58/58) · ƒ /kit-studio 42.5 kB (182 kB First Load) · BUILD_EXIT=0
```
