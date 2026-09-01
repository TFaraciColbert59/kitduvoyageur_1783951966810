# Audit Complet du Projet LKDV

> [!abstract] **Audit technique et fonctionnel exhaustif du projet Le Kit du Voyageur (LKDV)**
> Ce document recense l'ensemble des fonctionnalités, composants, éléments, leurs utilisations, l'architecture technique, la roadmap, la dette technique et les perspectives d'avenir du projet LKDV.

---


## 🧭 1. Fonctionnalités

### 1.1. Navigation & Cartographie
- **Explorateur de Sentiers OSM** : Recherche, filtrage et affichage de 1 100+ routes de trek. Statut : 🟢 Fonctionnel.
- **Suivi Randonnée Active** : Écran temps réel : distance, allure, dénivelé, tracé GPS. Statut : 🟢 Fonctionnel.
- **Détection Sortie Itinéraire** : Alerte par vibration si déviation > 50m de la trace. Statut : 🟢 Fonctionnel.
- **Boussole & Azimut Digital** : Orientation plein air avec capteurs matériels. Statut : 🟢 Fonctionnel.
- **Globe 3D Géodonnées** : Visualisation planétaire des pays et continents. Statut : 🟢 Fonctionnel.

### 1.2. Équipement & Commerce Unifié
- **Mon Matériel (Inventaire)** : Gestion du sac perso, calcul du *Base Weight*, état d'usure. Statut : 🟢 Fonctionnel.
- **Catalogue Boutique & Affiliation** : 80+ articles outdoor, fiches techniques, liens partenaires. Statut : 🟢 Fonctionnel.
- **Configurateur de Kits IA** : Questionnaire terrain et génération de rapports de sac. Statut : 🟢 Fonctionnel.
- **Marketplace d'Occasion (C2C)** : Annonces de vente de matériel de seconde main. Statut : 🟢 Fonctionnel.
- **Location & Prêts entre Membres** : Calendrier de réservation et gestion des prêts. Statut : 🟢 Fonctionnel.
- **Enchères Outdoor en Direct** : Système d'enchères sur matériel rare ou dédicacé. Statut : 🟢 Fonctionnel.
- **Paiement Sécurisé Stripe** : Checkout validé côté serveur avec webhooks idempotents. Statut : 🟢 Fonctionnel.

### 1.3. Carnets de Voyage & Médias
- **Éditeur de Carnet de Terrain** : Création de récits étape par étape avec timeline. Statut : 🟢 Fonctionnel.
- **Moments Multimédias Géolocalisés** : Photos épinglées automatiquement sur la trace GPS. Statut : 🟢 Fonctionnel.
- **Reconnaissance IA Faune / Flore** : Identification d'espèces à partir des photos de trek. Statut : 🟢 Fonctionnel.

### 1.4. Communauté, Groupes & Clubs
- **Feed Social Mobile** : Flux de publications, likes optimistes et commentaires. Statut : 🟢 Fonctionnel.
- **Clubs Thématiques** : Espaces fermés/ouverts par région ou discipline. Statut : 🟢 Fonctionnel.
- **Coordination d'Expédition** : Espace groupe privé avec membres et droits d'accès. Statut : 🟢 Fonctionnel.
- **Partage de Frais (Tricount)** : Calcul d'équilibre financier entre participants. Statut : 🟢 Fonctionnel.
- **Sondages Décisionnels** : Votes sur les choix d'itinéraire et dates. Statut : 🟢 Fonctionnel.
- **Modération & Signalements** : File de modération et alertes abus. Statut : 🟢 Fonctionnel.

### 1.5. Monétisation & Notifications
- **Reward Engine (Grand Livre)** : Rémunération créateurs, ledger immuable et retraits. Statut : 🟢 Fonctionnel.
- **Système Multi-Canal de Notifs** : In-app, push navigateur (VAPID) et digests email Resend. Statut : 🟢 Fonctionnel.
- **Alertes SOS & Urgences** : Notification prioritaire envoyée aux contacts désignés. Statut : 🟢 Fonctionnel.

---


## 🧩 2. Composants

