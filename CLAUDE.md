# 🧭 CLAUDE.md — LKDV (Le Kit du Voyageur)

Fichier de référence pour Claude Code. Mis à jour le 2026-10-21. Il se lit de haut en bas : **mode de travail → règles dures → état du chantier → architecture → conventions → modules**. En cas de doute, `docs/compas/ETAT.md` et `docs/compas/PLAN-100.md` font foi pour le Compas.

---

## 1. Mode de travail autonome (à appliquer sans qu'on le redemande)

Tony travaille en autonomie complète : **carte blanche, budget 0 €**. Il ne veut plus avoir à dire « reprends », « finis le plan » ou « teste tout ».

1. **Au démarrage de toute session** : lire `docs/compas/ETAT.md`, `docs/compas/PLAN-100.md` (cases `[ ]`/`[~]`/`[x]`), `docs/compas/phase7/CONSTATS.md` et `git log -10`. Puis reprendre le premier élément non terminé. Ne pas demander « par où reprendre ».
2. **Boucle de qualité** : test → constat → cause → correction → test de non-régression → rejeu. Un constat n'est fermé que si le **même** test rejoué ne le reproduit plus, lu en base ou dans les preuves. Chaque défaut corrigé laisse un test dans `src/features/compas/__tests__/phase7Constats.test.ts`.
3. **Ne pas s'arrêter pour des points d'étape.** Lancer les longues exécutions en arrière-plan (jeux de phrases, banc Playwright), paralléliser avec des sous-agents, continuer. Ne remonter que : un vrai blocage, une décision qui n'appartient qu'à Tony, une action irréversible ou en production.
4. **Honnêteté des chiffres** : ne cocher une case du plan que **avec preuve** (test, base, capture). Écrire les vrais pourcentages, y compris les échecs et les contrôles non testables (avec la raison).
5. **Avant chaque commit** : `npx tsc --noEmit -p .` puis `npx vitest run src/features/compas` (ou `npm run test:unit` pour un changement large). Ne jamais committer un test rouge.
6. **Git** : branche de travail `claude/compas-p1-referentiel` (worktree `kitduvoyageur-compas`). Pousser avec `git push origin HEAD:claude/compas-p1-referentiel`. Pas de `git stash` nu (pile partagée entre worktrees). **Ne jamais fusionner dans `main` ni déployer en production sans l'accord explicite de Tony.** Trailer de commit : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` ; les PR finissent par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
7. **Écrire les regex avec l'outil Edit**, pas via des heredocs Python/sed (l'échappement corrompt les `\s`, `\p{L}`).
8. **Ce qui reste à Tony** (le documenter, ne pas contourner) : appliquer les migrations en production (SQL Editor), secrets (`SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`, `CRON_SECRET`, `AFFILIATE_HASH_SALT`), hCaptcha, e-mail, identité de l'éditeur, offre Vercel, comptes Apple/Google. Un classificateur peut refuser `apply_migration` en production : respecter ce refus.

### Boucle de test du Compas (phase 7)

- **Jeux de phrases** : `node scripts/compas/validate-online.mjs <url-apercu> <phrases.json> <dossier>` avec `VERCEL_SHARE` (jeton d'accès partagé de l'aperçu, **jamais écrit dans un fichier**). 50 demandes France/Europe + 50 monde. Lancer détaché (PowerShell `Start-Process … -WindowStyle Hidden`), les résultats se lisent en base : `public.trips` (+ `ops_preparation_events`), projet Supabase `icxyvwzfjbflcbqukpfz`.
- **Banc d'écran** : `npx playwright test --config=playwright.compas-full.config.ts` (variables `COMPAS_BASE_URL`, `VERCEL_SHARE`, `COMPAS_WORKERS=1`, `COMPAS_RUN_DIR`). Registre : `tests/e2e-compas-full/coverage-registry.json` ; inventaire `node scripts/compas/inventory-controls.mjs --sync-registry` ; couverture `node scripts/compas/coverage-report.mjs <dossiers> --update-registry`.
- **Aperçu Vercel** : `list_deployments` (team `team_lBmtlHsEp3YQAM4hQCaWovPG`, branche ci-dessus) puis `get_access_to_vercel_url`. Attendre que l'aperçu soit réellement prêt : la page « Deployment is building » renvoie HTTP 200, vérifier le corps.
- **Limites connues** : essai anonyme limité à 5/heure/IP (connexion démo éteinte) ; cookies de session liés à l'hôte de l'aperçu ; Photon plafonné à 3 req/s côté site.
- **Docs** : `docs/compas/phase7/{CONSTATS,JOURNAL-TESTS,COUVERTURE,BANC-DE-TEST,CHARGE-SIMULEE}.md` et `constats/`.

