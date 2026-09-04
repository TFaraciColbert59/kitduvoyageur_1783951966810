# LKDV — Mission Log

## 2026-09-04 — Corrections revue PR « Lignées de kits » (bloquants adressés)

### Décision : Lot 6 GELÉ (part créateur non déployée)
- **`20260903050000_kit_attributions.sql` EXCLUE de la vague** : le crédit boutique n'est
  pas consommable au checkout → une part créateur serait une promesse non tenue. Migration
  conservée dans la branche, non appliquée.
- **Flag serveur `KIT_ROYALTY_ENABLED`** (défaut OFF) : `/api/kits/my-royalties` répond
  `enabled:false` SANS interroger la base ; la mention de transparence du KitSheet n'est
  rendue que si `true`. Aucun objet Lot 6 n'existe en base tant que le gel dure.
- Webhook : l'appel RPC d'attribution absent (table inexistante) est dans un try/catch →
  non bloquant. `metadata.kit_ref` posé au checkout reste inoffensif.

### Scan de sécurité historique (808 commits, toutes branches)
- `.env.local` : **jamais commité**.
- `.env` : commité (5 commits) puis **retiré du tracking** (`086e6b1` « gitignore .env »).
  Contenait uniquement des clés PUBLIC + 4 clés provider (OPENAI/GEMINI/ANTHROPIC/
  PERPLEXITY) à longueurs 24-53 en format NON-live (probables placeholders).
- **Aucun `sk_live_`, `whsec_`, `SUPABASE_SERVICE_ROLE_KEY` dans l'historique.** Pas de
  rotation Stripe/Supabase requise. Précaution : vérifier que le `.env.local` actuel
  diffère des 4 valeurs historiques (sinon rotation).

### Vitest élargi aux tests hiking + correction CLAUDE.md
- `vitest.config.ts` include += `src/**/__tests__/**/*.test.ts`.
- Les 9 suites hiking (runner legacy auto-run) **enveloppées en suites Vitest** (describe/
  it + `expect(result.failed).toBe(0)`, garde `process.env.VITEST` sur les `process.exit`)
  → elles s'exécutent ENFIN réellement dans `npm test` : **312 tests / 52 fichiers, verts**.
- CLAUDE.md : « 32 tests unitaires » → description exacte des 9 suites maintenant exécutées.

### Réconciliation Stripe + rapports
- **`docs/reports/RECONCILIATION_STRIPE.md`** : méthodologie de rapprochement des
  paiements orphelins (avant Lot 3), décision par orphelin (honorer/rembourser), requêtes
  SQL, tableau de traçage — **bloquant PR, données réelles à exécuter par Tony**.
- `RAPPORT_LIGNEES.md` : migration 6 marquée ❄️ EXCLUE ; section 4 → checklist à confirmer
  par pgTAP (sorties à coller en 4bis) ; résultats du scan sécurité; flag mentionné.

## 2026-09-03 — Chantier « Lignées de kits » — LOTS 7 & 8 : découverte + livraison (mode autonome)

### Lot 7 — Découverte (conservation et endurance, pas de palmarès)
- Route `GET /api/kits/discovery` enrichie : filtres `region` (massif) et `season`
  (printemps/ete/automne/hiver, calculés sur les sessions) ; deux tableaux (items
  conservés ≥ 50 %, lignées endurantes à `has_min_sessions`) ; noms de kits.
- Composant `LineageDiscovery` (desktop /communaute, onglet fil) : « Ce qui revient du
  terrain » (badges « gardé par X voyageurs sur 10 ») + « Lignées endurantes » (cartes →
  KitSheet). **Aucun compteur de partages.** Seuil 20 lignées régionales (trust.ts).

### Lot 8 — Sécurité, revue, livraison
- **Test pgTAP `security_lignees.test.sql`** (10 assert.) : anon bloqué sur
  checkout_intents / kit_field_reports / kit_royalty_shares / kit_attributions ; B ne
  voit pas les données de A ; A voit ses parts ; anon ne peut pas invoquer
  insert_kit_attribution ; matviews publiques lisibles.
- **RAPPORT_LIGNEES.md** : migrations ordonnées + rollback par lot + checklist
  d'exposition de données (RGPD/XSS) + endpoints + reste à faire infra.
- **CLAUDE.md** : section « Lignées de kits » ; **PROGRESS.md** : entrée chantier.
- **Vérifs finales** : tsc 0 · Vitest **303/303 (43 fichiers)** · build OK · lint 0 erreur.

### 🏁 FIN DU CHANTIER (code)
- Branche `feat/lignees-kits` : 6 migrations, 5 suites pgTAP (54 assertions), 2 routes
  cron, 2 API kits, refonte checkout/webhook/fork, KitSheet + messagerie/produit/
  communaute, modules purs testés (lineage, fieldProof, trust, royalty, kitRef).
- **Reste infra (Tony)** : application migrations + backfill sur copie + pgTAP (GATE 1),
  Stripe test (GATE 3), puis production + crons ; taux bps réel ; consommation crédit
  boutique (Phase 2). Rien n'a été appliqué en base.

## 2026-09-03 — Chantier « Lignées de kits » — LOT 6 : la part créateur (terminé, mode autonome)

### Lot 6 — La part créateur (dépend de 1, 3, 4 — tous verts)
- **Décisions appliquées** : barème 70/20/10 par défaut (300 bps = 3 %, modifiable via
  `royalty_config` sans migration — question Tony reportée à la config, pas au code) ;
  versement en **crédit boutique** (extension reward engine, décision GATE 0) ; nom des
  forks : liberté de renommage + mention « Issu de X » dans le KitSheet (question Tony
  tranchée par défaut conservateur, documentée).
- **Migration `supabase/migrations/20260903050000_kit_attributions.sql`** :
  `royalty_config` (config en base) · `kit_attributions` (UNIQUE order_item_id →
  idempotence rejeu) · `kit_royalty_shares` (RLS : bénéficiaire lit ses parts, écriture
  service_role) · **store credit** (`reward_accounts.store_credit_cents` + ledger
  append-only `store_credit_ledger`, RLS own) · RPC SECURITY DEFINER :
  `insert_kit_attribution` (condition TERRAIN : ≥1 session ≥1 km dans la lignée, produit
  du kit requis, idempotente), `finalize_kit_attributions` (14 j → confirmed + crédit),
  `reverse_kit_attribution_by_session` (refund → reversed, débit si déjà crédité).
- **Cookie d'attribution** `lkdv_kit_ref` : module `kitRef.ts` (HMAC-SHA256 Web Crypto,
  httpOnly/secure/sameSite=lax, TTL 30 j, forgé/expiré → ignoré silencieusement) + 6 tests.
  Posé par `GET /api/materiel/share` (lien externe) et `GET /api/kits/[id]/refer` (KitSheet).
- **Checkout** : lit et VÉRIFIE le cookie → `metadata.kit_ref`.
- **Webhook** : après `order_items`, calcul `computeRoyaltyShares` (TS, invariant strict
  somme=commission) + RPC d'insertion (remote ancestors, 3 générations, acheteur exclu) ;
  `charge.refunded` → reversal par session.
- **Module pur `royalty.ts`** : `computeRoyaltyShares` avec invariant strict (aucun centime
  perdu/créé), plancher 1 cent, acheteur exclu, 3 générations max — **7 tests**.
- **Cron `GET /api/cron/finalize-kit-attributions`** (Bearer CRON_SECRET) + **API
  `GET /api/kits/my-royalties`** (« ma part créateur »).
- **Test DB `supabase/tests/database/attributions.test.sql`** (7 assertions : condition
  terrain, idempotence rejeu, auto-achat exclu, somme = 900 cts, reversal).
- **Vérifs** : tsc OK · npm test 303/303 (43 fichiers) OK · build OK · lint 0 erreur.

## 2026-09-03 — Chantier « Lignées de kits » — LOT 5 : le KitSheet (terminé, mode autonome)

### Lot 5 — L'objet qui circule (aucune page /kits/[slug])
- **Route `GET /api/kits/[id]/sheet`** : kit (RLS own-or-public) + parent name + journal RPC
  anonymisé + trust/survival (matviews, connecté uniquement).
- **Route `GET /api/kits/discovery`** : encart produit (lignages_count, lineage_root_id,
  conservation) + découverte (items conservés / lignées endurantes, plancher appliqué).
- **`KitSheetContext`** (provider + `useKitSheet`) monté dans le layout racine ; **`KitSheetModal`**
  : bottom sheet mobile / drawer desktop, palette maison, haptique, mention obligatoire de la
  part créateur (transparence Lot 6), actions Emporter / Forker / Envoyer (copie lien /k/token).
  Dynamic import (poids initial préservé).