### 2.1. Composants Partagés (`src/components`)
- **Animations** : AnimatedPage.tsx, GestureCard.tsx, LoadingSkeleton.tsx, ScrollReveal.tsx, StaggerGrid.tsx, etc.
- **Carnet** : CarnetDetailRightSidebar.tsx, CarnetDetailVerticalTabs.tsx, CarnetFooter.tsx, CarnetHero.tsx, CarnetMap.tsx, CarnetView.tsx, GroupeToCarnetCTA.tsx, HebergementCard.tsx, HikeTimeline.tsx, JourCard.tsx, KitSouvenirCard.tsx, MobileCarnetDetailView.tsx, MomentCard.tsx, RandonneesSouvenirCard.tsx.
- **UI** : AppImage, LkvIcon, EmptyState, CustomCursor, etc.
- **Layout** : diverses structures de page (layout.tsx) pour les routes.
- **Mobile** : MobileNavWrapper, BottomTabBar, MobileDrawer, TopBar, OfflineBanner, etc.
- **Explorer** : ExplorerMap, InteractiveMap.
- **Communauté** : diverses modales et cartes pour les clubs, groupes, événements.
- **Compte** : onglets du dashboard (dynamic imports).
- **Groupes** : Cards groupe voyage (dynamic imports).
- **Home** : 17 sections homepage (Hero, FeaturedProducts, BeforeAfter, Configurator, Marketplace, AIDemo, Destinations, FAQ, PressTestimonials, SocialProof, PopularKits, TrustScore, Vision, Footer, CTA, HowItWorks, etc.).
- **Materiel** : composants pour alertes, disponibilité, forget, inventaire, kits, prêts, etc.
- **Messagerie** : AudioPlayerBubble, ConversationList, ConversationOptionsMenuModal, ConversationRow, ConversationView, GPXPreviewCard, GroupSettingsModal, MessageBubble, MessageComposer, MessageInbox, MessageList, NewConversationModal, OpenGraphCard, TypingIndicator, VoiceRecorderBar.
- **Participants** : DogParticipantCard, GlassBreakModal, HumanParticipantCard, ParticipantsManager.
- **Préparation** : modals (AddGearModal, AddParticipantModal, GlassBreakModal), PreparationCockpit, PreparationHeader, onglets (GearTab, ShakedownTab, TeamTab, WeightTab).
- **Hub** : ActionCompassWidget, ActionHydrationWidget, ActionModeView, ActionSosWidget, ActionWaterWidget, BaseCampView, HubShell, HubTopBar, PrepScoreGauge, SmartPromptsList.
- **Hiking** : composants pour le cockpit de randonnée (DesktopTopBar, DesktopLeftPanel, DesktopRightPanel, DesktopDockBar, DesktopMapOverlay, CompletionView, HikingCockpitPage).

### 2.2. Fonctionnalités Métier (`src/features`)
- **Materiel** : actions (addDepartItem, addInventoryItem, createLoan, etc.), composants (alertes, cards, depart, disponibilite, forget, inventaire, kits, etc.), domain (departCalculations), hooks (useKits), offline (departOfflineQueue), services (departNotifications, estimateConsumables, gearImageResolver, generateSmartPrompts, getAlerts, getDepartDetail, getForgetChecklist, getInventory, getKitHistory, getKits, getLoans, getMaterielSummary, getOccasionProducts, getProductSuggestions, getPublicKits, getWeather, itemCategorizer, sync), stores (useDepartOrder, useKitsOrder, useMaterielOrder), types (trekHub).
- **Messagerie** : composants, hooks (useConversations, useMessages, useRealtimeMessaging), lib (messagingUtils), services (messagingService), types (messaging.types).
- **Participants** : composants, services (dogCareService), stores (useParticipantsStore), types (participant.types).
- **Préparation** : services (gearGapEngine, loadDistribution, weightCalculator), stores (usePreparationStore), types (preparation.types).
- **Hub** : composants, services (prepScoreCalculator), stores (useHubStore), types (hub.types).
- **Hiking** : intelligence (HikeContext, HikerProfileEngine, TrailIntelligenceEngine, TrailIntelligenceService, TrailRecommendationEngine), journal (HikeTimelineJournal, JournalEventBuilder, JournalService, JournalStore), navigation (NavigationEngine, VoiceGuidanceService), offline (OfflineManager, useOfflineManager), safety (SafetyEngine), services (CopilotService, GPSService, HikeNarrativeService, HikerProfileService, HikeSessionService, OfflineService, RouteGeom, RouteService, WeatherService), types (index).
- **Gamification** : composants et services pour les badges, points, niveaux.

