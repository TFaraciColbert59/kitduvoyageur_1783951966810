# DECISIONS.md — Journal de décisions techniques (ADR)

> Chaque décision est justifiée par un fait mesuré dans `AUDIT.md`. Aucune question posée : carte blanche exercée, hypothèses explicitées.

---

### D-01 — Faire de `/prepare` une **fusion**, pas une réécriture
**Contexte :** 6 routes éclatées (`/ai-configurator`, `/voyages/[slug]`, `/preparer-sentier/[id]`, `/preparer-randonnee`, `/apercu-preparation`, `/copilote`) ; deux moteurs de configuration non reliés.
**Décision :** créer une seule route `/prepare` qui **réutilise** `configuratorCore`/`configuratorEngine` (sac) et le pipeline `trips/engine/*` (voyage), au lieu de réécrire.
**Raison :** ces briques sont testées et branchées sur la vraie base (`shop_products`). Réécrire détruirait de la valeur vérifiée.
**Conséquence :** `/prepare` est un **orchestrateur** (3 volets : sac / carte / logistique), pas un nouveau monolithe.

### D-02 — Garder `/hub`, l'étendre par registre
**Contexte :** `hubSectionRegistry` + surfaces `?phase=live|recount` déjà en place ; 13 sous-dossiers `mobile/*`.
**Décision :** ne pas toucher au Hub ; **brancher** les nouvelles entités (`bookings`, `cart_lines`) dans les sections existantes.
**Raison :** c'est le socle le plus sain (AUDIT §3.1). Le casser serait un coût sans bénéfice.

### D-03 — Une **interface de réservation commune**, pas d'appels dispersés
**Contexte :** RouteStack = vols/hôtels/voitures ; Viator = activités ; affiliations existantes = reste.
**Décision :** contrat unique `BookingProvider { search, revalidate, checkoutUrl }` avec adaptateurs (`routestack`, `viator`, `affiliate`).
**Raison :** un seul panier, un seul enregistrement `bookings`, une seule UI. Évite 4 intégrations divergentes.

### D-04 — RouteStack : auth **HMAC → partner token**, Bearer seul ensuite
**Contexte :** doc officielle `EXTERNAL_MCP_INTEGRATION.md` (§1).
**Décision :** `POST /mcp/auth/partner-token` avec `{apiKey, hmac, timestamp, nonce}` ; HMAC-SHA256 **base64url** de `apiKey:timestamp:nonce` ; puis `Authorization: Bearer` **uniquement** ; cache du token jusqu'à expiry.
**Raison :** c'est le contrat **production**. Envoyer `x-api-key`/`x-member-token` par appel est explicitement proscrit.

### D-05 — RouteStack hôtel : **conserver `correlationId` + `token`**
**Contexte :** doc §2.1 — le couple identifie la session de listing, TTL ~2 h.
**Décision :** persister `(token, correlationId)` issus de `search-hotels` dans l'état de session ; les rejouer sur `get-hotel-details*`, `revalidate`, `get-payment-url` ; **jamais** en inventer un avant la première recherche.
**Raison :** sans ça, `get-rooms-and-rates`/`revalidate` échouent (expiry).

### D-06 — Attribution marchand RouteStack sur `get-payment-url` uniquement
**Contexte :** `ROUTESTACK_CALLER_CONTEXT.md`.
**Décision :** envoyer `routestack_external_userid = auth.uid()` et `routestack_metadata = {trip_id, vertical, campaign}` **seulement** sur les endpoints `get-payment-url` ; **ne pas** envoyer `routestack_accountid` (résolu par le token).
**Raison :** conforme, et garantit la traçabilité commande ↔ utilisateur ↔ voyage.

### D-07 — Viator : bascule **Sandbox ↔ Full par variable**, mode Booking sous flag
**Contexte :** accès FULL + clé sandbox ; le code actuel n'a **aucune** variable de bascule et `DISCOVERY_PROVIDER=klook` par défaut.
**Décision :** `VIATOR_MODE=sandbox|full` pilote la base ; `VIATOR_BOOKING_ENABLED` active le booking. Réservation = **ouverture de viator.com dans le navigateur intégré** (`mode:'external'`).
**Raison :** la mission exige « une simple variable ». Ne pas coder la bascule en dur.

### D-08 — Viator : attribution **obligatoire** et stricte
**Contexte :** doc attribution — params `pid`, `mcid`, `medium`, `campaign` ; un usage incorrect peut **annuler la commission**.
**Décision :** construire toute URL sortante via un helper qui n'accepte que `[a-zA-Z0-9-]` dans `campaign`, `medium=api`, et refuse l'URL sinon.
**Raison :** protège le revenu ; réutilise l'esprit du garde-fou `affiliateEngine` existant.