---

## 2. Règles dures (non négociables)

### Stack et plateformes
- Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind · Supabase (PostgreSQL + PostGIS) · Stripe (server-side).
- **Web : Vercel uniquement. Mobile : Capacitor uniquement** (`capacitor.config.ts`, `ios/`, `android/`). Aucune autre plateforme (Netlify, GitHub Pages, Cloudflare, Firebase, Render, Fly, Railway, Expo/React Native) : ni config, ni plugin, ni workflow, ni dépendance.
- **IA** : NVIDIA NIM en direct (Nemotron 3.5 Lightning), décision de Tony du 2026-10-07. Pas d'OpenRouter dans l'app. L'IA ne fournit jamais un lieu, un prix ou une date dans le Compas : elle relit et conseille.
- **Météo** : MET Norway (CC BY 4.0) + NASA POWER, gratuits, usage commercial permis. **Cartes** : Leaflet + tuiles OSM / OpenFreeMap ; jamais d'URL de tuiles qui exige une clé sans clé (`tests/map/leafletTiles`). **3D** : react-globe.gl + three.js.
- Fichiers à ne pas modifier : `.env.example`, `tsconfig.json` (sauf nécessité globale), scripts npm `dev` et `build`.

### Sécurité
- **RLS obligatoire** sur toutes les tables, isolation par `auth.uid()`. Fonctions `SECURITY DEFINER` : `search_path` verrouillé, `EXECUTE` retiré à `PUBLIC` pour les fonctions de déclencheur.
- Transactions `SERIALIZABLE` pour les opérations multi-étapes (finances, inventaire). PostGIS uniquement côté serveur, CRS EPSG:4326, `ST_DWithin`.
- Validation `zod` de **toute** entrée utilisateur à la réception ; sanitisation XSS côté serveur ; secrets uniquement en variables d'environnement, jamais en dur ; Stripe côté serveur, webhooks asynchrones ; routes API avec `export const dynamic = 'force-dynamic'`.
- RGPD : documents d'identité (`trip_documents`) jamais visibles des tiers (`viewerCanReadDocs = false`) ni dans les exports/carnets ; aucune coordonnée exposée par un kit ou une empreinte partagés.

### Architecture de code
- **Server Components** : data fetching, API, secrets. **Client Components** (`'use client'`) : UI locale uniquement (état, événements), aucune requête de données.
- Logique métier dans des couches de service (`services/*.ts`, `lib/supabase/queries-*.ts`, `features/*/engine/` purs et testés).
- Navigation client : `useRouter().push()`, jamais `window.location.href`.
- Garde null : `isFinite(null)` vaut `true` ; vérifier `lat != null && lng != null` avant.

