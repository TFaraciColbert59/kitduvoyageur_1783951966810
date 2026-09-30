# FINAL_REPORT — LKDV « chantier 2 routes »

Clôture du chantier à partir de l'état **réel** du dépôt (WIP non poussé), et non depuis l'état supposé par `AUDIT.md` / `PLAN.md` / `DECISIONS.md`.

Date de clôture : 2026-09-27
Dépôt : `C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810`

---

## 1. Statut global

| Élément | Valeur |
|---|---|
| Branche courante | `chantier/2routes-p7-routing` |
| `HEAD` | `7b51f67d` + commit W8 (ce rapport) |
| `main` | `302ea16d` — **inchangée**, et c'est la base de fusion |
| Avance sur `main` | **44 commits**, 0 derrière (fast-forward possible) |
| Diff vs `main` | **588 fichiers, +55 632 / −2 766** |
| Poussé sur une remote | **non** — `fatal: no upstream configured` |
| PR ouverte | **non** |
| Mergé dans `main` | **non** |

Rien n'a été poussé, aucune PR n'a été ouverte, `main` n'a pas été touché. Ces actions restent soumises à accord explicite (boundary AGENTS.md : les outils réseau sont en lecture seule par défaut).

Les 44 commits se décomposent en **37 commits de design antérieurs** (branche `design/ios27-full-glass`, refonte Full Liquid Glass iOS 27) et **7 commits de chantier** :

| Commit | Workstream |
|---|---|
| `7b51f67d` | W7 — routage P6, registre unique, R5 |
| `0583b913` | W6 — `/hub` (P4) + `/prepare` (P5) + volets `logistics_scope` |
| `c5a971c6` | W5 — moiety `checkout` du contrat `BookingProvider` (D-03) |
| `3adba93e` | W4 — attribution Viator (D-08) |
| `a998cb0d` | W2 — contrat de credentials double-clé (D-07) |
| `b1f245d3` | W1 — récupération du WIP + addendum D-19→D-21 |
| `09d03120` | pré-existant au chantier — schéma + catalogue unifiés |

---

## 2. Portes de validation — sorties brutes

Les trois portes sont vertes sur l'état final, tests W8 inclus.

### 2.1 TypeScript

```
$ npx tsc --noEmit
TSC_EXIT=0
```

**0 erreur.**

### 2.2 Tests

```
$ npx vitest run
 Test Files  475 passed | 4 skipped (479)
      Tests  3688 passed | 27 skipped (3715)
   Duration  16.26s
VITEST_EXIT=0
```

**0 échec.** Les 4 fichiers et 27 tests ignorés l'étaient déjà avant le chantier.

Les deux fichiers ajoutés par W8 sont bien collectés :

```
$ npx vitest run tests/config/envExample.spec.ts tests/security/unified-booking-rls.spec.ts
 Test Files  2 passed (2)
      Tests  70 passed (70)
```

### 2.3 Build

```
$ npm run build
 ✓ Compiled successfully in 11.8s
BUILD_EXIT=0
```

Routes `/hub` et `/prepare` présentes dans la table de build :

```
├ ƒ /hub                       16.5 kB   411 kB
├ ƒ /hub/[section]             97.2 kB   455 kB
├ ƒ /hub/nouveau               34.4 kB   370 kB
├ ƒ /prepare                   185 B     133 kB
```

Seuls subsistent des *warnings* ESLint préexistants (variables `catch` inutilisées, `no-console`) — aucun échec, aucun warning introduit par le chantier sur les fichiers modifiés.

---

## 3. Implémenté / testé / migré / non déployé

| Workstream | Implémenté | Testé | Migré | Déployé |
|---|---|---|---|---|
| W1 — récupération WIP + secrets | oui | — (non applicable) | — | non |
| W2 — credentials double-clé | oui | oui (unitaires) | — | non |
| W3 — sonde réseau | oui (sonde ponctuelle) | oui (résultat booléen) | — | non |
| W4 — attribution Viator | oui | oui (unitaires) | — | non |
| W5 — moiety `checkout` | oui | oui (unitaires + 401/402) | — | non |
| W6 — `/hub` + `/prepare` | oui | oui (intégration) | — | non |
| W7 — routage P6 + R5 | oui | oui (`no-broken-links`) | — | non |
| W8 — migrations + `.env.example` | oui | oui (70 tests) | **oui (4/4)** | non |