### D-09 — Ne rien faire pour Amadeus, et le documenter
**Contexte :** `rg -i amadeus` → **0 occurrence**.
**Décision :** constater la suppression comme **déjà effective**.
**Raison :** ne pas créer de travail fictif. Honnêteté du rapport.

### D-10 — Le catalogue d'activités est **une donnée seedée exhaustive**, pas une liste en dur
**Contexte :** la vision demande « catalogue exhaustif » + « métriques adaptées automatiquement ».
**Décision :** tables `activities` + `activity_metrics` en BDD, avec seed par familles et un champ `logistics_scope`.
**Raison :** le niveau de logistique doit être **dérivé de la donnée**, pas d'un `if` dans l'UI.

### D-11 — `logistics_scope` pilote la logistique (footing ≠ road trip)
**Contexte :** « Un footing n'a pas de logistique, … un road trip en Amérique du Sud a tout. »
**Décision :** enum `none | access | stages | full` sur `activities`, consommé par `/prepare` pour afficher uniquement les volets pertinents.
**Raison :** évite de proposer des vols pour un footing ; rend les 4 scénarios cohérents par construction.

### D-12 — Fermer la boucle d'apprentissage par une **promotion déterministe**
**Contexte :** shadow mode + backtesting existent mais **aucun** mécanisme de promotion (`rg feedback` → UI seulement).
**Décision :** ajouter `evaluate → promote` : si le candidat bat le courant sur le backtest, promouvoir `model_version` et journaliser dans `model_promotions`.
**Raison :** « que l'IA s'améliore toute seule » exige ce maillon manquant. Déterministe ⇒ testable.

### D-13 — Console de seuils explicite (≥ 5 users, confiance ≥ 0.5)
**Contexte :** `MIN_DISTINCT_USERS = 5`, `MIN_PUBLISH_CONFIDENCE = 0.5`.
**Décision :** **ne pas** baisser ces seuils pour « faire marcher la démo » ; à la place, prévoir un jeu d'observations réalistes pour la preuve.
**Raison :** abaisser un seuil de confidentialité pour verdir un test serait une falsification.

### D-14 — Purge « zéro mock » **ciblée**, pas un grep brut
**Contexte :** 437 occurrences brutes, mais majoritairement des `placeholder` HTML légitimes.
**Décision :** cible réelle = `src/lib/mock/*` (2 fichiers), 3 écrans dev-only, `fixtureCountsForPhase()`, le `fakeUrl` de `CommunityPostCard`. Traiter ceux-là, plus tout `EXAMPLE_*`.
**Raison :** un chiffre brut non qualifié n'est pas un plan ; la dette réelle est petite et traçable.

### D-15 — Routage : **registre unique** + redirections sans chaîne
**Contexte :** `next.config.mjs` a déjà `redirects()` ; 4 registres métier existent déjà.
**Décision :** `src/constants/routeRegistry.ts` comme source unique ; `redirects()` généré ; chaque ancien → cible **finale** (pas de 301 en chaîne) ; test automatique « cible existe ».
**Raison :** « aucun lien cassé » doit être **prouvé par un test**, pas affirmé.

### D-16 — Tout en BDD, clés **jamais** côté client
**Contexte :** contrainte explicite mission + `viatorClient` déjà `server-only`.
**Décision :** tous les adaptateurs réservation sont `server-only` ; seuls des *deeplinks* (sans secret) atteignent le navigateur.
**Raison :** sécurité ; cohérent avec le code existant (`import 'server-only'`).

### D-17 — Ne pas fusionner `maplibre`/`leaflet` dans ce chantier
**Contexte :** chantier « ATLAS » antérieur prévoit un moteur unique MapLibre globe.
**Décision :** hors périmètre de ce chantier ; `/prepare` consomme la carte **telle quelle**.
**Raison :** éviter deux refontes cartographiques simultanées sur les mêmes fichiers.

### D-18 — Build vert comme **porte**, jamais comme promesse
**Contexte :** `node_modules` absent au clone.
**Décision :** conditionner toute affirmation de « vert » à une sortie réelle de `tsc`/`test`/`build` ; tant qu'elle n'existe pas, le rapport le dit.
**Raison :** règle du dépôt (`Z-R7`, `ATLAS-R8`) et honnêteté de livraison.

---

