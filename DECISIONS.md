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

*Les décisions D-01 à D-23 structurent `PLAN.md`. D-19 à D-23 documentent le WIP déjà livré ; toute déviation future doit être ajoutée ici, pas exécutée en silence.*