### Build et CI
- `typescript.ignoreBuildErrors = false` et `eslint.ignoreDuringBuilds = false` : le lint et le typage tournent au build, 0 erreur ESLint sur le dépôt. Aucun bypass.
- Portes de qualité : `npm run lint` · `npm run type-check` · `npm run build` · `node scripts/validate-country-cache.mjs`. Le workflow est à `.github/ci.yml` (à déplacer vers `.github/workflows/ci.yml` depuis l'interface GitHub).
- Tests : `npm test` (Vitest), `npm run test:unit` avant tout commit majeur, E2E `npm run test:e2e*`, visuel `npm run test:visual`, accessibilité `npm run test:a11y`.
- `transpilePackages: ['react-globe.gl', 'three', 'lucide-react']` (`next.config.mjs`). Redirections permanentes : `/shop`, `/catalogue/*` → `/boutique`.

---

## 3. Le Compas (`/compas`) — le seul préparateur

Décision de Tony du 2026-10-02 : `/compas` est l'**unique** préparateur et configurateur, pour tout type d'aventure (étapes Où, Nous, Résa, Verdict, Kit). Il sera renommé « Préparateur » en fin de chantier.

### Principes
- « Où » est la demande (phrase libre + précisions facultatives). « Préparer mon aventure » crée le voyage et lance une préparation visible (`CompasPrep`).
- **Une seule lecture des réglages** : `engine/tripContext.ts` (jours, nuits, heures, groupe, ancre). Ne jamais recalculer jours ou groupe ailleurs.
- Itinéraire : `engine/itinerary.ts` (pur) sur les lieux **réels** de la zone (Overpass via `lookupAreaPlaces`). Budget : `engine/costs.ts` (barèmes versionnés). Pays entier : l'IA propose des bases vérifiées sur la carte ; sinon `engine/countryBases.ts`.
- Sans aventure, ou avec `?nouvelle=1` : Compas vide (`CompasStart`) ; le premier geste crée un brouillon (`compasCreateTripAction`). `?etape=ou|nous|resa|verdict|kit` ouvre une étape. Thème clair forcé.
- Redirections : `/prepare`, `/preparer` → `/compas` ; `/hub/nouveau`, `/voyages/nouveau`, `/voyage-ia` → `/compas?nouvelle=1` ; `/preparation`, `/materiel/preparation`, `/hub/preparation`, `/ai-configurator`, `/rapport-kit`, `/configurateur` → `/compas?etape=kit` ; `/preparer-sentier/[id]` crée l'aventure puis ouvre `/compas`.
- Supprimés (ne pas recréer) : ancien flux en trois étapes (`adventure-prep/components`, store, `saveAdventure`, `tripCommit`, `/api/adventure/commit`), assistant en cinq étapes et `/api/trips/autogen`, `features/preparator`, `features/preparation`, `src/app/prepare/actions.ts`.
- Conservés : « Partir librement » (`features/free-departure`) et le moteur/services d'`adventure-prep` (`engine/`, `routingService`, `geocodeService`, `weatherService`).
- Priorités : **P0 moteur → P1 données → P2 validation → P3 gelé**. Ne rien commencer en P3 tant que P0/P1 ne passent pas P2.

### De la phrase au lieu (pipeline de lecture)
`understandRequest` / `parseIntentRules` (`engine/intent.ts`, `request.ts`, `intentWords.ts`, `intentEn.ts`) → actions `set_destination` / `set_origin` → serveur `compasSetDestinationAction` → `resolvePlaceByName` (`server/placeSearch.ts`) : table fermée `knownRegions` → référentiel `geo_places` → `lookupDestination` → spécialiste IA (éteint en production) → `lookupNatural` → `lookupLoose` (`server/placeLookup.ts`) → Photon → Nominatim/LocationIQ → Geoapify en secours.
- Pays dit dans la phrase joint au lieu (« Tatras, Pologne ») : `engine/saidCountry.ts` ; noms canoniques (dont CJK) : `engine/countryNames.ts` ; régions célèbres mal rangées : `engine/knownRegions.ts` (table fermée, Lofoten, Tatras).
- Cache de recherche clé `v4` : **seuls les résultats Photon sont mis en cache**, jamais le secours. `fetchJson` réessaie (créneau plein ×4 à 450 ms ; 429/5xx/réseau une fois à 1200 ms).
- Filtres de plausibilité : `plausibleLooseMatch`, `looseRank`, `resemblesQuery`, `subPlaceQueries` (`engine/places.ts`). Le code d'un sentier (GR, HRP, GTA, TMB) n'est jamais dans le nom du lieu.
- Décision C-006 : le pays dit gagne ; sinon le pays du centre du massif (limite documentée).

### Style et interaction
- Le Compas est la **référence visuelle et d'interaction** (verre Liquid Glass v8, tiroirs à trois hauteurs, capsule d'étapes, lignes `.cp-row`, états « non renseigné / non évalué »). Voir `docs/compas/DESIGN_REFERENCE.md` et `DESIGN_SYSTEM.md` §0. En cas de divergence, le Compas prévaut sur `/materiel`.
- Dette connue : variables `--cp-*` limitées à `.compas`, valeurs `rgb()` littérales, primitives (`LkvButton`, `GlassCard`) pas encore alignées.