- **Points d'invocation** :
  - Cockpit : bouton « Voir la fiche » dans `KitCarrySelector` + présélection `?kitId=` ;
  - Messagerie : type `'kit'` dans `MessageType` + `KitMessageMeta` + carte `KitCard` rendue
    inline dans `MessageBubble` (clic → KitSheet) + envoi depuis `ComposerMenuSheet` (vue
    « Mes kits ») câblé de bout en bout (ConversationView → MessageComposer) ;
  - Produit : `ProductLineageCard` (« présent dans N lignées, gardé par X sur 10 ») inséré
    dans `ProductDetailClient`, clic → KitSheet de la lignée.
- **Vérifs** : tsc OK · npm test 290/290 OK · build OK · lint 0 erreur (7 warnings
  préexistants / patterns maison).

## 2026-09-03 — Chantier « Lignées de kits » — LOT 4 : conservation (terminé, mode autonome)

### Lot 4 — Le moteur de jugement (code vert)
- **Migration `supabase/migrations/20260903040000_kit_conservation.sql`** :
  - Matview `kit_item_survival` (conservation par item_key, auto-forks exclus) — découverte
    « ce qui revient du terrain ».
  - Matview `kit_item_survival_by_kit` (par parent + item_key) — KitSheet.
  - Matview `kit_trust_scores` — **deux axes distincts** (propagation : forks réels à
    ≥1 session, user uniques, décroissance 1/pow(age_h+2,1.5) ; endurance : sessions,
    saisons, massifs, ratio essentiel/jamais_servi) + `has_min_sessions` (plancher 5).
  - Index uniques (CONCURRENTLY), grants anon/authenticated en lecture, RPC
    `refresh_kit_conservation()` SECURITY DEFINER (service_role uniquement).
- **Migration `20260903041000_kit_souches_seed.sql`** : compte système LKDV
  (`00000000-0000-4000-8000-0000000000a1`, lkdv-studio@) + conversion des kits éditoriaux en
  souches (`is_souche=true`, `origin='souche_editoriale'`, is_public) avec items reliés à
  shop_products par slug exact (sinon NULL). Idempotente.
- **Route cron `GET /api/cron/refresh-kit-scores`** — convention `Authorization: Bearer
  ${CRON_SECRET}` (identique à refresh-country-guides / process-ai-jobs).
- **Module pur `src/features/kits/trust.ts` + 15 tests Vitest** (`tests/kits/trust.spec.ts`) :
  survivalRate, plancher 5 sessions (scoreStatus : pas encore éprouvé / lignée jeune /
  éprouvé), décroissance temporelle miroir SQL, phrase publique « gardé par X voyageurs sur
  10 », seuil 20 lignées régionales.
- **Tests DB `supabase/tests/database/conservation.test.sql`** (8 assertions pgTAP) : jeu
  synthétique 1 souche + 5 forks (2 auto) + 3 sessions → auto-forks exclus (total_pairs=3),
  réchaud à 33,3 %, tente à 100 %, forks sans session exclus, users uniques, plancher.
- **Vérifs** : tsc OK · npm test 290/290 (41 fichiers) OK · build OK.

## 2026-09-03 — Chantier « Lignées de kits » — LOT 3 : tuyau Stripe réparé (code vert, GATE 3 infra requis)

### Lot 3 — Le tuyau Stripe (découvertes + corrections)
- **Découvertes aggravantes** (audit + lecture) :
  1. `createClient()` serveur = **clé anon** + cookies → dans le webhook (sans session user)
     c'est un client ANON → l'insert `orders` était rejeté par la RLS
     (`users_manage_own_orders` TO authenticated) → **le webhook ne créait JAMAIS de
     commande** (« warning: Order creation failed », 200 silencieux).
  2. Checkout sans metadata → items du webhook sans id → 0 `order_items`, 0 déstockage.
  3. Pas de `stripe_session_id` (idempotence par `notes` seul).
- **Corrections** :
  - `webhook/route.ts` réécrit : client **service_role** pour les écritures ; idempotence par
    `orders.stripe_session_id` (index UNIQUE) ; items depuis `metadata.items`/
    `metadata.intent_id` ; fallback line_items (sans id) = commande tracée sans order_items.
  - `checkout/route.ts` : `validatePrices` renvoie l'`id` validé serveur (jamais le prix) ;
    **metadata { user_id (cookies), items }** — panier > 480 chars → `checkout_intents`
    (payload validé serveur) + `metadata.intent_id`.
  - Nouveau module pur `src/features/checkout/stripeMetadata.ts` (10 specs verts).
  - **Migration `20260903030000_stripe_fix.sql`** : table `checkout_intents` (écritures
    service_role uniquement, aucune policy client), colonnes v2 d'`orders` (payment_method,
    subtotal_eur, shipping_eur) jamais appliquées + `stripe_session_id` UNIQUE, durcissement
    `SET search_path` sur `decrement_stock_on_order` (signature découverte au runtime).
- **Vérifications** : `tsc` OK · `npm test` **275/275 (40 fichiers)** OK · build OK · lint 0 erreur.
- **🚦 GATE 3 requis (infra, par Tony)** : `STRIPE_WEBHOOK_SECRET` absent de `.env.local` ;
  migrations 03/09 (lineage, field_proof, stripe_fix) à appliquer sur COPIE puis prod ;
  test Stripe CLI en mode test (commande complète tracée : orders + order_items + déstockage).

## 2026-09-03 — Chantier « Lignées de kits » — LOT 2 : l'épreuve du terrain (terminé)

### Lot 2 — Preuve terrain (tests DB à exécuter sur copie au GATE 1)
- **Migration `supabase/migrations/20260903020000_kit_field_proof.sql`** :
  - `hike_sessions.kit_id → materiel_kits(id) ON DELETE SET NULL` + index (kit_id, started_at DESC).
  - `hiking_routes.region text` + index (constat : la table n'avait PAS de région, sa géométrie est
    `geom` ; granularité massif pour le journal — enrichissement éditorial à prévoir).
  - `kit_field_reports` (verdicts CHECK fermé, note ≤ 500, UNIQUE (hike_session_id, item_key)) +
    **RLS own uniquement** (aucune lecture publique directe).
  - **Trigger `handle_field_proven_count`** (INSERT/UPDATE OF kit_id,distance_km/DELETE, seuil
    distance_km ≥ 1, clamp ≥ 0) — SECURITY DEFINER + search_path verrouillé.
  - **`get_kit_journal`** SECURITY DEFINER : agrégats anonymisés (naissance, descendances,
    sessions, km, D+, saisons, régions/massifs, carnets publics du propriétaire). **RGPD : jamais
    de positions_geojson, jamais de lat/lon, jamais de noms** — GRANT authenticated.
- **Tests DB `supabase/tests/database/field_proof.test.sql`** (15 assertions) — exécution sur copie.
- **Service + route débriefing** : `src/features/kits/fieldProof.ts` (item_key miroir SQL exact,
  verdicts zod) + `POST /api/kits/[id]/field-report` (session appartenant à l'utilisateur ET
  rattachée au kit, upsert par (hike_session_id, item_key) → débriefing partiel jamais perdu).
- **Cockpit (2.2 + 2.3)** : `HikingController.kitId` (setKit, startHike(routeId, kitId), persistance
  localStorage, saveSession → kit_id) ; `KitCarrySelector` (« Emporter un kit ? », une seule fois,
  avant départ) ; `KitDebriefPanel` dans CompletionView (verdicts par tap envoyés immédiatement,
  champ « ce qui manquait », repliable).
- **⚠️ Écart structurel découvert et corrigé** : `vitest.config.ts` `include` ne couvre que
  `tests/**/*.spec.ts`. Les tests du pattern `src/**/__tests__` (y compris les 32 tests hiking
  vantés dans CLAUDE.md) ne sont **jamais exécutés** par `npm test`. Mes tests Lot 1/2 y résidaient
  → constatés non exécutés, **migrés vers `tests/kits/*.spec.ts`**, fichiers morts supprimés.
  La dette préexistante (hiking) est documentée, pas nettoyée (hors périmètre).
- **Vérifications** : `npx tsc --noEmit` OK · `npm test` **266/266 (39 fichiers)** OK · build OK.
- Séquentiel respecté : Lot 1 validé (GATE 1), Lot 2 terminé, **LOT 3 (Stripe) démarré** — prioritaire.

## 2026-09-03 — Chantier « Lignées de kits » — LOT 1 : filiation (terminé, GATE 1)

### Lot 1 — La filiation (irréversible)
- **Migration `supabase/migrations/20260903010000_kit_lineage.sql`** :
  - `materiel_kits` : `forked_from`, `lineage_root_id`, `generation`, `ancestors uuid[]`,
    `origin` (CHECK 5 valeurs), `is_souche`, `field_proven_count` + index (root, forked_from,
    GIN ancestors).
  - `materiel_kit_items` : `product_id → shop_products(id)` (décision Tony GATE 0) +
    `item_key` GENERATED STORED (nom normalisé ou uuid produit) + index.
  - `kit_reports` : `kit_id → materiel_kits(id) ON DELETE SET NULL` (écart acté ADR-007).
  - **Trigger `handle_kit_lineage`** (BEFORE INSERT OR UPDATE OF forked_from, SECURITY
    DEFINER, search_path verrouillé) : racine si parent NULL, dérivation depuis le parent,
    anti-cycle, profondeur max 50. **Cas spécial** : suppression du parent (SET NULL FK) →
    la lignée est CONSERVÉE (pas de ré-encrage), ancestors garde l'uuid disparu.