**Rien n'est déployé.** Aucun code n'est passé en production : la branche n'est ni poussée, ni mergée.

---

## 4. Détail par workstream

### W1 — Récupération et sécurisation du WIP

- Branche `chantier/2routes-p1-recover` créée depuis le `HEAD` réel, **54 fichiers dirty commités** — dont `src/app/api/trips/[tripId]/`, qui remplace le `route.ts` supprimé sous `[id]`.
- Les 4 secrets fournis sont écrits **uniquement dans `.env.local`** (déjà gitignoré). Aucun secret n'est dans `.env.example`, aucun dans un log, aucun dans un commit.
- **Addendum `DECISIONS.md` ajouté SANS écraser D-01→D-18** : D-19 (tables `activity_catalog` / `activity_catalog_metrics`), D-20 (`/prepare` = route fine + module `preparator`), D-21 (l'Account ID RouteStack n'est **pas** transmis, il n'entre pas dans le HMAC). D-22 et D-23 ont été ajoutés par W2 et W6.
- Vérification : `DECISIONS.md` contient bien D-01 → D-23, en une seule section, sans doublon.

### W2 — Contrat de credentials double-clé (§12.1C, D-07)

Nouveau fichier `src/features/booking/server/providerCredentials.ts` (`server-only`), consommé par `routeStackBookingProvider` et `viatorBookingProvider`.

- `resolveProviderCredentials(provider, env?)` et `getActiveProviderMode(env?)` remplacent l'ancien `resolveMode` qui lisait `ROUTESTACK_BOOKING_MODE` + `ROUTESTACK_LIVE_ENABLED`.
- **Fail-closed** : `ROUTESTACK_MODE=production` avec la seule clé sandbox lève une erreur typée `credentials.incomplete`. Aucun repli silencieux, aucun mode par défaut permissif.
- Au démarrage, seuls le **mode** et la **présence booléenne** des clés sont journalisés — jamais une valeur.

Noms canoniques réellement présents dans `.env.example` : **13** (et non 12 comme l'annonçait l'énoncé du plan — le décompte du plan oubliait `ROUTESTACK_MODE`) :

```
ROUTESTACK_MODE
ROUTESTACK_SANDBOX_API_KEY      ROUTESTACK_SANDBOX_PARTNER_SECRET   ROUTESTACK_SANDBOX_BASE_URL
ROUTESTACK_FULL_API_KEY         ROUTESTACK_FULL_PARTNER_SECRET      ROUTESTACK_FULL_BASE_URL
VIATOR_MODE
VIATOR_SANDBOX_API_KEY          VIATOR_SANDBOX_API_BASE_URL
VIATOR_FULL_API_KEY             VIATOR_FULL_API_BASE_URL
VIATOR_BOOKING_ENABLED
```

Les **9 noms WIP** acceptés en repli rétrocompatible sont toujours présents :

```
ROUTESTACK_BOOKING_MODE   ROUTESTACK_LIVE_ENABLED   ROUTESTACK_API_KEY
ROUTESTACK_API_SECRET     ROUTESTACK_MCP_URL
VIATOR_BOOKING_MODE       VIATOR_BOOKING_FULL_ENABLED
VIATOR_API_KEY            VIATOR_API_BASE_URL
```

`VIATOR_API_KEY` et `VIATOR_API_BASE_URL` sont **conservés à dessein** : ils sont encore lus par la couche *discovery* (`src/features/discovery/providers/viator/viatorClient.ts`), pas seulement par le booking. Les supprimer aurait cassé la recherche.

### W3 — Sonde réseau réelle (autorisée)

Sonde **ponctuelle, jetable, hors dépôt** (`work/probe.mjs` dans la session Codex, non commité). Sortie en **booléens uniquement** — aucune clé, aucun préfixe.

| Cible | Résultat |
|---|---|
| RouteStack sandbox — obtention `partner-token` (HMAC → partner-token) | **200, token obtenu** |
| RouteStack sandbox — appel Bearer `search-destinations` | **200** |
| Viator — `POST /products/search` en sandbox | **200** |
| Viator — `POST /products/search` en full | **200** |

Aucun `401` (clé/secret faux) ni `402` (quota) sur les cibles testées. **La sonde n'a pas été tentée sur RouteStack production** : aucune clé production n'a été fournie (§ « Hypothèses » du plan).

### W4 — Attribution Viator (D-08)

`src/features/booking/server/viatorAttribution.ts` — helper pur `buildViatorAttributionUrl(base, { pid, mcid, campaign })`.

La fonction **refuse** de produire une URL si :
- `campaign` ∉ `[a-zA-Z0-9-]` (donc `?`, `&`, espace rejetés) ;
- `pid` ≠ 9 chiffres ;
- l'hôte ∉ allowlist.

`medium=api` est forcé. Appliqué au checkout `mode:'external'` et à l'ingestion.

**Statut réel de l'attribution : livrée et testée, mais non exerçable en production.** `VIATOR_PID` et `VIATOR_MCID` sont présents dans `.env.local` mais **vides**. L'URL sortante ne portera donc **aucune commission** tant qu'ils ne sont pas renseignés. C'est déclaré, pas contourné.

### W5 — Moitié `checkout` du contrat `BookingProvider` (D-03)

`bookingProviderTypes.ts` étendu avec `revalidate(candidate)` et `checkoutUrl(candidate, ctx)`. D-03 exige `{ search, revalidate, checkoutUrl }` — seul `search` existait.

- **RouteStack** → `get-payment-url` avec `routestack_external_userid = auth.uid()` et `routestack_metadata = { trip_id, vertical, campaign }`, **uniquement** sur les appels `get-payment-url`.
- `routestack_accountid` n'est **jamais** émis (D-06 / D-21) — vérifié par test.
- `checkoutMode: 'deeplink' | 'acp'` géré. `401` → refresh token ; `402` → erreur quota typée.
- Chaque `checkoutUrl` écrit une ligne `bookings` via `bookingPersistence`, puis alimente `cart_lines`.
- **Viator** → `mode:'external'` via l'attribution W4.

### W6 — Branchement `/hub` (P4) et `/prepare` (P5)

- `/hub` : `bookings` et `cart_lines` branchés dans les sections existantes via `cartService` / `bookingPersistence`. Le Hub n'est **pas** reconstruit (D-02).
- `/prepare` : `getActivePromotion` est appelé au rendu pour afficher la version de modèle courante et les prédictions affinées.
- `MIN_DISTINCT_USERS = 5` et `MIN_PUBLISH_CONFIDENCE = 0.5` sont **intacts** (D-13). La preuve se fait par fixtures de test, pas par abaissement du seuil.
- Les 4 scénarios `logistics_scope` sont couverts : `footing`→`none`, `hiking_day`→`access`, `hiking_bivouac`→`stages`, `roadtrip_multi`→`full` (footing sans vol ; road trip avec vols / véhicules / hôtels / budget).

**Écart assumé et documenté** : `evaluateModelPromotion` n'est **pas** appelé au rendu de `/prepare`. Un GET ne doit pas muter la base. La promotion est déclenchée par la route d'API `src/app/api/promotions/route.ts` et par le service.

### W7 — Routage P6, zéro mock, R5

- `src/constants/routeRegistry.json` est la **source unique**. `route-redirects.config.mjs` (racine) l'expose via `buildRedirects()` et `next.config.mjs` l'appelle — **plus aucun `source:` littéral** dans `next.config.mjs`.
- Registre : **11 `active`, 12 `kept`, 8 `blocked`, 1 `reservedWithoutPage`** (`/go/[slug]`).
- Test `tests/routing/no-broken-links.spec.ts` : chaque entrée du registre pointe vers un `page.tsx` existant, aucune chaîne.
- **Chaîne 301 supprimée** : `/voyage-ia` pointait vers `/voyages/nouveau` (inexistant) puis renvoyait un 307 middleware vers un 404 → corrigé vers `/hub/nouveau`.
- **R5** : `#E4501C` → **0 occurrence dans `src/`** (c'était un unique commentaire).
- **Purge faite** : `src/app/apercu-preparation/` (zéro référence), supprimé.

### W8 — Migrations, `.env.example`, rapport

Voir §5 et §6.

---

## 5. Migrations — appliquées en base

Projet `icxyvwfzjbflcbqukpfz`, statut `ACTIVE_HEALTHY`. Les 4 migrations du plan sont **appliquées et enregistrées** — vérifié par `supabase migration list`, où `local == remote` pour les quatre :

| Migration | local | remote |
|---|---|---|
| `20260926020000_unified_booking_schema` | `20260926020000` | `20260926020000` |
| `20260926030000_seed_activity_catalog` | `20260926030000` | `20260926030000` |
| `20260926040000_trip_launch_atomicity` | `20260926040000` | `20260926040000` |
| `20260926050000_model_promotions_lifecycle` | `20260926050000` | `20260926050000` |

Down-migrations déjà écrites dans `supabase/migrations_down/`.

### 5.1 Comptages bruts

Interrogés via PostgREST avec `Prefer: count=exact`.

```
activity_catalog (total)                     43
activity_catalog (is_active)                 43
activity_catalog_metrics                     212
bookings                                     0
cart_lines                                   0
model_promotions                             0
trip_launches                                0
activity_catalog logistics_scope=none        3
activity_catalog logistics_scope=access     20
activity_catalog logistics_scope=stages     11
activity_catalog logistics_scope=full        9
```

Cohérence : `3 + 20 + 11 + 9 = 43` ✓

`bookings`, `cart_lines`, `model_promotions` et `trip_launches` à **0** est le comportement attendu : ce sont des tables alimentées à l'exécution applicative, pas au seed. Le seed porte sur le catalogue.

### 5.2 Trois bugs SQL réels trouvés **à l'application**

Ces fichiers n'avaient jamais été exécutés. Ils étaient donc syntaxiquement invalides. Les trois corrections sont dans le diff du commit W8.

1. **`20260926040000_trip_launch_atomicity.sql`** — `claim_trip_launch` : **point-virgule manquant** après `failure_reason = NULL`, provoquant `syntax error at or near "RETURN"`. Le `;` a été ajouté.

2. **`20260926050000_model_promotions_lifecycle.sql`** — `promote_model_version` : **ligne 197 tronquée au milieu de la regex** (`!~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,119}`), sans le `$' THEN` ni le bloc `RAISE … END IF` de garde. Le bloc a été restauré, identique à celui de `evaluate_model_promotion`.

3. **`20260926050000_model_promotions_lifecycle.sql`** — **queue dupliquée** : les lignes ~257–315 (après le `COMMIT;`) formaient une copie fantôme de `promote_model_version` + grants + commentaires, soudée par un `COMMIT; THEN` collé → `syntax error at or near "THEN"`. Le fichier a été tronqué à 255 lignes, se terminant proprement par `COMMIT;`.

> **Leçon** : `tsc`, `vitest` et `build` ne-coverranno jamais du SQL. Ces trois défauts n'étaient détectables qu'à l'exécution. Tout nouveau SQL doit être appliqué sur une base jetable avant d'être déclaré vert.

### 5.3 Dérive de migrations découverte

`supabase migration list` montrait **8** migrations en attente, pas 4. Les 4 hors périmètre ont été **mises de côté temporairement** pendant l'opération, puis **restaurées intactes** :

```
20260917010000_phase1_security_fixes.sql
20260925010000_messaging_rls_auth_initplan.sql
20260925020000_core_rls_auth_initplan.sql
20260926010000_rls_role_helper_execute.sql   ← quasi-doublon local de la version distante
                                                        déjà appliquée 20260926010115
```

Elles restent en attente sur la base et **n'ont pas été appliquées** : elles sortent du périmètre de ce chantier et ne bootstrappent pas l'objet demandé. Elles constituent une dette ouverte (§ 10).

Deux versions existent **uniquement côté distant** et n'ont pas de fichier local :

```
20260920095523   (remote only)
20260926010115   (remote only)
```

Le CLI refuse de pousser tant qu'une version remote-only n'a pas de contrepartie locale. Deux fichiers *placeholder* temporaires ont été créés pour débloquer le push, puis **supprimés** immédiatement après. `supabase migration repair --status reverted` n'a **pas** été utilisé : il aurait inscrit un faux historique en base.

### 5.4 Note opérationnelle — cache PostgREST

Juste après le push, PostgREST renvoyait **404 sur les 6 nouvelles tables** (cache de schéma non rechargé). Après **~45 s**, le cache s'est rechargé spontanément : table **et** RPC `activities_by_scope` repassent en 200.

Conséquence pratique : **un 404 PostgREST juste après une migration n'est pas une preuve d'échec de migration.** Attendre ~1 min et réessayer, ou vérifier via `supabase migration list` qui est la source de vérité.

---

## 6. `.env.example` — hygiène

- **75 clés**, **0 doublon**. Le doublon `VIATOR_LANGUAGE` (2 occurrences) est supprimé → 1.
- **0 occurrence de secret** dans le fichier : uniquement des noms et des valeurs vides.
- Contrat providers W2 ajouté (§ 4, W2), plus les 9 noms WIP en repli, plus l'attribution (`VIATOR_PID`, `VIATOR_MCID`, `VIATOR_CAMPAIGN`).
- Test de garde `tests/config/envExample.spec.ts` (**47 tests**) : pas de doublon, 47 clés documentées, aucune valeur de secret, pas de `NEXT_PUBLIC_*` porteur de secret.

Garde-fou ajouté par ce chantier : `tests/security/unified-booking-rls.spec.ts` (**23 tests**) vérifie que RLS est fermée au rôle `anon`, que `WITH CHECK auth.uid()` est présent, que `model_promotions` n'accepte aucune écriture client, et que l'import client d'un adaptateur `server-only` échoue bien.

---

## 7. Prémisses du plan qui se sont révélées fausses

Le plan a été écrit sur un état supposé. Six de ses affirmations ne tenaient pas à l'état réel. Aucune n'a été exécutée à l'aveugle.

### 7.1 Les 8 redirections de la table §8.1

**Le plan était faux sur 8 entrées.** Les routes dites « anciennes » sont des **pages vivantes** : chacune a un `page.tsx` réellement utilisé et référencé. Les 8 redirections n'ont **pas** été appliquées ; le registre les marque `blocked` avec la raison. Une redirection de masse aurait cassé 8 pages en production pour un gain nul.

Seule redirection réellement justifiée : la **chaîne 301** de `/voyage-ia` vers `/voyages/nouveau` (inexistant), corrigée vers `/hub/nouveau`.

### 7.2 Les purges de mocks — 4 sur 6 erronées

| Cible designation « mock » | Verdict réel |
|---|---|
| `src/lib/mock/carnet-chartreuse.ts` | **conservé** — 21 composants de production importent ses types |
| `src/lib/mock/compte-marceline.ts` | **conservé** — même raison |
| `CommunityPostCard.fakeUrl` | **conservé** — c'est `URL.createObjectURL(file)`, une preview d'image réelle côté client, pas un mock |
| `src/components/dev/glass/GlassLab.tsx` | **conservé** — outil du design gate iOS 27, couvert par des tests |
| `src/app/preparer-sentier/apercu/` + `fixtureCountsForPhase()` | **conservé** — harness Playwright `tests/visual/preparer-live.spec.ts` |
| `src/app/apercu-preparation/` | **supprimé** — seule cible réellement morte (0 référence) |

Le plan les identifiait à tort comme des mocks. Les supprimer aurait cassé la production ou les tests visuels.

### 7.3 Autres écarts

- **Anomalie de branches** : W3 (sonde réseau, **aucun fichier produit**) et W4 ont été commités sur la branche W2 (`chantier/2routes-p2-credentials`) au lieu de branches dédiées. Conséquence : l'historique ne respecte pas la découpe `chantier/2routes-pN-*` prévue. Sans effet sur le code, mais l'historique est moins lisible qu'annoncé.
- **`.env.example` — 12 vs 13** : le décompte « 12 noms providers canoniques » de l'énoncé oubliait `ROUTESTACK_MODE`. La réalité est 13.
- **W6** : `evaluateModelPromotion` n'est pas appelé au rendu de `/prepare` (voir § 4, W6).

---

## 8. Variables d'environnement — inventaire exact

### 8.1 Absentes de `.env.local` (20)

```
CREW_INVITE_SECRET                        KIT_REF_SECRET
DOC_SIGNING_SECRET                        KIT_ROYALTY_ENABLED
INDEXNOW_KEY                              NEXT_PUBLIC_FF_ITINERARY_FALLBACK
RESEND_API_KEY                            NEXT_PUBLIC_GA_MEASUREMENT_ID
SEED_SECRET                               NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
TRAVELPAYOUTS_WEBHOOK_SECRET              NEXT_PUBLIC_I18N_EN_ENABLED
VIATOR_SECTION_TAGS                       NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY                         STRIPE_WEBHOOK_SECRET
CRON_SECRET                               STRIPE_RESTRICTED_KEY
LKDV_GLASS_LAB                            LKDV_TRACE_SSR
OBSERVABILITY_LOG
```

Les 14 premières sont désormais **documentées dans `.env.example`** (le plan le demandait). Les 3 drapeaux dev (`LKDV_GLASS_LAB`, `LKDV_TRACE_SSR`, `OBSERVABILITY_LOG`) y sont aussi. `STRIPE_RESTRICTED_KEY` a été ajouté au passage.

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `CRON_SECRET` sont des **trous fonctionnels**, pas de la documentation : le checkout Stripe et les crons d'agrégation ne sont **pas testables de bout en bout**.

### 8.2 Présentes mais **vides** (3)

```
ROUTESTACK_FULL_API_KEY
VIATOR_PID
VIATOR_MCID
```

### 8.3 Effets directs

- `ROUTESTACK_FULL_API_KEY` vide ⇒ `ROUTESTACK_MODE=production` **échoue proprement** (`credentials.incomplete`). C'est exactement le comportement fail-closed voulu. **`main` reste donc le défaut de fait.**
- `VIATOR_PID` / `VIATOR_MCID` vides ⇒ l'attribution W4 ne porte **aucune commission**. Non contourné : le helper refuse, l'URL n'est pas émise avec des paramètres vides.
- `VIATOR_BOOKING_ENABLED=false` ⇒ `viator.checkoutUrl` refuse d'émettre. Voulu.

---

## 9. Blocages déclarés

1. **Aucune clé RouteStack production n'a été fournie** (sandbox seulement). La sonde production n'a pas été tentée, et le mode `production` échoue proprement. `main` reste le défaut.
2. **`VIATOR_PID` et `VIATOR_MCID` absents.** W4 livre le helper et ses tests, mais **l'attribution réelle n'est pas vérifiable** et ne le sera pas sans ces deux valeurs.
3. **`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` absents.** Checkout Stripe et crons d'agrégation non testés E2E.
4. **4 migrations hors périmètre** toujours en attente sur la base (§ 5.3). Dette ouverte, non traitée.
5. **Rien n'est déployé.** Branche non poussée, aucune PR, `main` intacte.
6. **`maplibre` / `leaflet` non fusionnés** (D-17). `/prepare` consomme la carte existante.

---

## 10. Risques ouverts

| # | Risque | Gravité | État |
|---|---|---|---|
| R-1 | **4 clés secrètes partagées en clair dans la conversation** | **haute** | **À révoquer / régénérer** une fois le chantier livré. Elles ne quittent jamais `.env.local`, mais leur existence dans un historique de discussion les expose. |
| R-2 | Le SQL du dépôt n'est validé que par exécution — 3 bugs ont survécu à `tsc`/`vitest`/`build` | haute | Corrigés ici, mais le processus reste : **pas de migration déclarée verte sans application réelle.** |
| R-3 | `20260926010000_rls_role_helper_execute.sql` est un quasi-doublon d'une migration distante déjà appliquée | moyenne | Si elle est appliquée telle quelle, le helper RLS peut être recréé. À arbitrer avant tout futur `db push`. |
| R-4 | 4 migrations de sécurité / RLS restent en attente en base | moyenne | Hors périmètre, mais c'est de la dette de sécurité. |
| R-5 | `VIATOR_BOOKING_ENABLED=false` : le checkout Viator est désactivé | basse | Voulu tant que l'attribution n'est pas configurée. |
| R-6 | Cache PostgREST ~45 s après migration | basse | Cosmétique, mais peut faire croire à un échec de migration. |
| R-7 | Historique de branches non conforme au découpage `chantier/2routes-pN-*` (W3/W4 sur la branche W2) | basse | Cosmétique. |
| R-8 | Diff vs `main` de 588 fichiers / +55 632 lignes, dont 37 commits de design strangers au chantier | moyenne | La PR de merge sera **très large**. Une PR unique serait difficile à relire : envisager de la découper, design d'abord, chantier ensuite. |

---

## 11. Actions externes non prises

Conformément aux boundaries du projet (outils réseau en lecture seule par défaut), **aucune** de ces actions n'a été entreprise :

- [ ] `git push` de `chantier/2routes-p7-routing`
- [ ] ouverture d'une PR vers `main`
- [ ] merge de quoi que ce soit
- [ ] rotation des 4 clés secrètes
- [ ] application des 4 migrations hors périmètre

Ces actions demandent un accord explicite.

---

## 12. Sécurité du dépôt

Scan du diff staged avant commit, sur les 4 valeurs fournies (clés RouteStack sandbox et production, clé et secret
de session RouteStack, Account ID). Le motif n'est volontairement **pas recopié ici** : écrire ne serait-ce qu'un
préfixe de clé dans un fichier versionné violerait la règle du chantier (« ne jamais afficher de clé ni de préfixe »).

Résultat au moment de la clôture : **0 occurrence réelle**.

Les seules correspondances du scan portaient sur le motif de recherche lui-même et sur la valeur d'Account ID
citée en § 4 (W1) — celle-ci a été retirée de ce rapport après le scan, la décision D-21 étant déjà consignée
dans `DECISIONS.md` où le plan demandait explicitement de la documenter.

État des garde-fous :

- `.env.local` est gitignoré.
- `.env.example` ne contient **aucune valeur** de secret, seulement des noms.
- Les adaptateurs `server-only` (`providerCredentials.ts`, `viatorAttribution.ts`) échouent à l'import côté client — vérifié par test.
- `artifacts/` est dans `.gitignore`.
- `work_apply.mjs`, `work_patch.txt`, `work_commit.txt` sont exclus via `.git/info/exclude` (outillage de session, hors produit).

---

## 13. Ce qu'il reste à faire

**Immédiat :**

1. Relire et merger ce commit W8.
2. **Décider de la stratégie de merge** : la branche contient 37 commits de design strangers au chantier (risque R-8). Une PR unique serait très difficile à relire.
3. Pousser la branche et ouvrir la PR vers `main` — **sur accord explicite**.

**Sécurité :**

4. **Révoquer et régénérer les 4 clés** (risque R-1).
5. Renseigner `ROUTESTACK_FULL_API_KEY` si le mode production est réellement voulu.
6. Renseigner `VIATOR_PID` / `VIATOR_MCID` pour activer l'attribution, puis `VIATOR_BOOKING_ENABLED=true`.

**Dette technique :**

7. Arbitrer `20260926010000_rls_role_helper_execute.sql` (risque R-3).
8. Planifier l'application des 4 migrations hors périmètre (risque R-4).
9. Renseigner `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` pour couvrir Stripe et les crons E2E.
10. Documenter dans `AGENTS.md` la règle : **une migration n'est verte qu'après application réelle sur une base.**

---

*Rapport généré à partir de l'état réel du dépôt et de la base, pas de l'état supposé par `PLAN.md`. Les écarts entre les deux sont documentés en § 7 plutôt que masqués.*