---

## 4. Design système

- **Source de vérité** : `src/styles/tokens.css`, `DESIGN_SYSTEM.md` (racine), `src/design/README.md`, `docs/Design-tokens.md` v2.0 (sage-500 `#5B7F55`). Consommer les tokens `--lkv-*` (ou la façade `@/design`), **aucune couleur littérale nouvelle**.
- **Interdits** : `#E4501C` (orange), `#1C2620`, et les anciens `#A3C4A3` / `#0B1F17` / `#2D6B4A` dans du code neuf. États actifs : forest `#17402C`.
- Palette Liquid Glass : Forest `#17402C`, Sage `#5B7F55`, Stone `#FAF8F5`. Ombres à base d'encre `rgba(11,31,23,%)`, jamais `rgba(0,0,0)`.
- Typographie : sans Söhne/Inter ; italique d'emphase Georgia (`<em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>`) ; mono JetBrains Mono ; labels en capitales avec tracking `0.14em` ou `0.1em`.
- Verre : `backdrop-filter: blur(24px) saturate(1.5)` sur BottomTabBar et MobileDrawer.
- Primitives : `GlassCard`, `LkvButton`, `LkvChip`, `LkvIcon`, `AppShell` (safe-areas). Cibles tactiles ≥ 44 px. Icônes décoratives en `aria-hidden`.
- **Interaction (skill Aura)** : `.agents/skills/interaction-design/SKILL.md` pour toute décision UX. Respecter `prefers-reduced-motion`, animer uniquement `transform` et `opacity`, préserver safe-areas et composants shell (`MobilePageShell`, `BottomTabBar`, `HamburgerMenu`).
- États de page : chargement = spinner centré ; erreur = ⚠️ + message + « Réessayer » ; vide = `EmptyState`.
  ```tsx
  {loading && <Spinner />}
  {error && <ErrorState onRetry={reload} />}
  {!loading && !error && items.length === 0 && <EmptyState />}
  {!loading && !error && items.length > 0 && <Content />}
  ```
- Animations : `framer-motion` directement, keyframes `.animate-*` de `src/styles/tailwind.css`, `PageTransition`. Les anciens `AnimatedPage`, `ScrollReveal`, `StaggerGrid`, `GestureCard` n'existent plus.

### Pattern responsive (dual-view)
```tsx
<>
  <div className="hidden md:block">{/* DESKTOP — Tailwind */}</div>
  <div className="block md:hidden">
    <MobilePageShell>{/* MOBILE — styles en ligne, pas de Tailwind */}</MobilePageShell>
  </div>
</>
```
Espaceur de pied mobile : `<div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />`.