*Les décisions D-01 à D-18 structurent `PLAN.md`. Toute déviation future doit être ajoutée ici, pas exécutée en silence.*

---

### D-19 — Les tables du catalogue s'appellent `activity_catalog`, pas `activities`
**Contexte :** `PLAN.md` §7 prévoit `activities` + `activity_metrics`. Or `public.activities` existe **déjà** depuis `20260718140000_activities_notifications_sos.sql`, avec une sémantique différente (notifications/SOS). La migration `20260926020000_unified_booking_schema.sql` crée donc `activity_catalog` + `activity_catalog_metrics`.
**Décision :** conserver `activity_catalog` / `activity_catalog_metrics`. Colonnes et RLS conformes à l'intention D-10 (catalogue seedé, métriques par activité, `logistics_scope` enum `none|access|stages|full`).
**Raison :** évite une collision de nom sur une table préexistante et déjà peuplée. Réutiliser `activities` aurait exigé de migration de données sur une table en production — risque sans benefit. Écart de **nommage uniquement**, pas de modèle.

### D-20 — `/prepare` est une route fine au-dessus du module `preparator`
**Contexte :** le WIP livre `src/app/prepare/{page.tsx,loading.tsx}` qui délègue à `src/features/preparator/{engine,server,components}`. `PLAN.md` §1 décrit `/prepare` comme orchestrateur à 3 volets.
**Décision :** valider cette structure. La page ne fait que `getPreparatorData()` + `<PreparatorView/>` ; toute la logique vit dans `src/features/preparator/`, testable sans rendu.
**Raison :** conforme à D-01 (fusion, pas réécriture) et à la règle « fichiers 200-400 lignes » : `routeStackBookingProvider.ts` (831 l.) et les 8 fichiers `features/booking/` et `features/cart/` sont les seuls points de tension taille, tolérés et documentés.

### D-21 — L'Account ID RouteStack n'est jamais transmis
**Contexte :** un identifiant de compte sandbox a été fourni avec les clés. `D-06` interdit déjà d'envoyer `routestack_accountid`.
**Décision :** ne pas stocker ni transmettre cet identifiant. L'authentification est **uniquement** HMAC-SHA256 → `POST /mcp/auth/partner-token`, puis `Authorization: Bearer`. L'identifiant de compte est résolu par le token partenaire.
**Raison :** le secret du HMAC est déjà transmis dans le corps de la requête d'authentification ; ajouter un identifiant de compte n'apporte rien au HMAC et contredirait D-06. Vérifié par test : `routestack_accountid` ne doit apparaître dans aucun payload.

### D-22 — Le contrat de credentials devient double-clé avec repli rétrocompatible
**Contexte :** le WIP lisait une paire unique `ROUTESTACK_API_KEY` / `ROUTESTACK_API_SECRET` et un mode `ROUTESTACK_BOOKING_MODE` + `ROUTESTACK_LIVE_ENABLED`. Le besoin réel (bascule sandbox ↔ production **sans jamais éditer une clé**, §12.1) impose deux jeux coexistants.
**Décision :** `resolveProviderCredentials()` unique, `server-only`, sélectionne la paire selon `ROUTESTACK_MODE` / `VIATOR_MODE`. Les 9 variables WIP restent acceptées **en repli** quand les variables préfixées sont absentes.
**Raison :** D-07 exige une bascule par variable. Le repli garantit qu'aucun déploiement existant ne casse ; le **fail-closed** (mode `production` + clé sandbox seule → erreur typée) garantit qu'on ne réserve jamais en sandbox en croyant être en production.

### D-23 — `/hub` est branché, jamais reconstruit
**Contexte :** D-02 disait « ne pas toucher au Hub ». `bookings` et `cart_lines` n'y étaient référencées nulle part.
**Décision :** lecture seule branchée dans les sections existantes du registre. Le Hub n'est pas refactoré.
**Raison :** cohérent avec D-02 et avec le socle le plus sain du dépôt. Le branchement se limite à exposer des données déjà persistées.

---

### D-24 — Partage de kit au groupe : drapeau dédié `is_shared_with_group` (L7-1, décision Tony)
**Contexte :** `materiel_kits.is_public` est déjà utilisé par `20261014231000_public_shared_kit_items_rls.sql` pour exposer les articles d'un kit public à **tous** les utilisateurs `authenticated` (kits vitrines / partage public). Réutiliser `is_public` pour le partage restreint à l'équipage exposerait un kit de groupe à l'ensemble de la plateforme.
**Décision :** ajouter `is_shared_with_group boolean not null default false` sur `public.materiel_kits`, vérifié par `public.can_read_member_kit(target_user, target_kit)` conjointement à l'appartenance active au même voyage/équipage (`trip_collaborators` / `trip_participants` / `crew_members`). Lecture seule (`SELECT`), aucune écriture ouverte, `REVOKE EXECUTE FROM PUBLIC, anon`.
**Raison :** séparation stricte entre publication publique (`is_public`) et consultation interne à l'équipage (`is_shared_with_group`).