### 2.3. Pages (`src/app`)
- **Routes publiques** : page.tsx pour l'accueil, les pays, les guides, le blog, etc.
- **Routes authentifiées** : compte, messagerie, paramètres, etc.
- **Routes spécifiques** : randonnee-active, carnets, groupes, clubs, boutique, materiel, alertes, etc.
- **API Routes** : sous `src/app/api/` pour les endpoints Supabase et tierces (Stripe, OpenRouter, etc.).

### 2.4. Hooks (`src/hooks`)
- **Généraux** : useCartCount, useCompte, useEquipment, useGeolocation, useHapticFeedback, useInfiniteScroll, useOfflineCache, useOfflineDownload, useOfflineInventory, useOnlineStatus, usePullToRefresh, usePWAStandalone, useRecentSearches, useSwipe, useUnreadBadge, useUserKits.
- **Spécifiques** : useActiveHikeMode (étendu pour le suivi de randonnée), useChat, useInView, etc.

### 2.5. Librairies (`src/lib`)
- **IA** : aiClient, chatCompletion, configuratorEngine.
- **Analytics** : analytics.ts.
- **Animations** : constantes et hooks (useDragToRefresh, useParallax, useScrollReveal, useSwipeGesture).
- **Cart** : cart.ts.
- **Configurator** : configuratorData.ts.
- **Cookie** : cookieConsent.ts.
- **Core Web Vitals** : core-web-vitals.ts.
- **Pays** : countries.ts, countryCoordinates.ts, countryDetails.ts, danger.ts.
- **Design Tokens** : designTokens.ts.
- **Env** : env.ts.
- **Geodata** : geodata.ts.
- **Home Queries** : home-queries.ts.
- **Image** : image-preloader.ts.
- **Materiel** : comparator.ts, conflicts.ts, db.ts, events.ts, history.ts, optimizer.ts, scanner.ts.
- **Mock** : données de démonstration (carnet-chartreuse, compte-marceline, groupe-chartreuse).
- **Native** : app.ts, camera.ts, geolocation.ts, haptics.ts, index.ts, keyboard.ts, network.ts, platform.ts, preferences.ts, splash-screen.ts, status-bar.ts.
- **Offline** : indexedDB.ts, tiles.ts, offlineStorage.ts.
- **OG** : og-image-generator.ts.
- **Overpass** : overpass.ts.
- **Pays** : pays/danger.ts, preparation/plannedHikes.ts, PreparationEngine.ts, SmartDepartureEngine.ts.
- **PWA** : PwaWeatherNotifier.ts.
- **Requêtes** : requêtes pour carnets, groupes, pois, trails.
- **Schemas** : schemas pour materiel.
- **SEO** : indexnow.ts, seo-utils.ts.
- **Storage** : cacheDB.ts, MigrationEffect.tsx.
- **Style** : styleHelpers.ts.
- **Supabase** : client.ts, queries.ts, queries-compte.ts, server.ts, types.ts.
- **Types** : profile.ts.
- **Utils** : utils.ts.
- **UUID** : uuid.ts.

### 2.6. Middleware et Types
- **Middleware** : middleware.ts (pour la protection des routes).
- **Types** : carnet.ts, country.ts, kit.ts, leaflet.markercluster.d.ts (et autres déclarations TypeScript).

---


## 🔧 3. Éléments Techniques

### 3.1. Base de Données (Supabase/PostGIS)
- **Tables** : 48+ tables métier et spatiales (voir docs/.obsidian/05 — 🗄️ SUPABASE/Tables.md).
  - Utilisateurs : user_profiles, user_preferences.
  - Sentiers : hiking_routes, trail_segments, trail_metadata, trail_pois, trail_route_pois, trail_scores, spatial_ref_sys.
  - Équipement : gear_items, shop_products, kit_reports.
  - Carnets : carnets, carnet_moments, hike_sessions.
  - Communauté : travel_groups, group_members, club_members, group_expenses, group_polls, group_poll_votes, group_tasks, posts, comments, likes, comment_reports.
  - Reward Engine : reward_accounts, reward_transactions, reward_withdrawals.
  - Commandes : orders, order_items.
  - Notifications : notification_deliveries, push_subscriptions.
  - Paiements : Stripe webhooks et intégration.
- **Sécurité** : RLS activé sur toutes les tables, politiques restrictives pour les écritures, fonctions sécurisées avec search_path fixé.
- **Extensions** : PostGIS installé.
- **Migrations** : 86 migrations appliquées.