### Images, cartes, recherche, hors ligne
- Toute image : `src={data.image_url || '/assets/images/no_image.png'}` ; `AppImage` applique le repli.
- Cartes : overlays `ExplorerMap` en z-index `1000`/`400` (sous la BottomTabBar mobile) ; `h-dvh` plutôt que `calc(100vh - …)`. `InteractiveMap` : barre latérale masquée sur mobile (`hidden sm:flex`), bouton flottant de filtres, panneau `fixed inset-0 z-50` avec « ✕ Fermer ». Tuiles : préchargement seulement avec clé (`ATLAS_TILES` + `NEXT_PUBLIC_ARCGIS_API_KEY`).
- Hooks (`src/hooks/`) : `useHapticFeedback` (`const { haptic } = …`, `haptic('light'|'medium'|'selection'|'success')`), `useOnlineStatus`, `useOfflineCache` (localStorage + TTL), `useRecentSearches` (max 10). `OfflineBanner` (z-index 55) monte dans `MobileNavWrapper`. `SearchOverlay` + `SearchProvider` dans le layout racine (soumission `/boutique?q=`).
- Chargement différé : `dynamic(() => import(...), { ssr: false })` pour les composants lourds (`/communauté`, `/compte`, `/groups/[groupId]` ; y renommer l'import `dynamicImport` pour ne pas heurter `export const dynamic`).
- Providers du layout racine : Auth > Wishlist > Toast > Search.

### Navigation mobile
`MobilePageShell` (safe-area) · `MobileDrawer` (verre) · `MobileNavWrapper` (TopBar + BottomTabBar + MobileDrawer + SearchOverlay + OfflineBanner) · `TopBar` (`variant: 'standard' | 'on-image'`, `onMenuOpen`, `scrolled`) · `BottomTabBar` à 5 onglets : Accueil, Explorer, Boutique, Communauté, Compte.
`LkvIcon` : `home`, `mountain`, `bag`, `doc`, `user`, `search`, `chevron-left`, `chevron-right`, `heart`, `bookmark`, `bell`, `map-pin`, `star`, `minus`, `plus`, `close`, `menu`, `arrow-right`, `lock`, `filter`, `users`, `compass`, `backpack`, `book`.

---

## 5. Modules métier

### Randonnée — cockpit GPS (`/randonnee-active`)
- Page `HikingCockpitPage.tsx` orchestrant `DesktopTopBar`, `DesktopLeftPanel`, `DesktopRightPanel`, `DesktopDockBar`, `DesktopMapOverlay` (tracé live), `CompletionView`, `ContextualInsight`. Anciens `TopHUD`, `SideControlsCol`, `NavigationCard`, `CockpitBottomNav`, `OfflineIndicatorBanner` supprimés.
- État : `useHikingStore` (`src/features/hiking/hooks/useHikingStore.ts`) — positions, `isActive/isPaused/isCompleted`, distance, durée, vitesses, dénivelé, allure, `deviation`, `nextPoi`, `weather`, `batteryLevel`, `startHike(routeId)`, `pauseHike`, `resumeHike`, `stopHike`, `fetchWeather`.
- Démarrage : `/randonnee-active?routeId=X` → `navigator.permissions.query({ name: 'geolocation' })` : `prompt` = écran explicatif, `granted` = `startHike` automatique, `denied` = erreur avec « Réessayer » ; sans `routeId` = suivi libre.
- Données : table `hiking_routes` (`geometry` peut être une chaîne GeoJSON, parsée avec `JSON.parse` sûr) ; tables `hike_sessions`, `carnet_moments`, `identified_species`, `trail_pois`, `trail_segments`, `trail_metadata`, `trail_scores`. Insertion anonyme bloquée par RLS.
- API : `POST /api/hike-sessions`, `GET /api/hike-sessions/[id]/narrative` (récits IA), `GET /api/hikes`, `POST /api/carnet/identify-species`, `POST /api/kit-report/generate`, `POST /api/kit-report/convert-inventory`.
- Modules : import/export GPX (`GPXImportExportModal`), `Terrain3DViewer`, `SafetyCenterModal`, 9 suites Vitest (Tracking, Navigation, Safety, Offline, Copilot, TrailIntelligence, JournalEventBuilder, GPX, HikeNarrative).
- `/terrain` : hub mobile (desktop redirigé vers `/explorer`), porté par `src/features/terrain-live/`.

### Lignées de kits (« L'Épreuve du terrain »)
Métrique fondatrice : **taux de conservation d'un objet à travers les générations, pondéré par la preuve terrain GPS**.
- `materiel_kits` = entité vivante unique ; `kit_reports` = snapshot (`kit_reports.kit_id`) (ADR-007). Filiation matérialisée (ADR-008) : `forked_from`, `lineage_root_id`, `generation`, `ancestors uuid[]`, dérivés **uniquement** par le trigger `handle_kit_lineage` (anti-cycle, profondeur 50 ; la suppression du parent garde la lignée).
- **Auto-fork** : forker son propre kit → `origin='manuel'`, `forked_from=NULL` (fraude n°1, neutre pour conservation/commission). Modules purs testés (`tests/kits/`) : `src/features/kits/{lineage,royalty,trust,kitRef,fieldProof}.ts`.
- **Preuve terrain** : `hike_sessions.kit_id`, `kit_field_reports` (essentiel/utile/jamais_servi/defaillant/manquait, upsert (session,item_key), RLS own), `field_proven_count` incrémenté à partir de 1 km.
- **RGPD** : `get_kit_journal` n'expose jamais lat/lon/noms (granularité max = massif, `hiking_routes.region`) ; `positions_geojson` ne sort jamais via un kit partagé.
- **Scores** : matviews `kit_trust_scores`, deux axes distincts (propagation/endurance), jamais une note unique ; plancher 5 sessions ; indépendance au prix ; auto-forks exclus ; 1 utilisateur par lignée ; refresh `refresh_kit_conservation()` + cron (Bearer `CRON_SECRET`).
- **Part créateur** : `royalty_config` (300 bps, 70/20/10, 3 générations), `kit_attributions` (UNIQUE `order_item_id`), `kit_royalty_shares`, versement en crédit boutique (`reward_accounts.store_credit_cents` + `store_credit_ledger`), conditionné à la preuve terrain. Cookie `lkdv_kit_ref` signé HMAC (`KIT_REF_SECRET`).
- **UI** : `KitSheetProvider` + `useKitSheet()` ; le kit n'a aucune page (`/k/[token]` = partage externe). Vocabulaire public : « lignée », « kit souche », « éprouvé », « gardé par X voyageurs sur 10 », « part créateur » — **jamais** de vocabulaire génétique.
- Endpoints : `/api/kits/[id]/{sheet,refer,field-report}`, `/api/kits/{discovery,my-royalties}`, crons `refresh-kit-scores` et `finalize-kit-attributions`, `/api/materiel/fork`, `/api/checkout`, `/api/stripe/webhook`.
- Migrations (ordre strict, valider sur copie d'abord) : `20260903010000_kit_lineage` → `…020000_kit_field_proof` → `…030000_stripe_fix` → `…040000_kit_conservation` → `…041000_kit_souches_seed` → `…050000_kit_attributions`.

### Orientation (privée) et Empreinte (publique)
Doctrine : « rien ne s'affiche sans preuve terrain » ; un rôle auto-déclaré et affiché classe les personnes → rejeté (ADR-010).
- **Orientation** : `public.user_orientation`, RLS `user_id = auth.uid()` en lecture et écriture, aucune policy publique. Ne sert que de prior au configurateur (`applyOrientationPrefill`, **annoncé** par le préfixe `prefilledFrom`, jamais silencieux). Modifiable dans `/compte`, « passer » toujours visible.
- **Empreinte** : matview `user_field_signature` depuis `hike_sessions` (+ `hiking_routes.region`) uniquement ; granularité région, jamais de coordonnées ; plancher 3 sorties ; aucun agrégat inter-utilisateurs ; consentement `user_profiles.signature_visibility` (**private par défaut**) via `get_user_signature()`. Rendu `UserFieldSignature` (`FieldSeal` déterministe, encre + sage uniquement, sans ordre).
- Verrou `scripts/verify/identity_compliance.mjs` (casse le build) : aucun `--role-*`, aucun grade/rang/palier/classement, orientation jamais dans un composant public hors `src/components/identity`, aucun hex hors palette dans les fichiers `identity`.
- Table de profil = `user_profiles` (pas `profiles`). Migrations : `20260904010000_user_orientation` → `20260904020000_user_field_signature`.

### Module Voyage (expéditions collaboratives)
- Routes : `/voyages`, `/voyages/[slug]` (onglets Vue d'ensemble, Itinéraire, Kit, Équipe, Budget, Papiers, Notes/Carnet), `/voyages/[slug]/itineraire`, `/kit`, `/export` (A4 imprimable sans documents privés), `/lieux` et `/lieux/[slug]` (refuges, bivouacs, scoring bayésien, floutage éthique), `/go/[slug]` (affiliation, HTTP 307, journal RGPD SHA-256 sans IP en clair), `/api/voyages`, `/api/voyages/[slug]/gpx` (GPX 1.1), `/api/affiliate/travelpayouts` (HMAC-SHA256 timing-safe). `/voyages/nouveau` redirige vers le Compas.
- 20 tables, toutes en RLS : voyages (`trips`, `trip_collaborators`, `trip_steps`, `trip_items`, `trip_expenses`, `trip_documents`, `trip_pois`, `trip_safety_checkpoints`, `trip_notes`, `destination_steps`), lieux (`places`, `place_reviews`, `place_photos`, `place_reports`), affiliation (`affiliate_partners`, `…_programs`, `…_offers`, `…_links`, `…_clicks`, `…_conversions`), carnets (`carnets`, `carnet_moments`, `carnet_kit_items`). Fonctions `can_read_trip` / `can_edit_trip` en `security definer stable`, `search_path = public`.
- Moteurs purs (TDD, déterministes) : `features/trips/engine/` (`tripWizardEngine`, `plannerEngine` Naismith + Haversine, `contextualKitEngine` altitude > 2400 m, `budgetEngine` `simplifyDebts`, `exportEngine`, `carnetConversionEngine`), `features/places/engine/` (`ethicalBlurring` ~500 m, `placeScoreEngine`), `features/affiliation/engine/affiliateEngine.ts` (anti-open-redirect, hachage RGPD, HMAC).
- Conformité DGCCRF : composant `<AffiliateDisclosure />` obligatoire et `rel="sponsored nofollow"`.

### Compte, panier, SEO
- Compte : `useAuth()` + `fetchDashboardData(user.id)` (`src/lib/supabase/queries-compte.ts` : `fetchFullProfile`, `fetchUserCarnets`, `fetchUserClubs`, `fetchUserOrders`, `fetchUserBadges`, `fetchUserActivities`, `fetchNextTrip`, `fetchDashboardData`). Pas de données factices ; données optionnelles gardées (`data?.field`).
- Panier : `addToCart(item, quantity = 1)`, `updateQuantity(id, quantity)`, `removeFromCart(id)`, `getCartTotals(items)` → `{ totalItems, totalPriceEur, totalWeightG, savedEur }`.
- SEO : `layout.tsx` avec `metadata` (title, description, openGraph, twitter) sur les routes publiques ; helpers `seo-utils.ts` (`BreadcrumbList`, `FAQPage`, `Product`) ; sitemap et `robots.txt` à jour, sans routes mortes.
- Pages mobiles de référence : Accueil (`src/app/page.tsx`), Explorer, Fiche produit (`ProductDetailClient`, `ProductBuyBar`), Panier, Checkout, Communauté, Admin, Carnet (`carnet/[slug]`), Terrain, Rapport d'expédition.

---

## 6. Workflow d'un changement

1. Cadrer (schéma, endpoints, RLS) ; pour un changement de base, écrire la migration et la valider sur copie avant la production.
2. Implémenter dans la couche qui convient (moteur pur, service, composant).
3. Tests : unitaires à côté du code ou dans `__tests__/` / `tests/`, E2E Playwright pour les parcours.
4. Vérifier : `tsc`, tests, `npm run lint`, et `npx next build` pour un changement large.
5. Documenter : ligne dans `docs/compas/ETAT.md` / `PLAN-100.md` / `phase7/*` si le Compas est touché.
6. Commit (trailer ci-dessus) et poussage ; PR vers `main` seulement sur demande, relue par un spécialiste base de données et un architecte.