### D-25 — Arbitrage mono-contexte WebGL obligatoire (`WebGLArbiter`, ADR-002 / M0)
**Contexte :** iOS WKWebView ne garantit pas la survie simultanée d'un contexte MapLibre GL et d'un contexte Three.js sans éviction GPU (`webglcontextlost`).
**Décision :** imposer `camp-map` XOR `bag-scene` via `WebGLArbiter`. L'entrée au Kit Studio sauvegarde `{ center, zoom, pitch, bearing }` et détruit la carte ; la sortie démonte Three.js et restaure la carte. Une unique tentative de restauration est effectuée sur `webglcontextlost` avant bascule définitive en `DEGRADED` (mode Liste).
**Raison :** fiabilité sur iPhone d'entrée de gamme et respect du budget batterie (pause hors écran et libération après 30 s en arrière-plan).

### D-26 — Sacs 3D procéduraux `.glb` + manifestes d'honnêteté (`tools/bag-generator/`, ADR-003)
**Contexte :** aucun asset 3D binaire tiers libre et modulaire par pièce n'existe dans le dépôt ; un maillage monobloc ne peut pas ouvrir honnêtement son rabat.
**Décision :** générer les 5 modèles (`.glb` + `.manifest.json` + `bags.index.json`) par code (`npm run assets:bags`, validés par `npm run assets:validate`), avec matériaux isolés par pièce et contrat `BagCapabilities`. Un sac `openable: false` (`duffel-60`) n'expose aucune charnière et délègue son intérieur à `BagListView`.
**Raison :** zéro licence tierce opaque, budget géométrique maîtrisé (< 6 000 triangles, < 380 Ko par sac) et honnêteté visuelle totale.

### D-27 — Zéro nouvelle route Next.js, `hubSectionRegistry` intact (ADR-005 / ADR-006)
**Contexte :** `hubSectionRegistry.ts` gouverne les 19 entrées canoniques de `/hub`.
**Décision :** ne créer aucun `page.tsx` ; conserver `hubSectionRegistry.ts` intact (y compris la redirection `/hub/preparation -> /compas?etape=kit`) ; piloter les tiroirs et le Kit Studio (`?studio=1&drawer=...`) via `DrawerNavigationMachine` derrière le feature flag `hub_camp_v1` (`false` par défaut) en extrayant uniquement `DrawerShell` et `LensPager` depuis Compte.
**Raison :** préserve tous les liens profonds `/hub/<segment>`, évite toute régression hors flag, et interdit toute fuite de maquette (`scripts/verify/hub_no_mockup.mjs`).

### D-28 — Remplacement atomique des articles et poids inconnu `NULL` (L0-1)
**Contexte :** l'ancien `DELETE` + `INSERT` non transactionnel dans `PATCH /api/materiel/kits/[id]` détruisait le kit en cas d'erreur d'insertion ou de tableau vide accidentel, et ramenait un poids inconnu à `0`.
**Décision :** RPC transactionnelle `public.replace_kit_items(p_kit_id, p_items, p_allow_empty)` refusant le vidage involontaire (`23514`), vérifiant la propriété (`42501`), incrémentant `studio_revision`, et préservant `NULL` pour les poids inconnus (`nullif(item->>'weight_g', '')::integer`).
**Raison :** zéro perte silencieuse de données et intégrité arithmétique des pesées (`unknownWeightCount` distinct de `0 g`).

### D-29 — Exclusion du Lot L8 (`CampScene` 3D décorative, décision Tony L8-0)
**Contexte :** le Lot L8 (scène 3D de campement procédurale) était conditionnel.
**Décision :** exclure L8. Le HUB Camp de base conserve la carte réelle MapLibre (`CampMap`) sous `WebGLArbiter`.
**Raison :** concentrer le budget GPU, JS et batterie sur la carte terrain réelle et le Kit Studio 3D fonctionnel.

---

*Les décisions D-01 à D-29 structurent le dépôt. Toute déviation future doit être ajoutée ici, pas exécutée en silence.*