### 3.2. Stack Technique
- **Frontend** : Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS.
- **Backend** : Supabase (PostgreSQL + PostGIS), RLS par `auth.uid()`.
- **Paiement** : Stripe (server-side, webhooks asynchrones).
- **IA** : OpenRouter MCP (via service dédié).
- **3D** : react-globe.gl + three.js (globe interactif page Pays).
- **Cartes** : Leaflet + tuiles OSM/OpenTopoMap/ArcGIS.
- **Animations** : Framer Motion.
- **État** : état serveur (Requêtes Supabase avec cache ISR), état local/offline (Custom Hooks avec persistance localStorage).
- **Rendu** : RSC First pour les pages statiques, Client Components délimités pour l'interactivité.
- **Performance** : limitation du ratio pixel WebGL à 1.0 sur mobile pour 60fps constants, préchargement d'images, utilisation de WebP.

### 3.3. Outils et Développement
- **Gestion de l'état** : hooks personnalisés, contexte React (AuthContext, WishlistContext, ToastContext, SearchContext).
- **Style** : design système avec palette Foreground/Sage/Stone/Ink (orange #E4501C interdit).
- **Accessibilité** : pas spécifiquement documenté, mais suivi des bonnes pratiques.
- **Tests** : unitaires (Jest/Vitest), intégration (Cypress/Playwright) - à renforcer.
- **CI/CD** : workflow GitHub Actions avec 4 quality gates (ESLint, Type-check, Build, Validation cache).
- **Documentation** : CLAUDE.md, DESIGN_SYSTEM.md, PROGRESS.md, MISSION_LOG.md, etc.
- **Internationalisation** : non implémenté (français par défaut).
- **Déploiement** : Vercel (probable) ou similaire.

---


## 📖 4. Utilisation et Flux

### 4.1. Flux Utilisateur Typique
1. **Onboarding** : inscription/connexion via email ou social.
2. **Profil** : remplissage du profil utilisateur (user_profiles).
3. **Exploration** : découverte de randonnées via l'explorateur (/explorer) ou les guides par pays.
4. **Préparation** : utilisation du configurateur IA pour générer un kit adapté à une destination.
5. **Équipement** : gestion du inventaire personnel dans Mon Matériel.
6. **Randonnée** : lancement du suivi actif (/randonnee-active) avec GPS, déviation, stats live.
7. **Carnet** : création de moments géolocalisés pendant ou après la randonnée, ajout de photos, notes, reconnaissance IA.
8. **Communauté** : partage du carnet, interaction avec les groupes/clubs, participation aux sondages.
9. **Récompenses** : gain de points via les interactions, possibilité de retrait monétaire.
10. **Notifications** : réception d'alertes (météo, SOS, activités des groupes) via in-app, push, email.

### 4.2. Flux Techniques
- **Data Fetching** : Server Components pour les données statiques (pays, guides), Client Components pour les données dynamiques avec SWR ou useEffect.
- **Mutations** : routes API POST/PUT/DELETE avec validation Zod et appel aux services Supabase.
- **Authentification** : middleware vérifiant la session et le rôle (ex: admin).
- **Réactivité** : mise à jour en temps réel via les abonnements Supabase (pour le chat, les notifications).
- **Hors-ligne** : préchargement des tuiles et des géodonnées pour une randonnée spécifique (en cours d'implémentation).
- **IA** : appels à OpenRouter MCP via le service centralisé, avec prompts système spécifiques et garde-fous.
- **Paiement** : création de session Stripe côté serveur après vérification du panier et recalcul du prix depuis la base de données.
- **Webhooks** : traitement des événements Stripe (paiement réussi, échec, renouvellement d'abonnement).

---


## 🗺️ 5. Architecture Technique

### 5.1. Principes Fondamentaux
- **Séparation Strict** : Server Components (data fetching, API, logique serveur) vs Client Components ('use client' - UI locale uniquement).
- **Logique Métier** : encapsulée dans des services dédiés (`services/*.ts`).
- **Sécurité** : RLS obligatoire sur toutes les tables, validation d'entrée avec Zod, pas de secrets en dur, sanitisation côté serveur contre XSS.
- **Performance** : dynamique import pour les composants lourds, états UI (loading/erreur/vide) sur toutes les pages data-driven, haptic feedback sur les interactions mobiles clés, `force-dynamic` sur les routes API.
- **Design System** : palette de couleurs définie, typographie, composants réutilisatifs, règles de responsive (mobile-first avec Tailwind pour desktop et styles inline via MobilePageShell pour mobile).
- **Géolocalisation** : PostGIS utilisé exclusivement côté serveur, requêtes géographiques avec `ST_DWithin`, CRS standardisé à EPSG:4326.
- **Événements** : utilisation d'event emitters ou de stores pour la communication entre composants (ex: useHikingStore).

### 5.2. Organisation du Code
```
src/
├── app/                  # Routes Next.js 15 App Router
├── components/           # Composants partagés
├── constants/            # Constantes typées
├── contexts/             # Contextes React globaux
├── features/             # Modules métier encapsulés
├── hooks/                # Hooks personnalisés
├── lib/                  # Utilitaires & clients tiers
├── styles/               # Styles CSS globaux et Tailwind
└── types/                # Déclarations TypeScript partagées
```

### 5.3. Intégrations Tierces
- **Supabase** : base de données, authentification, stockage.
- **Stripe** : paiements, webhooks.
- **OpenRouter** : accès aux modèles IA (via MCP).
- **Leaflet / react-leaflet** : cartes interactives.
- **react-globe.gl** : globe 3D.
- **Framer Motion** : animations.
- **VAPID** : notifications push.
- **Resend** : emails transactionnels.
- **Capacitor** : préparation pour l'application mobile native (future).
- **Sonnen** : potentiellement pour les haptics (à confirmer).

---


## 🚀 6. Roadmap et Futur

### 6.1. Paliers de Faisabilité (extrait de Roadmap.md)

#### TIER A — Sécurité, Robustesse & Socle BDD (Complété ✅)
- [x] A.1 Activer RLS et verrouiller les 7 tables de sentiers contre les écritures anonymes.
- [x] A.2 Passer les vues SQL en `SECURITY INVOKER`.
- [x] A.3 Fixer le `search_path` sur toutes les fonctions PL/pgSQL.
- [x] A.4 Créer la table `kit_reports` et sécuriser la génération des rapports IA.
- [x] A.5 Recalculer obligatoirement le prix des commandes côté serveur dans `/api/checkout`.
- [x] A.6 Unifier définitivement « Mon Matériel » et la « Boutique » en supprimant le code mort.

#### TIER B — Expérience Terrain & Fluidité Mobile (En cours 🟡)
- [x] B.1 Écran `/randonnee-active` avec calculs métriques (Haversine) et affichage 60fps.
- [x] B.2 Détection temps réel des écarts d'itinéraire (> 50m) avec retour haptique.
- [ ] B.3 Optimisation LCP Mobile : réduction du temps de rendu LCP à < 2.5s sur les pages d'accueil et de sentiers (préchargement WebP, élimination du render-blocking).
- [ ] B.4 Mode Hors-Ligne Vectoriel Avancé : téléchargement préalable d'une zone géographique (traces + tuiles raster de secours en IndexedDB).
- [ ] B.5 Intégration Pull-to-Refresh & Infinite Scroll : brancher les hooks développés sur le feed `/communaute`.

#### TIER C — Intelligence Artificielle & Automatisation (Prochaine étape 🔵)
- [x] C.1 Reconnaissance visuelle faune / flore dans les carnets de voyage (`/api/carnet/identify-species`).
- [ ] C.2 Copilote Météo Prédictif : alertes orages et gel nocturne basées sur les coordonnées GPS exactes du bivouac.
- [ ] C.3 Génération Automatique de Récits de Trek : synthèse intelligente des étapes de la journée en un paragraphe poétique ou technique prêt à publier.
- [ ] C.4 Recommandation Dynamique de Matériel Manquant : analyse de la météo à J-3 pour suggérer l'ajout de crampons légers ou d'un filtre à eau supplémentaire.

#### TIER D — Écosystème & Monétisation Globale (Roadmap 2027 ⚪)
- [ ] D.1 Ouverture de la phase de retrait monétaire réel (KYC Stripe Connect pour les créateurs de carnets).
- [ ] D.2 Application Mobile Native (Packaging Capacitor / React Native avec synchronisation GPS en tâche de fond sous écran verrouillé).
- [ ] D.3 Intégration de partenariats logistiques pour la vérification physique du matériel d'occasion haut de gamme.

---


## ⚠️ 7. Dette Technique et Problèmes Critiques

### 7.1. Problèmes Critiques (extrait de État actuel.md)
- **Chargement LCP Images Mobile** : LCP élevé sur certaines connexions lentes dû à de grandes images hero non préchargées. → Action : appliquer balises `<Image priority />` et WebP systématique.
- **Code Mort TopBar** : le composant `TopBar.tsx` est débranché mais le fichier subsiste. → Action : suppression physique du fichier.
- **Intégration Hooks Feed Mobile** : hooks `useInfiniteScroll` et `usePullToRefresh` créés mais non reliés à `/communaute/page.tsx`. → Action : brancher les hooks dans le feed.
- **Crons Externes** : les routes `/api/notifications/digest` et calculs mensuels nécessitent un déclenchement périodique. → Action : configurer un cron provider (Vercel Cron ou GitHub Action).

### 7.2. Dette Technique Identifiée
- **Tests** : couverture de tests unitaires et d'intégration à augmenter (actuellement limité).
- **Documentation** : certains aspects de l'architecture interne pourraient être mieux documentés (flux de données spécifiques, décision d'architecture).
- **Optimisation des images** : utilisation systématique du WebP et des tailles appropriées, lazy loading hors du viewport immédiat.
- **Gestion d'état** : évaluation de l'adoption d'une bibliothèque de gestion d'état globale (comme Zustand ou Jotai) pour réduire la complexité des props drilling dans certains cas.
- **Code dupliqué** : recherche et unification des utilitaires similaires (ex: fonctions de formatage de date, de conversion d'unités).
- **Accessibilité** : audit complet d'accessibilité (WCAG 2.1 AA) à planifier.
- **Internationalisation** : préparation du code pour l'i18n (react-i18next ou similaire) pour soutenir plusieurs langues à l'avenir.
- **Monitoring** : mise en place d'un système de monitoring des erreurs (Sentry ou similaire) et de la performance (Lighthouse CI).
- **Déploiement** : automatisation des déploiements de prévisualisation pour les Pull Requests.

---


## 💡 8. Recommandations

### 8.1. Court Terme (0-3 mois)
- Résoudre les problèmes critiques listés en 7.1.
- Augmenter la couverture de tests sur les composants critiques et les hooks métier.
- Implémenter l'optimisation LCP Mobile (B.3).
- Préparer le terrain pour le mode hors-ligne avancé (B.4) en affinant le service de téléchargement de tuiles.
- Brancher les hooks de infinite scroll et pull-to-refresh sur le feed communautaire (B.5).

### 8.2. Moyen Terme (3-6 mois)
- Réaliser les fonctionnalités du TIER C (Copilote Météo Prédictif, Génération Automatique de Récits, Recommandation Dynamique de Matériel).
- Commencer l'application mobile native (D.2) en tant que proof of concept.
- Mettre en place le monitoring d'erreurs et de performance.
- Réaliser un audit d'accessibilité et corriger les problèmes majeurs.
- Étudier et implémenter une solution d'internationalisation légère pour le futur.

### 8.3. Long Terme (6+ mois)
- Compléter le TIER D (retrait monétaire réel, application mobile native complète, partenariats logistiques).
- Explorer l'IA collective sur les traces anonymisées (nécessitera une masse critique d'utilisateurs).
- Envisager un jumeau numérique des randonnées pour la prédiction des conditions de sentier.
- Optimiser davantage les coûts d'infrastructure (Supabase, stockage, fonctions edge).

---


## 📚 9. Sources de cet Audit
- README.md
- CLAUDE.md
- DESIGN_SYSTEM.md
- PROGRESS.md
- MISSION_LOG.md
- docs/LKDV_Plan_Maitre.md
- docs/.obsidian/01 — 🎯 PRODUIT/Fonctionnalités.md
- docs/.obsidian/01 — 🎯 PRODUIT/Roadmap.md
- docs/.obsidian/00 — 🗺️ CARTE ULTIME/État actuel.md
- docs/.obsidian/05 — 🗄️ SUPABASE/Tables.md
- docs/.obsidian/04 — 🏗️ ARCHITECTURE/Frontend.md
- docs/.obsidian/04 — 🏗️ ARCHITECTURE/Backend.md
- src/ (structure des fichiers, noms de composants, hooks, services)
- Divers fichiers de configuration (.eslintrc.js, next.config.mjs, tailwind.config.js, etc.)

> [!tip] **Mise à jour de cet audit** : ce document doit être révisé à chaque jalon majeur du projet pour refléter l'état réel du code et des fonctionnalités.

---


## 🔗 Liens Utiles dans le Vault
- [[Carte ultime LKDV]]
- [[État actuel]]
- [[Roadmap]]
- [[Fonctionnalités]]
- [[Architecture globale]]
- [[Tables Supabase]]
- [[Reward Engine]]
- [[Hiking]]
- [[Mon Matériel]]