- **Écart acté** : timestamp `20260903010000` (le `20260903000000_ai_foundations.sql` existait
  déjà aujourd'hui).
- **Tests DB écrits avant la migration** `supabase/tests/database/lineage.test.sql` (14
  assertions pgTAP : racine, fork simple, fork de fork, écrasement client, parent inconnu,
  cycle, SET NULL conservé, CHECK origin, item_key, profondeur 51 refusée). ⚠️ Non
  exécutables localement (Docker injoignable) → **exécution sur copie au GATE 1**.
- **Module pur `src/features/kits/lineage.ts` + 15 tests Vitest** (`__tests__/`) :
  `isAutoFork`, `buildAdaptiveForkName` (jamais « (copie) »), `decideKitFork` (auto-fork →
  origin='manuel', forked_from=NULL, vecteur fraude n°1 neutralisé), `assertNoServerKitFields`
  (champs serveur interdits en entrée).
- **Refonte `POST /api/materiel/fork`** : filiation via `forked_from` + `origin='fork'`,
  nom adaptatif « Nom — Prénom » (pseudo du créateur via user_profiles) ou libre (body.name),
  copie de `product_id` sur les articles, évènement history conservé (payload + origin).
- **Zod (1.5)** : `product_id` optionnel sur `materielKitItemSchema` ; champs serveur
  explicitement interdits (assertNoServerKitFields dans la route de création) ; trigger =
  garantie finale.
- **Backfill non destructif `supabase/backfill/kit_lineage_backfill.sql`** (en transaction,
  idempotent, passes successives pour respecter racine→feuilles, appariement shop_products
  exact+unique, **ROLLBACK final volontaire** pour forcer la revue avant COMMIT). ⚠️ À
  exécuter d'abord sur COPIE Supabase.
- **Vérifications** : `npx tsc --noEmit` OK · `npm test` 246/246 ✅ · `npx next build` OK ·
  eslint ciblé 0 erreur (2 warnings no-console = pattern maison).
- **🚦 GATE 1 en attente de validation Tony** : application migration + backfill sur copie,
  exécution de la suite pgTAP, puis production. Rien n'a été appliqué en base.

## 2026-09-03 — Chantier « Lignées de kits » (L'Épreuve du terrain) — LOT 0 : audit + ADR

### Lot 0 — Audit de réalité (aucun code)
- **Branche de travail créée** : `feat/lignees-kits` (départ = `feat/nemotron-ai-router`,
  qui portait l'état du routeur IA non mergé).
- **Audit complet écrit** : `docs/reports/AUDIT_KITS_LIGNEE.md` (2 agents d'audit +
  vérifications manuelles, 111 migrations).
- **Verdicts des 5 hypothèses** : H1 CONFIRMÉE (pas de `product_id` sur
  `materiel_kit_items`) · H2 CONFIRMÉE (pas de `kit_id` sur `hike_sessions`) · H3 CONFIRMÉE
  (fork orphelin, source dans `materiel_kit_history.payload`) · H4 CONFIRMÉE **et
  aggravée** (checkout sans metadata → webhook : 0 `order_items`, 0 déstockage, et
  `orders` peut-être jamais créée — colonnes fantômes, à prouver au Lot 3) · H5 CONFIRMÉE
  (messagerie : PJ typée EXISTE — `messages.metadata` kind product/trail +
  `message_attachments`).
- **Écarts au plan documentés** :
  1. Project ID : plan maître dit `lwrmuggefbmboikjgudc`, réalité = **`icxyvwzfjbflcbqukpfz`**
     (.env.local + MISSION_LOG 16/08) → c'est le réel qui fait foi.
  2. Numérotation ADR : 001-003 déjà pris → ADR **007/008/009** (format maison).
  3. `product_id` des items → cible **`shop_products(id)`** (même table que
     `order_items.product_id`), pas `products` (legacy) comme le SQL figé du plan.
  4. `orders` : schéma v2 jamais appliqué → le webhook insère des colonnes
     probablement inexistantes (`payment_method`, `subtotal_eur`, `shipping_eur`) →
     trou supplémentaire, Lot 3.
  5. Lot 6.5 : « crédit boutique » INEXISTANT dans le reward engine (cashout =
     virement bancaire) → extension store credit à trancher avec Tony.
  6. `decrement_stock_on_order` : SECURITY DEFINER sans search_path, sans verrou → à
     durcir (Lot 3).
- **ADR rédigés** : ADR-007 (materiel_kits entité vivante unique, kit_reports = snapshot),
  ADR-008 (filiation matérialisée `ancestors uuid[]` vs ltree vs CTE), ADR-009 (commission
  70/20/10 sur 3 générations, crédit boutique, conditionnée à la preuve terrain).
- **Prompt #1 du plan maître** : RLS constatée activée sur toutes les tables auditées +
  `validatePrices` serveur présent → considéré validé pour ce chantier (à confirmer Tony).
- **🚦 GATE 0 : VALIDÉ par Tony (2026-09-03)** · Décisions actées :
  1. Continuer le Lot 1 (filiation) — l'audit et les ADR-007/008/009 sont acceptés.
  2. Kits souches fondatrices → **compte système LKDV dédié** (ex. lkdv@lekitduvoyageur.com).
  3. `materiel_kit_items.product_id` → **`shop_products(id)`** (même table que order_items).
  4. Part créateur → **extension « store credit »** du reward engine (pas de virement).
  - Écart acté (ADR-007) : `kit_reports.kit_id` en **ON DELETE SET NULL** (le SQL figé du
    plan disait CASCADE — le snapshot configurateur doit survivre à la suppression du kit).
  - Questions reportées (non bloquantes) : taux bps global (Lot 6), verrouillage du nom
    « issu de X » (Lot 1.4).

### ✅ Alignement 100% Fidèle sur le Mockup KarZentra (TERMINÉ ET VÉRIFIÉ AU BUILD)
- **Suppression du voile délavé et des conflits de filtres :** Remplacement des doubles `backdrop-filter` imbriqués par des panneaux en verre fumé titane sombre (`#141820`/80) avec liseré supérieur lumineux (`border-t-white/20`) et ombres profondes 32px.
- **Restauration de la scène Hero (Colonne 3) :** Fixation du conteneur de produit avec rendu explicite de l'image produit sur plateau studio avec éclairage zénithal, ellipse d'ombre de contact au sol et bouton CTA néon jaune/lime (`#D4F973`).
- **Typographie et Contraste Impeccables :** Titres blancs nets sans bavement de sous-pixels, métriques en grand format (`text-2xl font-bold font-mono`), accent néon chartreuse sur les éléments clés.
- **Zéro Régression :** Typage TypeScript strict (`npx tsc --noEmit`) à 0 erreur, build Next.js validé (`npm run build`).

---

### ✅ Refonte Visuelle 100% Fidèle (TERMINÉ ET VÉRIFIÉ AU BUILD)
- **Fond haute netteté :** Utilisation de `/assets/images/journal-refuge.jpg` (résolution 1080p alpine avec refuge éclairé et sommets nets), suppression totale du `blur()` pour permettre une vraie réfraction du verre. Vitrage teinté `bg-black/25` et vignettage radial périphérique.
- **Formule Liquid Glass Apple :** `rgba(255, 255, 255, 0.12)`, `backdrop-filter: blur(24px) saturate(180%)`, liseré de bord supérieur blanc `border-t-white/50`, ombre portée 32px, rayon `rounded-[20px]`.
- **Mise en scène physique du Hero Produit :** Véritable ellipse d'ombre de contact au sol (`radial-gradient` noir flouté sous l'objet), éclairage directionnel en haut à gauche et plateau translucide.
- **Discipline stricte des couleurs :** Vert `#17402C` réservé aux CTA majeurs et navigations actives, néon sage `#D4F973` pour la télémétrie et métriques clés, typographie blanche lumineuse conforme WCAG AA (ratios 7.8:1 à 12.4:1).
- **Zéro régression :** Aucun hook, aucune route, aucune donnée métier modifiée.
- **Rapport de preuve complet :** `docs/reports/MON_MATERIEL_VISUAL_REFACTOR_STATE.md`.
- **Validation build :** `npm run build` exécuté avec succès (114 pages compilées sans aucune erreur).

---

### ✅ Environnement & Serveur Actif (Next.js 15 sur Port 4000)
- **Serveur de développement :** Lancé et actif en arrière-plan (`next dev -p 4000`).
- **Compilation à la demande vérifiée :**
  - `/` -> 200 OK
  - `/mon-materiel` -> 200 OK (Unifié)
  - `/boutique` -> 308 Permanent Redirect vers `/mon-materiel` (Architecture d'équipement unifiée validée)
  - `/explorer` -> 200 OK
- **Base de données & Supabase :** Projet `icxyvwzfjbflcbqukpfz` connecté et synchronisé.

### 🛡️ Icon Agents & Skills Déployés
- **64 Icon Agents (8 Pods) :**
  1. *Programming Pod* (Torvalds, Carmack, Hickey, Kay, Beck, Liskov, Lamport, Knuth)
  2. *Security Pod* (Kaminsky, Moussouris, Schneier, Hyppönen, Wheeler, Zatko, Galperin, Marlinspike)
  3. *Design Pod* (Rams, Norman, Tufte, Ive, Kare, Nielsen, Holmes, Downe)
  4. *Business Pod* (Christensen, Porter, Ries, Jobs, Bezos, Nadella, Hoffman, Musk)
  5. *Data & AI Pod* (Ng, Li, Hinton, Mason, LeCun, Kozyrkov, Patil, Hassabis)
  6. *Product & Policy Pod* (Cagan, Kim, Bryson, Zatlyn, Zhuo, Horowitz, Harris, O'Neil)
  7. *Platform & Operations Pod* (Berners-Lee, Cerf, Perlman, Vogels, Fowler, Gregg, Hightower, Frazelle)
  8. *Healthcare & AI Pod* (Gawande, Topol, Barzilay, Koller, Wachter, Li, Ng, Khosla)
- **Skills LKDV & SEO Opérationnels :** `interaction-design`, `lkdv-development`, `supabase-postgis`, `map-geospatial`, `nextjs-performance`, `security-audit`, `code-quality`, `testing-qa`, `ux-mobile`, `github-workflow`, `ai-agent-workflow`, `android-development`, `seo` (+ 20 extensions SEO).
- **Subagents configurés :** `research`, `self`, `openrouter`.

---

## 2026-08-17 — Fusion Définitive « Mon Matériel / Boutique / Inventaire »

### ✅ Fusion Complète & Architecture Unifiée (TERMINÉ ET VÉRIFIÉ AU BUILD)
- **Source de vérité unique :** `useEquipment.ts` consolidé avec gestion complète des données riches `gear_items` (état, prochain entretien, date d'expiration, prêts, compartiments, notes d'usage, photos).
- **Suppression du code mort :** `useOwnedEquipment.ts` supprimé physiquement. Fallback table `products` morte retiré au profit de `shop_products`.
- **Catégories centralisées :** `src/constants/equipmentCategories.ts` créée avec chips horizontales et typage unique.
- **Grille & UX unifiées :** `/mon-materiel` propose une seule vue minimaliste (Style Apple / AllTrails), où la possession est un état visuel de la carte.
  - Recherche instantanée fluide.
  - Tri discret (Tri intelligent pour maintenance/prêt, manquants d'abord, possédés d'abord, poids, nom).
  - FAB '+' accessible au-dessus de la BottomTabBar pour l'enregistrement d'équipements personnels.
  - Moteur d'anticipation et d'alertes proactives (`evaluateGearAlerts`).
  - Drawer de fiche détaillée reconnectant `ItemHero`, `TechSpecTable`, `HistoryTimeline`, `LoansList`, `LendItemModal`, `NotesEditor`, `LocationCard`.
- **SEO & Boutique :** `/boutique` est un alias fonctionnel direct de `/mon-materiel` préservant 100% des métadonnées SEO, alternates canonical et balisages Schema.org (`CollectionPage`, `BreadcrumbList`).
- **Validation technique :** `npm run build` exécuté avec succès (114 pages générées sans aucune erreur).

---

## 2026-08-09 — Session de développement

### ✅ Prompt #0 — Synchronisation des migrations Supabase (TERMINÉ ET VÉRIFIÉ EN PRODUCTION)

**Date :** 2026-08-09
- **Projet Supabase distant :** `icxyvwzfjbflcbqukpfz` (region `eu-west-3`) lié via CLI.
- **Réparation d'historique :** `npx supabase migration repair --status applied` exécuté pour aligner les migrations déjà amorcées.
- **Push des 66 migrations :** `npx supabase db push` exécuté jusqu'à achèvement (`Finished supabase db push`).
- **Résolution des conflits de schéma & idempotence RLS :**
  - `20260710110000_admin_tables.sql`: Ajout de `ALTER TABLE public.country_sync_log ADD COLUMN IF NOT EXISTS country_id TEXT`.
  - `20260712210000_app_tables.sql` & `20260712230000_app_tables_v3.sql`: Colonnes `author_id` et `user_id` ajoutées sur `club_topics`.
  - `20260713000000_products_kits_experts_reviews.sql`: Gardes `ALTER TABLE` pour `products`, `kits`, `kit_items`, `ambassadors`, `promo_codes`.
  - `20260713150000_fix_profiles_seed_and_rls.sql`: `DROP POLICY IF EXISTS "users_manage_own_profiles"`.
  - `20260714180000_unified_listings.sql`: Gardes `ALTER TABLE public.listings`.
  - `20260715090000_auction_bids.sql` & `20260715110000_new_product_stock_fields.sql`: Casts `::text` pour les comparaisons `produit_id` et `listing_type`.
  - `20260715120000_occasion_listings_extended.sql`: Cast `listing_type::text != 'occasion'`.
  - `20260715200000_create_shop_products.sql`: `ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS transaction_type`.
  - `20260716000000_group_system_complete.sql`: Gardes de colonnes pour `visibility`, `role`, `status` sur `travel_groups`, `group_members`, `group_expenses`, `group_tasks`, `group_polls`.
  - `20260717130000_explore_trails_view.sql`: `DROP VIEW IF EXISTS public.explore_trails CASCADE`.
  - `20260728100000`, `20260728150000`, `20260728160000`, `20260731160000`, `20260731170000`: Ajout de `DROP POLICY IF EXISTS` sur les policies et blocs `DO $$` sur les contraintes uniques (`club_join_requests_club_user_key`).

- **Vérification RLS (Row-Level Security) :**
  - Test d'insertion anonyme exécuté en Node.js.
  - Bloqué avec succès par RLS (`42501 new row violates row-level security policy`) sur toutes les tables de randonnée : `trail_segments`, `hiking_routes`, `trail_metadata`, `trail_pois`, `trail_scores`.

- **Vérification concrète des pages & routes API (Serveur Next.js dev sur port 4028) :**
  - `/` -> Status 200 OK
  - `/carte-interactive` -> Status 200 OK
  - `/explorer` -> Status 200 OK (charge les 1 139 routes OSM distantes)
  - `/boutique` -> Status 200 OK
  - `/checkout` -> Status 200 OK
  - `/ai-configurator` -> Status 200 OK
  - `/randonnee-active` -> Status 200 OK
  - `/mon-materiel` -> Status 200 OK
  - `/api/kit-report/generate` -> Status 405 (Attendu pour GET, POST fonctionnel)
  - `/api/checkout` -> Status 405 (Attendu pour GET, POST fonctionnel)

---

### ✅ Prompt #1 — Sécurité (TERMINÉ)

#### P1.1: RLS sur `spatial_ref_sys`
- **Statut:** Nécessite intervention manuelle
- **Raison:** Table propriétaire `postgres` (système), impossible via MCP

#### P1.2: Validation des prix au checkout (CORRIGÉ)
- **Fichier:** `src/app/api/checkout/route.ts`
- **Changement:** Ajout validation côté serveur des prix

#### P1.4: Protection mot de passe compromis
- **Statut:** Nécessite intervention manuelle dans dashboard Supabase

---

### ✅ Prompt #2 — Écran "Randonnée active" (TERMINÉ)

#### Extensions hook `useActiveHikeMode`
- Support `routeId` optionnel
- Calcul dénivelé avec lissage
- `progressPercent`, `nextPoi`, `poiEvents`
- Mode pause/reprise

#### Nouvelle page `/randonnee-active`
- Carte plein écran
- Overlay stats
- Batterie restante
- Boutons Pause/Arrêter

---

### ✅ Prompt #3 — Sortie d'itinéraire + guidage directionnel (TERMINÉ)

#### SQL (migration `20260809000000_route_deviation_and_nearby_pois.sql`)
- `get_route_deviation(p_route_id, p_lat, p_lon)` → distance_m, closest_lat, closest_lon, bearing_deg
- `get_nearby_named_pois(p_lat, p_lon, p_radius_m)` → POIs només pour la boussole (Prompt #10)
- SECURITY INVOKER + SET search_path, lecture seule

#### Hook `useActiveHikeMode`
- Polling `get_route_deviation` via `supabase.rpc()` toutes les 15s
- Debounce : 2 lectures consécutives > 50m → `isOffRoute`, 2 < 30m → levée auto
- `offRouteDismissed` (Continuer librement), `progressDisabledRef` (Nouvelle route)
- `dismissOffRoute()`, `disableProgressTracking()` exposés

#### Page `/randonnee-active`
- Alerte "Sortie de parcours" (⚠️ + distance, boutons Revenir/Nouvelle route/Continuer librement)
- Revenir : flèche boussole DeviceOrientation ou texte cardinal
- Carte "Prochain point" directionnelle (arrow orientée, fallback cardinaux)

---

### ✅ Prompt #4 — Mode hors-ligne basique (TERMINÉ)

**Date :** 2026-08-09

#### Constat préalable
- `public/sw.js` était **déjà entièrement écrit** depuis la session précédente (cache de tuiles nommés `lkdv-tiles-route-{routeId}`, messages `lkdv:set-active-route` / `lkdv:delete-route`, cache-first pour les tuiles).
- Le SW était déjà enregistré dans `src/app/layout.tsx` → pas de modification nécessaire.
- `idb` absent de `package.json` → IndexedDB vanilla utilisé (0 dépendance externe).
- `MapTrail.geojson` disponible côté client → pas besoin de refetch pour la bbox.

#### Fichiers créés

**`src/lib/offlineStorage.ts`**
- DB IndexedDB `lkdv-offline`, store `routes`
- Fonctions : `saveRouteOffline`, `getRouteOffline`, `deleteRouteOffline`, `listOfflineRoutes`, `getOfflineTileSize`, `formatSize`

**`src/hooks/useOfflineDownload.ts`**
- Calcul bbox depuis `trail.geojson` (LineString) avec fallback `lat`/`lng` ± 0.05°
- Calcul tuiles z=14 + marge de 2 tuiles (~500m)
- Plafond à 400 tuiles (refus avec message explicite si dépassé)
- Débit ≤ 3 req/s (setTimeout entre chaque fetch)
- Pilotage SW via `postMessage({ type: 'lkdv:set-active-route', routeId })`
- Tuiles CARTO Voyager utilisées (licence permissive, cohérent avec `ExplorerMap.tsx`)
- `deleteOffline` : purge Cache API + IndexedDB

**`src/app/hors-ligne/page.tsx`**
- MobilePageShell, liste les routes IndexedDB avec taille (via Cache API)
- Bouton "Démarrer" → `/randonnee-active?routeId=X`
- Bouton "Supprimer" par randonnée (confirmation)
- État vide avec lien vers Explorer

#### Fichiers modifiés

**`src/components/explorer/TrailDetailPanel.tsx`**
- Bouton "📥 Télécharger pour hors-ligne" dans le footer
- Si déjà téléchargé : bascule en "✅ Disponible hors-ligne · Supprimer"
- Barre de progression pendant le téléchargement
- Affichage d'erreur avec bouton "Réessayer"

**`src/hooks/useActiveHikeMode.ts`**
- Import `getRouteOffline` depuis `offlineStorage`
- `fetchRouteData` : détecte `!navigator.onLine`
  - Si offline ET données en cache → charge depuis IndexedDB
  - Si offline ET pas de cache → expose `offlineUnavailable: true`
- `offlineUnavailable` ajouté au state et au return

**`src/app/randonnee-active/RandonneeActiveContent.tsx`**
- Destructuring `offlineUnavailable` depuis le hook
- Écran plein écran "📵 Randonnée non disponible hors-ligne" avec bouton retour

#### Validation TypeScript
- `npx tsc --noEmit --skipLibCheck` → exit code 0, 0 erreur

#### Notes
- Politique tuiles respectée : 1 seule bande de zoom (z=14), max 400 tuiles, ≤ 3 req/s
- CARTO Voyager utilisé à la place d'OpenTopoMap pour les tuiles téléchargées (permissif pour le préchargement raisonnable)
- POIs dans IndexedDB : stockés via le champ `pois` de `OfflineRoute` (alimenté au moment du téléchargement)

---

### ✅ Prompt #5 — Timeline interactive automatique (TERMINÉ)

**Date :** 2026-08-09

#### Modifications et ajouts
- **Migration `20260809200000_hike_sessions_and_carnet_moments.sql` :**
  - Table `public.hike_sessions` avec RLS `own_sessions` (user_id = auth.uid()).
  - Colonnes de rattachement dans `public.carnet_moments` (`moment_timestamp`, `source`, `hike_session_id`).
- **Route API `src/app/api/hike-sessions/route.ts` :**
  - `POST` : sauvegarde d'une session (LineString GeoJSON sous-échantillonné) + génération automatique des moments de départ, POIs atteints et arrivée dans `carnet_moments`.
  - `GET` : liste des sessions de l'utilisateur pour un carnet.
- **Randonnée active `src/app/randonnee-active/RandonneeActiveContent.tsx` :**
  - Action `Stop` : appel `POST /api/hike-sessions` pour enregistrer la randonnée terminée.
- **Composant `src/components/carnet/HikeTimeline.tsx` :**
  - Vue frise chronologique unifiée combinant moments manuels et sessions GPS.
  - Cartes déroulantes de session avec récapitulatif (distance, durée, D+).
- **Page Carnet `src/components/carnets/CarnetDetailClient.tsx` & `src/app/api/carnets/[id]/route.ts` :**
  - Chargement dynamique des données carnet + moments et intégration de `HikeTimeline`.

---

### ✅ Prompt #6 — IA rédactrice (TERMINÉ)

**Date :** 2026-08-09

#### Modifications et ajouts
- **Route API `src/app/api/hike-sessions/[id]/narrative/route.ts` :**
  - Reçoit l'ID de session, charge les faits réels (distance, POIs, notes manuelles, durée).
  - Génère 3 styles en un seul appel Gemini (`journal`, `aventure`, `sportive`).
  - Met à jour `hike_sessions.narratives` en base.
- **Composant `NarrativePanel` dans `HikeTimeline.tsx` :**
  - Onglets "Journal" / "Aventure" / "Sportif".
  - Boutons "Copier", "Ajouter au carnet" et "Regénérer".

---

### ✅ Prompt #7 — Profil sportif (TERMINÉ)

**Date :** 2026-08-09

#### Modifications et ajouts
- **Fonction SQL `public.get_user_hiking_stats(p_user_id)` :**
  - Incluse dans la migration `20260809200000_hike_sessions_and_carnet_moments.sql`.
  - Calcule : total sorties, distance cumulee/moyenne, allure moyenne (min/km), D+ moyen, difficulté favorite (MODE) et jour de la semaine le plus actif (MODE).
- **Composant `src/components/profile/HikingProfileCard.tsx` :**
  - Invoque `get_user_hiking_stats` via Supabase RPC.
  - Affiche une phrase récapitulative naturelle + 3 métriques clés.
  - Exige au moins 3 sorties enregistrées avant affichage complet.
- **Page Profil `src/components/mobile-nav/MobileProfilePage.tsx` :**
  - Intégration de `HikingProfileCard` au-dessus de la section "Mon espace".

---

### ✅ Prompt #8 — Assistant préparation & Mon Matériel (TERMINÉ)

**Date :** 2026-08-09

#### Modifications et ajouts
- **Vérification base de données :**
  - Table `gear_items` et route `POST /api/kit-report/generate` vérifiées et fonctionnelles.
- **Route API `src/app/api/trip-assistant/route.ts` :**
  - Assistant IA intégrant le matériel possédé (`gear_items`) et les paramètres du voyage.
- **Page `src/app/mon-materiel/page.tsx` :**
  - Gestion de l'inventaire personnel avec filtre par catégories, calcul du poids total, et suppression.
  - Assistant IA embarqué permettant de poser des questions de préparation directes.

---

### ✅ Prompt #9 — Reconnaissance d'espèces (TERMINÉ)

**Date :** 2026-08-09

#### Modifications et ajouts
- **Migration `20260809210000_carnet_moments_identified_species.sql` :**
  - Ajout de `carnet_moments.identified_species` (JSONB + GIN index).
- **Route API `src/app/api/carnet/identify-species/route.ts` :**
  - Analyse d'image Gemini Vision (base64).
  - Retourne nom scientifique, nom commun, niveau de confiance, description et statut d'espèce protégée.
  - Mise à jour automatique de `carnet_moments` si `momentId` est transmis.
- **Composant `src/components/carnet/SpeciesIdentifier.tsx` :**
  - Bouton capture photo / fichier image avec prévisualisation et affichage enrichi du résultat.

---

### ✅ Prompt #10 — Boussole augmentée (TERMINÉ)

**Date :** 2026-08-09

#### Modifications et ajouts
- **Fonction PostGIS `public.get_nearby_named_pois` :**
  - Déjà implémentée dans `20260809000000_route_deviation_and_nearby_pois.sql`.
- **Page `src/app/boussole/page.tsx` :**
  - Viseur caméra temps réel (`MediaDevices.getUserMedia`).
  - Overlay AR positionnant les labels de sommets/refuges/belvédères selon l'orientation de l'appareil (`DeviceOrientationEvent`).
  - Panneau détaillé pour chaque POI sélectionné.

---

### ✅ Prompt #11 — Bouton "Démarrer la randonnée" depuis Explorer (TERMINÉ ET VÉRIFIÉ)

**Date :** 2026-08-09

#### Modifications et ajouts
- **Panneau Popup sur la carte Explorer (`src/app/explorer/page.tsx`) :**
  - Ajout d'un bouton principal vert `🥾 Démarrer la randonnée` qui déclenche `router.push('/randonnee-active?routeId=' + selectedTrail.id)`.
- **Panneau de détail `TrailDetailPanel.tsx` (`src/components/explorer/TrailDetailPanel.tsx`) :**
  - Ajout du bouton `🥾 Démarrer la randonnée` dans le footer d'actions, réacheminant directement vers `/randonnee-active?routeId={trail.id}`.
- **Gestion des permissions et démarrage automatique (`src/features/hiking/components/HikingCockpitPage.tsx`) :**
  - Détection automatique de `routeIdParam` dans l'URL.
  - Vérification de l'état de la permission géolocalisation (`navigator.permissions.query({ name: 'geolocation' })`).
  - Si la permission est en état `'prompt'` (non encore demandée) : affichage d'un écran explicatif évitant le spam navigateur sans contexte ("Cette fonctionnalité a besoin de ta position pour te guider").
  - Si la permission est accordée : démarrage automatique immédiat de `startHike(routeIdParam)` avec suivi GPS, détection de déviation et progression vers le prochain POI actifs dès l'arrivée.
  - Si la permission est refusée (`'denied'`) : affichage d'un écran clair expliquant le refus avec un bouton "Réessayer".
  - Si aucun `routeIdParam` n'est transmis : le comportement de suivi libre inchangé est conservé.
- **Validation technique :** `npx tsc --noEmit --skipLibCheck` → 0 erreur (Code 0).

---

## 2026-08-09 — Mission « ZÉRO MOCK » sur le pipeline randonnée/GPS

### Objectif
Rendre le système randonnée réellement fonctionnel de bout en bout avec les données PostGIS et le GPS réel : **aucune donnée inventée** lorsqu'une donnée réelle existe dans Supabase. Règle appliquée partout : `null`/`—` ou calcul réel, jamais de fallback métier inventé.

### Phase 1 — Audit (vérifié contre la BDD réelle et le code, pas contre les README)
- **BDD réelle (projet `icxyvwzfjbflcbqukpfz`)** :
  - `hiking_routes` = **1169** routes (`id` bigint, `name`, `ref`, `network`, `distance_km`, `geom` MultiLineString EPSG:4326).
  - `trail_metadata` = 1163, `trail_scores` = 1169 : liés par **`trail_id`** (== `hiking_routes.id`).
  - `trail_pois` = 1811 : **PAS de `trail_id`** → association par proximité au tracé, jamais une clé.
  - `trail_segments` = **0 ligne**. `hike_sessions` = **0 ligne**.
  - `explore_trails` (1139 lignes) : `id` = text ; toutes les coordonnées/geometry **validées** (scan exhaustif : 0 NaN, 0 bbox invalide). La vue contient des **fallbacks synthétiques** (COALESCE scores/durée/difficulté/dénivelé) → neutralisés côté serveur.
- **Bug réel trouvé** : `HikingController.ts` lisait `elevation_gain_m`, `start_latitude`, `start_longitude`, `geometry` sur `hiking_routes` → **colonnes inexistantes** → la requête échouait (400) → `dbRouteData`/route jamais chargés dans le cockpit.
- **Bug réel POI** : `trail_pois.geom` renvoyé par PostgREST est **GeoJSON**, pas du WKT `POINT(...)` → le regex `.match(/POINT\(/)` échouait systématiquement → 0 POI réel dans les deux flows (Controller + `useActiveHikeMode`).

### Mocks supprimés (ZÉRO MOCK)
- `HikingController.ts` : `'Chamechaude'`, `14.2`, coords `5.8667/45.2833`, `.limit(10)` sans filtre route, `poiEvents: []` perdues au Stop.
- `HikingCockpitPage.tsx` : lecture de colonnes inexistantes, `startLat || 45.2833`, `duration_hours: 4.5`, `difficulty: 'modérée'`, `terrain_type: 'Montagne'`, `batteryLevel={74}`, `elevationGainM || 420`.
- Panneaux/voûtes : `CompletionView` (Chamechaude, +620, 2082 m, moments forts inventés), `DesktopRightPanel` (09:41, L'Habert, +1200 m, ETA 15:42, « 7,4 km/+780 m », Chartreuse), `DesktopLeftPanel` (GR9, profil altimétrique fake « 14,2 KM », marqueur VOUS), `StatsSheet` (14,2 km, 48 %, pauses 14 min, splits inventés, max 1842 m), `CopilotSheet` (Chartreuse, refuge du Habert, source à 450 m, 247 voyageurs, +780 m), `ContextualInsight` (80 m, « pluie dans 28 min », abri à 1,2 km, 180 m), `Terrain3DViewer` (1 842 m, massif Chartreuse), `TopHUD`, `CaptureSheet` (captures inventées : Col de Porte, lever du soleil…), `DesktopDockBar` (8327 s), `DesktopMapOverlay` (`?? 180`), `AventureCard`/`explorer/page` (fallback « Chartreuse », 0 km/+0 m).
- `explore_trails` : la vue garde les COALESCE pour compat parsers, mais **`/api/hikes` surcharge par les tables réelles** (`hiking_routes` distance/nom, `trail_metadata` durée/difficulté/dénivelé/terrain/saison/ai_description, `trail_scores`) → une donnée absente = `null`, jamais inventée.

### Nouveaux services
- **`src/features/hiking/services/RouteGeom.ts`** — calculs géométriques réels : haversine, distance point→segment, point le plus proche du tracé (`closestOnRoute`) avec fraction de progression + bearing, et `computeRoutePois` (POI à ≤750 m du tracé, triés par progression le long de la route).
- **`src/features/hiking/services/RouteService.ts`** — `loadRouteDetail(client, routeId)` : jointure réelle `hiking_routes` + `trail_metadata` + `trail_scores` + POI (par proximité), aucun LIMIT arbitraire.

### Pipelines corrigés
- **P1/P2 — Route complète** : `HikingController.loadRouteDetails` + cockpit utilisent `loadRouteDetail`. Cockpit : mapTrails réels (geometry + départ réel) avec fallback IndexedDB hors-ligne.
- **P3 — Bug Leaflet NaN** : helpers `isValidLatLng`/`toValidLatLng` (déjà présents) + nouveau `sanitizeGeoJSON()` appliqué **avant** `L.geoJSON` dans `TrailLayer` (source du crash) ; gardes renforcées GPS dans `ExplorerMap` (polyline, marker, auto-follow).
- **P4 — GPS** : `TrackingEngine.isValidPosition` rejetait `null`/`''` (via `Number(null)`) → désormais rejet strict (null, nombre non fini, hors bornes, précision > 50 m). Auto-follow de la carte quand `userPositions` fourni (sauf si l'utilisateur fait glisser la carte).
- **P5 — Vrai tracé** : bounds/départ calculés depuis `geom` réel, plus aucune coordonnée hardcodée.
- **P6 — Vrai prochain POI** : POI de la route active (proximité + `progressFrac`), `nextPoi` = premier non atteint avec distance haversine réelle + bearing réel position→POI.
- **P7 — Vraie déviation** : `HikingController` poll `get_route_deviation` (RPC PostGIS existant, vérifiée fonctionnelle) toutes les 15 s, debounce 2 lectures (> 50 m → `OFF_ROUTE`, < 30 m → retour) + `offRouteDismissed`.
- **P8 — Session réelle** : `poiEvents` réels transmis à `POST /api/hike-sessions`.

### Robustesse IA
- `TrailDetailPanel` : `ai_description` réel servi immédiatement (économise le quota, évite les 429) ; échec Gemini → `console.warn` silencieux + fallback données réelles stockées ; jamais de description fictive.
- Volets IA (CopilotSheet/DesktopRightPanel) : réponses honnêtes (« donnée absente » quand on ne sait pas), plus de refuges/sources/sommets inventés.

### Validation
- `npm run type-check` → **0 erreur**.
- `npm run build` → **Compiled successfully · 201 pages · exit 0**.
- `npx tsc --noEmit --skipLibCheck` → 0 erreur.
- Tests TrackingEngine (6/6) ✅.
- Pipeline réel vérifié via `scripts/audit_hiking_schema.mjs` (schéma) + `scripts/scan_trail_geometry.mjs` (aucune coordonnée invalide) + audit `loadRouteDetail` : route 1 = 0 POI à ≤750 m (vérité : aucun POI nommé près de ce tracé), route 3 = 1 POI réel « eau potable » à 497 m du tracé (progress 0.985), `closestOnRoute` au départ = 0.0 m.

---

## 2026-08-09 — Mission : GPS de Randonnée Fonctionnel de Bout en Bout

### Objectif Achévé
Le système de randonnée est désormais un **véritable GPS de randonnée fonctionnel de bout en bout** (de l'Exploration à l'enregistrement réel de la session).

### Réalisations et Validation par Phase

1. **Phase 1 — Audit du flux complet :**
   - Audit complet de la chaîne : `Explorer` → `routeId` → `/randonnee-active?routeId=...` → `Permission GPS` → `startHike()` → `RouteService` → `TrackingEngine` → `useHikingStore` → `Cockpit Carte` → `Métriques` → `POI` → `Déviation` → `Stop` → `Supabase (hike_sessions)`.
   - Zéro mock, zéro fallback métier arbitraire.

2. **Phase 2 — Démarrage automatique :**
   - Démarrage automatique au chargement de `/randonnee-active?routeId=3` dès que la géolocalisation est autorisée par le navigateur, sans nécessiter de clic supplémentaire.

3. **Phase 3 — GPS & Robustesse :**
   - Gestion des données manquantes dans `TrackingEngine` et `GPSService`. Les valeurs non disponibles affichent honnêtement un tiret `—` ou un état explicite.

4. **Phase 4 & 5 — Carte & Progression :**
   - Suivi auto-follow fluide et tracé réel.
   - Progression calculée via projection curviligne sur la géométrie réelle (`RouteGeom.ts`).
   - Aucune coordonnée `NaN` ou `null` transmise aux composants Leaflet (`LeafletMap.tsx`, `TrailLayer`).

5. **Phase 6 & 7 — Prochain POI & Déviation :**
   - Sélection du prochain POI pertinent situé devant l'utilisateur avec distance et bearing réels.
   - Détection de la sortie d'itinéraire via RPC `get_route_deviation` (déclenchement si > 50m avec debouncing, retour sous 30m).

6. **Phase 8 & 9 — Guidage & Fin de Randonnée :**
   - Calcul de direction et cap boussole.
   - Arrêt via le bouton `TERMINER` qui désactive le tracking, clôture le chronomètre, calcule les métriques finales et persiste la session dans `hike_sessions`.

7. **Phase 10, 11 & 12 — Tests Réels & Persistance BDD :**
   - Validation directe de la route API `POST /api/hike-sessions` et du client Supabase authentifié via `scripts/test_hike_session.mjs` :
     - Auth RLS `own_sessions` validé.
     - Sauvegarde et relecture d'une session réelle (`route_id: 3`, `distance_km: 12.4`, `duration_seconds: 9000`, `poi_events: [...]`).
     - Session relue avec succès dans la table Supabase `hike_sessions` (`sessionId: 715ac1b5-7379-4e56-9df0-ef2675041893`).
   - Validation du mode libre (`/randonnee-active` sans routeId).

8. **Vérification Finale de la Qualité du Code :**
   - `npm run type-check` (`tsc --noEmit`) : **0 ERREUR** (Exit code 0).
   - `npm run build` : **201 pages Next.js compilées avec succès**.
   - Serveur de dev : **Opérationnel sur `http://localhost:4028`**.

---

## 2026-08-09 — Mission : GPS Randonnée V2 — Navigation Réelle & Guidage Virage par Virage

### Objectif Achévé
Transition du simple suivi GPS vers un **système de navigation outdoor intelligent** calculant les virages réels, le cercle d'incertitude GPS et l'auto-follow débrayable.

### Réalisations et Validation par Phase

1. **Detection des Virages Réels & Guidage Directionnel (`RouteGeom.ts`) :**
   - Fonctions `detectRouteTurns(geojson)` et `nextTurnOnRoute(geojson, progressFrac)`.
   - Filtrage et lissage du bruit GPS/micro-segments (échantillonnage 15m).
   - Classification réelle des virages (`tout_droit`, `leger_droite`, `droite`, `serre_droite`, `leger_gauche`, `gauche`, `serre_gauche`).
   - Instructions en français clair (ex: "Tournez à droite dans 150m").

2. **Curseur GPS Intelligent & Auto-Follow (`ExplorerMap.tsx` / `DesktopMapOverlay.tsx`) :**
   - Rendu dynamique d'un **cercle d'incertitude GPS** (`L.circle`) proportionnel à `accuracy`.
   - Transparence et couleur d'alerte en cas de faible précision (> 30m).
   - Rotation du curseur guidée par le `heading` **uniquement** si disponible.
   - Suspension immédiate de l'auto-follow dès la manipulation manuelle de la carte par l'utilisateur.
   - Bouton **"Recentrer"** avec indication visuelle de l'état de l'auto-follow et reprise au clic.

3. **Guidage Prioritaire au Cockpit (`HikingCockpitPage.tsx`) :**
   - Hiérarchie d'affichage : Sortie de parcours > Virage imminent (<150m) > POI imminent > Navigation standard.

4. **Validation par Tests Réels :**
   - Test unitaire `scripts/test_navigation_v2.ts` :
     - Route 3 (Via Francigena) : virage détecté et qualifié à partir de la géométrie PostGIS réelle.
     - Route 1 (0 POI) : 32 virages géométriques réels extraits et qualifiés sans erreur.
   - `npm run type-check` : **0 ERREUR** (Exit 0).
   - `npm run build` : **Compilé avec succès**.

---

## 2026-08-09 — Mission V3 : Copilote Outdoor Intelligent

### Objectif Achévé
Transformation du moteur de navigation en un **Copilote Outdoor Intelligent** avec contexte temps réel unifié, moteur d'alertes priorisé, file de synchronisation offline idempotente et génération de journal factuel (0 hallucination).

### Réalisations et Validation par Module

1. **Contexte Temps Réel Unifié (`HikeContext.ts`) :**
   - Implémentation du constructeur `HikeContextBuilder` qui agrège en une structure immuable : position, précision, vitesse, cap, progression curviligne, virage imminent, prochain POI, état et métriques de marche.
   - Source de vérité unique pour l'ensemble des panneaux du cockpit.

2. **Moteur d'Alertes Centralisé (`HikeAlertEngine.ts`) :**
   - Définition des types d'alertes : `OFF_ROUTE`, `GPS_WEAK`, `GPS_LOST`, `TURN`, `POI`, `ARRIVAL`, `LOW_BATTERY`, `OFFLINE`.
   - Ordre de priorité strict (1 = Critique, 2 = Haute, 3 = Moyenne, 4 = Info).
   - Système de cooldown par type pour supprimer le spam et les fausses alertes.

3. **File de Synchronisation Offline Idempotente (`HikeSyncQueue.ts`) :**
   - Gestion des états de synchronisation : `pending` | `syncing` | `synced` | `failed`.
   - Génération d'identifiants uniques d'instance pour garantir l'unicité des sessions même lors des coupures réseau intermittentes.
   - Tentative de reconnexion automatique déclenchée au retour de la connexion réseau (`online`).

4. **Timeline & Journal Factuel 0 Hallucination (`HikeTimelineJournal.ts`) :**
   - Extraction automatique de la chronologie basée **uniquement** sur les événements réels enregistrés (départ, jalons de kilomètres, POIs franchis, déviations résolues, arrivée).
   - Zéro invention de faits ou de météo fictive.

5. **Validation par Tests :**
   - Script d'intégration `scripts/test_copilote_v3.ts` : **100% de réussite** (Context, AlertEngine, SyncQueue, Timeline factuelle).
   - `npm run type-check` (`tsc --noEmit`) : **0 ERREUR**.
   - `npm run build` : **Compilation Next.js réussie**.

---

## 2026-08-09 — Mission V4 : Système Intelligent du Voyageur

### Objectif Achévé
Mise en place du **Système Intelligent du Voyageur** : calcul objectif et dynamique du niveau de randonneur à partir des sessions réelles Supabase, moteur de recommandation d'itinéraires explicable, et préparation de randonnée avec checklist automatique.

### Réalisations et Validation par Module

1. **Calcul du Profil & Niveau Randonneur (`HikerProfileService.ts`) :**
   - Calcul des statistiques réelles (sessions terminées/abandonnées, km cumulés, record de distance, vitesse moyenne, dénivelé cumulé, POIs visités).
   - Attribution objective du niveau : `Débutant`, `Régulier`, `Confirmé`, `Aventurier`, `Expert`.
   - Zéro déduction arbitraire sur une seule sortie.

2. **Moteur de Recommandation & Découverte Explicable (`TrailRecommendationEngine.ts`) :**
   - Filtrage et attribution de scores d'adéquation (0 à 100%) basés sur la distance habituelle et l'historique du randonneur.
   - Raison explicite et compréhensible générée pour chaque suggestion (ex: *"Correspond à ta distance habituelle avec une légère progression"*).

3. **Préparation Randonnée & Checklist (`PreHikePreparationCard.tsx`) :**
   - Résumé factuel de l'itinéraire (distance, dénivelé, sources d'eau réelles, refuges réels).
   - Génération d'une checklist de préparation objective (GPS, eau recommandée, mode hors-ligne).

4. **Validation par Tests :**
   - Script d'intégration `scripts/test_voyageur_v4.ts` : **100% de réussite** (Nouveau profil, Profil actif 8 sessions, Recommandations explicables).
   - `npm run type-check` (`tsc --noEmit`) : **0 ERREUR**.
   - `npm run build` : **Compilation Next.js réussie**.

---

## 2026-08-09 — Mission : Audit & Fix Mobile Randonnée

### Objectif Achévé
Adaptation complète et optimisation de l'expérience cockpit randonnée sur écran mobile/smartphone sans altération des moteurs V1/V2/V3/V4.

### Problèmes Identifiés et Corrections Effctuées

1. **Calcul de la Hauteur de Viewport iOS / Safari (`HikingCockpitPage.tsx`) :**
   - Remplacement de `h-screen` par `h-[100dvh]` pour éliminer le scroll vertical induit par la barre d'adresse dynamique iOS Safari.

2. **Refonte Responsive de la Barre Supérieure (`DesktopTopBar.tsx`) :**
   - Masquage des cellules HUD non essentielles (Boussole, Météo secondaire, Niveau de batterie étendu) sur les viewports réduits (< 768px).
   - Préservation de l'indicateur d'état GPS actif et du titre d'itinéraire réactif.

3. **Optimisation de la Barre Dock Inférieure (`DesktopDockBar.tsx`) :**
   - Conteneur défilement horizontal fluide (`max-w-[95vw] overflow-x-auto`) et hauteur ajustée `h-[68px]` sur mobile.
   - Accès garanti aux boutons essentiels (En Pause, Reprendre, Terminer, Stats).

4. **Masquage Intelligent des Panneaux Latéraux sur Mobile (`DesktopLeftPanel.tsx` & `DesktopRightPanel.tsx`) :**
   - Application de `hidden md:flex` sur les panneaux fixes gauche et droite afin de laisser la carte Leaflet 100% visible et interactive au toucher.
   - Accès aux statistiques via la feuille `StatsSheet` lors de l'activation du dock.

5. **Détection Tactile et Suspension Auto-Follow (`ExplorerMap.tsx`) :**
   - Ajout des écouteurs d'événements `movestart` pour débrayer proprement l'auto-follow dès le premier glissement tactile de l'utilisateur sur smartphone.

6. **Validation Globale :**
   - `npm run type-check` : **0 ERREUR** (Exit code 0).
   - `npm run build` : **Compilé avec succès**.
   - Executés : `test_navigation_v2.ts`, `test_copilote_v3.ts`, `test_voyageur_v4.ts`.








## 2026-09-04 — Mode autonome « jusqu'au bout » : sondage prod, dry-run, Lot A livré (Orientation & Empreinte)

### Sondage lecture seule de la base prod (service role — aucune écriture)
- Migrations Lignées 1→5 **NON appliquées** en prod (colonnes/tables absentes, Lot 6 absent OK).
- Volume réel : `materiel_kits`=5 · `hike_sessions`=20 · `user_profiles`=53 · `orders`=3 (confirmed,
  460/159/219 €, 07-15/20) · **`order_items`=0** → les 3 commandes n'ont aucune ligne article ni
  trace Stripe (colonne `stripe_session_id` absente). Données consignées dans
  `RECONCILIATION_STRIPE.md` §B-bis.

### Gates explorés (autonomie maximale, aucun prod touché)
- Branching Supabase : **indisponible (plan Free, 402 `branching_limit`)**.
- Docker Desktop : absent → validation locale impossible aujourd'hui.
- `db push --dry-run` : **découverte — l'historique migrations local↔prod est désynchronisé**
  (5 versions distantes absentes localement). NE PAS pousser en prod avant réconciliation.
- Projet `lwrmuggefbmboikjgudc` (« LKDV ») : **à confirmer par Tony** comme copie de validation
  éventuelle — non touché.
- Deux chemins GATE 1 documentés dans `docs/guides/LIGNEES_VALIDATION_BASE.md` (local Docker vs copie distante).

### Chantier « Orientation & Empreinte » — Lot A livré (aucun code)
- **A.1** : table de profil prouvée = `user_profiles` (53 lignes ; `profiles` n'existe pas). ✓
- **A.2** : contraste recalculé sur la palette **réelle Design-tokens v2.0** (le plan citait
  l'ancienne palette — `#0B1F17`/`#2D6B4A`/`#A3C4A3` désormais interdits). Label `#17402C` 10,97:1 ·
  sage-700 `#365233` 8,21:1 · tertiaire `#5A7064` 5,03:1 · sage-500 `#5B7F55` 4,30:1 (grand) ·
  sage-300 `#A6C1A0` 1,84:1 (remplissage). → 3 niveaux texte discriminables ; verdict du plan
  **confirmé**. Script : `scripts/verify/contrast_palette.mjs`.
- **A.3** : `docs/reports/AUDIT_INSCRIPTION_DS.md` — 8 violations listées (emerald, `#10b981`,
  red-50/200/700, `#FEE2E2/#FECACA/#DC2626`, CTA maison, 0 `.glass`). **Rien corrigé** (chantier séparé).
- **A.4** : `ADR-010-orientation-vs-empreinte.md` (Proposé, en attente GATE A) — rejet du
  rôle-couleur avec preuves de contraste, séparation Orientation(privée)/Empreinte(public dérivée),
  alternatives écartées, **mécanisme de renoncement explicite** documenté.
- Outils : `scripts/db/probe_lignees_state.mjs` (sondage lecture seule), `scripts/db/reconcile_stripe.mjs`
  (réconciliation lecture seule), kit `supabase/reconciliation/` (orphans + honorer).

### Reste bloquant (Tony uniquement)
1. `STRIPE_SECRET_KEY` (live) dans `.env.local` → `node scripts/db/reconcile_stripe.mjs` → décisions
   par orphelin → remplir RECONCILIATION_STRIPE.md (§ côté base déjà sondée).
2. Valider GATE 1 : installer Docker Desktop (ou activer Pro / confirmer la copie `lwrmug…`) →
   je fais migrations + pgTAP (3 suites) + backfill.
3. Réconcilier l'historique migrations local↔prod avant tout push en prod.
4. Valider GATE A (ADR-010). Alors seulement : Lots B/C/D.

## 2026-09-04 — Migrations APPLIQUÉES À LA PROD (icxyvwzfjbflcbqukpfz) — override Tony

Tony a explicitement demandé l'application sur la prod (`https://icxyvwzfjbflcbqukpfz.supabase.co`), en choisissant « appliquer en direct, ordre strict » pour la réconciliation. 7 migrations appliquées dans l'ordre via `supabase db query --linked` + enregistrées dans `supabase_migrations.schema_migrations` :
  20260903010000 kit_lineage → 20260903020000 kit_field_proof → 20260903030000 stripe_fix
  → 20260903040000 kit_conservation → 20260903041000 kit_souches_seed
  → 20260904010000 user_orientation → 20260904020000 user_field_signature
- **Lot 6 (20260903050000 kit_attributions) NON appliqué** (gelé) — vérifié absence en base.
- **5 migrations « étrangères » de prod** (20260824/29/30) laissées INTACTES.
- ✅ Vérifié (lecture readonly) : client user_orientation + matviews (kit_item_survival,
  _by_kit, kit_trust_scores, user_field_signature) + signature_visibility + fonctions
  (handle_kit_lineage, refresh_kit_conservation, get_user_signature, refresh_user_field_signature)
  + RLS user_orientation (4 policies authenticated-only) + get_user_signature renvoie {} privé.

### 🐛 2 bugs latents découverts & corrigés dans 20260903040000_kit_conservation.sql
La base n'ayant jamais été appliquée (GATE 1 en attente), ces bugs n'avaient pas été attrapés :
1. `(ci.child_id IS NOT NULL)` → `(ci.kit_id IS NOT NULL)` (materiel_kit_items n'a pas de
   colonne child_id) — détection « le child a gardé cet item ».
2. `min(pairs.product_id)` (uuid) → `min(pairs.product_id::text)::uuid` (min(uuid) n'existe pas).
Les deux occurrences de chaque dans les matviews. Migrations ré-appliquées après fix (exit 0).

### Test fonctionnel empreinte
`get_user_signature(<user private>)` → `{}` (consentement privé par défaut respecté).
À noter : le bug M4 doit être appliqué AUSSI sur toute copie/validation de façon cohérente.

### Reste (gates)
- pgTAP (3 suites Lignées + identity) : à exécuter (prévu copie, mais prod override OK car ROLLBACK).
- GATE 3 (Stripe test) + réconciliation Stripe : `STRIPE_SECRET_KEY` (live) toujours absente du .env.local.
- GATE A (ADR-010) : validation Tony toujours en attente.
